import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  buildWebhookIngestUrl,
  createWebhookEndpoint,
  fetchWebhookEndpoints,
  fetchWebhookEvents,
  patchWebhookEndpoint,
  replayWebhookEvent,
  type WebhookEndpointRow,
  type WebhookEventRow,
} from "@/lib/webhooks-api";
import { formatMutationBlockedMessage } from "@/lib/api";

type Props = {
  onNotify: (m: { type: "success" | "error"; text: string }) => void;
};

export function WebhooksIntegrationPanel({ onNotify }: Props) {
  const [loading, setLoading] = useState(true);
  const [endpoints, setEndpoints] = useState<WebhookEndpointRow[]>([]);
  const [events, setEvents] = useState<WebhookEventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [plainSecret, setPlainSecret] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ep, ev] = await Promise.all([
        fetchWebhookEndpoints(),
        fetchWebhookEvents({ limit: 25 }),
      ]);
      setEndpoints(ep);
      setEvents(ev.items);
      setTotal(ev.total);
    } catch (e) {
      const msg = formatMutationBlockedMessage(e, "Erro ao carregar webhooks");
      onNotify({ type: "error", text: msg });
      setEndpoints([]);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setPlainSecret(null);
    setCreating(true);
    try {
      const body: { name: string; publicSlug?: string | null } = { name: name.trim() };
      if (slug.trim()) body.publicSlug = slug.trim().toLowerCase();
      const res = await createWebhookEndpoint(body);
      setPlainSecret(res.plainSecret);
      setName("");
      setSlug("");
      setEndpoints((prev) => [res.item, ...prev]);
      onNotify({
        type: "success",
        text: "Endpoint criado. Guarde o segredo.",
      });
    } catch (err) {
      onNotify({ type: "error", text: formatMutationBlockedMessage(err, "Erro ao criar") });
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(ep: WebhookEndpointRow) {
    try {
      const { item } = await patchWebhookEndpoint(ep.id, { active: !ep.active });
      setEndpoints((prev) => prev.map((x) => (x.id === item.id ? item : x)));
      onNotify({ type: "success", text: item.active ? "Ativado." : "Desativado." });
    } catch (err) {
      onNotify({ type: "error", text: formatMutationBlockedMessage(err, "Erro") });
    }
  }

  async function handleReplay(id: string) {
    try {
      await replayWebhookEvent(id);
      onNotify({ type: "success", text: "Evento reprocessado." });
      void load();
    } catch (err) {
      onNotify({ type: "error", text: formatMutationBlockedMessage(err, "Erro") });
    }
  }

  return (
    <Card className="min-w-0 border-border/80 shadow-sm">
      <CardHeader className="space-y-1 pb-2 sm:pb-4">
        <CardTitle className="text-lg">Webhooks HTTP</CardTitle>
        <CardDescription className="text-sm leading-relaxed">
          Receba payloads assinados (HMAC). Requer módulo ativo no plano.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8 pt-2 sm:pt-4">
        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {plainSecret ? (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900 dark:border-green-900 dark:bg-green-950/40 dark:text-green-100">
                <strong>Segredo (copie agora):</strong>
                <code className="mt-2 block break-all rounded bg-white/80 px-3 py-2 text-xs dark:bg-black/30">
                  {plainSecret}
                </code>
              </div>
            ) : null}

            <div className="grid gap-8 xl:grid-cols-[minmax(0,440px)_minmax(0,1fr)] xl:items-start">
              <form
                onSubmit={(e) => void handleCreate(e)}
                className="space-y-4 rounded-2xl border border-border/60 bg-muted/15 p-5 sm:p-6"
              >
                <p className="text-sm font-semibold text-foreground">Novo endpoint</p>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="space-y-2">
                    <Label htmlFor="wh-name">Nome</Label>
                    <Input
                      id="wh-name"
                      className="h-11 w-full"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wh-slug">Slug (opcional)</Label>
                    <Input id="wh-slug" className="h-11 w-full" value={slug} onChange={(e) => setSlug(e.target.value)} />
                  </div>
                </div>
                <Button type="submit" disabled={creating} className="h-11 w-full gap-2 sm:w-auto">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Criar endpoint
                </Button>
              </form>

              <div className="min-w-0 space-y-3">
                <p className="text-sm font-semibold text-foreground">Endpoints</p>
                {endpoints.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
                    Nenhum endpoint ainda. Crie um à esquerda.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {endpoints.map((ep) => (
                      <li
                        key={ep.id}
                        className="rounded-xl border border-border/60 bg-card p-4 text-sm shadow-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="font-semibold text-foreground">{ep.name}</span>
                          <Button type="button" size="sm" variant="outline" onClick={() => void toggleActive(ep)}>
                            {ep.active ? "Desativar" : "Ativar"}
                          </Button>
                        </div>
                        <code className="mt-3 block break-all rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                          {buildWebhookIngestUrl(ep.publicSlug)}
                        </code>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="min-w-0 space-y-3 border-t border-border/50 pt-8">
              <p className="text-sm font-semibold text-foreground">Eventos recentes ({total})</p>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum evento.</p>
              ) : (
                <ul className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-border/50 p-2 text-xs">
                  {events.map((ev) => (
                    <li
                      key={ev.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-2"
                    >
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">{ev.eventKey}</span>
                      <span className="shrink-0 tabular-nums font-medium">{ev.status}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 shrink-0 text-xs"
                        onClick={() => void handleReplay(ev.id)}
                      >
                        Reprocessar
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
