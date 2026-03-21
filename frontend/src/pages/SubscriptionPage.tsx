import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  Bell,
  Building2,
  Layers,
  Mail,
  MessageCircle,
  Plug,
  Users,
  Webhook,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  fetchOrganizationContext,
  formatPlanCap,
  type OrganizationContext,
} from "@/lib/organization-api";

const BILLING_LABEL: Record<string, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  annual: "Anual",
  trial: "Trial",
  custom: "Personalizada",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Ativa",
  trialing: "Em trial",
  past_due: "Inadimplente",
  canceled: "Cancelada",
};

const FEATURE_META: Array<{
  key: keyof NonNullable<OrganizationContext["enabledFeatures"]>;
  label: string;
  icon: typeof BarChart3;
}> = [
  { key: "marketingDashboard", label: "Marketing e dashboards analíticos", icon: BarChart3 },
  { key: "performanceAlerts", label: "Alertas de performance (CPA / ROAS)", icon: Bell },
  { key: "multiUser", label: "Multiusuário na empresa", icon: Users },
  { key: "multiOrganization", label: "Multiempresa / empresas vinculadas", icon: Building2 },
  { key: "integrations", label: "Integrações (Meta, Google, etc.)", icon: Plug },
  { key: "webhooks", label: "Webhooks / automações avançadas", icon: Webhook },
];

function UsageRow({
  label,
  used,
  cap,
  zeroCapExcluded,
  untracked,
}: {
  label: string;
  used: number;
  cap: number | null;
  zeroCapExcluded?: boolean;
  /** Sem limite no plano — só exibe uso */
  untracked?: boolean;
}) {
  const denom = untracked
    ? "—"
    : zeroCapExcluded && cap === 0
      ? "—"
      : formatPlanCap(cap);
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-2.5 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums text-foreground">
        {untracked ? String(used) : `${used} / ${denom}`}
      </span>
    </div>
  );
}

export function SubscriptionPage() {
  const [ctx, setCtx] = useState<OrganizationContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    fetchOrganizationContext()
      .then((d) => {
        if (!c) setCtx(d);
      })
      .catch(() => {
        if (!c) setLoadError("Não foi possível carregar os dados da empresa.");
      });
    return () => {
      c = true;
    };
  }, []);

  if (loadError) {
    return (
      <div className="mx-auto max-w-lg space-y-4 text-center">
        <p className="text-sm text-destructive">{loadError}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (!ctx) {
    return <p className="text-sm text-muted-foreground">Carregando assinatura…</p>;
  }

  const sub = ctx.subscription;
  const limits = ctx.limits;
  const usage = ctx.usage;
  const feats = ctx.enabledFeatures;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Assinatura e uso</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Plano aplicado a este ambiente, limites consumidos e recursos liberados.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plano atual</CardTitle>
          <CardDescription>Contrato operacional vinculado a esta organização.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {sub?.inherited && sub.billingOrganization && (
            <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
              Limites e plano são os da empresa mãe: <strong>{sub.billingOrganization.name}</strong>.
            </p>
          )}
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nome do plano</dt>
              <dd className="font-medium">{sub?.plan.name ?? ctx.plan?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Slug / tipo</dt>
              <dd>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{sub?.plan.slug ?? "—"}</code>
                <span className="ml-2 text-muted-foreground">· {sub?.plan.planType ?? "—"}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status do plano</dt>
              <dd>{sub?.plan.active ? "Ativo no catálogo" : "Inativo no catálogo"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status da assinatura</dt>
              <dd>{sub ? STATUS_LABEL[sub.status] ?? sub.status : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Modalidade</dt>
              <dd>{sub ? BILLING_LABEL[sub.billingMode] ?? sub.billingMode : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Início</dt>
              <dd>
                {sub?.startedAt
                  ? new Date(sub.startedAt).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Renovação</dt>
              <dd>
                {sub?.renewsAt
                  ? new Date(sub.renewsAt).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "Não informada"}
              </dd>
            </div>
          </dl>
          {ctx.limitsHaveOverrides && (
            <p className="text-xs text-muted-foreground">
              Alguns limites deste ambiente foram <strong className="text-foreground">personalizados</strong> pela
              plataforma (override).
            </p>
          )}
          {sub?.notes ? (
            <p className="rounded-md border border-border/80 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {sub.notes}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Uso e limites</CardTitle>
          <CardDescription>Consumo no workspace atual ({ctx.name}).</CardDescription>
        </CardHeader>
        <CardContent className="px-6">
          <UsageRow
            label="Usuários (membros + convites pendentes)"
            used={usage.directMembers + (usage.pendingInvitations ?? 0)}
            cap={limits.maxUsers}
          />
          <UsageRow label="Clientes comerciais (menu Clientes)" used={usage.clientAccounts} cap={limits.maxClientAccounts} />
          <UsageRow label="Integrações (total)" used={usage.integrations} cap={limits.maxIntegrations} />
          <UsageRow label="Dashboards" used={usage.dashboards} cap={limits.maxDashboards} />
          <UsageRow
            label="Empresas vinculadas (filhas)"
            used={usage.childOrganizations}
            cap={limits.maxChildOrganizations}
            zeroCapExcluded
          />
          <UsageRow label="Projetos" used={usage.projects} cap={null} untracked />
          <UsageRow label="Lançamentos" used={usage.launches} cap={null} untracked />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recursos habilitados</CardTitle>
          <CardDescription>Conforme o plano aplicado.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {FEATURE_META.map(({ key, label, icon: Icon }) => {
              const on = feats?.[key] === true;
              return (
                <li
                  key={key}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm",
                    on ? "border-border/80 bg-muted/20" : "border-dashed border-border/60 opacity-60"
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", on ? "text-primary" : "text-muted-foreground")} />
                  <span>{label}</span>
                  <span className="ml-auto text-xs font-medium text-muted-foreground">{on ? "Sim" : "Não"}</span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ações</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="default" asChild>
            <a href="mailto:contato@ativadash.com?subject=Upgrade%20de%20plano%20%E2%80%94%20Ativa%20Dash">
              <Layers className="mr-2 h-4 w-4" />
              Solicitar upgrade
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="mailto:contato@ativadash.com?subject=Comercial%20%E2%80%94%20Ativa%20Dash">
              <Mail className="mr-2 h-4 w-4" />
              Falar com comercial
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="mailto:suporte@ativadash.com?subject=Suporte%20%E2%80%94%20Ativa%20Dash">
              <MessageCircle className="mr-2 h-4 w-4" />
              Falar com suporte
            </a>
          </Button>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        <Link to="/configuracoes" className="font-medium text-primary hover:underline">
          Voltar às configurações
        </Link>
      </p>
    </div>
  );
}
