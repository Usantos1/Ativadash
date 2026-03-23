import crypto from "node:crypto";
import { env } from "../../config/env.js";

export const GRAPH_VERSION = "v21.0";
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export function appSecretProof(accessToken: string, appSecret: string): string {
  return crypto.createHmac("sha256", appSecret).update(accessToken).digest("hex");
}

export async function metaGraphGet<T>(path: string, accessToken: string, appSecret: string): Promise<T> {
  const proof = appSecretProof(accessToken, appSecret);
  const url = path.startsWith("http")
    ? path
    : `${GRAPH_BASE}${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(accessToken)}&appsecret_proof=${encodeURIComponent(proof)}`;
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) {
    try {
      const json = JSON.parse(text) as { error?: { message?: string } };
      const msg = json?.error?.message ?? text;
      throw new Error(msg);
    } catch (e) {
      if (e instanceof Error && e.message !== text) throw e;
      throw new Error(`Graph API ${res.status}: ${text.slice(0, 200)}`);
    }
  }
  return JSON.parse(text) as T;
}

interface PagedResponse<T> {
  data: T[];
  paging?: { next?: string; cursors?: { after?: string } };
}

export async function metaGraphGetAllPages<T>(
  path: string,
  accessToken: string,
  appSecret: string
): Promise<T[]> {
  const all: T[] = [];
  let nextUrl: string | null = null;
  let first = true;

  while (first || nextUrl) {
    let res: PagedResponse<T>;
    if (first) {
      res = await metaGraphGet<PagedResponse<T>>(path, accessToken, appSecret);
    } else {
      const proof = appSecretProof(accessToken, appSecret);
      const url = `${nextUrl!}${nextUrl!.includes("?") ? "&" : "?"}appsecret_proof=${encodeURIComponent(proof)}`;
      const r = await fetch(url);
      const text = await r.text();
      if (!r.ok) throw new Error(`Graph API ${r.status}: ${text.slice(0, 200)}`);
      res = JSON.parse(text) as PagedResponse<T>;
    }
    first = false;
    const list = res.data ?? [];
    all.push(...list);
    nextUrl = res.paging?.next ?? null;
  }
  return all;
}

export function getMetaAppSecret(): string | null {
  const s = env.META_APP_SECRET?.trim();
  return s ? s : null;
}
