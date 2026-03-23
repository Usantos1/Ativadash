import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchResellerAudit, type ResellerAuditRow } from "@/lib/revenda-api";

type AuditFilters = {
  limit: number;
  action: string;
  entityType: string;
  actorUserId: string;
  from: string;
  to: string;
};

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Auditoria</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Trilha de ações administrativas do painel master (matriz). Filtre por ação, tipo de entidade, autor e intervalo
          (ISO 8601).
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>Datas em formato ISO, ex.: 2025-03-01T00:00:00.000Z</CardDescription>
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
            <Label className="text-xs">Ação</Label>
            <Input
              className="w-[160px]"
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
            <Input className="w-[220px]" value={draft.from} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} />
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
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Eventos</CardTitle>
          <CardDescription>Ordenados do mais recente ao mais antigo.</CardDescription>
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
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-semibold uppercase text-muted-foreground">
                    <th className="py-2 pr-3">Quando</th>
                    <th className="py-2 pr-3">Ação</th>
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
                      <td className="py-3 pr-3">
                        {log.entityType}
                        {log.metadata != null && typeof log.metadata === "object" ? (
                          <pre className="mt-1 max-w-[280px] overflow-x-auto rounded bg-muted/50 p-2 text-[10px] leading-tight">
                            {JSON.stringify(log.metadata)}
                          </pre>
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
