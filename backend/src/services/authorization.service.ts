import type { OrganizationKind } from "@prisma/client";
import { prisma } from "../utils/prisma.js";
import { mergePlanFeaturesWithOverrides } from "../utils/plan-features.js";
import { resolveBillingOrganizationId, resolveEffectivePlan } from "./plan-limits.service.js";
import { userHasEffectiveAccess } from "./tenancy-access.service.js";
import {
  CAP_ASSET_ACCESS_GRANT_MANAGE,
  CAP_MARKETING_SETTINGS_WRITE,
  CAP_MARKETING_SUMMARY_READ,
  CAP_MATRIX_CHILD_CREATE,
  CAP_MATRIX_WORKSPACE_GRANT_MANAGE,
  CAP_ORG_MEMBERS_MANAGE,
  CAP_ORG_WORKSPACE_READ,
  CAP_ORG_WORKSPACE_WRITE,
  CAP_WEBHOOK_ENDPOINT_MANAGE,
  CAP_WEBHOOK_EVENT_READ,
  CAP_WEBHOOK_EVENT_REPLAY,
} from "../constants/capabilities.js";
import {
  isMatrixWideAdminRole,
  isResellerMatrixAdminRole,
  isWorkspaceAdminRole,
  isWorkspaceTeamManagerRole,
} from "../constants/roles.js";
import { resolveResellerMatrixOrganizationId } from "./reseller.service.js";

export type AuthContext = {
  organizationId: string;
};

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

async function membershipRole(userId: string, organizationId: string): Promise<string | null> {
  const m = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  return m?.role ?? null;
}

/** Papel efetivo no workspace: membership direta ou, na matriz, o da matriz se acesso for só via hierarquia. */
async function effectiveWorkspaceRole(userId: string, workspaceOrganizationId: string): Promise<string | null> {
  const direct = await membershipRole(userId, workspaceOrganizationId);
  if (direct) return direct;

  let walk: string | null = workspaceOrganizationId;
  for (let i = 0; i < 32 && walk; i++) {
    const org: { parentOrganizationId: string | null } | null = await prisma.organization.findFirst({
      where: { id: walk, deletedAt: null },
      select: { parentOrganizationId: true },
    });
    const parentId: string | null = org?.parentOrganizationId ?? null;
    if (!parentId) break;
    const parentRow = await prisma.organization.findFirst({
      where: { id: parentId, deletedAt: null },
      select: { organizationKind: true },
    });
    const mem = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId: parentId } },
    });
    if (mem && parentRow?.organizationKind === "MATRIX") {
      return mem.role;
    }
    walk = parentId;
  }
  return null;
}

async function orgKind(organizationId: string): Promise<OrganizationKind | null> {
  const o = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
    select: { organizationKind: true },
  });
  return o?.organizationKind ?? null;
}

/**
 * Autorização central por capability + contexto de organização ativa (JWT).
 */
export async function assertCan(userId: string, capability: string, ctx: AuthContext): Promise<void> {
  const { organizationId } = ctx;
  const allowedAccess = await userHasEffectiveAccess(userId, organizationId);
  assert(allowedAccess, "Sem acesso a este contexto organizacional");

  const billingId = await resolveBillingOrganizationId(organizationId);
  const { plan } = await resolveEffectivePlan(organizationId);
  const billingOrg = await prisma.organization.findFirst({
    where: { id: billingId, deletedAt: null },
    select: { featureOverrides: true },
  });
  const features = mergePlanFeaturesWithOverrides(plan, billingOrg?.featureOverrides);

  switch (capability) {
    case CAP_ORG_WORKSPACE_READ:
      return;

    case CAP_ORG_WORKSPACE_WRITE: {
      const role = await effectiveWorkspaceRole(userId, organizationId);
      assert(
        role && (isWorkspaceAdminRole(role) || isMatrixWideAdminRole(role)),
        "Sem permissão para editar o workspace"
      );
      return;
    }

    case CAP_ORG_MEMBERS_MANAGE: {
      const role = await effectiveWorkspaceRole(userId, organizationId);
      assert(
        role && (isWorkspaceTeamManagerRole(role) || isMatrixWideAdminRole(role)),
        "Sem permissão para gerir membros"
      );
      return;
    }

    case CAP_MARKETING_SUMMARY_READ: {
      assert(features.marketingDashboard, "Módulo de marketing não está ativo no plano");
      return;
    }

    case CAP_MARKETING_SETTINGS_WRITE: {
      assert(features.marketingDashboard, "Módulo de marketing não está ativo no plano");
      const role = await effectiveWorkspaceRole(userId, organizationId);
      assert(
        role && (isWorkspaceAdminRole(role) || isMatrixWideAdminRole(role)),
        "Sem permissão para alterar configurações de marketing"
      );
      return;
    }

    case CAP_MATRIX_CHILD_CREATE: {
      const kind = await orgKind(organizationId);
      assert(kind === "MATRIX", "Apenas a matriz pode criar workspaces filhos");
      const matrixId = await resolveResellerMatrixOrganizationId(userId, organizationId);
      const role = await membershipRole(userId, matrixId);
      assert(role && isResellerMatrixAdminRole(role), "Sem permissão para criar workspaces");
      assert(features.multiOrganization, "Plano sem multiempresa / revenda");
      return;
    }

    case CAP_MATRIX_WORKSPACE_GRANT_MANAGE: {
      const matrixId = await resolveResellerMatrixOrganizationId(userId, organizationId);
      const role = await membershipRole(userId, matrixId);
      assert(role && isResellerMatrixAdminRole(role), "Sem permissão para gerir grants de workspace");
      return;
    }

    case CAP_ASSET_ACCESS_GRANT_MANAGE: {
      const role = await effectiveWorkspaceRole(userId, organizationId);
      assert(
        role && (isWorkspaceAdminRole(role) || isMatrixWideAdminRole(role)),
        "Sem permissão para gerir acesso a contas"
      );
      return;
    }

    case CAP_WEBHOOK_ENDPOINT_MANAGE: {
      assert(features.webhooks, "Módulo de webhooks não está ativo no plano");
      const role = await effectiveWorkspaceRole(userId, organizationId);
      assert(
        role && (isWorkspaceAdminRole(role) || isMatrixWideAdminRole(role)),
        "Sem permissão para gerir webhooks"
      );
      return;
    }

    case CAP_WEBHOOK_EVENT_READ: {
      assert(features.webhooks, "Módulo de webhooks não está ativo no plano");
      const role = await effectiveWorkspaceRole(userId, organizationId);
      assert(role, "Sem permissão para ver eventos de webhook");
      return;
    }

    case CAP_WEBHOOK_EVENT_REPLAY: {
      assert(features.webhooks, "Módulo de webhooks não está ativo no plano");
      const role = await effectiveWorkspaceRole(userId, organizationId);
      assert(
        role && (isWorkspaceAdminRole(role) || isMatrixWideAdminRole(role)),
        "Sem permissão para reprocessar eventos"
      );
      return;
    }

    default:
      throw new Error(`Capability desconhecida: ${capability}`);
  }
}

/** Leitura de marketing: plano + tenancy (para controllers legados). */
export async function assertCanReadMarketing(userId: string, organizationId: string): Promise<void> {
  await assertCan(userId, CAP_MARKETING_SUMMARY_READ, { organizationId });
}

/** Mutar anúncios: papel com escrita em mídia + tenancy. */
export async function assertCanMutateAds(userId: string, organizationId: string): Promise<void> {
  await assertCan(userId, CAP_MARKETING_SUMMARY_READ, { organizationId });
  const role = await effectiveWorkspaceRole(userId, organizationId);
  assert(
    role &&
      (isWorkspaceAdminRole(role) ||
        isMatrixWideAdminRole(role) ||
        role === "media_meta_manager" ||
        role === "media_google_manager" ||
        role === "media_manager"),
    "Sem permissão para alterar campanhas nas redes"
  );
}
