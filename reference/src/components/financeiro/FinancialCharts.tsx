import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// TODO: Implementar hooks do sistema financeiro antigo ou migrar para novo sistema
// import { useFinancialTransactions, useBillsToPay } from '@/hooks/useFinanceiro';
import { currencyFormatters } from '@/utils/formatters';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { from } from '@/integrations/db/client';

interface FinancialChartsProps {
  month?: string;
  startDate?: string;
  endDate?: string;
}

const COLORS = ['#22c55e', '#ef4444', '#3b82f6', '#f97316', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export function FinancialCharts({ month, startDate, endDate }: FinancialChartsProps) {
  // TODO: Implementar hooks do sistema financeiro antigo
  const transactions: any[] = [];
  const bills: any[] = [];
  
  // Buscar vendas
  const { data: sales = [] } = useQuery({
    queryKey: ['sales-charts', startDate, endDate],
    queryFn: async () => {
      try {
        let q = from('sales')
          .select('id, total, created_at')
          .eq('status', 'paid');
        
        // Só aplicar filtro se ambos estiverem definidos e não vazios
        if (startDate && endDate && startDate !== '' && endDate !== '') {
          q = q.gte('created_at', startDate).lte('created_at', endDate + 'T23:59:59');
        }
        
        const { data, error } = await q.execute();
        if (error) throw error;
        return data || [];
      } catch (err) {
        return [];
      }
    },
  });

  // Dados para gráfico de barras (entradas vs saídas por dia)
  const dailyData: Record<string, { date: string; entradas: number; saidas: number }> = {};
  
  // Adicionar vendas como entradas
  sales.forEach((sale: any) => {
    const date = sale.created_at?.split('T')[0];
    if (date) {
      if (!dailyData[date]) dailyData[date] = { date, entradas: 0, saidas: 0 };
      dailyData[date].entradas += Number(sale.total || 0);
    }
  });
  
  // Adicionar transações manuais
  transactions.forEach(t => {
    const date = t.transaction_date;
    if (!dailyData[date]) dailyData[date] = { date, entradas: 0, saidas: 0 };
    if (t.type === 'entrada') {
      dailyData[date].entradas += t.amount;
    } else {
      dailyData[date].saidas += t.amount;
    }
  });
  
  // Adicionar contas pagas como saída
  bills.filter(b => b.status === 'pago' && b.payment_date).forEach(bill => {
    const date = bill.payment_date!;
    if (!dailyData[date]) dailyData[date] = { date, entradas: 0, saidas: 0 };
    dailyData[date].saidas += bill.amount;
  });

  const dailyChartData = Object.values(dailyData).sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Dados para gráfico de pizza (despesas por categoria)
  const expensesByCategory: Record<string, number> = {};
  
  transactions.filter(t => t.type === 'saida').forEach(t => {
    const catName = t.category?.name || 'Outras';
    expensesByCategory[catName] = (expensesByCategory[catName] || 0) + t.amount;
  });
  
  bills.filter(b => b.status === 'pago').forEach(bill => {
    const catName = bill.expense_type === 'fixa' ? 'Despesas Fixas' : 'Despesas Variáveis';
    expensesByCategory[catName] = (expensesByCategory[catName] || 0) + bill.amount;
  });

  const pieChartData = Object.entries(expensesByCategory).map(([name, value]) => ({
    name,
    value,
  }));

  // Dados para gráfico de linha (evolução do saldo)
  const balanceData = dailyChartData.reduce((acc, day, index) => {
    const previousBalance = index > 0 ? acc[index - 1].saldo : 0;
    const saldo = previousBalance + day.entradas - day.saidas;
    acc.push({
      date: day.date,
      saldo,
    });
    return acc;
  }, [] as { date: string; saldo: number }[]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Gráfico de Barras - Entradas vs Saídas */}
      <Card>
        <CardHeader>
          <CardTitle>Entradas vs Saídas Diárias</CardTitle>
          <CardDescription>Comparação diária de receitas e despesas</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(value) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              />
              <YAxis tickFormatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`} />
              <Tooltip 
                formatter={(value: number) => currencyFormatters.brl(value)}
                labelFormatter={(label) => new Date(label).toLocaleDateString('pt-BR')}
              />
              <Legend />
              <Bar dataKey="entradas" fill="#22c55e" name="Entradas" />
              <Bar dataKey="saidas" fill="#ef4444" name="Saídas" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráfico de Pizza - Despesas por Categoria */}
      <Card>
        <CardHeader>
          <CardTitle>Despesas por Categoria</CardTitle>
          <CardDescription>Distribuição das despesas no período</CardDescription>
        </CardHeader>
        <CardContent>
          {pieChartData.length === 0 ? (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              Nenhuma despesa registrada
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => currencyFormatters.brl(value)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Gráfico de Linha - Evolução do Saldo */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Evolução do Saldo</CardTitle>
          <CardDescription>Saldo acumulado ao longo do período</CardDescription>
        </CardHeader>
        <CardContent>
          {balanceData.length === 0 ? (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              Nenhuma transação registrada
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={balanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date"
                  tickFormatter={(value) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                />
                <YAxis tickFormatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`} />
                <Tooltip 
                  formatter={(value: number) => currencyFormatters.brl(value)}
                  labelFormatter={(label) => new Date(label).toLocaleDateString('pt-BR')}
                />
                <Line 
                  type="monotone" 
                  dataKey="saldo" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  name="Saldo"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

