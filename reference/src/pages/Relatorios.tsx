import { useEffect, useMemo, useState } from 'react';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ModernLayout } from '@/components/ModernLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calendar,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  User,
  BarChart3,
  Wrench,
  CreditCard,
  Package,
  Truck,
  Warehouse,
  ClipboardList,
  RotateCcw,
  Users,
  Shield,
  Wallet,
  MessageCircle,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSalesSummary, useTechnicianProductivity, ReportFilters } from '@/hooks/useReports';
import { useServerReportsQueries } from '@/hooks/useServerReports';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardExecutivo } from '@/hooks/useFinanceiro';
import { useCargos } from '@/hooks/useCargos';
import { TrendCharts } from '@/components/dashboard/TrendCharts';
import { currencyFormatters } from '@/utils/formatters';
import { getStoredValuesVisible, ValuesVisibilityToggle, MASKED_VALUE } from '@/components/dashboard/FinancialCards';
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/types/pdv';
import type { DashboardTrendData } from '@/hooks/useDashboardData';
import { useNavigate, useParams } from 'react-router-dom';

type ReportTabId =
  | 'summary'
  | 'productivity'
  | 'payments'
  | 'products'
  | 'purchases'
  | 'stock'
  | 'assistencia'
  | 'refunds'
  | 'clients'
  | 'cash'
  | 'cancellations'
  | 'followup'
  | 'audit';

const REPORT_TAB_SLUGS: Record<ReportTabId, string> = {
  summary: 'resumo-geral',
  productivity: 'produtividade',
  payments: 'pagamentos',
  products: 'produtos',
  purchases: 'compras-fornecedores',
  stock: 'estoque',
  assistencia: 'assistencia',
  refunds: 'devolucoes',
  clients: 'clientes',
  cash: 'caixa',
  cancellations: 'cancelamentos',
  followup: 'pos-venda',
  audit: 'auditoria',
};

const REPORT_SLUG_TO_TAB = Object.fromEntries(
  Object.entries(REPORT_TAB_SLUGS).map(([tabId, slug]) => [slug, tabId as ReportTabId])
) as Record<string, ReportTabId>;

function numVal(v: string | number | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function paymentLabel(code: string) {
  return PAYMENT_METHOD_LABELS[code as PaymentMethod] ?? code;
}

function followupRuleLabel(rule: string) {
  if (rule === 'NEXT_DAY_10AM') return 'Próximo dia às 10h';
  if (rule === 'AFTER_24H') return '24h após faturamento';
  return rule;
}

function queryErr(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return 'Erro ao carregar';
}

export default function Relatorios() {
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();
  const [startDate, setStartDate] = useState<Date | undefined>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  });
  const [endDate, setEndDate] = useState<Date | undefined>(() => new Date());
  const [technicianId, setTechnicianId] = useState<string>('all');
  const [saleOrigin, setSaleOrigin] = useState<'PDV' | 'OS' | 'all'>('all');
  const [paymentMethod, setPaymentMethod] = useState<string>('all');
  const [valuesVisible, setValuesVisible] = useState(getStoredValuesVisible);
  const fmt = (n: number) => (valuesVisible ? currencyFormatters.brl(n) : MASKED_VALUE);
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const activeTab = useMemo<ReportTabId>(() => {
    if (!tab) return 'summary';
    const mapped = REPORT_SLUG_TO_TAB[tab];
    if (!mapped) return 'summary';
    if (!isAdmin && mapped === 'audit') return 'summary';
    return mapped;
  }, [tab, isAdmin]);

  const filters: ReportFilters = useMemo(
    () => ({
      startDate: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
      endDate: endDate ? format(endDate, 'yyyy-MM-dd') : undefined,
      technicianId: technicianId !== 'all' ? technicianId : undefined,
      saleOrigin: saleOrigin !== 'all' ? saleOrigin : undefined,
      paymentMethod: paymentMethod !== 'all' ? paymentMethod : undefined,
    }),
    [startDate, endDate, technicianId, saleOrigin, paymentMethod]
  );

  const { data: summary, isLoading: isLoadingSummary } = useSalesSummary(filters);
  const { data: productivity, isLoading: isLoadingProductivity } = useTechnicianProductivity(filters);
  const { tecnicos, isLoading: isLoadingTecnicos } = useCargos();
  const { data: financeiroDashboard } = useDashboardExecutivo(filters.startDate, filters.endDate);

  const serverReports = useServerReportsQueries(filters.startDate, filters.endDate, activeTab, !!isAdmin);

  useEffect(() => {
    if (tab && !REPORT_SLUG_TO_TAB[tab]) {
      navigate('/relatorios/resumo-geral', { replace: true });
    }
  }, [tab, navigate]);

  useEffect(() => {
    if (!isAdmin && activeTab === 'audit') {
      navigate('/relatorios/resumo-geral', { replace: true });
    }
  }, [isAdmin, activeTab, navigate]);

  const paymentMethods = [
    { value: 'all', label: 'Todas' },
    { value: 'dinheiro', label: PAYMENT_METHOD_LABELS.dinheiro },
    { value: 'pix', label: PAYMENT_METHOD_LABELS.pix },
    { value: 'debito', label: PAYMENT_METHOD_LABELS.debito },
    { value: 'credito', label: PAYMENT_METHOD_LABELS.credito },
    { value: 'link_pagamento', label: PAYMENT_METHOD_LABELS.link_pagamento },
    { value: 'carteira_digital', label: PAYMENT_METHOD_LABELS.carteira_digital },
    { value: 'fiado', label: PAYMENT_METHOD_LABELS.fiado },
  ];

  const trendChartData: DashboardTrendData[] = useMemo(() => {
    const applyOrigin = (arr: DashboardTrendData[]): DashboardTrendData[] => {
      if (saleOrigin === 'PDV') return arr.map((p) => ({ ...p, totalOS: 0, faturamento_os: 0, totalGeral: p.totalPDV }));
      if (saleOrigin === 'OS') return arr.map((p) => ({ ...p, totalPDV: 0, vendas: 0, totalGeral: p.totalOS }));
      return arr;
    };
    if (!financeiroDashboard?.tendencia?.length || !filters.startDate || !filters.endDate) {
      if (financeiroDashboard?.tendencia?.length) {
        const raw = financeiroDashboard.tendencia.map((t) => {
          const rawD = t?.data;
          const dateStr = typeof rawD === 'string' ? rawD.trim().slice(0, 10) : '';
          const d = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
          return {
            date: dateStr ? format(d, 'dd/MM', { locale: ptBR }) : '–',
            data: dateStr,
            vendas: t.totalPDV ?? 0,
            os: 0,
            faturamento_os: t.totalOS ?? 0,
            totalPDV: t.totalPDV ?? 0,
            totalOS: t.totalOS ?? 0,
            totalGeral: t.totalGeral ?? 0,
          };
        });
        return applyOrigin(raw);
      }
      return [];
    }
    const start = new Date(filters.startDate + 'T12:00:00');
    const end = new Date(filters.endDate + 'T12:00:00');
    const byDate = new Map<string, DashboardTrendData>();
    financeiroDashboard.tendencia.forEach((t) => {
      const rawStr = typeof t?.data === 'string' ? t.data.trim() : '';
      if (!rawStr || rawStr.length < 10) return;
      const dateStr = rawStr.slice(0, 10);
      if (dateStr < filters.startDate! || dateStr > filters.endDate!) return;
      const d = new Date(dateStr + 'T12:00:00');
      if (Number.isNaN(d.getTime())) return;
      byDate.set(dateStr, {
        date: format(d, 'dd/MM', { locale: ptBR }),
        data: dateStr,
        vendas: t.totalPDV ?? 0,
        os: 0,
        faturamento_os: t.totalOS ?? 0,
        totalPDV: t.totalPDV ?? 0,
        totalOS: t.totalOS ?? 0,
        totalGeral: t.totalGeral ?? 0,
      });
    });
    const result: DashboardTrendData[] = [];
    let cur = new Date(start);
    while (cur <= end) {
      const dateStr = format(cur, 'yyyy-MM-dd');
      const dateLabel = format(cur, 'dd/MM', { locale: ptBR });
      result.push(
        byDate.get(dateStr) ?? {
          date: dateLabel,
          data: dateStr,
          vendas: 0,
          os: 0,
          faturamento_os: 0,
          totalPDV: 0,
          totalOS: 0,
          totalGeral: 0,
        }
      );
      cur = addDays(cur, 1);
    }
    return applyOrigin(result);
  }, [financeiroDashboard?.tendencia, filters.startDate, filters.endDate, saleOrigin]);

  const handleTabChange = (tabValue: string) => {
    const nextTab = tabValue as ReportTabId;
    navigate(`/relatorios/${REPORT_TAB_SLUGS[nextTab]}`);
  };

  return (
    <ModernLayout
      title="Relatórios"
      subtitle="Vendas, tendências e produtividade"
      headerActions={<ValuesVisibilityToggle valuesVisible={valuesVisible} setValuesVisible={setValuesVisible} />}
    >
      <div className="flex flex-col gap-3 md:gap-4 pb-6">
        {/* Filtros */}
        <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm flex-shrink-0">
          <CardContent className="p-3 md:p-4">
            <div className="md:hidden grid grid-cols-2 gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 text-xs justify-start border-gray-300 dark:border-gray-600">
                    <Calendar className="h-3 w-3 mr-1" />
                    {startDate ? format(startDate, 'dd/MM', { locale: ptBR }) : 'Início'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent mode="single" selected={startDate} onSelect={setStartDate} locale={ptBR} />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 text-xs justify-start border-gray-300 dark:border-gray-600">
                    <Calendar className="h-3 w-3 mr-1" />
                    {endDate ? format(endDate, 'dd/MM', { locale: ptBR }) : 'Fim'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent mode="single" selected={endDate} onSelect={setEndDate} locale={ptBR} />
                </PopoverContent>
              </Popover>
              <Select value={saleOrigin} onValueChange={(v: 'PDV' | 'OS' | 'all') => setSaleOrigin(v)}>
                <SelectTrigger className="h-9 text-xs border-gray-300 dark:border-gray-600">
                  <SelectValue placeholder="Origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="PDV">PDV</SelectItem>
                  <SelectItem value="OS">OS</SelectItem>
                </SelectContent>
              </Select>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-9 text-xs border-gray-300 dark:border-gray-600">
                  <SelectValue placeholder="Pagamento" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="hidden md:grid grid-cols-5 gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Data Início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal h-10 border-gray-300 dark:border-gray-600', !startDate && 'text-muted-foreground')}>
                      <Calendar className="mr-2 h-4 w-4" />
                      <span className="truncate">{startDate ? format(startDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Data'}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent mode="single" selected={startDate} onSelect={setStartDate} locale={ptBR} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Data Fim</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal h-10 border-gray-300 dark:border-gray-600', !endDate && 'text-muted-foreground')}>
                      <Calendar className="mr-2 h-4 w-4" />
                      <span className="truncate">{endDate ? format(endDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Data'}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent mode="single" selected={endDate} onSelect={setEndDate} locale={ptBR} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Origem</Label>
                <Select value={saleOrigin} onValueChange={(v: 'PDV' | 'OS' | 'all') => setSaleOrigin(v)}>
                  <SelectTrigger className="h-10 border-gray-300 dark:border-gray-600">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="PDV">PDV</SelectItem>
                    <SelectItem value="OS">OS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Técnico</Label>
                <Select value={technicianId} onValueChange={setTechnicianId} disabled={isLoadingTecnicos}>
                  <SelectTrigger className="h-10 border-gray-300 dark:border-gray-600">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {tecnicos.map((tec) => (
                      <SelectItem key={tec.id} value={tec.id}>{tec.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Forma de Pagamento</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="h-10 border-gray-300 dark:border-gray-600">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Conteúdo com Tabs — overflow-visible e espaço inferior para não cortar o widget */}
        <div className="w-full min-w-0 overflow-visible">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4 overflow-visible">
            <TabsList className="h-auto flex w-full flex-wrap gap-2 p-2 pb-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl items-stretch justify-start overflow-x-auto overflow-y-visible bg-muted/40 mb-1 shadow-sm">
              {(
                [
                  ['summary', BarChart3, 'Resumo geral'],
                  ['productivity', User, 'Produtividade'],
                  ['payments', CreditCard, 'Pagamentos'],
                  ['products', Package, 'Produtos'],
                  ['purchases', Truck, 'Compras / fornec.'],
                  ['stock', Warehouse, 'Estoque'],
                  ['assistencia', ClipboardList, 'Assistência'],
                  ['refunds', RotateCcw, 'Devoluções'],
                  ['clients', Users, 'Clientes'],
                  ['cash', Wallet, 'Caixa'],
                  ['cancellations', XCircle, 'Cancelamentos'],
                  ['followup', MessageCircle, 'Pós-venda'],
                  ...(isAdmin ? [['audit', Shield, 'Auditoria']] as const : []),
                ] as const
              ).map(([id, Icon, label]) => (
                <TabsTrigger
                  key={id}
                  value={id}
                  className={cn(
                    'min-h-11 flex-1 min-w-[8.5rem] max-w-[14rem] rounded-lg font-semibold flex items-center justify-center gap-2 transition-all px-2',
                    'data-[state=inactive]:bg-gray-200 data-[state=inactive]:text-gray-800 data-[state=inactive]:shadow-sm',
                    'dark:data-[state=inactive]:bg-gray-700 dark:data-[state=inactive]:text-gray-100',
                    'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate text-center text-xs sm:text-sm">{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="summary" className="space-y-4 mt-4 overflow-visible min-h-0">
              {trendChartData.length > 0 && (
                <div className="w-full min-w-0">
                  <TrendCharts data={trendChartData} valuesVisible={valuesVisible} hidePeriodSelector />
                </div>
              )}
              {isLoadingSummary ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Carregando...</div>
              ) : summary ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 min-w-0">
                  <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm min-w-0 overflow-hidden">
                    <CardContent className="p-4 min-w-0">
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground font-semibold truncate">Total PDV</p>
                          <p className="text-lg font-bold text-blue-700 dark:text-blue-400 mt-1 truncate" title={fmt(summary.totalPDV)}>{fmt(summary.totalPDV)}</p>
                          <p className="text-xs text-muted-foreground mt-1">{summary.countPDV} {summary.countPDV === 1 ? 'venda' : 'vendas'}</p>
                        </div>
                        <ShoppingCart className="h-8 w-8 text-blue-500 opacity-50 flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm min-w-0 overflow-hidden">
                    <CardContent className="p-4 min-w-0">
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground font-semibold truncate">Total OS</p>
                          <p className="text-lg font-bold text-green-700 dark:text-green-400 mt-1 truncate" title={fmt(summary.totalOS)}>{fmt(summary.totalOS)}</p>
                          <p className="text-xs text-muted-foreground mt-1">{summary.countOS} {summary.countOS === 1 ? 'OS' : 'OS'}</p>
                        </div>
                        <Wrench className="h-8 w-8 text-green-500 opacity-50 flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm min-w-0 overflow-hidden">
                    <CardContent className="p-4 min-w-0">
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground font-semibold truncate">Total Geral</p>
                          <p className="text-lg font-bold text-purple-700 dark:text-purple-400 mt-1 truncate" title={fmt(summary.totalGeral)}>{fmt(summary.totalGeral)}</p>
                          <p className="text-xs text-muted-foreground mt-1">{summary.countGeral} {summary.countGeral === 1 ? 'venda' : 'vendas'}</p>
                        </div>
                        <DollarSign className="h-8 w-8 text-purple-500 opacity-50 flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm min-w-0 overflow-hidden">
                    <CardContent className="p-4 min-w-0">
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground font-semibold truncate">% PDV</p>
                          <p className="text-lg font-bold text-orange-700 dark:text-orange-400 mt-1">{summary.percentPDV.toFixed(1)}%</p>
                          <p className="text-xs text-muted-foreground mt-1">% OS: {summary.percentOS.toFixed(1)}%</p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-orange-500 opacity-50 flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl">
                  <CardContent className="p-8 text-center">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                    <p className="text-muted-foreground">Nenhum dado disponível no período selecionado</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="productivity" className="space-y-4 mt-4 overflow-visible min-h-0">
              {isLoadingProductivity ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Carregando...</div>
              ) : productivity && productivity.length > 0 ? (
                <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm overflow-hidden min-w-0">
                  <div className="hidden md:block overflow-x-auto scrollbar-thin">
                    <Table className="min-w-[600px]">
                      <TableHeader>
                        <TableRow className="border-b-2 border-gray-200 dark:border-gray-700 bg-muted/50">
                          <TableHead className="font-semibold">Técnico</TableHead>
                          <TableHead className="text-right font-semibold">OS Completadas</TableHead>
                          <TableHead className="text-right font-semibold">Receita Total</TableHead>
                          <TableHead className="text-right font-semibold">Receita Serviços</TableHead>
                          <TableHead className="text-right font-semibold">Receita Produtos</TableHead>
                          <TableHead className="text-right font-semibold">Ticket Médio</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {productivity.map((tech) => (
                          <TableRow key={tech.technician_id} className="border-b border-gray-100 dark:border-gray-800">
                            <TableCell className="font-medium">{tech.technician_nome}</TableCell>
                            <TableCell className="text-right">{tech.osCompleted}</TableCell>
                            <TableCell className="text-right font-semibold">{fmt(tech.totalRevenue)}</TableCell>
                            <TableCell className="text-right">{fmt(tech.serviceRevenue)}</TableCell>
                            <TableCell className="text-right">{fmt(tech.productRevenue)}</TableCell>
                            <TableCell className="text-right font-semibold">{fmt(tech.averageTicket)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="md:hidden space-y-3 p-3">
                    {productivity.map((tech) => (
                      <Card key={tech.technician_id} className="border border-gray-200 dark:border-gray-700 rounded-lg">
                        <CardContent className="p-4 space-y-2">
                          <h3 className="font-bold">{tech.technician_nome}</h3>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div><span className="text-muted-foreground">OS:</span> {tech.osCompleted}</div>
                            <div><span className="text-muted-foreground">Ticket médio:</span> {fmt(tech.averageTicket)}</div>
                            <div className="col-span-2"><span className="text-muted-foreground">Receita total:</span> {fmt(tech.totalRevenue)}</div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </Card>
              ) : (
                <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl">
                  <CardContent className="p-8 text-center">
                    <User className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                    <p className="text-muted-foreground">Nenhuma produtividade encontrada no período</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="payments" className="space-y-4 mt-4 min-w-0">
              {serverReports.paymentMethods.isLoading ? (
                <p className="text-sm text-muted-foreground text-center py-12">Carregando…</p>
              ) : serverReports.paymentMethods.isError ? (
                <p className="text-sm text-destructive text-center py-8">
                  {queryErr(serverReports.paymentMethods.error)}
                </p>
              ) : (
                <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Formas de pagamento</CardTitle>
                    <CardDescription>
                      Pagamentos confirmados em vendas finalizadas (PDV + OS), pelo período da venda.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Forma</TableHead>
                          <TableHead className="text-right">Qtd. lançamentos</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(serverReports.paymentMethods.data?.length ?? 0) === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                              Nenhum pagamento no período.
                            </TableCell>
                          </TableRow>
                        ) : (
                          serverReports.paymentMethods.data!.map((row) => (
                            <TableRow key={row.forma_pagamento}>
                              <TableCell className="font-medium">{paymentLabel(row.forma_pagamento)}</TableCell>
                              <TableCell className="text-right">{row.payment_count}</TableCell>
                              <TableCell className="text-right font-semibold">{fmt(numVal(row.total_amount))}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="products" className="space-y-4 mt-4 min-w-0">
              {serverReports.topProducts.isLoading ? (
                <p className="text-sm text-muted-foreground text-center py-12">Carregando…</p>
              ) : serverReports.topProducts.isError ? (
                <p className="text-sm text-destructive text-center py-8">
                  {queryErr(serverReports.topProducts.error)}
                </p>
              ) : (
                <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Produtos mais vendidos</CardTitle>
                    <CardDescription>Itens em vendas com status pago/parcial no período.</CardDescription>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead className="text-right">Quantidade</TableHead>
                          <TableHead className="text-right">Receita</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(serverReports.topProducts.data?.length ?? 0) === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                              Nenhum item no período.
                            </TableCell>
                          </TableRow>
                        ) : (
                          serverReports.topProducts.data!.map((row, i) => (
                            <TableRow key={`${row.produto_id ?? 'x'}-${i}`}>
                              <TableCell className="font-medium max-w-[240px] truncate" title={row.produto_nome}>
                                {row.produto_nome}
                              </TableCell>
                              <TableCell className="text-right">{Number(row.qty).toLocaleString('pt-BR')}</TableCell>
                              <TableCell className="text-right font-semibold">{fmt(numVal(row.revenue))}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="purchases" className="space-y-4 mt-4 min-w-0">
              {serverReports.purchases.isLoading ? (
                <p className="text-sm text-muted-foreground text-center py-12">Carregando…</p>
              ) : serverReports.purchases.isError ? (
                <p className="text-sm text-destructive text-center py-8">
                  {queryErr(serverReports.purchases.error)}
                </p>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl">
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-semibold">Total pago a fornecedores</p>
                        <p className="text-2xl font-bold mt-1">
                          {fmt(
                            (serverReports.purchases.data?.fornecedores_os ?? []).reduce(
                              (sum, row) => sum + numVal(row.valor_total),
                              0
                            )
                          )}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl">
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-semibold">Fornecedores no período</p>
                        <p className="text-2xl font-bold mt-1">
                          {serverReports.purchases.data?.fornecedores_os.length ?? 0}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl">
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-semibold">Média por fornecedor</p>
                        <p className="text-2xl font-bold mt-1">
                          {fmt(
                            (() => {
                              const rows = serverReports.purchases.data?.fornecedores_os ?? [];
                              if (rows.length === 0) return 0;
                              const total = rows.reduce((sum, row) => sum + numVal(row.valor_total), 0);
                              return total / rows.length;
                            })()
                          )}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                  <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm overflow-hidden">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Pedidos de compra</CardTitle>
                      <CardDescription>
                        Pedidos de entrada no estoque. O cadastro atual não vincula fornecedor ao pedido; use a tabela
                        abaixo para visão por fornecedor nas peças da OS.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Recebido</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead className="text-right">Valor compra (itens)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(serverReports.purchases.data?.pedidos.length ?? 0) === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                Nenhum pedido no período.
                              </TableCell>
                            </TableRow>
                          ) : (
                            serverReports.purchases.data!.pedidos.map((p) => (
                              <TableRow key={p.id}>
                                <TableCell className="font-medium max-w-[200px] truncate" title={p.nome}>
                                  {p.nome}
                                </TableCell>
                                <TableCell>{p.recebido ? 'Sim' : 'Não'}</TableCell>
                                <TableCell className="text-xs whitespace-nowrap">
                                  {p.created_at ? new Date(p.created_at).toLocaleString('pt-BR') : '—'}
                                </TableCell>
                                <TableCell className="text-right">{fmt(numVal(p.valor_compra_total))}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                  <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm overflow-hidden">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Total pago por fornecedor</CardTitle>
                      <CardDescription>Agregado por fornecedor das peças lançadas em OS no período.</CardDescription>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fornecedor</TableHead>
                            <TableHead className="text-right">Itens</TableHead>
                            <TableHead className="text-right">Total pago</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(serverReports.purchases.data?.fornecedores_os.length ?? 0) === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                                Nenhum item de OS no período.
                              </TableCell>
                            </TableRow>
                          ) : (
                            serverReports.purchases.data!.fornecedores_os.map((r) => (
                              <TableRow key={r.fornecedor}>
                                <TableCell className="font-medium">{r.fornecedor}</TableCell>
                                <TableCell className="text-right">{r.itens_count}</TableCell>
                                <TableCell className="text-right font-semibold">{fmt(numVal(r.valor_total))}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="stock" className="space-y-4 mt-4 min-w-0">
              {serverReports.stock.isLoading ? (
                <p className="text-sm text-muted-foreground text-center py-12">Carregando…</p>
              ) : serverReports.stock.isError ? (
                <p className="text-sm text-destructive text-center py-8">
                  {queryErr(serverReports.stock.error)}
                </p>
              ) : (
                <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Movimentações de estoque</CardTitle>
                    <CardDescription>Registros de produto_movimentacoes para produtos da sua empresa.</CardDescription>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Motivo</TableHead>
                          <TableHead className="text-right">Δ qtd</TableHead>
                          <TableHead>Usuário</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(serverReports.stock.data?.length ?? 0) === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                              Nenhuma movimentação no período.
                            </TableCell>
                          </TableRow>
                        ) : (
                          serverReports.stock.data!.map((m) => (
                            <TableRow key={m.id}>
                              <TableCell className="text-xs whitespace-nowrap">
                                {m.created_at ? new Date(m.created_at).toLocaleString('pt-BR') : '—'}
                              </TableCell>
                              <TableCell className="max-w-[160px] truncate" title={m.produto_nome}>
                                {m.produto_nome}
                              </TableCell>
                              <TableCell className="text-xs">{m.tipo}</TableCell>
                              <TableCell className="text-xs max-w-[140px] truncate" title={m.motivo ?? ''}>
                                {m.motivo ?? '—'}
                              </TableCell>
                              <TableCell className="text-right">{m.quantidade_delta ?? '—'}</TableCell>
                              <TableCell className="text-xs">{m.user_nome ?? '—'}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="assistencia" className="space-y-4 mt-4 min-w-0">
              {serverReports.osOverview.isLoading ? (
                <p className="text-sm text-muted-foreground text-center py-12">Carregando…</p>
              ) : serverReports.osOverview.isError ? (
                <p className="text-sm text-destructive text-center py-8">
                  {queryErr(serverReports.osOverview.error)}
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl">
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-semibold">Total de OS (criadas no período)</p>
                        <p className="text-2xl font-bold mt-1">{serverReports.osOverview.data?.totals.total_os ?? 0}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl">
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-semibold">Soma valor_total (campo OS)</p>
                        <p className="text-2xl font-bold mt-1">
                          {fmt(numVal(serverReports.osOverview.data?.totals.valor_total_orcado))}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                  <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm overflow-hidden">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Por status</CardTitle>
                      <CardDescription>Contagem de ordens de serviço criadas no período.</CardDescription>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Quantidade</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(serverReports.osOverview.data?.by_status.length ?? 0) === 0 ? (
                            <TableRow>
                              <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                                Nenhuma OS no período.
                              </TableCell>
                            </TableRow>
                          ) : (
                            serverReports.osOverview.data!.by_status.map((r) => (
                              <TableRow key={r.status}>
                                <TableCell className="font-medium">{r.status}</TableCell>
                                <TableCell className="text-right">{r.cnt}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="refunds" className="space-y-4 mt-4 min-w-0">
              {serverReports.refunds.isLoading ? (
                <p className="text-sm text-muted-foreground text-center py-12">Carregando…</p>
              ) : serverReports.refunds.isError ? (
                <p className="text-sm text-destructive text-center py-8">
                  {queryErr(serverReports.refunds.error)}
                </p>
              ) : (
                <div className="space-y-6">
                  <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm overflow-hidden">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Por status</CardTitle>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Qtd</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(serverReports.refunds.data?.by_status.length ?? 0) === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                                Nenhuma devolução no período.
                              </TableCell>
                            </TableRow>
                          ) : (
                            serverReports.refunds.data!.by_status.map((r) => (
                              <TableRow key={r.status}>
                                <TableCell className="font-medium">{r.status}</TableCell>
                                <TableCell className="text-right">{r.cnt}</TableCell>
                                <TableCell className="text-right">{fmt(numVal(r.valor))}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                  <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm overflow-hidden">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Por motivo</CardTitle>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Motivo</TableHead>
                            <TableHead className="text-right">Qtd</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(serverReports.refunds.data?.by_reason.length ?? 0) === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                                —
                              </TableCell>
                            </TableRow>
                          ) : (
                            serverReports.refunds.data!.by_reason.map((r) => (
                              <TableRow key={r.reason}>
                                <TableCell className="font-medium max-w-[220px] truncate" title={r.reason}>
                                  {r.reason}
                                </TableCell>
                                <TableCell className="text-right">{r.cnt}</TableCell>
                                <TableCell className="text-right">{fmt(numVal(r.valor))}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="clients" className="space-y-4 mt-4 min-w-0">
              {serverReports.clients.isLoading ? (
                <p className="text-sm text-muted-foreground text-center py-12">Carregando…</p>
              ) : serverReports.clients.isError ? (
                <p className="text-sm text-destructive text-center py-8">
                  {queryErr(serverReports.clients.error)}
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground font-semibold">Novos cadastros (clientes)</p>
                      <p className="text-2xl font-bold mt-1">{serverReports.clients.data?.novos_clientes ?? 0}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground font-semibold">Clientes distintos (compras)</p>
                      <p className="text-2xl font-bold mt-1">{serverReports.clients.data?.clientes_compra_distintos ?? 0}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground font-semibold">Vendas finalizadas c/ cliente</p>
                      <p className="text-2xl font-bold mt-1">{serverReports.clients.data?.vendas_finalizadas ?? 0}</p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="cash" className="space-y-4 mt-4 min-w-0">
              {serverReports.cash.isLoading ? (
                <p className="text-sm text-muted-foreground text-center py-12">Carregando…</p>
              ) : serverReports.cash.isError ? (
                <p className="text-sm text-destructive text-center py-8">
                  {queryErr(serverReports.cash.error)}
                </p>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl">
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-semibold">Sessões de caixa</p>
                        <p className="text-2xl font-bold mt-1">{serverReports.cash.data?.totals.total_sessions ?? 0}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Abertas: {serverReports.cash.data?.totals.open_sessions ?? 0} • Fechadas: {serverReports.cash.data?.totals.closed_sessions ?? 0}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl">
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-semibold">Valor inicial somado</p>
                        <p className="text-2xl font-bold mt-1">{fmt(numVal(serverReports.cash.data?.totals.total_inicial))}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl">
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-semibold">Valor final somado</p>
                        <p className="text-2xl font-bold mt-1">{fmt(numVal(serverReports.cash.data?.totals.total_final))}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl">
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-semibold">Divergência total</p>
                        <p className="text-2xl font-bold mt-1">{fmt(numVal(serverReports.cash.data?.totals.total_divergencia))}</p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm overflow-hidden">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Por operador</CardTitle>
                      <CardDescription>Sessões abertas/fechadas e valores consolidados no período.</CardDescription>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Operador</TableHead>
                            <TableHead className="text-right">Sessões</TableHead>
                            <TableHead className="text-right">Abertas</TableHead>
                            <TableHead className="text-right">Fechadas</TableHead>
                            <TableHead className="text-right">Valor final</TableHead>
                            <TableHead className="text-right">Divergência</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(serverReports.cash.data?.by_operator.length ?? 0) === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                Nenhuma sessão de caixa no período.
                              </TableCell>
                            </TableRow>
                          ) : (
                            serverReports.cash.data!.by_operator.map((row) => (
                              <TableRow key={row.operador}>
                                <TableCell className="font-medium">{row.operador}</TableCell>
                                <TableCell className="text-right">{row.sessions_count}</TableCell>
                                <TableCell className="text-right">{row.open_count}</TableCell>
                                <TableCell className="text-right">{row.closed_count}</TableCell>
                                <TableCell className="text-right">{fmt(numVal(row.valor_final))}</TableCell>
                                <TableCell className="text-right">{fmt(numVal(row.divergencia))}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm overflow-hidden">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Movimentações do caixa</CardTitle>
                        <CardDescription>Sangrias e suprimentos registrados no período.</CardDescription>
                      </CardHeader>
                      <CardContent className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Tipo</TableHead>
                              <TableHead className="text-right">Qtd</TableHead>
                              <TableHead className="text-right">Valor</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(serverReports.cash.data?.by_movement_type.length ?? 0) === 0 ? (
                              <TableRow>
                                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                                  Nenhuma movimentação de caixa.
                                </TableCell>
                              </TableRow>
                            ) : (
                              serverReports.cash.data!.by_movement_type.map((row) => (
                                <TableRow key={row.tipo}>
                                  <TableCell className="font-medium capitalize">{row.tipo}</TableCell>
                                  <TableCell className="text-right">{row.cnt}</TableCell>
                                  <TableCell className="text-right">{fmt(numVal(row.total))}</TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>

                    <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm overflow-hidden">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Sessões recentes</CardTitle>
                        <CardDescription>Últimas sessões abertas no período filtrado.</CardDescription>
                      </CardHeader>
                      <CardContent className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>#</TableHead>
                              <TableHead>Operador</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Abertura</TableHead>
                              <TableHead className="text-right">Divergência</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(serverReports.cash.data?.recent_sessions.length ?? 0) === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                  Nenhuma sessão encontrada.
                                </TableCell>
                              </TableRow>
                            ) : (
                              serverReports.cash.data!.recent_sessions.map((row) => (
                                <TableRow key={row.id}>
                                  <TableCell>{row.numero}</TableCell>
                                  <TableCell className="font-medium">{row.operador_nome}</TableCell>
                                  <TableCell>{row.status === 'open' ? 'Aberto' : 'Fechado'}</TableCell>
                                  <TableCell className="text-xs whitespace-nowrap">
                                    {row.opened_at ? new Date(row.opened_at).toLocaleString('pt-BR') : '—'}
                                  </TableCell>
                                  <TableCell className="text-right">{fmt(numVal(row.divergencia))}</TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="cancellations" className="space-y-4 mt-4 min-w-0">
              {serverReports.cancellations.isLoading ? (
                <p className="text-sm text-muted-foreground text-center py-12">Carregando…</p>
              ) : serverReports.cancellations.isError ? (
                <p className="text-sm text-destructive text-center py-8">
                  {queryErr(serverReports.cancellations.error)}
                </p>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl">
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-semibold">Vendas canceladas</p>
                        <p className="text-2xl font-bold mt-1">{serverReports.cancellations.data?.totals.canceled_sales ?? 0}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl">
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-semibold">Valor cancelado</p>
                        <p className="text-2xl font-bold mt-1">{fmt(numVal(serverReports.cancellations.data?.totals.canceled_total))}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl">
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-semibold">Solicitações pendentes</p>
                        <p className="text-2xl font-bold mt-1">{serverReports.cancellations.data?.totals.pending_requests ?? 0}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl">
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-semibold">Solicitações aprovadas</p>
                        <p className="text-2xl font-bold mt-1">{serverReports.cancellations.data?.totals.approved_requests ?? 0}</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm overflow-hidden">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Motivos de cancelamento</CardTitle>
                        <CardDescription>Motivos registrados diretamente nas vendas canceladas.</CardDescription>
                      </CardHeader>
                      <CardContent className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Motivo</TableHead>
                              <TableHead className="text-right">Qtd</TableHead>
                              <TableHead className="text-right">Valor</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(serverReports.cancellations.data?.by_reason.length ?? 0) === 0 ? (
                              <TableRow>
                                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                                  Nenhum cancelamento no período.
                                </TableCell>
                              </TableRow>
                            ) : (
                              serverReports.cancellations.data!.by_reason.map((row) => (
                                <TableRow key={row.reason}>
                                  <TableCell className="font-medium max-w-[260px] truncate" title={row.reason}>
                                    {row.reason}
                                  </TableCell>
                                  <TableCell className="text-right">{row.cnt}</TableCell>
                                  <TableCell className="text-right">{fmt(numVal(row.valor))}</TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>

                    <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm overflow-hidden">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Status das solicitações</CardTitle>
                        <CardDescription>Fluxo de aprovação/rejeição em `sale_cancel_requests`.</CardDescription>
                      </CardHeader>
                      <CardContent className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Qtd</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(serverReports.cancellations.data?.request_status.length ?? 0) === 0 ? (
                              <TableRow>
                                <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                                  Nenhuma solicitação registrada no período.
                                </TableCell>
                              </TableRow>
                            ) : (
                              serverReports.cancellations.data!.request_status.map((row) => (
                                <TableRow key={row.status}>
                                  <TableCell className="font-medium">
                                    {row.status === 'pending' ? 'Pendente' : row.status === 'approved' ? 'Aprovada' : row.status === 'rejected' ? 'Rejeitada' : row.status}
                                  </TableCell>
                                  <TableCell className="text-right">{row.cnt}</TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm overflow-hidden">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Vendas canceladas recentes</CardTitle>
                      <CardDescription>Últimos cancelamentos efetivados no período selecionado.</CardDescription>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Venda</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Vendedor</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(serverReports.cancellations.data?.recent_canceled_sales.length ?? 0) === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                Nenhuma venda cancelada.
                              </TableCell>
                            </TableRow>
                          ) : (
                            serverReports.cancellations.data!.recent_canceled_sales.map((row) => (
                              <TableRow key={row.id}>
                                <TableCell className="font-medium">#{row.numero}</TableCell>
                                <TableCell>{row.cliente_nome ?? '—'}</TableCell>
                                <TableCell>{row.vendedor_nome ?? '—'}</TableCell>
                                <TableCell className="text-xs whitespace-nowrap">
                                  {row.canceled_at ? new Date(row.canceled_at).toLocaleString('pt-BR') : '—'}
                                </TableCell>
                                <TableCell className="text-right">{fmt(numVal(row.total))}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="followup" className="space-y-4 mt-4 min-w-0">
              {serverReports.followup.isLoading ? (
                <p className="text-sm text-muted-foreground text-center py-12">Carregando…</p>
              ) : serverReports.followup.isError ? (
                <p className="text-sm text-destructive text-center py-8">
                  {queryErr(serverReports.followup.error)}
                </p>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl">
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-semibold">Jobs de pós-venda</p>
                        <p className="text-2xl font-bold mt-1">{serverReports.followup.data?.totals.total_jobs ?? 0}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl">
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-semibold">Enviados</p>
                        <p className="text-2xl font-bold mt-1">{serverReports.followup.data?.totals.sent_jobs ?? 0}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl">
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-semibold">Pendentes / agendados</p>
                        <p className="text-2xl font-bold mt-1">{serverReports.followup.data?.totals.pending_jobs ?? 0}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl">
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-semibold">Com erro / cancelados</p>
                        <p className="text-2xl font-bold mt-1">
                          {(serverReports.followup.data?.totals.error_jobs ?? 0) + (serverReports.followup.data?.totals.cancelled_jobs ?? 0)}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm overflow-hidden">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Por status</CardTitle>
                        <CardDescription>Fila e histórico de envio do follow-up por OS.</CardDescription>
                      </CardHeader>
                      <CardContent className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Qtd</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(serverReports.followup.data?.by_status.length ?? 0) === 0 ? (
                              <TableRow>
                                <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                                  Nenhum registro de pós-venda no período.
                                </TableCell>
                              </TableRow>
                            ) : (
                              serverReports.followup.data!.by_status.map((row) => (
                                <TableRow key={row.status}>
                                  <TableCell className="font-medium">{row.status}</TableCell>
                                  <TableCell className="text-right">{row.cnt}</TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>

                    <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm overflow-hidden">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Regras de envio</CardTitle>
                        <CardDescription>Distribuição das regras aplicadas no agendamento.</CardDescription>
                      </CardHeader>
                      <CardContent className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Regra</TableHead>
                              <TableHead className="text-right">Qtd</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(serverReports.followup.data?.by_rule.length ?? 0) === 0 ? (
                              <TableRow>
                                <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                                  Nenhuma regra registrada.
                                </TableCell>
                              </TableRow>
                            ) : (
                              serverReports.followup.data!.by_rule.map((row) => (
                                <TableRow key={row.tipo_regra_envio}>
                                  <TableCell className="font-medium">{followupRuleLabel(row.tipo_regra_envio)}</TableCell>
                                  <TableCell className="text-right">{row.cnt}</TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm overflow-hidden">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Histórico recente</CardTitle>
                      <CardDescription>Últimos jobs de follow-up criados no período.</CardDescription>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>OS</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Regra</TableHead>
                            <TableHead>Agendado para</TableHead>
                            <TableHead>Telefone</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(serverReports.followup.data?.recent_jobs.length ?? 0) === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                Nenhum job de pós-venda encontrado.
                              </TableCell>
                            </TableRow>
                          ) : (
                            serverReports.followup.data!.recent_jobs.map((row) => (
                              <TableRow key={row.id}>
                                <TableCell className="font-medium">{row.ordem_servico_id.slice(0, 8)}…</TableCell>
                                <TableCell>{row.status}</TableCell>
                                <TableCell>{followupRuleLabel(row.tipo_regra_envio)}</TableCell>
                                <TableCell className="text-xs whitespace-nowrap">
                                  {row.scheduled_at ? new Date(row.scheduled_at).toLocaleString('pt-BR') : '—'}
                                </TableCell>
                                <TableCell className="text-xs">{row.telefone ?? '—'}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            {isAdmin && (
              <TabsContent value="audit" className="space-y-4 mt-4 min-w-0">
                {serverReports.audit.isLoading ? (
                  <p className="text-sm text-muted-foreground text-center py-12">Carregando…</p>
                ) : serverReports.audit.isError ? (
                  <p className="text-sm text-destructive text-center py-8">
                    {queryErr(serverReports.audit.error)}
                  </p>
                ) : (
                  <div className="space-y-6">
                    <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm overflow-hidden">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Atividade de usuários</CardTitle>
                        <CardDescription>Resumo por tipo de ação (user_activity_logs).</CardDescription>
                      </CardHeader>
                      <CardContent className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Tipo / ação</TableHead>
                              <TableHead className="text-right">Ocorrências</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(serverReports.audit.data?.user_activity.length ?? 0) === 0 ? (
                              <TableRow>
                                <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                                  Nenhum registro no período.
                                </TableCell>
                              </TableRow>
                            ) : (
                              serverReports.audit.data!.user_activity.map((r, i) => (
                                <TableRow key={`ua-${i}-${r.tipo}`}>
                                  <TableCell className="font-medium max-w-[280px] truncate" title={r.tipo}>
                                    {r.tipo}
                                  </TableCell>
                                  <TableCell className="text-right">{r.cnt}</TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                    <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm overflow-hidden">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Auditoria</CardTitle>
                        <CardDescription>Resumo por tipo (audit_logs).</CardDescription>
                      </CardHeader>
                      <CardContent className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Tipo</TableHead>
                              <TableHead className="text-right">Ocorrências</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(serverReports.audit.data?.audit_logs.length ?? 0) === 0 ? (
                              <TableRow>
                                <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                                  Nenhum registro no período.
                                </TableCell>
                              </TableRow>
                            ) : (
                              serverReports.audit.data!.audit_logs.map((r, i) => (
                                <TableRow key={`al-${i}-${r.tipo}`}>
                                  <TableCell className="font-medium max-w-[280px] truncate" title={r.tipo}>
                                    {r.tipo}
                                  </TableCell>
                                  <TableCell className="text-right">{r.cnt}</TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </ModernLayout>
  );
}
