import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma.js";
import { mergePlanFeaturesWithOverrides } from "../utils/plan-features.js";
import { resolveBillingOrganizationId, resolveEffectivePlan } from "./plan-limits.service.js";

const MAX_ENDPOINTS_PER_ORG = 20;

export function generateSigningSecret(): string {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

export function verifyWebhookSignature(secret: string, rawBody: Buffer, header: string | undefined): boolean {
  if (!header || !secret) return false;
  const expectedHex = createHmac("sha256", secret).update(rawBody).digest("hex");
  const normalized = header.trim().toLowerCase();
  const hex = normalized.startsWith("sha256=") ? normalized.slice(7) : normalized;
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length !== expectedHex.length) return false;
  try {
    const a = Buffer.from(hex, "hex");
    const b = Buffer.from(expectedHex, "hex");
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function organizationWebhookFeaturesEnabled(organizationId: string): Promise<boolean> {
  const { plan } = await resolveEffectivePlan(organizationId);
  const billingId = await resolveBillingOrganizationId(organizationId);
  const billingOrg = await prisma.organization.findFirst({
    where: { id: billingId, deletedAt: null },
    select: { featureOverrides: true },
  });
  const features = mergePlanFeaturesWithOverrides(plan, billingOrg?.featureOverrides);
  return features.webhooks === true;
}

function rawBodyToJson(rawBody: Buffer): Prisma.InputJsonValue {
  const s = rawBody.toString("utf8");
  if (!s.length) return {};
  try {
    return JSON.parse(s) as Prisma.InputJsonValue;
  } catch {
    return { _encoding: "base64", data: rawBody.toString("base64") };
  }
}

function hashKey(parts: string): string {
  return createHash("sha256").update(parts, "utf8").digest("hex").slice(0, 64);
}

export type IngestResult =
  | { ok: false; code: "NOT_FOUND" | "INVALID_SIGNATURE" | "FORBIDDEN" }
  | { ok: true; eventId: string; duplicate: boolean };

export async function ingestWebhookPublic(
  publicSlug: string,
  rawBody: Buffer,
  signatureHeader: string | undefined,
  idempotencyHeader: string | undefined
): Promise<IngestResult> {
  const endpoint = await prisma.webhookEndpoint.findFirst({
    where: { publicSlug, active: true },
    include: { organization: true },
  });
  if (!endpoint) {
    return { ok: false, code: "NOT_FOUND" };
  }
  const org = endpoint.organization;
  if (org.deletedAt || org.workspaceStatus === "ARCHIVED") {
    return { ok: false, code: "NOT_FOUND" };
  }
  const enabled = await organizationWebhookFeaturesEnabled(org.id);
  if (!enabled) {
    return { ok: false, code: "FORBIDDEN" };
  }
  if (!verifyWebhookSignature(endpoint.signingSecret, rawBody, signatureHeader)) {
    return { ok: false, code: "INVALID_SIGNATURE" };
  }

  const eventKey =
    idempotencyHeader && idempotencyHeader.trim().length > 0
      ? idempotencyHeader.trim().slice(0, 200)
      : hashKey(`${org.id}:${rawBody.toString("base64")}`);
  const rawPayload = rawBodyToJson(rawBody);
  const now = new Date();

  try {
    const row = await prisma.webhookEvent.create({
      data: {
        organizationId: org.id,
        webhookEndpointId: endpoint.id,
        eventKey,
        sourceType: "custom",
        status: "PROCESSED",
        rawPayload,
        processedAt: now,
      },
    });
    return { ok: true, eventId: row.id, duplicate: false };
  } catch (e) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002") {
      const existing = await prisma.webhookEvent.findFirst({
        where: { organizationId: org.id, eventKey },
        select: { id: true },
      });
      if (existing) return { ok: true, eventId: existing.id, duplicate: true };
    }
    throw e;
  }
}

export async function listWebhookEndpoints(organizationId: string) {
  return prisma.webhookEndpoint.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, publicSlug: true, active: true, createdAt: true, updatedAt: true },
  });
}

export async function createWebhookEndpoint(
  organizationId: string,
  data: { name: string; publicSlug?: string | null }
) {
  const enabled = await organizationWebhookFeaturesEnabled(organizationId);
  if (!enabled) {
    throw new Error("Módulo de webhooks não está ativo no plano");
  }
  const count = await prisma.webhookEndpoint.count({ where: { organizationId } });
  if (count >= MAX_ENDPOINTS_PER_ORG) {
    throw new Error(`Limite de ${MAX_ENDPOINTS_PER_ORG} endpoints de webhook por empresa`);
  }

  let publicSlug = data.publicSlug?.trim().toLowerCase() || "";
  if (!publicSlug) {
    publicSlug = `w-${randomBytes(8).toString("hex")}`;
  }
  if (publicSlug.length < 3 || publicSlug.length > 63) {
    throw new Error("Slug público deve ter entre 3 e 63 caracteres");
  }
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(publicSlug)) {
    throw new Error("Slug público: apenas letras minúsculas, números e hífen");
  }

  const clash = await prisma.webhookEndpoint.findUnique({ where: { publicSlug } });
  if (clash) {
    throw new Error("Este slug público já está em uso");
  }

  const signingSecret = generateSigningSecret();
  const row = await prisma.webhookEndpoint.create({
    data: {
      organizationId,
      name: data.name.trim(),
      publicSlug,
      signingSecret,
    },
    select: { id: true, name: true, publicSlug: true, active: true, createdAt: true, updatedAt: true },
  });
  return { item: row, plainSecret: signingSecret };
}

export async function patchWebhookEndpoint(
  organizationId: string,
  endpointId: string,
  data: { active?: boolean; name?: string }
) {
  const row = await prisma.webhookEndpoint.findFirst({
    where: { id: endpointId, organizationId },
  });
  if (!row) {
    throw new Error("Endpoint não encontrado");
  }
  const patch: Prisma.WebhookEndpointUpdateInput = {};
  if (data.active !== undefined) patch.active = data.active;
  if (data.name !== undefined) patch.name = data.name.trim();
  await prisma.webhookEndpoint.update({ where: { id: endpointId }, data: patch });
  return prisma.webhookEndpoint.findFirst({
    where: { id: endpointId },
    select: { id: true, name: true, publicSlug: true, active: true, createdAt: true, updatedAt: true },
  });
}

export async function listWebhookEvents(
  organizationId: string,
  query: { limit?: number; offset?: number }
) {
  const limit = Math.min(Math.max(query.limit ?? 30, 1), 100);
  const offset = Math.max(query.offset ?? 0, 0);
  const [items, total] = await Promise.all([
    prisma.webhookEvent.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        webhookEndpointId: true,
        eventKey: true,
        sourceType: true,
        status: true,
        processedAt: true,
        errorMessage: true,
        retryCount: true,
        createdAt: true,
      },
    }),
    prisma.webhookEvent.count({ where: { organizationId } }),
  ]);
  return { items, total, limit, offset };
}

export async function replayWebhookEvent(organizationId: string, eventId: string) {
  const original = await prisma.webhookEvent.findFirst({
    where: { id: eventId, organizationId },
  });
  if (!original) {
    throw new Error("Evento não encontrado");
  }
  const suffix = `${Date.now()}-${randomBytes(6).toString("hex")}`;
  const newKey = `${original.eventKey}:replay:${suffix}`.slice(0, 250);
  const row = await prisma.webhookEvent.create({
    data: {
      organizationId,
      webhookEndpointId: original.webhookEndpointId,
      eventKey: newKey,
      sourceType: original.sourceType,
      status: "PROCESSED",
      rawPayload: original.rawPayload as Prisma.InputJsonValue,
      normalizedPayload:
        original.normalizedPayload === null ? undefined : (original.normalizedPayload as Prisma.InputJsonValue),
      processedAt: new Date(),
      retryCount: original.retryCount + 1,
    },
    select: {
      id: true,
      webhookEndpointId: true,
      eventKey: true,
      sourceType: true,
      status: true,
      processedAt: true,
      createdAt: true,
    },
  });
  return row;
}
