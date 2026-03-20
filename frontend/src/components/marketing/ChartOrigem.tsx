import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface OrigemRow {
  name: string;
  leads: number;
  vendas: number;
}

interface ChartOrigemProps {
  data: OrigemRow[];
  className?: string;
}

export function ChartOrigem({ data, className }: ChartOrigemProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">Leads e vendas por origem</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="leads" name="Leads" fill="hsl(var(--primary) / 0.8)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="vendas" name="Vendas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
