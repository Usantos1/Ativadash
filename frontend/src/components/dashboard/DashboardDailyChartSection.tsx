import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartPanelPremium } from "@/components/premium";
import { formatNumber, formatPercent, formatSpend } from "@/lib/metrics-format";
import { cn } from "@/lib/utils";
import type { BusinessGoalMode } from "@/lib/business-goal-mode";

export type DailyChartRow = {
  label: string;
  spend: number;
  leads: number;
  ctr: number | null;
  cpl: number | null;
};

type SeriesKey = "spend" | "leads" | "ctr" | "cpl";

function median(nums: number[]): number | null {
  const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m]! : (a[m - 1]! + a[m]!) / 2;
}

export function DashboardDailyChartSection({
  chartData,
  loading,
  refreshing,
  errorText,
  businessGoalMode,
  chartSeries,
  onSeriesChange,
}: {
  chartData: DailyChartRow[];
  loading?: boolean;
  refreshing?: boolean;
  errorText?: string | null;
  businessGoalMode: BusinessGoalMode;
  chartSeries: SeriesKey;
  onSeriesChange: (s: SeriesKey) => void;
}) {
  const leadFocus = businessGoalMode === "LEADS" || businessGoalMode === "HYBRID";

  const anomalyLeads = useMemo(() => {
    const vals = chartData.map((d) => d.leads).filter((n) => n > 0);
    const med = median(vals);
    if (med == null || med <= 0) return new Set<string>();
    const out = new Set<string>();
    for (const d of chartData) {
      if (d.leads > med * 2.2 && d.leads >= 3) out.add(d.label);
    }
    return out;
  }, [chartData]);

  const toggles: { key: SeriesKey; label: string }[] = [
    { key: "spend", label: "Investimento" },
    { key: "leads", label: "Leads" },
    { key: "cpl", label: "CPL" },
    { key: "ctr", label: "CTR" },
  ];

  const title =
    chartSeries === "spend"
      ? "Série diária · investimento"
      : chartSeries === "leads"
        ? "Série diária · leads"
        : chartSeries === "cpl"
          ? "Série diária · CPL"
          : "Série diária · CTR";

  return (
    <ChartPanelPremium
      title={title}
      actions={
        <div className="flex flex-wrap items-center gap-1.5">
          {refreshing ? (
            <span className="flex items-center gap-1 text-[10px] font-medium text-primary">
              <RefreshCw className="h-3 w-3 animate-spin" aria-hidden />
              Atualizando
            </span>
          ) : null}
          {toggles.map(({ key, label }) => (
            <Button
              key={key}
              type="button"
              variant={chartSeries === key ? "secondary" : "outline"}
              size="sm"
              className={cn(
                "h-8 rounded-lg px-2.5 text-xs",
                leadFocus && (key === "leads" || key === "cpl") && chartSeries !== key
                  ? "border-primary/25"
                  : ""
              )}
              onClick={() => onSeriesChange(key)}
            >
              {label}
            </Button>
          ))}
        </div>
      }
      contentClassName="pt-2"
    >
      {errorText ? <p className="mb-2 text-xs text-amber-700 dark:text-amber-300">{errorText}</p> : null}
      {loading ? (
        <Skeleton className="h-[300px] w-full rounded-lg" />
      ) : (
        <div className="h-[300px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 14, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/35" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `R$${Number(v).toFixed(0)}`}
                width={44}
              />
              {chartSeries !== "spend" ? (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  width={48}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => {
                    if (chartSeries === "leads") return `${Math.round(v)}`;
                    if (chartSeries === "cpl") return `${Math.round(v)}`;
                    return `${Number(v).toFixed(1)}%`;
                  }}
                />
              ) : null}
              <RechartsTooltip
                contentStyle={{
                  borderRadius: 12,
                  fontSize: 12,
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--card))",
                  boxShadow: "0 8px 24px hsl(var(--foreground) / 0.06)",
                }}
                formatter={(val: number, name: string) => {
                  if (name === "spend") return [formatSpend(val), "Investimento"];
                  if (name === "leads") return [formatNumber(val), "Leads"];
                  if (name === "cpl" && val != null && Number.isFinite(val)) return [formatSpend(val), "CPL"];
                  if (name === "ctr" && val != null) return [formatPercent(val), "CTR"];
                  return [val, name];
                }}
                labelFormatter={(l) => l}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Bar
                yAxisId="left"
                dataKey="spend"
                name="Investimento"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
                opacity={chartSeries === "spend" ? 0.88 : 0.22}
              />
              {chartSeries === "leads" ? (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="leads"
                  name="Leads"
                  stroke="hsl(199 89% 48%)"
                  strokeWidth={2.5}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    const p = payload as DailyChartRow;
                    const hot = anomalyLeads.has(p.label);
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={hot ? 5 : 3}
                        fill={hot ? "hsl(38 92% 50%)" : "hsl(199 89% 48%)"}
                        stroke="hsl(var(--card))"
                        strokeWidth={1}
                      />
                    );
                  }}
                  activeDot={{ r: 6 }}
                />
              ) : null}
              {chartSeries === "cpl" ? (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="cpl"
                  name="CPL"
                  stroke="hsl(262 83% 58%)"
                  strokeWidth={2.5}
                  dot={false}
                  connectNulls
                />
              ) : null}
              {chartSeries === "ctr" ? (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="ctr"
                  name="CTR %"
                  stroke="hsl(280 65% 52%)"
                  strokeWidth={2.5}
                  dot={false}
                  connectNulls
                />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartPanelPremium>
  );
}
