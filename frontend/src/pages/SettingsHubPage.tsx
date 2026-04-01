import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { formatPageTitle, usePageTitle } from "@/hooks/usePageTitle";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, Copy, LayoutDashboard, LineChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SettingsHeader,
  SettingsHelpAccordion,
  SettingsHubSection,
  SettingsHubIntegrationRow,
  SettingsChangePasswordDialog,
  HubStat,
  HubRow,
} from "@/components/settings";
import { OrganizationSwitcher } from "@/components/layout/OrganizationSwitcher";
import { StatusBadge } from "@/components/premium";
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
    <div className="mx-auto w-full max-w-[min(100%,100rem)] space-y-5 pb-12">
      <SettingsHeader organizationName={displayName} organizationSlug={displaySlug} />

      <SettingsChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />

      {loadError ? (
        <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/[0.06] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-destructive">{loadError}</p>
          <Button variant="outline" size="sm" className="h-8 shrink-0 rounded-md text-xs" onClick={() => void load()}>
            Tentar novamente
          </Button>
        </div>
      ) : null}

      {/* Conta — largura total, denso */}
      <section aria-labelledby="hub-hero-heading">
        <div className="overflow-hidden rounded-lg border border-border/60 bg-card/80 shadow-sm">
          <div className="p-4 md:p-5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Conta</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 id="hub-hero-heading" className="text-base font-semibold tracking-tight text-foreground md:text-lg">
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
            <p className="mt-0.5 text-xs text-muted-foreground">
              {ctx?.parentOrganization ? (
                <>
                  Filha de <span className="font-medium text-foreground">{ctx.parentOrganization.name}</span>
                </>
              ) : (
                "Workspace principal"
              )}
            </p>

            <div className="mt-4 grid gap-4 lg:grid-cols-12 lg:gap-5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:col-span-7">
                <HubStat label="Plano" value={loading && !ctx ? "…" : planName} />
                <HubStat label="Slug" value={slugValue} />
                <HubStat label="ID suporte" value={idValue} className="col-span-2 sm:col-span-1" />
              </div>

              <div className="flex flex-col gap-3 border-t border-border/50 pt-4 lg:col-span-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                <div>
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">Workspace</p>
                  <div className="mt-1.5 max-w-md">
                    <OrganizationSwitcher />
                  </div>
                  {!canSwitchWorkspace ? <p className="mt-1 text-[11px] text-muted-foreground">Único disponível.</p> : null}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" className="h-8 rounded-md text-xs" asChild>
                    <Link to="/configuracoes/empresa">
                      {isPortalNav || isAgencyBranchNav ? "Ver empresa" : "Editar empresa"}
                    </Link>
                  </Button>
                  {!agencySlimHub ? (
                    <Button variant="outline" size="sm" className="h-8 rounded-md text-xs" asChild>
                      <Link to="/marketing" className="inline-flex items-center gap-1.5">
                        <LineChart className="h-3.5 w-3.5" />
                        Painel ADS
                      </Link>
                    </Button>
                  ) : null}
                  <Button variant="secondary" size="sm" className="h-8 rounded-md text-xs" asChild>
                    <Link to="/dashboard" className="inline-flex items-center gap-1.5">
                      <LayoutDashboard className="h-3.5 w-3.5" />
                      Dashboard
                    </Link>
                  </Button>
                  {showAdminHubLink ? (
                    <Button variant="outline" size="sm" className="h-8 rounded-md text-xs" asChild>
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
        <SettingsHubSection kicker="Operação" title="Equipe e clientes">
          <div
            className={
              agencySlimHub || isClientWorkspaceNav
                ? "p-3 md:p-4"
                : "grid lg:grid-cols-2 lg:divide-x lg:divide-border/50"
            }
          >
            {!agencySlimHub ? (
              <div className={isClientWorkspaceNav ? "" : "p-3 md:p-4"}>
                <h3 className="text-xs font-semibold text-foreground">Equipe</h3>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <HubStat label="Membros" value={usage ? String(usage.directMembers) : loading ? "…" : "—"} />
                  <HubStat label="Convites" value={pendingInvites != null ? String(pendingInvites) : "—"} />
                </div>
                {previewMembers.length > 0 ? (
                  <ul className="mt-2 space-y-0.5 border-t border-border/40 pt-2">
                    {previewMembers.map((m) => (
                      <li key={m.membershipId} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate font-medium">{m.name}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{ROLE_QUICK[m.role] ?? m.role}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">{loading ? "…" : "Nenhum membro."}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button size="sm" className="h-8 rounded-md text-xs" asChild>
                    <Link to="/usuarios">Equipe</Link>
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 rounded-md text-xs" asChild>
                    <Link to="/usuarios">Convidar</Link>
                  </Button>
                </div>
              </div>
            ) : null}
            {!isClientWorkspaceNav ? (
              <div className={agencySlimHub ? "" : "p-3 md:p-4"}>
                <h3 className="text-xs font-semibold text-foreground">Clientes</h3>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <HubStat
                    label="Cadastrados"
                    value={
                      clients != null ? String(clients.length) : usage ? String(usage.clientAccounts) : loading ? "…" : "—"
                    }
                  />
                  <HubStat label="Limite" value={limits ? formatPlanCap(limits.maxClientAccounts) : "—"} />
                </div>
                {previewClients.length > 0 ? (
                  <ul className="mt-2 space-y-0.5 border-t border-border/40 pt-2">
                    {previewClients.map((c) => (
                      <li key={c.id} className="truncate text-xs font-medium">
                        {c.name}
                      </li>
                    ))}
                  </ul>
                ) : !loading ? (
                  <p className="mt-2 text-xs text-muted-foreground">Nenhum cliente.</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {!agencySlimHub ? (
                    <Button size="sm" className="h-8 rounded-md text-xs" asChild>
                      <Link to="/projetos">Cadastro</Link>
                    </Button>
                  ) : null}
                  <Button
                    variant={agencySlimHub ? "default" : "outline"}
                    size="sm"
                    className="h-8 rounded-md text-xs"
                    asChild
                  >
                    <Link to="/clientes">{agencySlimHub ? "Clientes" : "Agência"}</Link>
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
        headerRight={
          integEnabled ? (
            <Link to="/marketing/integracoes" className="text-xs font-medium text-primary hover:underline">
              Central →
            </Link>
          ) : null
        }
      >
        {!integEnabled ? (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground sm:px-4">Indisponível no plano.</p>
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
      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <SettingsHubSection kicker="Performance" title="Marketing" className="h-full">
          <div className="p-3 md:p-4">
            <div className="grid grid-cols-2 gap-2">
              <HubStat label="Modo" value={goalModeLabel(marketing)} />
              <HubStat
                label="Status"
                value={marketing ? (marketing.alertsEnabled ? "Alertas on" : "Alertas off") : "—"}
              />
              <HubStat label="CPL meta" value={marketing ? formatBrl(marketing.targetCpaBrl) : "—"} />
              <HubStat label="ROAS meta" value={marketing?.targetRoas != null ? `${marketing.targetRoas}×` : "—"} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Button size="sm" className="h-8 rounded-md text-xs" asChild>
                <Link to="/marketing/configuracoes">Metas por canal</Link>
              </Button>
              {!agencySlimHub ? (
                <Button variant="outline" size="sm" className="h-8 rounded-md text-xs" asChild>
                  <Link to="/marketing">Painel ADS</Link>
                </Button>
              ) : null}
            </div>
          </div>
        </SettingsHubSection>

        <SettingsHubSection kicker="WhatsApp" title="Automações" className="h-full">
          <div className="p-3 md:p-4">
            <div className="mb-2">
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
            <div className="grid grid-cols-3 gap-2">
              <HubStat label="Automações" value={String(autoCount)} />
              <HubStat label="Alertas" value={String(waRulesCount)} />
              <HubStat label="Último envio" value={formatSync(marketing?.ativaCrmLastAlertSentAt ?? null)} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Button size="sm" className="h-8 rounded-md text-xs" asChild>
                <Link to="/marketing/configuracoes">Metas e automações</Link>
              </Button>
              <Button variant="outline" size="sm" className="h-8 rounded-md text-xs" asChild>
                <Link to="/ads/metas-alertas">Alertas e regras</Link>
              </Button>
            </div>
          </div>
        </SettingsHubSection>
      </div>
      ) : null}

      {/* Plano | Segurança */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        {!isPortalNav ? (
          ctx?.parentOrganization ? (
          <SettingsHubSection kicker="Assinatura" title="Plano e limites">
            <div className="p-3 text-sm leading-relaxed text-muted-foreground md:p-4">
              <p>
                Plano, faturação e cotas da rede são definidos pela{" "}
                <span className="font-medium text-foreground">matriz</span>. Em caso de dúvida, fale com o administrador
                da empresa principal.
              </p>
            </div>
          </SettingsHubSection>
        ) : (
          <SettingsHubSection kicker="Assinatura" title="Plano e limites">
            <div className="p-3 md:flex md:items-start md:justify-between md:gap-4 md:p-4">
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
              <div className="mt-3 flex shrink-0 flex-col gap-1.5 md:mt-0">
                <Button size="sm" className="h-8 rounded-md text-xs whitespace-nowrap" asChild>
                  <Link to="/configuracoes/empresa">Plano</Link>
                </Button>
                {canAccessMatrizResellerNav(authUser ?? null, memberships) ? (
                  <Button variant="outline" size="sm" className="h-8 rounded-md text-xs whitespace-nowrap" asChild>
                    <Link to="/revenda">Matriz e filiais</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </SettingsHubSection>
        )
        ) : (
          <SettingsHubSection kicker="Conta" title="O seu acesso">
            <div className="p-3 text-sm leading-relaxed text-muted-foreground md:p-4">
              <p>
                Este perfil é para <span className="font-medium text-foreground">consultar resultados</span>. Plano,
                integrações e metas são tratados pela agência. Em dúvidas, contacte o responsável pela conta.
              </p>
            </div>
          </SettingsHubSection>
        )}

        <SettingsHubSection kicker="Acesso" title="Segurança">
          <div className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between md:p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{authUser?.name ?? "—"}</p>
              <p className="text-xs text-muted-foreground">{authUser?.email ?? "—"}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button variant="outline" size="sm" className="h-8 rounded-md text-xs" asChild>
                <Link to="/perfil">Perfil</Link>
              </Button>
              <Button variant="outline" size="sm" className="h-8 rounded-md text-xs" type="button" onClick={() => setPasswordOpen(true)}>
                Senha
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="h-8 rounded-md text-xs"
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

      <div className="max-w-2xl border-t border-border/40 pt-5">
        <SettingsHelpAccordion />
      </div>
    </div>
  );
}
