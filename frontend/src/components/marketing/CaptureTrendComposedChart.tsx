import type { ReactNode } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatSpend } from "@/lib/metrics-format";
import type { ChartDayPoint } from "@/lib/marketing-capture-aggregate";
import { cn } from "@/lib/utils";
import { ChartPanelPremium } from "@/components/premium/chart-panel-premium";

const fmtMoney = (v: number) => formatSpend(v);

function PremiumTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; dataKey?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-popover/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm">
      <p className="mb-1.5 font-semibold text-foreground">{label}</p>
      <ul className="space-y-1">
        {payload.map((p) => {
          const v = p.value ?? 0;
          const isMoney = p.dataKey === "gasto" || p.dataKey === "cpa";
          return (
            <li key={p.name} className="flex items-center justify-between gap-6 tabular-nums">
              <span className="flex items-center gap-2 text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                {p.name}
              </span>
              <span className="font-semibold text-foreground">
                {isMoney ? fmtMoney(v) : v}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function CaptureTrendComposedChart({
  data,
  className,
  title = "Valor gasto, CPA e leads (por dia)",
  embedded = false,
  description,
  footer,
}: {
  data: ChartDayPoint[];
  className?: string;
  title?: string;
  /** Dentro de `AnalyticsSection` — sem cabeçalho duplicado de painel */
  embedded?: boolean;
  description?: string;
  footer?: ReactNode;
}) {
  const hasData = data.some((d) => d.gasto > 0 || d.leads > 0);

  const chartBody = !hasData ? (
    <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/15 text-sm text-muted-foreground">
      Sem dados diários no período (ou aguarde a sincronização das integrações).
    </div>
  ) : (
    <div className="h-[min(320px,42vh)] w-full min-h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.65} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="leads"
            orientation="left"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
          />
          <YAxis
            yAxisId="money"
            orientation="right"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `R$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
          />
          <Tooltip content={<PremiumTooltip />} cursor={{ stroke: "hsl(var(--primary))", strokeOpacity: 0.25 }} />
          <Legend
            verticalAlign="top"
            align="right"
            wrapperStyle={{ fontSize: 11, paddingBottom: 8 }}
            formatter={(value) => <span className="text-muted-foreground">{value}</span>}
          />
          <Bar
            yAxisId="money"
            dataKey="gasto"
            name="Valor gasto"
            fill="hsl(var(--primary) / 0.45)"
            radius={[4, 4, 0, 0]}
            maxBarSize={32}
          />
          <Line
            yAxisId="money"
            type="monotone"
            dataKey="cpa"
            name="CPA (R$)"
            stroke="hsl(0 72% 51%)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
          />
          <Line
            yAxisId="leads"
            type="monotone"
            dataKey="leads"
            name="Leads"
            stroke="hsl(199 89% 42%)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );

  if (embedded) {
    return (
      <div className={cn("space-y-3", className)}>
        {description ? <p className="text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
        <div className="rounded-xl border border-border/50 bg-muted/[0.12] p-1 sm:p-2">{chartBody}</div>
        {footer}
      </div>
    );
  }

  return (
    <ChartPanelPremium title={title} description={description} className={className} contentClassName="pt-2">
      {chartBody}
      {footer}
    </ChartPanelPremium>
  );
}
