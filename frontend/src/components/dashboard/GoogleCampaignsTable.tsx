import { formatNumber, formatPercent, formatSpend } from "@/lib/metrics-format";
import { DataTablePremium } from "@/components/premium";
import type { GoogleAdsCampaignRow } from "@/lib/integrations-api";
import type { BusinessGoalMode } from "@/lib/business-goal-mode";

export function GoogleCampaignsTable({
  rows,
  businessGoalMode,
  loading,
  emptyLabel,
  errorMessage,
}: {
  rows: GoogleAdsCampaignRow[];
  businessGoalMode: BusinessGoalMode;
  loading?: boolean;
  emptyLabel: string;
  errorMessage?: string | null;
}) {
  if (errorMessage) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/[0.04] px-4 py-8 text-center text-sm text-destructive">
        {errorMessage}
      </div>
    );
  }
  if (loading) {
    return <div className="h-48 animate-pulse rounded-xl bg-muted/30" />;
  }
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-muted/[0.12] py-12 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  const convLabel =
    businessGoalMode === "SALES" ? "Compras" : businessGoalMode === "HYBRID" ? "Conv." : "Conv.";

  return (
    <DataTablePremium zebra stickyHeader minHeight="min-h-[200px]" className="text-[13px]">
      <thead>
        <tr>
          <th className="text-left">Campanha</th>
          <th className="text-right">Invest.</th>
          <th className="text-right">Impr.</th>
          <th className="text-right">Cliques</th>
          <th className="text-right">CTR</th>
          <th className="text-right">CPC</th>
          <th className="text-right">{convLabel}</th>
          <th className="text-right">Custo / conv.</th>
          {businessGoalMode !== "LEADS" ? <th className="text-right">Valor</th> : null}
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, 100).map((row, i) => {
          const spend = row.costMicros / 1_000_000;
          const ctr = row.impressions > 0 ? (row.clicks / row.impressions) * 100 : null;
          const cpc = row.clicks > 0 ? spend / row.clicks : null;
          const cpa = row.conversions > 0 ? spend / row.conversions : null;
          return (
            <tr key={row.campaignId ?? `${row.campaignName}-${i}`}>
              <td className="max-w-[240px] truncate font-medium text-foreground">{row.campaignName}</td>
              <td className="text-right tabular-nums font-medium">{formatSpend(spend)}</td>
              <td className="text-right tabular-nums text-muted-foreground">
                {formatNumber(row.impressions)}
              </td>
              <td className="text-right tabular-nums text-muted-foreground">{formatNumber(row.clicks)}</td>
              <td className="text-right tabular-nums">{ctr != null ? formatPercent(ctr) : "—"}</td>
              <td className="text-right tabular-nums">{cpc != null ? formatSpend(cpc) : "—"}</td>
              <td className="text-right tabular-nums">{formatNumber(row.conversions)}</td>
              <td className="text-right tabular-nums">{cpa != null ? formatSpend(cpa) : "—"}</td>
              {businessGoalMode !== "LEADS" ? (
                <td className="text-right tabular-nums">
                  {row.conversionsValue > 0 ? formatSpend(row.conversionsValue) : "—"}
                </td>
              ) : null}
            </tr>
          );
        })}
      </tbody>
    </DataTablePremium>
  );
}
