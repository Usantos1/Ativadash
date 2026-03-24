import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatPercent } from "@/lib/metrics-format";

const COLORS = {
  A: "hsl(142 71% 40%)",
  B: "hsl(48 96% 48%)",
  C: "hsl(38 92% 50%)",
  D: "hsl(0 72% 55%)",
} as const;

type GradeKey = "A" | "B" | "C" | "D";

const ROWS: { key: GradeKey; label: string; hint: string }[] = [
  { key: "A", label: "Faixa A · forte", hint: "Melhor quartil por CTR (ponderado)" },
  { key: "B", label: "Faixa B · bom", hint: "" },
  { key: "C", label: "Faixa C · atenção", hint: "" },
  { key: "D", label: "Faixa D · crítico", hint: "Priorize otimização aqui" },
];

/** Distribuição de investimento por score (CTR) — barras horizontais com semáforo. */
export function MarketingScoreDistributionBars({
  grades,
}: {
  grades: Record<GradeKey, number>;
}) {
  const data = ROWS.map((r) => ({
    ...r,
    value: Math.round(grades[r.key] * 10) / 10,
    fill: COLORS[r.key],
  }));

  return (
    <div className="w-full min-w-0 rounded-xl border border-border/50 bg-card/60 p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Score de campanhas</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Participação do investimento filtrado em cada faixa (quartis de CTR ponderados por volume).
      </p>
      <div className="mt-4 h-[200px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={data} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="label"
              width={132}
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
            />
            <Tooltip
              contentStyle={{
                borderRadius: 10,
                fontSize: 12,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
              }}
              formatter={(v: number) => [formatPercent(v), "Participação"]}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={22}>
              {data.map((entry) => (
                <Cell key={entry.key} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
