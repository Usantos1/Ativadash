import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CheckCheck, Loader2, Megaphone, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  acknowledgeAlertOccurrence,
  acknowledgeAllAlertOccurrences,
  fetchAlertOccurrences,
  type AlertOccurrenceDto,
} from "@/lib/alert-rules-api";
import { fetchIntegrations, type IntegrationFromApi } from "@/lib/integrations-api";
import { getApiErrorMessage } from "@/lib/api";

const SYNC_DISMISS_KEY = "ativadash:notif:sync-dismissed";

function loadDismissedSyncIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SYNC_DISMISS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function saveDismissedSyncIds(ids: Set<string>) {
  try {
    localStorage.setItem(SYNC_DISMISS_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

export function NotificationsSheet() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [occurrences, setOccurrences] = useState<AlertOccurrenceDto[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationFromApi[]>([]);
  const [dismissedSync, setDismissedSync] = useState<Set<string>>(() => loadDismissedSyncIds());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [ackAllBusy, setAckAllBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const syncErrors = useMemo(() => {
    return integrations.filter((i) => i.status === "error" && i.slug && !dismissedSync.has(i.id));
  }, [integrations, dismissedSync]);

  const unreadAlerts = useMemo(
    () => occurrences.filter((o) => !o.acknowledgedAt),
    [occurrences]
  );

  const badgeCount = unreadAlerts.length + syncErrors.length;

  const load = useCallback(async () => {
    setLoading(true);
    setHint(null);
    try {
      const [occRes, intRes] = await Promise.all([
        fetchAlertOccurrences(50).catch(() => ({ items: [] as AlertOccurrenceDto[] })),
        fetchIntegrations().catch(() => ({ integrations: [] as IntegrationFromApi[] })),
      ]);
      setOccurrences(occRes.items);
      setIntegrations(intRes.integrations);
    } catch (e) {
      setHint(getApiErrorMessage(e, "Não foi possível carregar notificações."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  const dismissSync = (id: string) => {
    setDismissedSync((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissedSyncIds(next);
      return next;
    });
  };

  const markOne = async (id: string) => {
    setBusyId(id);
    try {
      await acknowledgeAlertOccurrence(id);
      setOccurrences((prev) =>
        prev.map((o) => (o.id === id ? { ...o, acknowledgedAt: new Date().toISOString() } : o))
      );
    } catch (e) {
      setHint(getApiErrorMessage(e, "Não foi possível marcar como lida."));
    } finally {
      setBusyId(null);
    }
  };

  const markAllAlerts = async () => {
    setAckAllBusy(true);
    try {
      await acknowledgeAllAlertOccurrences();
      setOccurrences((prev) => prev.map((o) => ({ ...o, acknowledgedAt: o.acknowledgedAt ?? new Date().toISOString() })));
    } catch (e) {
      setHint(getApiErrorMessage(e, "Não foi possível marcar todas como lidas."));
    } finally {
      setAckAllBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={cn(
          "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/90 hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        )}
        aria-label="Notificações"
        onClick={() => setOpen(true)}
      >
        <Bell className="h-[1.125rem] w-[1.125rem]" />
        {badgeCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        ) : null}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent title="Central de notificações" description="Alertas de automação e integrações">
          <div className="mb-3 flex justify-end">
            {unreadAlerts.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-lg text-xs"
                disabled={ackAllBusy}
                onClick={() => void markAllAlerts()}
              >
                {ackAllBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
                <span className="ml-1">Marcar alertas como lidos</span>
              </Button>
            ) : null}
          </div>

          <div className="space-y-0">
            {hint ? <p className="mb-2 text-xs text-destructive">{hint}</p> : null}
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-6">
                <section>
                  <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    <Megaphone className="h-3.5 w-3.5" />
                    Automações (WhatsApp / regras)
                  </div>
                  {occurrences.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum disparo recente de regras.</p>
                  ) : (
                    <ul className="space-y-2">
                      {occurrences.map((o) => (
                        <li
                          key={o.id}
                          className={cn(
                            "rounded-xl border px-3 py-2.5 text-sm",
                            o.acknowledgedAt ? "border-border/40 bg-muted/20 opacity-80" : "border-primary/20 bg-primary/[0.04]"
                          )}
                        >
                          <p className="font-medium leading-snug">{o.title}</p>
                          <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{o.message}</p>
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {o.ruleName} · {new Date(o.createdAt).toLocaleString("pt-BR")}
                          </p>
                          {!o.acknowledgedAt ? (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="mt-2 h-7 rounded-md text-xs"
                              disabled={busyId === o.id}
                              onClick={() => void markOne(o.id)}
                            >
                              {busyId === o.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Marcar como lida"}
                            </Button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    <Plug className="h-3.5 w-3.5" />
                    Sincronização (Meta / Google)
                  </div>
                  {syncErrors.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum erro de integração pendente.</p>
                  ) : (
                    <ul className="space-y-2">
                      {syncErrors.map((i) => (
                        <li key={i.id} className="rounded-xl border border-destructive/25 bg-destructive/[0.06] px-3 py-2.5 text-sm">
                          <p className="font-medium">
                            {i.slug === "google-ads" ? "Google Ads" : i.slug === "meta" ? "Meta Ads" : i.platform}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            A integração está com erro de sincronização. Verifique em Integrações.
                          </p>
                          <div className="mt-2 flex gap-2">
                            <Button type="button" variant="outline" size="sm" className="h-7 rounded-md text-xs" asChild>
                              <Link to="/marketing/integracoes">Abrir integrações</Link>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 rounded-md text-xs"
                              onClick={() => dismissSync(i.id)}
                            >
                              Ocultar
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
