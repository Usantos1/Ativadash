import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { ModernLayout } from '@/components/ModernLayout';
import { TransactionsManager } from '@/components/financeiro/TransactionsManager';
import { DateFilterBar } from '@/components/financeiro/DateFilterBar';
import { getStoredValuesVisible, ValuesVisibilityToggle } from '@/components/dashboard/FinancialCards';

const STORAGE_KEY = 'financeiro_transacoes_filter';
type DateFilterType = 'today' | 'week' | 'month' | 'all' | 'custom';

function getDateRangeFromFilter(
  dateFilter: DateFilterType,
  customDateStart?: Date,
  customDateEnd?: Date
): { startDate: string | undefined; endDate: string | undefined } {
  const today = new Date();
  if (dateFilter === 'today') {
    const d = format(today, 'yyyy-MM-dd');
    return { startDate: d, endDate: d };
  }
  if (dateFilter === 'week') {
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return { startDate: format(weekAgo, 'yyyy-MM-dd'), endDate: format(today, 'yyyy-MM-dd') };
  }
  if (dateFilter === 'month') {
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);
    return { startDate: format(monthAgo, 'yyyy-MM-dd'), endDate: format(today, 'yyyy-MM-dd') };
  }
  if (dateFilter === 'custom' && customDateStart && customDateEnd) {
    return { startDate: format(customDateStart, 'yyyy-MM-dd'), endDate: format(customDateEnd, 'yyyy-MM-dd') };
  }
  return { startDate: undefined, endDate: undefined };
}

function loadSavedFilter(): {
  dateFilter: DateFilterType;
  customDateStart: Date | undefined;
  customDateEnd: Date | undefined;
  startDate: string | undefined;
  endDate: string | undefined;
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultFilter();
    const parsed = JSON.parse(raw);
    const dateFilter = (parsed.dateFilter || 'month') as DateFilterType;
    const customDateStart = parsed.customDateStart ? new Date(parsed.customDateStart) : undefined;
    const customDateEnd = parsed.customDateEnd ? new Date(parsed.customDateEnd) : undefined;
    const { startDate, endDate } = getDateRangeFromFilter(dateFilter, customDateStart, customDateEnd);
    return { dateFilter, customDateStart, customDateEnd, startDate, endDate };
  } catch {
    return getDefaultFilter();
  }
}

function getDefaultFilter() {
  const { startDate, endDate } = getDateRangeFromFilter('month');
  return {
    dateFilter: 'month' as DateFilterType,
    customDateStart: undefined as Date | undefined,
    customDateEnd: undefined as Date | undefined,
    startDate,
    endDate,
  };
}

export default function FinanceiroTransacoesPage() {
  const saved = useMemo(() => loadSavedFilter(), []);
  const [dateFilter, setDateFilter] = useState<DateFilterType>(saved.dateFilter);
  const [customDateStart, setCustomDateStart] = useState<Date | undefined>(saved.customDateStart);
  const [customDateEnd, setCustomDateEnd] = useState<Date | undefined>(saved.customDateEnd);
  const [startDate, setStartDate] = useState<string | undefined>(saved.startDate);
  const [endDate, setEndDate] = useState<string | undefined>(saved.endDate);
  const [valuesVisible, setValuesVisible] = useState(getStoredValuesVisible);

  const saveFilter = (filter: DateFilterType, customStart?: Date, customEnd?: Date) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        dateFilter: filter,
        customDateStart: customStart?.toISOString(),
        customDateEnd: customEnd?.toISOString(),
      }));
    } catch (_) {}
  };

  const handleDatesChange = (start: string | undefined, end: string | undefined) => {
    setStartDate(start);
    setEndDate(end);
    saveFilter(dateFilter, customDateStart, customDateEnd);
  };

  const handleDateFilterChange = (filter: DateFilterType) => {
    setDateFilter(filter);
    const { startDate: s, endDate: e } = getDateRangeFromFilter(filter, customDateStart, customDateEnd);
    setStartDate(s);
    setEndDate(e);
    saveFilter(filter, customDateStart, customDateEnd);
  };

  return (
    <ModernLayout
      title="Transações"
      subtitle="Transações financeiras"
      headerActions={<ValuesVisibilityToggle valuesVisible={valuesVisible} setValuesVisible={setValuesVisible} />}
    >
      <div className="flex flex-col gap-4 pb-8 min-w-0">
        {/* Filtros de Data */}
        <DateFilterBar
          dateFilter={dateFilter}
          onDateFilterChange={handleDateFilterChange}
          customDateStart={customDateStart}
          customDateEnd={customDateEnd}
          onCustomDateStartChange={setCustomDateStart}
          onCustomDateEndChange={setCustomDateEnd}
          onDatesChange={handleDatesChange}
        />
        
        <div className="flex-1 min-w-0">
          <TransactionsManager startDate={startDate} endDate={endDate} valuesVisible={valuesVisible} />
        </div>
      </div>
    </ModernLayout>
  );
}
