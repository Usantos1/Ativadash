import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { prisma } from "../utils/prisma.js";
import { env } from "../config/env.js";
import { slugifyOrganizationName, uniqueOrganizationSlug } from "../utils/org-slug.js";
import type { LoginInput, RegisterInput } from "../validators/auth.validator.js";
import type { JwtPayload } from "../middlewares/auth.middleware.js";

const SALT_ROUNDS = 10;

export type AuthOrganizationDto = { id: string; name: string; slug: string };

export type AuthUserDto = {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  organization: AuthOrganizationDto;
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

export async function register(data: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw new Error("E-mail já cadastrado");
  }
  const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);
  const orgDisplayName = data.organizationName?.trim() || `${data.name} — Empresa`;
  const slugBase = slugifyOrganizationName(data.organizationName?.trim() || data.name);
  const slug = await uniqueOrganizationSlug(slugBase);
  const org = await prisma.organization.create({
    data: {
      name: orgDisplayName,
      slug,
    },
  });
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
  return {
    user: userDto,
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
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      organizationId: membership.organizationId,
    },
    accessToken,
    refreshToken,
  };
}

export async function refreshAccessToken(refreshToken: string) {
  const stored = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  });
  if (!stored || stored.expiresAt < new Date()) {
    throw new Error("Refresh token inválido ou expirado");
  }
  const membership = await prisma.membership.findFirst({
    where: { userId: stored.userId },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) {
    throw new Error("Usuário sem organização");
  }
  await prisma.refreshToken.delete({ where: { id: stored.id } });
  const { accessToken, refreshToken: newRefresh } = await createTokens(
    stored.user.id,
    stored.user.email,
    membership.organizationId
  );
  await saveRefreshToken(stored.user.id, newRefresh);
  const userDto = await buildAuthUserDto(
    stored.user.id,
    stored.user.email,
    stored.user.name,
    membership.organizationId
  );
  return {
    user: userDto,
    accessToken,
    refreshToken: newRefresh,
  };
}

async function createTokens(userId: string, email: string, organizationId: string) {
  const payload: JwtPayload = { userId, email, organizationId };
  const accessOpts: SignOptions = { expiresIn: "15m" };
  const refreshOpts: SignOptions = { expiresIn: "7d" };
  const accessToken = jwt.sign(payload, env.JWT_SECRET, accessOpts);
  const refreshToken = jwt.sign(
    { userId, type: "refresh" },
    env.JWT_REFRESH_SECRET,
    refreshOpts
  );
  return { accessToken, refreshToken };
}

/** Perfil para GET /auth/me: exige vínculo Membership ativo com a org do JWT */
export async function getAuthProfile(userId: string, organizationId: string): Promise<AuthUserDto | null> {
  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: { userId, organizationId },
    },
    include: { user: true, organization: true },
  });
  if (!membership?.user || membership.user.deletedAt) return null;
  if (membership.organization.deletedAt) return null;
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

async function saveRefreshToken(userId: string, token: string) {
  const decoded = jwt.decode(token) as { exp?: number };
  const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: { token, userId, expiresAt },
  });
}
