import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { format, subDays, startOfMonth, endOfMonth, subMonths, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ModernLayout } from '@/components/ModernLayout';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useDashboardConfig } from '@/hooks/useDashboardConfig';
import { useDashboardExecutivo } from '@/hooks/useFinanceiro';
import { useSalesSummary } from '@/hooks/useReports';
import { FinancialCards, getStoredValuesVisible, setStoredValuesVisible } from '@/components/dashboard/FinancialCards';
import { OSStatusCards } from '@/components/dashboard/OSStatusCards';
import { TrendCharts } from '@/components/dashboard/TrendCharts';
import { DashboardPeriodFilter } from '@/components/dashboard/DashboardPeriodFilter';
import { PresentationMode } from '@/components/dashboard/PresentationMode';
import { useQuery } from '@tanstack/react-query';
import { useOrdensServicoSupabase as useOrdensServico } from '@/hooks/useOrdensServicoSupabase';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import type { DashboardTrendData } from '@/hooks/useDashboardData';

const apiBase = (import.meta.env.VITE_API_URL && !String(import.meta.env.VITE_API_URL).includes('localhost'))
  ? String(import.meta.env.VITE_API_URL).replace(/\/$/, '')
  : 'https://api.ativafix.com/api';

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, profile, user, loading: authLoading } = useAuth();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const { financialData, osData, alerts, trendData, trendPeriod, setTrendPeriod, customDateRange, loading: dataLoading, refetch } = useDashboardData();
  const { config, loading: configLoading } = useDashboardConfig();
  const { getEstatisticas } = useOrdensServico();
  /** Ocultar/exibir valores em R$ (ícone de olho como em bancos) - persistido no localStorage */
  const [valuesVisible, setValuesVisible] = useState(getStoredValuesVisible);

  const stats = getEstatisticas();

  const { data: roleMenuData } = useQuery({
    queryKey: ['role-menu', user?.id],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) return { menu: [], home_path: null };
      const res = await fetch(`${apiBase}/me/role-menu`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      return { menu: data.menu || [], home_path: data.home_path || null };
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });
  const homePath = roleMenuData?.home_path || null;
  useEffect(() => {
    if (location.pathname !== '/' || !homePath || homePath === '/' || isAdmin) return;
    navigate(homePath, { replace: true });
  }, [location.pathname, homePath, navigate, isAdmin]);

  // Verificar se é gestor/admin (só verifica se não estiver carregando)
  const isGestor = !permissionsLoading && (isAdmin || hasPermission('admin.view') || hasPermission('financeiro.view'));
  // Relatórios/Financeiro no dashboard: só quem tem permissão de relatórios vê indicadores financeiros e tendência
  const canSeeRelatorios = !permissionsLoading && (isAdmin || hasPermission('relatorios.view') || hasPermission('relatorios.financeiro'));

  // Período do gráfico → datas para a API do financeiro (mesmos dados reais do /financeiro)
  const { startDate: financeiroStart, endDate: financeiroEnd, periodStartDate, periodEndDate } = useMemo(() => {
    const end = new Date();
    let start = new Date();
    if (trendPeriod === 'custom' && customDateRange?.start && customDateRange?.end) {
      return {
        startDate: customDateRange.start,
        endDate: customDateRange.end,
        periodStartDate: customDateRange.start,
        periodEndDate: customDateRange.end,
      };
    }
    if (trendPeriod === 'custom') {
      // Fallback: últimos 7 dias se ainda não tiver range salvo
      const start = subDays(end, 6);
      return {
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(end, 'yyyy-MM-dd'),
        periodStartDate: format(start, 'yyyy-MM-dd'),
        periodEndDate: format(end, 'yyyy-MM-dd'),
      };
    }
    if (trendPeriod === 'day') start = end;
    else if (trendPeriod === 'week') start = subDays(end, 6);
    else if (trendPeriod === '30d') start = subDays(end, 29);
    else if (trendPeriod === 'lastMonth') {
      const mesAnterior = subMonths(end, 1);
      start = startOfMonth(mesAnterior);
      const endLastMonth = endOfMonth(mesAnterior);
      return {
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(endLastMonth, 'yyyy-MM-dd'),
        periodStartDate: format(start, 'yyyy-MM-dd'),
        periodEndDate: format(endLastMonth, 'yyyy-MM-dd'),
      };
    } else if (trendPeriod === 'month') {
      start = startOfMonth(end);
    } else if (trendPeriod === '3m') start = subDays(end, 89);
    else if (trendPeriod === '6m') start = subDays(end, 179);
    else start = subDays(end, 364); // year
    return {
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd'),
      periodStartDate: format(start, 'yyyy-MM-dd'),
      periodEndDate: format(end, 'yyyy-MM-dd'),
    };
  }, [trendPeriod, customDateRange]);

  const { data: financeiroDashboard, isLoading: financeiroLoading, refetch: refetchFinanceiro } = useDashboardExecutivo(
    financeiroStart,
    financeiroEnd
  );

  // Quando período é "Dia", usar a mesma fonte que /relatorios (useSalesSummary) para bater Total PDV/OS/Geral
  const daySummaryFilters = useMemo(() =>
    (trendPeriod === 'day' && periodStartDate && periodEndDate)
      ? { startDate: periodStartDate, endDate: periodEndDate }
      : undefined,
    [trendPeriod, periodStartDate, periodEndDate]
  );
  const { data: salesSummaryDay } = useSalesSummary(daySummaryFilters ?? {}, { enabled: !!daySummaryFilters });

  const kpisFromDaySummary = useMemo(() => {
    if (!salesSummaryDay) return null;
    return {
      totalPDV: salesSummaryDay.totalPDV,
      totalOS: salesSummaryDay.totalOS,
      totalGeral: salesSummaryDay.totalGeral,
      quantidadePDV: salesSummaryDay.countPDV,
      quantidadeOS: salesSummaryDay.countOS,
      ticketMedioPDV: salesSummaryDay.countPDV > 0 ? salesSummaryDay.totalPDV / salesSummaryDay.countPDV : 0,
      ticketMedioOS: salesSummaryDay.countOS > 0 ? salesSummaryDay.totalOS / salesSummaryDay.countOS : 0,
    };
  }, [salesSummaryDay]);

  // Gráfico: usar tendência do financeiro (dados reais); filtrar pelo período e preencher dias faltantes
  const trendChartData: DashboardTrendData[] = useMemo(() => {
    const emptyPoint = (dateStr: string, dateLabel: string): DashboardTrendData => ({
      date: dateLabel,
      data: dateStr,
      vendas: 0,
      os: 0,
      faturamento_os: 0,
      totalPDV: 0,
      totalOS: 0,
      totalGeral: 0,
    });

    // Período "Dia": usar os mesmos valores de /relatorios (useSalesSummary) no gráfico
    if (trendPeriod === 'day' && salesSummaryDay && periodStartDate) {
      const d = new Date(periodStartDate + 'T12:00:00');
      const dateLabel = format(d, 'dd/MM', { locale: ptBR });
      return [{
        date: dateLabel,
        data: periodStartDate,
        vendas: salesSummaryDay.totalPDV,
        os: salesSummaryDay.countOS,
        faturamento_os: salesSummaryDay.totalOS,
        totalPDV: salesSummaryDay.totalPDV,
        totalOS: salesSummaryDay.totalOS,
        totalGeral: salesSummaryDay.totalGeral,
      }];
    }

    if (financeiroDashboard?.tendencia?.length && periodStartDate && periodEndDate) {
      const byDate = new Map<string, DashboardTrendData>();

      financeiroDashboard.tendencia.forEach((t) => {
        const raw = t?.data;
        const rawStr = typeof raw === 'string' ? raw.trim() : '';
        if (!rawStr || rawStr.length < 10) return;
        const dateStr = rawStr.slice(0, 10);
        if (dateStr < periodStartDate || dateStr > periodEndDate) return;
        const d = new Date(dateStr + 'T12:00:00');
        if (Number.isNaN(d.getTime())) return;
        const dateLabel = format(d, 'dd/MM', { locale: ptBR });
        byDate.set(dateStr, {
          date: dateLabel,
          data: dateStr,
          vendas: t.totalPDV ?? 0,
          os: 0,
          faturamento_os: t.totalOS ?? 0,
          totalPDV: t.totalPDV ?? 0,
          totalOS: t.totalOS ?? 0,
          totalGeral: t.totalGeral ?? 0,
        });
      });

      // Mesclar dados locais (trendData) para o período — garante que "hoje" apareça quando a API não retornar o dia
      trendData.forEach((t) => {
        const dateStr = typeof t.data === 'string' ? t.data.trim().slice(0, 10) : '';
        if (!dateStr || dateStr.length < 10 || dateStr < periodStartDate || dateStr > periodEndDate) return;
        const d = new Date(dateStr + 'T12:00:00');
        if (Number.isNaN(d.getTime())) return;
        const dateLabel = format(d, 'dd/MM', { locale: ptBR });
        byDate.set(dateStr, {
          date: dateLabel,
          data: dateStr,
          vendas: t.vendas ?? 0,
          os: t.os ?? 0,
          faturamento_os: t.faturamento_os ?? 0,
          totalPDV: t.totalPDV ?? t.vendas ?? 0,
          totalOS: t.totalOS ?? t.faturamento_os ?? 0,
          totalGeral: t.totalGeral ?? 0,
        });
      });

      const start = new Date(periodStartDate + 'T12:00:00');
      const end = new Date(periodEndDate + 'T12:00:00');
      const result: DashboardTrendData[] = [];
      let cur = new Date(start);
      while (cur <= end) {
        const dateStr = format(cur, 'yyyy-MM-dd');
        const dateLabel = format(cur, 'dd/MM', { locale: ptBR });
        result.push(byDate.get(dateStr) ?? emptyPoint(dateStr, dateLabel));
        cur = addDays(cur, 1);
      }
      return result;
    }

    if (financeiroDashboard?.tendencia?.length) {
      return financeiroDashboard.tendencia.map((t) => {
        const raw = t?.data;
        const dateStr = typeof raw === 'string' ? raw.trim() : '';
        let dateLabel = dateStr;
        if (dateStr) {
          try {
            const d = dateStr.length === 10 ? new Date(dateStr + 'T12:00:00') : new Date(dateStr);
            if (!Number.isNaN(d.getTime())) dateLabel = format(d, 'dd/MM', { locale: ptBR });
          } catch {
            // mantém dateStr se format falhar
          }
        }
        return {
          date: dateLabel || '–',
          data: dateStr || raw,
          vendas: t.totalPDV ?? 0,
          os: 0,
          faturamento_os: t.totalOS ?? 0,
          totalPDV: t.totalPDV ?? 0,
          totalOS: t.totalOS ?? 0,
          totalGeral: t.totalGeral ?? 0,
        };
      });
    }
    return trendData;
  }, [trendPeriod, salesSummaryDay, financeiroDashboard?.tendencia, trendData, periodStartDate, periodEndDate]);

  // Se modo apresentação está ativo e é gestor, mostrar modo apresentação
  if (config.presentationMode && canSeeRelatorios && financialData && osData && alerts) {
    return (
      <PresentationMode
        financialData={financialData}
        osData={osData}
        alerts={alerts}
        trendData={trendChartData}
      />
    );
  }

  // Widgets habilitados ordenados
  const enabledWidgets = config.widgets
    .filter(w => w.enabled)
    .sort((a, b) => a.order - b.order);

  const isLoading = authLoading || permissionsLoading || configLoading || dataLoading;
  const showSkeleton = useDelayedLoading(isLoading, 200);

  if (showSkeleton) {
    return <DashboardSkeleton />;
  }

  if (isLoading) {
    return (
      <ModernLayout title="Dashboard" subtitle="Carregando...">
        <div className="flex flex-col h-full min-h-[200px]" aria-hidden />
      </ModernLayout>
    );
  }

  return (
    <ModernLayout 
      title="Dashboard" 
      subtitle={canSeeRelatorios ? "Visão geral e gestão" : "Acesso rápido às principais funcionalidades"}
    >
      <div className="flex flex-col min-h-0 md:h-full md:overflow-hidden">
        {/* Indicadores Financeiros + Alertas — mobile: 2 cols, toque confortável */}
        {canSeeRelatorios && financialData && (
          <div className="flex-shrink-0 px-3 sm:px-3 md:px-0 pb-3 sm:pb-4 border-b border-gray-200 dark:border-gray-700 bg-background">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 className="text-base md:text-lg font-semibold">Indicadores Financeiros</h2>
              <div className="flex items-center gap-2 min-h-[44px]">
                <DashboardPeriodFilter
                  value={trendPeriod}
                  onChange={setTrendPeriod}
                  periodStartDate={periodStartDate}
                  periodEndDate={periodEndDate}
                  customDateRange={trendPeriod === 'custom' ? customDateRange : undefined}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 min-h-[44px] w-11 sm:h-9 sm:w-9 sm:min-h-0 shrink-0 border-gray-300 dark:border-gray-600 rounded-xl sm:rounded-md touch-manipulation"
                  onClick={() => {
                    const next = !valuesVisible;
                    setStoredValuesVisible(next);
                    setValuesVisible(next);
                  }}
                  title={valuesVisible ? 'Ocultar valores' : 'Exibir valores'}
                  aria-label={valuesVisible ? 'Ocultar valores em reais' : 'Exibir valores em reais'}
                >
                  {valuesVisible ? (
                    <Eye className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-muted-foreground" />
                  ) : (
                    <EyeOff className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-muted-foreground" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 min-h-[44px] w-11 sm:h-9 sm:w-9 sm:min-h-0 shrink-0 border-gray-300 dark:border-gray-600 rounded-xl sm:rounded-md touch-manipulation"
                  onClick={() => { refetch(); refetchFinanceiro(); }}
                  title="Atualizar dados"
                  aria-label="Atualizar dashboard"
                  disabled={dataLoading || financeiroLoading}
                >
                  <RefreshCw className={`h-4 w-4 sm:h-4.5 sm:w-4.5 text-muted-foreground ${dataLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2 md:gap-3">
              <FinancialCards
                data={financialData}
                financeiroKpis={trendPeriod === 'day' ? (kpisFromDaySummary ?? undefined) : financeiroDashboard?.kpis}
                valuesVisible={valuesVisible}
                inline
                compact
              />
            </div>
          </div>
        )}

        {/* Conteúdo — mobile: página rola; desktop: scroll interno */}
        <div className="md:flex-1 md:min-h-0 md:overflow-y-auto overflow-x-hidden scrollbar-thin px-3 sm:px-3 md:px-0 pt-3 sm:pt-4">
          <div className="space-y-4 sm:space-y-5 md:space-y-6 pb-6 sm:pb-6 max-w-full min-w-0">
            {/* Renderizar widgets conforme configuração (exceto financial-cards que está fixo) */}
            {enabledWidgets.map((widget) => {
              switch (widget.id) {
                case 'financial-cards':
                  // Já renderizado fixo no topo
                  return null;

                case 'os-status':
                  if (!osData) return null;
                  return (
                    <div key={widget.id} className="w-full min-w-0">
                      <h2 className="text-base md:text-lg font-semibold mb-2 sm:mb-3">Ordens de Serviço</h2>
                      <OSStatusCards data={osData} showValues={canSeeRelatorios} />
                    </div>
                  );

                case 'alerts':
                  return null;

                case 'trend-charts':
                  if (!canSeeRelatorios) return null;
                  return (
                    <div key={widget.id} className="w-full min-w-0">
                      <TrendCharts
                        data={trendChartData}
                        valuesVisible={valuesVisible}
                        period={trendPeriod}
                        hidePeriodSelector
                      />
                    </div>
                  );

                default:
                  return null;
              }
            })}
          </div>
        </div>
      </div>
    </ModernLayout>
  );
};

export default Index;
