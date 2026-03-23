import type { Request, Response } from "express";
import { z } from "zod";
import type { JwtPayload } from "../middlewares/auth.middleware.js";
import { assertCan } from "../services/authorization.service.js";
import {
  CAP_WEBHOOK_ENDPOINT_MANAGE,
  CAP_WEBHOOK_EVENT_READ,
  CAP_WEBHOOK_EVENT_REPLAY,
} from "../constants/capabilities.js";
import {
  createWebhookEndpoint,
  listWebhookEndpoints,
  listWebhookEvents,
  patchWebhookEndpoint,
  replayWebhookEvent,
} from "../services/webhooks.service.js";
import { appendAuditLog } from "../services/audit-log.service.js";

type AuthRequest = Request & { user: JwtPayload };

const createSchema = z.object({
  name: z.string().min(1).max(120),
  publicSlug: z.string().min(3).max(63).regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/).optional().nullable(),
});

const patchEndpointSchema = z.object({
  active: z.boolean().optional(),
  name: z.string().min(1).max(120).optional(),
});

export async function webhooksEndpointsList(req: Request, res: Response) {
  const { organizationId, userId } = (req as AuthRequest).user;
  try {
    await assertCan(userId, CAP_WEBHOOK_EVENT_READ, { organizationId });
    const items = await listWebhookEndpoints(organizationId);
    return res.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro";
    if (msg.includes("não está ativo")) {
      return res.status(403).json({ message: msg });
    }
    if (msg.includes("Sem permissão")) {
      return res.status(403).json({ message: msg });
    }
    return res.status(400).json({ message: msg });
  }
}

export async function webhooksEndpointsCreate(req: Request, res: Response) {
  const { organizationId, userId } = (req as AuthRequest).user;
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Dados inválidos" });
  }
  try {
    await assertCan(userId, CAP_WEBHOOK_ENDPOINT_MANAGE, { organizationId });
    const { item, plainSecret } = await createWebhookEndpoint(organizationId, parsed.data);
    await appendAuditLog({
      actorUserId: userId,
      organizationId,
      action: "webhook.endpoint.created",
      entityType: "WebhookEndpoint",
      entityId: item.id,
      metadata: { publicSlug: item.publicSlug },
    });
    return res.status(201).json({ item, plainSecret });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro";
    if (msg.includes("não está ativo")) {
      return res.status(403).json({ message: msg });
    }
    if (msg.includes("Sem permissão")) {
      return res.status(403).json({ message: msg });
    }
    return res.status(400).json({ message: msg });
  }
}

export async function webhooksEndpointsPatch(req: Request, res: Response) {
  const { organizationId, userId } = (req as AuthRequest).user;
  const { id } = req.params;
  const parsed = patchEndpointSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Dados inválidos" });
  }
  try {
    await assertCan(userId, CAP_WEBHOOK_ENDPOINT_MANAGE, { organizationId });
    const item = await patchWebhookEndpoint(organizationId, id, parsed.data);
    await appendAuditLog({
      actorUserId: userId,
      organizationId,
      action: "webhook.endpoint.updated",
      entityType: "WebhookEndpoint",
      entityId: id,
      metadata: { keys: Object.keys(parsed.data) },
    });
    return res.json({ item });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro";
    if (msg.includes("não está ativo") || msg.includes("Sem permissão")) {
      return res.status(403).json({ message: msg });
    }
    return res.status(400).json({ message: msg });
  }
}

export async function webhooksEventsList(req: Request, res: Response) {
  const { organizationId, userId } = (req as AuthRequest).user;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const offset = req.query.offset ? Number(req.query.offset) : undefined;
  try {
    await assertCan(userId, CAP_WEBHOOK_EVENT_READ, { organizationId });
    const data = await listWebhookEvents(organizationId, { limit, offset });
    return res.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro";
    if (msg.includes("não está ativo") || msg.includes("Sem permissão")) {
      return res.status(403).json({ message: msg });
    }
    return res.status(400).json({ message: msg });
  }
}

export async function webhooksEventsReplay(req: Request, res: Response) {
  const { organizationId, userId } = (req as AuthRequest).user;
  const { id } = req.params;
  try {
    await assertCan(userId, CAP_WEBHOOK_EVENT_REPLAY, { organizationId });
    const item = await replayWebhookEvent(organizationId, id);
    await appendAuditLog({
      actorUserId: userId,
      organizationId,
      action: "webhook.event.replayed",
      entityType: "WebhookEvent",
      entityId: item.id,
      metadata: { sourceEventId: id },
    });
    return res.status(201).json({ item });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro";
    if (msg.includes("não está ativo") || msg.includes("Sem permissão")) {
      return res.status(403).json({ message: msg });
    }
    return res.status(400).json({ message: msg });
  }
}
