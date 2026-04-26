import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  AreaChart,
  Area,
  CartesianGrid,
} from 'recharts';
import { DashboardTrendData, TrendPeriod } from '@/hooks/useDashboardData';
import { TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { currencyFormatters } from '@/utils/formatters';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TrendChartsProps {
  data: DashboardTrendData[];
  /** Exibir valores em R$ e números (false = ocultar como em bancos) */
  valuesVisible?: boolean;
  period?: TrendPeriod;
  onPeriodChange?: (period: TrendPeriod) => void;
  /** Quando true, não mostra o seletor de período (ex.: já está no topo da página) */
  hidePeriodSelector?: boolean;
}

const MASKED = '••••';

// Formatador para o eixo Y (abreviado)
const formatYAxis = (value: number, valuesVisible: boolean) => {
  if (!valuesVisible) return MASKED;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return value.toString();
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  valuesVisible: boolean;
}

const CustomTooltip = ({ active, payload, label, valuesVisible }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-900 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg text-sm">
      <p className="font-semibold mb-2">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} style={{ color: entry.color }} className="flex items-center gap-2">
          <span>{entry.name}:</span>
          <span>
            {valuesVisible ? currencyFormatters.brl(entry.value) : MASKED}
          </span>
        </p>
      ))}
    </div>
  );
};

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

export const TREND_PERIOD_LABELS = PERIOD_LABELS;

const safeTickFormatter = (data: DashboardTrendData[], value: string, index: number) => {
  const point = data[index];
  const dateStr = point?.data || value;
  if (typeof dateStr === 'string' && dateStr.length >= 10) {
    try {
      const d = dateStr.length === 10 ? new Date(dateStr + 'T12:00:00') : new Date(dateStr);
      if (!Number.isNaN(d.getTime())) return format(d, 'dd/MM', { locale: ptBR });
    } catch {
      // ignore
    }
  }
  return value;
};

const safeLabelFormatter = (payload: any[], label: string) => {
  const point = payload?.[0]?.payload;
  const dateStr = point?.data || label;
  if (typeof dateStr === 'string' && dateStr.length >= 10) {
    try {
      const d = dateStr.length === 10 ? new Date(dateStr + 'T12:00:00') : new Date(dateStr);
      if (!Number.isNaN(d.getTime())) return format(d, 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      // ignore
    }
  }
  return label;
};

export function TrendCharts({ data, valuesVisible = true, period = 'week', onPeriodChange, hidePeriodSelector }: TrendChartsProps) {
  const isEmpty = data.length === 0;
  const showPeriodInCard = onPeriodChange && !hidePeriodSelector;

  return (
    <div className="space-y-4 w-full min-w-0 overflow-hidden">
      <Card className="border-2 border-gray-300 dark:border-gray-600 shadow-sm w-full min-w-0 overflow-hidden rounded-xl md:rounded-lg">
        <CardHeader className="pb-2 sm:pb-3 pt-3 sm:pt-4 md:pt-6 px-3 sm:px-4 md:px-6 border-b-2 border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base md:text-xl">
                <div className="p-1.5 md:p-2 rounded-lg bg-gradient-to-br from-emerald-100 to-rose-100 dark:from-emerald-900/30 dark:to-rose-900/30 border border-gray-200 dark:border-gray-600 flex-shrink-0">
                  <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="truncate">Tendência de Vendas</span>
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-0.5">Evolução diária de vendas (PDV vs OS)</CardDescription>
            </div>
            {showPeriodInCard && (
              <Select value={period} onValueChange={(v) => onPeriodChange(v as TrendPeriod)}>
                <SelectTrigger className="w-[110px] sm:w-[120px] h-8 text-xs sm:text-sm border-gray-300 dark:border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">{PERIOD_LABELS.day}</SelectItem>
                  <SelectItem value="week">{PERIOD_LABELS.week}</SelectItem>
                  <SelectItem value="month">{PERIOD_LABELS.month}</SelectItem>
                  <SelectItem value="3m">{PERIOD_LABELS['3m']}</SelectItem>
                  <SelectItem value="6m">{PERIOD_LABELS['6m']}</SelectItem>
                  <SelectItem value="year">{PERIOD_LABELS.year}</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 md:p-6">
          {/* Gráfico principal: Total com gradiente — responsivo, sem overflow em mobile */}
          <div className="w-full min-h-[200px] sm:min-h-[240px] md:min-h-[260px] mb-4 min-w-0">
            {isEmpty ? (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                Nenhum dado para o período selecionado
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradientTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.9} />
                      <stop offset="50%" stopColor="#34d399" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#f472b6" stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    axisLine={{ stroke: 'var(--border)' }}
                    tickLine={false}
                    tickFormatter={(value, index) => safeTickFormatter(data, value, index)}
                  />
                  <YAxis
                    domain={[0, (dataMax: number) => Math.max(dataMax || 0, 100)]}
                    tickFormatter={(v) => (valuesVisible ? `R$ ${(v / 1000).toFixed(0)}k` : formatYAxis(v, false))}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={valuesVisible ? 44 : 28}
                  />
                  <Tooltip
                    content={<CustomTooltip valuesVisible={valuesVisible} />}
                    cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
                    labelFormatter={(label, payload) => safeLabelFormatter(payload, label)}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} formatter={(value) => (valuesVisible ? value : `${value} (oculto)`)} />
                  <Area type="monotone" dataKey="totalGeral" name="Total" stroke="#14b8a6" strokeWidth={2} fill="url(#gradientTotal)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Dois gráficos menores: Vendas PDV e Vendas OS (estilo foto 2 - verde e azul) */}
          {!isEmpty && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="min-h-[160px]">
                <p className="text-xs font-medium text-muted-foreground mb-2">Vendas PDV</p>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradientPDV" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" stopOpacity={0.7} />
                        <stop offset="100%" stopColor="#34d399" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 2" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} tickFormatter={(value, index) => safeTickFormatter(data, value, index)} />
                    <YAxis domain={[0, (dataMax: number) => Math.max(dataMax || 0, 100)]} tickFormatter={(v) => (valuesVisible ? `R$ ${(v / 1000).toFixed(0)}k` : formatYAxis(v, false))} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
                    <Tooltip content={<CustomTooltip valuesVisible={valuesVisible} />} cursor={{ stroke: 'var(--border)' }} labelFormatter={(label, payload) => safeLabelFormatter(payload, label)} />
                    <Area type="monotone" dataKey="totalPDV" name="PDV" stroke="#10b981" strokeWidth={1.5} fill="url(#gradientPDV)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="min-h-[160px]">
                <p className="text-xs font-medium text-muted-foreground mb-2">Vendas OS</p>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradientOS" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.7} />
                        <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 2" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} tickFormatter={(value, index) => safeTickFormatter(data, value, index)} />
                    <YAxis domain={[0, (dataMax: number) => Math.max(dataMax || 0, 100)]} tickFormatter={(v) => (valuesVisible ? `R$ ${(v / 1000).toFixed(0)}k` : formatYAxis(v, false))} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
                    <Tooltip content={<CustomTooltip valuesVisible={valuesVisible} />} cursor={{ stroke: 'var(--border)' }} labelFormatter={(label, payload) => safeLabelFormatter(payload, label)} />
                    <Area type="monotone" dataKey="totalOS" name="OS" stroke="#0ea5e9" strokeWidth={1.5} fill="url(#gradientOS)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
