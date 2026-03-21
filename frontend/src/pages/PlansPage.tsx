import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollRegion } from "@/components/ui/scroll-region";
import { cn } from "@/lib/utils";
import {
  fetchOrganizationContext,
  formatPlanCap,
  type OrganizationContext,
} from "@/lib/organization-api";

/** Alinhar com backend/prisma/seed.ts ao alterar limites. */
type PlanLimitsDef = {
  maxUsers: number;
  maxClientAccounts: number | null;
  maxChildOrganizations: number | null;
  maxIntegrations: number;
  maxDashboards: number;
};

type PlanCatalogEntry = {
  name: string;
  slug: string;
  description: string;
  highlight?: boolean;
  limits: PlanLimitsDef;
  features: string[];
};

const plansCatalog: PlanCatalogEntry[] = [
  {
    name: "Essencial",
    slug: "starter",
    description: "Freelancer ou time pequeno centralizando métricas de poucos clientes.",
    limits: {
      maxUsers: 3,
      maxClientAccounts: 15,
      maxChildOrganizations: 0,
      maxIntegrations: 3,
      maxDashboards: 10,
    },
    features: [
      "Dashboard e Marketing",
      "Alertas de CPA / ROAS e WhatsApp (Ativa CRM)",
      "Um ambiente isolado por organização",
    ],
  },
  {
    name: "Profissional",
    slug: "professional",
    description: "Agência de marketing com vários clientes e equipe.",
    highlight: true,
    limits: {
      maxUsers: 10,
      maxClientAccounts: 60,
      maxChildOrganizations: 15,
      maxIntegrations: 10,
      maxDashboards: 40,
    },
    features: [
      "Tudo do Essencial",
      "Multi-usuário e revenda (empresas filhas)",
      "Limites maiores para escalar operação",
      "Suporte prioritário",
    ],
  },
  {
    name: "Agência Plus",
    slug: "agency",
    description: "Operação grande: muitos clientes e várias empresas filhas.",
    limits: {
      maxUsers: 30,
      maxClientAccounts: null,
      maxChildOrganizations: null,
      maxIntegrations: 20,
      maxDashboards: 100,
    },
    features: [
      "Limites ampliados para agências de alto volume",
      "Negociação de SLA e onboarding dedicado",
      "Roadmap: API e webhooks sob demanda",
    ],
  },
];

function describeUsers(n: number) {
  return `Até ${n} usuários com login`;
}

function describeClients(n: number | null) {
  return n === null ? "Clientes comerciais ilimitados" : `Até ${n} clientes comerciais (menu Clientes)`;
}

function describeChildOrgs(n: number | null) {
  if (n === null) return "Empresas vinculadas ilimitadas";
  if (n === 0) return "Sem empresas vinculadas (revenda multi-ambiente)";
  return `Até ${n} empresas vinculadas (cliente final com ambiente próprio)`;
}

function describeIntegrations(n: number) {
  return `Até ${n} integrações conectadas`;
}

function describeDashboards(n: number) {
  return `Até ${n} dashboards`;
}

function cellChildOrgs(n: number | null) {
  if (n === null) return "Ilimitado";
  if (n === 0) return "—";
  return String(n);
}

function cellCap(n: number | null) {
  if (n === null) return "Ilimitado";
  return String(n);
}

const comparisonRows: { label: string; key: keyof PlanLimitsDef }[] = [
  { label: "Usuários (login)", key: "maxUsers" },
  { label: "Clientes comerciais (menu Clientes)", key: "maxClientAccounts" },
  { label: "Empresas vinculadas (revenda)", key: "maxChildOrganizations" },
  { label: "Integrações ativas", key: "maxIntegrations" },
  { label: "Dashboards", key: "maxDashboards" },
];

function formatComparisonCell(plan: PlanCatalogEntry, key: keyof PlanLimitsDef): string {
  const v = plan.limits[key];
  if (key === "maxChildOrganizations") return cellChildOrgs(v as number | null);
  return cellCap(v as number | null);
}

export function PlansPage() {
  const [orgCtx, setOrgCtx] = useState<OrganizationContext | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchOrganizationContext()
      .then((data) => {
        if (!cancelled) setOrgCtx(data);
      })
      .catch(() => {
        /* sessão inválida ou rede: página de planos continua útil sem contexto */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const currentSlug = orgCtx?.plan?.slug ?? null;

  return (
    <div className="w-full space-y-10 pb-8">
      <div className="text-center space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Planos e limites técnicos</h1>
        <p className="mx-auto max-w-2xl text-sm text-muted-foreground leading-relaxed">
          Preço é combinado com o comercial (trial incluso quando fizer sentido). Abaixo está o que o produto{" "}
          <strong className="text-foreground">efetivamente aplica</strong> por{" "}
          <strong className="text-foreground">empresa ativa</strong> no painel — sem surpresa na hora de escalar
          usuários, clientes, integrações ou ambientes filhos.
        </p>
      </div>

      {orgCtx && (
        <Card className="mx-auto max-w-4xl border-primary/25 bg-primary/[0.04]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Sua empresa agora: {orgCtx.name}</CardTitle>
            <CardDescription>
              Plano contratado (referência):{" "}
              <span className="font-medium text-foreground">{orgCtx.plan?.name ?? "Não atribuído"}</span>
              {currentSlug ? (
                <span className="text-muted-foreground"> · slug: {currentSlug}</span>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-5">
            <UsageChip
              label="Usuários"
              used={orgCtx.usage.directMembers}
              cap={orgCtx.limits.maxUsers}
            />
            <UsageChip
              label="Clientes (menu)"
              used={orgCtx.usage.clientAccounts}
              cap={orgCtx.limits.maxClientAccounts}
            />
            <UsageChip
              label="Empresas vinculadas"
              used={orgCtx.usage.childOrganizations}
              cap={orgCtx.limits.maxChildOrganizations}
              zeroCapMeansExcluded
            />
            <UsageChip label="Integrações" used={orgCtx.usage.integrations} cap={orgCtx.limits.maxIntegrations} />
            <UsageChip label="Dashboards" used={orgCtx.usage.dashboards} cap={orgCtx.limits.maxDashboards} />
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <div className="text-center">
          <h2 className="text-lg font-semibold tracking-tight">Comparativo rápido</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Mesmos números exibidos nos cards; útil para decidir upgrade antes de falar com vendas.
          </p>
        </div>
        <ScrollRegion className="scrollbar-thin -mx-1 px-1">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-3 pr-4 text-left font-medium text-muted-foreground">Limite por empresa</th>
                {plansCatalog.map((p) => (
                  <th
                    key={p.slug}
                    className={cn(
                      "px-3 py-3 text-center font-semibold",
                      currentSlug === p.slug && "rounded-t-md bg-primary/10 text-primary"
                    )}
                  >
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.key} className="border-b border-border/70">
                  <td className="py-2.5 pr-4 text-muted-foreground">{row.label}</td>
                  {plansCatalog.map((p) => (
                    <td
                      key={p.slug}
                      className={cn(
                        "px-3 py-2.5 text-center tabular-nums",
                        currentSlug === p.slug && "bg-primary/[0.06]"
                      )}
                    >
                      {formatComparisonCell(p, row.key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollRegion>
      </section>

      <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
        {plansCatalog.map((plan) => {
          const isCurrent = currentSlug === plan.slug;
          const { limits } = plan;
          return (
            <Card
              key={plan.slug}
              className={cn(
                "relative flex flex-col",
                plan.highlight && "border-primary shadow-md ring-1 ring-primary/20 md:-mt-1 md:mb-1",
                isCurrent && "ring-2 ring-primary/40"
              )}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                  Recomendado
                </span>
              )}
              {isCurrent && (
                <span className="absolute -top-3 right-3 rounded-full border border-primary/40 bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  Plano atual
                </span>
              )}
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="pt-3 space-y-1">
                  <p className="text-lg font-semibold">Proposta comercial</p>
                  <p className="text-2xl font-semibold tracking-tight text-foreground">Sob consulta</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Valores e período de teste alinhados ao seu uso real (usuários, clientes e integrações).
                  </p>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <div className="space-y-1 rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  <p>
                    <span className="font-medium text-foreground">Usuários:</span> {describeUsers(limits.maxUsers)}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Clientes (menu Clientes):</span>{" "}
                    {describeClients(limits.maxClientAccounts)}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Empresas vinculadas:</span>{" "}
                    {describeChildOrgs(limits.maxChildOrganizations)}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Integrações:</span>{" "}
                    {describeIntegrations(limits.maxIntegrations)}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Dashboards:</span>{" "}
                    {describeDashboards(limits.maxDashboards)}
                  </p>
                </div>
                <ul className="space-y-2 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button className="w-full" variant={plan.highlight ? "default" : "outline"} asChild>
                  <a
                    href={`mailto:contato@ativadash.com?subject=${encodeURIComponent(`Plano Ativa Dash — ${plan.name}`)}`}
                  >
                    Falar com vendas
                  </a>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <div className="mx-auto max-w-2xl space-y-4 rounded-lg border border-border/80 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        <p>
          <strong className="text-foreground">Cliente comercial</strong> é cada marca no menu Clientes.{" "}
          <strong className="text-foreground">Empresa vinculada</strong> é um ambiente separado (filho) para o cliente
          final, criado em Configurações → Empresa — comum em revenda white-label.
        </p>
        <p>
          Ao estourar um limite, o sistema bloqueia a ação e mostra mensagem objetiva; upgrade de plano é feito com o
          time comercial.
        </p>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Já é cliente?{" "}
        <Link to="/configuracoes" className="font-medium text-primary hover:underline">
          Voltar às configurações
        </Link>
      </p>
    </div>
  );
}

function UsageChip({
  label,
  used,
  cap,
  zeroCapMeansExcluded,
}: {
  label: string;
  used: number;
  cap: number | null;
  /** Ex.: empresas filhas com limite 0 no Essencial — não é "0 ilimitado", é recurso fora do plano. */
  zeroCapMeansExcluded?: boolean;
}) {
  const denom =
    zeroCapMeansExcluded && cap === 0 ? "Não incl." : formatPlanCap(cap);
  return (
    <div className="rounded-md border border-border/60 bg-background/80 px-2.5 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono text-sm text-foreground">
        {used} / {denom}
      </p>
    </div>
  );
}
