import { useMemo, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { from } from '@/integrations/db/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCashRegister, useCashMovements } from '@/hooks/usePDV';
import { currencyFormatters, dateFormatters } from '@/utils/formatters';
import { MASKED_VALUE } from '@/components/dashboard/FinancialCards';
import { useToast } from '@/hooks/use-toast';
import { startOfDay, endOfDay, subDays } from 'date-fns';
import { Lock, Plus, Minus, Printer } from 'lucide-react';
import { SALE_STATUS_LABELS, type SaleStatus } from '@/types/pdv';
import { printTermica } from '@/utils/pdfGenerator';
import { buildCashClosingTermicaHtml } from '@/utils/cashClosingTermicaGenerator';

type CashSession = {
  id: string;
  numero?: number | null;
  operador_id?: string | null;
  operador_nome?: string | null;
  status?: 'open' | 'closed' | string;
  valor_inicial?: number | null;
  valor_final?: number | null;
  valor_esperado?: number | null;
  divergencia?: number | null;
  opened_at?: string | null;
  closed_at?: string | null;
  totais_forma_pagamento?: Record<string, number> | null;
};

interface Props {
  /** Quando omitido (ex.: chamadas legadas), usa o mesmo padrão da página Financeiro: últimos 30 dias. */
  dateFilter?: 'today' | 'week' | 'month' | 'all' | 'custom';
  customDateStart?: Date;
  customDateEnd?: Date;
  statusFilter?: 'all' | 'open' | 'closed';
  valuesVisible?: boolean;
}

function labelForma(forma: string) {
  const f = (forma || '').toLowerCase().replace(/\s+/g, '_');
  switch (f) {
    case 'dinheiro': return 'Dinheiro';
    case 'pix': return 'PIX';
    case 'pix_samup': return 'PIX Samup';
    case 'debito': return 'Débito';
    case 'credito': return 'Crédito';
    case 'credito_parcelado': return 'Crédito parcelado';
    case 'link_pagamento': return 'Link';
    case 'carteira_digital': return 'Carteira';
    case 'fiado': return 'Fiado';
    case 'adiantamento_os': return 'Adiantamento OS';
    case 'adiantamento os': return 'Adiantamento OS';
    default:
      if (!forma?.trim()) return '—';
      return forma.replace(/_/g, ' ');
  }
}

/** Calcula valor_esperado por sessão (inicial + entradas vendas excl. Adiantamento OS + suprimentos - sangrias) e anexa às sessões */
async function enrichSessionsWithEsperado(list: CashSession[]): Promise<CashSession[]> {
  if (list.length === 0) return list;
  const ids = list.map(s => s.id);
  const [movsRes, salesRes] = await Promise.all([
    from('cash_movements').select('session_id, tipo, valor').in('session_id', ids).execute(),
    from('sales').select('id, cash_register_session_id, total').in('cash_register_session_id', ids).eq('status', 'paid').execute(),
  ]);
  const movements = (movsRes.data || []) as { session_id: string; tipo: string; valor: number }[];
  const sales = (salesRes.data || []) as { id: string; cash_register_session_id: string; total?: number }[];
  const saleIds = sales.map(s => s.id).filter(Boolean);
  const salesTotalById: Record<string, number> = {};
  sales.forEach((s: any) => { salesTotalById[s.id] = Number(s.total || 0); });
  let payments: { sale_id: string; forma_pagamento: string; valor: number; troco?: number }[] = [];
  if (saleIds.length > 0) {
    const payRes = await from('payments').select('sale_id, forma_pagamento, valor, troco').in('sale_id', saleIds).eq('status', 'confirmed').execute();
    payments = (payRes.data || []) as { sale_id: string; forma_pagamento: string; valor: number; troco?: number }[];
  }
  const getValorAplicado = (p: any) => {
    const valor = Number(p.valor || 0);
    const troco = Number(p.troco || 0);
    const saleTotal = salesTotalById[p.sale_id] ?? 0;
    if ((p.forma_pagamento || '').toLowerCase() === 'dinheiro' && troco > 0 && valor > saleTotal) return valor - troco;
    return valor;
  };
  const salesBySession: Record<string, string[]> = {};
  sales.forEach((s: any) => {
    const sid = s.cash_register_session_id;
    if (!salesBySession[sid]) salesBySession[sid] = [];
    salesBySession[sid].push(s.id);
  });
  const suprimentoBySession: Record<string, number> = {};
  const sangriaBySession: Record<string, number> = {};
  movements.forEach((m: any) => {
    const sid = m.session_id;
    const v = Number(m.valor || 0);
    if (m.tipo === 'suprimento') suprimentoBySession[sid] = (suprimentoBySession[sid] || 0) + v;
    else if (m.tipo === 'sangria') sangriaBySession[sid] = (sangriaBySession[sid] || 0) + v;
  });
  const entradasVendasBySession: Record<string, number> = {};
  // Totais por forma de pagamento por sessão (para exibir no detalhe do caixa)
  const totaisFormaBySession: Record<string, Record<string, number>> = {};
  payments.forEach((p: any) => {
    const forma = (p.forma_pagamento || '').trim() || 'outros';
    const sessionId = sales.find((s: any) => s.id === p.sale_id)?.cash_register_session_id;
    if (!sessionId) return;
    const valor = getValorAplicado(p);
    if ((p.forma_pagamento || '').toLowerCase() !== 'adiantamento os') {
      entradasVendasBySession[sessionId] = (entradasVendasBySession[sessionId] || 0) + valor;
    }
    if (!totaisFormaBySession[sessionId]) totaisFormaBySession[sessionId] = {};
    totaisFormaBySession[sessionId][forma] = (totaisFormaBySession[sessionId][forma] || 0) + valor;
  });
  return list.map(s => {
    const inicial = Number(s.valor_inicial || 0);
    const entradasVendas = entradasVendasBySession[s.id] || 0;
    const suprimento = suprimentoBySession[s.id] || 0;
    const sangria = sangriaBySession[s.id] || 0;
    const valor_esperado = inicial + entradasVendas + suprimento - sangria;
    // Totais por forma: usar salvos no fechamento ou calcular dos pagamentos (caixa aberto)
    const fromDb = s.totais_forma_pagamento && Object.keys(s.totais_forma_pagamento).length > 0;
    let totais_forma_pagamento: Record<string, number> | null = fromDb
      ? { ...s.totais_forma_pagamento }
      : (totaisFormaBySession[s.id] ? { ...totaisFormaBySession[s.id] } : null);
    // Para caixa aberto (totais calculados): incluir abertura no total "dinheiro"
    if (!fromDb && totais_forma_pagamento && inicial > 0) {
      const keyDinheiro = Object.keys(totais_forma_pagamento).find(k => k.toLowerCase() === 'dinheiro');
      if (keyDinheiro) totais_forma_pagamento[keyDinheiro] = (totais_forma_pagamento[keyDinheiro] || 0) + inicial;
      else totais_forma_pagamento['dinheiro'] = inicial;
    } else if (!fromDb && inicial > 0) {
      totais_forma_pagamento = { dinheiro: inicial };
    }
    return { ...s, valor_esperado, totais_forma_pagamento };
  });
}

export function CashRegisterSessionsManager({
  dateFilter = 'month',
  customDateStart,
  customDateEnd,
  statusFilter = 'all',
  valuesVisible = true,
}: Props) {
  const { user, profile, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { closeCash } = useCashRegister();
  const fmt = (n: number) => (valuesVisible ? currencyFormatters.brl(n) : MASKED_VALUE);
  const [selected, setSelected] = useState<CashSession | null>(null);
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [valorFinal, setValorFinal] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [movementType, setMovementType] = useState<'sangria' | 'suprimento'>('sangria');
  const [movementValor, setMovementValor] = useState('');
  const [movementMotivo, setMovementMotivo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedSessionId = selected?.id ?? '';
  const { movements, addMovement } = useCashMovements(selectedSessionId);

  /** Vendas da sessão aberta no modal (lista detalhada com pagamentos) */
  const { data: sessionSalesRows = [], isLoading: loadingSessionSales } = useQuery({
    queryKey: ['cash-session-sales-detail', selectedSessionId],
    enabled: !!selectedSessionId,
    queryFn: async () => {
      const { data: salesRows, error } = await from('sales')
        .select(
          'id, numero, created_at, cliente_nome, subtotal, desconto_total, total, status, sale_origin, ordem_servico_id'
        )
        .eq('cash_register_session_id', selectedSessionId)
        .order('created_at', { ascending: false })
        .execute();
      if (error) {
        console.warn('Erro ao buscar vendas da sessão:', error);
        return [];
      }
      const rawSales = (salesRows || []) as {
        id: string;
        numero?: number;
        created_at?: string;
        cliente_nome?: string | null;
        subtotal?: number;
        desconto_total?: number;
        total?: number;
        status?: string;
        sale_origin?: string | null;
        ordem_servico_id?: string | null;
      }[];
      const sales = rawSales.filter(
        (s) => s.status && !['draft', 'canceled', 'refunded', 'partial_refund'].includes(s.status)
      );
      const ids = sales.map((s) => s.id).filter(Boolean);
      let payments: {
        sale_id: string;
        forma_pagamento?: string;
        valor?: number;
        troco?: number;
        parcelas?: number | null;
        status?: string;
      }[] = [];
      if (ids.length > 0) {
        const payRes = await from('payments')
          .select('sale_id, forma_pagamento, valor, troco, parcelas, status')
          .in('sale_id', ids)
          .execute();
        payments = (payRes.data || []) as typeof payments;
      }
      const bySale: Record<string, typeof payments> = {};
      payments.forEach((p) => {
        if (p.status && p.status !== 'confirmed') return;
        if (!bySale[p.sale_id]) bySale[p.sale_id] = [];
        bySale[p.sale_id].push(p);
      });
      return sales.map((s) => ({ sale: s, payments: bySale[s.id] || [] }));
    },
    staleTime: 15 * 1000,
  });

  useEffect(() => {
    setShowCloseForm(false);
    setShowMovementForm(false);
  }, [selected?.id]);

  const handleCloseCash = async () => {
    if (!selected || !valorFinal.trim()) {
      toast({ title: 'Informe o valor final', variant: 'destructive' });
      return;
    }
    const v = parseFloat(valorFinal.replace(',', '.'));
    if (isNaN(v) || v < 0) {
      toast({ title: 'Valor final inválido', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      await closeCash(selected.id, v, undefined, justificativa.trim() || undefined, {
        opened_at: selected.opened_at,
        valor_inicial: selected.valor_inicial,
      });
      toast({ title: 'Caixa fechado com sucesso.' });
      setSelected(null);
      setShowCloseForm(false);
      setValorFinal('');
      setJustificativa('');
      queryClient.invalidateQueries({ queryKey: ['cash-register-sessions-admin'] });
      queryClient.invalidateQueries({ queryKey: ['cash-session-sales-detail'] });
    } catch (e: any) {
      toast({ title: e?.message || 'Erro ao fechar caixa', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddMovement = async () => {
    if (!selected || !movementValor.trim()) {
      toast({ title: 'Informe o valor', variant: 'destructive' });
      return;
    }
    const v = parseFloat(movementValor.replace(',', '.'));
    if (isNaN(v) || v <= 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      await addMovement({ tipo: movementType, valor: v, motivo: movementMotivo.trim() || undefined });
      toast({ title: movementType === 'sangria' ? 'Sangria registrada.' : 'Suprimento registrado.' });
      setShowMovementForm(false);
      setMovementValor('');
      setMovementMotivo('');
      queryClient.invalidateQueries({ queryKey: ['cash-register-sessions-admin'] });
      queryClient.invalidateQueries({ queryKey: ['cash-session-sales-detail'] });
    } catch (e: any) {
      toast({ title: e?.message || 'Erro ao registrar', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintExtratoTermico = async () => {
    if (!selected) return;
    try {
      const paidRows = sessionSalesRows.filter(({ sale }) => sale.status === 'paid');
      const salesTotalById: Record<string, number> = {};
      paidRows.forEach(({ sale }) => {
        salesTotalById[sale.id] = Number(sale.total || 0);
      });
      const getValorAplicado = (p: { sale_id?: string; forma_pagamento?: string; valor?: number; troco?: number }) => {
        const valor = Number(p.valor || 0);
        const troco = Number(p.troco || 0);
        const saleTotal = salesTotalById[p.sale_id || ''] ?? 0;
        if ((p.forma_pagamento || '').toLowerCase() === 'dinheiro' && troco > 0 && valor > saleTotal) return valor - troco;
        return valor;
      };

      const allPayments = paidRows.flatMap((r) => r.payments);
      const pagamentosPorForma: Record<string, number> = {};
      allPayments.forEach((p) => {
        const forma = (p.forma_pagamento || '').toLowerCase();
        if (forma === 'adiantamento os') return;
        const f = forma || 'outro';
        pagamentosPorForma[f] = (pagamentosPorForma[f] || 0) + getValorAplicado(p);
      });

      const valorAbertura = Number(selected.valor_inicial || 0);
      const totalDinheiroVendas = pagamentosPorForma['dinheiro'] || 0;
      const totalDinheiroParaConferencia = valorAbertura + totalDinheiroVendas;

      const totaisLinhas = Object.entries(pagamentosPorForma)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([forma, valor]) => {
          const valorConf = forma === 'dinheiro' ? totalDinheiroParaConferencia : valor;
          let detalhe: string | undefined;
          if (forma === 'dinheiro' && valorAbertura > 0) {
            detalhe = `Abertura ${currencyFormatters.brl(valorAbertura)} + vendas ${currencyFormatters.brl(totalDinheiroVendas)}`;
          }
          return { forma, valor_conferencia: valorConf, detalhe_linha: detalhe };
        });

      const totalEntradasVendas = allPayments.reduce((s, p) => {
        if ((p.forma_pagamento || '').toLowerCase() === 'adiantamento os') return s;
        return s + getValorAplicado(p);
      }, 0);

      const totalSuprimentos = movements.filter((m) => m.tipo === 'suprimento').reduce((sum, m) => sum + Number(m.valor || 0), 0);
      const totalSaidas = movements.filter((m) => m.tipo === 'sangria').reduce((sum, m) => sum + Number(m.valor || 0), 0);
      const valorEsperadoCalc = valorAbertura + totalEntradasVendas + totalSuprimentos - totalSaidas;
      const valorEsperado =
        selected.valor_esperado != null ? Number(selected.valor_esperado) : valorEsperadoCalc;

      const vendasLinhas = paidRows
        .slice()
        .sort((a, b) => String(b.sale.created_at || '').localeCompare(String(a.sale.created_at || '')))
        .map(({ sale, payments: plist }) => {
          const pags = plist
            .filter((p) => (p.forma_pagamento || '').toLowerCase() !== 'adiantamento os')
            .map((p) => ({
              forma: p.forma_pagamento || '',
              valor_exibido: getValorAplicado(p),
              troco: Number(p.troco || 0),
            }));
          return {
            numero: sale.numero ?? sale.id,
            cliente_nome: sale.cliente_nome?.trim() || 'Consumidor final',
            data_hora: sale.created_at
              ? `${dateFormatters.short(sale.created_at)} ${new Date(sale.created_at).toLocaleTimeString('pt-BR')}`
              : '—',
            total: Number(sale.total || 0),
            pagamentos: pags,
          };
        });

      const movimentosLinhas = movements.map((m) => ({
        tipo: m.tipo as 'sangria' | 'suprimento',
        valor: Number(m.valor),
        motivo: m.motivo || undefined,
      }));

      const openedAt = selected.opened_at;
      const html = await buildCashClosingTermicaHtml({
        operador_nome: selected.operador_nome || undefined,
        valor_abertura: valorAbertura,
        abertura_em: openedAt
          ? `${dateFormatters.short(openedAt)} ${new Date(openedAt).toLocaleTimeString('pt-BR')}`
          : '—',
        totais_por_forma: totaisLinhas,
        total_entradas_vendas: totalEntradasVendas,
        valor_esperado_caixa: valorEsperado,
        vendas: vendasLinhas,
        movimentos: movimentosLinhas,
      });
      printTermica(html);
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro ao gerar impressão', variant: 'destructive' });
    }
  };

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['cash-register-sessions-admin', dateFilter, customDateStart?.toISOString(), customDateEnd?.toISOString(), statusFilter, isAdmin, user?.id],
    queryFn: async () => {
      const baseFilter = () => {
        let q = from('cash_register_sessions').select('*');
        if (!isAdmin && user?.id) q = q.eq('operador_id', user.id);
        return q;
      };

      // Sessões ABERTAS: sempre trazer todas (sem filtro de data)
      if (statusFilter === 'open') {
        let q = baseFilter().eq('status', 'open').order('opened_at', { ascending: false });
        const { data, error } = await q.execute();
        if (error) { console.warn('Erro ao buscar sessões de caixa:', error); return []; }
        const list = (data || []) as CashSession[];
        return enrichSessionsWithEsperado(list);
      }

      // FECHADAS: só por período
      if (statusFilter === 'closed') {
        let q = baseFilter().eq('status', 'closed');
        const now = new Date();
        if (dateFilter === 'today') {
          q = q.gte('opened_at', startOfDay(now).toISOString()).lte('opened_at', endOfDay(now).toISOString());
        } else if (dateFilter === 'week') {
          const weekAgo = subDays(now, 7);
          q = q.gte('opened_at', startOfDay(weekAgo).toISOString()).lte('opened_at', endOfDay(now).toISOString());
        } else if (dateFilter === 'month') {
          const monthAgo = subDays(now, 30);
          q = q.gte('opened_at', startOfDay(monthAgo).toISOString()).lte('opened_at', endOfDay(now).toISOString());
        } else if (dateFilter === 'custom' && customDateStart && customDateEnd) {
          q = q.gte('opened_at', startOfDay(customDateStart).toISOString()).lte('opened_at', endOfDay(customDateEnd).toISOString());
        }
        q = q.order('opened_at', { ascending: false });
        const { data, error } = await q.execute();
        if (error) { console.warn('Erro ao buscar sessões de caixa:', error); return []; }
        const list = (data || []) as CashSession[];
        return enrichSessionsWithEsperado(list);
      }

      // TODOS: período + sempre incluir sessões abertas (para caixas abertos aparecerem mesmo com opened_at null ou fora do período)
      const now = new Date();
      let qPeriod = baseFilter();
      if (dateFilter === 'today') {
        qPeriod = qPeriod.gte('opened_at', startOfDay(now).toISOString()).lte('opened_at', endOfDay(now).toISOString());
      } else if (dateFilter === 'week') {
        const weekAgo = subDays(now, 7);
        qPeriod = qPeriod.gte('opened_at', startOfDay(weekAgo).toISOString()).lte('opened_at', endOfDay(now).toISOString());
      } else if (dateFilter === 'month') {
        const monthAgo = subDays(now, 30);
        qPeriod = qPeriod.gte('opened_at', startOfDay(monthAgo).toISOString()).lte('opened_at', endOfDay(now).toISOString());
      } else if (dateFilter === 'custom' && customDateStart && customDateEnd) {
        qPeriod = qPeriod.gte('opened_at', startOfDay(customDateStart).toISOString()).lte('opened_at', endOfDay(customDateEnd).toISOString());
      }
      qPeriod = qPeriod.order('opened_at', { ascending: false });

      const [byPeriodRes, openRes] = await Promise.all([
        qPeriod.execute(),
        baseFilter().eq('status', 'open').execute(),
      ]);
      if (byPeriodRes.error) { console.warn('Erro ao buscar sessões de caixa:', byPeriodRes.error); return []; }

      const byPeriod = (byPeriodRes.data || []) as CashSession[];
      const openSessions = (openRes.data || []) as CashSession[];
      const seen = new Set(byPeriod.map(s => s.id));
      const merged = [...byPeriod];
      for (const s of openSessions) {
        if (!seen.has(s.id)) { seen.add(s.id); merged.push(s); }
      }
      merged.sort((a, b) => {
        const aAt = a.opened_at ? new Date(a.opened_at).getTime() : 0;
        const bAt = b.opened_at ? new Date(b.opened_at).getTime() : 0;
        return bAt - aAt;
      });
      return enrichSessionsWithEsperado(merged);
    },
    retry: false,
  });

  const totalsByMethod = useMemo(() => {
    const totals: Record<string, number> = {};
    sessions.forEach(s => {
      const map = (s.totais_forma_pagamento || {}) as Record<string, number>;
      Object.entries(map).forEach(([k, v]) => {
        totals[k] = (totals[k] || 0) + Number(v || 0);
      });
    });
    return totals;
  }, [sessions]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Caixas (Sessões)</CardTitle>
        </CardHeader>
        <CardContent>Carregando...</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2">
          <CardTitle>Caixas (Sessões)</CardTitle>
          {Object.keys(totalsByMethod).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(totalsByMethod).map(([forma, valor]) => (
                <Badge key={forma} variant="outline" className="gap-2">
                  <span className="font-medium">{labelForma(forma)}:</span>
                  <span className="font-bold">{fmt(valor)}</span>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            {statusFilter === 'open'
              ? 'Nenhuma sessão de caixa aberta no momento.'
              : 'Nenhuma sessão de caixa encontrada no período selecionado.'}
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Operador(a)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Abertura</TableHead>
                  <TableHead>Fechamento</TableHead>
                  <TableHead className="text-right">Inicial</TableHead>
                  <TableHead className="text-right">Esperado</TableHead>
                  <TableHead className="text-right">Final</TableHead>
                  <TableHead className="text-right">Dif.</TableHead>
                  <TableHead>Formas</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map(s => (
                  <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(s)}>
                    <TableCell className="font-medium">#{s.numero ?? '-'}</TableCell>
                    <TableCell>{s.operador_nome || '-'}</TableCell>
                    <TableCell>
                      <Badge className={s.status === 'open' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {s.status === 'open' ? 'Aberto' : 'Fechado'}
                      </Badge>
                    </TableCell>
                    <TableCell>{s.opened_at ? dateFormatters.short(s.opened_at) : '-'}</TableCell>
                    <TableCell>{s.closed_at ? dateFormatters.short(s.closed_at) : '-'}</TableCell>
                    <TableCell className="text-right">{fmt(Number(s.valor_inicial || 0))}</TableCell>
                    <TableCell className="text-right">{fmt(Number(s.valor_esperado || 0))}</TableCell>
                    <TableCell className="text-right">{fmt(Number(s.valor_final || 0))}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {fmt(Number(s.divergencia || 0))}
                    </TableCell>
                    <TableCell>
                      {s.totais_forma_pagamento && Object.keys(s.totais_forma_pagamento).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(s.totais_forma_pagamento).map(([forma, valor]) => (
                            <Badge key={forma} variant="outline" className="text-xs">
                              {labelForma(forma)} {fmt(Number(valor || 0))}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelected(s); }}>
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-6xl w-[min(96vw,1152px)] max-h-[92vh] flex flex-col gap-0 p-6 overflow-hidden">
          <DialogHeader className="shrink-0 pr-8 space-y-0">
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <DialogTitle className="text-left">Detalhes do Caixa #{selected?.numero ?? '-'}</DialogTitle>
              {selected ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-9 shrink-0 gap-1 sm:self-center"
                  disabled={loadingSessionSales}
                  onClick={() => void handlePrintExtratoTermico()}
                >
                  <Printer className="h-4 w-4" />
                  Imprimir extrato (térmica)
                </Button>
              ) : null}
            </div>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 overflow-y-auto flex-1 min-h-0 pr-1 -mr-1">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground">Operador(a)</div>
                  <div className="font-semibold">{selected.operador_nome || '-'}</div>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground">Abertura</div>
                  <div className="font-semibold">{selected.opened_at ? dateFormatters.long(selected.opened_at) : '-'}</div>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground">Fechamento</div>
                  <div className="font-semibold">{selected.closed_at ? dateFormatters.long(selected.closed_at) : '-'}</div>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground">Diferença</div>
                  <div className="font-bold">{fmt(Number(selected.divergencia || 0))}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground">Inicial</div>
                  <div className="font-semibold">{fmt(Number(selected.valor_inicial || 0))}</div>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground">Esperado</div>
                  <div className="font-semibold">{fmt(Number(selected.valor_esperado ?? selected.valor_inicial ?? 0))}</div>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground">Final</div>
                  <div className="font-semibold">{fmt(Number(selected.valor_final ?? 0))}</div>
                </div>
              </div>

              <div className="border rounded-lg p-4 shrink-0">
                <div className="font-semibold mb-2">Totais por forma de pagamento</div>
                {selected.totais_forma_pagamento && Object.keys(selected.totais_forma_pagamento).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(selected.totais_forma_pagamento).map(([forma, valor]) => (
                      <Badge key={forma} variant="outline" className="gap-2">
                        <span className="font-medium">{labelForma(forma)}:</span>
                        <span className="font-bold">{fmt(Number(valor || 0))}</span>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Sem totais registrados (caixa ainda aberto ou não conferido)</div>
                )}
                {isAdmin ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2">
                    <span className="text-xs font-medium text-muted-foreground">Conferência</span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="gap-1"
                      disabled={loadingSessionSales}
                      onClick={() => void handlePrintExtratoTermico()}
                    >
                      <Printer className="h-4 w-4" />
                      Imprimir extrato (térmica)
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="border rounded-lg overflow-hidden flex flex-col min-h-[200px]">
                <div className="px-4 py-3 border-b bg-muted/40 font-semibold shrink-0">
                  Vendas nesta sessão ({sessionSalesRows.length})
                </div>
                {loadingSessionSales ? (
                  <div className="p-6 text-sm text-muted-foreground">Carregando vendas…</div>
                ) : sessionSalesRows.length === 0 ? (
                  <div className="p-6 text-sm text-muted-foreground">Nenhuma venda vinculada a esta sessão de caixa.</div>
                ) : (
                  <ScrollArea className="h-[min(45vh,440px)] w-full">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[72px]">Nº</TableHead>
                          <TableHead className="w-[130px]">Data / hora</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead className="w-[72px] text-center">Origem</TableHead>
                          <TableHead className="w-[88px] text-center">Status</TableHead>
                          <TableHead className="text-right w-[100px]">Subtotal</TableHead>
                          <TableHead className="text-right w-[90px]">Desconto</TableHead>
                          <TableHead className="text-right w-[100px] font-semibold">Total</TableHead>
                          <TableHead className="min-w-[220px]">Formas de pagamento</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sessionSalesRows.map(({ sale: s, payments: pays }) => {
                          const sub = Number(s.subtotal ?? 0);
                          const desc = Number(s.desconto_total ?? 0);
                          const tot = Number(s.total ?? 0);
                          const st = (s.status || '') as SaleStatus;
                          const statusLabel = SALE_STATUS_LABELS[st] || s.status || '—';
                          return (
                            <TableRow key={s.id}>
                              <TableCell className="font-mono text-sm">#{s.numero ?? '—'}</TableCell>
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                {s.created_at ? dateFormatters.short(s.created_at) : '—'}
                              </TableCell>
                              <TableCell className="max-w-[200px]">
                                <span className="line-clamp-2 font-medium">{s.cliente_nome?.trim() || '—'}</span>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {s.sale_origin === 'OS' ? 'OS' : 'PDV'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">{statusLabel}</span>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">{fmt(sub)}</TableCell>
                              <TableCell className="text-right tabular-nums text-amber-700 dark:text-amber-400">
                                {desc > 0 ? `−${fmt(desc)}` : fmt(0)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums font-semibold">{fmt(tot)}</TableCell>
                              <TableCell>
                                {pays.length === 0 ? (
                                  <span className="text-xs text-muted-foreground">Sem pagamentos confirmados</span>
                                ) : (
                                  <ul className="space-y-1.5 text-xs">
                                    {pays.map((p, idx) => {
                                      const v = Number(p.valor || 0);
                                      const troco = Number(p.troco || 0);
                                      const forma = labelForma(p.forma_pagamento || '');
                                      const parcelas = p.parcelas && p.parcelas > 1 ? ` · ${p.parcelas}x` : '';
                                      const ehDinheiro = (p.forma_pagamento || '').toLowerCase() === 'dinheiro';
                                      return (
                                        <li key={idx} className="border-l-2 border-primary/40 pl-2">
                                          <span className="font-medium">{forma}</span>
                                          <span className="text-muted-foreground"> · </span>
                                          <span className="tabular-nums font-semibold">{fmt(v)}</span>
                                          {parcelas}
                                          {ehDinheiro && troco > 0 && (
                                            <span className="text-muted-foreground"> · Troco {fmt(troco)}</span>
                                          )}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </div>

              {selected.status === 'open' && isAdmin && (
                <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                  <div className="font-semibold">Ações do administrador</div>
                  <div className="flex flex-wrap gap-2">
                    {!showCloseForm && !showMovementForm && (
                      <>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="gap-1"
                          disabled={loadingSessionSales}
                          onClick={() => void handlePrintExtratoTermico()}
                        >
                          <Printer className="h-4 w-4" />
                          Imprimir extrato (térmica)
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => setShowCloseForm(true)} className="gap-1">
                          <Lock className="h-4 w-4" /> Fechar caixa
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { setMovementType('sangria'); setShowMovementForm(true); }} className="gap-1">
                          <Minus className="h-4 w-4" /> Sangria (retirada)
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { setMovementType('suprimento'); setShowMovementForm(true); }} className="gap-1">
                          <Plus className="h-4 w-4" /> Suprimento
                        </Button>
                      </>
                    )}
                  </div>
                  {showCloseForm && (
                    <div className="space-y-2 p-3 border rounded-lg">
                      <Label>Valor final no caixa (R$)</Label>
                      <Input type="text" inputMode="decimal" placeholder="0,00" value={valorFinal} onChange={(e) => setValorFinal(e.target.value)} />
                      <Label>Justificativa (opcional)</Label>
                      <Textarea placeholder="Ex.: Conferido com fechamento" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} rows={2} />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={loadingSessionSales}
                          className="gap-1"
                          onClick={() => void handlePrintExtratoTermico()}
                        >
                          <Printer className="h-4 w-4" />
                          Imprimir extrato
                        </Button>
                        <Button size="sm" disabled={isSubmitting} onClick={handleCloseCash}>Fechar caixa</Button>
                        <Button size="sm" variant="outline" onClick={() => { setShowCloseForm(false); setValorFinal(''); setJustificativa(''); }}>Cancelar</Button>
                      </div>
                    </div>
                  )}
                  {showMovementForm && (
                    <div className="space-y-2 p-3 border rounded-lg">
                      <Label>{movementType === 'sangria' ? 'Valor da sangria (R$)' : 'Valor do suprimento (R$)'}</Label>
                      <Input type="text" inputMode="decimal" placeholder="0,00" value={movementValor} onChange={(e) => setMovementValor(e.target.value)} />
                      <Label>Motivo (opcional)</Label>
                      <Input placeholder="Ex.: Troco para vendas" value={movementMotivo} onChange={(e) => setMovementMotivo(e.target.value)} />
                      <div className="flex gap-2">
                        <Button size="sm" disabled={isSubmitting} onClick={handleAddMovement}>Registrar</Button>
                        <Button size="sm" variant="outline" onClick={() => { setShowMovementForm(false); setMovementValor(''); setMovementMotivo(''); }}>Cancelar</Button>
                      </div>
                    </div>
                  )}
                  {movements.length > 0 && (
                    <div>
                      <div className="font-medium mb-2">Movimentos desta sessão</div>
                      <div className="border rounded overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Tipo</TableHead>
                              <TableHead>Valor</TableHead>
                              <TableHead>Motivo</TableHead>
                              <TableHead>Data</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {movements.map((m: any) => (
                              <TableRow key={m.id}>
                                <TableCell>{m.tipo === 'sangria' ? 'Sangria' : 'Suprimento'}</TableCell>
                                <TableCell>{fmt(Number(m.valor || 0))}</TableCell>
                                <TableCell>{m.motivo || '-'}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{m.created_at ? dateFormatters.short(m.created_at) : '-'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}


