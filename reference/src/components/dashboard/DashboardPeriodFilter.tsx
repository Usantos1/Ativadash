import { useState, useEffect } from 'react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Check, ChevronDown, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TrendPeriod, CustomDateRange } from '@/hooks/useDashboardData';
import { TREND_PERIOD_LABELS } from './TrendCharts';

const PERIOD_OPTIONS: { value: Exclude<TrendPeriod, 'custom'>; label: string }[] = [
  { value: 'day', label: 'Hoje' },
  { value: 'week', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: 'lastMonth', label: 'Mês anterior' },
  { value: 'month', label: 'Este mês' },
  { value: '3m', label: '3 meses' },
  { value: '6m', label: '6 meses' },
  { value: 'year', label: '1 ano' },
];

interface DashboardPeriodFilterProps {
  value: TrendPeriod;
  onChange: (period: TrendPeriod, customRange?: CustomDateRange) => void;
  /** Datas reais do período em uso (para exibir no painel e alinhar com gráficos) */
  periodStartDate?: string;
  periodEndDate?: string;
  customDateRange?: CustomDateRange | null;
  className?: string;
  triggerClassName?: string;
}

function formatDisplayDate(iso: string) {
  try {
    const d = new Date(iso + 'T12:00:00');
    return format(d, 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return iso;
  }
}

export function DashboardPeriodFilter({
  value,
  onChange,
  periodStartDate,
  periodEndDate,
  customDateRange,
  className,
  triggerClassName,
}: DashboardPeriodFilterProps) {
  const [open, setOpen] = useState(false);
  const [editingCustom, setEditingCustom] = useState(false);
  const [customStart, setCustomStart] = useState<Date | undefined>(() =>
    customDateRange?.start ? new Date(customDateRange.start + 'T12:00:00') : subDays(new Date(), 6)
  );
  const [customEnd, setCustomEnd] = useState<Date | undefined>(() =>
    customDateRange?.end ? new Date(customDateRange.end + 'T12:00:00') : new Date()
  );

  useEffect(() => {
    if (customDateRange?.start) setCustomStart(new Date(customDateRange.start + 'T12:00:00'));
    if (customDateRange?.end) setCustomEnd(new Date(customDateRange.end + 'T12:00:00'));
  }, [customDateRange?.start, customDateRange?.end]);

  const currentLabel = value === 'custom' ? (customDateRange ? 'Personalizado' : 'Personalizar') : (TREND_PERIOD_LABELS[value] || value);
  const periodSubtitle =
    periodStartDate && periodEndDate
      ? `${formatDisplayDate(periodStartDate)} – ${formatDisplayDate(periodEndDate)}`
      : '—';

  const handleSelectFixed = (period: Exclude<TrendPeriod, 'custom'>) => {
    setEditingCustom(false);
    onChange(period);
    setOpen(false);
  };

  const handleSelectPersonalizar = () => {
    setEditingCustom(true);
  };

  const handleApplyCustom = () => {
    if (customStart && customEnd) {
      const start = format(customStart, 'yyyy-MM-dd');
      const end = format(customEnd, 'yyyy-MM-dd');
      if (start <= end) {
        setEditingCustom(false);
        onChange('custom', { start, end });
        setOpen(false);
      }
    }
  };

  const canApplyCustom = customStart && customEnd && customStart <= customEnd;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-[130px] sm:w-[140px] justify-between text-xs sm:text-sm border-gray-300 dark:border-gray-600',
            'min-h-[44px] h-11 sm:min-h-0 sm:h-8 rounded-xl sm:rounded-md touch-manipulation',
            triggerClassName
          )}
        >
          <span className="truncate">{currentLabel}</span>
          <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn('w-auto p-0', className)} align="end" sideOffset={4}>
        <div className="flex flex-col sm:flex-row max-h-[70vh] sm:max-h-[520px]">
          <div className="border-b sm:border-b-0 sm:border-r border-gray-200 dark:border-gray-700 min-w-[200px] max-h-[320px] sm:max-h-none overflow-y-auto">
            <div className="py-1">
              {PERIOD_OPTIONS.map((opt, idx) => (
                <button
                  key={`${opt.value}-${idx}`}
                  type="button"
                  onClick={() => handleSelectFixed(opt.value)}
                  className={cn(
                    'w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted/80 transition-colors',
                    value === opt.value && 'bg-primary/10 text-primary font-medium'
                  )}
                >
                  <span className="block truncate">{opt.label}</span>
                  {value === opt.value && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              ))}
              <button
                type="button"
                onClick={handleSelectPersonalizar}
                className={cn(
                  'w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted/80 transition-colors',
                  (value === 'custom' || editingCustom) && 'bg-primary/10 text-primary font-medium'
                )}
              >
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  Personalizar
                </span>
                {(value === 'custom' || editingCustom) && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </button>
            </div>
          </div>
          <div className="p-3 sm:w-64 border-t sm:border-t-0 border-gray-200 dark:border-gray-700 bg-muted/30 flex flex-col">
            {value === 'custom' || editingCustom ? (
              <>
                <p className="text-xs font-medium text-muted-foreground mb-2">Período personalizado</p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">De</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal h-8 text-xs">
                          <CalendarDays className="h-3 w-3 mr-1.5" />
                          {customStart ? format(customStart, 'dd/MM/yyyy', { locale: ptBR }) : 'Data'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={customStart} onSelect={setCustomStart} locale={ptBR} />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">Até</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal h-8 text-xs">
                          <CalendarDays className="h-3 w-3 mr-1.5" />
                          {customEnd ? format(customEnd, 'dd/MM/yyyy', { locale: ptBR }) : 'Data'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={customEnd} onSelect={setCustomEnd} locale={ptBR} />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <Button size="sm" className="w-full mt-auto" onClick={handleApplyCustom} disabled={!canApplyCustom}>
                  Aplicar período
                </Button>
              </>
            ) : (
              <>
                <p className="text-xs font-medium text-muted-foreground mb-1">Período selecionado</p>
                <p className="text-sm font-medium">{TREND_PERIOD_LABELS[value] || value}</p>
                <p className="text-xs text-muted-foreground mt-1">{periodSubtitle}</p>
              </>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
