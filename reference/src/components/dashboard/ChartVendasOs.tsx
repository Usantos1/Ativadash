import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DashboardTrendData, TrendPeriod } from '@/hooks/useDashboardData';
import { ShoppingBag, Wrench } from 'lucide-react';
import { currencyFormatters } from '@/utils/formatters';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const MASKED = '••••';
const PERIOD_LABELS: Record<TrendPeriod, string> = {
  day: 'Dia',
  week: 'Semana',
  '30d': 'Últimos 30 dias',
  lastMonth: 'Mês anterior',
  month: 'Este mês',
  '3m': '3 meses',
  '6m': '6 meses',
  year: '1 ano',
  custom: 'Personalizado',
};

interface ChartVendasOsProps {
  data: DashboardTrendData[];
  /** vendas = faturamento PDV (produtos), faturamento_os = faturamento de ordens de serviço */
  series: 'vendas' | 'faturamento_os';
  valuesVisible?: boolean;
  period?: TrendPeriod;
  onPeriodChange?: (period: TrendPeriod) => void;
}

const formatYAxis = (value: number, valuesVisible: boolean) => {
  if (!valuesVisible) return MASKED;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return value.toString();
};

export function ChartVendasOs({ data, series, valuesVisible = true, period = 'week', onPeriodChange }: ChartVendasOsProps) {
  const isEmpty = data.length === 0;
  const isVendasProdutos = series === 'vendas';
  const title = isVendasProdutos ? 'Vendas de Produtos' : 'Faturamento OS';
  const dataKey = series;
  const name = isVendasProdutos ? 'Faturamento (produtos)' : 'Faturamento (OS)';
  const color = isVendasProdutos ? '#34d399' : '#22c55e';
  const gradientId = isVendasProdutos ? 'gradVendasProd' : 'gradFaturamentoOS';

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
    if (!active || !payload?.length) return null;
    const value = payload[0].value;
    return (
      <div className="bg-white dark:bg-gray-900 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg text-sm">
        <p className="font-semibold mb-2">{label}</p>
        <p style={{ color }}>
          {name}: {valuesVisible ? currencyFormatters.brl(value) : MASKED}
        </p>
      </div>
    );
  };

  return (
    <Card className="border-2 border-gray-300 dark:border-gray-600 shadow-sm w-full min-w-0 overflow-hidden">
      <CardHeader className="pb-2 sm:pb-3 pt-3 sm:pt-4 md:pt-6 px-3 sm:px-4 md:px-6 border-b-2 border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base md:text-xl">
            <div className="p-1.5 md:p-2 rounded-lg bg-gradient-to-br from-emerald-100 to-rose-100 dark:from-emerald-900/30 dark:to-rose-900/30 border border-gray-200 dark:border-gray-600 flex-shrink-0">
              {isVendasProdutos ? (
                <ShoppingBag className="h-4 w-4 md:h-5 md:w-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Wrench className="h-4 w-4 md:h-5 md:w-5 text-emerald-600 dark:text-emerald-400" />
              )}
            </div>
            <span className="truncate">{title}</span>
          </CardTitle>
          {onPeriodChange && (
            <Select value={period} onValueChange={(v) => onPeriodChange(v as TrendPeriod)}>
              <SelectTrigger className="w-[110px] sm:w-[120px] h-8 text-xs sm:text-sm border-gray-300 dark:border-gray-600">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PERIOD_LABELS) as TrendPeriod[]).map((p) => (
                  <SelectItem key={p} value={p}>{PERIOD_LABELS[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 md:p-6">
        <div className="w-full min-h-[220px] sm:min-h-[250px] md:min-h-[280px]">
          {isEmpty ? (
            <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">
              Nenhum dado para o período selecionado
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minHeight={220}>
              <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.8} />
                    <stop offset="100%" stopColor={isVendasProdutos ? '#f472b6' : color} stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                <YAxis tickFormatter={(v) => formatYAxis(v, valuesVisible)} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={valuesVisible ? 36 : 28} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
                <Area type="monotone" dataKey={dataKey} name={name} stroke={color} strokeWidth={2} fill={`url(#${gradientId})`} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
