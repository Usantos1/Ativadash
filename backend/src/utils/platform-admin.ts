import { env } from "../config/env.js";

/** E-mails com acesso à API de plataforma (planos, todas as orgs). Lista em PLATFORM_ADMIN_EMAILS separada por vírgula. */
export function isPlatformAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const raw = env.PLATFORM_ADMIN_EMAILS;
  if (!raw?.trim()) return false;
  const set = new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
  return set.has(email.trim().toLowerCase());
}
