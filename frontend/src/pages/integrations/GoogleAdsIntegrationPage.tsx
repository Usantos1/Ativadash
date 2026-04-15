import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  disconnectIntegration,
  fetchGoogleAdsSetup,
  fetchIntegrations,
  getGoogleAdsAuthUrl,
  patchGoogleAdsDefaultCustomer,
  patchIntegrationClientAccount,
  postGoogleAdsSyncAccessible,
  putGoogleAdsClientAssignment,
  deleteGoogleAdsClientAssignment,
  type GoogleAdsSetupDto,
  type IntegrationFromApi,
} from "@/lib/integrations-api";
import { fetchClients, type ClientAccount } from "@/lib/workspace-api";
import { getApiErrorMessage } from "@/lib/api";
import { IX } from "@/lib/integrationsCopy";
import { IntegrationDetailHeader } from "@/components/integrations/detail/IntegrationDetailHeader";
import { IntegrationDetailPageShell } from "@/components/integrations/detail/IntegrationDetailPageShell";
import { IntegrationDetailTwoColumnLayout } from "@/components/integrations/detail/IntegrationDetailTwoColumnLayout";
import { IntegrationConfigCard } from "@/components/integrations/detail/IntegrationConfigCard";
import { GoogleAdsSummaryPanel } from "@/components/integrations/detail/GoogleAdsSummaryPanel";
import { GoogleAdsLinkedAccountsTable } from "@/components/integrations/detail/GoogleAdsLinkedAccountsTable";
import { IntegrationStatusBadge } from "@/components/integrations/hub/IntegrationStatusBadge";
import { formatPageTitle, usePageTitle } from "@/hooks/usePageTitle";
import { cn } from "@/lib/utils";

function normId(id: string): string {
  return id.replace(/\D/g, "");
}

function fmtCid(id: string): string {
  const d = normId(id);
  if (d.length !== 10) return id;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

const S_ORG = "__org__";
const S_MCC_NONE = "__mcc_none__";

export function GoogleAdsIntegrationPage() {
  usePageTitle(formatPageTitle(["Integrações", "Google Ads"]));
  const [searchParams, setSearchParams] = useSearchParams();
  const [list, setList] = useState<IntegrationFromApi[]>([]);
  const [setup, setSetup] = useState<GoogleAdsSetupDto | null>(null);
  const [clients, setClients] = useState<ClientAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [ctxClient, setCtxClient] = useState<string>("");
  const [selManager, setSelManager] = useState<string>("");
  const [selAccount, setSelAccount] = useState<string>("");
  const [setOrgDefault, setSetOrgDefault] = useState(false);

  const row = useMemo(() => list.find((i) => i.slug === "google-ads"), [list]);
  const connected = row?.status === "connected";

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [integRes, cl] = await Promise.all([fetchIntegrations(), fetchClients().catch(() => [])]);
      setList(integRes.integrations);
      setClients(cl);
      const g = integRes.integrations.find((i) => i.slug === "google-ads" && i.status === "connected");
      if (g) {
        try {
          setSetup(await fetchGoogleAdsSetup());
        } catch {
          setSetup(null);
        }
      } else {
        setSetup(null);
      }
    } catch {
      setList([]);
      setSetup(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (row?.clientAccountId) setCtxClient(row.clientAccountId);
    else setCtxClient("");
  }, [row?.clientAccountId]);

  useEffect(() => {
    const connectedParam = searchParams.get("connected");
    const err = searchParams.get("error");
    if (connectedParam === "google-ads") {
      setBanner({ type: "ok", text: "Google Ads conectado." });
      setSearchParams({}, { replace: true });
      void loadAll();
    } else if (err) {
      const msg =
        err === "exchange_failed"
          ? "Falha ao conectar."
          : err === "plan_limit_integrations"
            ? "Limite de integrações do plano."
            : err === "missing_code_or_state"
              ? "Fluxo interrompido. Tente novamente."
              : "Erro ao conectar.";
      setBanner({ type: "err", text: msg });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, loadAll]);

  const managers = useMemo(
    () => (setup?.customers ?? []).filter((c) => c.isManager),
    [setup?.customers]
  );

  const adAccounts = useMemo(() => {
    const all = (setup?.customers ?? []).filter((c) => !c.isManager);
    if (!selManager) {
      return all.filter((c) => !c.managerCustomerId);
    }
    const m = normId(selManager);
    return all.filter((c) => c.managerCustomerId && normId(c.managerCustomerId) === m);
  }, [setup?.customers, selManager]);

  async function saveContextClient() {
    if (!row?.id) return;
    setBusy("ctx");
    try {
      await patchIntegrationClientAccount(row.id, ctxClient === "" ? null : ctxClient);
      setBanner({ type: "ok", text: "Contexto da integração atualizado." });
      await loadAll();
    } catch (e) {
      setBanner({ type: "err", text: getApiErrorMessage(e, "Erro ao salvar contexto.") });
    } finally {
      setBusy(null);
    }
  }

  async function saveLink() {
    if (!row?.id || !setup || !selAccount) {
      setBanner({ type: "err", text: "Selecione a conta de anúncios." });
      return;
    }
    setBusy("link");
    try {
      if (ctxClient) {
        await putGoogleAdsClientAssignment(row.id, ctxClient, selAccount);
      } else if (setOrgDefault) {
        await patchGoogleAdsDefaultCustomer(row.id, selAccount);
      } else {
        setBanner({
          type: "err",
          text: "Escolha um cliente ou marque padrão da organização.",
        });
        setBusy(null);
        return;
      }
      if (setOrgDefault && ctxClient) {
        await patchGoogleAdsDefaultCustomer(row.id, selAccount);
      }
      setBanner({ type: "ok", text: "Vínculo salvo." });
      setSelAccount("");
      setSetOrgDefault(false);
      await loadAll();
    } catch (e) {
      setBanner({ type: "err", text: getApiErrorMessage(e, "Erro ao salvar vínculo.") });
    } finally {
      setBusy(null);
    }
  }

  async function handleOAuth() {
    setBusy("oauth");
    try {
      window.location.href = await getGoogleAdsAuthUrl();
    } catch (e) {
      setBanner({ type: "err", text: getApiErrorMessage(e, IX.naoFoiPossivelConexao) });
      setBusy(null);
    }
  }

  async function handleSync() {
    setBusy("sync");
    try {
      await postGoogleAdsSyncAccessible();
      await loadAll();
      setBanner({ type: "ok", text: "Lista de contas atualizada." });
    } catch (e) {
      setBanner({ type: "err", text: getApiErrorMessage(e, "Falha ao sincronizar.") });
    } finally {
      setBusy(null);
    }
  }

  async function handleDisconnect() {
    if (!row?.id || !confirm("Desvincular Google Ads desta empresa?")) return;
    setBusy("disc");
    try {
      await disconnectIntegration(row.id);
      setBanner({ type: "ok", text: "Desvinculado." });
      await loadAll();
    } catch (e) {
      setBanner({ type: "err", text: getApiErrorMessage(e, "Erro ao desvincular.") });
    } finally {
      setBusy(null);
    }
  }

  function managerLabel(id: string): string {
    const m = setup?.customers.find((c) => normId(c.customerId) === normId(id));
    return m ? `${m.descriptiveName ?? "MCC"} · ${fmtCid(id)}` : fmtCid(id);
  }

  function accountLabel(id: string): string {
    const a = setup?.customers.find((c) => normId(c.customerId) === normId(id));
    return a ? `${a.descriptiveName ?? "Conta"} · ${fmtCid(id)}` : fmtCid(id);
  }

  function removeAssignment(clientAccountId: string) {
    if (!row?.id || !confirm("Remover este vínculo?")) return;
    setBusy("rm");
    void (async () => {
      try {
        await deleteGoogleAdsClientAssignment(row.id!, clientAccountId);
        setBanner({ type: "ok", text: "Removido." });
        await loadAll();
      } catch (e) {
        setBanner({ type: "err", text: getApiErrorMessage(e, "Erro.") });
      } finally {
        setBusy(null);
      }
    })();
  }

  const lastSyncLabel = row?.lastSyncAt ? new Date(row.lastSyncAt).toLocaleString("pt-BR") : "—";

  if (loading) {
    return (
      <IntegrationDetailPageShell>
        <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
          <Loader2 className="h-9 w-9 animate-spin" />
        </div>
      </IntegrationDetailPageShell>
    );
  }

  return (
    <IntegrationDetailPageShell>
        <IntegrationDetailHeader
          backHref="/marketing/integracoes"
          logoSrc="/integrations/google-ads.svg"
          logoAlt="Google Ads"
          logoAccent="google"
          title="Google Ads"
          subtitle="OAuth, gerenciadores (MCC), contas de anúncios e vínculo por cliente ou padrão da organização."
          badge={
            <IntegrationStatusBadge
              status={connected ? "connected" : "disconnected"}
              className="text-[11px]"
            />
          }
          actions={
            connected ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full shadow-sm sm:w-auto"
                  onClick={() => void handleOAuth()}
                  disabled={!!busy}
                >
                  {busy === "oauth" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Reconectar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full shadow-sm sm:w-auto"
                  onClick={() => void handleSync()}
                  disabled={!!busy}
                >
                  {busy === "sync" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Buscar contas
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => void handleDisconnect()}
                  disabled={!!busy}
                >
                  Desvincular
                </Button>
              </>
            ) : null
          }
        />

        {banner ? (
          <div
            role="status"
            className={cn(
              "rounded-xl border px-4 py-3.5 text-sm font-medium shadow-sm",
              banner.type === "ok"
                ? "border-emerald-200/80 bg-emerald-50 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/35 dark:text-emerald-50"
                : "border-destructive/35 bg-destructive/10 text-destructive"
            )}
          >
            {banner.text}
          </div>
        ) : null}

        {!connected ? (
          <IntegrationConfigCard
            title="Primeiro passo"
            description="Autorize o acesso com a conta Google que administra suas contas de anúncios."
          >
            <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-md text-sm text-muted-foreground">
                Depois da conexão você poderá escolher MCC, conta e vínculo por workspace.
              </p>
              <Button
                size="lg"
                className="h-12 w-full min-w-0 shadow-md sm:min-w-[200px]"
                onClick={() => void handleOAuth()}
                disabled={!!busy}
              >
                {busy === "oauth" ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                Conectar Google Ads
              </Button>
            </div>
          </IntegrationConfigCard>
        ) : (
          <IntegrationDetailTwoColumnLayout
            main={
              <>
              <IntegrationConfigCard
                title="Contexto da API"
                description="Define qual cliente o backend usa quando o app não envia outro workspace."
              >
                <div className="grid w-full max-w-3xl gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Workspace / cliente
                    </Label>
                    <Select
                      value={ctxClient || S_ORG}
                      onValueChange={(v) => setCtxClient(v === S_ORG ? "" : v)}
                    >
                      <SelectTrigger className="h-11 w-full rounded-xl">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={S_ORG}>Organização (sem cliente)</SelectItem>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-11 w-full rounded-xl sm:w-fit"
                    disabled={busy === "ctx"}
                    onClick={() => void saveContextClient()}
                  >
                    {busy === "ctx" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Salvar contexto
                  </Button>
                </div>
              </IntegrationConfigCard>

              <IntegrationConfigCard
                title="Novo vínculo"
                description="Escolha o gerenciador (se houver), a conta de anúncios e confirme o vínculo."
              >
                <div className="grid gap-5 sm:grid-cols-1 lg:grid-cols-2">
                  <div className="space-y-2 lg:col-span-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Gerenciador (MCC)
                    </Label>
                    <Select
                      value={selManager ? selManager : S_MCC_NONE}
                      onValueChange={(v) => {
                        setSelManager(v === S_MCC_NONE ? "" : v);
                        setSelAccount("");
                      }}
                    >
                      <SelectTrigger className="h-11 w-full rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={S_MCC_NONE}>Sem MCC (conta direta)</SelectItem>
                        {managers.map((m) => (
                          <SelectItem key={m.customerId} value={m.customerId}>
                            {(m.descriptiveName ?? "MCC") + " · " + fmtCid(m.customerId)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 lg:col-span-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Conta de anúncios
                    </Label>
                    <Select value={selAccount || undefined} onValueChange={setSelAccount}>
                      <SelectTrigger className="h-11 w-full rounded-xl">
                        <SelectValue placeholder="Selecione a conta de anúncios…" />
                      </SelectTrigger>
                      <SelectContent>
                        {adAccounts.length === 0 ? (
                          <SelectItem value="__empty__" disabled>
                            Nenhuma conta neste contexto
                          </SelectItem>
                        ) : (
                          adAccounts.map((a) => (
                            <SelectItem key={a.customerId} value={a.customerId}>
                              {(a.descriptiveName ?? "Conta") +
                                " · " +
                                fmtCid(a.customerId) +
                                " · " +
                                (a.currencyCode ?? "—")}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <label
                  className={cn(
                    "mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-muted/25 p-4 transition-colors hover:bg-muted/40"
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-primary"
                    checked={setOrgDefault}
                    onChange={(e) => setSetOrgDefault(e.target.checked)}
                  />
                  <span className="text-sm leading-snug">
                    <span className="font-semibold text-foreground">Conta padrão da organização</span>
                    <span className="mt-1 block text-muted-foreground">
                      Usada no painel quando não há cliente no contexto. Pode combinar com vínculo a um cliente.
                    </span>
                  </span>
                </label>

                <Button
                  className="mt-6 h-11 w-full rounded-xl px-6 shadow-md sm:w-auto sm:min-w-[180px]"
                  onClick={() => void saveLink()}
                  disabled={!!busy || !selAccount || (!ctxClient && !setOrgDefault)}
                >
                  {busy === "link" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Salvar vínculo
                </Button>
              </IntegrationConfigCard>

              <IntegrationConfigCard
                variant="highlight"
                title="Conta padrão da organização"
                description="Referência rápida — altere ao salvar um vínculo com a opção acima."
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-mono text-lg font-bold tracking-tight text-foreground">
                      {setup?.defaultCustomerId ? fmtCid(setup.defaultCustomerId) : "Não definido"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Customer ID usado na visão sem cliente.</p>
                  </div>
                </div>
              </IntegrationConfigCard>

              <IntegrationConfigCard title="Vínculos existentes" description="Contas já associadas a clientes.">
                {setup ? (
                  <GoogleAdsLinkedAccountsTable
                    setup={setup}
                    busy={!!busy}
                    lastSyncLabel={lastSyncLabel}
                    onRemove={removeAssignment}
                    managerLabel={managerLabel}
                    accountLabel={accountLabel}
                  />
                ) : null}
              </IntegrationConfigCard>
              </>
            }
            sidebar={<GoogleAdsSummaryPanel connected={connected} row={row} setup={setup} />}
          />
        )}
    </IntegrationDetailPageShell>
  );
}
