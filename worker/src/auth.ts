import * as jose from "jose";
import type { D1Database } from "@cloudflare/workers-types";
import { hashPassword, verifyPassword } from "./crypto.js";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  FRONTEND_URL?: string;
}

const ACCESS_TTL = "15m";
const REFRESH_TTL = "7d";

export interface JwtPayload {
  userId: string;
  email: string;
  organizationId: string;
}

export async function register(
  db: D1Database,
  secrets: { JWT_SECRET: string; JWT_REFRESH_SECRET: string },
  data: { name: string; email: string; password: string }
) {
  const existing = await db.prepare("SELECT id FROM User WHERE email = ?").bind(data.email).first();
  if (existing) throw new Error("E-mail já cadastrado");

  const userId = crypto.randomUUID();
  const orgId = crypto.randomUUID();
  const membershipId = crypto.randomUUID();
  const hashedPassword = await hashPassword(data.password);
  const now = new Date().toISOString();
  const orgSlug = `org-${Date.now()}`;

  await db.batch([
    db.prepare(
      "INSERT INTO Organization (id, name, slug, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)"
    ).bind(orgId, `${data.name} - Organização`, orgSlug, now, now),
    db.prepare(
      "INSERT INTO User (id, email, password, name, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(userId, data.email, hashedPassword, data.name, now, now),
    db.prepare(
      "INSERT INTO Membership (id, userId, organizationId, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(membershipId, userId, orgId, "owner", now, now),
  ]);

  const { accessToken, refreshToken } = await createTokens(
    db,
    secrets,
    userId,
    data.email,
    orgId
  );
  await saveRefreshToken(db, secrets.JWT_REFRESH_SECRET, userId, refreshToken);

  return {
    user: { id: userId, email: data.email, name: data.name, organizationId: orgId },
    accessToken,
    refreshToken,
  };
}

export async function login(
  db: D1Database,
  secrets: { JWT_SECRET: string; JWT_REFRESH_SECRET: string },
  data: { email: string; password: string }
) {
  const user = await db.prepare("SELECT id, email, name, password FROM User WHERE email = ?")
    .bind(data.email)
    .first<{ id: string; email: string; name: string; password: string }>();
  if (!user) throw new Error("E-mail ou senha inválidos");

  const valid = await verifyPassword(data.password, user.password);
  if (!valid) throw new Error("E-mail ou senha inválidos");

  const membership = await db.prepare(
    "SELECT organizationId FROM Membership WHERE userId = ? LIMIT 1"
  )
    .bind(user.id)
    .first<{ organizationId: string }>();
  if (!membership) throw new Error("Usuário sem organização vinculada");

  const { accessToken, refreshToken } = await createTokens(
    db,
    secrets,
    user.id,
    user.email,
    membership.organizationId
  );
  await saveRefreshToken(db, secrets.JWT_REFRESH_SECRET, user.id, refreshToken);

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

export async function refreshAccessToken(
  db: D1Database,
  secrets: { JWT_SECRET: string; JWT_REFRESH_SECRET: string },
  refreshToken: string
) {
  const stored = await db.prepare(
    "SELECT rt.id, rt.userId, u.email, u.name FROM RefreshToken rt JOIN User u ON u.id = rt.userId WHERE rt.token = ? AND rt.expiresAt > datetime('now')"
  )
    .bind(refreshToken)
    .first<{ id: string; userId: string; email: string; name: string }>();
  if (!stored) throw new Error("Refresh token inválido ou expirado");

  const membership = await db.prepare(
    "SELECT organizationId FROM Membership WHERE userId = ? LIMIT 1"
  )
    .bind(stored.userId)
    .first<{ organizationId: string }>();
  if (!membership) throw new Error("Usuário sem organização");

  await db.prepare("DELETE FROM RefreshToken WHERE id = ?").bind(stored.id).run();

  const { accessToken, refreshToken: newRefresh } = await createTokens(
    db,
    secrets,
    stored.userId,
    stored.email,
    membership.organizationId
  );
  await saveRefreshToken(db, secrets.JWT_REFRESH_SECRET, stored.userId, newRefresh);

  return {
    user: {
      id: stored.userId,
      email: stored.email,
      name: stored.name,
      organizationId: membership.organizationId,
    },
    accessToken,
    refreshToken: newRefresh,
  };
}

async function createTokens(
  _db: D1Database,
  secrets: { JWT_SECRET: string; JWT_REFRESH_SECRET: string },
  userId: string,
  email: string,
  organizationId: string
) {
  const secret = new TextEncoder().encode(secrets.JWT_SECRET);
  const refreshSecret = new TextEncoder().encode(secrets.JWT_REFRESH_SECRET);

  const accessToken = await new jose.SignJWT({
    userId,
    email,
    organizationId,
  } as JwtPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(ACCESS_TTL)
    .setIssuedAt()
    .sign(secret);

  const refreshToken = await new jose.SignJWT({ userId, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(REFRESH_TTL)
    .setIssuedAt()
    .sign(refreshSecret);

  return { accessToken, refreshToken };
}

async function saveRefreshToken(
  db: D1Database,
  _refreshSecret: string,
  userId: string,
  token: string
) {
  const { payload } = jose.decodeJwt(token);
  const exp = (payload?.exp as number) ?? Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
  const expiresAt = new Date(exp * 1000).toISOString();
  const id = crypto.randomUUID();
  await db.prepare(
    "INSERT INTO RefreshToken (id, token, userId, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(id, token, userId, expiresAt, new Date().toISOString())
    .run();
}

export async function verifyAccessToken(secret: string, token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, new TextEncoder().encode(secret));
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}
