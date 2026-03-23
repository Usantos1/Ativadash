import type { User } from "@/stores/auth-store";

function capitalizeWord(s: string): string {
  const t = s.trim();
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

/** Primeiro nome para saudação: `firstName` → primeira palavra de `name` → null. */
export function resolveDashboardFirstName(user: User | null | undefined): string | null {
  if (!user) return null;
  const fn = user.firstName?.trim();
  if (fn) return capitalizeWord(fn);
  const full = user.name?.trim();
  if (full) {
    const first = full.split(/\s+/).filter(Boolean)[0];
    if (first) return capitalizeWord(first);
  }
  return null;
}

export function executiveDaypartGreeting(): "Bom dia" | "Boa tarde" | "Boa noite" {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

/** Linha de saudação do topo (ex.: "Bom dia, Uander" ou "Olá"). */
export function executiveGreetingLine(user: User | null | undefined): string {
  const name = resolveDashboardFirstName(user);
  if (name) return `${executiveDaypartGreeting()}, ${name}`;
  return "Olá";
}
