import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchResellerAudit, type ResellerAuditRow } from "@/lib/revenda-api";

export function RevendaAuditPage() {
  const [logs, setLogs] = useState<ResellerAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchResellerAudit(100);
      setLogs(r.logs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar auditoria.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Auditoria</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Trilha de ações administrativas do painel master (matriz). Eventos como criação de empresas, governança, usuários e
          acesso em contexto de filial.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Últimos eventos</CardTitle>
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
                          <pre className="mt-1 max-w-[240px] overflow-x-auto rounded bg-muted/50 p-2 text-[10px] leading-tight">
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
