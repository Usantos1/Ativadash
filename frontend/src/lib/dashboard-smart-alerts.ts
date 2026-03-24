import type { InsightAlert } from "@/lib/marketing-settings-api";
import type { MarketingDashboardPayload } from "@/lib/marketing-dashboard-api";
import type { BusinessGoalMode } from "@/lib/business-goal-mode";
import type { DashboardDiagnostic } from "@/components/dashboard/dashboard-diagnostic-panel";
import type { ChannelPerformanceSignal } from "@/lib/channel-performance-compare";

/** Nível exibido na UI (mapeado a partir de severidade da API + heurísticas). */
export type SmartAlertTier = "critical" | "attention" | "opportunity" | "healthy";

export type DashboardSmartAlert = {
  id: string;
  tier: SmartAlertTier;
  title: string;
  explanation: string;
  action: string;
  /** P1 mais urgente */
  priority: "P1" | "P2" | "P3";
  source: "goals_api" | "diagnostic" | "channel_mix" | "goal_mismatch";
};

function apiSeverityToTier(s: InsightAlert["severity"]): SmartAlertTier {
  switch (s) {
    case "critical":
      return "critical";
    case "warning":
      return "attention";
    case "success":
      return "healthy";
    default:
      return "opportunity";
  }
}

function apiSeverityToPriority(s: InsightAlert["severity"]): DashboardSmartAlert["priority"] {
  if (s === "critical") return "P1";
  if (s === "warning") return "P2";
  return "P3";
}

function enrichInsightAction(a: InsightAlert, goalMode: BusinessGoalMode): string {
  const base = a.message.trim();
  if (goalMode === "LEADS" && (a.code.includes("CPA") || a.code.includes("CPL"))) {
    return `${base} Ajuste lances, criativos ou público; confira se o evento de lead está correto na Meta.`.trim();
  }
  if (goalMode === "SALES" && a.code.includes("ROAS")) {
    return `${base} Revise atribuição, valor enviado no pixel e páginas de checkout.`.trim();
  }
  return base || "Revise metas em Metas e alertas e realoque orçamento para o que performa melhor.";
}

/** Consolida alertas de metas, diagnósticos automáticos e mistura de canais — sem duplicar por código quando possível. */
export function buildDashboardSmartAlerts(params: {
  insightAlerts: InsightAlert[] | null | undefined;
  diagnostics: DashboardDiagnostic[];
  businessGoalMode: BusinessGoalMode;
  dash: Extract<MarketingDashboardPayload, { ok: true }>;
  channelSignals: { meta: ChannelPerformanceSignal; google: ChannelPerformanceSignal };
  hasGoogle: boolean;
  googleOk: boolean;
}): DashboardSmartAlert[] {
  const {
    insightAlerts,
    diagnostics,
    businessGoalMode,
    dash,
    channelSignals,
    hasGoogle,
    googleOk,
  } = params;
  const out: DashboardSmartAlert[] = [];
  const seen = new Set<string>();

  for (const a of insightAlerts ?? []) {
    const id = `api-${a.code}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      tier: apiSeverityToTier(a.severity),
      title: a.title,
      explanation: a.message.trim() || "Sinal disparado pelas metas configuradas para este período.",
      action: enrichInsightAction(a, businessGoalMode),
      priority: apiSeverityToPriority(a.severity),
      source: "goals_api",
    });
  }

  for (const d of diagnostics) {
    const id = `diag-${d.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const diagTier: SmartAlertTier =
      d.id === "ctr-weak" || d.id === "cpl-up" ? "attention" : "critical";
    out.push({
      id,
      tier: diagTier,
      title: d.problem,
      explanation: d.likelyCause,
      action: d.suggestedAction,
      priority: d.id === "cpl-up" || d.id === "lpv-gap" ? "P1" : "P2",
      source: "diagnostic",
    });
  }

  const platforms = dash.distribution.byPlatform;
  if (
    hasGoogle &&
    googleOk &&
    platforms.length >= 2 &&
    channelSignals.meta &&
    channelSignals.google
  ) {
    const top = [...platforms].sort((a, b) => b.spendSharePct - a.spendSharePct)[0];
    if (top && top.spendSharePct >= 80) {
      const metaHigh = top.platform.toLowerCase().includes("meta");
      const worse = metaHigh ? channelSignals.meta : channelSignals.google;
      const better = metaHigh ? channelSignals.google : channelSignals.meta;
      if (worse === "attention" && better === "best") {
        const id = "mix-efficiency";
        if (!seen.has(id)) {
          seen.add(id);
          out.push({
            id,
            tier: "opportunity",
            title: "Orçamento concentrado no canal menos eficiente",
            explanation: `Cerca de ${top.spendSharePct.toFixed(0)}% do investimento está em ${top.platform}, enquanto o outro canal mostra melhor custo por resultado no objetivo atual.`,
            action: "Teste realocar 10–20% do orçamento para o canal com melhor CPL/ROAS e monitore por 3–5 dias.",
            priority: "P2",
            source: "channel_mix",
          });
        }
      }
    }
  }

  const s = dash.summary;
  if (businessGoalMode === "LEADS" && s.purchases > 5 && s.leads === 0 && s.spend > 100) {
    const id = "goal-lead-vs-purchase";
    if (!seen.has(id)) {
      seen.add(id);
      out.push({
        id,
        tier: "attention",
        title: "Objetivo em leads, mas há compras sem leads no período",
        explanation:
          "A Meta está contabilizando vendas enquanto o painel de leads está vazio — possível desalinhamento de evento principal ou janela de atribuição.",
        action: "Confira o objetivo da conta em Metas e alertas e valide se o evento de lead está sendo priorizado no pixel.",
        priority: "P2",
        source: "goal_mismatch",
      });
    }
  }

  if (businessGoalMode === "SALES" && s.leads > 20 && s.purchases === 0 && s.spend > 80) {
    const id = "goal-sales-stalled";
    if (!seen.has(id)) {
      seen.add(id);
      out.push({
        id,
        tier: "critical",
        title: "Funil de vendas não fecha no período",
        explanation: `Há captação (${s.leads} leads) mas nenhuma compra atribuída — comum com pixel incompleto ou oferta desalinhada.`,
        action: "Valide evento de compra, valor e conteúdo da página de vendas; use remarketing para quem chegou ao checkout.",
        priority: "P1",
        source: "goal_mismatch",
      });
    }
  }

  const tierOrder: Record<SmartAlertTier, number> = {
    critical: 0,
    attention: 1,
    opportunity: 2,
    healthy: 3,
  };
  const prOrder = { P1: 0, P2: 1, P3: 2 };

  return out.sort((a, b) => {
    const t = tierOrder[a.tier] - tierOrder[b.tier];
    if (t !== 0) return t;
    return prOrder[a.priority] - prOrder[b.priority];
  });
}
