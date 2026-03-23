import { AlertTriangle, Megaphone, PieChart, TrendingUp, Plug } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatNumber, formatPercent, formatSpend } from "@/lib/metrics-format";
import type { MarketingDashboardPerfRow, MarketingDashboardPayload } from "@/lib/marketing-dashboard-api";

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

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export function buildDashboardQuickInsights(params: {
  dash: MarketingDashboardPayload & { ok: true };
  campaigns: MarketingDashboardPerfRow[];
  googleOk: boolean;
  googlePending: boolean;
}): QuickInsight[] {
  const { dash, campaigns, googleOk, googlePending } = params;
  const s = dash.summary;
  const list: QuickInsight[] = [];

  const topSpend = bestBy(campaigns, (r) => r.spend, 0.01);
  if (topSpend) {
    list.push({
      id: "top-spend",
      icon: Megaphone,
      text: `Maior investimento: ${truncate(topSpend.name, 44)} · ${formatSpend(topSpend.spend)}`,
      tone: "default",
    });
  }

  const topLeads = bestBy(campaigns, (r) => r.leads, 1);
  if (topLeads) {
    list.push({
      id: "top-leads",
      icon: TrendingUp,
      text: `Mais leads: ${truncate(topLeads.name, 40)} · ${formatNumber(topLeads.leads)}`,
      tone: "default",
    });
  }

  const ctrCandidates = campaigns.filter((r) => r.impressions >= 5000 && r.ctrPct != null);
  const bestCtr = bestBy(ctrCandidates, (r) => r.ctrPct ?? 0, 0);
  if (bestCtr && bestCtr.ctrPct != null) {
    list.push({
      id: "best-ctr",
      icon: PieChart,
      text: `Melhor CTR (≥5k impr.): ${truncate(bestCtr.name, 34)} · ${formatPercent(bestCtr.ctrPct)}`,
      tone: "default",
    });
  }

  if (s.spend > 0 && s.purchases === 0) {
    list.push({
      id: "no-purchases",
      icon: AlertTriangle,
      text: "Sem compras atribuídas pela Meta no período — receita e ROAS ficam sem base.",
      tone: "warning",
    });
  } else {
    const edges: { pct: number; from: string; to: string }[] = [];
    const edge = (a: number, b: number, from: string, to: string) => {
      if (a > 0 && b >= 0) edges.push({ pct: (b / a) * 100, from, to });
    };
    edge(s.impressions, s.clicks, "Impressões", "Cliques");
    if (s.linkClicksReturned && s.linkClicks != null) {
      edge(s.clicks, s.linkClicks, "Cliques", "Link");
      edge(s.linkClicks, s.leads, "Link", "Leads");
    } else {
      edge(s.clicks, s.leads, "Cliques", "Leads");
    }
    edge(s.leads, s.purchases, "Leads", "Compras");
    const narrow = edges.filter((e) => e.pct > 0 && e.pct < 100);
    if (narrow.length) {
      const w = narrow.reduce((a, b) => (a.pct < b.pct ? a : b));
      list.push({
        id: "bottleneck",
        icon: AlertTriangle,
        text: `Maior perda relativa: ${w.from} → ${w.to} (${formatPercent(w.pct, 2)}).`,
        tone: "warning",
      });
    }
  }

  if (googlePending && !googleOk && list.length < 4) {
    list.push({
      id: "google",
      icon: Plug,
      text: "Google Ads em ativação.",
      tone: "muted",
    });
  }

  return list.slice(0, 4);
}

export function DashboardQuickInsightsStrip({ items }: { items: QuickInsight[] }) {
  if (!items.length) return null;
  return (
    <div className="rounded-2xl border border-border/50 bg-muted/[0.35] p-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Insights rápidos</p>
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
