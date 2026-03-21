import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, Plug, MessageCircle, Megaphone, Loader2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IntegrationCard } from "@/components/integrations/IntegrationCard";
import { EmptyState } from "@/components/ui/empty-state";
import {
  fetchIntegrations,
  getGoogleAdsAuthUrl,
  getMetaAdsAuthUrl,
  disconnectIntegration as disconnectApi,
  patchIntegrationClientAccount,
  type IntegrationFromApi,
} from "@/lib/integrations-api";
import { fetchClients, type ClientAccount } from "@/lib/workspace-api";
import {
  fetchMarketingSettings,
  saveMarketingSettings,
  sendAtivaCrmTestMessage,
  type UpdateMarketingSettingsPayload,
} from "@/lib/marketing-settings-api";
import { IX } from "@/lib/integrationsCopy";
import { AnalyticsPageHeader } from "@/components/analytics/AnalyticsPageHeader";
import { AnalyticsSection } from "@/components/analytics/AnalyticsSection";
import { Skeleton } from "@/components/ui/skeleton";
import type { IntegrationHealth } from "@/components/integrations/IntegrationCard";

export type IntegrationId =
  | "google-ads"
  | "meta"
  | "whatsapp"
  | "hotmart"
  | "kiwify"
  | "eduzz"
  | "braip"
  | "monetizze"
  | "hubla"
  | "ticto"
  | "guru"
  | "greenn"
  | "pagar-me"
  | "webhooks";

type IntegrationCategory = "media" | "crm" | "checkout" | "webhooks" | "other";

const CATEGORY_SECTION_TITLE: Record<IntegrationCategory, string> = {
  media: "M?dia paga",
  crm: "CRM e mensageria",
  checkout: "Checkout, afiliados e pagamentos",
  webhooks: "Webhooks e automa??o",
  other: "Outras plataformas",
};

interface IntegrationDef {
  id: IntegrationId;
  name: string;
  slug: string;
  logoSrc?: string;
  available: boolean;
  category: IntegrationCategory;
}

const AVAILABLE_SLUGS = new Set<string>(["google-ads", "meta"]);

const INTEGRATION_DEFS: IntegrationDef[] = [
  { id: "google-ads", name: "Google Ads", slug: "google-ads", available: true, category: "media" },
  { id: "meta", name: "Meta Ads", slug: "meta", logoSrc: "/logos/meta.svg", available: true, category: "media" },
  { id: "whatsapp", name: "WhatsApp", slug: "whatsapp", available: false, category: "crm" },
  { id: "hotmart", name: "Hotmart", slug: "hotmart", available: false, category: "checkout" },
  { id: "kiwify", name: "Kiwify", slug: "kiwify", available: false, category: "checkout" },
  { id: "eduzz", name: "Eduzz", slug: "eduzz", available: false, category: "checkout" },
  { id: "braip", name: "Braip", slug: "braip", available: false, category: "checkout" },
  { id: "monetizze", name: "Monetizze", slug: "monetizze", available: false, category: "checkout" },
  { id: "hubla", name: "Hubla", slug: "hubla", available: false, category: "checkout" },
  { id: "ticto", name: "Ticto", slug: "ticto", available: false, category: "checkout" },
  { id: "guru", name: "Guru", slug: "guru", available: false, category: "checkout" },
  { id: "greenn", name: "Greenn", slug: "greenn", available: false, category: "checkout" },
  { id: "pagar-me", name: "Pagar.me", slug: "pagar-me", available: false, category: "checkout" },
  { id: "webhooks", name: "Webhooks personalizados", slug: "webhooks", available: false, category: "webhooks" },
];

const ATIVA_CRM_CONNECTIONS_URL = "https://app.ativacrm.com/connections";

function healthFromLastSync(iso: string | null | undefined): IntegrationHealth {
  if (!iso) return "idle";
  const age = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(age)) return "idle";
  if (age < 72 * 3600 * 1000) return "healthy";
  return "warning";
}

function formatLastSync(iso: string | null): string | undefined {
  if (!iso) return undefined;
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    return sameDay
      ? `${IX.hojeAsPrefix}${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
      : d.toLocaleDateString("pt-BR");
  } catch {
    return undefined;
  }
}

function AtivaCrmIntegrationPanel({
  onNotify,
}: {
  onNotify: (m: { type: "success" | "error"; text: string }) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [phone, setPhone] = useState("");
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [tokenConfigured, setTokenConfigured] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localOk, setLocalOk] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchMarketingSettings()
      .then((s) => {
        if (cancelled) return;
        setPhone(s.ativaCrmNotifyPhone ?? "");
        setAlertsEnabled(s.ativaCrmAlertsEnabled);
        setTokenConfigured(s.ativaCrmTokenConfigured);
        setTokenInput("");
      })
      .catch(() => {
        if (!cancelled) setLocalError(IX.errCarregarCfg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    setLocalOk(null);
    setSaving(true);
    try {
      const payload: UpdateMarketingSettingsPayload = {
        ativaCrmNotifyPhone: phone.trim() === "" ? null : phone.trim(),
        ativaCrmAlertsEnabled: alertsEnabled,
      };
      if (tokenInput.trim() !== "") {
        payload.ativaCrmApiToken = tokenInput.trim();
      }
      const next = await saveMarketingSettings(payload);
      setTokenConfigured(next.ativaCrmTokenConfigured);
      setTokenInput("");
      setLocalOk(IX.cfgSalvas);
      onNotify({ type: "success", text: IX.ativaCrmCfgSalvas });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar.";
      setLocalError(msg);
      onNotify({ type: "error", text: msg });
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!confirm("Remover o token Ativa CRM e desligar alertas por WhatsApp?")) return;
    setLocalError(null);
    setLocalOk(null);
    setRemoving(true);
    try {
      await saveMarketingSettings({
        ativaCrmApiToken: null,
        ativaCrmAlertsEnabled: false,
        ativaCrmNotifyPhone: null,
      });
      setTokenConfigured(false);
      setTokenInput("");
      setPhone("");
      setAlertsEnabled(false);
      setLocalOk(IX.integracaoRemovida);
      onNotify({ type: "success", text: "Ativa CRM desconectado." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao remover.";
      setLocalError(msg);
    } finally {
      setRemoving(false);
    }
  }

  async function handleTest() {
    setLocalError(null);
    setLocalOk(null);
    setTesting(true);
    try {
      const r = await sendAtivaCrmTestMessage();
      if (r.ok) {
        setLocalOk(r.message);
        onNotify({ type: "success", text: r.message });
      } else {
        setLocalError(r.message);
        onNotify({ type: "error", text: r.message });
      }
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
      </div>
    );
  }

  return (
    <Card className="min-w-0 border-border/80 shadow-sm">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2 text-primary">
          <MessageCircle className="h-5 w-5" aria-hidden />
          <CardTitle className="text-lg">{IX.painelIntegracaoTitle}</CardTitle>
        </div>
        <CardDescription>
          Envio pelo Ativa CRM para{" "}
          <strong className="font-medium text-foreground">alertas de marketing</strong> (CPA, ROAS){" "}
          {IX.painelPeriodoTail}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-5">
          {localError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {localError}
            </div>
          )}
          {localOk && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-200">
              {localOk}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="ativacrm-token">Token de acesso Ativa CRM</Label>
            <Input
              id="ativacrm-token"
              type="password"
              autoComplete="off"
              placeholder={tokenConfigured ? IX.tokenPhOpcional : IX.tokenPhCole}
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              className="min-w-0 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Obtenha o token em{" "}
              <a
                href={ATIVA_CRM_CONNECTIONS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                app.ativacrm.com/connections
              </a>
              {IX.tokenAfterLink}
              <strong className="font-medium text-foreground">{IX.conexoesMenu}</strong>
              {IX.tokenAfterConexoes}
              <strong className="font-medium text-foreground">Token</strong>.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ativacrm-phone">WhatsApp para alertas (com DDD)</Label>
            <Input
              id="ativacrm-phone"
              type="tel"
              inputMode="tel"
              placeholder="Ex.: 11999999999 ou 5511999999999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="min-w-0 max-w-md"
            />
            <p className="text-xs text-muted-foreground">{IX.numeroAvisos}</p>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/80 bg-muted/20 p-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-border"
              checked={alertsEnabled}
              onChange={(e) => setAlertsEnabled(e.target.checked)}
            />
            <span className="text-sm">
              <span className="font-medium text-foreground">{IX.alertasCriticos}</span>
              <span className="mt-0.5 block text-muted-foreground">{IX.periodoMarketingFull}</span>
            </span>
          </label>

          <div
            className="flex gap-2 rounded-lg border border-amber-200/80 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
            role="status"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <p>
              <strong className="font-semibold">Importante:</strong> configure um{" "}
              <strong className="font-medium">{IX.whatsappPadrao}</strong> no Ativa CRM para que as mensagens sejam
              entregues corretamente.
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            API:{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">POST https://api.ativacrm.com/api/messages/send</code>{" "}
            com <code className="rounded bg-muted px-1 py-0.5 text-[11px]">Authorization: Bearer {'{token}'}</code> e corpo{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">{'{ number, body }'}</code>.
          </p>

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {IX.salvarCfg}
            </Button>
            <Button type="button" variant="outline" disabled={testing || !tokenConfigured} onClick={handleTest}>
              {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Enviar mensagem de teste
            </Button>
            {tokenConfigured ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={removing}
                onClick={handleRemove}
              >
                {removing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {IX.removerIntegracao}
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function Integrations() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [list, setList] = useState<IntegrationFromApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [clients, setClients] = useState<ClientAccount[]>([]);

  const refetchIntegrations = useCallback(async () => {
    try {
      const data = await fetchIntegrations();
      setList(data);
    } catch {
      setList([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchIntegrations();
        if (!cancelled) setList(data);
      } catch {
        if (!cancelled) setList([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    fetchClients()
      .then((c) => {
        if (!cancelled) setClients(c);
      })
      .catch(() => {
        if (!cancelled) setClients([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected === "google-ads") {
      setMessage({ type: "success", text: "Google Ads conectado com sucesso." });
      setSearchParams((p) => {
        p.delete("connected");
        p.delete("error");
        return p;
      }, { replace: true });
      fetchIntegrations().then(setList);
    } else if (connected === "meta-ads") {
      setMessage({ type: "success", text: "Meta Ads conectado com sucesso." });
      setSearchParams((p) => {
        p.delete("connected");
        p.delete("error");
        return p;
      }, { replace: true });
      fetchIntegrations().then(setList);
    } else if (error) {
      const msg =
        error === "missing_code_or_state"
          ? IX.authIncompleta
          : error === "invalid_state"
            ? IX.sessaoExpirada
            : error === "plan_limit_integrations"
              ? IX.planLimitIntegrations
              : error === "exchange_failed"
                ? "Falha ao conectar. Tente novamente."
                : "Erro ao conectar.";
      setMessage({ type: "error", text: msg });
      setSearchParams((p) => {
        p.delete("connected");
        p.delete("error");
        return p;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const connectedBySlug = new Map(list.filter((i) => i.status === "connected").map((i) => [i.slug, i]));

  const handleConnectGoogleAds = async () => {
    setConnecting(true);
    setMessage(null);
    try {
      const url = await getGoogleAdsAuthUrl();
      window.location.href = url;
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : IX.naoFoiPossivelConexao });
      setConnecting(false);
    }
  };

  const handleConnectMetaAds = async () => {
    setConnecting(true);
    setMessage(null);
    try {
      const url = await getMetaAdsAuthUrl();
      window.location.href = url;
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : IX.naoFoiPossivelConexao });
      setConnecting(false);
    }
  };

  const handleClientLink = async (integrationId: string, clientAccountId: string | null) => {
    setMessage(null);
    try {
      await patchIntegrationClientAccount(integrationId, clientAccountId);
      setList((prev) =>
        prev.map((i) => (i.id === integrationId ? { ...i, clientAccountId } : i))
      );
      setMessage({ type: "success", text: "V?nculo com cliente atualizado." });
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Erro ao salvar v?nculo." });
    }
  };

  const handleDisconnect = async (id: string) => {
    setMessage(null);
    try {
      await disconnectApi(id);
      setList((prev) => prev.filter((i) => i.id !== id));
      setMessage({ type: "success", text: IX.integracaoDesvinculada });
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Erro ao desvincular." });
    }
  };

  const filtered = INTEGRATION_DEFS.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
  const filteredNow = filtered.filter((d) => AVAILABLE_SLUGS.has(d.slug));
  const filteredLater = filtered.filter((d) => !AVAILABLE_SLUGS.has(d.slug));

  const laterByCategory = (() => {
    const m = new Map<IntegrationCategory, IntegrationDef[]>();
    for (const d of filteredLater) {
      const arr = m.get(d.category) ?? [];
      arr.push(d);
      m.set(d.category, arr);
    }
    return m;
  })();

  const categoryOrder: IntegrationCategory[] = ["media", "crm", "checkout", "webhooks", "other"];

  function renderCard(def: IntegrationDef) {
    const connected = connectedBySlug.get(def.slug);
    const connectedId = connected?.id;
    const isConnectingGoogle = def.slug === "google-ads" && connecting;
    const isConnectingMeta = def.slug === "meta" && connecting;
    const connectingState = isConnectingGoogle || isConnectingMeta;
    const onConnect =
      def.slug === "google-ads" && !connected && !connectingState
        ? handleConnectGoogleAds
        : def.slug === "meta" && !connected && !connectingState
          ? handleConnectMetaAds
          : undefined;
    const clientFooter =
      connected && connectedId && (def.slug === "google-ads" || def.slug === "meta") ? (
        <label className="flex flex-col gap-1.5 font-medium text-foreground">
          <span className="text-muted-foreground">Vincular cliente comercial</span>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
            value={connected.clientAccountId ?? ""}
            onChange={(ev) => {
              const v = ev.target.value;
              void handleClientLink(connectedId, v === "" ? null : v);
            }}
          >
            <option value="">Nenhum</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      ) : undefined;

    const clientName = connected?.clientAccountId
      ? (clients.find((c) => c.id === connected.clientAccountId)?.name ?? null)
      : null;

    const dataSourceLabel =
      def.slug === "google-ads"
        ? "Google Ads API"
        : def.slug === "meta"
          ? "Meta Marketing API"
          : def.category === "checkout"
            ? "Plataforma de vendas"
            : def.slug === "webhooks"
              ? "HTTPS / payloads JSON"
              : def.category === "crm"
                ? "Mensageria / CRM"
                : "?";

    return (
      <IntegrationCard
        key={def.id}
        name={def.name}
        logoSrc={def.logoSrc}
        connected={!!connected}
        lastSync={connected ? formatLastSync(connected.lastSyncAt) : undefined}
        lastSyncAt={connected?.lastSyncAt}
        available={def.available}
        connecting={connectingState}
        onConnect={onConnect}
        onDisconnect={connectedId ? () => handleDisconnect(connectedId) : undefined}
        categoryLabel={CATEGORY_SECTION_TITLE[def.category]}
        typeLabel={def.available ? "Pronta para uso" : "Roadmap"}
        dataSourceLabel={dataSourceLabel}
        accountLabel={connected ? connected.platform : undefined}
        clientName={clientName}
        health={connected ? healthFromLastSync(connected.lastSyncAt) : undefined}
        errorCount={0}
        onConfigure={
          connected && (def.slug === "google-ads" || def.slug === "meta")
            ? () => navigate("/marketing/configuracoes")
            : undefined
        }
        onTest={
          connected && (def.slug === "google-ads" || def.slug === "meta")
            ? () => {
                void refetchIntegrations();
                setMessage({
                  type: "success",
                  text: "Conex?o verificada ? lista atualizada. Confira a data de sincroniza??o no card.",
                });
              }
            : undefined
        }
        footer={clientFooter}
      />
    );
  }

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <AnalyticsPageHeader
        eyebrow="Conex?es"
        title={IX.pageTitle}
        subtitle={`${IX.introPublicidadeWhatsapp}WhatsApp (CRM).`}
        actions={
          <div className="relative w-full min-w-0 sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={IX.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-full border-border/70 bg-background/90 pl-9 shadow-sm"
            />
          </div>
        }
      />

      {message && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="min-w-0 overflow-hidden rounded-2xl border border-border/55 bg-card p-4 shadow-[var(--shadow-surface)] ring-1 ring-black/[0.02] dark:ring-white/[0.03] sm:p-6">
        <Tabs defaultValue="ads" className="min-w-0 space-y-4">
          <TabsList className="grid h-auto w-full min-w-0 grid-cols-2 gap-1 rounded-xl border border-border/50 bg-muted/25 p-1 shadow-inner sm:inline-flex sm:w-auto sm:max-w-full">
            <TabsTrigger
              value="ads"
              className="gap-2 rounded-lg px-3 py-2 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm sm:text-sm"
            >
              <Megaphone className="h-4 w-4 shrink-0" aria-hidden />
              Publicidade
            </TabsTrigger>
            <TabsTrigger
              value="ativacrm"
              className="gap-2 rounded-lg px-3 py-2 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm sm:text-sm"
            >
              <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
              WhatsApp (CRM)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ads" className="mt-0 min-w-0 focus-visible:outline-none">
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Skeleton className="h-52 rounded-xl" />
                <Skeleton className="h-52 rounded-xl" />
              </div>
            ) : (
              <>
                <div className="space-y-6">
                  {filteredNow.length > 0 && (
                    <AnalyticsSection title={IX.disponiveisAgora} description="OAuth e leitura de campanhas no per?odo." dense>
                      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
                        {filteredNow.map(renderCard)}
                      </div>
                    </AnalyticsSection>
                  )}

                  {categoryOrder.map((cat) => {
                    const defs = laterByCategory.get(cat);
                    if (!defs?.length) return null;
                    return (
                      <AnalyticsSection
                        key={cat}
                        title={`${CATEGORY_SECTION_TITLE[cat]} ? em breve`}
                        description={
                          cat === "crm"
                            ? `${IX.roadmapWhatsappAba}WhatsApp (CRM) ${IX.nestaPagina}`
                            : "Integração prevista no roadmap ? entre em contato para priorizar."
                        }
                        dense
                      >
                        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {defs.map(renderCard)}
                        </div>
                      </AnalyticsSection>
                    );
                  })}
                </div>
                {filtered.length === 0 && (
                  <EmptyState
                    icon={Plug}
                    title={IX.nenhumaTitulo}
                    description={`Nenhum resultado para "${search}".`}
                    className="min-h-[200px]"
                  />
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="ativacrm" className="mt-0 min-w-0 focus-visible:outline-none">
            <AtivaCrmIntegrationPanel onNotify={setMessage} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
