import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PlataformaRow {
  name: string;
  gasto: number;
  receita: number;
  fill: string;
}

interface ChartPlataformaProps {
  data: PlataformaRow[];
  className?: string;
}

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

export function ChartPlataforma({ data, className }: ChartPlataformaProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">Gasto e receita por plataforma</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, left: 60, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => `${v / 1000}k`} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: number) => formatBRL(value)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="gasto" name="Gasto" fill="hsl(var(--muted-foreground) / 0.5)" radius={[0, 4, 4, 0]} />
              <Bar dataKey="receita" name="Receita" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
