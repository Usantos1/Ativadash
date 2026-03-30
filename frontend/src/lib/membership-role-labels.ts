/** Rótulos em português para slugs de `Membership.role` na UI (lista equipe, convites, etc.). */

const LABELS: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  member: "Membro",
  media_manager: "Gestor de mídia",
  analyst: "Analista",
  agency_owner: "Dono (agência)",
  agency_admin: "Admin (agência)",
  agency_ops: "Operações (agência)",
  workspace_owner: "Dono (workspace)",
  workspace_admin: "Admin (workspace)",
  report_viewer: "Somente relatórios",
  media_meta_manager: "Gestor Meta Ads",
  media_google_manager: "Gestor Google Ads",
  performance_analyst: "Analista de performance",
};

export function membershipRoleLabelPt(role: string): string {
  return LABELS[role] ?? role.replace(/_/g, " ");
}
