import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatSpend } from "@/lib/metrics-format";
import { cn } from "@/lib/utils";

const HOT = "hsl(0 72% 51%)";
const COLD = "hsl(210 70% 45%)";

function donutFromVolumes(hot: number, cold: number) {
  const t = hot + cold;
  if (t <= 0) {
    return { data: [] as { name: string; value: number; fill: string }[], pctHot: 0, pctCold: 0 };
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
  };
}

function DonutHalf({
  title,
  data,
  pctHot,
  pctCold,
  valueLabel,
}: {
  title: string;
  data: { name: string; value: number; fill: string }[];
  pctHot: number;
  pctCold: number;
  valueLabel: "leads" | "money";
}) {
  const fmt = (v: number) => (valueLabel === "money" ? formatSpend(v) : formatNumber(v));
  return (
    <div className="flex min-h-[220px] flex-1 flex-col rounded-lg border border-border/70 bg-muted/15 p-3">
      <p className="mb-1 text-center text-xs font-medium text-muted-foreground">{title}</p>
      {data.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">Sem volume</div>
      ) : (
        <>
          <div className="min-h-[180px] flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                >
                  {data.map((e, i) => (
                    <Cell key={i} fill={e.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [fmt(v), ""]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="text-center text-[11px] text-muted-foreground">
            Quente {pctHot.toFixed(0)}% · Frio {pctCold.toFixed(0)}%
          </p>
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
}: {
  hotLeads: number;
  coldLeads: number;
  hotSpend: number;
  coldSpend: number;
  className?: string;
}) {
  const leads = donutFromVolumes(hotLeads, coldLeads);
  const spend = donutFromVolumes(hotSpend, coldSpend);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Quente vs frio</CardTitle>
        <p className="text-xs text-muted-foreground">
          Distribuição por nome de campanha (remarketing, carrinho, etc.) e volume por plataforma.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <DonutHalf
            title="Leads"
            data={leads.data}
            pctHot={leads.pctHot}
            pctCold={leads.pctCold}
            valueLabel="leads"
          />
          <DonutHalf
            title="Gasto"
            data={spend.data}
            pctHot={spend.pctHot}
            pctCold={spend.pctCold}
            valueLabel="money"
          />
        </div>
      </CardContent>
    </Card>
  );
}
