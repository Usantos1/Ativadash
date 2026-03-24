import { AlertTriangle, Megaphone, PieChart, TrendingUp, Plug, ShoppingBag, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber, formatPercent, formatSpend } from "@/lib/metrics-format";
import type {
  MarketingDashboardPerfRow,
  MarketingDashboardPayload,
  MarketingDashboardSummary,
} from "@/lib/marketing-dashboard-api";
import type { MetaAdsMetricsSummary } from "@/lib/integrations-api";
import type { BusinessGoalMode } from "@/lib/business-goal-mode";

export type QuickInsight = {
  id: string;
  icon: LucideIcon;
  text: string;
  tone: "default" | "warning" | "muted";
};

function bestBy<T>(rows: T[], pick: (r: T) => number, min: number): T | null {
  let best: T | null = null;
  let v = -Infinity;
  for (const r of rows) {
    const x = pick(r);
    if (x >= min && x > v) {
      v = x;
      best = r;
    }
  }
  return best;
}

function bestByMinMetric<T>(rows: T[], pick: (r: T) => number | null, min: number): T | null {
  let best: T | null = null;
  let v = Infinity;
  for (const r of rows) {
    const x = pick(r);
    if (x == null || !Number.isFinite(x) || x < min) continue;
    if (x < v) {
      v = x;
      best = r;
    }
  }
  return best;
}

function worstByMaxMetric<T>(rows: T[], pick: (r: T) => number | null): T | null {
  let worst: T | null = null;
  let v = -Infinity;
  for (const r of rows) {
    const x = pick(r);
    if (x == null || !Number.isFinite(x) || x <= 0) continue;
    if (x > v) {
      v = x;
      worst = r;
    }
  }
  return worst;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function funnelEdgesToLead(s: MarketingDashboardSummary): { pct: number; from: string; to: string }[] {
  const edges: { pct: number; from: string; to: string }[] = [];
  const edge = (a: number, b: number, from: string, to: string) => {
    if (a > 0 && b >= 0) edges.push({ pct: (b / a) * 100, from, to });
  };
  edge(s.impressions, s.clicks, "Impressões", "Cliques");
  const linkKnown = s.linkClicksReturned && s.linkClicks != null;
  if (linkKnown) {
    edge(s.clicks, s.linkClicks!, "Cliques", "Link");
    if (s.landingPageViews > 0) {
      edge(s.linkClicks!, s.landingPageViews, "Link", "LPV");
      edge(s.landingPageViews, s.leads, "LPV", "Leads");
    } else {
      edge(s.linkClicks!, s.leads, "Link", "Leads");
    }
  } else if (s.landingPageViews > 0) {
    edge(s.clicks, s.landingPageViews, "Cliques", "LPV");
    edge(s.landingPageViews, s.leads, "LPV", "Leads");
  } else {
    edge(s.clicks, s.leads, "Cliques", "Leads");
  }
  return edges.filter((e) => e.pct > 0 && e.pct <= 100);
}

function funnelEdgesToPurchase(s: MarketingDashboardSummary): { pct: number; from: string; to: string }[] {
  const edges: { pct: number; from: string; to: string }[] = [];
  const edge = (a: number, b: number, from: string, to: string) => {
    if (a > 0 && b >= 0) edges.push({ pct: (b / a) * 100, from, to });
  };
  edge(s.leads, s.initiateCheckout, "Leads", "Checkout");
  edge(s.initiateCheckout, s.purchases, "Checkout", "Compras");
  if (s.leads > 0 && s.purchases >= 0) {
    edge(s.leads, s.purchases, "Leads", "Compras");
  }
  return edges.filter((e) => e.pct > 0 && e.pct <= 100);
}

function fullFunnelEdges(s: MarketingDashboardSummary): { pct: number; from: string; to: string }[] {
  const top = funnelEdgesToLead(s);
  const bottom: { pct: number; from: string; to: string }[] = [];
  const edge = (a: number, b: number, from: string, to: string) => {
    if (a > 0 && b >= 0) bottom.push({ pct: (b / a) * 100, from, to });
  };
  edge(s.leads, s.initiateCheckout, "Leads", "Checkout");
  edge(s.initiateCheckout, s.purchases, "Checkout", "Compras");
  const merged = [...top, ...bottom];
  return merged.filter((e) => e.pct > 0 && e.pct < 100);
}

export type DashboardQuickInsightsByGoalResult = {
  primary: QuickInsight[];
  secondary?: QuickInsight[];
};

/**
 * Insights rápidos conforme objetivo da conta (LEADS / SALES / HYBRID).
 */
export function buildDashboardQuickInsightsByGoal(params: {
  dash: MarketingDashboardPayload & { ok: true };
  campaigns: MarketingDashboardPerfRow[];
  googleOk: boolean;
  googlePending: boolean;
  businessGoalMode?: BusinessGoalMode;
  primaryConversionLabel?: string | null;
  showRevenueInLeadMode?: boolean;
  /** Comparação período anterior (Meta) para CPL */
  compareEnabled?: boolean;
  metaCmp?: MetaAdsMetricsSummary | null;
}): DashboardQuickInsightsByGoalResult {
  const {
    dash,
    campaigns,
    googleOk,
    googlePending,
    businessGoalMode = "HYBRID",
    primaryConversionLabel,
    showRevenueInLeadMode = false,
    compareEnabled = false,
    metaCmp = null,
  } = params;
  const s = dash.summary;
  const d = s.derived;
  const leadWord = primaryConversionLabel?.trim() || "Leads";
  const primary: QuickInsight[] = [];
  const secondary: QuickInsight[] = [];

  if (s.impressions >= 2_000 && d.ctrPct != null && d.ctrPct < 1.5) {
    primary.push({
      id: "ctr-weak",
      icon: AlertTriangle,
      text: "CTR abaixo de 1,5% com volume de impressões — o criativo pode não estar chamando atenção ou o público está largo demais.",
      tone: "warning",
    });
  }

  if (
    businessGoalMode === "SALES" &&
    s.leads > 0 &&
    s.purchases === 0 &&
    s.spend > 0
  ) {
    primary.push({
      id: "leads-no-purchase",
      icon: AlertTriangle,
      text: "Há leads no período, mas nenhuma compra atribuída — revise jornada pós-captura, oferta e eventos de compra no pixel.",
      tone: "warning",
    });
  }

  if (
    compareEnabled &&
    metaCmp &&
    s.leads > 0 &&
    metaCmp.leads > 0 &&
    s.spend > 0
  ) {
    const curCpl = s.spend / s.leads;
    const prevCpl = metaCmp.spend / metaCmp.leads;
    if (prevCpl > 0 && curCpl > prevCpl * 1.08) {
      primary.push({
        id: "cpl-up",
        icon: AlertTriangle,
        text: `Custo por ${leadWord.toLowerCase()} subiu ~${(((curCpl - prevCpl) / prevCpl) * 100).toFixed(0)}% vs período anterior — priorize anúncios com CPL melhor e pausar os piores.`,
        tone: "warning",
      });
    }
  }

  const topSpend = bestBy(campaigns, (r) => r.spend, 0.01);
  const topLeads = bestBy(campaigns, (r) => r.leads, 1);
  const topRev = bestBy(campaigns, (r) => r.purchaseValue, 0.01);
  const topRoas = bestBy(campaigns, (r) => r.roas ?? 0, 0.01);
  const bestCpl = bestByMinMetric(campaigns, (r) => r.cpl, 0.0001);

  if (businessGoalMode === "LEADS") {
    if (topSpend) {
      primary.push({
        id: "top-spend",
        icon: Megaphone,
        text: `Maior investimento: ${truncate(topSpend.name, 44)} · ${formatSpend(topSpend.spend)}`,
        tone: "default",
      });
    }
    if (topLeads) {
      primary.push({
        id: "top-leads",
        icon: TrendingUp,
        text: `Mais ${leadWord.toLowerCase()}: ${truncate(topLeads.name, 40)} · ${formatNumber(topLeads.leads)}`,
        tone: "default",
      });
    }
    if (bestCpl && bestCpl.cpl != null) {
      primary.push({
        id: "best-cpl",
        icon: Target,
        text: `Menor CPL: ${truncate(bestCpl.name, 38)} · ${formatSpend(bestCpl.cpl)}`,
        tone: "default",
      });
    }
    const ctrCandidates = campaigns.filter((r) => r.impressions >= 5000 && r.ctrPct != null);
    const bestCtr = bestBy(ctrCandidates, (r) => r.ctrPct ?? 0, 0);
    if (bestCtr && bestCtr.ctrPct != null) {
      primary.push({
        id: "best-ctr",
        icon: PieChart,
        text: `Melhor CTR (≥5k impr.): ${truncate(bestCtr.name, 34)} · ${formatPercent(bestCtr.ctrPct)}`,
        tone: "default",
      });
    }
    const narrow = funnelEdgesToLead(s);
    if (narrow.length) {
      const w = narrow.reduce((a, b) => (a.pct < b.pct ? a : b));
      secondary.push({
        id: "bottleneck-lead",
        icon: AlertTriangle,
        text: `Maior perda até ${leadWord.toLowerCase()}: ${w.from} → ${w.to} (${formatPercent(w.pct, 2)}). Ajuste criativo, landing ou formulário conforme a etapa.`,
        tone: "warning",
      });
    }
    if (!showRevenueInLeadMode && s.spend > 0 && s.purchases === 0) {
      secondary.push({
        id: "lead-focus",
        icon: AlertTriangle,
        text: "Conta focada em captação — receita e compras ficam em segundo plano nas configurações.",
        tone: "muted",
      });
    }
  } else if (businessGoalMode === "SALES") {
    if (topRev) {
      primary.push({
        id: "top-rev",
        icon: ShoppingBag,
        text: `Maior receita: ${truncate(topRev.name, 40)} · ${formatSpend(topRev.purchaseValue)}`,
        tone: "default",
      });
    }
    if (topRoas && topRoas.roas != null) {
      primary.push({
        id: "top-roas",
        icon: TrendingUp,
        text: `Maior ROAS: ${truncate(topRoas.name, 38)} · ${topRoas.roas.toFixed(2).replace(".", ",")}×`,
        tone: "default",
      });
    }
    const worstCpp = worstByMaxMetric(campaigns.filter((r) => r.purchases >= 1), (r) =>
      r.purchases > 0 ? r.spend / r.purchases : null
    );
    if (worstCpp && worstCpp.purchases > 0) {
      const cpp = worstCpp.spend / worstCpp.purchases;
      primary.push({
        id: "worst-cpp",
        icon: AlertTriangle,
        text: `Custo/compra alto: ${truncate(worstCpp.name, 36)} · ${formatSpend(cpp)}`,
        tone: "warning",
      });
    }
    if (topSpend) {
      primary.push({
        id: "top-spend",
        icon: Megaphone,
        text: `Maior investimento: ${truncate(topSpend.name, 44)} · ${formatSpend(topSpend.spend)}`,
        tone: "default",
      });
    }
    const narrow = funnelEdgesToPurchase(s);
    if (narrow.length) {
      const w = narrow.reduce((a, b) => (a.pct < b.pct ? a : b));
      secondary.push({
        id: "bottleneck-sales",
        icon: AlertTriangle,
        text: `Maior perda entre etapas de venda (${w.from} → ${w.to}, ${formatPercent(w.pct, 2)}). Revise oferta, página e remarketing.`,
        tone: "warning",
      });
    }
  } else {
    if (topSpend) {
      primary.push({
        id: "top-spend",
        icon: Megaphone,
        text: `Topo · maior investimento: ${truncate(topSpend.name, 40)} · ${formatSpend(topSpend.spend)}`,
        tone: "default",
      });
    }
    if (topLeads) {
      primary.push({
        id: "top-leads",
        icon: TrendingUp,
        text: `Topo · mais ${leadWord.toLowerCase()}: ${truncate(topLeads.name, 36)} · ${formatNumber(topLeads.leads)}`,
        tone: "default",
      });
    }
    if (topRev && topRev.purchaseValue > 0) {
      secondary.push({
        id: "top-rev",
        icon: ShoppingBag,
        text: `Fundo · receita: ${truncate(topRev.name, 36)} · ${formatSpend(topRev.purchaseValue)}`,
        tone: "default",
      });
    }
    if (topRoas && topRoas.roas != null && topRoas.purchaseValue > 0) {
      secondary.push({
        id: "top-roas",
        icon: PieChart,
        text: `Fundo · ROAS: ${truncate(topRoas.name, 34)} · ${topRoas.roas.toFixed(2).replace(".", ",")}×`,
        tone: "default",
      });
    }
    const allN = fullFunnelEdges(s);
    if (allN.length) {
      const w = allN.reduce((a, b) => (a.pct < b.pct ? a : b));
      secondary.push({
        id: "bottleneck-full",
        icon: AlertTriangle,
        text: `Funil completo · maior perda relativa: ${w.from} → ${w.to} (${formatPercent(w.pct, 2)}).`,
        tone: "warning",
      });
    }
  }

  if (googlePending && !googleOk && primary.length < 4) {
    primary.push({
      id: "google",
      icon: Plug,
      text: "Google Ads: aguardando configuração do servidor ou liberação da API.",
      tone: "muted",
    });
  }

  return {
    primary: primary.slice(0, 4),
    secondary: secondary.length ? secondary.slice(0, 4) : undefined,
  };
}

/** @deprecated Preferir buildDashboardQuickInsightsByGoal — mantido para imports legados. */
export function buildDashboardQuickInsights(params: {
  dash: MarketingDashboardPayload & { ok: true };
  campaigns: MarketingDashboardPerfRow[];
  googleOk: boolean;
  googlePending: boolean;
}): QuickInsight[] {
  return buildDashboardQuickInsightsByGoal({ ...params, businessGoalMode: "HYBRID" }).primary;
}

export function DashboardQuickInsightsStrip({
  title = "Insights rápidos",
  subtitle,
  items,
  className,
}: {
  title?: string;
  subtitle?: string;
  items: QuickInsight[];
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/50 bg-muted/[0.35] p-4 shadow-sm",
        className
      )}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
      {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
      <ul className="mt-3 space-y-2.5">
        {items.map((it) => (
          <li key={it.id} className="flex gap-3 text-sm leading-snug">
            <it.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary/80" aria-hidden />
            <span
              className={
                it.tone === "warning"
                  ? "text-amber-950 dark:text-amber-100"
                  : it.tone === "muted"
                    ? "text-muted-foreground"
                    : "text-foreground"
              }
            >
              {it.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
