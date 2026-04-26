import { useState, useMemo } from 'react';
import { ModernLayout } from '@/components/ModernLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { currencyFormatters, dateFormatters } from '@/utils/formatters';
import { getStoredValuesVisible, ValuesVisibilityToggle, MASKED_VALUE } from '@/components/dashboard/FinancialCards';
import { from } from '@/integrations/db/client';
import { useQuery } from '@tanstack/react-query';
import { format, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear, addDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';

type QuickRange = 'este-mes' | 'mes-passado' | '3-meses' | 'ano' | 'custom';

function getRangeFromQuick(range: QuickRange, customStart?: string, customEnd?: string): { start: string; end: string } {
  if (range === 'custom' && customStart && customEnd) {
    return { start: customStart, end: customEnd };
  }
  const today = new Date();
  switch (range) {
    case 'este-mes':
      return {
        start: format(startOfMonth(today), 'yyyy-MM-dd'),
        end: format(endOfMonth(today), 'yyyy-MM-dd'),
      };
    case 'mes-passado': {
      const last = subMonths(today, 1);
      return {
        start: format(startOfMonth(last), 'yyyy-MM-dd'),
        end: format(endOfMonth(last), 'yyyy-MM-dd'),
      };
    }
    case '3-meses':
      return {
        start: format(subMonths(today, 2), 'yyyy-MM-dd'),
        end: format(today, 'yyyy-MM-dd'),
      };
    case 'ano':
      return {
        start: format(startOfYear(today), 'yyyy-MM-dd'),
        end: format(endOfYear(today), 'yyyy-MM-dd'),
      };
    default:
      return getRangeFromQuick('este-mes');
  }
}

interface Movimentacao {
  id: string;
  data: string;
  tipo: 'entrada' | 'saida';
  valor: number;
  descricao: string;
  origem: 'venda' | 'conta_recebida' | 'conta_paga' | 'transacao';
}

export default function FluxoDeCaixa() {
  const [quickRange, setQuickRange] = useState<QuickRange>('este-mes');
  const [startDate, setStartDate] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [page, setPage] = useState(1);
  const [valuesVisible, setValuesVisible] = useState(getStoredValuesVisible);
  const ITEMS_PER_PAGE = 20;
  const fmt = (n: number) => (valuesVisible ? currencyFormatters.brl(n) : MASKED_VALUE);

  const range = useMemo(
    () => getRangeFromQuick(quickRange, startDate, endDate),
    [quickRange, startDate, endDate]
  );
  const effectiveStart = range.start;
  const effectiveEnd = range.end;

  const applyQuick = (r: QuickRange) => {
    setQuickRange(r);
    const { start, end } = getRangeFromQuick(r);
    setStartDate(start);
    setEndDate(end);
    setPage(1);
  };

  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['fluxo-sales', effectiveStart, effectiveEnd],
    queryFn: async () => {
      const q = from('sales')
        .select('id, numero, total, created_at, cliente_nome')
        .eq('status', 'paid')
        .gte('created_at', effectiveStart)
        .lte('created_at', effectiveEnd + 'T23:59:59')
        .order('created_at', { ascending: true });
      const { data, error } = await q.execute();
      if (error) return [];
      return data || [];
    },
  });

  const { data: bills = [], isLoading: billsLoading } = useQuery({
    queryKey: ['fluxo-bills', effectiveStart, effectiveEnd],
    queryFn: async () => {
      const q = from('bills_to_pay')
        .select('id, description, amount, due_date, payment_date, status')
        .order('due_date', { ascending: true })
        .limit(2000);
      const { data, error } = await q.execute();
      if (error) return [];
      return (data || []).filter(
        (b: any) => b.status === 'pago' || b.status === 'pendente' || b.status === 'atrasado'
      );
    },
  });

  const { data: receivables = [], isLoading: recvLoading } = useQuery({
    queryKey: ['fluxo-receivables', effectiveStart, effectiveEnd],
    queryFn: async () => {
      const q = from('accounts_receivable')
        .select('id, cliente_nome, valor_total, valor_pago, data_vencimento, data_pagamento, status')
        .order('data_vencimento', { ascending: true })
        .limit(2000);
      const { data, error } = await q.execute();
      if (error) return [];
      return data || [];
    },
  });

  const { data: manualTx = [], isLoading: manualLoading } = useQuery({
    queryKey: ['fluxo-manual', effectiveStart, effectiveEnd],
    queryFn: async () => {
      try {
        const q = from('financial_transactions')
          .select('id, type, description, amount, transaction_date')
          .gte('transaction_date', effectiveStart)
          .lte('transaction_date', effectiveEnd)
          .order('transaction_date', { ascending: true });
        const { data, error } = await q.execute();
        if (error) return [];
        return data || [];
      } catch {
        return [];
      }
    },
  });

  const isLoading = salesLoading || billsLoading || recvLoading || manualLoading;

  const { movimentacoes, totalEntradas, totalSaidas, porDia, projecaoDias, menorSaldoProjetado } = useMemo(() => {
    const list: Movimentacao[] = [];
    let entradas = 0;
    let saidas = 0;

    sales.forEach((s: any) => {
      const data = (s.created_at || '').split('T')[0];
      const valor = Number(s.total || 0);
      list.push({
        id: `s-${s.id}`,
        data,
        tipo: 'entrada',
        valor,
        descricao: `Venda #${s.numero || s.id}${s.cliente_nome ? ` - ${s.cliente_nome}` : ''}`,
        origem: 'venda',
      });
      entradas += valor;
    });

    receivables
      .filter((r: any) => r.status === 'pago' && r.data_pagamento)
      .forEach((r: any) => {
        const data = (r.data_pagamento || '').split('T')[0];
        const valor = Number(r.valor_pago ?? r.valor_total ?? 0);
        if (data >= effectiveStart && data <= effectiveEnd) {
          list.push({
            id: `r-${r.id}`,
            data,
            tipo: 'entrada',
            valor,
            descricao: `Recebimento - ${r.cliente_nome || 'Cliente'}`,
            origem: 'conta_recebida',
          });
          entradas += valor;
        }
      });

    bills
      .filter((b: any) => b.status === 'pago' && b.payment_date)
      .forEach((b: any) => {
        const data = (b.payment_date || '').split('T')[0];
        const valor = Number(b.amount || 0);
        if (data >= effectiveStart && data <= effectiveEnd) {
          list.push({
            id: `b-${b.id}`,
            data,
            tipo: 'saida',
            valor,
            descricao: b.description || 'Conta a pagar',
            origem: 'conta_paga',
          });
          saidas += valor;
        }
      });

    manualTx.forEach((t: any) => {
      const data = (t.transaction_date || '').split('T')[0];
      const valor = Number(t.amount || 0);
      const tipo = t.type === 'entrada' ? 'entrada' : 'saida';
      list.push({
        id: `m-${t.id}`,
        data,
        tipo,
        valor,
        descricao: t.description || 'Transação manual',
        origem: 'transacao',
      });
      if (tipo === 'entrada') entradas += valor;
      else saidas += valor;
    });

    list.sort((a, b) => a.data.localeCompare(b.data) || 0);

    const daily: Record<string, { entrada: number; saida: number; saldo: number }> = {};
    const add = (date: string, ent: number, sai: number) => {
      if (!daily[date]) daily[date] = { entrada: 0, saida: 0, saldo: 0 };
      daily[date].entrada += ent;
      daily[date].saida += sai;
      daily[date].saldo = daily[date].entrada - daily[date].saida;
    };
    list.forEach((m) => {
      if (m.tipo === 'entrada') add(m.data, m.valor, 0);
      else add(m.data, 0, m.valor);
    });
    const porDiaArray = Object.entries(daily)
      .map(([data, v]) => ({ data, ...v }))
      .sort((a, b) => a.data.localeCompare(b.data));

    const endDateParsed = parseISO(effectiveEnd);
    const projecaoFim = addDays(endDateParsed, 60);
    const billsPendentes = bills.filter((b: any) => b.status !== 'pago' && b.due_date);
    const recvPendentes = receivables.filter((r: any) => r.status !== 'pago' && r.data_vencimento);
    const mapDia = Object.fromEntries(porDiaArray.map((d) => [d.data, d]));
    let running = 0;
    const projecaoDiasArray: { data: string; saldo: number; entradas: number; saidas: number }[] = [];
    for (let d = parseISO(effectiveStart); d <= projecaoFim; d = addDays(d, 1)) {
      const dataStr = format(d, 'yyyy-MM-dd');
      const diaReal = mapDia[dataStr];
      if (diaReal) {
        running += diaReal.saldo;
      } else if (d > endDateParsed) {
        const entradasDia =
          recvPendentes
            .filter((r: any) => (r.data_vencimento || '').split('T')[0] === dataStr)
            .reduce((s: number, r: any) => s + Number(r.valor_total || r.valor_pago || 0), 0) || 0;
        const saidasDia =
          billsPendentes
            .filter((b: any) => (b.due_date || '').split('T')[0] === dataStr)
            .reduce((s: number, b: any) => s + Number(b.amount || 0), 0) || 0;
        running += entradasDia - saidasDia;
      }
      projecaoDiasArray.push({
        data: dataStr,
        saldo: running,
        entradas: diaReal?.entrada ?? 0,
        saidas: diaReal?.saida ?? 0,
      });
    }
    let menor = projecaoDiasArray.length ? projecaoDiasArray[0].saldo : 0;
    projecaoDiasArray.forEach((p) => {
      if (p.saldo < menor) menor = p.saldo;
    });

    return {
      movimentacoes: list,
      totalEntradas: entradas,
      totalSaidas: saidas,
      porDia: porDiaArray,
      projecaoDias: projecaoDiasArray,
      menorSaldoProjetado: menor,
    };
  }, [sales, bills, receivables, manualTx, effectiveStart, effectiveEnd]);

  const saldoPeriodo = totalEntradas - totalSaidas;
  const paginatedMov = useMemo(
    () => movimentacoes.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE),
    [movimentacoes, page]
  );
  const totalPages = Math.max(1, Math.ceil(movimentacoes.length / ITEMS_PER_PAGE));

  return (
    <ModernLayout
      title="Fluxo de Caixa"
      subtitle="Entradas, saídas e projeção de caixa"
      headerActions={<ValuesVisibilityToggle valuesVisible={valuesVisible} setValuesVisible={setValuesVisible} />}
    >
      <div className="flex flex-col gap-4 pb-8 min-w-0">
        <Card className="flex-shrink-0 border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm p-3 sm:p-4 min-w-0">
          <div className="flex flex-col sm:flex-row flex-wrap sm:items-end gap-3">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['este-mes', 'Este mês'],
                  ['mes-passado', 'Mês passado'],
                  ['3-meses', '3 meses'],
                  ['ano', 'Este ano'],
                ] as [QuickRange, string][]
              ).map(([value, label]) => (
                <Button
                  key={value}
                  variant={quickRange === value ? 'default' : 'outline'}
                  size="sm"
                  className="min-h-[44px] sm:min-h-0 sm:h-9 rounded-xl sm:rounded-md touch-manipulation text-xs px-3"
                  onClick={() => applyQuick(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
              <div className="space-y-1 flex-1 min-w-0">
                <Label className="text-xs text-muted-foreground">De</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setQuickRange('custom');
                  }}
                  className="min-h-[44px] sm:h-9 w-full sm:w-36 rounded-lg touch-manipulation"
                />
              </div>
              <div className="space-y-1 flex-1 min-w-0">
                <Label className="text-xs text-muted-foreground">Até</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setQuickRange('custom');
                  }}
                  className="min-h-[44px] sm:h-9 w-full sm:w-36 rounded-lg touch-manipulation"
                />
              </div>
            </div>
          </div>
        </Card>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 min-w-0">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 sm:h-28 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 min-w-0">
              <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm min-w-0 touch-manipulation">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-emerald-700">
                    <ArrowDownLeft className="h-5 w-5 shrink-0" />
                    Total Entradas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg sm:text-2xl font-bold text-emerald-700 tabular-nums">
                    {fmt(totalEntradas)}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm min-w-0 touch-manipulation">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-red-700">
                    <ArrowUpRight className="h-5 w-5 shrink-0" />
                    Total Saídas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg sm:text-2xl font-bold text-red-700 tabular-nums">
                    {fmt(totalSaidas)}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm min-w-0 touch-manipulation">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Wallet className="h-5 w-5 shrink-0" />
                    Saldo do Período
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className={`text-lg sm:text-2xl font-bold tabular-nums ${saldoPeriodo >= 0 ? 'text-emerald-700' : 'text-red-700'}`}
                  >
                    {fmt(saldoPeriodo)}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm min-w-0 touch-manipulation">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 shrink-0" />
                    Menor saldo projetado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className={`text-lg sm:text-2xl font-bold tabular-nums ${
                      menorSaldoProjetado >= 0 ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {fmt(menorSaldoProjetado)}
                  </div>
                  {menorSaldoProjetado < 0 && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Atenção ao fluxo futuro
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-lg font-bold">Fluxo diário</CardTitle>
                  <CardDescription>Entradas e saídas por dia no período</CardDescription>
                </CardHeader>
                <CardContent>
                  {porDia.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground text-sm">
                      Nenhuma movimentação no período
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={porDia} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="data"
                          tickFormatter={(v) => format(parseISO(v), 'dd/MM', { locale: ptBR })}
                          fontSize={11}
                        />
                        <YAxis tickFormatter={(v) => (valuesVisible ? `R$${v / 1000}k` : '•••')} fontSize={11} />
                        <Tooltip
                          formatter={(value: number) => [fmt(value), '']}
                          labelFormatter={(label) => dateFormatters.short(label)}
                        />
                        <Legend />
                        <Bar dataKey="entrada" name="Entradas" fill="#059669" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="saida" name="Saídas" fill="#dc2626" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
              <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-lg font-bold">Projeção de saldo</CardTitle>
                  <CardDescription>Saldo acumulado e projetado (contas a pagar/receber)</CardDescription>
                </CardHeader>
                <CardContent>
                  {projecaoDias.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground text-sm">
                      Nenhum dado para exibir
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={projecaoDias} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="saldoGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#059669" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="#059669" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="data"
                          tickFormatter={(v) => format(parseISO(v), 'dd/MM', { locale: ptBR })}
                          fontSize={11}
                        />
                        <YAxis tickFormatter={(v) => (valuesVisible ? `R$${v / 1000}k` : '•••')} fontSize={11} />
                        <Tooltip
                          formatter={(value: number) => [fmt(value), 'Saldo']}
                          labelFormatter={(label) => dateFormatters.short(label)}
                        />
                        <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                        <Area
                          type="monotone"
                          dataKey="saldo"
                          name="Saldo"
                          stroke="#059669"
                          fill="url(#saldoGrad)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="flex-1 overflow-hidden border-2 border-gray-300 dark:border-gray-600 rounded-xl">
              <CardHeader>
                <CardTitle className="text-lg font-bold">Movimentações</CardTitle>
                <CardDescription>
                  {movimentacoes.length} lançamentos no período • Página {page} de {totalPages}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b-2 border-gray-300">
                      <TableHead className="font-bold">Data</TableHead>
                      <TableHead className="font-bold">Descrição</TableHead>
                      <TableHead className="font-bold">Origem</TableHead>
                      <TableHead className="font-bold text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedMov.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          Nenhuma movimentação no período
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedMov.map((m) => (
                        <TableRow key={m.id} className="border-b border-gray-200">
                          <TableCell className="font-medium whitespace-nowrap">
                            {dateFormatters.short(m.data)}
                          </TableCell>
                          <TableCell className="max-w-[240px] truncate">{m.descricao}</TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {m.origem === 'venda' && 'Venda'}
                              {m.origem === 'conta_recebida' && 'Conta recebida'}
                              {m.origem === 'conta_paga' && 'Conta paga'}
                              {m.origem === 'transacao' && 'Transação'}
                            </span>
                          </TableCell>
                          <TableCell
                            className={`text-right font-semibold whitespace-nowrap ${
                              m.tipo === 'entrada' ? 'text-emerald-700' : 'text-red-700'
                            }`}
                          >
                            {m.tipo === 'entrada' ? '+' : '-'} {fmt(m.valor)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Anterior
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {page} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      Próxima
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </ModernLayout>
  );
}
