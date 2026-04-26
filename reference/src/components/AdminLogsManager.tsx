import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminLogs, type UnifiedLogEntry, type LogCategory, LOG_CATEGORY_LABELS } from '@/hooks/useAdminLogs';
import { useUsers } from '@/hooks/useUsers';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Activity, Filter, RefreshCw, Receipt, Package, Wrench, XCircle, Trash2, Wallet, Clock, ListTodo, User, MoreHorizontal } from 'lucide-react';

const CATEGORY_ICONS: Record<LogCategory, React.ReactNode> = {
  todos: <Activity className="h-4 w-4" />,
  vendas: <Receipt className="h-4 w-4" />,
  produtos: <Package className="h-4 w-4" />,
  os: <Wrench className="h-4 w-4" />,
  cancelamentos: <XCircle className="h-4 w-4" />,
  exclusoes: <Trash2 className="h-4 w-4" />,
  caixa: <Wallet className="h-4 w-4" />,
  ponto: <Clock className="h-4 w-4" />,
  tarefas_processos: <ListTodo className="h-4 w-4" />,
  usuarios: <User className="h-4 w-4" />,
  outros: <MoreHorizontal className="h-4 w-4" />,
};

export const AdminLogsManager = () => {
  const { logs, loading, error, refetch } = useAdminLogs();
  const { users } = useUsers();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<string>('todos');

  const getUserName = (log: UnifiedLogEntry) => {
    if (log.user_name && log.user_name !== 'Usuário') return log.user_name;
    if (!log.user_id) return 'Sistema';
    const u = users.find((x: any) => x.id === log.user_id);
    return u?.display_name || u?.email || 'Usuário';
  };

  const getBadgeVariant = (category: LogCategory): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (category === 'exclusoes' || category === 'cancelamentos') return 'destructive';
    if (category === 'vendas' || category === 'os') return 'default';
    if (category === 'ponto' || category === 'caixa') return 'outline';
    return 'secondary';
  };

  const filteredLogs = useMemo(() => {
    const category = activeTab as LogCategory;
    let list = logs;
    if (category !== 'todos') {
      list = list.filter((log) => log.category === category);
    }
    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase();
    return list.filter((log) => {
      const name = getUserName(log);
      return (
        name.toLowerCase().includes(term) ||
        log.description.toLowerCase().includes(term) ||
        (log.action_label || '').toLowerCase().includes(term) ||
        (log.entity_type || '').toLowerCase().includes(term)
      );
    });
  }, [logs, activeTab, searchTerm, users]);

  const stats = useMemo(() => {
    const totalLogs = logs.length;
    const uniqueUsers = new Set(logs.map((l) => l.user_id).filter(Boolean)).size;
    const today = new Date().toDateString();
    const todayLogs = logs.filter((l) => new Date(l.created_at).toDateString() === today).length;
    const byCategory = logs.reduce((acc, l) => {
      acc[l.category] = (acc[l.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return { totalLogs, uniqueUsers, todayLogs, byCategory };
  }, [logs]);

  return (
    <div className="space-y-4 md:space-y-6 px-1 md:px-0">
      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <Card className="border-2 border-gray-300 border-l-4 border-l-blue-500 shadow-sm bg-blue-50/50 md:bg-transparent">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-sm font-medium text-blue-700 md:text-muted-foreground">Total de registros</p>
                <p className="text-base md:text-2xl font-bold text-blue-700 md:text-foreground">{stats.totalLogs}</p>
              </div>
              <Activity className="h-3 w-3 md:h-5 md:w-5 text-blue-600 md:text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-gray-300 border-l-4 border-l-green-500 shadow-sm bg-green-50/50 md:bg-transparent">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-sm font-medium text-green-700 md:text-muted-foreground">Usuários ativos</p>
                <p className="text-base md:text-2xl font-bold text-green-700 md:text-foreground">{stats.uniqueUsers}</p>
              </div>
              <User className="h-3 w-3 md:h-5 md:w-5 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-gray-300 border-l-4 border-l-indigo-500 shadow-sm bg-indigo-50/50 md:bg-transparent">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-sm font-medium text-indigo-700 md:text-muted-foreground">Logs hoje</p>
                <p className="text-base md:text-2xl font-bold text-indigo-700 md:text-foreground">{stats.todayLogs}</p>
              </div>
              <Clock className="h-3 w-3 md:h-5 md:w-5 text-indigo-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-gray-300 border-l-4 border-l-orange-500 shadow-sm bg-orange-50/50 md:bg-transparent">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] md:text-sm font-medium text-orange-700 md:text-muted-foreground">Vendas (últimos)</p>
                <p className="text-xs md:text-lg font-bold text-orange-700 md:text-foreground truncate">{stats.byCategory.vendas ?? 0}</p>
              </div>
              <Receipt className="h-3 w-3 md:h-5 md:w-5 text-orange-600 flex-shrink-0 ml-1" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-2 border-gray-300 shadow-sm">
        <CardHeader className="pb-3 pt-3 md:pt-6 px-3 md:px-6 border-b-2 border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base md:text-xl">
              <div className="p-1.5 md:p-2 rounded-lg bg-gradient-to-br from-gray-100 to-white border-2 border-gray-200">
                <Activity className="h-4 w-4 md:h-5 md:w-5 text-gray-600" />
              </div>
              Logs do sistema
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-3 md:p-6 space-y-3 md:space-y-4">
          {/* Abas por categoria */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between flex-wrap">
              <TabsList className="flex flex-wrap h-auto gap-1 bg-muted p-1.5 w-full sm:w-auto">
                {(Object.keys(LOG_CATEGORY_LABELS) as LogCategory[]).map((cat) => (
                  <TabsTrigger key={cat} value={cat} className="gap-1.5 text-xs px-2 py-1.5 data-[state=active]:bg-background">
                    {CATEGORY_ICONS[cat]}
                    <span className="hidden xs:inline">{LOG_CATEGORY_LABELS[cat]}</span>
                    {cat !== 'todos' && (stats.byCategory[cat] ?? 0) > 0 && (
                      <Badge variant="secondary" className="ml-0.5 h-5 px-1 text-[10px]">
                        {stats.byCategory[cat]}
                      </Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
              <div className="relative flex-1 min-w-[180px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por usuário, descrição..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-9 md:h-10 text-base md:text-sm border-2 border-gray-300"
                />
              </div>
            </div>

            <TabsContent value={activeTab} className="mt-4 focus:outline-none">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 mb-4">
                  {error}
                </div>
              )}
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                  <p className="mt-2 text-sm md:text-base text-muted-foreground">Carregando logs...</p>
                </div>
              ) : (
                <>
                  <div className="hidden md:block overflow-x-auto border-2 border-gray-300 rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b-2 border-gray-300">
                          <TableHead className="font-semibold">Data/Hora</TableHead>
                          <TableHead className="font-semibold">Usuário</TableHead>
                          <TableHead className="font-semibold">Categoria</TableHead>
                          <TableHead className="font-semibold">Ação</TableHead>
                          <TableHead className="font-semibold">Descrição</TableHead>
                          <TableHead className="font-semibold">Entidade</TableHead>
                          <TableHead className="font-semibold">IP</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLogs.map((log) => (
                          <TableRow key={log.id} className="border-b border-gray-200 hover:bg-gray-50/50">
                            <TableCell className="text-sm whitespace-nowrap">
                              {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                            </TableCell>
                            <TableCell className="font-medium text-sm">{getUserName(log)}</TableCell>
                            <TableCell>
                              <Badge variant={getBadgeVariant(log.category)}>{LOG_CATEGORY_LABELS[log.category]}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">{log.action_label}</TableCell>
                            <TableCell>
                              <div className="max-w-xs truncate text-sm" title={log.description}>
                                {log.description}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {log.entity_type ? (
                                <>
                                  <span className="font-medium">{log.entity_type}</span>
                                  {log.entity_id && (
                                    <div className="text-muted-foreground text-xs font-mono">{String(log.entity_id).slice(0, 8)}…</div>
                                  )}
                                </>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm font-mono">{log.ip_address || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="md:hidden space-y-3">
                    {filteredLogs.map((log) => (
                      <Card key={log.id} className="border-2 border-gray-300 shadow-sm">
                        <CardContent className="p-3">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm">{getUserName(log)}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                                </p>
                              </div>
                              <Badge variant={getBadgeVariant(log.category)}>{LOG_CATEGORY_LABELS[log.category]}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{log.action_label}</p>
                            <div className="pt-2 border-t border-gray-200">
                              <p className="text-sm">{log.description}</p>
                            </div>
                            {(log.entity_type || log.ip_address) && (
                              <div className="pt-2 border-t border-gray-200 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                {log.entity_type && <span>{log.entity_type}</span>}
                                {log.ip_address && <span className="font-mono">{log.ip_address}</span>}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {filteredLogs.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Nenhum log encontrado para esta categoria ou busca.
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
