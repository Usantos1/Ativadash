import { useNavigate } from "react-router-dom";
import { Plug, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral da sua operação
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="rounded-xl overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Plug className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="mt-3">Integrações</CardTitle>
            <CardDescription>
              Conecte o Google Ads para começar a ver métricas aqui. Depois adicione Meta, checkouts e CRM.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="rounded-lg" onClick={() => navigate("/marketing/integracoes")}>
              Conectar Google Ads
            </Button>
          </CardContent>
        </Card>
        <Card className="rounded-xl overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
            </div>
            <CardTitle className="mt-3">Marketing</CardTitle>
            <CardDescription>
              Métricas de captação, conversão e receita aparecem aqui após conectar integrações.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="rounded-lg" onClick={() => navigate("/marketing")}>
              Ver Marketing
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
