import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { formatPageTitle, usePageTitle } from "@/hooks/usePageTitle";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  Bell,
  Building2,
  Copy,
  CreditCard,
  LayoutDashboard,
  LineChart,
  Plug,
  RefreshCw,
  Shield,
  Store,
  Target,
  UserCircle,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SettingsHeader,
  SettingsHelpAccordion,
  settingsHubPanelClass,
  SettingsHubSection,
  SettingsHubIntegrationRow,
  SettingsQuickNavCard,
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
  fetchMembers,
  fetchPendingInvitations,
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

const ROLE_QUICK: Record<string, string> = {
  owner: "Proprietário",
  admin: "Admin",
  media_manager: "Gestor",
  analyst: "Operador",
  member: "Colaborador",
};

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
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [clients, setClients] = useState<ClientAccount[] | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationFromApi[] | null>(null);
  const [ativaCrm, setAtivaCrm] = useState<AtivaCrmHubFromApi | null>(null);
  const [marketing, setMarketing] = useState<MarketingSettingsDto | null>(null);
  const [pendingInvites, setPendingInvites] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const [orgCtx, mem, intRes, mkt, invites, cl] = await Promise.all([
        fetchOrganizationContext(),
        fetchMembers().catch(() => null),
        fetchIntegrations().catch(() => null),
        fetchMarketingSettings().catch(() => null),
        fetchPendingInvitations().catch(() => []),
        fetchClients().catch(() => null),
      ]);
      setCtx(orgCtx);
      setMembers(mem);
      setIntegrations(intRes?.integrations ?? null);
      setAtivaCrm(intRes?.ativaCrmHub ?? null);
      setMarketing(mkt);
      setPendingInvites(Array.isArray(invites) ? invites.length : 0);
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

  const directMembers = members?.filter((m) => !m.source || m.source === "direct") ?? [];
  const previewMembers = directMembers.slice(0, 5);
  const previewClients = (clients ?? []).slice(0, 5);

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

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 pb-16">
      <SettingsHeader
        organizationName={displayName}
        organizationSlug={displaySlug}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-2 rounded-lg border-border/70 shadow-sm"
            disabled={loading}
            onClick={() => void load()}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden />
            Atualizar
          </Button>
        }
      />

      <SettingsChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />

      {loadError ? (
        <div
          className="flex flex-col gap-3 rounded-2xl border border-destructive/35 bg-destructive/[0.07] px-4 py-4 shadow-[var(--shadow-surface-sm)] sm:flex-row sm:items-center sm:justify-between sm:px-5"
          role="alert"
        >
          <p className="text-sm text-destructive">{loadError}</p>
          <Button variant="outline" size="sm" className="h-9 shrink-0 rounded-lg" onClick={() => void load()}>
            Tentar novamente
          </Button>
        </div>
      ) : null}

      <section aria-labelledby="hub-hero-heading">
        <div className={cn(settingsHubPanelClass, "relative")}>
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent"
            aria-hidden
          />
          <div className="p-5 md:p-7">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary/80">Resumo do ambiente</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 id="hub-hero-heading" className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
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
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {ctx?.parentOrganization ? (
                <>
                  Workspace filho de{" "}
                  <span className="font-medium text-foreground">{ctx.parentOrganization.name}</span>
                </>
              ) : (
                "Conta principal — todos os dados e integrações deste workspace."
              )}
            </p>

            <div className="mt-6 grid gap-6 lg:grid-cols-12 lg:gap-8">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-7">
                <HubStat label="Plano" value={loading && !ctx ? "…" : planName} />
                <HubStat label="Slug" value={slugValue} />
                <HubStat label="ID suporte" value={idValue} className="col-span-2 sm:col-span-1" />
              </div>

              <div className="flex flex-col gap-4 border-t border-border/50 pt-5 lg:col-span-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Trocar empresa</p>
                  <div className="mt-2 max-w-md">
                    <OrganizationSwitcher />
                  </div>
                  {!canSwitchWorkspace ? (
                    <p className="mt-2 text-xs text-muted-foreground">Apenas este workspace está disponível para o seu utilizador.</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="h-9 rounded-lg text-xs font-semibold" asChild>
                    <Link to="/configuracoes/empresa">
                      {isPortalNav || isAgencyBranchNav ? "Ver empresa" : "Dados da empresa"}
                    </Link>
                  </Button>
                  {!agencySlimHub ? (
                    <Button variant="outline" size="sm" className="h-9 rounded-lg text-xs" asChild>
                      <Link to="/marketing" className="inline-flex items-center gap-1.5">
                        <LineChart className="h-3.5 w-3.5 opacity-80" />
                        Painel ADS
                      </Link>
                    </Button>
                  ) : null}
                  <Button variant="secondary" size="sm" className="h-9 rounded-lg text-xs" asChild>
                    <Link to="/dashboard" className="inline-flex items-center gap-1.5">
                      <LayoutDashboard className="h-3.5 w-3.5 opacity-80" />
                      Dashboard
                    </Link>
                  </Button>
                  {showAdminHubLink ? (
                    <Button variant="outline" size="sm" className="h-9 rounded-lg text-xs" asChild>
                      <Link to="/configuracoes/admin">Admin técnico</Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Equipe + Clientes — oculto no portal cliente; colunas conforme filial vs workspace cliente */}
      {!isPortalNav ? (
        <SettingsHubSection
          kicker="Operação"
          title="Equipe e clientes"
          description="Quem acede ao sistema e, quando aplicável, o cadastro comercial associado a esta empresa."
        >
          <div
            className={
              agencySlimHub || isClientWorkspaceNav
                ? "p-4 md:p-5"
                : "grid lg:grid-cols-2 lg:divide-x lg:divide-border/45"
            }
          >
            {!agencySlimHub ? (
              <div className={isClientWorkspaceNav ? "" : "p-4 md:p-5"}>
                <h3 className="text-sm font-semibold text-foreground">Equipe</h3>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <HubStat label="Membros" value={usage ? String(usage.directMembers) : loading ? "…" : "—"} />
                  <HubStat label="Convites" value={pendingInvites != null ? String(pendingInvites) : "—"} />
                </div>
                {previewMembers.length > 0 ? (
                  <ul className="mt-3 space-y-1 rounded-xl border border-border/40 bg-muted/20 p-2.5">
                    {previewMembers.map((m) => (
                      <li key={m.membershipId} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate font-medium text-foreground">{m.name}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{ROLE_QUICK[m.role] ?? m.role}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">{loading ? "…" : "Nenhum membro."}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" className="h-9 rounded-lg text-xs font-semibold" asChild>
                    <Link to="/usuarios">Gerir equipe</Link>
                  </Button>
                  <Button variant="outline" size="sm" className="h-9 rounded-lg text-xs" asChild>
                    <Link to="/usuarios">Convidar</Link>
                  </Button>
                </div>
              </div>
            ) : null}
            {!isClientWorkspaceNav ? (
              <div className={agencySlimHub ? "p-4 md:p-5" : "p-4 md:p-5"}>
                <h3 className="text-sm font-semibold text-foreground">Clientes (operação)</h3>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <HubStat
                    label="Cadastrados"
                    value={
                      clients != null ? String(clients.length) : usage ? String(usage.clientAccounts) : loading ? "…" : "—"
                    }
                  />
                  <HubStat label="Limite" value={limits ? formatPlanCap(limits.maxClientAccounts) : "—"} />
                </div>
                {previewClients.length > 0 ? (
                  <ul className="mt-3 space-y-1 rounded-xl border border-border/40 bg-muted/20 p-2.5">
                    {previewClients.map((c) => (
                      <li key={c.id} className="truncate text-xs font-medium text-foreground">
                        {c.name}
                      </li>
                    ))}
                  </ul>
                ) : !loading ? (
                  <p className="mt-3 text-xs text-muted-foreground">Nenhum cliente cadastrado.</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {!agencySlimHub ? (
                    <Button variant="outline" size="sm" className="h-9 rounded-lg text-xs" asChild>
                      <Link to="/projetos">Projetos</Link>
                    </Button>
                  ) : null}
                  <Button
                    variant={agencySlimHub ? "default" : "outline"}
                    size="sm"
                    className="h-9 rounded-lg text-xs font-semibold"
                    asChild
                  >
                    <Link to="/clientes">{agencySlimHub ? "Clientes" : "Ver clientes"}</Link>
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </SettingsHubSection>
      ) : null}

      {/* Integrações */}
      {!isPortalNav ? (
      <SettingsHubSection
        kicker="Conexões"
        title="Integrações"
        description="Estado das ligações com Meta, Google Ads e WhatsApp. Configure ou reconecte na central dedicada."
        headerRight={
          integEnabled ? (
            <Button variant="outline" size="sm" className="h-9 rounded-lg text-xs font-medium" asChild>
              <Link to="/marketing/integracoes">Central de integrações</Link>
            </Button>
          ) : null
        }
      >
        {!integEnabled ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            Integrações não estão incluídas no plano atual desta empresa.
          </p>
        ) : (
          <>
            <SettingsHubIntegrationRow
              name="Meta Ads"
              connected={!!metaInt}
              syncLine={metaInt ? `Última sync ${formatSync(metaInt.lastSyncAt)}` : "—"}
              configHref="/marketing/integracoes/meta-ads"
              reconnectHref="/marketing/integracoes/meta-ads"
            />
            <SettingsHubIntegrationRow
              name="Google Ads"
              connected={!!googleInt}
              syncLine={googleInt ? `Última sync ${formatSync(googleInt.lastSyncAt)}` : "—"}
              configHref="/marketing/integracoes/google-ads"
              reconnectHref="/marketing/integracoes/google-ads"
            />
            <SettingsHubIntegrationRow
              name="WhatsApp (Ativa CRM)"
              connected={waConnected}
              syncLine={
                waConnected ? (waPhone ? `Número ${waPhone}` : "Conectado") : "Desconectado"
              }
              configHref="/marketing/integracoes/ativa-crm"
              reconnectHref="/marketing/integracoes/ativa-crm"
            />
          </>
        )}
      </SettingsHubSection>
      ) : null}

      {/* Marketing | Automações */}
      {!isPortalNav ? (
      <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
        <SettingsHubSection
          kicker="Performance"
          title="Marketing"
          description="Objetivo da conta, metas numéricas e estado dos alertas."
          className="h-full"
        >
          <div className="p-4 md:p-5">
            <div className="grid grid-cols-2 gap-3">
              <HubStat label="Modo" value={goalModeLabel(marketing)} />
              <HubStat
                label="Status"
                value={marketing ? (marketing.alertsEnabled ? "Alertas on" : "Alertas off") : "—"}
              />
              <HubStat label="CPL meta" value={marketing ? formatBrl(marketing.targetCpaBrl) : "—"} />
              <HubStat label="ROAS meta" value={marketing?.targetRoas != null ? `${marketing.targetRoas}×` : "—"} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" className="h-9 rounded-lg text-xs font-semibold" asChild>
                <Link to="/marketing/configuracoes">Metas e canais</Link>
              </Button>
              {!agencySlimHub ? (
                <Button variant="outline" size="sm" className="h-9 rounded-lg text-xs" asChild>
                  <Link to="/marketing">Painel ADS</Link>
                </Button>
              ) : null}
            </div>
          </div>
        </SettingsHubSection>

        <SettingsHubSection
          kicker="WhatsApp"
          title="Automações"
          description="Regras automáticas e alertas por canal — dependem do WhatsApp (Ativa CRM) ligado."
          className="h-full"
        >
          <div className="p-4 md:p-5">
            <div className="mb-3">
              {marketing?.alertsEnabled && waConnected ? (
                <StatusBadge tone="healthy" dot>
                  OK
                </StatusBadge>
              ) : (
                <StatusBadge tone="alert" dot>
                  Ajustar
                </StatusBadge>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <HubStat label="Automações" value={String(autoCount)} />
              <HubStat label="Alertas" value={String(waRulesCount)} />
              <HubStat label="Último envio" value={formatSync(marketing?.ativaCrmLastAlertSentAt ?? null)} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" className="h-9 rounded-lg text-xs font-semibold" asChild>
                <Link to="/marketing/configuracoes">Metas e automações</Link>
              </Button>
              <Button variant="outline" size="sm" className="h-9 rounded-lg text-xs" asChild>
                <Link to="/ads/metas-alertas">Metas e alertas</Link>
              </Button>
            </div>
          </div>
        </SettingsHubSection>
      </div>
      ) : null}

      {/* Plano | Segurança */}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
        {!isPortalNav ? (
          ctx?.parentOrganization ? (
          <SettingsHubSection
            kicker="Assinatura"
            title="Plano e limites"
            description="Cotas e faturação são definidas pela empresa principal."
          >
            <div className="p-4 text-sm leading-relaxed text-muted-foreground md:p-5">
              <p>
                Plano, faturação e cotas da rede são definidos pela{" "}
                <span className="font-medium text-foreground">matriz</span>. Em caso de dúvida, fale com o administrador
                da empresa principal.
              </p>
            </div>
          </SettingsHubSection>
        ) : (
          <SettingsHubSection
            kicker="Assinatura"
            title="Plano e limites"
            description="Consumo atual face ao que o plano permite."
          >
            <div className="p-4 md:flex md:items-start md:justify-between md:gap-6 md:p-5">
              <div className="min-w-0 flex-1 space-y-0">
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
                  label="Workspaces"
                  value={
                    usage && limits
                      ? `${usage.childOrganizations} / ${formatPlanLimit(limits.maxChildOrganizations, { zeroMeansNotIncluded: true })}`
                      : "—"
                  }
                />
                {ctx?.limitsHaveOverrides ? (
                  <p className="flex items-center gap-1.5 pt-2 text-xs font-medium text-primary">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Limites customizados
                  </p>
                ) : null}
              </div>
              <div className="mt-4 flex shrink-0 flex-col gap-2 md:mt-0">
                <Button size="sm" className="h-9 rounded-lg text-xs font-semibold whitespace-nowrap" asChild>
                  <Link to="/configuracoes/empresa">Gerir plano</Link>
                </Button>
                {canAccessMatrizResellerNav(authUser ?? null, memberships) ? (
                  <Button variant="outline" size="sm" className="h-9 rounded-lg text-xs whitespace-nowrap" asChild>
                    <Link to="/revenda">Matriz e filiais</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </SettingsHubSection>
        )
        ) : (
          <SettingsHubSection
            kicker="Conta"
            title="O seu acesso"
            description="Perfil de consulta — alterações estruturais ficam a cargo da agência."
          >
            <div className="p-4 text-sm leading-relaxed text-muted-foreground md:p-5">
              <p>
                Este perfil é para <span className="font-medium text-foreground">consultar resultados</span>. Plano,
                integrações e metas são tratados pela agência. Em dúvidas, contacte o responsável pela conta.
              </p>
            </div>
          </SettingsHubSection>
        )}

        <SettingsHubSection
          kicker="Acesso"
          title="Segurança"
          description="Sessão atual, credenciais e terminar login neste dispositivo."
        >
          <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:p-5">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{authUser?.name ?? "—"}</p>
              <p className="text-xs text-muted-foreground">{authUser?.email ?? "—"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="h-9 rounded-lg text-xs" asChild>
                <Link to="/perfil">Perfil</Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-lg text-xs"
                type="button"
                onClick={() => setPasswordOpen(true)}
              >
                Alterar senha
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="h-9 rounded-lg text-xs"
                type="button"
                onClick={() => {
                  logout();
                  navigate("/login", { replace: true });
                }}
              >
                Terminar sessão
              </Button>
            </div>
          </div>
        </SettingsHubSection>
      </div>

      <div className="border-t border-border/45 pt-8">
        <SettingsHelpAccordion />
      </div>
    </div>
  );
}
