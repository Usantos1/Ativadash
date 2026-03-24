import { formatNumber, formatPercent, formatSpend } from "@/lib/metrics-format";
import { cn } from "@/lib/utils";
import type { MarketingDashboardPerfRow } from "@/lib/marketing-dashboard-api";
import type { BusinessGoalMode } from "@/lib/business-goal-mode";
import { DataTablePremium } from "@/components/premium";

type Level = "campaign" | "adset" | "ad";

type HighlightFlags = {
  bestCpl: boolean;
  maxSpend: boolean;
  weakCtr: boolean;
};

function buildHighlights(rows: MarketingDashboardPerfRow[]): Map<string, HighlightFlags> {
  const map = new Map<string, HighlightFlags>();
  for (const r of rows) {
    map.set(r.id, { bestCpl: false, maxSpend: false, weakCtr: false });
  }
  const spendy = rows.filter((r) => r.spend >= 20);
  let minCpl = Infinity;
  let minCplId: string | null = null;
  for (const r of spendy) {
    if (r.cpl != null && r.cpl > 0 && r.cpl < minCpl) {
      minCpl = r.cpl;
      minCplId = r.id;
    }
  }
  if (minCplId) map.get(minCplId)!.bestCpl = true;

  let maxS = 0;
  let maxId: string | null = null;
  for (const r of rows) {
    if (r.spend > maxS) {
      maxS = r.spend;
      maxId = r.id;
    }
  }
  if (maxId && maxS >= 30) map.get(maxId)!.maxSpend = true;

  let minCtr = Infinity;
  let minCtrId: string | null = null;
  for (const r of rows) {
    if (r.impressions >= 400 && r.ctrPct != null && r.ctrPct < minCtr) {
      minCtr = r.ctrPct;
      minCtrId = r.id;
    }
  }
  if (minCtrId != null && minCtr < 0.8) map.get(minCtrId)!.weakCtr = true;

  return map;
}

function RowChrome({ flags }: { flags: HighlightFlags }) {
  if (!flags.bestCpl && !flags.maxSpend && !flags.weakCtr) return null;
  return (
    <span className="ml-1 inline-flex flex-wrap gap-1">
      {flags.bestCpl ? (
        <span className="rounded bg-emerald-500/15 px-1 py-0 text-[9px] font-bold uppercase text-emerald-800 dark:text-emerald-200">
          CPL
        </span>
      ) : null}
      {flags.maxSpend ? (
        <span className="rounded bg-sky-500/15 px-1 py-0 text-[9px] font-bold uppercase text-sky-900 dark:text-sky-100">
          $$$
        </span>
      ) : null}
      {flags.weakCtr ? (
        <span className="rounded bg-amber-500/15 px-1 py-0 text-[9px] font-bold uppercase text-amber-950 dark:text-amber-100">
          CTR
        </span>
      ) : null}
    </span>
  );
}

export function DashboardPerformanceTable({
  rows,
  labelEmpty,
  nameHeader,
  subNameKey,
  businessGoalMode,
}: {
  rows: MarketingDashboardPerfRow[];
  labelEmpty: string;
  nameHeader: string;
  subNameKey?: "campaign" | "adset";
  businessGoalMode: BusinessGoalMode;
}) {
  const highlights = buildHighlights(rows);
  const showLpv = rows.some((r) => r.landingPageViews > 0);

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-muted/[0.12] p-10 text-center text-sm text-muted-foreground">
        {labelEmpty}
      </div>
    );
  }

  return (
    <DataTablePremium zebra stickyHeader minHeight="min-h-[220px]" className="tabular-nums text-[13px]">
      <thead>
        <tr>
          <th className="text-left">{nameHeader}</th>
          {subNameKey ? (
            <th className="text-left">{subNameKey === "campaign" ? "Campanha" : "Conjunto"}</th>
          ) : null}
          <th className="text-right">Investimento</th>
          <th className="text-right">Impr.</th>
          {(businessGoalMode === "LEADS" || businessGoalMode === "HYBRID") && (
            <>
              <th className="text-right">Cliques</th>
              <th className="text-right">CTR</th>
              <th className="text-right">CPC</th>
              <th className="text-right">Leads</th>
              <th className="text-right">CPL</th>
              {showLpv ? <th className="text-right">LPV</th> : null}
            </>
          )}
          {(businessGoalMode === "SALES" || businessGoalMode === "HYBRID") && (
            <>
              {businessGoalMode === "SALES" ? (
                <>
                  <th className="text-right">Cliques</th>
                  <th className="text-right">CTR</th>
                  <th className="text-right">CPC</th>
                </>
              ) : null}
              <th className="text-right">Compras</th>
              <th className="text-right">Valor</th>
              <th className="text-right">ROAS</th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, 80).map((row) => {
          const f = highlights.get(row.id) ?? { bestCpl: false, maxSpend: false, weakCtr: false };
          return (
            <tr
              key={row.id}
              className={cn(
                f.bestCpl && "bg-emerald-500/[0.04]",
                f.maxSpend && !f.bestCpl && "bg-sky-500/[0.03]",
                f.weakCtr && !f.bestCpl && !f.maxSpend && "bg-amber-500/[0.04]"
              )}
            >
              <td className="max-w-[220px]">
                <div className="truncate font-medium text-foreground">
                  {row.name}
                  <RowChrome flags={f} />
                </div>
              </td>
              {subNameKey ? (
                <td className="max-w-[180px] truncate text-muted-foreground">{row.parentName ?? "—"}</td>
              ) : null}
              <td className="text-right font-medium text-foreground">{formatSpend(row.spend)}</td>
              <td className="text-right text-muted-foreground">{formatNumber(row.impressions)}</td>
              {(businessGoalMode === "LEADS" || businessGoalMode === "HYBRID") && (
                <>
                  <td className="text-right text-muted-foreground">{formatNumber(row.clicks)}</td>
                  <td className="text-right">{row.ctrPct != null ? formatPercent(row.ctrPct) : "—"}</td>
                  <td className="text-right">{row.cpc != null ? formatSpend(row.cpc) : "—"}</td>
                  <td className="text-right font-medium text-foreground">{formatNumber(row.leads)}</td>
                  <td className="text-right">{row.cpl != null ? formatSpend(row.cpl) : "—"}</td>
                  {showLpv ? (
                    <td className="text-right text-muted-foreground">{formatNumber(row.landingPageViews)}</td>
                  ) : null}
                </>
              )}
              {(businessGoalMode === "SALES" || businessGoalMode === "HYBRID") && (
                <>
                  {businessGoalMode === "SALES" ? (
                    <>
                      <td className="text-right text-muted-foreground">{formatNumber(row.clicks)}</td>
                      <td className="text-right">{row.ctrPct != null ? formatPercent(row.ctrPct) : "—"}</td>
                      <td className="text-right">{row.cpc != null ? formatSpend(row.cpc) : "—"}</td>
                    </>
                  ) : null}
                  <td className="text-right font-medium text-foreground">{formatNumber(row.purchases)}</td>
                  <td className="text-right">{row.purchaseValue > 0 ? formatSpend(row.purchaseValue) : "—"}</td>
                  <td className="text-right">
                    {row.roas != null ? `${row.roas.toFixed(2).replace(".", ",")}×` : "—"}
                  </td>
                </>
              )}
            </tr>
          );
        })}
      </tbody>
    </DataTablePremium>
  );
}

export type DashboardPerfLevel = Level;
