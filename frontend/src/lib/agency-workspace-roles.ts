/**
 * Papéis previstos por workspace (cliente) — evolução: vínculo em Membership + capability checks.
 * UI atual: entrada na equipe via /usuarios após "Entrar no cliente".
 */
export type AgencyWorkspaceRole = "ADMIN" | "GESTOR" | "ANALISTA" | "VISUALIZADOR";

export const AGENCY_WORKSPACE_ROLE_ORDER: AgencyWorkspaceRole[] = [
  "ADMIN",
  "GESTOR",
  "ANALISTA",
  "VISUALIZADOR",
];

export const AGENCY_WORKSPACE_ROLE_LABEL: Record<AgencyWorkspaceRole, string> = {
  ADMIN: "Admin",
  GESTOR: "Gestor",
  ANALISTA: "Analista",
  VISUALIZADOR: "Visualizador",
};
