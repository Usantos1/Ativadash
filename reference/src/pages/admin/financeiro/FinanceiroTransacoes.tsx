import { useOutletContext } from 'react-router-dom';
import { TransactionsManager } from '@/components/financeiro/TransactionsManager';

export function FinanceiroTransacoes() {
  const context = useOutletContext<{ startDate: string; endDate?: string; month?: string; dateFilter?: string }>();
  // Se for "all", não filtrar
  const shouldFilter = context.dateFilter !== 'all';
  const month = shouldFilter ? (context.month || context.startDate?.slice(0, 7)) : undefined;
  const startDate = shouldFilter ? context.startDate : undefined;
  const endDate = shouldFilter ? context.endDate : undefined;
  
  return <TransactionsManager month={month} startDate={startDate} endDate={endDate} />;
}
