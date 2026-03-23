import type { ChildWorkspaceOperationsRow, WorkspaceStatus } from "@/lib/organization-api";

export type HealthLevel = "OK" | "ATENCAO" | "CRITICO" | "INATIVO";

export type AttentionPriority = "P1" | "P2" | "P3";

export type WorkspaceAlertTag =
  | "sem_membros"
  | "sem_integracao"
  | "sem_atividade"
  | "sem_dashboards"
  | "setup_pendente"
  | "pausado"
  | "arquivado";

const TAG_LABEL: Record<WorkspaceAlertTag, string> = {
  sem_membros: "Sem membros",
  sem_integracao: "Sem integração",
  sem_atividade: "Sem atividade",
  sem_dashboards: "Sem dashboards",
  setup_pendente: "Setup pendente",
  pausado: "Pausado",
  arquivado: "Arquivado",
};

const SETUP_MARKER = "[setup inicial pendente]";

function normalizeNote(note: string | null | undefined): string {
  return (note ?? "").toLowerCase();
}

/** Tags operacionais exibidas na coluna Alertas (workspace ativo). */
export function getWorkspaceAlertTags(r: ChildWorkspaceOperationsRow): WorkspaceAlertTag[] {
  const tags: WorkspaceAlertTag[] = [];
  if (r.workspaceStatus === "PAUSED") {
    tags.push("pausado");
    return tags;
  }
  if (r.workspaceStatus === "ARCHIVED") {
    tags.push("arquivado");
    return tags;
  }
  if (r.memberCount === 0) tags.push("sem_membros");
  if (r.connectedIntegrations === 0) tags.push("sem_integracao");
  if (r.staleActivity) tags.push("sem_atividade");
  if (r.dashboardCount === 0) tags.push("sem_dashboards");
  if (normalizeNote(r.workspaceNote).includes(SETUP_MARKER)) tags.push("setup_pendente");
  return tags;
}

export function formatAlertTagLabel(tag: WorkspaceAlertTag): string {
  return TAG_LABEL[tag];
}

/**
 * Saúde agregada para decisão rápida.
 * - INATIVO: pausado ou arquivado
 * - CRITICO: ativo sem membros (operação bloqueada)
 * - ATENCAO: ativo com outros riscos operacionais
 * - OK: ativo sem tags de risco
 */
export function getWorkspaceHealth(r: ChildWorkspaceOperationsRow): HealthLevel {
  if (r.workspaceStatus === "PAUSED" || r.workspaceStatus === "ARCHIVED") return "INATIVO";
  if (r.memberCount === 0) return "CRITICO";
  const tags = getWorkspaceAlertTags(r).filter((t) => t !== "pausado" && t !== "arquivado");
  if (tags.length > 0) return "ATENCAO";
  return "OK";
}

export function healthLabel(h: HealthLevel): string {
  switch (h) {
    case "OK":
      return "OK";
    case "ATENCAO":
      return "Atenção";
    case "CRITICO":
      return "Crítico";
    case "INATIVO":
      return "Inativo";
    default:
      return h;
  }
}

export type AttentionQueueItem = {
  organizationId: string;
  name: string;
  slug: string;
  problems: string[];
  priority: AttentionPriority;
  priorityLabel: string;
  workspaceStatus: WorkspaceStatus;
};

function priorityForRow(r: ChildWorkspaceOperationsRow): AttentionPriority {
  if (r.workspaceStatus === "PAUSED") return "P2";
  if (r.workspaceStatus === "ARCHIVED") return "P3";
  if (r.memberCount === 0) return "P1";
  if (r.connectedIntegrations === 0) return "P2";
  return "P3";
}

function priorityLabel(p: AttentionPriority): string {
  if (p === "P1") return "Alta — agir hoje";
  if (p === "P2") return "Média — agir em breve";
  return "Baixa — acompanhar";
}

/**
 * Fila única por workspace: consolida problemas e prioridade (sem duplicar linhas por tipo de alerta do backend).
 */
export function buildAttentionQueue(rows: ChildWorkspaceOperationsRow[]): AttentionQueueItem[] {
  const items: AttentionQueueItem[] = [];

  for (const r of rows) {
    const problems: string[] = [];

    if (r.workspaceStatus === "PAUSED") {
      problems.push("Workspace pausado na matriz — revisar se deve voltar a operar.");
    } else if (r.workspaceStatus === "ARCHIVED") {
      problems.push("Workspace arquivado — revisar governança ou reativar.");
    } else {
      if (r.memberCount === 0) problems.push("Ninguém na equipe — convide usuários ou entre para configurar.");
      if (r.connectedIntegrations === 0) problems.push("Nenhuma integração conectada — conecte Meta/Google após entrar.");
      if (r.dashboardCount === 0) problems.push("Sem dashboards criados — operação ainda vazia.");
      if (r.staleActivity) problems.push("Sem atividade recente (~14 dias) — validar uso do cliente.");
      if (normalizeNote(r.workspaceNote).includes(SETUP_MARKER)) problems.push("Setup inicial marcado como pendente.");
    }

    if (problems.length === 0) continue;

    const priority = priorityForRow(r);
    items.push({
      organizationId: r.id,
      name: r.name,
      slug: r.slug,
      problems,
      priority,
      priorityLabel: priorityLabel(priority),
      workspaceStatus: r.workspaceStatus,
    });
  }

  const order = { P1: 0, P2: 1, P3: 2 } as const;
  return items.sort((a, b) => {
    const d = order[a.priority] - order[b.priority];
    if (d !== 0) return d;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

export function countHealth(rows: ChildWorkspaceOperationsRow[], h: HealthLevel): number {
  return rows.filter((r) => getWorkspaceHealth(r) === h).length;
}

export function countWithOperationalAlert(rows: ChildWorkspaceOperationsRow[]): number {
  return rows.filter((r) => {
    const health = getWorkspaceHealth(r);
    return health === "ATENCAO" || health === "CRITICO";
  }).length;
}

export function sortRowsByLastActivity(
  rows: ChildWorkspaceOperationsRow[],
  direction: "desc" | "asc"
): ChildWorkspaceOperationsRow[] {
  const mul = direction === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const ta = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
    const tb = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
    if (ta !== tb) return (ta - tb) * mul;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}
