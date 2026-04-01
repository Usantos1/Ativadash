import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHint } from "@/pages/revenda/PageHint";
import { REVENDA_LIMIT_FIELDS, REVENDA_PLAN_FEATURE_KEYS } from "@/lib/revenda-api";

export function RevendaModulesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-1">
          <h2 className="text-lg font-semibold tracking-tight">Módulos e cotas</h2>
          <PageHint>
            Referência das chaves usadas nos planos e no <span className="font-medium">PATCH</span> de governança.
            Valores padrão vêm de{" "}
            <Link to="/revenda/planos" className="font-medium text-primary underline-offset-4 hover:underline">
              Planos
            </Link>
            ; por workspace, edite em{" "}
            <Link to="/revenda/empresas" className="font-medium text-primary underline-offset-4 hover:underline">
              Clientes
            </Link>{" "}
            ou{" "}
            <Link to="/revenda/agencias" className="font-medium text-primary underline-offset-4 hover:underline">
              Agências
            </Link>
            .
          </PageHint>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Módulos (ligar / desligar)</CardTitle>
          <CardDescription>
            Campo <code className="rounded bg-muted px-1 text-xs">featureOverrides</code> no corpo do PATCH — uma
            entrada booleana por chave abaixo (mesmo nome no JSON do plano).
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4 font-semibold">Chave (API / plano)</th>
                <th className="py-2 pr-2 font-semibold">Nome na interface</th>
              </tr>
            </thead>
            <tbody>
              {REVENDA_PLAN_FEATURE_KEYS.map(({ key, label }) => (
                <tr key={key} className="border-b border-border/50">
                  <td className="py-2.5 pr-4 font-mono text-[13px] text-foreground">{key}</td>
                  <td className="py-2.5 pr-2 text-muted-foreground">{label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Cotas numéricas</CardTitle>
          <CardDescription>
            Campo <code className="rounded bg-muted px-1 text-xs">limitsOverride</code> — use{" "}
            <code className="rounded bg-muted px-1 text-xs">null</code> para herdar do plano ou um número inteiro.
            Vazio na UI de edição significa herdar.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4 font-semibold">Chave</th>
                <th className="py-2 pr-2 font-semibold">Significado</th>
              </tr>
            </thead>
            <tbody>
              {REVENDA_LIMIT_FIELDS.map(({ key, label }) => (
                <tr key={key} className="border-b border-border/50">
                  <td className="py-2.5 pr-4 font-mono text-[13px] text-foreground">{key}</td>
                  <td className="py-2.5 pr-2 text-muted-foreground">{label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="border-dashed bg-muted/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">API (integrações)</CardTitle>
          <CardDescription className="font-mono text-xs text-muted-foreground">
            PATCH /reseller/children/:childId/governance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Corpo típico: <code className="rounded bg-muted px-1">featureOverrides</code>,{" "}
            <code className="rounded bg-muted px-1">limitsOverride</code>, além de nome, status do workspace, plano,
            etc., conforme o validador do backend.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
