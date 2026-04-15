/** Rótulos amigáveis para ações de auditoria (matriz + workspaces). */

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/** Tipos de entidade frequentes → nome curto em PT. */
export function auditEntityTypeLabel(entityType: string): string {
  const t: Record<string, string> = {
    Organization: "Empresa",
    Plan: "Plano",
    User: "Utilizador",
    Membership: "Membro",
    Invitation: "Convite",
    MetaCampaign: "Campanha Meta",
    GoogleAdsCampaign: "Campanha Google",
    AlertRule: "Regra de alerta",
    AutomationExecution: "Automação",
    UserSession: "Sessão",
    MatrixWorkspaceGrant: "Acesso matriz → workspace",
    WebhookEndpoint: "Webhook",
    WebhookEvent: "Evento webhook",
  };
  return t[entityType] ?? entityType;
}

/** Ações da automação (enum gravado em `actionTaken`). */
export function automationActionLabel(actionTaken: string): string {
  const map: Record<string, string> = {
    PAUSE_ASSET: "Pausar campanha/conjunto/anúncio",
    INCREASE_BUDGET_20: "Aumentar orçamento (~20%)",
    DECREASE_BUDGET_20: "Reduzir orçamento (~20%)",
    NOTIFY_ONLY: "Apenas notificação",
  };
  return map[actionTaken] ?? actionTaken.replace(/_/g, " ").toLowerCase();
}

export function auditActionDescription(action: string, metadata: unknown): string {
  const m = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {};
  const name = (v: unknown) => (typeof v === "string" ? v : null);

  switch (action) {
    case "PLAN_CREATED":
      return `Plano criado (${name(m.slug) ?? "—"})`;
    case "PLAN_UPDATED":
      return "Plano atualizado";
    case "PLAN_DELETED":
      return "Plano eliminado";
    case "PLAN_DUPLICATED":
      return `Plano duplicado (origem: ${name(m.from) ?? "—"})`;
    case "CHILD_ORG_CREATED":
      return `Workspace '${name(m.name) ?? "—"}' criado`;
    case "CHILD_ORG_DETACHED_STANDALONE":
      return `Workspace '${name(m.name) ?? "—"}' desvinculado da matriz`;
    case "CHILD_ORG_PATCHED":
      return "Workspace atualizado (governança)";
    case "CHILD_GOVERNANCE_PATCH":
      return "Governança do workspace alterada (plano, módulos ou limites)";
    case "CHILD_ORG_SOFT_DELETED":
      return "Workspace arquivado (exclusão lógica)";
    case "USER_INVITED":
    case "INVITATION_CREATED":
      return "Convite enviado";
    case "USER_CREATED":
      return "Utilizador criado na rede";
    case "USER_UPDATED":
      return "Dados do utilizador atualizados";
    case "USER_PASSWORD_RESET":
      return "Palavra-passe redefinida pelo administrador";
    case "USER_ROLE_CHANGED":
      return "Papel do utilizador alterado";
    case "MEMBERSHIP_ROLE_CHANGED":
      return "Papel na empresa alterado";
    case "MEMBERSHIP_REMOVED":
      return "Membro removido da empresa";
    case "MEMBERSHIP_MOVED":
      return "Membro movido entre empresas";
    case "ADMIN_ENTER_CHILD_ORG":
      return `Administrador entrou no workspace (${name(m.childName) ?? "—"})`;
    case "IMPERSONATION_STARTED":
      return `Impersonação iniciada → ${name(m.targetOrganizationName) ?? name(m.targetOrganizationId) ?? "—"}`;
    case "IMPERSONATION_STOPPED":
      return `Impersonação encerrada ← ${name(m.targetOrganizationName) ?? name(m.targetOrganizationId) ?? "—"}`;
    case "media.meta.campaign.status":
    case "media.meta.campaign.status.rollback":
      return `Meta · estado da campanha: ${String(m.status ?? "—")}`;
    case "media.meta.campaign.budget":
    case "media.meta.campaign.budget.rollback":
      return `Meta · orçamento diário da campanha: ${String(m.dailyBudget ?? "—")}`;
    case "media.google.campaign.status":
    case "media.google.campaign.status.rollback":
      return `Google Ads · estado da campanha: ${String(m.status ?? "—")}`;
    case "marketing.alert_rule.create":
      return `Regra de alerta criada: ${name(m.name) ?? "—"}`;
    case "marketing.alert_rule.update":
      return "Regra de alerta atualizada";
    case "marketing.alert_rule.delete":
      return "Regra de alerta eliminada";
    case "session.active_organization.changed":
      return "Empresa ativa alterada no login";
    case "matrix.workspace.archived":
      return "Workspace arquivado pela matriz";
    case "matrix.workspace_grant.upsert":
      return "Permissão matriz → workspace atualizada";
    case "matrix.workspace_grant.delete":
      return "Permissão matriz → workspace revogada";
    case "webhook.endpoint.created":
      return "Webhook criado";
    case "webhook.endpoint.updated":
      return "Webhook atualizado";
    case "webhook.event.replayed":
      return "Evento de webhook reenviado";
    case "auth.login":
      return "Login realizado";
    case "auth.password_changed":
      return "Senha alterada";
    case "profile.updated":
      return `Perfil atualizado (${name(m.name) ?? "—"})`;
    case "client.created":
      return `Cliente criado: ${name(m.name) ?? "—"}`;
    case "client.updated":
      return `Cliente atualizado: ${name(m.name) ?? "—"}`;
    case "client.deleted":
      return "Cliente removido";
    case "invitation.created":
      return `Convite enviado para ${name(m.email) ?? "—"}`;
    case "invitation.revoked":
      return "Convite revogado";
    case "member.created":
      return `Membro adicionado: ${name(m.email) ?? "—"}`;
    case "member.updated":
      return "Membro atualizado";
    case "member.removed":
      return "Membro removido";
    case "member.password_reset":
      return "Senha do membro redefinida";
    case "marketing.settings.updated":
      return "Configurações de marketing atualizadas";
    case "integration.disconnected":
      return "Integração desconectada";
    case "dashboard.share_created":
      return `Link de compartilhamento criado (${name(m.page) ?? "dashboard"})`;
    default:
      return action.replace(/\./g, " · ");
  }
}

export type NetworkActivityLike = {
  source: "user" | "automation";
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
};

export function describeNetworkActivityRow(row: NetworkActivityLike): string {
  if (row.source === "automation") {
    const m = row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {};
    const rule = str(m.ruleName) ?? "Regra";
    const asset = str(m.assetLabel) ?? row.entityId ?? "—";
    const prev = str(m.previousValue);
    const next = str(m.newValue);
    const delta =
      prev != null || next != null ? ` (${prev ?? "?"} → ${next ?? "?"})` : "";
    return `Automação · ${rule} · ${automationActionLabel(row.action)} · ${asset}${delta}`;
  }
  return auditActionDescription(row.action, row.metadata);
}

/** Opções do filtro “Governança da matriz” (valor = código na API). */
export const RESELLER_AUDIT_ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: "PLAN_CREATED", label: "Plano criado" },
  { value: "PLAN_UPDATED", label: "Plano atualizado" },
  { value: "PLAN_DELETED", label: "Plano eliminado" },
  { value: "PLAN_DUPLICATED", label: "Plano duplicado" },
  { value: "CHILD_ORG_CREATED", label: "Workspace criado" },
  { value: "CHILD_GOVERNANCE_PATCH", label: "Governança do workspace" },
  { value: "CHILD_ORG_DETACHED_STANDALONE", label: "Workspace desvinculado" },
  { value: "CHILD_ORG_SOFT_DELETED", label: "Workspace arquivado" },
  { value: "INVITATION_CREATED", label: "Convite enviado" },
  { value: "USER_CREATED", label: "Utilizador criado" },
  { value: "USER_UPDATED", label: "Utilizador atualizado" },
  { value: "USER_PASSWORD_RESET", label: "Palavra-passe redefinida" },
  { value: "MEMBERSHIP_ROLE_CHANGED", label: "Papel na empresa" },
  { value: "MEMBERSHIP_REMOVED", label: "Membro removido" },
  { value: "MEMBERSHIP_MOVED", label: "Membro movido" },
  { value: "ADMIN_ENTER_CHILD_ORG", label: "Entrar num workspace" },
];

/** Filtros sugeridos para atividade nas empresas (campanhas, regras, automação). */
export const NETWORK_ACTIVITY_ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: "auth.login", label: "Login" },
  { value: "auth.password_changed", label: "Senha alterada" },
  { value: "profile.updated", label: "Perfil atualizado" },
  { value: "client.created", label: "Cliente criado" },
  { value: "client.updated", label: "Cliente atualizado" },
  { value: "client.deleted", label: "Cliente removido" },
  { value: "invitation.created", label: "Convite enviado" },
  { value: "invitation.revoked", label: "Convite revogado" },
  { value: "member.created", label: "Membro adicionado" },
  { value: "member.updated", label: "Membro atualizado" },
  { value: "member.removed", label: "Membro removido" },
  { value: "member.password_reset", label: "Senha redefinida" },
  { value: "media.meta.campaign.status", label: "Meta · estado da campanha" },
  { value: "media.meta.campaign.budget", label: "Meta · orçamento da campanha" },
  { value: "media.google.campaign.status", label: "Google · estado da campanha" },
  { value: "marketing.settings.updated", label: "Config. marketing atualizadas" },
  { value: "marketing.alert_rule.create", label: "Regra de alerta criada" },
  { value: "marketing.alert_rule.update", label: "Regra de alerta atualizada" },
  { value: "marketing.alert_rule.delete", label: "Regra de alerta removida" },
  { value: "integration.disconnected", label: "Integração desconectada" },
  { value: "webhook.endpoint.created", label: "Webhook criado" },
  { value: "webhook.endpoint.updated", label: "Webhook atualizado" },
  { value: "dashboard.share_created", label: "Link compartilhado" },
  { value: "session.active_organization.changed", label: "Troca de empresa ativa" },
];

/** @deprecated use RESELLER_AUDIT_ACTION_OPTIONS */
export const AUDIT_ACTION_FILTER_PRESETS = RESELLER_AUDIT_ACTION_OPTIONS.map((o) => o.value);
