import { useState } from 'react';
import { ModernLayout } from '@/components/ModernLayout';
import { DateFilterBar } from '@/components/financeiro/DateFilterBar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { currencyFormatters, dateFormatters } from '@/utils/formatters';
import { CashFlowChart } from '@/components/financeiro/CashFlowChart';
import { DREComplete } from '@/components/financeiro/DREComplete';
import { FinancialCharts } from '@/components/financeiro/FinancialCharts';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { from } from '@/integrations/db/client';
import { useQuery } from '@tanstack/react-query';

export default function FinanceiroRelatoriosPage() {
  const [selectedReport, setSelectedReport] = useState<string>('dre');
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all' | 'custom'>('month');
  const [customDateStart, setCustomDateStart] = useState<Date | undefined>(undefined);
  const [customDateEnd, setCustomDateEnd] = useState<Date | undefined>(undefined);
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);

  // Buscar vendas do período
  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['sales-report', startDate, endDate],
    queryFn: async () => {
      try {
        let q = from('sales')
          .select('id, numero, cliente_nome, total, created_at, status, observacoes')
          .eq('status', 'paid')
          .order('created_at', { ascending: false });
        
        if (startDate && endDate && startDate !== '' && endDate !== '') {
          q = q.gte('created_at', startDate).lte('created_at', endDate + 'T23:59:59');
        }
        
        const { data, error } = await q.execute();
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.warn('Erro ao buscar vendas:', err);
        return [];
      }
    },
  });

  if (salesLoading) {
    return (
      <ModernLayout title="Relatórios" subtitle="Relatórios financeiros">
        <div className="flex flex-col gap-4">
          <LoadingSkeleton type="table" count={5} />
        </div>
      </ModernLayout>
    );
  }

  return (
    <ModernLayout title="Relatórios" subtitle="Relatórios financeiros">
      <div className="flex flex-col gap-4">
        {/* Filtros de Data */}
        <DateFilterBar
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
        
        <div className="flex flex-col gap-4">
          {/* Seleção de Relatório */}
          <Card className="flex-shrink-0">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedReport('dre')}
                  className={`px-4 py-2 rounded-lg border-2 font-semibold text-sm ${
                    selectedReport === 'dre'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-gray-400 hover:border-gray-600'
                  }`}
                >
                  DRE
                </button>
                <button
                  onClick={() => setSelectedReport('fluxo')}
                  className={`px-4 py-2 rounded-lg border-2 font-semibold text-sm ${
                    selectedReport === 'fluxo'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-gray-400 hover:border-gray-600'
                  }`}
                >
                  Fluxo de Caixa
                </button>
                <button
                  onClick={() => setSelectedReport('graficos')}
                  className={`px-4 py-2 rounded-lg border-2 font-semibold text-sm ${
                    selectedReport === 'graficos'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-gray-400 hover:border-gray-600'
                  }`}
                >
                  Gráficos
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Conteúdo do Relatório */}
          <div className="flex-1">
            {selectedReport === 'dre' && (
              <DREComplete startDate={startDate} endDate={endDate} />
            )}
            {selectedReport === 'fluxo' && (
              <CashFlowChart startDate={startDate} endDate={endDate} />
            )}
            {selectedReport === 'graficos' && (
              <FinancialCharts startDate={startDate} endDate={endDate} />
            )}
          </div>
        </div>
      </div>
    </ModernLayout>
  );
}
