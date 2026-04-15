import { useCallback, useEffect, useMemo, useState } from "react";
import { FileDown, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHint } from "@/pages/revenda/PageHint";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  auditActionDescription,
  auditEntityTypeLabel,
  describeNetworkActivityRow,
  NETWORK_ACTIVITY_ACTION_OPTIONS,
  RESELLER_AUDIT_ACTION_OPTIONS,
} from "@/lib/audit-humanize";
import { downloadCsv, openMailtoWithReportNote } from "@/lib/export-csv";
import {
  fetchResellerAudit,
  fetchResellerEcosystemOrganizations,
  fetchResellerEcosystemUsers,
  fetchResellerNetworkActivity,
  type ResellerAuditRow,
  type ResellerNetworkActivityRow,
} from "@/lib/revenda-api";
import { cn } from "@/lib/utils";

type GovFilters = {
  limit: number;
  action: string;
  entityType: string;
  actorUserId: string;
  from: string;
  to: string;
};

type NetFilters = {
  limit: number;
  organizationId: string;
  actorUserId: string;
  action: string;
  source: "all" | "user" | "automation";
  from: string;
  to: string;
};

const GOV_ENTITY_PRESETS = [
  { value: "", label: "Qualquer" },
  { value: "Organization", label: "Empresa" },
  { value: "Plan", label: "Plano" },
  { value: "User", label: "Usuário" },
  { value: "Membership", label: "Membro" },
  { value: "Invitation", label: "Convite" },
  { value: "ImpersonationSession", label: "Impersonação" },
];

const EXTENDED_GOV_ACTIONS = [
  ...RESELLER_AUDIT_ACTION_OPTIONS,
  { value: "IMPERSONATION_STARTED", label: "Impersonação iniciada" },
  { value: "IMPERSONATION_STOPPED", label: "Impersonação encerrada" },
];

function formatDateBR(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function dateToIso(dateStr: string): string {
  if (!dateStr) return "";
  return new Date(dateStr).toISOString();
}

const selectClass = cn(
  "flex h-9 min-w-[200px] max-w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
);

export function RevendaAuditPage() {
  const [tab, setTab] = useState<"governance" | "network">("governance");

  const [logs, setLogs] = useState<ResellerAuditRow[]>([]);
  const [govLoading, setGovLoading] = useState(true);
  const [govError, setGovError] = useState<string | null>(null);
  const [govApplied, setGovApplied] = useState<GovFilters>({
    limit: 80, action: "", entityType: "", actorUserId: "", from: "", to: "",
  });
  const [govDraft, setGovDraft] = useState<GovFilters>(govApplied);

  const [netItems, setNetItems] = useState<ResellerNetworkActivityRow[]>([]);
  const [netLoading, setNetLoading] = useState(true);
  const [netError, setNetError] = useState<string | null>(null);
  const [netApplied, setNetApplied] = useState<NetFilters>({
    limit: 80, organizationId: "", actorUserId: "", action: "", source: "all", from: "", to: "",
  });
  const [netDraft, setNetDraft] = useState<NetFilters>(netApplied);

  const [ecoOrgs, setEcoOrgs] = useState<{ id: string; name: string; isMatrix: boolean }[]>([]);
  const [ecoActors, setEcoActors] = useState<{ id: string; label: string }[]>([]);
  const actorMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of ecoActors) m.set(a.id, a.label);
    return m;
  }, [ecoActors]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([fetchResellerEcosystemOrganizations(), fetchResellerEcosystemUsers({})])
      .then(([o, u]) => {
        if (cancelled) return;
        setEcoOrgs(
          o.organizations
            .filter((x) => !x.isMatrix)
            .map((x) => ({ id: x.id, name: x.name, isMatrix: x.isMatrix }))
            .sort((a, b) => a.name.localeCompare(b.name, "pt"))
        );
        const seen = new Set<string>();
        const actors: { id: string; label: string }[] = [];
        for (const row of u.users) {
          const id = row.user.id;
          if (seen.has(id)) continue;
          seen.add(id);
          actors.push({ id, label: `${row.user.name} (${row.user.email})` });
        }
        actors.sort((a, b) => a.label.localeCompare(b.label, "pt"));
        setEcoActors(actors);
      })
      .catch(() => {
        if (!cancelled) { setEcoOrgs([]); setEcoActors([]); }
      });
    return () => { cancelled = true; };
  }, []);

  const loadGov = useCallback(async (f: GovFilters) => {
    setGovLoading(true);
    setGovError(null);
    try {
      const r = await fetchResellerAudit({
        limit: f.limit,
        action: f.action.trim() || undefined,
        entityType: f.entityType.trim() || undefined,
        actorUserId: f.actorUserId.trim() || undefined,
        from: f.from ? dateToIso(f.from) : undefined,
        to: f.to ? dateToIso(f.to) : undefined,
      });
      setLogs(r.logs);
    } catch (e) {
      setGovError(e instanceof Error ? e.message : "Erro ao carregar auditoria.");
      setLogs([]);
    } finally {
      setGovLoading(false);
    }
  }, []);

  const loadNet = useCallback(async (f: NetFilters) => {
    setNetLoading(true);
    setNetError(null);
    try {
      const r = await fetchResellerNetworkActivity({
        limit: f.limit,
        organizationId: f.organizationId.trim() || undefined,
        actorUserId: f.actorUserId.trim() || undefined,
        action: f.action.trim() || undefined,
        from: f.from ? dateToIso(f.from) : undefined,
        to: f.to ? dateToIso(f.to) : undefined,
        source: f.source,
      });
      setNetItems(r.items);
    } catch (e) {
      setNetError(e instanceof Error ? e.message : "Erro ao carregar atividade.");
      setNetItems([]);
    } finally {
      setNetLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "governance") void loadGov(govApplied);
  }, [tab, govApplied, loadGov]);

  useEffect(() => {
    if (tab === "network") void loadNet(netApplied);
  }, [tab, netApplied, loadNet]);

  const govActionSelect = EXTENDED_GOV_ACTIONS.some((o) => o.value === govDraft.action) ? govDraft.action : "";
  const netActionSelect = NETWORK_ACTIVITY_ACTION_OPTIONS.some((o) => o.value === netDraft.action) ? netDraft.action : "";

  function resolveActor(userId: string | null | undefined): string {
    if (!userId) return "—";
    return actorMap.get(userId) ?? userId.slice(0, 10) + "…";
  }

  const govCsvRows = useMemo(
    () =>
      logs.map((log) => ({
        quando: formatDateBR(log.createdAt),
        acao_codigo: log.action,
        descricao: auditActionDescription(log.action, log.metadata),
        entidade: auditEntityTypeLabel(log.entityType),
        entity_id: log.entityId ?? "",
        autor: resolveActor(log.actorUserId),
        autor_id: log.actorUserId,
        metadata_json: log.metadata != null ? JSON.stringify(log.metadata) : "",
      })),
    [logs, actorMap]
  );

  const netCsvRows = useMemo(
    () =>
      netItems.map((row) => ({
        quando: formatDateBR(row.createdAt),
        origem: row.source === "automation" ? "Automação" : "Pessoa",
        empresa: row.organizationName ?? row.organizationId ?? "",
        autor: row.source === "automation" ? "Automação" : (row.actorName ?? row.actorEmail ?? resolveActor(row.actorUserId)),
        descricao: describeNetworkActivityRow(row),
        acao_codigo: row.action,
        entidade: auditEntityTypeLabel(row.entityType),
        entity_id: row.entityId ?? "",
      })),
    [netItems, actorMap]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-1">
        <h2 className="text-lg font-semibold tracking-tight">Auditoria</h2>
        <PageHint>
          <strong>Governança</strong>: alterações feitas neste painel (planos, workspaces, membros, impersonação).{" "}
          <strong>Atividade na rede</strong>: o que equipes e automação fizeram dentro das empresas (campanhas, regras, etc.).
        </PageHint>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "governance" | "network")} className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-muted/40 p-1">
          <TabsTrigger value="governance" className="text-xs sm:text-sm">Governança</TabsTrigger>
          <TabsTrigger value="network" className="text-xs sm:text-sm">Atividade nas empresas</TabsTrigger>
        </TabsList>

        {/* ─── Governança ─── */}
        <TabsContent value="governance" className="mt-0 space-y-4 focus-visible:outline-none">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tipo de ação</Label>
                <select className={selectClass} value={govActionSelect} onChange={(e) => setGovDraft((d) => ({ ...d, action: e.target.value }))}>
                  <option value="">Qualquer</option>
                  {EXTENDED_GOV_ACTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Entidade</Label>
                <select className={selectClass} value={govDraft.entityType} onChange={(e) => setGovDraft((d) => ({ ...d, entityType: e.target.value }))}>
                  {GOV_ENTITY_PRESETS.map((o) => <option key={o.value || "any"} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Autor</Label>
                <select className={selectClass} value={govDraft.actorUserId} onChange={(e) => setGovDraft((d) => ({ ...d, actorUserId: e.target.value }))}>
                  <option value="">Qualquer</option>
                  {ecoActors.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">De</Label>
                <input type="date" className={cn(selectClass, "w-[160px]")} value={govDraft.from} onChange={(e) => setGovDraft((d) => ({ ...d, from: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Até</Label>
                <input type="date" className={cn(selectClass, "w-[160px]")} value={govDraft.to} onChange={(e) => setGovDraft((d) => ({ ...d, to: e.target.value }))} />
              </div>
              <div className="flex items-end">
                <Button type="button" size="sm" variant="secondary" onClick={() => setGovApplied({ ...govDraft })}>Aplicar</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">Eventos ({logs.length})</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" className="rounded-lg" disabled={!logs.length} onClick={() => downloadCsv(`auditoria-governanca-${new Date().toISOString().slice(0, 10)}.csv`, govCsvRows as Record<string, unknown>[])}>
                  <FileDown className="mr-1.5 h-3.5 w-3.5" /> CSV
                </Button>
                <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={() => { const to = window.prompt("E-mail do destinatário"); if (!to?.trim()) return; openMailtoWithReportNote(to.trim(), "Auditoria · governança", "Anexe o ficheiro CSV exportado."); }}>
                  <Mail className="mr-1.5 h-3.5 w-3.5" /> E-mail
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {govLoading ? (
                <div className="flex items-center gap-2 py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Carregando…</div>
              ) : govError ? (
                <p className="text-sm text-destructive">{govError}</p>
              ) : logs.length === 0 ? (
                <p className="py-6 text-sm text-muted-foreground">Nenhum evento com estes filtros.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs font-semibold uppercase text-muted-foreground">
                        <th className="py-2 pr-3">Quando</th>
                        <th className="py-2 pr-3">O quê</th>
                        <th className="py-2 pr-3">Entidade</th>
                        <th className="py-2 pr-3">Autor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id} className="border-b border-border/50 align-top">
                          <td className="whitespace-nowrap py-3 pr-3 text-xs text-muted-foreground">{formatDateBR(log.createdAt)}</td>
                          <td className="max-w-[min(100vw,380px)] py-3 pr-3 text-sm leading-snug">
                            <span className="font-medium text-foreground">{auditActionDescription(log.action, log.metadata)}</span>
                            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{log.action}</p>
                          </td>
                          <td className="py-3 pr-3 text-xs">
                            {auditEntityTypeLabel(log.entityType)}
                            {log.entityId ? <p className="mt-0.5 max-w-[120px] truncate font-mono text-[10px] text-muted-foreground" title={log.entityId}>{log.entityId}</p> : null}
                          </td>
                          <td className="max-w-[220px] py-3 pr-3 text-xs leading-snug">
                            <span className="font-medium text-foreground">{resolveActor(log.actorUserId)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Atividade na rede ─── */}
        <TabsContent value="network" className="mt-0 space-y-4 focus-visible:outline-none">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Origem</Label>
                <select className={selectClass} value={netDraft.source} onChange={(e) => setNetDraft((d) => ({ ...d, source: e.target.value as NetFilters["source"] }))}>
                  <option value="all">Todas (pessoas + automação)</option>
                  <option value="user">Só pessoas</option>
                  <option value="automation">Só automação</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Empresa</Label>
                <select className={selectClass} value={netDraft.organizationId} onChange={(e) => setNetDraft((d) => ({ ...d, organizationId: e.target.value }))}>
                  <option value="">Todas na rede</option>
                  {ecoOrgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Quem executou</Label>
                <select className={selectClass} value={netDraft.actorUserId} onChange={(e) => setNetDraft((d) => ({ ...d, actorUserId: e.target.value }))} disabled={netDraft.source === "automation"}>
                  <option value="">Qualquer</option>
                  {ecoActors.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo de ação</Label>
                <select className={selectClass} value={netActionSelect} onChange={(e) => setNetDraft((d) => ({ ...d, action: e.target.value }))}>
                  <option value="">Qualquer</option>
                  {NETWORK_ACTIVITY_ACTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">De</Label>
                <input type="date" className={cn(selectClass, "w-[160px]")} value={netDraft.from} onChange={(e) => setNetDraft((d) => ({ ...d, from: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Até</Label>
                <input type="date" className={cn(selectClass, "w-[160px]")} value={netDraft.to} onChange={(e) => setNetDraft((d) => ({ ...d, to: e.target.value }))} />
              </div>
              <div className="flex items-end">
                <Button type="button" size="sm" variant="secondary" onClick={() => setNetApplied({ ...netDraft })}>Aplicar</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">Linha do tempo ({netItems.length})</CardTitle>
              <Button type="button" size="sm" variant="outline" disabled={!netItems.length} onClick={() => downloadCsv(`atividade-rede-${new Date().toISOString().slice(0, 10)}.csv`, netCsvRows as Record<string, unknown>[])}>
                <FileDown className="mr-1.5 h-3.5 w-3.5" /> CSV
              </Button>
            </CardHeader>
            <CardContent>
              {netLoading ? (
                <div className="flex items-center gap-2 py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Carregando…</div>
              ) : netError ? (
                <p className="text-sm text-destructive">{netError}</p>
              ) : netItems.length === 0 ? (
                <p className="py-6 text-sm text-muted-foreground">Nenhum evento com estes filtros.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs font-semibold uppercase text-muted-foreground">
                        <th className="py-2 pr-3">Quando</th>
                        <th className="py-2 pr-3">Origem</th>
                        <th className="py-2 pr-3">Empresa</th>
                        <th className="py-2 pr-3">Quem</th>
                        <th className="py-2 pr-3">O quê</th>
                      </tr>
                    </thead>
                    <tbody>
                      {netItems.map((row) => (
                        <tr key={row.id} className="border-b border-border/50 align-top">
                          <td className="whitespace-nowrap py-3 pr-3 text-xs text-muted-foreground">{formatDateBR(row.createdAt)}</td>
                          <td className="py-3 pr-3 text-xs">
                            {row.source === "automation" ? (
                              <span className="rounded-full bg-violet-500/15 px-2 py-0.5 font-medium text-violet-800 dark:text-violet-200">Automação</span>
                            ) : (
                              <span className="rounded-full bg-sky-500/15 px-2 py-0.5 font-medium text-sky-900 dark:text-sky-100">Pessoa</span>
                            )}
                          </td>
                          <td className="py-3 pr-3 text-sm">{row.organizationName ?? "—"}</td>
                          <td className="max-w-[220px] py-3 pr-3 text-xs leading-snug">
                            {row.source === "automation" ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <>
                                <span className="font-medium text-foreground">{row.actorName ?? resolveActor(row.actorUserId)}</span>
                                {row.actorEmail ? <p className="text-muted-foreground">{row.actorEmail}</p> : null}
                              </>
                            )}
                          </td>
                          <td className="max-w-[min(100vw,420px)] py-3 pr-3 text-sm leading-snug">
                            <span className="font-medium text-foreground">{describeNetworkActivityRow(row)}</span>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {auditEntityTypeLabel(row.entityType)} · <span className="font-mono">{row.action}</span>
                            </p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
