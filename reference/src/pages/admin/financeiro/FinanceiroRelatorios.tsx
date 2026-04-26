import { useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { currencyFormatters, dateFormatters } from '@/utils/formatters';
import { exportDREToCSV, exportTransactionsToCSV, printData } from '@/utils/exportFinancial';
// TODO: Implementar hooks do sistema financeiro antigo ou migrar para novo sistema
// import { useFinancialTransactions, useBillsToPay, useCashClosings, useFinancialCategories } from '@/hooks/useFinanceiro';
import { CashFlowChart } from '@/components/financeiro/CashFlowChart';
import { DREComplete } from '@/components/financeiro/DREComplete';
import { FinancialCharts } from '@/components/financeiro/FinancialCharts';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { from } from '@/integrations/db/client';
import { useQuery } from '@tanstack/react-query';

interface FinanceiroContext {
  startDate: string;
  endDate?: string;
  month?: string;
  dateFilter?: string;
  selectedReport: string;
  setSelectedReport: (report: string) => void;
}

export function FinanceiroRelatorios() {
  const context = useOutletContext<FinanceiroContext>();
  // Se for "all", não filtrar
  const shouldFilter = context.dateFilter !== 'all';
  const month = shouldFilter ? (context.month || context.startDate?.slice(0, 7)) : undefined;
  const startDate = shouldFilter ? context.startDate : undefined;
  const endDate = shouldFilter ? context.endDate : undefined;
  const selectedReport = context.selectedReport || 'dre';

  // TODO: Implementar hooks do sistema financeiro antigo
  const transactions: any[] = [];
  const transactionsLoading = false;
  const bills: any[] = [];
  const billsLoading = false;
  const cashClosings: any[] = [];
  const closingsLoading = false;
  const categories: any[] = [];

  // Buscar vendas do período
  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['sales-report', startDate, endDate],
    queryFn: async () => {
      try {
        let q = from('sales')
          .select('id, numero, cliente_nome, total, created_at, status, observacoes')
          .eq('status', 'paid')
          .order('created_at', { ascending: false });
        
        if (startDate && endDate) {
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

  // Calcular DRE a partir das transações
  const receitas = transactions
    .filter(t => t.type === 'entrada')
    .reduce((acc, t) => {
      const catName = t.category?.name || 'Outras Receitas';
      if (!acc[catName]) acc[catName] = 0;
      acc[catName] += t.amount;
      return acc;
    }, {} as Record<string, number>);

  const despesas = transactions
    .filter(t => t.type === 'saida')
    .reduce((acc, t) => {
      const catName = t.category?.name || 'Outras Despesas';
      if (!acc[catName]) acc[catName] = 0;
      acc[catName] += t.amount;
      return acc;
    }, {} as Record<string, number>);

  const dreData = {
    receitas: Object.entries(receitas).map(([descricao, valor]) => ({ descricao, valor })),
    despesas: Object.entries(despesas).map(([descricao, valor]) => ({ descricao, valor })),
  };

  const totalReceitas = Object.values(receitas).reduce((sum, v) => sum + v, 0);
  const totalDespesas = Object.values(despesas).reduce((sum, v) => sum + v, 0);
  const lucroLiquido = totalReceitas - totalDespesas;
  const margemLucro = totalReceitas > 0 ? (lucroLiquido / totalReceitas) * 100 : 0;

  // Escutar eventos de exportação e impressão do header
  useEffect(() => {
    const handleExportExcel = () => {
      if (selectedReport === 'dre') {
        exportDREToCSV(
          dreData.receitas,
          dreData.despesas,
          totalReceitas,
          totalDespesas,
          lucroLiquido,
          margemLucro,
          month
        );
      } else if (selectedReport === 'vendas') {
        exportTransactionsToCSV(
          transactions.filter(t => t.type === 'entrada'),
          month
        );
      }
    };

    const handlePrint = () => {
      if (selectedReport === 'dre') {
        printData({
          title: `DRE - ${month ? month.replace('-', '/') : 'Todo período'}`,
          headers: ['Descrição', 'Valor (R$)'],
          rows: [
            ['RECEITAS OPERACIONAIS', ''],
            ...dreData.receitas.map(r => [r.descricao, currencyFormatters.brl(r.valor)]),
            ['TOTAL RECEITAS', currencyFormatters.brl(totalReceitas)],
            ['', ''],
            ['DESPESAS OPERACIONAIS', ''],
            ...dreData.despesas.map(d => [d.descricao, currencyFormatters.brl(d.valor)]),
            ['TOTAL DESPESAS', currencyFormatters.brl(totalDespesas)],
            ['', ''],
            ['LUCRO LÍQUIDO', currencyFormatters.brl(lucroLiquido)],
            ['MARGEM LÍQUIDA (%)', `${margemLucro.toFixed(2)}%`],
          ],
        }, `Período: ${month ? month.replace('-', '/') : 'Todo período'}`);
      }
    };

    window.addEventListener('financeiro-export-excel', handleExportExcel);
    window.addEventListener('financeiro-print', handlePrint);

    return () => {
      window.removeEventListener('financeiro-export-excel', handleExportExcel);
      window.removeEventListener('financeiro-print', handlePrint);
    };
  }, [selectedReport, dreData, totalReceitas, totalDespesas, lucroLiquido, margemLucro, month, transactions]);

  if (transactionsLoading || billsLoading || closingsLoading || salesLoading) {
    return <LoadingSkeleton type="cards" count={2} />;
  }

  return (
    <div className="space-y-4">
      {/* DRE Completo */}
      {selectedReport === 'dre' && (
        <DREComplete month={month} startDate={startDate} endDate={endDate} />
      )}

      {/* Fluxo de Caixa */}
      {selectedReport === 'fluxo' && (
        <CashFlowChart month={month} startDate={startDate} endDate={endDate} />
      )}

      {/* Contas a Pagar/Receber */}
      {selectedReport === 'contas' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Contas a Pagar</CardTitle>
              <CardDescription>Período: {month ? month.replace('-', '/') : 'Todo período'}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bills.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Nenhuma conta encontrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      bills.map(bill => (
                        <TableRow key={bill.id}>
                          <TableCell className="font-medium">{bill.description}</TableCell>
                          <TableCell>{dateFormatters.short(bill.due_date)}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {currencyFormatters.brl(bill.amount)}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded text-xs ${
                              bill.status === 'pago' ? 'bg-success/10 text-success' :
                              bill.status === 'atrasado' ? 'bg-destructive/10 text-destructive' :
                              'bg-warning/10 text-warning'
                            }`}>
                              {bill.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fechamentos de Caixa</CardTitle>
              <CardDescription>Período: {month ? month.replace('-', '/') : 'Todo período'}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">Total Vendas</TableHead>
                      <TableHead className="text-right">Diferença</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cashClosings.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Nenhum fechamento encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      cashClosings.map(closing => (
                        <TableRow key={closing.id}>
                          <TableCell>{dateFormatters.short(closing.closing_date)}</TableCell>
                          <TableCell>{closing.seller_name}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {currencyFormatters.brl(closing.total_sales)}
                          </TableCell>
                          <TableCell className={`text-right font-semibold ${
                            (closing.difference || 0) === 0 ? 'text-success' :
                            (closing.difference || 0) > 0 ? 'text-primary' : 'text-destructive'
                          }`}>
                            {currencyFormatters.brl(closing.difference || 0)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Vendas por Período */}
      {selectedReport === 'vendas' && (() => {
        // Função para extrair custo e lucro da observação
        const extractCustoLucro = (observacoes: string | null) => {
          if (!observacoes) return { custo: 0, lucro: 0 };
          const custoMatch = observacoes.match(/Custo:\s*R\$\s*([\d.,]+)/i);
          const lucroMatch = observacoes.match(/Lucro:\s*R\$\s*([\d.,]+)/i);
          const parseValor = (str: string) => {
            if (!str) return 0;
            return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
          };
          return {
            custo: custoMatch ? parseValor(custoMatch[1]) : 0,
            lucro: lucroMatch ? parseValor(lucroMatch[1]) : 0,
          };
        };

        // Calcular totais
        const totais = sales.reduce((acc, sale) => {
          const { custo, lucro } = extractCustoLucro(sale.observacoes);
          return {
            custo: acc.custo + custo,
            venda: acc.venda + Number(sale.total || 0),
            lucro: acc.lucro + lucro,
          };
        }, { custo: 0, venda: 0, lucro: 0 });

        return (
          <Card>
            <CardHeader>
              <CardTitle>Vendas por Período</CardTitle>
              <CardDescription>Período: {month ? month.replace('-', '/') : 'Todo período'}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right text-red-600">Vl Custo</TableHead>
                      <TableHead className="text-right text-blue-600">Vl Venda</TableHead>
                      <TableHead className="text-right text-green-600">Lucro Líquido</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Nenhuma venda encontrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      sales.map(sale => {
                        const { custo, lucro } = extractCustoLucro(sale.observacoes);
                        return (
                          <TableRow key={sale.id}>
                            <TableCell className="font-medium">#{sale.numero}</TableCell>
                            <TableCell>{dateFormatters.short(sale.created_at)}</TableCell>
                            <TableCell className="text-right text-red-600">
                              {custo > 0 ? currencyFormatters.brl(custo) : '-'}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-blue-600">
                              {currencyFormatters.brl(sale.total)}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-green-600">
                              {lucro > 0 ? currencyFormatters.brl(lucro) : '-'}
                            </TableCell>
                            <TableCell>
                              <span className="px-2 py-1 rounded text-xs bg-success/10 text-success">
                                {sale.status}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              {sales.length > 0 && (
                <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Total Custo</p>
                      <p className="text-lg font-bold text-red-600">
                        {currencyFormatters.brl(totais.custo)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Total Vendas</p>
                      <p className="text-lg font-bold text-blue-600">
                        {currencyFormatters.brl(totais.venda)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Total Lucro</p>
                      <p className="text-lg font-bold text-green-600">
                        {currencyFormatters.brl(totais.lucro)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Balanço Patrimonial */}
      {selectedReport === 'balanco' && (
        <Card>
          <CardHeader>
            <CardTitle>Balanço Patrimonial</CardTitle>
            <CardDescription>Período: {month ? month.replace('-', '/') : 'Todo período'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* ATIVO */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-primary/10 p-3 border-b">
                  <h3 className="font-bold text-primary">ATIVO</h3>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Caixa e Equivalentes</TableCell>
                      <TableCell className="text-right font-semibold">
                        {currencyFormatters.brl(
                          cashClosings.reduce((sum, c) => sum + (c.actual_cash || 0), 0)
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Contas a Receber</TableCell>
                      <TableCell className="text-right font-semibold">
                        {currencyFormatters.brl(
                          transactions
                            .filter(t => t.type === 'entrada' && t.reference_type === 'bill')
                            .reduce((sum, t) => sum + t.amount, 0)
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow className="bg-muted/50">
                      <TableCell className="font-bold">TOTAL DO ATIVO</TableCell>
                      <TableCell className="text-right font-bold">
                        {currencyFormatters.brl(
                          cashClosings.reduce((sum, c) => sum + (c.actual_cash || 0), 0) +
                          transactions
                            .filter(t => t.type === 'entrada' && t.reference_type === 'bill')
                            .reduce((sum, t) => sum + t.amount, 0)
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* PASSIVO */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-destructive/10 p-3 border-b">
                  <h3 className="font-bold text-destructive">PASSIVO</h3>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Contas a Pagar</TableCell>
                      <TableCell className="text-right font-semibold">
                        {currencyFormatters.brl(
                          bills
                            .filter(b => b.status === 'pendente')
                            .reduce((sum, b) => sum + b.amount, 0)
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow className="bg-muted/50">
                      <TableCell className="font-bold">TOTAL DO PASSIVO</TableCell>
                      <TableCell className="text-right font-bold">
                        {currencyFormatters.brl(
                          bills
                            .filter(b => b.status === 'pendente')
                            .reduce((sum, b) => sum + b.amount, 0)
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* PATRIMÔNIO LÍQUIDO */}
            <div className="mt-6 border rounded-lg overflow-hidden">
              <div className="bg-primary/10 p-3 border-b">
                <h3 className="font-bold text-primary">PATRIMÔNIO LÍQUIDO</h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Lucro Acumulado</TableCell>
                    <TableCell className="text-right font-semibold">
                      {currencyFormatters.brl(
                        transactions
                          .filter(t => t.type === 'entrada')
                          .reduce((sum, t) => sum + t.amount, 0) -
                        transactions
                          .filter(t => t.type === 'saida')
                          .reduce((sum, t) => sum + t.amount, 0)
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow className="bg-muted/50">
                    <TableCell className="font-bold">TOTAL DO PATRIMÔNIO LÍQUIDO</TableCell>
                    <TableCell className="text-right font-bold">
                      {currencyFormatters.brl(
                        transactions
                          .filter(t => t.type === 'entrada')
                          .reduce((sum, t) => sum + t.amount, 0) -
                        transactions
                          .filter(t => t.type === 'saida')
                          .reduce((sum, t) => sum + t.amount, 0)
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gráficos e Visualizações */}
      {selectedReport === 'graficos' && (
        <FinancialCharts month={month} startDate={startDate} endDate={endDate} />
      )}
    </div>
  );
}
