/** Papéis canônicos + legado (`owner`/`admin`) aceitos até remoção total. */

export const LEGACY_OWNER_ADMIN = ["owner", "admin"] as const;

export const MATRIX_ADMIN_ROLES = ["agency_owner", "agency_admin", ...LEGACY_OWNER_ADMIN] as const;

/** Operação com escopo de matriz: exige grant explícito por workspace quando não for owner/admin. */
export const AGENCY_OPS_ROLES = ["agency_ops", "member"] as const;

export const WORKSPACE_ADMIN_ROLES = [
  "workspace_owner",
  "workspace_admin",
  ...LEGACY_OWNER_ADMIN,
] as const;

/** Quem gerencia equipe / convites no workspace (exclui só-leitura). */
export const WORKSPACE_TEAM_MANAGER_ROLES = [
  "workspace_owner",
  "workspace_admin",
  ...LEGACY_OWNER_ADMIN,
] as const;

export const PRIMARY_OWNER_ROLES = ["agency_owner", "workspace_owner", "owner"] as const;

export function isMatrixWideAdminRole(role: string): boolean {
  return (MATRIX_ADMIN_ROLES as readonly string[]).includes(role);
}

export function isAgencyOpsStyleRole(role: string): boolean {
  return (AGENCY_OPS_ROLES as readonly string[]).includes(role);
}

export function isWorkspaceAdminRole(role: string): boolean {
  return (WORKSPACE_ADMIN_ROLES as readonly string[]).includes(role);
}

export function isWorkspaceTeamManagerRole(role: string): boolean {
  return (WORKSPACE_TEAM_MANAGER_ROLES as readonly string[]).includes(role);
}

export function isPrimaryOwnerRole(role: string): boolean {
  return (PRIMARY_OWNER_ROLES as readonly string[]).includes(role);
}

/** Painel revenda / criação de filhos na matriz. */
export function isResellerMatrixAdminRole(role: string): boolean {
  return isMatrixWideAdminRole(role);
}

/** Ao mover membership entre orgs, não replicar papel de proprietário no destino. */
export function demoteOwnerRoleForMove(role: string): string {
  if (role === "owner" || role === "workspace_owner") return "workspace_admin";
  if (role === "agency_owner") return "agency_admin";
  return role;
}
