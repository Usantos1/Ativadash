/** Rótulos amigáveis para ações de auditoria da matriz. */

export function auditActionDescription(action: string, metadata: unknown): string {
  const m = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {};
  const name = (v: unknown) => (typeof v === "string" ? v : null);

  switch (action) {
    case "PLAN_UPDATED":
      return "Plano atualizado";
    case "CHILD_ORG_CREATED":
      return `Cliente '${name(m.name) ?? "—"}' criado`;
    case "CHILD_ORG_DETACHED_STANDALONE":
      return `Cliente '${name(m.name) ?? "—"}' desvinculado`;
    case "CHILD_ORG_PATCHED":
      return "Cliente atualizado";
    case "USER_INVITED":
      return "Convite de usuário enviado";
    case "USER_ROLE_CHANGED":
      return "Papel de usuário alterado";
    case "media.meta.campaign.status":
    case "media.meta.campaign.status.rollback":
      return `Meta · status da campanha (${String(m.status ?? "—")})`;
    case "media.meta.campaign.budget":
    case "media.meta.campaign.budget.rollback":
      return `Meta · orçamento diário (${String(m.dailyBudget ?? "—")})`;
    case "media.google.campaign.status":
    case "media.google.campaign.status.rollback":
      return `Google · status da campanha (${String(m.status ?? "—")})`;
    default:
      return action.replace(/\./g, " · ");
  }
}

/** Valores sugeridos para filtro por tipo de ação (dropdown). */
export const AUDIT_ACTION_FILTER_PRESETS = [
  "",
  "PLAN_UPDATED",
  "CHILD_ORG_CREATED",
  "CHILD_ORG_DETACHED_STANDALONE",
  "CHILD_ORG_PATCHED",
  "USER_INVITED",
  "USER_ROLE_CHANGED",
  "media.meta.campaign.status",
  "media.meta.campaign.budget",
  "media.google.campaign.status",
] as const;
