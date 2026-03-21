import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
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
  type IntegrationFromApi,
} from "@/lib/integrations-api";
import {
  fetchMarketingSettings,
  saveMarketingSettings,
  sendAtivaCrmTestMessage,
  type UpdateMarketingSettingsPayload,
} from "@/lib/marketing-settings-api";
import { IX } from "@/lib/integrationsCopy";

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

interface IntegrationDef {
  id: IntegrationId;
  name: string;
  slug: string;
  logoSrc?: string;
  available: boolean;
}

const AVAILABLE_SLUGS = new Set<string>(["google-ads", "meta"]);

const INTEGRATION_DEFS: IntegrationDef[] = [
  { id: "google-ads", name: "Google Ads", slug: "google-ads", available: true },
  { id: "meta", name: "Meta Ads", slug: "meta", logoSrc: "/logos/meta.svg", available: true },
  { id: "whatsapp", name: "WhatsApp", slug: "whatsapp", available: false },
  { id: "hotmart", name: "Hotmart", slug: "hotmart", available: false },
  { id: "kiwify", name: "Kiwify", slug: "kiwify", available: false },
  { id: "eduzz", name: "Eduzz", slug: "eduzz", available: false },
  { id: "braip", name: "Braip", slug: "braip", available: false },
  { id: "monetizze", name: "Monetizze", slug: "monetizze", available: false },
  { id: "hubla", name: "Hubla", slug: "hubla", available: false },
  { id: "ticto", name: "Ticto", slug: "ticto", available: false },
  { id: "guru", name: "Guru", slug: "guru", available: false },
  { id: "greenn", name: "Greenn", slug: "greenn", available: false },
  { id: "pagar-me", name: "Pagar.me", slug: "pagar-me", available: false },
  { id: "webhooks", name: "Webhooks personalizados", slug: "webhooks", available: false },
];

const ATIVA_CRM_CONNECTIONS_URL = "https://app.ativacrm.com/connections";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [list, setList] = useState<IntegrationFromApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [laterSectionOpen, setLaterSectionOpen] = useState(false);

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

  useEffect(() => {
    if (filteredNow.length === 0 && filteredLater.length > 0) {
      setLaterSectionOpen(true);
    }
  }, [filteredNow.length, filteredLater.length]);

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
    return (
      <IntegrationCard
        key={def.id}
        name={def.name}
        logoSrc={def.logoSrc}
        connected={!!connected}
        lastSync={connected ? formatLastSync(connected.lastSyncAt) : undefined}
        available={def.available}
        connecting={connectingState}
        onConnect={onConnect}
        onDisconnect={connectedId ? () => handleDisconnect(connectedId) : undefined}
      />
    );
  }

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{IX.pageTitle}</h1>
          <p className="text-muted-foreground">
            {IX.introPublicidadeWhatsapp}
            <strong className="font-medium text-foreground">WhatsApp (CRM)</strong>.
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={IX.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg pl-9"
          />
        </div>
      </div>

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

      <div className="min-w-0 overflow-hidden rounded-xl border border-border/80 bg-card p-4 sm:p-6">
        <Tabs defaultValue="ads" className="min-w-0 space-y-4">
          <TabsList className="grid h-auto w-full min-w-0 grid-cols-2 gap-1 sm:inline-flex sm:w-auto sm:max-w-full">
            <TabsTrigger value="ads" className="gap-2 px-3 py-2 text-xs sm:text-sm">
              <Megaphone className="h-4 w-4 shrink-0" aria-hidden />
              Publicidade
            </TabsTrigger>
            <TabsTrigger value="ativacrm" className="gap-2 px-3 py-2 text-xs sm:text-sm">
              <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
              WhatsApp (CRM)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ads" className="mt-0 min-w-0 focus-visible:outline-none">
            {loading ? (
              <div className="flex justify-center py-12 text-muted-foreground">Carregando...</div>
            ) : (
              <>
                <div className="space-y-6">
                  {filteredNow.length > 0 && (
                    <div>
                      <h2 className="mb-3 text-sm font-semibold text-foreground">{IX.disponiveisAgora}</h2>
                      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                        {filteredNow.map(renderCard)}
                      </div>
                    </div>
                  )}

                  {filteredLater.length > 0 && (
                    <details
                      className="group rounded-lg border border-border/60 bg-muted/20"
                      open={laterSectionOpen}
                      onToggle={(e) => setLaterSectionOpen(e.currentTarget.open)}
                    >
                      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
                        <span className="flex items-center justify-between gap-2">
                          <span>
                            {IX.outrasPlataformas}
                            <span className="font-normal text-muted-foreground">
                              {IX.emBreveCount(filteredLater.length)}
                            </span>
                          </span>
                          <span className="text-xs text-muted-foreground group-open:hidden">Mostrar</span>
                          <span className="hidden text-xs text-muted-foreground group-open:inline">Ocultar</span>
                        </span>
                      </summary>
                      <div className="border-t border-border/60 p-4 pt-2">
                        <p className="mb-4 text-xs text-muted-foreground">
                          {IX.roadmapWhatsappAba}
                          <strong className="text-foreground">WhatsApp (CRM)</strong> {IX.nestaPagina}
                        </p>
                        <div className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                          {filteredLater.map(renderCard)}
                        </div>
                      </div>
                    </details>
                  )}
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
