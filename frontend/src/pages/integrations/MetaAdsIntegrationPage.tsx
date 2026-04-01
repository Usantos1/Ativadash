import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
  fetchIntegrations,
  fetchMetaAdsSetup,
  getMetaAdsAuthUrl,
  META_PERSONAL_BUSINESS_SENTINEL,
  patchIntegrationClientAccount,
  patchMetaAdsDefaultAdAccount,
  putMetaAdsClientAssignment,
  deleteMetaAdsClientAssignment,
  type IntegrationFromApi,
  type MetaAdsSetupDto,
} from "@/lib/integrations-api";
import { fetchClients, type ClientAccount } from "@/lib/workspace-api";
import { getApiErrorMessage } from "@/lib/api";
import { IX } from "@/lib/integrationsCopy";
import { IntegrationDetailHeader } from "@/components/integrations/detail/IntegrationDetailHeader";
import { IntegrationDetailPageShell } from "@/components/integrations/detail/IntegrationDetailPageShell";
import { IntegrationDetailTwoColumnLayout } from "@/components/integrations/detail/IntegrationDetailTwoColumnLayout";
import { IntegrationConfigCard } from "@/components/integrations/detail/IntegrationConfigCard";
import { MetaAdsSummaryPanel } from "@/components/integrations/detail/MetaAdsSummaryPanel";
import { MetaAdsLinkedAccountsTable } from "@/components/integrations/detail/MetaAdsLinkedAccountsTable";
import { IntegrationStatusBadge } from "@/components/integrations/hub/IntegrationStatusBadge";
import { cn } from "@/lib/utils";

const S_ORG = "__org__";

function normAdId(id: string): string {
  return id.replace(/\D/g, "");
}

export function MetaAdsIntegrationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [list, setList] = useState<IntegrationFromApi[]>([]);
  const [setup, setSetup] = useState<MetaAdsSetupDto | null>(null);
  const [clients, setClients] = useState<ClientAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [ctxClient, setCtxClient] = useState("");
  const [selBm, setSelBm] = useState("");
  const [selAdKey, setSelAdKey] = useState("");
  const [setOrgDefault, setSetOrgDefault] = useState(false);

  const row = useMemo(() => list.find((i) => i.slug === "meta"), [list]);
  const connected = row?.status === "connected";

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [integRes, cl] = await Promise.all([fetchIntegrations(), fetchClients().catch(() => [])]);
      setList(integRes.integrations);
      setClients(cl);
      const m = integRes.integrations.find((i) => i.slug === "meta" && i.status === "connected");
      if (m) {
        try {
          setSetup(await fetchMetaAdsSetup());
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
    const ok = searchParams.get("connected");
    const err = searchParams.get("error");
    if (ok === "meta-ads") {
      setBanner({ type: "ok", text: "Meta Ads conectado." });
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

  const accountsForBm = useMemo(() => {
    if (!setup || !selBm) return [];
    return setup.adAccounts.filter((a) => a.businessId === selBm);
  }, [setup, selBm]);

  const selectedAccount = useMemo(() => {
    if (!setup || !selAdKey) return null;
    return setup.adAccounts.find((a) => `${a.businessId}:${a.accountId}` === selAdKey) ?? null;
  }, [setup, selAdKey]);

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
    if (!row?.id || !setup) {
      setBanner({ type: "err", text: "Carregue as contas antes de salvar." });
      return;
    }
    if (!selBm) {
      setBanner({ type: "err", text: "Selecione um Business Manager." });
      return;
    }
    if (!selectedAccount) {
      setBanner({ type: "err", text: "Selecione uma conta de anúncios." });
      return;
    }
    const adId = normAdId(selectedAccount.accountId);
    if (!adId) {
      setBanner({ type: "err", text: "Conta de anúncios inválida." });
      return;
    }

    setBusy("link");
    try {
      const businessId = selBm;
      if (ctxClient) {
        await putMetaAdsClientAssignment(row.id, ctxClient, { businessId, adAccountId: adId });
      } else if (setOrgDefault) {
        await patchMetaAdsDefaultAdAccount(row.id, {
          adAccountId: adId,
          businessId: businessId === META_PERSONAL_BUSINESS_SENTINEL ? null : businessId,
        });
      } else {
        setBanner({
          type: "err",
          text: "Escolha um cliente (workspace) ou marque conta padrão da organização.",
        });
        setBusy(null);
        return;
      }
      if (setOrgDefault && ctxClient) {
        await patchMetaAdsDefaultAdAccount(row.id, {
          adAccountId: adId,
          businessId: businessId === META_PERSONAL_BUSINESS_SENTINEL ? null : businessId,
        });
      }
      setBanner({ type: "ok", text: "Vínculo salvo." });
      setSelAdKey("");
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
      window.location.href = await getMetaAdsAuthUrl();
    } catch (e) {
      setBanner({ type: "err", text: getApiErrorMessage(e, IX.naoFoiPossivelConexao) });
      setBusy(null);
    }
  }

  async function handleRefreshCatalog() {
    if (!connected) return;
    setBusy("sync");
    try {
      setSetup(await fetchMetaAdsSetup());
      setBanner({ type: "ok", text: "Lista de BMs e contas atualizada." });
    } catch (e) {
      setBanner({ type: "err", text: getApiErrorMessage(e, "Falha ao atualizar lista.") });
    } finally {
      setBusy(null);
    }
  }

  async function handleDisconnect() {
    if (!row?.id || !confirm("Desvincular Meta Ads desta empresa?")) return;
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

  function removeAssignment(clientAccountId: string) {
    if (!row?.id || !confirm("Remover este vínculo?")) return;
    setBusy("rm");
    void (async () => {
      try {
        await deleteMetaAdsClientAssignment(row.id!, clientAccountId);
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
          logoSrc="/integrations/meta.svg"
          logoAlt="Meta Ads"
          logoAccent="meta"
          title="Meta Ads"
          subtitle="OAuth, Business Managers, contas de anúncios e vínculo por workspace — igual ao fluxo do Google Ads."
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
                  onClick={() => void handleRefreshCatalog()}
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
            description="Autorize com a conta Meta que tem acesso aos Business Managers e às contas de anúncios."
          >
            <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-md text-sm text-muted-foreground">
                Depois da conexão você escolhe BM, conta e vínculo por cliente ou padrão da organização.
              </p>
              <Button
                size="lg"
                className="h-12 w-full min-w-0 shadow-md sm:min-w-[200px]"
                onClick={() => void handleOAuth()}
                disabled={!!busy}
              >
                {busy === "oauth" ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                Conectar Meta Ads
              </Button>
            </div>
          </IntegrationConfigCard>
        ) : (
          <IntegrationDetailTwoColumnLayout
            main={
              <>
              <IntegrationConfigCard
                title="Contexto da API"
                description="Define qual cliente o backend usa quando o app não envia outro workspace na requisição."
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
                description="Selecione o Business Manager, depois a conta de anúncio (nome, ID, status e moeda). Salve para o workspace escolhido acima ou como padrão da organização."
              >
                <div className="grid gap-5">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Business Manager (BM)
                    </Label>
                    {(setup?.businesses ?? []).length === 0 ? (
                      <p className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                        Nenhum Business Manager retornado pela API. Verifique permissões do app (incl.{" "}
                        <span className="font-medium text-foreground">business_management</span>) ou use Buscar contas.
                      </p>
                    ) : (
                      <Select
                        value={selBm || undefined}
                        onValueChange={(v) => {
                          setSelBm(v);
                          setSelAdKey("");
                        }}
                      >
                        <SelectTrigger className="h-11 w-full rounded-xl">
                          <SelectValue placeholder="Selecione o Business Manager" />
                        </SelectTrigger>
                        <SelectContent>
                          {(setup?.businesses ?? []).map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name} ({b.id})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Conta de anúncios
                    </Label>
                    <Select
                      value={selAdKey || undefined}
                      onValueChange={setSelAdKey}
                      disabled={!selBm || accountsForBm.length === 0}
                    >
                      <SelectTrigger className="h-11 w-full rounded-xl">
                        <SelectValue
                          placeholder={
                            !selBm
                              ? "Escolha um BM primeiro"
                              : accountsForBm.length === 0
                                ? "Nenhuma conta neste BM"
                                : "Selecione a conta de anúncios"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {accountsForBm.map((a) => (
                          <SelectItem key={`${a.businessId}:${a.accountId}`} value={`${a.businessId}:${a.accountId}`}>
                            {a.name} · act_{normAdId(a.accountId)} · st. {a.accountStatus ?? "—"} ·{" "}
                            {a.currency ?? "—"}
                          </SelectItem>
                        ))}
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
                      Usada na visão agregada sem cliente no contexto. Pode combinar com vínculo a um cliente.
                    </span>
                  </span>
                </label>

                <Button
                  className="mt-6 h-11 w-full rounded-xl px-6 shadow-md sm:w-auto sm:min-w-[180px]"
                  onClick={() => void saveLink()}
                  disabled={
                    !!busy || !selBm || !selAdKey || (!ctxClient && !setOrgDefault)
                  }
                >
                  {busy === "link" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Salvar vínculo
                </Button>
              </IntegrationConfigCard>

              <IntegrationConfigCard
                variant="highlight"
                title="Conta padrão da organização"
                description="Referência rápida — defina ao marcar a opção acima ao salvar."
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-mono text-lg font-bold tracking-tight text-foreground">
                      {setup?.defaultAdAccountId ? `act_${normAdId(setup.defaultAdAccountId)}` : "Não definido"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      ID numérico da conta usada na visão sem cliente (quando configurado).
                    </p>
                  </div>
                </div>
              </IntegrationConfigCard>

              <IntegrationConfigCard title="Vínculos existentes" description="BM + conta já associados a clientes.">
                {setup ? (
                  <MetaAdsLinkedAccountsTable
                    setup={setup}
                    busy={!!busy}
                    lastSyncLabel={lastSyncLabel}
                    onRemove={removeAssignment}
                  />
                ) : null}
              </IntegrationConfigCard>
              </>
            }
            sidebar={<MetaAdsSummaryPanel connected={connected} row={row} setup={setup} />}
          />
        )}

        <p className="text-xs text-muted-foreground">
          <Link to="/marketing/configuracoes" className="text-primary underline-offset-4 hover:underline">
            Metas e canais
          </Link>
          {" · "}
          <Link to="/ads/metas-alertas" className="text-primary underline-offset-4 hover:underline">
            Regras e motor
          </Link>
        </p>
    </IntegrationDetailPageShell>
  );
}
