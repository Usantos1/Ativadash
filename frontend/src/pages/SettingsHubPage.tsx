import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Briefcase,
  Building2,
  Layers,
  Megaphone,
  Plug,
  Shield,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  SettingsGrid,
  SettingsHeader,
  SettingsHelpAccordion,
  SettingsSectionCard,
  SettingsStatRow,
} from "@/components/settings";
import { useAuthStore } from "@/stores/auth-store";
import {
  fetchOrganizationContext,
  formatPlanCap,
  formatPlanLimit,
  type OrganizationContext,
} from "@/lib/organization-api";
import { fetchIntegrations, type IntegrationFromApi } from "@/lib/integrations-api";
import { fetchMarketingSettings, type MarketingSettingsDto } from "@/lib/marketing-settings-api";
import { fetchMembers, fetchPendingInvitations, type MemberRow } from "@/lib/workspace-api";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<string, string> = {
  owner: "proprietário(s)",
  admin: "admin(s)",
  media_manager: "gestor(es) de mídia",
  analyst: "analista(s)",
  member: "membro(s)",
};

const AVAILABLE_CONNECTORS = 2;

function formatBrl(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function summarizeRoles(members: MemberRow[] | null): string {
  if (!members?.length) return "—";
  const direct = members.filter((m) => !m.source || m.source === "direct");
  if (!direct.length) return `${members.length} na lista (inclui acesso por agência)`;
  const counts = new Map<string, number>();
  for (const m of direct) {
    counts.set(m.role, (counts.get(m.role) ?? 0) + 1);
  }
  const parts: string[] = [];
  for (const [role, n] of counts) {
    const label = ROLE_LABEL[role] ?? role;
    parts.push(`${n} ${label}`);
  }
  return parts.join(" · ");
}

function integrationStatusLabel(list: IntegrationFromApi[]) {
  const n = list.filter((i) => i.status === "connected").length;
  if (n === 0) return "Nenhuma conexão ativa";
  if (n === 1) return "1 integração conectada";
  return `${n} integrações conectadas`;
}

function marketingSummary(m: MarketingSettingsDto | null): string[] {
  if (!m) return ["Não foi possível carregar (tente abrir a tela de marketing)."];
  const bits: string[] = [];
  bits.push(m.alertsEnabled ? "Alertas ligados" : "Alertas desligados");
  if (m.targetCpaBrl != null) bits.push(`Meta CPA ${formatBrl(m.targetCpaBrl)}`);
  if (m.maxCpaBrl != null) bits.push(`Teto CPA ${formatBrl(m.maxCpaBrl)}`);
  if (m.targetRoas != null) bits.push(`Meta ROAS ${m.targetRoas}×`);
  if (bits.length === 1) bits.push("Defina metas em Config. Marketing");
  return bits.slice(0, 4);
}

export function SettingsHubPage() {
  const location = useLocation();
  const authUser = useAuthStore((s) => s.user);
  const authOrg = authUser?.organization;

  const [ctx, setCtx] = useState<OrganizationContext | null>(null);
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationFromApi[] | null>(null);
  const [marketing, setMarketing] = useState<MarketingSettingsDto | null>(null);
  const [pendingInvites, setPendingInvites] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.all([
      fetchOrganizationContext(),
      fetchMembers().catch(() => null),
      fetchIntegrations().catch(() => null),
      fetchMarketingSettings().catch(() => null),
      fetchPendingInvitations().catch(() => []),
    ])
      .then(([orgCtx, mem, integ, mkt, invites]) => {
        if (cancelled) return;
        setCtx(orgCtx);
        setMembers(mem);
        setIntegrations(integ ?? []);
        setMarketing(mkt);
        setPendingInvites(Array.isArray(invites) ? invites.length : 0);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Não foi possível carregar as configurações da empresa.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (location.hash !== "#como-funciona-conta") return;
    const el = document.getElementById("como-funciona-conta");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (el instanceof HTMLDetailsElement) el.open = true;
  }, [location.hash, location.pathname]);

  const displayName = ctx?.name ?? authOrg?.name;
  const displaySlug = ctx?.slug ?? authOrg?.slug;

  const orgTagline = ctx?.parentOrganization
    ? `Organização filha · matriz: ${ctx.parentOrganization.name}`
    : "Conta principal · dados isolados neste ambiente";

  const planName = ctx?.subscription?.plan.name ?? ctx?.plan?.name ?? "—";
  const limits = ctx?.limits;
  const usage = ctx?.usage;
  const integList = integrations ?? [];
  const integEnabled = ctx?.enabledFeatures?.integrations !== false;

  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-8 pb-10">
      <SettingsHeader organizationName={displayName} organizationSlug={displaySlug} />

      {loadError ? (
        <Card className="rounded-2xl border-destructive/40 bg-destructive/[0.06]">
          <CardContent className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-destructive">{loadError}</p>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* A — Conta e organização (destaque) */}
      <Card
        className={cn(
          "overflow-hidden rounded-2xl border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.04]",
          "shadow-[var(--shadow-surface)]"
        )}
      >
        <CardContent className="flex flex-col gap-6 p-5 sm:flex-row sm:items-stretch sm:justify-between sm:gap-8 sm:p-6">
          <div className="flex min-w-0 flex-1 gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Building2 className="h-7 w-7" aria-hidden />
            </div>
            <div className="min-w-0 space-y-2">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-foreground">Conta e organização</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Nome, slug e tipo de ambiente. Revenda e empresas filhas ficam nos detalhes.
                </p>
              </div>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Empresa ativa</dt>
                  <dd className="font-semibold text-foreground">{loading && !ctx ? "Carregando…" : displayName ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Slug</dt>
                  <dd>
                    {displaySlug ? (
                      <code className="rounded-md bg-muted/80 px-2 py-0.5 font-mono text-[13px]">{displaySlug}</code>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Contexto</dt>
                  <dd className="text-foreground/90">{ctx ? orgTagline : "—"}</dd>
                </div>
              </dl>
            </div>
          </div>
          <div className="flex shrink-0 flex-col justify-center gap-2 border-t border-border/50 pt-4 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
            <Button asChild className="rounded-xl">
              <Link to="/configuracoes/empresa">Abrir detalhes da empresa</Link>
            </Button>
            <p className="text-center text-[11px] text-muted-foreground sm:text-left">
              Nome, revenda, plano da filial e portfólio
            </p>
          </div>
        </CardContent>
      </Card>

      {/* B–G — grade modular */}
      <SettingsGrid>
        <SettingsSectionCard
          icon={Users}
          title="Usuários e permissões"
          description="Quem acessa este ambiente, papéis e convites pendentes."
          action={{ label: "Gerenciar equipe", to: "/usuarios" }}
        >
          <SettingsStatRow
            label="Membros (diretos)"
            value={usage ? String(usage.directMembers) : loading ? "…" : "—"}
          />
          <SettingsStatRow
            label="Convites pendentes"
            value={pendingInvites != null ? String(pendingInvites) : "—"}
          />
          <SettingsStatRow label="Papéis" value={summarizeRoles(members)} />
        </SettingsSectionCard>

        <SettingsSectionCard
          icon={Briefcase}
          title="Clientes comerciais"
          description="Contas e marcas que você gerencia nesta empresa — não confundir com equipe."
          action={{ label: "Ir para clientes", to: "/clientes" }}
        >
          <SettingsStatRow
            label="Cadastrados"
            value={usage ? String(usage.clientAccounts) : loading ? "…" : "—"}
          />
          <SettingsStatRow
            label="Limite do plano"
            value={limits ? formatPlanCap(limits.maxClientAccounts) : "—"}
          />
        </SettingsSectionCard>

        <SettingsSectionCard
          icon={Plug}
          title="Integrações"
          description="Meta Ads, Google Ads, WhatsApp CRM e demais conexões deste ambiente."
          action={{ label: "Gerenciar integrações", to: "/marketing/integracoes" }}
        >
          <SettingsStatRow
            label="Status"
            value={
              !integEnabled
                ? "Indisponível no plano"
                : integrations === null
                  ? loading
                    ? "…"
                    : "—"
                  : integrationStatusLabel(integList)
            }
          />
          <SettingsStatRow
            label="Conectadas / disponíveis (mídia)"
            value={
              !integEnabled
                ? "—"
                : `${integList.filter((i) => i.status === "connected").length} / ${AVAILABLE_CONNECTORS}`
            }
          />
        </SettingsSectionCard>

        <SettingsSectionCard
          icon={Megaphone}
          title="Marketing"
          description="Metas de CPA e ROAS, alertas e critérios de performance."
          action={{ label: "Configurações de marketing", to: "/marketing/configuracoes" }}
        >
          {marketingSummary(marketing).map((line) => (
            <p key={line} className="text-sm leading-snug text-foreground/90">
              {line}
            </p>
          ))}
        </SettingsSectionCard>

        <SettingsSectionCard
          icon={Layers}
          title="Gestão de workspaces"
          description="Revenda e multiempresa: filiais, métricas, alertas e consumo consolidado da matriz."
          action={{ label: "Abrir gestão de workspaces", to: "/revenda" }}
        >
          <SettingsStatRow label="Plano" value={loading && !ctx ? "…" : planName} />
          <SettingsStatRow
            label="Usuários"
            value={
              usage && limits
                ? `${usage.directMembers} / ${formatPlanCap(limits.maxUsers)}`
                : loading
                  ? "…"
                  : "—"
            }
          />
          <SettingsStatRow
            label="Dashboards"
            value={
              usage && limits ? `${usage.dashboards} / ${formatPlanCap(limits.maxDashboards)}` : loading ? "…" : "—"
            }
          />
          <SettingsStatRow
            label="Integrações"
            value={
              usage && limits
                ? `${usage.integrations} / ${formatPlanCap(limits.maxIntegrations)}`
                : loading
                  ? "…"
                  : "—"
            }
          />
          <SettingsStatRow
            label="Empresas vinculadas (filhas)"
            value={
              usage && limits
                ? `${usage.childOrganizations} / ${formatPlanLimit(limits.maxChildOrganizations, {
                    zeroMeansNotIncluded: true,
                  })}`
                : loading
                  ? "…"
                  : "—"
            }
          />
          {ctx?.limitsHaveOverrides ? (
            <p className="text-xs font-medium text-primary">Limites personalizados para esta empresa</p>
          ) : null}
        </SettingsSectionCard>

        <SettingsSectionCard
          icon={Shield}
          title="Perfil e segurança"
          description="Seus dados de login, senha e preferências pessoais — não afetam a empresa inteira."
          action={{ label: "Abrir meu perfil", to: "/perfil" }}
        >
          <SettingsStatRow label="Nome" value={authUser?.name ?? "—"} />
          <SettingsStatRow label="E-mail" value={authUser?.email ?? "—"} />
          <SettingsStatRow label="Senha" value="Alterar no perfil" />
          <SettingsStatRow label="Sessão" value="Ativa neste navegador" />
        </SettingsSectionCard>
      </SettingsGrid>

      <div className="max-w-3xl">
        <SettingsHelpAccordion />
      </div>
    </div>
  );
}
