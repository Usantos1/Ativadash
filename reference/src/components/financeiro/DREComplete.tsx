import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, DollarSign, Package } from 'lucide-react';
import { currencyFormatters } from '@/utils/formatters';
import { MASKED_VALUE } from '@/components/dashboard/FinancialCards';
import { DateFilterBar } from '@/components/financeiro/DateFilterBar';
// TODO: Implementar hooks do sistema financeiro antigo ou migrar para novo sistema
// import { useFinancialTransactions, useFinancialCategories } from '@/hooks/useFinanceiro';
import { useQuery } from '@tanstack/react-query';
import { from } from '@/integrations/db/client';
import { cn } from '@/lib/utils';
import { isBillExcludedFromDRE } from '@/utils/dreBillFilters';

type DateFilterType = 'today' | 'week' | 'month' | 'all' | 'custom';

interface DRECompleteProps {
  month?: string;
  startDate?: string;
  endDate?: string;
  dateFilter?: DateFilterType;
  onDateFilterChange?: (filter: DateFilterType) => void;
  customDateStart?: Date;
  customDateEnd?: Date;
  onCustomDateStartChange?: (date: Date | undefined) => void;
  onCustomDateEndChange?: (date: Date | undefined) => void;
  onDatesChange?: (start: string | undefined, end: string | undefined) => void;
  valuesVisible?: boolean;
}

export function DREComplete({
  month,
  startDate,
  endDate,
  dateFilter,
  onDateFilterChange,
  customDateStart,
  customDateEnd,
  onCustomDateStartChange,
  onCustomDateEndChange,
  onDatesChange,
  valuesVisible = true,
}: DRECompleteProps) {
  const fmt = (n: number) => (valuesVisible ? currencyFormatters.brl(n) : MASKED_VALUE);
  // TODO: Implementar hooks do sistema financeiro antigo
  const transactions: any[] = [];
  const categories: any[] = [];

  // Buscar vendas do período
  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['sales-dre', startDate, endDate],
    queryFn: async () => {
      try {
        let q = from('sales')
          .select('id, total, ordem_servico_id, created_at')
          .in('status', ['paid', 'partial']);
        
        if (startDate && endDate && startDate !== '' && endDate !== '') {
          q = q.gte('created_at', startDate).lte('created_at', endDate + 'T23:59:59');
        }
        
        const { data, error } = await q.execute();
        if (error) {
          console.warn('Erro ao buscar vendas DRE:', error);
          return [];
        }
        return data || [];
      } catch (err) {
        console.warn('Erro ao buscar vendas DRE:', err);
        return [];
      }
    },
  });

  const salesIds = React.useMemo(
    () => (Array.isArray(sales) ? sales.map((s: any) => s.id).filter(Boolean) : []),
    [sales]
  );
  const ordemServicoIds = React.useMemo(
    () =>
      (Array.isArray(sales) ? sales.map((s: any) => s.ordem_servico_id).filter(Boolean) : []).filter(
        (id: any, idx: number, arr: any[]) => arr.indexOf(id) === idx
      ),
    [sales]
  );

  // Itens de venda (PDV/OS) para calcular custo real por produto
  const { data: saleItems = [] } = useQuery({
    queryKey: ['sale-items-dre', salesIds],
    queryFn: async () => {
      if (salesIds.length === 0) return [];
      try {
        const { data, error } = await from('sale_items')
          .select('id, sale_id, produto_id, quantidade')
          .in('sale_id', salesIds)
          .execute();
        if (error) {
          console.warn('Erro ao buscar sale_items DRE:', error);
          return [];
        }
        return data || [];
      } catch (err) {
        console.warn('Erro ao buscar sale_items DRE:', err);
        return [];
      }
    },
    enabled: salesIds.length > 0,
  });

  // Itens de OS (peças) para garantir CMV de peças quando não houver sale_items vinculado
  const { data: osItems = [] } = useQuery({
    queryKey: ['os-items-dre', ordemServicoIds],
    queryFn: async () => {
      if (ordemServicoIds.length === 0) return [];
      try {
        const { data, error } = await from('os_items')
          .select('id, ordem_servico_id, tipo, produto_id, quantidade, valor_unitario, valor_total')
          .in('ordem_servico_id', ordemServicoIds)
          .execute();
        if (error) {
          console.warn('Erro ao buscar os_items DRE:', error);
          return [];
        }
        return data || [];
      } catch (err) {
        console.warn('Erro ao buscar os_items DRE:', err);
        return [];
      }
    },
    enabled: ordemServicoIds.length > 0,
  });

  const produtoIds = React.useMemo(() => {
    const ids = new Set<string>();
    (Array.isArray(saleItems) ? saleItems : []).forEach((item: any) => {
      if (item?.produto_id) ids.add(item.produto_id);
    });
    (Array.isArray(osItems) ? osItems : []).forEach((item: any) => {
      if (item?.produto_id) ids.add(item.produto_id);
    });
    return Array.from(ids);
  }, [saleItems, osItems]);

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos-custo-dre', produtoIds],
    queryFn: async () => {
      if (produtoIds.length === 0) return [];
      try {
        const { data, error } = await from('produtos')
          .select('id, vi_custo, valor_compra')
          .in('id', produtoIds)
          .execute();
        if (error) {
          console.warn('Erro ao buscar custos de produtos DRE:', error);
          return [];
        }
        return data || [];
      } catch (err) {
        console.warn('Erro ao buscar custos de produtos DRE:', err);
        return [];
      }
    },
    enabled: produtoIds.length > 0,
  });
  
  // Buscar contas pagas no período (filtrar por payment_date se existir, caso contrário due_date)
  const { data: billsPaid = [], isLoading: billsLoading } = useQuery({
    queryKey: ['bills-paid-dre', startDate, endDate],
    queryFn: async () => {
      try {
        let q = from('bills_to_pay')
          .select('*')
          .eq('status', 'pago');
        
        if (startDate && endDate && startDate !== '' && endDate !== '') {
          // CORRIGIDO: Usar payment_date ao invés de due_date para contas pagas
          // payment_date é a data quando a conta foi realmente paga
          // Se payment_date não existir, o backend/query vai retornar erro, então usamos due_date como fallback
          try {
            q = q.gte('payment_date', startDate).lte('payment_date', endDate);
            const { data, error } = await q.execute();
            if (error) throw error;
            return data || [];
          } catch (paymentDateError) {
            // Fallback: se payment_date não existir, usar due_date
            console.warn('payment_date não disponível, usando due_date como fallback:', paymentDateError);
            q = from('bills_to_pay')
              .select('*')
              .eq('status', 'pago')
              .gte('due_date', startDate).lte('due_date', endDate);
            const { data, error } = await q.execute();
            if (error) throw error;
            return data || [];
          }
        }
        
        const { data, error } = await q.execute();
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.warn('Erro ao buscar contas pagas DRE:', err);
        return [];
      }
    },
  });

  // Calcular valores do DRE
  const dreData = React.useMemo(() => {
    // Garantir que sales e billsPaid são arrays válidos
    const validSales = Array.isArray(sales) ? sales : [];
    const validBills = Array.isArray(billsPaid) ? billsPaid : [];
    const validTransactions = Array.isArray(transactions) ? transactions : [];
    const validSaleItems = Array.isArray(saleItems) ? saleItems : [];
    const validOsItems = Array.isArray(osItems) ? osItems : [];
    const validProdutos = Array.isArray(produtos) ? produtos : [];
    const produtoCustoMap = new Map<string, number>(
      validProdutos.map((p: any) => [
        p.id,
        Number(p.vi_custo ?? p.valor_compra ?? 0) || 0,
      ])
    );
    
    // RECEITA BRUTA DE VENDAS
    const receitaBrutaVendas = validSales.reduce((sum: number, s: any) => {
      const valor = Number(s.total || 0);
      return sum + (isNaN(valor) ? 0 : valor);
    }, 0);
    
    // CMV - Custo das mercadorias vendidas:
    // 1) custo real de sale_items (produto vendido)
    // 2) peças de OS (os_items) apenas quando a venda OS não tiver sale_items vinculados, evitando duplicidade
    const cmvSaleItems = validSaleItems.reduce((sum: number, item: any) => {
      const qtd = Number(item.quantidade || 0);
      const custoUnit = item.produto_id ? (produtoCustoMap.get(item.produto_id) || 0) : 0;
      if (isNaN(qtd)) return sum;
      return sum + qtd * custoUnit;
    }, 0);

    const salesComItens = new Set<string>(
      validSaleItems.map((item: any) => item.sale_id).filter(Boolean)
    );
    const osSemSaleItems = new Set<string>(
      validSales
        .filter((s: any) => s.ordem_servico_id && !salesComItens.has(s.id))
        .map((s: any) => s.ordem_servico_id)
    );

    const cmvOsPecas = validOsItems.reduce((sum: number, item: any) => {
      if (!item?.ordem_servico_id || !osSemSaleItems.has(item.ordem_servico_id)) return sum;
      const tipo = String(item.tipo || '').toLowerCase();
      const isPeca = tipo.includes('peca') || tipo.includes('peça') || !!item.produto_id;
      if (!isPeca) return sum;

      const qtd = Number(item.quantidade || 0);
      if (item.produto_id) {
        const custoUnit = produtoCustoMap.get(item.produto_id) || 0;
        return sum + (isNaN(qtd) ? 0 : qtd * custoUnit);
      }

      // Fallback para peça sem produto_id: usa valor informado no item
      const valorItem = Number(item.valor_total ?? ((Number(item.valor_unitario || 0) || 0) * (isNaN(qtd) ? 0 : qtd)));
      return sum + (isNaN(valorItem) ? 0 : valorItem);
    }, 0);

    const cmv = cmvSaleItems + cmvOsPecas;
    
    // LUCRO BRUTO
    const lucroBruto = receitaBrutaVendas - cmv;
    const margemBruta = receitaBrutaVendas > 0 ? (lucroBruto / receitaBrutaVendas) * 100 : 0;
    
    // Outras receitas (transações manuais de entrada)
    const outrasReceitas: Record<string, number> = {};
    validTransactions.filter(t => t.type === 'entrada').forEach(t => {
      const catName = t.category?.name || 'Outras Receitas';
      const valor = Number(t.amount || 0);
      outrasReceitas[catName] = (outrasReceitas[catName] || 0) + (isNaN(valor) ? 0 : valor);
    });
    const totalOutrasReceitas = Object.values(outrasReceitas).reduce((sum, v) => sum + v, 0);
    
    // DESPESAS OPERACIONAIS (contas a pagar + transações manuais de saída)
    const despesasFixas: Record<string, number> = {};
    const despesasVariaveis: Record<string, number> = {};
    
    // Contas pagas - agrupar por descrição (exceto apropriação de estoque: CMV cobre na venda)
    validBills.forEach((bill: any) => {
      if (isBillExcludedFromDRE(bill.description)) return;
      const descricao = bill.description || 'Outras Despesas';
      const valor = Number(bill.amount || 0);
      const valorValido = isNaN(valor) ? 0 : valor;
      if (bill.expense_type === 'fixa') {
        despesasFixas[descricao] = (despesasFixas[descricao] || 0) + valorValido;
      } else {
        despesasVariaveis[descricao] = (despesasVariaveis[descricao] || 0) + valorValido;
      }
    });
    
    // Transações manuais de saída
    validTransactions.filter(t => t.type === 'saida').forEach(t => {
      const catName = t.category?.name || 'Outras Despesas';
      const valor = Number(t.amount || 0);
      despesasVariaveis[catName] = (despesasVariaveis[catName] || 0) + (isNaN(valor) ? 0 : valor);
    });
    
    const totalDespesasFixas = Object.values(despesasFixas).reduce((sum, v) => sum + v, 0);
    const totalDespesasVariaveis = Object.values(despesasVariaveis).reduce((sum, v) => sum + v, 0);
    const totalDespesasOperacionais = totalDespesasFixas + totalDespesasVariaveis;
    
    // RESULTADO OPERACIONAL (EBITDA) = Lucro Bruto - Despesas Operacionais
    const resultadoOperacional = lucroBruto + totalOutrasReceitas - totalDespesasOperacionais;
    const totalReceitas = receitaBrutaVendas + totalOutrasReceitas;
    const margemOperacional = totalReceitas > 0 ? (resultadoOperacional / totalReceitas) * 100 : 0;
    
    // IMPOSTOS (estimado 6% sobre receitas)
    const impostos = totalReceitas > 0 ? totalReceitas * 0.06 : 0;
    
    // LUCRO LÍQUIDO = Resultado Operacional - Impostos
    const lucroLiquido = resultadoOperacional - impostos;
    const margemLiquida = totalReceitas > 0 ? (lucroLiquido / totalReceitas) * 100 : 0;
    
    // Debug log para verificar valores
    console.log('[DRE] Cálculos:', {
      receitaBrutaVendas,
      cmv,
      lucroBruto,
      totalDespesasOperacionais,
      resultadoOperacional,
      impostos,
      lucroLiquido,
      salesCount: validSales.length,
      billsCount: validBills.length,
      saleItemsCount: validSaleItems.length,
      osItemsCount: validOsItems.length,
    });
    
    return {
      receitaBrutaVendas,
      cmv,
      lucroBruto,
      margemBruta,
      outrasReceitas,
      totalOutrasReceitas,
      despesasFixas,
      despesasVariaveis,
      totalDespesasFixas,
      totalDespesasVariaveis,
      totalDespesasOperacionais,
      resultadoOperacional,
      margemOperacional,
      impostos,
      lucroLiquido,
      margemLiquida,
      totalReceitas,
    };
  }, [transactions, sales, billsPaid, saleItems, osItems, produtos]);

  return (
    <Card className="rounded-xl border-2 border-gray-300 dark:border-gray-600 overflow-hidden min-w-0">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="text-base sm:text-lg">DRE - Demonstrativo de Resultado do Exercício</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Período: {month ? month.replace('-', '/') : 'Todo o período'}</CardDescription>
          </div>
          {dateFilter != null && onDateFilterChange && onDatesChange && (
            <DateFilterBar
              dateFilter={dateFilter}
              onDateFilterChange={onDateFilterChange}
              customDateStart={customDateStart}
              customDateEnd={customDateEnd}
              onCustomDateStartChange={onCustomDateStartChange}
              onCustomDateEndChange={onCustomDateEndChange}
              onDatesChange={onDatesChange}
              className="border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm flex-shrink-0 w-full sm:w-auto min-w-0"
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="min-w-0">
        <div className="border-2 border-gray-200 dark:border-gray-600 rounded-lg overflow-x-auto min-w-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-bold w-[60%]">Descrição</TableHead>
                <TableHead className="text-right font-bold">Valor (R$)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* RECEITA BRUTA DE VENDAS */}
              <TableRow className="bg-green-50/50">
                <TableCell className="font-bold text-green-700 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  RECEITA BRUTA DE VENDAS
                </TableCell>
                <TableCell className="text-right font-bold text-green-700">
                  {fmt(dreData.receitaBrutaVendas)}
                </TableCell>
              </TableRow>

              {/* CMV - CUSTO DAS MERCADORIAS VENDIDAS */}
              <TableRow className="bg-orange-50/50">
                <TableCell className="font-bold text-orange-700 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  (-) CMV - Custo das Mercadorias/Peças
                </TableCell>
                <TableCell className="text-right font-bold text-orange-700">
                  ({fmt(dreData.cmv)})
                </TableCell>
              </TableRow>

              {/* LUCRO BRUTO */}
              <TableRow className={cn(
                "border-t-2 border-b-2",
                dreData.lucroBruto >= 0 ? 'bg-blue-50/50' : 'bg-red-100/50'
              )}>
                <TableCell className="font-bold text-lg">LUCRO BRUTO</TableCell>
                <TableCell className={cn(
                  "text-right font-bold text-lg",
                  dreData.lucroBruto >= 0 ? 'text-blue-700' : 'text-red-700'
                )}>
                  {fmt(dreData.lucroBruto)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8 text-sm text-muted-foreground">Margem Bruta</TableCell>
                <TableCell className={cn(
                  "text-right font-semibold",
                  dreData.margemBruta >= 0 ? 'text-blue-600' : 'text-red-600'
                )}>
                  {dreData.margemBruta.toFixed(2)}%
                </TableCell>
              </TableRow>

              {/* OUTRAS RECEITAS */}
              {dreData.totalOutrasReceitas > 0 && (
                <>
                  <TableRow className="bg-green-50/30">
                    <TableCell className="font-bold text-green-700">(+) OUTRAS RECEITAS</TableCell>
                    <TableCell className="text-right font-bold text-green-700">
                      {fmt(dreData.totalOutrasReceitas)}
                    </TableCell>
                  </TableRow>
                  {Object.entries(dreData.outrasReceitas).map(([descricao, valor]) => (
                    <TableRow key={descricao}>
                      <TableCell className="pl-8">{descricao}</TableCell>
                      <TableCell className="text-right text-green-600">{fmt(valor)}</TableCell>
                    </TableRow>
                  ))}
                </>
              )}

              {/* DESPESAS FIXAS */}
              {dreData.totalDespesasFixas > 0 && (
                <>
                  <TableRow className="bg-red-50/50">
                    <TableCell className="font-bold text-red-700 flex items-center gap-2">
                      <TrendingDown className="h-4 w-4" />
                      (-) DESPESAS FIXAS
                    </TableCell>
                    <TableCell className="text-right font-bold text-red-700">
                      ({fmt(dreData.totalDespesasFixas)})
                    </TableCell>
                  </TableRow>
                  {Object.entries(dreData.despesasFixas).map(([descricao, valor]) => (
                    <TableRow key={`fixa-${descricao}`}>
                      <TableCell className="pl-8">{descricao}</TableCell>
                      <TableCell className="text-right text-red-600">({fmt(valor)})</TableCell>
                    </TableRow>
                  ))}
                </>
              )}

              {/* DESPESAS VARIÁVEIS */}
              {dreData.totalDespesasVariaveis > 0 && (
                <>
                  <TableRow className="bg-red-50/30">
                    <TableCell className="font-bold text-red-600">(-) DESPESAS VARIÁVEIS</TableCell>
                    <TableCell className="text-right font-bold text-red-600">
                      ({fmt(dreData.totalDespesasVariaveis)})
                    </TableCell>
                  </TableRow>
                  {Object.entries(dreData.despesasVariaveis).map(([descricao, valor]) => (
                    <TableRow key={`var-${descricao}`}>
                      <TableCell className="pl-8">{descricao}</TableCell>
                      <TableCell className="text-right text-red-600">({fmt(valor)})</TableCell>
                    </TableRow>
                  ))}
                </>
              )}

              {/* TOTAL DESPESAS OPERACIONAIS */}
              <TableRow className="bg-red-100/50">
                <TableCell className="font-bold text-red-700">TOTAL DESPESAS OPERACIONAIS</TableCell>
                <TableCell className="text-right font-bold text-red-700">
                  ({fmt(dreData.totalDespesasOperacionais)})
                </TableCell>
              </TableRow>

              {/* RESULTADO OPERACIONAL (EBITDA) */}
              <TableRow className={cn(
                "border-t-2 border-b-2",
                dreData.resultadoOperacional >= 0 ? 'bg-blue-50/50' : 'bg-red-100/50'
              )}>
                <TableCell className="font-bold text-lg">RESULTADO OPERACIONAL (EBITDA)</TableCell>
                <TableCell className={cn(
                  "text-right font-bold text-lg",
                  dreData.resultadoOperacional >= 0 ? 'text-blue-700' : 'text-red-700'
                )}>
                  {fmt(dreData.resultadoOperacional)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8 text-sm text-muted-foreground">Margem Operacional</TableCell>
                <TableCell className={cn(
                  "text-right font-semibold",
                  dreData.margemOperacional >= 0 ? 'text-blue-600' : 'text-red-600'
                )}>
                  {dreData.margemOperacional.toFixed(2)}%
                </TableCell>
              </TableRow>

              {/* IMPOSTOS */}
              {dreData.impostos > 0 && (
                <TableRow>
                  <TableCell className="pl-8">(-) Impostos e Contribuições (Estimado 6%)</TableCell>
                  <TableCell className="text-right text-red-600">({fmt(dreData.impostos)})</TableCell>
                </TableRow>
              )}

              {/* LUCRO LÍQUIDO */}
              <TableRow className={cn(
                "border-t-2 border-b-2",
                dreData.lucroLiquido >= 0 ? 'bg-green-50/80 border-green-600' : 'bg-red-50/80 border-destructive'
              )}>
                <TableCell className="font-bold text-xl flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  LUCRO LÍQUIDO
                </TableCell>
                <TableCell className={cn(
                  "text-right font-bold text-xl",
                  dreData.lucroLiquido >= 0 ? 'text-green-700' : 'text-red-700'
                )}>
                  {fmt(dreData.lucroLiquido)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Margem Líquida</TableCell>
                <TableCell className={cn(
                  "text-right font-bold text-lg",
                  dreData.margemLiquida >= 0 ? 'text-green-700' : 'text-red-700'
                )}>
                  {dreData.margemLiquida.toFixed(2)}%
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Indicadores */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="p-3 bg-green-50 rounded-lg text-center border border-green-200">
            <p className="text-xs text-muted-foreground">Receita Bruta</p>
            <p className="text-lg font-bold text-green-600">{fmt(dreData.receitaBrutaVendas)}</p>
          </div>
          <div className="p-3 bg-orange-50 rounded-lg text-center border border-orange-200">
            <p className="text-xs text-muted-foreground">Custo (CMV)</p>
            <p className="text-lg font-bold text-orange-600">{fmt(dreData.cmv)}</p>
          </div>
          <div className="p-3 bg-red-50 rounded-lg text-center border border-red-200">
            <p className="text-xs text-muted-foreground">Despesas</p>
            <p className="text-lg font-bold text-red-600">{fmt(dreData.totalDespesasOperacionais)}</p>
          </div>
          <div className="p-3 bg-red-50 rounded-lg text-center border border-red-200">
            <p className="text-xs text-muted-foreground">Custo total de despesas</p>
            <p className="text-lg font-bold text-red-600">
              {fmt(dreData.impostos + dreData.cmv + dreData.totalDespesasOperacionais)}
            </p>
          </div>
          <div className={cn(
            "p-3 rounded-lg text-center border",
            dreData.lucroLiquido >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          )}>
            <p className="text-xs text-muted-foreground">Lucro Líquido</p>
            <p className={cn(
              "text-lg font-bold",
              dreData.lucroLiquido >= 0 ? 'text-green-700' : 'text-red-700'
            )}>
              {fmt(dreData.lucroLiquido)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

