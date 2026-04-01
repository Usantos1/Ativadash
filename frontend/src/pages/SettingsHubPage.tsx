import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { formatPageTitle, usePageTitle } from "@/hooks/usePageTitle";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, Copy, LayoutDashboard, LineChart, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SettingsHeader,
  SettingsHelpAccordion,
  settingsHubPanelClass,
  SettingsHubSection,
  SettingsHubIntegrationRow,
  SettingsChangePasswordDialog,
  HubStat,
  HubRow,
} from "@/components/settings";
import { OrganizationSwitcher } from "@/components/layout/OrganizationSwitcher";
import { StatusBadge } from "@/components/premium";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import {
  fetchOrganizationContext,
  formatPlanCap,
  formatPlanLimit,
  type OrganizationContext,
} from "@/lib/organization-api";
import { fetchIntegrations, type AtivaCrmHubFromApi, type IntegrationFromApi } from "@/lib/integrations-api";
import {
  fetchMarketingSettings,
  type ChannelAutomationsDto,
  type ChannelWhatsappAlertsDto,
  type MarketingSettingsDto,
} from "@/lib/marketing-settings-api";
import {
  fetchPendingInvitations,
  fetchMembers,
  fetchClients,
  type MemberRow,
  type ClientAccount,
} from "@/lib/workspace-api";
import {
  resolveSidebarNavVariant,
  canAccessMatrizResellerNav,
  resolveAppNavMode,
  canAccessAdminPage,
  isAgencyBranchExpandedOpsEnabled,
} from "@/lib/navigation-mode";

function formatBrl(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function formatSync(iso: string | null | undefined): string {
  if (!iso) return "Nunca";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
  } catch {
    return "—";
  }
}

function countAutomations(ch: ChannelAutomationsDto | null | undefined): number {
  if (!ch) return 0;
  let n = 0;
  if (ch.pauseIfCplAboveMax) n++;
  if (ch.reduceBudgetIfCplAboveTarget) n++;
  if (ch.increaseBudgetIfCplBelowTarget) n++;
  if (ch.flagScaleIfCplGood) n++;
  if (ch.flagReviewSpendUpConvDown) n++;
  return n;
}

function countWhatsappRules(ch: ChannelWhatsappAlertsDto | null | undefined): number {
  if (!ch) return 0;
  let n = 0;
  if (ch.cplAboveMax) n++;
  if (ch.cplAboveTarget) n++;
  if (ch.roasBelowMin) n++;
  if (ch.minSpendNoResults) n++;
  if (ch.scaleOpportunity) n++;
  if (ch.sharpPerformanceDrop) n++;
  if (ch.clearAdjustmentOpportunity) n++;
  return n;
}

function goalModeLabel(m: MarketingSettingsDto | null): string {
  if (!m) return "—";
  if (m.businessGoalMode === "LEADS") return "Leads";
  if (m.businessGoalMode === "SALES") return "ROAS";
  return "Híbrido";
}

function pickIntegration(list: IntegrationFromApi[], slug: string): IntegrationFromApi | undefined {
  return list.find((i) => i.slug === slug && i.status === "connected");
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Proprietário",
  admin: "Admin",
  media_manager: "Gestor",
  analyst: "Operador",
  member: "Colaborador",
};

export function SettingsHubPage() {
  usePageTitle(formatPageTitle(["Configurações"]));
  const location = useLocation();
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.user);
  const authOrg = authUser?.organization;
  const logout = useAuthStore((s) => s.logout);
  const memberships = useAuthStore((s) => s.memberships);
  const managed = useAuthStore((s) => s.managedOrganizations);
  const canSwitchWorkspace = useMemo(() => {
    const opts = new Set<string>();
    for (const m of memberships ?? []) opts.add(m.organizationId);
    for (const o of managed ?? []) opts.add(o.id);
    return opts.size > 1;
  }, [memberships, managed]);

  const sidebarVariant = useMemo(
    () => resolveSidebarNavVariant(authUser ?? null, memberships ?? null),
    [authUser, memberships]
  );
  const isAgencyBranchNav = sidebarVariant === "agency_branch";
  const agencyExpandedOps = isAgencyBranchExpandedOpsEnabled();
  const agencySlimHub = isAgencyBranchNav && !agencyExpandedOps;
  const isClientWorkspaceNav = sidebarVariant === "client_workspace";
  const isPortalNav = sidebarVariant === "agency_client_portal";
  const appNavMode = useMemo(() => resolveAppNavMode(authUser ?? null), [authUser]);
  const showAdminHubLink = useMemo(
    () => canAccessAdminPage(authUser ?? null, memberships ?? null, appNavMode) && !isPortalNav,
    [authUser, memberships, appNavMode, isPortalNav]
  );

  const [ctx, setCtx] = useState<OrganizationContext | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationFromApi[] | null>(null);
  const [ativaCrm, setAtivaCrm] = useState<AtivaCrmHubFromApi | null>(null);
  const [marketing, setMarketing] = useState<MarketingSettingsDto | null>(null);
  const [pendingInvites, setPendingInvites] = useState<number | null>(null);
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [clients, setClients] = useState<ClientAccount[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const [orgCtx, intRes, mkt, invites, mem, cl] = await Promise.all([
        fetchOrganizationContext(),
        fetchIntegrations().catch(() => null),
        fetchMarketingSettings().catch(() => null),
        fetchPendingInvitations().catch(() => []),
        fetchMembers().catch(() => null),
        fetchClients().catch(() => null),
      ]);
      setCtx(orgCtx);
      setIntegrations(intRes?.integrations ?? null);
      setAtivaCrm(intRes?.ativaCrmHub ?? null);
      setMarketing(mkt);
      setPendingInvites(Array.isArray(invites) ? invites.length : 0);
      setMembers(mem);
      setClients(Array.isArray(cl) ? cl : null);
    } catch {
      setLoadError("Não foi possível carregar as configurações.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (location.hash !== "#como-funciona-conta") return;
    const el = document.getElementById("como-funciona-conta");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (el instanceof HTMLDetailsElement) el.open = true;
  }, [location.hash, location.pathname]);

  const displayName = ctx?.name ?? authOrg?.name;
  const displaySlug = ctx?.slug ?? authOrg?.slug;
  const integList = integrations ?? [];
  const integEnabled = ctx?.enabledFeatures?.integrations !== false;
  const limits = ctx?.limits;
  const usage = ctx?.usage;
  const planName = ctx?.subscription?.plan?.name ?? ctx?.plan?.name ?? "—";

  const metaInt = pickIntegration(integList, "meta");
  const googleInt = pickIntegration(integList, "google-ads");
  const waConnected = ativaCrm?.connected === true;
  const waPhone = marketing?.ativaCrmNotifyPhone ?? ativaCrm?.notifyPhone ?? null;

  const autoCount = marketing
    ? countAutomations(marketing.automationsMeta) + countAutomations(marketing.automationsGoogle)
    : 0;
  const waRulesCount = marketing
    ? countWhatsappRules(marketing.whatsappAlertsMeta) + countWhatsappRules(marketing.whatsappAlertsGoogle)
    : 0;

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(label);
      window.setTimeout(() => setCopiedField(null), 1800);
    } catch {
      /* ignore */
    }
  }

  const subStatus = ctx?.subscription?.status;
  const accountStatusLabel =
    subStatus === "active" || subStatus === "trialing"
      ? "Ativa"
      : subStatus === "past_due" || subStatus === "unpaid"
        ? "Atenção"
        : subStatus
          ? subStatus
          : "—";

  const slugValue: ReactNode = displaySlug ? (
    <span className="flex flex-wrap items-center gap-1 font-mono text-xs">
      {displaySlug}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 gap-1 px-1.5 text-[11px]"
        onClick={() => void copyText("slug", displaySlug)}
      >
        <Copy className="h-3 w-3" />
        {copiedField === "slug" ? "OK" : "Copiar"}
      </Button>
    </span>
  ) : (
    "—"
  );

  const idValue: ReactNode =
    ctx?.id != null ? (
      <span className="flex flex-wrap items-center gap-1 font-mono text-[11px]">
        <span className="max-w-[140px] truncate">{ctx.id}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-1.5 text-[11px]"
          onClick={() => void copyText("id", ctx.id)}
        >
          <Copy className="h-3 w-3" />
          {copiedField === "id" ? "OK" : "Copiar"}
        </Button>
      </span>
    ) : loading ? (
      "…"
    ) : (
      "—"
    );

  const directMembers = members?.filter((m) => !m.source || m.source === "direct") ?? [];
  const previewMembers = directMembers.slice(0, 6);
  const previewClients = (clients ?? []).slice(0, 6);

  // Largura como no Painel ADS: só o AnalyticsShell (~1920px) limita; max-w-6xl deixava faixa estreita no centro.
  return (
    <div className="w-full min-w-0 space-y-5 pb-12">
      <SettingsHeader
        organizationName={displayName}
        organizationSlug={displaySlug}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={loading}
            onClick={() => void load()}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
            Atualizar
          </Button>
        }
      />

      <SettingsChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />

      {loadError ? (
        <div
          className="flex flex-col gap-2 rounded-xl border border-destructive/35 bg-destructive/[0.06] p-3 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <p className="text-sm text-destructive">{loadError}</p>
          <Button variant="outline" size="sm" className="h-8 shrink-0 text-xs" onClick={() => void load()}>
            Repetir
          </Button>
        </div>
      ) : null}

      <section aria-labelledby="hub-account-strip" className={settingsHubPanelClass}>
        <div className="space-y-3 p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="hub-account-strip" className="text-sm font-semibold text-foreground">
              {displayName ?? "—"}
            </h2>
            {accountStatusLabel === "Ativa" ? (
              <StatusBadge tone="healthy" dot>
                {accountStatusLabel}
              </StatusBadge>
            ) : accountStatusLabel !== "—" ? (
              <StatusBadge tone="alert" dot>
                {accountStatusLabel}
              </StatusBadge>
            ) : null}
            {ctx?.parentOrganization ? (
              <span className="text-xs text-muted-foreground">
                · Filha de <span className="font-medium text-foreground">{ctx.parentOrganization.name}</span>
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-3">
            <HubStat label="Plano" value={loading && !ctx ? "…" : planName} />
            <HubStat label="Slug" value={slugValue} />
            <HubStat label="ID suporte" value={idValue} className="min-[420px]:col-span-2 lg:col-span-1" />
          </div>

          <div className="flex flex-col gap-2 border-t border-border/50 pt-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="min-w-[min(100%,280px)] flex-1">
              <OrganizationSwitcher />
            </div>
            {!canSwitchWorkspace ? (
              <p className="text-[11px] text-muted-foreground sm:order-last sm:basis-full">Só este workspace.</p>
            ) : null}
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" className="h-8 text-xs" asChild>
                <Link to="/configuracoes/empresa">
                  {isPortalNav || isAgencyBranchNav ? "Empresa" : "Plano e empresa"}
                </Link>
              </Button>
              {!agencySlimHub ? (
                <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                  <Link to="/marketing" className="inline-flex items-center gap-1">
                    <LineChart className="h-3 w-3" />
                    ADS
                  </Link>
                </Button>
              ) : null}
              <Button variant="secondary" size="sm" className="h-8 text-xs" asChild>
                <Link to="/dashboard" className="inline-flex items-center gap-1">
                  <LayoutDashboard className="h-3 w-3" />
                  Dashboard
                </Link>
              </Button>
              {showAdminHubLink ? (
                <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                  <Link to="/configuracoes/admin">Admin</Link>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {!isPortalNav ? (
        <>
          {!agencySlimHub || !isClientWorkspaceNav ? (
            <div
              className={cn(
                "grid gap-4",
                !agencySlimHub && !isClientWorkspaceNav && "lg:grid-cols-2"
              )}
            >
              {!agencySlimHub ? (
                <SettingsHubSection kicker="Operação" title="Equipe">
                  <div className="p-3 sm:p-4">
                    <div className="grid grid-cols-2 gap-2">
                      <HubStat
                        label="Membros"
                        value={usage != null ? String(usage.directMembers) : loading ? "…" : "—"}
                      />
                      <HubStat
                        label="Convites"
                        value={pendingInvites != null ? String(pendingInvites) : "—"}
                      />
                    </div>
                    {previewMembers.length > 0 ? (
                      <ul className="mt-2 space-y-0.5 border-t border-border/50 pt-2">
                        {previewMembers.map((m) => (
                          <li key={m.membershipId} className="flex items-center justify-between gap-2 text-xs">
                            <span className="truncate font-medium text-foreground">{m.name}</span>
                            <span className="shrink-0 text-[11px] text-muted-foreground">
                              {ROLE_LABEL[m.role] ?? m.role}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {loading ? "A carregar…" : "Sem membros diretos neste workspace."}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Button size="sm" className="h-8 text-xs" asChild>
                        <Link to="/usuarios">Gerir equipe e convites</Link>
                      </Button>
                    </div>
                  </div>
                </SettingsHubSection>
              ) : null}
              {!isClientWorkspaceNav ? (
                <SettingsHubSection kicker="Operação" title="Clientes comerciais">
                  <div className="p-3 sm:p-4">
                    <div className="grid grid-cols-2 gap-2">
                      <HubStat
                        label="Cadastrados"
                        value={
                          clients != null
                            ? String(clients.length)
                            : usage != null
                              ? String(usage.clientAccounts)
                              : loading
                                ? "…"
                                : "—"
                        }
                      />
                      <HubStat label="Limite" value={limits ? formatPlanCap(limits.maxClientAccounts) : "—"} />
                    </div>
                    {previewClients.length > 0 ? (
                      <ul className="mt-2 space-y-0.5 border-t border-border/50 pt-2">
                        {previewClients.map((c) => (
                          <li key={c.id} className="truncate text-xs font-medium text-foreground">
                            {c.name}
                          </li>
                        ))}
                      </ul>
                    ) : !loading ? (
                      <p className="mt-2 text-xs text-muted-foreground">Nenhum cliente no cadastro.</p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Button size="sm" className="h-8 text-xs" asChild>
                        <Link to="/projetos">Projetos e cadastro</Link>
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                        <Link to="/clientes">Lista de clientes</Link>
                      </Button>
                    </div>
                  </div>
                </SettingsHubSection>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <SettingsHubSection kicker="Marketing" title="Metas por canal">
              <div className="p-3 sm:p-4">
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  <HubStat label="Modo" value={goalModeLabel(marketing)} />
                  <HubStat
                    label="Alertas painel"
                    value={marketing ? (marketing.alertsEnabled ? "Ativos" : "Desligados") : "—"}
                  />
                  <HubStat label="CPL meta" value={marketing ? formatBrl(marketing.targetCpaBrl) : "—"} />
                  <HubStat
                    label="ROAS meta"
                    value={marketing?.targetRoas != null ? `${marketing.targetRoas}×` : "—"}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Button size="sm" className="h-8 text-xs" asChild>
                    <Link to="/marketing/configuracoes">Editar metas e automações</Link>
                  </Button>
                  {!agencySlimHub ? (
                    <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                      <Link to="/marketing" className="inline-flex items-center gap-1">
                        <LineChart className="h-3 w-3" />
                        Painel ADS
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            </SettingsHubSection>
            <SettingsHubSection kicker="WhatsApp" title="Alertas e regras">
              <div className="p-3 sm:p-4">
                <div className="mb-2">
                  {marketing?.alertsEnabled && waConnected ? (
                    <StatusBadge tone="healthy" dot>
                      Canal OK
                    </StatusBadge>
                  ) : (
                    <StatusBadge tone="alert" dot>
                      Rever ligação ou alertas
                    </StatusBadge>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-3">
                  <HubStat label="Automações" value={String(autoCount)} />
                  <HubStat label="Regras de alerta" value={String(waRulesCount)} />
                  <HubStat label="Último envio" value={formatSync(marketing?.ativaCrmLastAlertSentAt ?? null)} />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Button size="sm" className="h-8 text-xs" asChild>
                    <Link to="/ads/metas-alertas">Configurar regras e alertas</Link>
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                    <Link to="/marketing/integracoes/ativa-crm">Ativa CRM</Link>
                  </Button>
                </div>
              </div>
            </SettingsHubSection>
          </div>

          {canAccessMatrizResellerNav(authUser ?? null, memberships) ? (
            <SettingsHubSection kicker="Matriz" title="Revenda e workspaces filhos">
              <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                <p className="text-xs text-muted-foreground">
                  Planos, tenants e auditoria da rede — fora do dia a dia deste workspace.
                </p>
                <Button size="sm" className="h-8 w-fit text-xs" asChild>
                  <Link to="/revenda">Abrir revenda</Link>
                </Button>
              </div>
            </SettingsHubSection>
          ) : null}

          <SettingsHubSection
            kicker="Ligações"
            title="Meta, Google e WhatsApp"
            headerRight={
              integEnabled ? (
                <Button variant="ghost" size="sm" className="h-8 text-xs text-primary" asChild>
                  <Link to="/marketing/integracoes">Ver tudo</Link>
                </Button>
              ) : null
            }
          >
            {!integEnabled ? (
              <p className="p-4 text-center text-sm text-muted-foreground">Não incluído no plano.</p>
            ) : (
              <>
                <SettingsHubIntegrationRow
                  name="Meta Ads"
                  connected={!!metaInt}
                  syncLine={metaInt ? `Sync ${formatSync(metaInt.lastSyncAt)}` : "Sem ligação"}
                  configHref="/marketing/integracoes/meta-ads"
                  reconnectHref="/marketing/integracoes/meta-ads"
                />
                <SettingsHubIntegrationRow
                  name="Google Ads"
                  connected={!!googleInt}
                  syncLine={googleInt ? `Sync ${formatSync(googleInt.lastSyncAt)}` : "Sem ligação"}
                  configHref="/marketing/integracoes/google-ads"
                  reconnectHref="/marketing/integracoes/google-ads"
                />
                <SettingsHubIntegrationRow
                  name="WhatsApp (Ativa CRM)"
                  connected={waConnected}
                  syncLine={waConnected ? (waPhone ? `Número ${waPhone}` : "Ligado") : "Desligado"}
                  configHref="/marketing/integracoes/ativa-crm"
                  reconnectHref="/marketing/integracoes/ativa-crm"
                />
              </>
            )}
          </SettingsHubSection>
        </>
      ) : (
        <SettingsHubSection kicker="Portal" title="Acesso do cliente">
          <div className="space-y-3 p-3 sm:p-4">
            <p className="text-xs text-muted-foreground">
              Consulta de resultados. Plano, integrações e metas são geridos pela agência.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" className="h-8 text-xs" variant="outline" asChild>
                <Link to="/perfil">Perfil</Link>
              </Button>
              <Button size="sm" className="h-8 text-xs" asChild>
                <Link to="/configuracoes/empresa">Dados da empresa</Link>
              </Button>
            </div>
          </div>
        </SettingsHubSection>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {!isPortalNav ? (
          ctx?.parentOrganization ? (
            <SettingsHubSection kicker="Plano" title="Limites da rede">
              <div className="p-3 text-sm text-muted-foreground sm:p-4">
                Cotas e faturação vêm da <span className="font-medium text-foreground">matriz</span>. Fale com o admin da
                empresa principal.
              </div>
            </SettingsHubSection>
          ) : (
            <SettingsHubSection kicker="Plano" title="Consumo">
              <div className="p-3 sm:p-4">
                <HubRow label="Plano" value={loading && !ctx ? "…" : planName} />
                <HubRow
                  label="Usuários"
                  value={usage && limits ? `${usage.directMembers} / ${formatPlanCap(limits.maxUsers)}` : "—"}
                />
                <HubRow
                  label="Integrações"
                  value={usage && limits ? `${usage.integrations} / ${formatPlanCap(limits.maxIntegrations)}` : "—"}
                />
                <HubRow
                  label="Workspaces filhos"
                  value={
                    usage && limits
                      ? `${usage.childOrganizations} / ${formatPlanLimit(limits.maxChildOrganizations, { zeroMeansNotIncluded: true })}`
                      : "—"
                  }
                />
                {ctx?.limitsHaveOverrides ? (
                  <p className="flex items-center gap-1.5 pt-2 text-xs font-medium text-primary">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Limites personalizados
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Button size="sm" className="h-8 text-xs" asChild>
                    <Link to="/configuracoes/empresa">Abrir empresa</Link>
                  </Button>
                  {canAccessMatrizResellerNav(authUser ?? null, memberships) ? (
                    <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                      <Link to="/revenda">Revenda</Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            </SettingsHubSection>
          )
        ) : (
          <SettingsHubSection kicker="Conta" title="Acesso de leitura">
            <div className="p-3 text-sm text-muted-foreground sm:p-4">
              Resultados e relatórios. Plano e integrações são geridos pela agência.
            </div>
          </SettingsHubSection>
        )}

        <SettingsHubSection kicker="Sessão" title="Segurança">
          <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{authUser?.name ?? "—"}</p>
              <p className="text-xs text-muted-foreground">{authUser?.email ?? "—"}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                <Link to="/perfil">Perfil</Link>
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs" type="button" onClick={() => setPasswordOpen(true)}>
                Senha
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="h-8 text-xs"
                type="button"
                onClick={() => {
                  logout();
                  navigate("/login", { replace: true });
                }}
              >
                Sair
              </Button>
            </div>
          </div>
        </SettingsHubSection>
      </div>

      <SettingsHelpAccordion className="mt-2" />
    </div>
  );
}
