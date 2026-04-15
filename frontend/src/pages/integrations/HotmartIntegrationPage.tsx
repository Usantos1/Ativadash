import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ClipboardCopy,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Unlink,
} from "lucide-react";
import { IntegrationDetailHeader } from "@/components/integrations/detail/IntegrationDetailHeader";
import { IntegrationDetailPageShell } from "@/components/integrations/detail/IntegrationDetailPageShell";
import { IntegrationConfigCard } from "@/components/integrations/detail/IntegrationConfigCard";
import { hubItemByRouteSlug } from "@/lib/integration-hub-registry";
import { formatPageTitle, usePageTitle } from "@/hooks/usePageTitle";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fetchCheckoutEvents,
  fetchCheckoutProductMappings,
  upsertCheckoutProductMapping,
  deleteCheckoutProductMapping,
  type CheckoutEventRow,
  type CheckoutProductMappingRow,
} from "@/lib/checkout-api";
import { api } from "@/lib/api";

const hotmartHub = hubItemByRouteSlug("hotmart");
const API_BASE = (import.meta as any).env?.VITE_API_URL ?? "";

type WebhookEndpointInfo = {
  id: string;
  name: string;
  publicSlug: string;
  active: boolean;
};

export function HotmartIntegrationPage() {
  usePageTitle(formatPageTitle(["Integrações", "Hotmart"]));

  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [, setEndpoints] = useState<WebhookEndpointInfo[]>([]);
  const [hotmartEndpoint, setHotmartEndpoint] = useState<WebhookEndpointInfo | null>(null);
  const [endpointSecret, setEndpointSecret] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [events, setEvents] = useState<CheckoutEventRow[]>([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [eventsLoading, setEventsLoading] = useState(false);

  const [mappings, setMappings] = useState<CheckoutProductMappingRow[]>([]);
  const [mappingsLoading, setMappingsLoading] = useState(false);
  const [newMap, setNewMap] = useState({ productId: "", productName: "", campaignId: "", channel: "facebook" as "facebook" | "google" });
  const [mapSaving, setMapSaving] = useState(false);

  const [copied, setCopied] = useState(false);

  const webhookUrl = useMemo(() => {
    if (!hotmartEndpoint) return null;
    const base = API_BASE || window.location.origin.replace("app.", "api.");
    return `${base}/api/hooks/w/${hotmartEndpoint.publicSlug}`;
  }, [hotmartEndpoint]);

  const loadEndpoints = useCallback(async () => {
    try {
      const res = await api.get<{ items: WebhookEndpointInfo[] }>("/workspace/webhooks/endpoints");
      const list = res.items ?? [];
      setEndpoints(list);
      const existing = list.find(
        (e) => e.name.toLowerCase().includes("hotmart") && e.active
      );
      setHotmartEndpoint(existing ?? null);
    } catch { /* ignore */ }
  }, []);

  const createHotmartEndpoint = useCallback(async () => {
    setCreating(true);
    try {
      const res = await api.post<{ item: WebhookEndpointInfo; plainSecret: string }>("/workspace/webhooks/endpoints", {
        name: "Hotmart",
      });
      setHotmartEndpoint(res.item);
      setEndpointSecret(res.plainSecret);
      setToast({ type: "ok", text: "Endpoint Hotmart criado com sucesso!" });
      loadEndpoints();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao criar endpoint";
      setToast({ type: "err", text: msg });
    } finally {
      setCreating(false);
    }
  }, [loadEndpoints]);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const data = await fetchCheckoutEvents({ source: "hotmart", limit: 50 });
      setEvents(data.items);
      setEventsTotal(data.total);
    } catch { /* ignore */ }
    finally { setEventsLoading(false); }
  }, []);

  const loadMappings = useCallback(async () => {
    setMappingsLoading(true);
    try {
      const items = await fetchCheckoutProductMappings();
      setMappings(items.filter((m) => m.source === "hotmart"));
    } catch { /* ignore */ }
    finally { setMappingsLoading(false); }
  }, []);

  useEffect(() => {
    loadEndpoints();
    loadEvents();
    loadMappings();
  }, [loadEndpoints, loadEvents, loadMappings]);

  const handleCopy = useCallback(() => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [webhookUrl]);

  const handleAddMapping = useCallback(async () => {
    if (!newMap.productId.trim() || !newMap.campaignId.trim()) return;
    setMapSaving(true);
    try {
      await upsertCheckoutProductMapping({
        source: "hotmart",
        productId: newMap.productId.trim(),
        productName: newMap.productName.trim() || undefined,
        campaignId: newMap.campaignId.trim(),
        channel: newMap.channel,
      });
      setNewMap({ productId: "", productName: "", campaignId: "", channel: "facebook" });
      setToast({ type: "ok", text: "Mapeamento salvo!" });
      loadMappings();
    } catch {
      setToast({ type: "err", text: "Erro ao salvar mapeamento" });
    } finally {
      setMapSaving(false);
    }
  }, [newMap, loadMappings]);

  const handleDeleteMapping = useCallback(async (id: string) => {
    try {
      await deleteCheckoutProductMapping(id);
      setToast({ type: "ok", text: "Mapeamento removido" });
      loadMappings();
    } catch {
      setToast({ type: "err", text: "Erro ao remover mapeamento" });
    }
  }, [loadMappings]);

  const eventStatusLabel = (s: string) => {
    switch (s) {
      case "approved": return "Aprovada";
      case "refunded": return "Reembolsada";
      case "chargedback": return "Chargeback";
      case "canceled": return "Cancelada";
      case "pending": return "Pendente";
      default: return s;
    }
  };

  const eventStatusColor = (s: string) => {
    switch (s) {
      case "approved": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
      case "refunded": case "chargedback": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
      case "pending": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  return (
    <IntegrationDetailPageShell spacing="relaxed">
      <IntegrationDetailHeader
        backHref="/marketing/integracoes"
        logoSrc={hotmartHub?.logoSrc ?? "/integrations/hotmart.svg"}
        logoAlt={hotmartHub?.name ?? "Hotmart"}
        logoAccent="hotmart"
        title="Hotmart"
        subtitle="Vendas, reembolsos e assinaturas via webhook — receita real no dashboard."
      />

      {toast && (
        <div
          role="status"
          className={cn(
            "rounded-xl border px-4 py-3.5 text-sm font-medium shadow-sm",
            toast.type === "ok"
              ? "border-emerald-200/80 bg-emerald-50 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/35 dark:text-emerald-50"
              : "border-destructive/35 bg-destructive/10 text-destructive"
          )}
        >
          {toast.text}
        </div>
      )}

      {/* 1) Configuração do Webhook */}
      <IntegrationConfigCard
        title="Configuração do Webhook"
        description="Crie um endpoint dedicado e copie a URL para o painel da Hotmart."
      >
        {!hotmartEndpoint ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Nenhum endpoint Hotmart configurado. Crie um para começar a receber eventos de compra.
            </p>
            <Button onClick={createHotmartEndpoint} disabled={creating}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Criar endpoint Hotmart
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-emerald-300 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:text-emerald-300">
                <Check className="mr-1 h-3 w-3" /> Ativo
              </span>
              <span className="text-xs text-muted-foreground">Endpoint: {hotmartEndpoint.name}</span>
            </div>

            <div>
              <Label className="text-xs font-medium text-muted-foreground">URL do Webhook (copie para a Hotmart)</Label>
              <div className="mt-1 flex gap-2">
                <Input readOnly value={webhookUrl ?? ""} className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <ClipboardCopy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {endpointSecret && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                  Segredo (exibido somente agora — salve em local seguro):
                </p>
                <code className="mt-1 block break-all text-xs text-amber-700 dark:text-amber-300">
                  {endpointSecret}
                </code>
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  Cole este segredo no campo <strong>hottok</strong> das configurações de webhook da Hotmart.
                </p>
              </div>
            )}

            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="text-xs font-medium mb-2">Como configurar na Hotmart:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
                <li>Acesse <strong>Hotmart &gt; Ferramentas &gt; Webhooks</strong></li>
                <li>Clique em <strong>Configurar nova URL</strong></li>
                <li>Cole a URL acima no campo de destino</li>
                <li>Selecione os eventos: <strong>Compra aprovada, Reembolso, Assinatura cancelada, Carrinho abandonado</strong></li>
                <li>Salve e ative o webhook</li>
              </ol>
              <a
                href="https://developers.hotmart.com/docs/pt-BR/v2/webhook/how-to-configure/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Ver documentação Hotmart <ArrowUpRight className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}
      </IntegrationConfigCard>

      {/* 2) Eventos recebidos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Eventos recebidos</CardTitle>
            <CardDescription>Últimos eventos de checkout processados ({eventsTotal} total)</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={loadEvents} disabled={eventsLoading}>
            <RefreshCw className={cn("h-4 w-4", eventsLoading && "animate-spin")} />
          </Button>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {eventsLoading ? "Carregando..." : "Nenhum evento recebido ainda. Configure o webhook na Hotmart para começar."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Tipo</th>
                    <th className="pb-2 pr-3 font-medium">Status</th>
                    <th className="pb-2 pr-3 font-medium">Produto</th>
                    <th className="pb-2 pr-3 font-medium">Comprador</th>
                    <th className="pb-2 pr-3 font-medium text-right">Valor</th>
                    <th className="pb-2 pr-3 font-medium">UTM Campaign</th>
                    <th className="pb-2 pr-3 font-medium">Campanha</th>
                    <th className="pb-2 font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev) => (
                    <tr key={ev.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-3">
                        <span className="font-mono text-[10px]">{ev.eventType}</span>
                      </td>
                      <td className="py-2 pr-3">
                        <span className={cn("inline-block rounded-full px-2 py-0.5 text-[10px] font-medium", eventStatusColor(ev.status))}>
                          {eventStatusLabel(ev.status)}
                        </span>
                      </td>
                      <td className="py-2 pr-3 max-w-[120px] truncate" title={ev.productName ?? ""}>
                        {ev.productName ?? ev.productId ?? "—"}
                      </td>
                      <td className="py-2 pr-3 max-w-[140px] truncate" title={ev.buyerEmail ?? ""}>
                        {ev.buyerName ?? ev.buyerEmail ?? "—"}
                      </td>
                      <td className={cn("py-2 pr-3 text-right tabular-nums font-medium", ev.amountBrl < 0 ? "text-red-600" : "text-emerald-600")}>
                        R$ {Math.abs(ev.amountBrl).toFixed(2)}
                      </td>
                      <td className="py-2 pr-3 font-mono text-[10px]">
                        {ev.utmCampaign ?? "—"}
                      </td>
                      <td className="py-2 pr-3">
                        {ev.mappedCampaignId ? (
                          <span className="text-[10px]">
                            {ev.mappedChannel && <span className="mr-1 inline-block rounded-full border px-1.5 py-px text-[9px] font-medium">{ev.mappedChannel}</span>}
                            {ev.mappedCampaignId.slice(0, 16)}…
                          </span>
                        ) : (
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Unlink className="h-3 w-3" /> Sem vínculo
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {new Date(ev.occurredAt).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3) Mapeamento de produtos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mapeamento de produtos</CardTitle>
          <CardDescription>
            Vincule produtos Hotmart a campanhas Meta/Google quando UTM não estiver disponível.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mappings.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Produto ID</th>
                    <th className="pb-2 pr-3 font-medium">Nome</th>
                    <th className="pb-2 pr-3 font-medium">Campanha ID</th>
                    <th className="pb-2 pr-3 font-medium">Canal</th>
                    <th className="pb-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((m) => (
                    <tr key={m.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-3 font-mono">{m.productId}</td>
                      <td className="py-2 pr-3">{m.productName ?? "—"}</td>
                      <td className="py-2 pr-3 font-mono">{m.campaignId}</td>
                      <td className="py-2 pr-3">
                        <span className="inline-block rounded-full border px-2 py-0.5 text-xs font-medium">{m.channel === "facebook" ? "Meta" : "Google"}</span>
                      </td>
                      <td className="py-2 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteMapping(m.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs font-medium mb-3">Adicionar mapeamento</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <Label className="text-[10px] text-muted-foreground">Produto ID (Hotmart)</Label>
                <Input
                  className="h-8 text-xs"
                  placeholder="ex: 123456"
                  value={newMap.productId}
                  onChange={(e) => setNewMap((p) => ({ ...p, productId: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Nome (opcional)</Label>
                <Input
                  className="h-8 text-xs"
                  placeholder="ex: Curso XYZ"
                  value={newMap.productName}
                  onChange={(e) => setNewMap((p) => ({ ...p, productName: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Campaign ID (Meta/Google)</Label>
                <Input
                  className="h-8 text-xs"
                  placeholder="ex: 23851234567890"
                  value={newMap.campaignId}
                  onChange={(e) => setNewMap((p) => ({ ...p, campaignId: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Canal</Label>
                <select
                  className="h-8 w-full rounded-md border bg-background px-2 text-xs"
                  value={newMap.channel}
                  onChange={(e) => setNewMap((p) => ({ ...p, channel: e.target.value as "facebook" | "google" }))}
                >
                  <option value="facebook">Meta (Facebook)</option>
                  <option value="google">Google</option>
                </select>
              </div>
            </div>
            <Button
              size="sm"
              className="mt-3"
              onClick={handleAddMapping}
              disabled={mapSaving || !newMap.productId.trim() || !newMap.campaignId.trim()}
            >
              {mapSaving ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Plus className="mr-2 h-3 w-3" />}
              Adicionar
            </Button>
          </div>

          {mappingsLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Carregando mapeamentos...
            </div>
          )}
        </CardContent>
      </Card>
    </IntegrationDetailPageShell>
  );
}
