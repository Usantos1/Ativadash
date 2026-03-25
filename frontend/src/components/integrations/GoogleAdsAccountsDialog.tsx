import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  fetchGoogleAdsSetup,
  postGoogleAdsSyncAccessible,
  patchGoogleAdsDefaultCustomer,
  putGoogleAdsClientAssignment,
  deleteGoogleAdsClientAssignment,
  type GoogleAdsSetupDto,
} from "@/lib/integrations-api";
import { getApiErrorMessage } from "@/lib/api";
import type { ClientAccount } from "@/lib/workspace-api";

function formatAdsCustomerId(id: string): string {
  const d = id.replace(/\D/g, "");
  if (d.length !== 10) return id;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrationId: string;
  clients: ClientAccount[];
  onUpdated: () => void;
};

export function GoogleAdsAccountsDialog({ open, onOpenChange, integrationId, clients, onUpdated }: Props) {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [setup, setSetup] = useState<GoogleAdsSetupDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [assignPick, setAssignPick] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGoogleAdsSetup();
      setSetup(data);
    } catch (e) {
      setSetup(null);
      setError(getApiErrorMessage(e, "Não foi possível carregar as contas."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) setAssignPick({});
  }, [open]);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      await postGoogleAdsSyncAccessible();
      await load();
      onUpdated();
    } catch (e) {
      setError(getApiErrorMessage(e, "Falha ao atualizar lista na API Google."));
    } finally {
      setSyncing(false);
    }
  }

  async function setDefault(customerId: string | null) {
    setRowBusy(`def:${customerId ?? "clear"}`);
    setError(null);
    try {
      await patchGoogleAdsDefaultCustomer(integrationId, customerId);
      await load();
      onUpdated();
    } catch (e) {
      setError(getApiErrorMessage(e, "Não foi possível definir a conta padrão."));
    } finally {
      setRowBusy(null);
    }
  }

  async function applyAssignment(customerId: string, clientAccountId: string) {
    const key = `${customerId}:${clientAccountId}`;
    setRowBusy(key);
    setError(null);
    try {
      await putGoogleAdsClientAssignment(integrationId, clientAccountId, customerId);
      setAssignPick((prev) => {
        const next = { ...prev };
        delete next[customerId];
        return next;
      });
      await load();
      onUpdated();
    } catch (e) {
      setError(getApiErrorMessage(e, "Não foi possível vincular ao cliente."));
    } finally {
      setRowBusy(null);
    }
  }

  async function clearAssignment(clientAccountId: string) {
    setRowBusy(`del:${clientAccountId}`);
    setError(null);
    try {
      await deleteGoogleAdsClientAssignment(integrationId, clientAccountId);
      await load();
      onUpdated();
    } catch (e) {
      setError(getApiErrorMessage(e, "Não foi possível remover o vínculo."));
    } finally {
      setRowBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showClose
        className="max-h-[min(90dvh,720px)] w-[min(100vw-1.5rem,42rem)] max-w-[min(100vw-1.5rem,42rem)] min-w-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6"
      >
        <DialogHeader>
          <DialogTitle>Contas Google Ads desta conexão</DialogTitle>
          <DialogDescription>
            Contas retornadas pela API para o Gmail que autorizou o OAuth. Defina uma conta padrão para a organização
            (quando nenhum cliente comercial está selecionado na integração) e vincule cada conta de anúncios ao cliente
            correto.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {loading && !setup ? (
          <div className="flex items-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Carregando…
          </div>
        ) : setup ? (
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs">
              <p>
                <span className="text-muted-foreground">Google conectado:</span>{" "}
                <span className="font-medium text-foreground">
                  {setup.googleUserEmail ?? "— (reconecte após atualização: falta permissão de e-mail no OAuth)"}
                </span>
              </p>
              <p className="mt-1 text-muted-foreground">
                Contas acessíveis: <strong className="text-foreground">{setup.accessibleCount}</strong> · Vínculos com
                clientes: <strong className="text-foreground">{setup.assignmentCount}</strong>
                {setup.defaultCustomerId ? (
                  <>
                    {" "}
                    · Padrão org.:{" "}
                    <strong className="font-mono text-foreground">{formatAdsCustomerId(setup.defaultCustomerId)}</strong>
                  </>
                ) : null}
              </p>
            </div>

            {clients.length === 0 ? (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
                Não há clientes comerciais nesta empresa. Crie clientes em Projetos / Clientes para poder vincular cada
                conta Google Ads.
              </p>
            ) : null}
            <div className="min-w-0 overflow-hidden rounded-lg border border-border/60">
              <table className="w-full table-fixed border-collapse text-left text-xs">
                <colgroup>
                  <col style={{ width: "24%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "20%" }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="px-1.5 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:px-2 sm:text-xs sm:normal-case sm:tracking-normal">
                      Conta
                    </th>
                    <th className="px-1.5 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:px-2 sm:text-xs sm:normal-case sm:tracking-normal">
                      ID
                    </th>
                    <th className="px-1.5 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:px-2 sm:text-xs sm:normal-case sm:tracking-normal">
                      Tipo
                    </th>
                    <th className="px-1.5 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:px-2 sm:text-xs sm:normal-case sm:tracking-normal">
                      Moeda
                    </th>
                    <th className="px-1.5 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:px-2 sm:text-xs sm:normal-case sm:tracking-normal">
                      Vínculo
                    </th>
                    <th className="px-1.5 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:px-2 sm:text-xs sm:normal-case sm:tracking-normal">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {setup.customers.map((c) => {
                    const assignForThis = setup.assignments.filter((a) => a.googleCustomerId === c.customerId);
                    const isDefault = setup.defaultCustomerId === c.customerId;
                    const busyDef = rowBusy === `def:${c.customerId}`;
                    return (
                      <tr key={c.customerId} className="border-b border-border/40 align-top">
                        <td className="min-w-0 break-words px-1.5 py-2 sm:px-2">
                          <div className="font-medium leading-snug text-foreground">{c.descriptiveName ?? "—"}</div>
                          {c.status ? (
                            <div className="text-[10px] text-muted-foreground">Status API: {c.status}</div>
                          ) : null}
                          {isDefault ? (
                            <span className="mt-1 inline-block rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                              Padrão (org.)
                            </span>
                          ) : null}
                        </td>
                        <td className="min-w-0 break-all px-1.5 py-2 font-mono text-[10px] tabular-nums sm:px-2 sm:text-xs">
                          {formatAdsCustomerId(c.customerId)}
                        </td>
                        <td className="min-w-0 break-words px-1.5 py-2 sm:px-2">
                          {c.isManager ? (
                            <span className="text-amber-800 dark:text-amber-200">Manager (MCC)</span>
                          ) : (
                            <span>Cliente</span>
                          )}
                          {c.managerCustomerId ? (
                            <div className="text-[10px] text-muted-foreground">
                              sob {formatAdsCustomerId(c.managerCustomerId)}
                            </div>
                          ) : null}
                        </td>
                        <td className="min-w-0 px-1.5 py-2 sm:px-2">{c.currencyCode ?? "—"}</td>
                        <td className="min-w-0 break-words px-1.5 py-2 sm:px-2">
                          {assignForThis.length === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <ul className="space-y-1">
                              {assignForThis.map((a) => (
                                <li key={a.clientAccountId} className="flex flex-wrap items-center gap-1">
                                  <span>{a.clientName}</span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-1 text-[10px] text-destructive"
                                    disabled={!!rowBusy}
                                    onClick={() => void clearAssignment(a.clientAccountId)}
                                  >
                                    {rowBusy === `del:${a.clientAccountId}` ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      "Remover"
                                    )}
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="min-w-0 px-1.5 py-2 sm:px-2">
                          <div className="flex w-full max-w-full flex-col gap-2">
                            {!c.isManager ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-auto min-h-8 w-full whitespace-normal px-2 py-1.5 text-left text-[11px] leading-tight"
                                title="Conta usada no painel quando o contexto comercial da integração é “Nenhum”"
                                disabled={!!rowBusy || busyDef}
                                onClick={() => void setDefault(c.customerId)}
                              >
                                {busyDef ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  "Padrão org."
                                )}
                              </Button>
                            ) : null}
                            {!c.isManager ? (
                              <div className="flex w-full max-w-full flex-col gap-2">
                                <select
                                  className="h-8 w-full max-w-full rounded-md border border-input bg-background px-1.5 text-[11px]"
                                  aria-label="Cliente para vincular"
                                  value={assignPick[c.customerId] ?? ""}
                                  disabled={!!rowBusy}
                                  onChange={(e) =>
                                    setAssignPick((prev) => ({ ...prev, [c.customerId]: e.target.value }))
                                  }
                                >
                                  <option value="">Cliente…</option>
                                  {clients.map((cl) => (
                                    <option key={cl.id} value={cl.id}>
                                      {cl.name}
                                    </option>
                                  ))}
                                </select>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-8 w-full text-xs"
                                  disabled={!!rowBusy || !(assignPick[c.customerId] ?? "").trim()}
                                  onClick={() => {
                                    const v = assignPick[c.customerId];
                                    if (v) void applyAssignment(c.customerId, v);
                                  }}
                                >
                                  Aplicar
                                </Button>
                              </div>
                            ) : (
                              <span className="text-[10px] leading-snug text-muted-foreground sm:text-[11px]">
                                Use contas <strong className="font-medium">Cliente</strong> para vincular a clientes
                                comerciais.
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        <DialogFooter className="flex flex-wrap gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={() => void handleSync()} disabled={syncing || loading}>
            {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Atualizar lista (API)
          </Button>
          <div className="flex gap-2">
            {setup?.defaultCustomerId ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => void setDefault(null)}
                disabled={!!rowBusy}
              >
                {rowBusy === "def:clear" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Limpar padrão org."}
              </Button>
            ) : null}
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
