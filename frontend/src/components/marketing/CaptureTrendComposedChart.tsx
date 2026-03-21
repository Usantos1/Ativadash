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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatSpend } from "@/lib/metrics-format";
import type { ChartDayPoint } from "@/lib/marketing-capture-aggregate";
import { cn } from "@/lib/utils";

const fmtMoney = (v: number) => formatSpend(v);

export function CaptureTrendComposedChart({
  data,
  className,
  title = "Valor gasto, CPA e leads (por dia)",
}: {
  data: ChartDayPoint[];
  className?: string;
  title?: string;
}) {
  const hasData = data.some((d) => d.gasto > 0 || d.leads > 0);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex min-h-[260px] items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/20 text-sm text-muted-foreground">
            Sem dados diários no período (ou aguarde a sincronização das integrações).
          </div>
        ) : (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis
                  yAxisId="leads"
                  orientation="left"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
                />
                <YAxis
                  yAxisId="money"
                  orientation="right"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => `R$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12 }}
                  formatter={(value: number, name: string) => {
                    if (name === "gasto" || name === "CPA (R$)") return [fmtMoney(value), name];
                    return [value, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar
                  yAxisId="money"
                  dataKey="gasto"
                  name="Valor gasto"
                  fill="hsl(199 89% 48% / 0.55)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={28}
                />
                <Line
                  yAxisId="money"
                  type="monotone"
                  dataKey="cpa"
                  name="CPA (R$)"
                  stroke="hsl(0 72% 51%)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="leads"
                  type="monotone"
                  dataKey="leads"
                  name="Leads"
                  stroke="hsl(222 47% 20%)"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
