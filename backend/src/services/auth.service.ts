import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { prisma } from "../utils/prisma.js";
import { env } from "../config/env.js";
import { slugifyOrganizationName, uniqueOrganizationSlug } from "../utils/org-slug.js";
import type { LoginInput, RegisterInput } from "../validators/auth.validator.js";
import type { JwtPayload } from "../middlewares/auth.middleware.js";
import { isPlatformAdminEmail } from "../utils/platform-admin.js";

const SALT_ROUNDS = 10;

export type AuthOrganizationDto = { id: string; name: string; slug: string };

export type AuthUserDto = {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  organization: AuthOrganizationDto;
};

export type MembershipSummaryDto = {
  organizationId: string;
  role: string;
  organization: AuthOrganizationDto;
};

export type AuthProfileExtendedDto = AuthUserDto & {
  memberships: MembershipSummaryDto[];
  managedOrganizations: AuthOrganizationDto[];
  /** true se o e-mail está em PLATFORM_ADMIN_EMAILS (gestão global). */
  platformAdmin: boolean;
};

async function organizationToDto(organizationId: string): Promise<AuthOrganizationDto> {
  const org = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
  });
  if (!org) {
    throw new Error("Organização não encontrada");
  }
  return { id: org.id, name: org.name, slug: org.slug };
}

async function buildAuthUserDto(
  userId: string,
  email: string,
  name: string,
  organizationId: string
): Promise<AuthUserDto> {
  const organization = await organizationToDto(organizationId);
  return {
    id: userId,
    email,
    name,
    organizationId,
    organization,
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
    }));
}

/**
 * Empresas filiais para o seletor de contexto:
 * - Na matriz (sem pai): filhos diretos, se o usuário for owner/admin nela.
 * - Num filho: todos os irmãos (mesmo parentId), se o usuário for owner/admin da mãe.
 * Assim o dropdown não some ao entrar numa empresa cliente.
 */
async function listManagedOrganizationsForActiveContext(
  userId: string,
  activeOrganizationId: string
): Promise<AuthOrganizationDto[]> {
  const active = await prisma.organization.findFirst({
    where: { id: activeOrganizationId, deletedAt: null },
  });
  if (!active) return [];

  const parentId = active.parentOrganizationId;
  if (parentId) {
    const parentMem = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId: parentId } },
    });
    if (!parentMem || !["owner", "admin"].includes(parentMem.role)) return [];

    const children = await prisma.organization.findMany({
      where: { parentOrganizationId: parentId, deletedAt: null },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    });
    return children;
  }

  const mem = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId: activeOrganizationId } },
  });
  if (!mem || !["owner", "admin"].includes(mem.role)) return [];

  return prisma.organization.findMany({
    where: { parentOrganizationId: activeOrganizationId, deletedAt: null },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });
}

/** Acesso direto (Membership) ou revenda: owner/admin da empresa mãe acessa empresa filha. */
export async function userHasEffectiveAccess(userId: string, organizationId: string): Promise<boolean> {
  const direct = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    include: { organization: true },
  });
  if (direct && !direct.organization.deletedAt) return true;

  const org = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
  });
  if (!org?.parentOrganizationId) return false;

  const parentMem = await prisma.membership.findUnique({
    where: {
      userId_organizationId: { userId, organizationId: org.parentOrganizationId },
    },
  });
  return parentMem != null && ["owner", "admin"].includes(parentMem.role);
}

/** Renomear empresa: membro direto admin/owner OU admin/owner da mãe (revenda). */
export async function canManageOrganization(userId: string, organizationId: string): Promise<boolean> {
  const m = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (m && ["owner", "admin"].includes(m.role)) return true;

  const org = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
  });
  if (!org?.parentOrganizationId) return false;

  const pm = await prisma.membership.findUnique({
    where: {
      userId_organizationId: { userId, organizationId: org.parentOrganizationId },
    },
  });
  return pm != null && ["owner", "admin"].includes(pm.role);
}

/** Operações na conta da agência (listar/criar filhos): só admin/owner com membership na org atual. */
export async function assertDirectOrgAdmin(userId: string, organizationId: string): Promise<void> {
  const m = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!m || !["owner", "admin"].includes(m.role)) {
    throw new Error("Sem permissão para gerenciar empresas vinculadas");
  }
}

/** Convites / equipe na org: admin ou owner direto, ou admin/owner da matriz (revenda). */
export async function assertOrgAdminOrParentAgency(userId: string, organizationId: string): Promise<void> {
  const direct = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (direct && ["owner", "admin"].includes(direct.role)) return;

  const org = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
  });
  if (!org?.parentOrganizationId) {
    throw new Error("Sem permissão para gerenciar equipe desta empresa");
  }
  const pm = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId: org.parentOrganizationId } },
  });
  if (!pm || !["owner", "admin"].includes(pm.role)) {
    throw new Error("Sem permissão para gerenciar equipe desta empresa");
  }
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
      role: "owner",
    },
  });
  const { accessToken, refreshToken } = await createTokens(user.id, user.email, org.id);
  await saveRefreshToken(user.id, refreshToken);
  const userDto = await buildAuthUserDto(user.id, user.email, user.name, org.id);
  const memberships = await listMembershipSummaries(user.id);
  return {
    user: userDto,
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
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: { organization: true },
  });
  if (!membership) {
    throw new Error("Usuário sem organização vinculada");
  }
  const { accessToken, refreshToken } = await createTokens(
    user.id,
    user.email,
    membership.organizationId
  );
  await saveRefreshToken(user.id, refreshToken);
  const userDto = await buildAuthUserDto(
    user.id,
    user.email,
    user.name,
    membership.organizationId
  );
  const memberships = await listMembershipSummaries(user.id);
  return {
    user: userDto,
    memberships,
    accessToken,
    refreshToken,
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
    user: userDto,
    memberships,
    accessToken,
    refreshToken: newRefresh,
  };
}

export async function switchActiveOrganization(userId: string, targetOrganizationId: string) {
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
  const { accessToken, refreshToken } = await createTokens(userId, user.email, targetOrganizationId);
  await saveRefreshToken(userId, refreshToken);
  const userDto = await getAuthProfile(userId, targetOrganizationId);
  if (!userDto) {
    throw new Error("Não foi possível carregar o perfil");
  }
  const memberships = await listMembershipSummaries(userId);
  const managedOrganizations = await listManagedOrganizationsForActiveContext(userId, targetOrganizationId);
  return {
    user: userDto,
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
    return {
      id: membership.user.id,
      email: membership.user.email,
      name: membership.user.name,
      organizationId: membership.organization.id,
      organization: {
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
      },
    };
  }

  const org = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
  });
  if (!org?.parentOrganizationId) return null;

  const parentMembership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: { userId, organizationId: org.parentOrganizationId },
    },
  });
  if (!parentMembership || !["owner", "admin"].includes(parentMembership.role)) {
    return null;
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    organizationId: org.id,
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
    },
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
  return { id: user.id, email: user.email, name: user.name };
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
  const userDto = await buildAuthUserDto(userId, user.email, user.name, organizationId);
  const memberships = await listMembershipSummaries(userId);
  const managedOrganizations = await listManagedOrganizationsForActiveContext(userId, organizationId);
  return {
    user: userDto,
    memberships,
    managedOrganizations,
    accessToken,
    refreshToken,
  };
}
