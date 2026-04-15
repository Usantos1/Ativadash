import { useCallback, useEffect, useState, type ReactNode } from "react";
import { formatPageTitle, usePageTitle } from "@/hooks/usePageTitle";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SettingsHeader,
  settingsHubPanelClass,
  SettingsHubSection,
  SettingsChangePasswordDialog,
  HubStat,
  HubRow,
} from "@/components/settings";
import { StatusBadge } from "@/components/premium";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import {
  fetchOrganizationContext,
  formatPlanCap,
  formatPlanLimit,
  type OrganizationContext,
} from "@/lib/organization-api";

export function SettingsHubPage() {
  usePageTitle(formatPageTitle(["Configurações"]));
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.user);
  const authOrg = authUser?.organization;
  const logout = useAuthStore((s) => s.logout);

  const [ctx, setCtx] = useState<OrganizationContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      setCtx(await fetchOrganizationContext());
    } catch {
      setLoadError("Não foi possível carregar as configurações.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const displayName = ctx?.name ?? authOrg?.name;
  const displaySlug = ctx?.slug ?? authOrg?.slug;
  const limits = ctx?.limits;
  const usage = ctx?.usage;
  const planName = ctx?.subscription?.plan?.name ?? ctx?.plan?.name ?? "—";

  const subStatus = ctx?.subscription?.status;
  const accountStatusLabel =
    subStatus === "active" || subStatus === "trialing" ? "Ativa"
      : subStatus === "past_due" || subStatus === "unpaid" ? "Atenção"
        : subStatus ? subStatus : "—";

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(label);
      window.setTimeout(() => setCopiedField(null), 1800);
    } catch { /* ignore */ }
  }

  const slugValue: ReactNode = displaySlug ? (
    <span className="flex flex-wrap items-center gap-1 font-mono text-xs">
      {displaySlug}
      <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-1.5 text-[11px]" onClick={() => void copyText("slug", displaySlug)}>
        <Copy className="h-3 w-3" />
        {copiedField === "slug" ? "OK" : "Copiar"}
      </Button>
    </span>
  ) : "—";

  const idValue: ReactNode = ctx?.id != null ? (
    <span className="flex flex-wrap items-center gap-1 font-mono text-[11px]">
      <span className="max-w-[140px] truncate">{ctx.id}</span>
      <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-1.5 text-[11px]" onClick={() => void copyText("id", ctx.id)}>
        <Copy className="h-3 w-3" />
        {copiedField === "id" ? "OK" : "Copiar"}
      </Button>
    </span>
  ) : loading ? "…" : "—";

  return (
    <div className="w-full min-w-0 space-y-5 pb-12">
      <SettingsHeader
        organizationName={displayName}
        organizationSlug={displaySlug}
        actions={
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" disabled={loading} onClick={() => void load()}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
            Atualizar
          </Button>
        }
      />

      <SettingsChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />

      {loadError ? (
        <div className="flex flex-col gap-2 rounded-xl border border-destructive/35 bg-destructive/[0.06] p-3 sm:flex-row sm:items-center sm:justify-between" role="alert">
          <p className="text-sm text-destructive">{loadError}</p>
          <Button variant="outline" size="sm" className="h-8 shrink-0 text-xs" onClick={() => void load()}>Repetir</Button>
        </div>
      ) : null}

      {/* ── Empresa ── */}
      <section aria-labelledby="hub-empresa" className={settingsHubPanelClass}>
        <div className="space-y-3 p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="hub-empresa" className="text-sm font-semibold text-foreground">{displayName ?? "—"}</h2>
            {accountStatusLabel === "Ativa" ? (
              <StatusBadge tone="healthy" dot>{accountStatusLabel}</StatusBadge>
            ) : accountStatusLabel !== "—" ? (
              <StatusBadge tone="alert" dot>{accountStatusLabel}</StatusBadge>
            ) : null}
            {ctx?.parentOrganization ? (
              <span className="text-xs text-muted-foreground">
                · Vinculada a <span className="font-medium text-foreground">{ctx.parentOrganization.name}</span>
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-3">
            <HubStat label="Plano" value={loading && !ctx ? "…" : planName} />
            <HubStat label="Slug" value={slugValue} />
            <HubStat label="ID suporte" value={idValue} className="min-[420px]:col-span-2 lg:col-span-1" />
          </div>

          <div className="flex flex-wrap gap-1.5 border-t border-border/50 pt-3">
            <Button size="sm" className="h-8 text-xs" asChild>
              <Link to="/configuracoes/empresa">Dados da empresa</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Plano e consumo ── */}
      {ctx?.parentOrganization ? (
        <SettingsHubSection kicker="Plano" title="Limites">
          <div className="p-3 text-sm text-muted-foreground sm:p-4">
            Cotas e faturação vêm da empresa principal. Fale com o administrador.
          </div>
        </SettingsHubSection>
      ) : (
        <SettingsHubSection kicker="Plano" title="Consumo e limites">
          <div className="p-3 sm:p-4">
            <HubRow label="Plano" value={loading && !ctx ? "…" : planName} />
            <HubRow label="Usuários" value={usage && limits ? `${usage.directMembers} / ${formatPlanCap(limits.maxUsers)}` : "—"} />
            <HubRow label="Integrações" value={usage && limits ? `${usage.integrations} / ${formatPlanCap(limits.maxIntegrations)}` : "—"} />
            <HubRow label="Clientes (workspaces)" value={usage && limits ? `${usage.childOrganizations} / ${formatPlanLimit(limits.maxChildOrganizations, { zeroMeansNotIncluded: true })}` : "—"} />
            <HubRow label="Clientes comerciais" value={usage && limits ? `${usage.clientAccounts} / ${formatPlanCap(limits.maxClientAccounts)}` : "—"} />
            {ctx?.limitsHaveOverrides ? (
              <p className="flex items-center gap-1.5 pt-2 text-xs font-medium text-primary">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Limites personalizados
              </p>
            ) : null}
            <div className="mt-3">
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <ExternalLink className="h-3 w-3" />
                Precisa de mais? Fale com a equipe
              </Button>
            </div>
          </div>
        </SettingsHubSection>
      )}

      {/* ── Segurança ── */}
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
            <Button variant="destructive" size="sm" className="h-8 text-xs" type="button" onClick={() => { logout(); navigate("/login", { replace: true }); }}>
              Sair
            </Button>
          </div>
        </div>
      </SettingsHubSection>

      {/* ── Atalhos rápidos ── */}
      <section className={cn(settingsHubPanelClass, "p-3 sm:p-4")}>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Acesso rápido</p>
        <div className="flex flex-wrap gap-1.5">
          <Button variant="outline" size="sm" className="h-8 text-xs" asChild><Link to="/usuarios">Equipe</Link></Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" asChild><Link to="/clientes">Clientes</Link></Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" asChild><Link to="/marketing/integracoes">Integrações</Link></Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" asChild><Link to="/ads/metas-alertas">Automação e Metas</Link></Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" asChild><Link to="/dashboard">Dashboard</Link></Button>
        </div>
      </section>
    </div>
  );
}
