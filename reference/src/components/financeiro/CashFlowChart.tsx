import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
// TODO: Implementar hooks do sistema financeiro antigo ou migrar para novo sistema
// import { useFinancialTransactions, useBillsToPay } from '@/hooks/useFinanceiro';
import { currencyFormatters } from '@/utils/formatters';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { from } from '@/integrations/db/client';

interface CashFlowChartProps {
  month?: string;
  startDate?: string;
  endDate?: string;
}

export function CashFlowChart({ month, startDate, endDate }: CashFlowChartProps) {
  // TODO: Implementar hooks do sistema financeiro antigo
  const transactions: any[] = [];
  const isLoading = false;
  const bills: any[] = [];

  // Buscar vendas pagas
  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['sales-cashflow', startDate, endDate],
    queryFn: async () => {
      try {
        let q = from('sales')
          .select('id, total, created_at')
          .eq('status', 'paid')
          .order('created_at', { ascending: true });
        
        // Só aplicar filtro se ambos estiverem definidos e não vazios
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

  if (isLoading || salesLoading) {
    return <Card><CardContent className="pt-6">Carregando...</CardContent></Card>;
  }

  // Agrupar por dia - incluindo vendas como entrada
  const dailyData: Record<string, { entrada: number; saida: number }> = {};
  
  // Adicionar vendas como entradas
  sales.forEach((sale: any) => {
    const date = sale.created_at?.split('T')[0];
    if (date) {
      if (!dailyData[date]) dailyData[date] = { entrada: 0, saida: 0 };
      dailyData[date].entrada += Number(sale.total || 0);
    }
  });
  
  // Adicionar transações manuais
  transactions.forEach(t => {
    const date = t.transaction_date;
    if (!dailyData[date]) dailyData[date] = { entrada: 0, saida: 0 };
    if (t.type === 'entrada') {
      dailyData[date].entrada += t.amount;
    } else {
      dailyData[date].saida += t.amount;
    }
  });
  
  // Adicionar contas pagas como saída
  bills.filter(b => b.status === 'pago' && b.payment_date).forEach(bill => {
    const date = bill.payment_date!;
    if (!dailyData[date]) dailyData[date] = { entrada: 0, saida: 0 };
    dailyData[date].saida += bill.amount;
  });

  const sortedDays = Object.keys(dailyData).sort();
  const allValues = Object.values(dailyData).flatMap(d => [d.entrada, d.saida]).filter(v => v > 0);
  const maxValue = allValues.length > 0 ? Math.max(...allValues) : 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fluxo de Caixa Diário</CardTitle>
        <CardDescription>Entradas e saídas por dia do período</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedDays.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma transação no período
            </div>
          ) : (
            sortedDays.map(date => {
              const data = dailyData[date];
              const saldo = data.entrada - data.saida;
              
              return (
                <div key={date} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {new Date(date).toLocaleDateString('pt-BR', { 
                        day: '2-digit', 
                        month: 'short' 
                      })}
                    </span>
                    <span className={cn(
                      "font-semibold",
                      saldo >= 0 ? "text-success" : "text-destructive"
                    )}>
                      {currencyFormatters.brl(saldo)}
                    </span>
                  </div>
                  
                  <div className="space-y-1">
                    {data.entrada > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-success" />
                        <span className="text-xs text-muted-foreground flex-1">Entradas</span>
                        <span className="text-xs font-medium text-success">
                          {currencyFormatters.brl(data.entrada)}
                        </span>
                        <div className="flex-1 bg-muted h-2 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-success"
                            style={{ width: `${(data.entrada / maxValue) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                    
                    {data.saida > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-destructive" />
                        <span className="text-xs text-muted-foreground flex-1">Saídas</span>
                        <span className="text-xs font-medium text-destructive">
                          {currencyFormatters.brl(data.saida)}
                        </span>
                        <div className="flex-1 bg-muted h-2 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-destructive"
                            style={{ width: `${(data.saida / maxValue) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

