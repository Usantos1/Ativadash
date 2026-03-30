import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHint } from "@/pages/revenda/PageHint";

const EXAMPLES = [
  "marketing",
  "captacao",
  "conversao",
  "receita",
  "integracoes",
  "whatsapp crm",
  "revenda",
  "auditoria",
  "webhooks",
  "relatórios avançados",
  "dashboards premium",
  "API",
  "automações",
];

export function RevendaModulesPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1">
        <h2 className="text-lg font-semibold tracking-tight">Limites</h2>
        <PageHint>
          Nomes usados nos planos. Por conta, edite o cliente ou a agência. API:{" "}
          <code className="rounded bg-muted px-1">PATCH …/governance</code>.
        </PageHint>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Chaves</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {EXAMPLES.map((k) => (
            <span
              key={k}
              className="rounded-full border border-border/70 bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-foreground"
            >
              {k}
            </span>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Atalho:{" "}
        <Link to="/revenda/empresas" className="font-medium text-primary underline-offset-4 hover:underline">
          Clientes
        </Link>{" "}
        ·{" "}
        <Link to="/revenda/agencias" className="font-medium text-primary underline-offset-4 hover:underline">
          Agências
        </Link>
      </p>
    </div>
  );
}
