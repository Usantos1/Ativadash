import { useState } from 'react';
import { format } from 'date-fns';
import { ModernLayout } from '@/components/ModernLayout';
import { DREComplete } from '@/components/financeiro/DREComplete';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { getStoredValuesVisible, ValuesVisibilityToggle } from '@/components/dashboard/FinancialCards';

function getDefaultMonthRange() {
  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);
  return { start: format(monthAgo, 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') };
}

export default function DRE() {
  const defaultRange = getDefaultMonthRange();
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all' | 'custom'>('month');
  const [customDateStart, setCustomDateStart] = useState<Date | undefined>(undefined);
  const [customDateEnd, setCustomDateEnd] = useState<Date | undefined>(undefined);
  const [startDate, setStartDate] = useState<string | undefined>(defaultRange.start);
  const [endDate, setEndDate] = useState<string | undefined>(defaultRange.end);
  const [valuesVisible, setValuesVisible] = useState(getStoredValuesVisible);

  return (
    <ModernLayout
      title="DRE - Demonstrativo do Resultado do Exercício"
      subtitle="Demonstração do resultado financeiro"
      headerActions={<ValuesVisibilityToggle valuesVisible={valuesVisible} setValuesVisible={setValuesVisible} />}
    >
      <div className="flex flex-col gap-4 pb-8 min-w-0">
        <div className="flex-1 min-w-0">
          <DREComplete
            valuesVisible={valuesVisible}
            startDate={startDate}
            endDate={endDate}
            dateFilter={dateFilter}
            onDateFilterChange={setDateFilter}
            customDateStart={customDateStart}
            customDateEnd={customDateEnd}
            onCustomDateStartChange={setCustomDateStart}
            onCustomDateEndChange={setCustomDateEnd}
            onDatesChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
            }}
          />
        </div>
      </div>
    </ModernLayout>
  );
}
