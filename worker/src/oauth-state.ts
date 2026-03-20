import type { D1Database } from "@cloudflare/workers-types";

const STATE_TTL_MS = 10 * 60 * 1000; // 10 min

export function createState(organizationId: string): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const state = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return state;
}

export async function saveState(db: D1Database, state: string, organizationId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + STATE_TTL_MS).toISOString();
  await db.prepare("INSERT INTO OAuthState (state, organizationId, expiresAt) VALUES (?, ?, ?)")
    .bind(state, organizationId, expiresAt)
    .run();
}

export async function consumeState(db: D1Database, state: string): Promise<string | null> {
  const row = await db.prepare(
    "SELECT organizationId FROM OAuthState WHERE state = ? AND expiresAt > datetime('now')"
  )
    .bind(state)
    .first<{ organizationId: string }>();
  if (!row) return null;
  await db.prepare("DELETE FROM OAuthState WHERE state = ?").bind(state).run();
  return row.organizationId;
}
