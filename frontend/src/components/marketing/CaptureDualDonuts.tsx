import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatNumber, formatSpend } from "@/lib/metrics-format";
import { cn } from "@/lib/utils";
import { ChartPanelPremium } from "@/components/premium/chart-panel-premium";

const HOT = "hsl(0 72% 51%)";
const COLD = "hsl(210 70% 45%)";

function donutFromVolumes(hot: number, cold: number) {
  const t = hot + cold;
  if (t <= 0) {
    return { data: [] as { name: string; value: number; fill: string }[], pctHot: 0, pctCold: 0, total: 0 };
  }
  const pctHot = (hot / t) * 100;
  const pctCold = (cold / t) * 100;
  return {
    data: [
      { name: "Quente", value: hot, fill: HOT },
      { name: "Frio", value: cold, fill: COLD },
    ],
    pctHot,
    pctCold,
    total: t,
  };
}

function DonutBlock({
  title,
  data,
  pctHot,
  pctCold,
  total,
  valueLabel,
}: {
  title: string;
  data: { name: string; value: number; fill: string }[];
  pctHot: number;
  pctCold: number;
  total: number;
  valueLabel: "leads" | "money";
}) {
  const fmt = (v: number) => (valueLabel === "money" ? formatSpend(v) : formatNumber(v));
  const hotVal = data.find((d) => d.name === "Quente")?.value ?? 0;
  const coldVal = data.find((d) => d.name === "Frio")?.value ?? 0;

  return (
    <div className="flex min-h-[240px] flex-1 flex-col rounded-xl border border-border/50 bg-gradient-to-b from-card/80 to-muted/10 p-3 shadow-inner">
      <p className="text-center text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
      {data.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">Sem volume</div>
      ) : (
        <>
          <div className="min-h-[190px] flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={76}
                  paddingAngle={2.5}
                  dataKey="value"
                  nameKey="name"
                  stroke="hsl(var(--card))"
                  strokeWidth={2}
                >
                  {data.map((e, i) => (
                    <Cell key={i} fill={e.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    fontSize: 12,
                    border: "1px solid hsl(var(--border))",
                  }}
                  formatter={(v: number, name: string) => [fmt(v), name]}
                />
                <Legend
                  verticalAlign="bottom"
                  wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
                  formatter={(value) => <span className="text-muted-foreground">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1.5 border-t border-border/40 pt-2 text-[11px]">
            <div className="flex justify-between gap-2 tabular-nums text-muted-foreground">
              <span>Quente</span>
              <span className="font-semibold text-foreground">
                {fmt(hotVal)} <span className="font-normal text-muted-foreground">({pctHot.toFixed(0)}%)</span>
              </span>
            </div>
            <div className="flex justify-between gap-2 tabular-nums text-muted-foreground">
              <span>Frio</span>
              <span className="font-semibold text-foreground">
                {fmt(coldVal)} <span className="font-normal text-muted-foreground">({pctCold.toFixed(0)}%)</span>
              </span>
            </div>
            <div className="flex justify-between gap-2 border-t border-border/30 pt-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              <span>Total</span>
              <span className="tabular-nums text-foreground">{fmt(total)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function CaptureDualDonuts({
  hotLeads,
  coldLeads,
  hotSpend,
  coldSpend,
  className,
  embedded = false,
}: {
  hotLeads: number;
  coldLeads: number;
  hotSpend: number;
  coldSpend: number;
  className?: string;
  embedded?: boolean;
}) {
  const leads = donutFromVolumes(hotLeads, coldLeads);
  const spend = donutFromVolumes(hotSpend, coldSpend);

  const body = (
    <div className="grid gap-4 sm:grid-cols-2">
      <DonutBlock
        title="Leads"
        data={leads.data}
        pctHot={leads.pctHot}
        pctCold={leads.pctCold}
        total={leads.total}
        valueLabel="leads"
      />
      <DonutBlock
        title="Gasto"
        data={spend.data}
        pctHot={spend.pctHot}
        pctCold={spend.pctCold}
        total={spend.total}
        valueLabel="money"
      />
    </div>
  );

  if (embedded) {
    return (
      <div className={cn("space-y-3", className)}>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Participação por heurística de nome (remarketing, carrinho, etc.). Cruze com a tabela consolidada para
          priorizar ajustes.
        </p>
        {body}
      </div>
    );
  }

  return (
    <ChartPanelPremium
      className={className}
      title="Quente vs frio"
      description="Distribuição de volume e investimento — leads e gasto lado a lado."
      contentClassName="pt-2"
    >
      {body}
    </ChartPanelPremium>
  );
}
