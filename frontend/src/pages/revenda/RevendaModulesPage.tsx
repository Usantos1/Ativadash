import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Módulos e limites</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Flags de módulo vêm do plano e podem ser parcialmente sobrescritas por organização (
          <code className="rounded bg-muted px-1 py-0.5 text-xs">featureOverrides</code>
          ). Limites numéricos podem ser ajustados via override de assinatura na governança (API{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">limitsOverride</code>).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chaves de recurso (exemplos)</CardTitle>
          <CardDescription>
            O merge é feito no servidor sobre o JSON <code className="text-xs">features</code> do plano. Use o painel de
            governança (via API) para gravar overrides por empresa.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {EXAMPLES.map((k) => (
            <span
              key={k}
              className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-medium text-foreground"
            >
              {k}
            </span>
          ))}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Para aplicar overrides hoje, use{" "}
        <Link to="/revenda/empresas" className="font-semibold text-primary underline-offset-4 hover:underline">
          Empresas
        </Link>{" "}
        ou{" "}
        <Link to="/revenda/agencias" className="font-semibold text-primary underline-offset-4 hover:underline">
          Agências
        </Link>{" "}
        e a API <code className="rounded bg-muted px-1 text-xs">PATCH /api/reseller/children/:id/governance</code> com{" "}
        <code className="rounded bg-muted px-1 text-xs">featureOverrides</code> e{" "}
        <code className="rounded bg-muted px-1 text-xs">limitsOverride</code>. Editor visual dedicado pode ser adicionado
        na sequência.
      </p>
    </div>
  );
}
