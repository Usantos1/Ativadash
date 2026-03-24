import { cn } from "@/lib/utils";
import { formatNumber, formatPercent, formatSpend } from "@/lib/metrics-format";
import type { MarketingDashboardSummary } from "@/lib/marketing-dashboard-api";
import type { MetaAdsMetricsSummary } from "@/lib/integrations-api";
import type { BusinessGoalMode } from "@/lib/business-goal-mode";

function Delta({ pct, invert }: { pct: number; invert?: boolean }) {
  const good = invert ? pct <= 0 : pct >= 0;
  return (
    <span
      className={cn(
        "text-[11px] font-semibold tabular-nums",
        good ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
      )}
    >
      {pct >= 0 ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}

function KPICard({
  label,
  value,
  badge,
  deltaPct,
  deltaInvert,
}: {
  label: string;
  value: string;
  badge?: string;
  deltaPct?: number;
  deltaInvert?: boolean;
}) {
  return (
    <div className="flex min-h-[104px] flex-col justify-between rounded-2xl border border-border/35 bg-gradient-to-b from-card to-muted/[0.08] p-4 shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.04]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        {badge ? (
          <span className="shrink-0 rounded-md bg-primary/[0.08] px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary">
            {badge}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-[1.75rem]">
        {value}
      </p>
      {deltaPct != null && Number.isFinite(deltaPct) ? (
        <p className="mt-1 text-muted-foreground">
          <span className="text-[10px] uppercase tracking-wide">vs ant. </span>
          <Delta pct={deltaPct} invert={!!deltaInvert} />
        </p>
      ) : (
        <p className="mt-1 h-4 text-[10px] text-transparent">.</p>
      )}
    </div>
  );
}

type RelD = (
  current: number,
  prev: number,
  compareEnabled: boolean
) => { pct: number } | undefined;

export function ExecutiveKPIGrid({
  summary,
  businessGoalMode,
  primaryConversionLabel,
  compareEnabled,
  cmpMeta,
  relDelta,
  className,
}: {
  summary: MarketingDashboardSummary;
  businessGoalMode: BusinessGoalMode;
  primaryConversionLabel: string | null;
  compareEnabled: boolean;
  cmpMeta: MetaAdsMetricsSummary | null;
  relDelta: RelD;
  className?: string;
}) {
  const d = summary.derived;
  const leadWord = primaryConversionLabel?.trim() || "Leads";
  const cmp = cmpMeta;

  const dPct = (cur: number, prev: number, inv?: boolean) => {
    const x = relDelta(cur, prev, compareEnabled && !!cmp)?.pct;
    return x != null ? { pct: x, invert: inv } : undefined;
  };

  if (businessGoalMode === "LEADS") {
    return (
      <div
        className={cn(
          "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-4",
          className
        )}
      >
        <KPICard
          label={leadWord}
          value={formatNumber(summary.leads)}
          deltaPct={dPct(summary.leads, cmp?.leads ?? 0)?.pct}
        />
        <KPICard
          label="Investimento"
          value={formatSpend(summary.spend)}
          deltaPct={dPct(summary.spend, cmp?.spend ?? 0, true)?.pct}
          deltaInvert
        />
        <KPICard
          label="CPL"
          value={d.cplLeads != null ? formatSpend(d.cplLeads) : "—"}
          deltaPct={
            cmp && summary.leads > 0 && cmp.leads > 0 && compareEnabled
              ? (() => {
                  const cur = summary.spend / summary.leads;
                  const prev = cmp.spend / cmp.leads;
                  return relDelta(cur, prev, true)?.pct;
                })()
              : undefined
          }
          deltaInvert
        />
        <KPICard
          label="CTR"
          value={d.ctrPct != null ? formatPercent(d.ctrPct) : "—"}
          deltaPct={
            cmp && summary.impressions > 0 && cmp.impressions > 0 && compareEnabled
              ? (() => {
                  const cur = (summary.clicks / summary.impressions) * 100;
                  const prev = (cmp.clicks / cmp.impressions) * 100;
                  return relDelta(cur, prev, false)?.pct;
                })()
              : undefined
          }
        />
        <KPICard
          label="Cliques"
          value={formatNumber(summary.clicks)}
          deltaPct={dPct(summary.clicks, cmp?.clicks ?? 0)?.pct}
        />
        <KPICard
          label="CPC"
          value={d.cpc != null ? formatSpend(d.cpc) : "—"}
          deltaPct={
            cmp && summary.clicks > 0 && cmp.clicks > 0 && compareEnabled
              ? (() => {
                  const cur = summary.spend / summary.clicks;
                  const prev = cmp.spend / cmp.clicks;
                  return relDelta(cur, prev, true)?.pct;
                })()
              : undefined
          }
          deltaInvert
        />
      </div>
    );
  }

  if (businessGoalMode === "SALES") {
    return (
      <div
        className={cn(
          "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-4",
          className
        )}
      >
        <KPICard
          label="Compras"
          value={formatNumber(summary.purchases)}
          deltaPct={dPct(summary.purchases, cmp?.purchases ?? 0)?.pct}
        />
        <KPICard
          label="Investimento"
          value={formatSpend(summary.spend)}
          deltaPct={dPct(summary.spend, cmp?.spend ?? 0, true)?.pct}
          deltaInvert
        />
        <KPICard
          label="ROAS"
          value={
            d.roas != null && Number.isFinite(d.roas) ? `${d.roas.toFixed(2).replace(".", ",")}×` : "—"
          }
        />
        <KPICard
          label="Custo / compra"
          value={d.costPerPurchase != null ? formatSpend(d.costPerPurchase) : "—"}
          deltaInvert
        />
        <KPICard
          label="Cliques"
          value={formatNumber(summary.clicks)}
          deltaPct={dPct(summary.clicks, cmp?.clicks ?? 0)?.pct}
        />
        <KPICard label="CTR" value={d.ctrPct != null ? formatPercent(d.ctrPct) : "—"} />
      </div>
    );
  }

  /* HYBRID */
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-4",
        className
      )}
    >
      <KPICard label={leadWord} value={formatNumber(summary.leads)} badge="Captação" />
      <KPICard label="Compras" value={formatNumber(summary.purchases)} badge="Venda" />
      <KPICard label="Investimento" value={formatSpend(summary.spend)} />
      <KPICard label="CPL" value={d.cplLeads != null ? formatSpend(d.cplLeads) : "—"} />
      <KPICard
        label="ROAS"
        value={
          d.roas != null && Number.isFinite(d.roas) ? `${d.roas.toFixed(2).replace(".", ",")}×` : "—"
        }
      />
      <KPICard label="CTR" value={d.ctrPct != null ? formatPercent(d.ctrPct) : "—"} />
    </div>
  );
}
