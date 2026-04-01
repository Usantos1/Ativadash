import type { EnabledFeatures } from "@/lib/organization-api";
import type { MembershipSummary, User } from "@/stores/auth-store";
import {
  isAgencyClientPortalUser,
  isPathAllowedForAgencyBranch,
  isPathAllowedForAgencyClientPortal,
  isPathBlockedForClientWorkspaceClients,
  shouldEnforceAgencyBranchRouteGuard,
  shouldEnforceClientWorkspaceClientsGuard,
} from "@/lib/navigation-mode";

/**
 * Indica se um destino do menu lateral deve aparecer para o plano atual.
 * Alinhado a `GET /organization` → `enabledFeatures`.
 */
export function isSidebarPathEnabledByPlan(to: string, f: EnabledFeatures): boolean {
  const path = (to.split("?")[0] ?? to).replace(/\/$/, "") || "/";

  if (path === "/dashboard") return f.marketingDashboard;

  if (path === "/marketing") return f.marketing && f.marketingDashboard;

  if (path === "/marketing/captacao") return f.marketing && f.captacao;
  if (path === "/marketing/conversao") return f.marketing && f.conversao;
  if (path === "/marketing/receita") return f.marketing && f.receita;

  if (path === "/marketing/integracoes" || path.startsWith("/marketing/integracoes/")) {
    return f.integrations;
  }

  if (path === "/ads/metas-operacao") {
    return f.marketing && f.automacoes;
  }

  if (path === "/ads/metas-alertas") {
    return f.marketing && f.performanceAlerts;
  }

  if (path === "/clientes") return f.multiOrganization;

  if (path === "/projetos" || path === "/lancamentos") return f.marketing;

  if (path === "/usuarios") return f.multiUser;

  if (path === "/revenda" || path.startsWith("/revenda/")) return f.revenda;

  if (path === "/configuracoes" || path.startsWith("/configuracoes/")) return true;

  return true;
}

/** Remove itens e grupos vazios. `features === null` → não filtra (ex.: loading ou sem org). */
export function filterNavGroupsByPlan<T extends { to: string }>(
  groups: { label: string; items: T[] }[],
  features: EnabledFeatures | null,
  opts: { bypassPlanFeatures?: boolean }
): { label: string; items: T[] }[] {
  if (opts.bypassPlanFeatures || features == null) return groups;

  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => isSidebarPathEnabledByPlan(item.to, features)),
    }))
    .filter((g) => g.items.length > 0);
}

/**
 * Primeira rota que cumpre plano (`enabledFeatures`) e restrições de perfil (filial, portal cliente, etc.).
 * Usado ao redirecionar utilizadores que abriram um URL sem o respetivo módulo no plano.
 */
export function firstAllowedPathForPlanAndNav(
  f: EnabledFeatures,
  user: User,
  memberships: MembershipSummary[] | null
): string {
  const candidates = [
    "/dashboard",
    "/marketing",
    "/marketing/captacao",
    "/marketing/conversao",
    "/marketing/receita",
    "/clientes",
    "/marketing/integracoes",
    "/ads/metas-alertas",
    "/ads/metas-operacao",
    "/projetos",
    "/lancamentos",
    "/usuarios",
    "/revenda",
    "/configuracoes",
    "/perfil",
  ];

  for (const c of candidates) {
    if (!isSidebarPathEnabledByPlan(c, f)) continue;
    if (shouldEnforceAgencyBranchRouteGuard(user, memberships) && !isPathAllowedForAgencyBranch(c)) continue;
    if (isAgencyClientPortalUser(user, memberships) && !isPathAllowedForAgencyClientPortal(c)) continue;
    if (shouldEnforceClientWorkspaceClientsGuard(user, memberships) && isPathBlockedForClientWorkspaceClients(c)) continue;
    return c;
  }

  return "/perfil";
}
