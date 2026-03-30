import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { prisma } from "../utils/prisma.js";
import { env } from "../config/env.js";
import { slugifyOrganizationName, uniqueOrganizationSlug } from "../utils/org-slug.js";
import type { LoginInput, RegisterInput } from "../validators/auth.validator.js";
import type { JwtPayload } from "../middlewares/auth.middleware.js";
import { isPlatformAdminEmail } from "../utils/platform-admin.js";
import { userHasEffectiveAccess } from "./tenancy-access.service.js";
import { appendAuditLog } from "./audit-log.service.js";
import {
  isMatrixWideAdminRole,
  isResellerMatrixAdminRole,
  isWorkspaceAdminRole,
  isWorkspaceTeamManagerRole,
} from "../constants/roles.js";
import { resolveBillingOrganizationId, resolveEffectivePlan } from "./plan-limits.service.js";
import { getRootResellerPartnerFlag } from "../utils/org-hierarchy.js";
import { computeMatrizNavEligible } from "../utils/matriz-nav-eligible.js";

const SALT_ROUNDS = 10;

export type AuthOrganizationDto = { id: string; name: string; slug: string };

export type AuthUserDto = {
  id: string;
  email: string;
  name: string;
  /** Opcional; UI usa primeira palavra de `name` como fallback. */
  firstName: string | null;
  organizationId: string;
  organization: AuthOrganizationDto;
  /** Tipo de tenant da organização ativa (JWT). */
  organizationKind: import("@prisma/client").OrganizationKind;
  /** Se não nulo, a org ativa é filha na hierarquia (ex.: agência filial). */
  parentOrganizationId: string | null;
  /** Raiz do ecossistema habilitada para revenda (painel matriz / filhos). */
  rootResellerPartner: boolean;
  /**
   * Fonte única para UI: mostrar menu /revenda. Só true se a org do JWT for raiz MATRIX com revenda
   * (ou utilizador platform admin). Não recalcular só no frontend.
   */
  matrizNavEligible: boolean;
};

export type MembershipSummaryDto = {
  organizationId: string;
  role: string;
  organization: AuthOrganizationDto;
  organizationKind: import("@prisma/client").OrganizationKind;
  /** Filial na hierarquia quando não nulo (espelha a org do vínculo). */
  parentOrganizationId: string | null;
};

export type AuthProfileExtendedDto = AuthUserDto & {
  memberships: MembershipSummaryDto[];
  managedOrganizations: AuthOrganizationDto[];
  /** true se o e-mail está em PLATFORM_ADMIN_EMAILS (gestão global). */
  platformAdmin: boolean;
};

async function loadOrgTenantFields(organizationId: string): Promise<{
  organization: AuthOrganizationDto;
  organizationKind: import("@prisma/client").OrganizationKind;
  parentOrganizationId: string | null;
}> {
  const org = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      organizationKind: true,
      parentOrganizationId: true,
    },
  });
  if (!org) {
    throw new Error("Organização não encontrada");
  }
  return {
    organization: { id: org.id, name: org.name, slug: org.slug },
    organizationKind: org.organizationKind,
    parentOrganizationId: org.parentOrganizationId,
  };
}

async function buildAuthUserDto(
  userId: string,
  email: string,
  name: string,
  organizationId: string,
  firstName: string | null
): Promise<AuthUserDto> {
  const tenant = await loadOrgTenantFields(organizationId);
  const rootResellerPartner = await getRootResellerPartnerFlag(organizationId);
  const matrizNavEligible = await computeMatrizNavEligible(organizationId, email);
  return {
    id: userId,
    email,
    name,
    firstName,
    organizationId,
    organization: tenant.organization,
    organizationKind: tenant.organizationKind,
    parentOrganizationId: tenant.parentOrganizationId,
    rootResellerPartner,
    matrizNavEligible,
  };
}

async function listMembershipSummaries(userId: string): Promise<MembershipSummaryDto[]> {
  const rows = await prisma.membership.findMany({
    where: { userId },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
  return rows
    .filter((m) => !m.organization.deletedAt)
    .map((m) => ({
      organizationId: m.organizationId,
      role: m.role,
      organization: {
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
      },
      organizationKind: m.organization.organizationKind,
      parentOrganizationId: m.organization.parentOrganizationId,
    }));
}

/** Descendentes diretos (BFS), sem incluir a raiz. */
async function collectDescendantOrganizationIds(rootId: string): Promise<string[]> {
  const out: string[] = [];
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const children = await prisma.organization.findMany({
      where: { parentOrganizationId: id, deletedAt: null },
      select: { id: true },
    });
    for (const c of children) {
      out.push(c.id);
      queue.push(c.id);
    }
  }
  return out;
}

/**
 * Empresas para o seletor de contexto (revenda / hierarquia):
 * Sobe a cadeia de `active` até achar um nó onde o usuário é owner/admin.
 * - Se esse nó for a raiz (matriz), lista todos os descendentes (árvore inteira).
 * - Caso contrário (ex.: agência), lista só os filhos diretos desse nó.
 */
async function listManagedOrganizationsForActiveContext(
  userId: string,
  activeOrganizationId: string
): Promise<AuthOrganizationDto[]> {
  const active = await prisma.organization.findFirst({
    where: { id: activeOrganizationId, deletedAt: null },
  });
  if (!active) return [];

  let cursor: string | null = activeOrganizationId;
  let adminAnchor: string | null = null;
  for (let i = 0; i < 32 && cursor; i++) {
    const mem = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId: cursor } },
    });
    if (mem && isResellerMatrixAdminRole(mem.role)) {
      adminAnchor = cursor;
      break;
    }
    const parentLink: { parentOrganizationId: string | null } | null = await prisma.organization.findFirst({
      where: { id: cursor, deletedAt: null },
      select: { parentOrganizationId: true },
    });
    cursor = parentLink?.parentOrganizationId ?? null;
  }

  if (!adminAnchor) return [];

  const anchor = await prisma.organization.findFirst({
    where: { id: adminAnchor, deletedAt: null },
    select: { parentOrganizationId: true },
  });
  if (!anchor) return [];

  if (!anchor.parentOrganizationId) {
    const ids = await collectDescendantOrganizationIds(adminAnchor);
    if (ids.length === 0) return [];
    return prisma.organization.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    });
  }

  return prisma.organization.findMany({
    where: { parentOrganizationId: adminAnchor, deletedAt: null },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });
}

/** Gerir org: papéis elevados na própria org ou em qualquer ancestral. */
export async function canManageOrganization(userId: string, organizationId: string): Promise<boolean> {
  let walk: string | null = organizationId;
  for (let i = 0; i < 32 && walk; i++) {
    const mem = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId: walk } },
      include: { organization: true },
    });
    if (
      mem &&
      mem.organization &&
      !mem.organization.deletedAt &&
      (isWorkspaceAdminRole(mem.role) || isMatrixWideAdminRole(mem.role))
    ) {
      return true;
    }
    const parentLink: { parentOrganizationId: string | null } | null = await prisma.organization.findFirst({
      where: { id: walk, deletedAt: null },
      select: { parentOrganizationId: true },
    });
    walk = parentLink?.parentOrganizationId ?? null;
  }
  return false;
}

/** Operações na conta da agência (listar/criar filhos): admin na org atual (matriz/agência ou conta principal). */
export async function assertDirectOrgAdmin(userId: string, organizationId: string): Promise<void> {
  const m = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!m || (!isResellerMatrixAdminRole(m.role) && !isWorkspaceAdminRole(m.role))) {
    throw new Error("Sem permissão para gerenciar empresas vinculadas");
  }
}

/** Convites / equipe na org: admin ou owner direto, ou admin/owner em qualquer ancestral. */
export async function assertOrgAdminOrParentAgency(userId: string, organizationId: string): Promise<void> {
  const direct = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (direct && (isWorkspaceTeamManagerRole(direct.role) || isMatrixWideAdminRole(direct.role))) return;

  let walk: string | null = organizationId;
  for (let i = 0; i < 32 && walk; i++) {
    const parentLink: { parentOrganizationId: string | null } | null = await prisma.organization.findFirst({
      where: { id: walk, deletedAt: null },
      select: { parentOrganizationId: true },
    });
    const parentId: string | null = parentLink?.parentOrganizationId ?? null;
    if (!parentId) break;
    const pm = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId: parentId } },
    });
    if (pm && (isWorkspaceTeamManagerRole(pm.role) || isMatrixWideAdminRole(pm.role))) return;
    walk = parentId;
  }
  throw new Error("Sem permissão para gerenciar equipe desta empresa");
}

export async function register(data: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw new Error("E-mail já cadastrado");
  }
  const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);
  const orgDisplayName = data.organizationName?.trim() || `${data.name} — Empresa`;
  const slugBase = slugifyOrganizationName(data.organizationName?.trim() || data.name);
  const slug = await uniqueOrganizationSlug(slugBase);
  const starterPlan = await prisma.plan.findUnique({ where: { slug: "starter" } });
  const org = await prisma.organization.create({
    data: {
      name: orgDisplayName,
      slug,
      planId: starterPlan?.id,
      organizationKind: "DIRECT",
    },
  });
  if (starterPlan?.id) {
    await prisma.subscription.create({
      data: {
        organizationId: org.id,
        planId: starterPlan.id,
        billingMode: "trial",
        status: "trialing",
      },
    });
  }
  const user = await prisma.user.create({
    data: {
      email: data.email,
      password: hashedPassword,
      name: data.name,
    },
  });
  await prisma.membership.create({
    data: {
      userId: user.id,
      organizationId: org.id,
      role: "workspace_owner",
    },
  });
  const { accessToken, refreshToken } = await createTokens(user.id, user.email, org.id);
  await saveRefreshToken(user.id, refreshToken);
  const userDto = await buildAuthUserDto(user.id, user.email, user.name, org.id, user.firstName ?? null);
  const memberships = await listMembershipSummaries(user.id);
  return {
    user: { ...userDto, platformAdmin: isPlatformAdminEmail(user.email) },
    memberships,
    accessToken,
    refreshToken,
  };
}

export async function login(data: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) {
    throw new Error("E-mail ou senha inválidos");
  }
  const valid = await bcrypt.compare(data.password, user.password);
  if (!valid) {
    throw new Error("E-mail ou senha inválidos");
  }
  if (user.suspendedAt) {
    throw new Error("Conta suspensa. Contate o administrador da sua empresa.");
  }
  const membershipRows = await prisma.membership.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: { organization: true },
  });
  const membership = membershipRows.find(
    (m) => !m.organization.deletedAt && m.organization.workspaceStatus !== "ARCHIVED"
  );
  if (!membership) {
    throw new Error(
      membershipRows.length > 0
        ? "Nenhuma organização ativa disponível. Contate o administrador."
        : "Usuário sem organização vinculada"
    );
  }
  const { accessToken, refreshToken } = await createTokens(
    user.id,
    user.email,
    membership.organizationId
  );
  await saveRefreshToken(user.id, refreshToken);
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  const userDto = await buildAuthUserDto(
    user.id,
    user.email,
    user.name,
    membership.organizationId,
    user.firstName ?? null
  );
  const memberships = await listMembershipSummaries(user.id);
  return {
    user: { ...userDto, platformAdmin: isPlatformAdminEmail(user.email) },
    memberships,
    accessToken,
    refreshToken,
    mustChangePassword: user.mustChangePassword,
  };
}

export async function refreshAccessToken(refreshTokenStr: string) {
  let decoded: { userId?: string; type?: string; organizationId?: string };
  try {
    decoded = jwt.verify(refreshTokenStr, env.JWT_REFRESH_SECRET) as {
      userId?: string;
      type?: string;
      organizationId?: string;
    };
  } catch {
    throw new Error("Refresh token inválido ou expirado");
  }
  if (decoded.type !== "refresh" || !decoded.userId) {
    throw new Error("Refresh token inválido ou expirado");
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { token: refreshTokenStr },
    include: { user: true },
  });
  if (!stored || stored.expiresAt < new Date()) {
    throw new Error("Refresh token inválido ou expirado");
  }

  let orgId = decoded.organizationId;
  if (!orgId) {
    const m = await prisma.membership.findFirst({
      where: { userId: stored.userId },
      orderBy: { createdAt: "asc" },
    });
    orgId = m?.organizationId;
  }
  if (!orgId) {
    throw new Error("Usuário sem organização");
  }

  const allowed = await userHasEffectiveAccess(stored.userId, orgId);
  if (!allowed) {
    throw new Error("Sem acesso a esta empresa");
  }

  await prisma.refreshToken.delete({ where: { id: stored.id } });
  const { accessToken, refreshToken: newRefresh } = await createTokens(
    stored.user.id,
    stored.user.email,
    orgId
  );
  await saveRefreshToken(stored.user.id, newRefresh);
  const userDto = await getAuthProfile(stored.userId, orgId);
  if (!userDto) {
    throw new Error("Sessão inválida");
  }
  const memberships = await listMembershipSummaries(stored.userId);
  return {
    user: { ...userDto, platformAdmin: isPlatformAdminEmail(stored.user.email) },
    memberships,
    accessToken,
    refreshToken: newRefresh,
  };
}

export async function switchActiveOrganization(
  userId: string,
  targetOrganizationId: string,
  audit?: { previousOrganizationId: string; ip?: string | null; userAgent?: string | null }
) {
  const allowed = await userHasEffectiveAccess(userId, targetOrganizationId);
  if (!allowed) {
    throw new Error("Sem acesso a esta empresa");
  }
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });
  if (!user) {
    throw new Error("Usuário não encontrado");
  }
  if (user.suspendedAt) {
    throw new Error("Conta suspensa. Contate o administrador da sua empresa.");
  }
  if (audit && audit.previousOrganizationId !== targetOrganizationId) {
    await appendAuditLog({
      actorUserId: userId,
      organizationId: targetOrganizationId,
      action: "session.active_organization.changed",
      entityType: "UserSession",
      entityId: userId,
      metadata: {
        fromOrganizationId: audit.previousOrganizationId,
        toOrganizationId: targetOrganizationId,
      },
      ip: audit.ip,
      userAgent: audit.userAgent,
    });
  }
  const { accessToken, refreshToken } = await createTokens(userId, user.email, targetOrganizationId);
  await saveRefreshToken(userId, refreshToken);
  const userDto = await getAuthProfile(userId, targetOrganizationId);
  if (!userDto) {
    throw new Error("Não foi possível carregar o perfil");
  }
  const memberships = await listMembershipSummaries(userId);
  const managedOrganizations = await listManagedOrganizationsForActiveContext(userId, targetOrganizationId);
  return {
    user: { ...userDto, platformAdmin: isPlatformAdminEmail(user.email) },
    memberships,
    managedOrganizations,
    accessToken,
    refreshToken,
  };
}

async function createTokens(userId: string, email: string, organizationId: string) {
  const payload: JwtPayload = { userId, email, organizationId };
  const accessOpts: SignOptions = { expiresIn: "15m" };
  const refreshOpts: SignOptions = { expiresIn: "7d" };
  const accessToken = jwt.sign(payload, env.JWT_SECRET, accessOpts);
  const refreshToken = jwt.sign(
    { userId, type: "refresh", organizationId },
    env.JWT_REFRESH_SECRET,
    refreshOpts
  );
  return { accessToken, refreshToken };
}

/** Perfil: membership direta ou acesso de revenda (JWT com organizationId da empresa cliente). */
export async function getAuthProfile(userId: string, organizationId: string): Promise<AuthUserDto | null> {
  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: { userId, organizationId },
    },
    include: { user: true, organization: true },
  });
  if (membership?.user && !membership.user.deletedAt && !membership.organization.deletedAt) {
    const rootResellerPartner = await getRootResellerPartnerFlag(membership.organization.id);
    const matrizNavEligible = await computeMatrizNavEligible(
      membership.organization.id,
      membership.user.email
    );
    return {
      id: membership.user.id,
      email: membership.user.email,
      name: membership.user.name,
      firstName: membership.user.firstName ?? null,
      organizationId: membership.organization.id,
      organization: {
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
      },
      organizationKind: membership.organization.organizationKind,
      parentOrganizationId: membership.organization.parentOrganizationId,
      rootResellerPartner,
      matrizNavEligible,
    };
  }

  const allowed = await userHasEffectiveAccess(userId, organizationId);
  if (!allowed) return null;

  const org = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
  });
  if (!org) return null;

  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });
  if (!user) return null;

  const rootResellerPartner = await getRootResellerPartnerFlag(org.id);
  const matrizNavEligible = await computeMatrizNavEligible(org.id, user.email);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    firstName: user.firstName ?? null,
    organizationId: org.id,
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
    },
    organizationKind: org.organizationKind,
    parentOrganizationId: org.parentOrganizationId,
    rootResellerPartner,
    matrizNavEligible,
  };
}

export async function getAuthProfileExtended(
  userId: string,
  organizationId: string
): Promise<AuthProfileExtendedDto | null> {
  const profile = await getAuthProfile(userId, organizationId);
  if (!profile) return null;
  const memberships = await listMembershipSummaries(userId);
  const managedOrganizations = await listManagedOrganizationsForActiveContext(userId, organizationId);
  return {
    ...profile,
    memberships,
    managedOrganizations,
    platformAdmin: isPlatformAdminEmail(profile.email),
  };
}

export async function updateProfile(userId: string, name: string) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { name: name.trim() },
  });
  return { id: user.id, email: user.email, name: user.name, firstName: user.firstName ?? null };
}

/** Alteração de senha autenticada (valida senha atual com bcrypt). */
export async function changePasswordForUser(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });
  if (!user) {
    throw new Error("Usuário não encontrado");
  }
  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) {
    throw new Error("Senha atual incorreta");
  }
  const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashed, mustChangePassword: false },
  });
}

async function saveRefreshToken(userId: string, token: string) {
  const decoded = jwt.decode(token) as { exp?: number };
  const expiresAt = decoded?.exp
    ? new Date(decoded.exp * 1000)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: { token, userId, expiresAt },
  });
}

export type MeContextDto = {
  user: AuthUserDto;
  memberships: MembershipSummaryDto[];
  managedOrganizations: AuthOrganizationDto[];
  activeOrganizationId: string;
  organizationKind: import("@prisma/client").OrganizationKind | null;
  billingOrganizationId: string;
  plan: { slug: string; name: string } | null;
  platformAdmin: boolean;
  rootResellerPartner: boolean;
  matrizNavEligible: boolean;
};

export async function getMeContext(userId: string, organizationId: string): Promise<MeContextDto | null> {
  const profile = await getAuthProfile(userId, organizationId);
  if (!profile) return null;
  const billingOrganizationId = await resolveBillingOrganizationId(organizationId);
  const org = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
    select: { organizationKind: true },
  });
  const { plan } = await resolveEffectivePlan(organizationId);
  const rootResellerPartner = await getRootResellerPartnerFlag(organizationId);
  const matrizNavEligible = profile.matrizNavEligible;
  return {
    user: profile,
    memberships: await listMembershipSummaries(userId),
    managedOrganizations: await listManagedOrganizationsForActiveContext(userId, organizationId),
    activeOrganizationId: organizationId,
    organizationKind: org?.organizationKind ?? null,
    billingOrganizationId,
    plan: plan ? { slug: plan.slug, name: plan.name } : null,
    platformAdmin: isPlatformAdminEmail(profile.email),
    rootResellerPartner,
    matrizNavEligible,
  };
}

/** Login completo após convite ou fluxos que já criaram membership. */
export async function finalizeSessionForUser(userId: string, organizationId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });
  if (!user) {
    throw new Error("Usuário não encontrado");
  }
  const allowed = await userHasEffectiveAccess(userId, organizationId);
  if (!allowed) {
    throw new Error("Sem acesso a esta empresa");
  }
  const { accessToken, refreshToken } = await createTokens(user.id, user.email, organizationId);
  await saveRefreshToken(userId, refreshToken);
  const userDto = await buildAuthUserDto(userId, user.email, user.name, organizationId, user.firstName ?? null);
  const memberships = await listMembershipSummaries(userId);
  const managedOrganizations = await listManagedOrganizationsForActiveContext(userId, organizationId);
  return {
    user: { ...userDto, platformAdmin: isPlatformAdminEmail(user.email) },
    memberships,
    managedOrganizations,
    accessToken,
    refreshToken,
  };
}

export { userHasEffectiveAccess };
