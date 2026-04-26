/** Home do app (visão geral / portfólio). */
export const DASHBOARD_HOME_PATH = "/dashboard";

/** URL do dashboard no contexto de um workspace (slug da organização). */
export function dashboardWorkspacePath(slug: string): string {
  const s = slug.trim();
  if (!s) return DASHBOARD_HOME_PATH;
  return `${DASHBOARD_HOME_PATH}/${encodeURIComponent(s)}`;
}

/** Slug na URL após `/dashboard/`, ou `null` se for só `/dashboard`. */
export function dashboardSlugFromPathname(pathname: string): string | null {
  const p = pathname.replace(/\/$/, "") || "/";
  if (!p.startsWith(`${DASHBOARD_HOME_PATH}/`)) return null;
  const rest = p.slice(DASHBOARD_HOME_PATH.length + 1);
  if (!rest) return null;
  try {
    return decodeURIComponent(rest);
  } catch {
    return rest;
  }
}
