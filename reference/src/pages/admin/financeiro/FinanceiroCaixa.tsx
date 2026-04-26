import { useOutletContext } from 'react-router-dom';
import { endOfMonth, parseISO, startOfMonth } from 'date-fns';
import { CashRegisterSessionsManager } from '@/components/financeiro/CashRegisterSessionsManager';

export function FinanceiroCaixa() {
  const context = useOutletContext<{ startDate: string; endDate?: string; month?: string }>();
  const monthKey = context.month || context.startDate.slice(0, 7);
  const monthStart = parseISO(`${monthKey}-01`);
  const customDateStart = startOfMonth(monthStart);
  const customDateEnd = endOfMonth(monthStart);

  return (
    <CashRegisterSessionsManager
      dateFilter="custom"
      customDateStart={customDateStart}
      customDateEnd={customDateEnd}
      statusFilter="all"
    />
  );
}
