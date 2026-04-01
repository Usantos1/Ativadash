import { useCallback, useEffect, useMemo, useState } from "react";
import { FileDown, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JsonViewer } from "@/components/ui/json-viewer";
import { PageHint } from "@/pages/revenda/PageHint";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { auditActionDescription, AUDIT_ACTION_FILTER_PRESETS } from "@/lib/audit-humanize";
import { downloadCsv, openMailtoWithReportNote } from "@/lib/export-csv";
import { fetchResellerAudit, type ResellerAuditRow } from "@/lib/revenda-api";
import { cn } from "@/lib/utils";

type AuditFilters = {
  limit: number;
  action: string;
  entityType: string;
  actorUserId: string;
  from: string;
  to: string;
};

const ACTION_PRESETS = AUDIT_ACTION_FILTER_PRESETS as readonly string[];

export function RevendaAuditPage() {
  const [logs, setLogs] = useState<ResellerAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<AuditFilters>({
    limit: 80,
    action: "",
    entityType: "",
    actorUserId: "",
    from: "",
    to: "",
  });
  const [draft, setDraft] = useState<AuditFilters>(applied);

  const load = useCallback(async (f: AuditFilters) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchResellerAudit({
        limit: f.limit,
        action: f.action.trim() || undefined,
        entityType: f.entityType.trim() || undefined,
        actorUserId: f.actorUserId.trim() || undefined,
        from: f.from.trim() || undefined,
        to: f.to.trim() || undefined,
      });
      setLogs(r.logs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar auditoria.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(applied);
  }, [applied, load]);

  function applyDraft() {
    setApplied({ ...draft });
  }

  const actionSelectValue = ACTION_PRESETS.includes(draft.action) ? draft.action : "";

  const csvRows = useMemo(
    () =>
      logs.map((log) => ({
        quando: log.createdAt,
        acao: log.action,
        descricao: auditActionDescription(log.action, log.metadata),
        entidade: log.entityType,
        entity_id: log.entityId ?? "",
        autor: log.actorUserId,
        metadata_json:
          log.metadata !== undefined && log.metadata !== null ? JSON.stringify(log.metadata) : "",
      })),
    [logs]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1">
        <h2 className="text-lg font-semibold tracking-tight">Auditoria</h2>
        <PageHint>Histórico de mudanças. Datas em ISO 8601 (ex.: 2026-03-01T00:00:00.000Z).</PageHint>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Limite</Label>
            <Input
              type="number"
              min={1}
              max={200}
              className="w-[88px]"
              value={draft.limit}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  limit: Math.min(200, Math.max(1, parseInt(e.target.value, 10) || 50)),
                }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ação (preset)</Label>
            <select
              className={cn(
                "flex h-9 w-[min(100%,220px)] rounded-lg border border-input bg-background px-3 text-sm shadow-sm",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
              value={actionSelectValue}
              onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value }))}
            >
              <option value="">Qualquer</option>
              {ACTION_PRESETS.filter((a) => a.length > 0).map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ação (texto exato)</Label>
            <Input
              className="w-[200px]"
              value={draft.action}
              onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value }))}
              placeholder="ex. PLAN_CREATED"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Entidade</Label>
            <Input
              className="w-[140px]"
              value={draft.entityType}
              onChange={(e) => setDraft((d) => ({ ...d, entityType: e.target.value }))}
              placeholder="Organization"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Autor (user id)</Label>
            <Input
              className="w-[200px]"
              value={draft.actorUserId}
              onChange={(e) => setDraft((d) => ({ ...d, actorUserId: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">De</Label>
            <Input
              className="w-[220px]"
              value={draft.from}
              onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Até</Label>
            <Input className="w-[220px]" value={draft.to} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} />
          </div>
          <div className="flex items-end">
            <Button type="button" size="sm" variant="secondary" onClick={applyDraft}>
              Aplicar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Eventos</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-lg"
              disabled={!logs.length}
              onClick={() =>
                downloadCsv(`auditoria-matriz-${new Date().toISOString().slice(0, 10)}.csv`, csvRows as Record<string, unknown>[])
              }
            >
              <FileDown className="mr-1.5 h-3.5 w-3.5" />
              Exportar CSV
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-lg"
              onClick={() => {
                const to = window.prompt("E-mail do destinatário");
                if (!to?.trim()) return;
                openMailtoWithReportNote(
                  to.trim(),
                  "Auditoria matriz · exportação CSV",
                  "Anexe o ficheiro CSV exportado pelo painel."
                );
              }}
            >
              <Mail className="mr-1.5 h-3.5 w-3.5" />
              E-mail
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando…
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-semibold uppercase text-muted-foreground">
                    <th className="py-2 pr-3">Quando</th>
                    <th className="py-2 pr-3">Ação</th>
                    <th className="py-2 pr-3">Descrição</th>
                    <th className="py-2 pr-3">Entidade</th>
                    <th className="py-2 pr-3">ID</th>
                    <th className="py-2 pr-3">Autor</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-border/50 align-top">
                      <td className="py-3 pr-3 whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString("pt-BR")}
                      </td>
                      <td className="py-3 pr-3 font-mono text-xs">{log.action}</td>
                      <td className="max-w-[220px] py-3 pr-3 text-xs leading-snug text-foreground">
                        {auditActionDescription(log.action, log.metadata)}
                      </td>
                      <td className="max-w-[min(100vw,320px)] py-3 pr-3 text-xs">
                        <span className="font-medium">{log.entityType}</span>
                        {log.metadata != null && typeof log.metadata === "object" ? (
                          <JsonViewer data={log.metadata} className="mt-2 max-w-sm" />
                        ) : null}
                      </td>
                      <td className="py-3 pr-3 font-mono text-[10px] text-muted-foreground">{log.entityId ?? "—"}</td>
                      <td className="py-3 pr-3 font-mono text-[10px] text-muted-foreground">{log.actorUserId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
