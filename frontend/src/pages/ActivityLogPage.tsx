import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarRange, Filter, Loader2, RefreshCw, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppMainRouteBody } from "@/components/layout/AppMainRouteBody";
import { PageHeaderPremium } from "@/components/premium";
import { formatPageTitle, usePageTitle } from "@/hooks/usePageTitle";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";
import { fetchOrganizationAuditLogs, type AuditLogRow } from "@/lib/audit-log-api";
import { auditActionDescription, auditEntityTypeLabel, NETWORK_ACTIVITY_ACTION_OPTIONS } from "@/lib/audit-humanize";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const PAGE_SIZE = 50;

export function ActivityLogPage() {
  const user = useAuthStore((s) => s.user);
  const ws = user?.organization?.name?.trim();
  usePageTitle(formatPageTitle(ws ? ["Log de Atividades", ws] : ["Log de Atividades"]));

  const [items, setItems] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);

  const [filterAction, setFilterAction] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [searchText, setSearchText] = useState("");
  const debouncedSearch = useDebouncedValue(searchText, 300);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchOrganizationAuditLogs({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        action: filterAction || undefined,
        actorUserId: filterUser || undefined,
        startDate: filterStartDate || undefined,
        endDate: filterEndDate || undefined,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, filterAction, filterUser, filterStartDate, filterEndDate]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const uniqueActors = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const item of items) {
      if (!map.has(item.actorUserId)) {
        map.set(item.actorUserId, {
          id: item.actorUserId,
          name: item.actorName ?? item.actorEmail ?? item.actorUserId.slice(0, 8),
        });
      }
    }
    return Array.from(map.values());
  }, [items]);

  const filteredItems = useMemo(() => {
    if (!debouncedSearch) return items;
    const q = debouncedSearch.toLowerCase();
    return items.filter((item) => {
      const desc = auditActionDescription(item.action, item.metadata).toLowerCase();
      const actor = (item.actorName ?? item.actorEmail ?? "").toLowerCase();
      return desc.includes(q) || actor.includes(q) || item.action.includes(q);
    });
  }, [items, debouncedSearch]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  };
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const actionColor = (action: string) => {
    if (action.includes("delete") || action.includes("removed") || action.includes("revoked")) {
      return "text-red-600 dark:text-red-400";
    }
    if (action.includes("create") || action.includes("login")) {
      return "text-emerald-600 dark:text-emerald-400";
    }
    if (action.includes("update") || action.includes("changed") || action.includes("password")) {
      return "text-amber-600 dark:text-amber-400";
    }
    return "text-blue-600 dark:text-blue-400";
  };

  return (
    <AppMainRouteBody>
      <PageHeaderPremium
        title="Log de Atividades"
        subtitle="Histórico completo de ações dos colaboradores nesta empresa."
      />

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Ações registradas</CardTitle>
              <CardDescription>{total} registro{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={loadLogs} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>

          {/* Filtros */}
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="h-9 pl-8 text-xs"
                placeholder="Buscar ação ou usuário..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>

            <div className="relative">
              <Filter className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <select
                className="h-9 w-full rounded-md border bg-background pl-8 pr-2 text-xs"
                value={filterAction}
                onChange={(e) => { setFilterAction(e.target.value); setPage(0); }}
              >
                <option value="">Todas as ações</option>
                {NETWORK_ACTIVITY_ACTION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="relative">
              <Users className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <select
                className="h-9 w-full rounded-md border bg-background pl-8 pr-2 text-xs"
                value={filterUser}
                onChange={(e) => { setFilterUser(e.target.value); setPage(0); }}
              >
                <option value="">Todos os usuários</option>
                {uniqueActors.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div className="relative">
              <CalendarRange className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="date"
                className="h-9 pl-8 text-xs"
                value={filterStartDate}
                onChange={(e) => { setFilterStartDate(e.target.value); setPage(0); }}
                placeholder="Data início"
              />
            </div>

            <div className="relative">
              <CalendarRange className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="date"
                className="h-9 pl-8 text-xs"
                value={filterEndDate}
                onChange={(e) => { setFilterEndDate(e.target.value); setPage(0); }}
                placeholder="Data fim"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando...
            </div>
          ) : filteredItems.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma atividade registrada{filterAction || filterUser || filterStartDate ? " para os filtros selecionados" : ""}.
            </p>
          ) : (
            <div className="space-y-0.5">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-border/50 hover:bg-muted/40"
                >
                  <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold uppercase", actionColor(item.action))}>
                    {(item.actorName ?? item.actorEmail ?? "?").charAt(0)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium truncate">
                        {item.actorName ?? item.actorEmail ?? "Usuário"}
                      </span>
                      {item.actorEmail && item.actorName && (
                        <span className="text-[10px] text-muted-foreground truncate hidden sm:inline">
                          {item.actorEmail}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground/80">
                      {auditActionDescription(item.action, item.metadata)}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="inline-flex items-center rounded-full border px-1.5 py-px font-medium">
                        {auditEntityTypeLabel(item.entityType)}
                      </span>
                      <span>{formatDate(item.createdAt)} às {formatTime(item.createdAt)}</span>
                      {item.ip && <span className="hidden md:inline">IP: {item.ip}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t pt-3">
              <span className="text-xs text-muted-foreground">
                Página {page + 1} de {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </AppMainRouteBody>
  );
}
