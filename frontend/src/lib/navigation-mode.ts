import type { MembershipSummary, User } from "@/stores/auth-store";

/** Alinhado ao enum Prisma `OrganizationKind`. */
export type OrganizationKindDto = "MATRIX" | "DIRECT" | "CLIENT_WORKSPACE";

/** Variante do menu lateral (formato da org ativa; não confundir com `platformAdmin`). */
export type SidebarNavVariant = "full" | "agency_branch" | "client_workspace" | "agency_client_portal";

export type AppNavMode = "platform_full" | "operational_full" | "agency_branch" | "client_workspace";

const ADMIN_PAGE_ROLES = new Set([
  "owner",
  "admin",
  "agency_owner",
  "agency_admin",
  "workspace_owner",
  "workspace_admin",
]);

export function resolveOrganizationKind(user: User | null): OrganizationKindDto {
  const k = user?.organizationKind;
  if (k === "MATRIX" || k === "DIRECT" || k === "CLIENT_WORKSPACE") return k;
  return "DIRECT";
}

/** Menu lateral: filial e workspace cliente são sempre “enxutos”, inclusive para admin global no contexto dessa org. */
export function resolveSidebarNavVariant(
  user: User | null,
  memberships: MembershipSummary[] | null = null
): SidebarNavVariant {
  if (!user?.organizationId) return "full";
  if (isAgencyClientPortalUser(user, memberships)) return "agency_client_portal";
  const kind = resolveOrganizationKind(user);
  if (kind === "CLIENT_WORKSPACE") return "client_workspace";
  if (user.parentOrganizationId != null) return "agency_branch";
  return "full";
}

/** Modo lógico (ex.: `/admin`); `platform_full` só na raiz sem pai quando for staff. */
export function resolveAppNavMode(user: User | null): AppNavMode {
  if (!user?.organizationId) return "operational_full";
  const kind = resolveOrganizationKind(user);
  if (kind === "CLIENT_WORKSPACE") return "client_workspace";
  if (user.parentOrganizationId != null) return "agency_branch";
  if (user.platformAdmin) return "platform_full";
  return "operational_full";
}

export function shouldEnforceAgencyBranchRouteGuard(user: User | null): boolean {
  return resolveSidebarNavVariant(user, null) === "agency_branch" && user?.platformAdmin !== true;
}

export function shouldEnforceClientWorkspaceClientsGuard(user: User | null): boolean {
  return resolveSidebarNavVariant(user, null) === "client_workspace" && user?.platformAdmin !== true;
}

export function getActiveMembership(
  user: User | null,
  memberships: MembershipSummary[] | null
): MembershipSummary | null {
  const oid = user?.organizationId;
  if (!oid || !memberships?.length) return null;
  return memberships.find((m) => m.organizationId === oid) ?? null;
}

/** Cliente da agência: `report_viewer` ou cargo "Cliente" — navegação e rotas restritas. */
export function isAgencyClientPortalUser(
  user: User | null,
  memberships: MembershipSummary[] | null
): boolean {
  if (!user?.organizationId || user.platformAdmin) return false;
  const m = getActiveMembership(user, memberships);
  if (!m) return false;
  if (m.role === "report_viewer") return true;
  if (m.jobTitle === "client_viewer") return true;
  return false;
}

export function isPathAllowedForAgencyClientPortal(pathname: string): boolean {
  const p = pathname.replace(/\/$/, "") || "/";
  if (p === "/" || p === "/dashboard") return true;
  if (p === "/marketing" || p === "/marketing/captacao" || p === "/marketing/conversao" || p === "/marketing/receita")
    return true;
  if (p === "/perfil") return true;
  return false;
}

/**
 * Painel /revenda: usa só o boolean vindo da API (`matrizNavEligible`), calculado no servidor.
 * Sem esse campo (bundles antigos) → negar.
 */
export function canAccessMatrizResellerNav(user: User | null, _memberships: MembershipSummary[] | null): boolean {
  if (!user?.organizationId) return false;
  if (user.platformAdmin === true) return true;
  return user.matrizNavEligible === true;
}

/** Rota `/admin`: só staff global ou admins no modo operacional completo (não filial/cliente). */
export function canAccessAdminPage(
  user: User | null,
  memberships: MembershipSummary[] | null,
  mode: AppNavMode
): boolean {
  if (!user) return false;
  if (user.platformAdmin) return true;
  if (mode === "agency_branch" || mode === "client_workspace") return false;
  const role = getActiveMembership(user, memberships)?.role;
  if (!role) return false;
  return ADMIN_PAGE_ROLES.has(role);
}

/** Agência filial: só estes prefixos de path são permitidos (além de /login etc.). */
export function isPathAllowedForAgencyBranch(pathname: string): boolean {
  const p = pathname.replace(/\/$/, "") || "/";
  if (p === "/" || p === "/dashboard") return true;
  if (p === "/clientes") return true;
  if (p.startsWith("/marketing/integracoes")) return true;
  if (p === "/marketing/configuracoes") return true;
  if (p === "/ads/metas-alertas" || p === "/ads/metas-operacao") return true;
  if (p === "/configuracoes" || p.startsWith("/configuracoes/")) return true;
  if (p === "/perfil") return true;
  return false;
}

export function isPathBlockedForClientWorkspaceClients(pathname: string): boolean {
  const p = pathname.replace(/\/$/, "") || "/";
  return p === "/clientes";
}
