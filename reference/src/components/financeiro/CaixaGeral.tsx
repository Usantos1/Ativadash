import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCaixaGeral, type LedgerEntry, type CaixaGeralDateFilter } from '@/hooks/useCaixaGeral';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { PAYMENT_METHOD_LABELS } from '@/types/pdv';
import { currencyFormatters, dateFormatters } from '@/utils/formatters';
import { from } from '@/integrations/db/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Banknote, RefreshCw, TrendingUp, TrendingDown, MinusCircle, Eye, EyeOff, CalendarDays, ArrowRightLeft, FileText, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const CAIXA_VALUES_VISIBLE_KEY = 'primecamp_caixa_values_visible';

function getCaixaValuesVisible(): boolean {
  try {
    return localStorage.getItem(CAIXA_VALUES_VISIBLE_KEY) !== 'false';
  } catch {
    return true;
  }
}

function setCaixaValuesVisible(visible: boolean): void {
  try {
    localStorage.setItem(CAIXA_VALUES_VISIBLE_KEY, String(visible));
  } catch {}
}

function labelForma(forma: string, paymentMethods?: { code: string; name: string }[]): string {
  const byCode = paymentMethods?.find((pm) => pm.code === forma);
  if (byCode) return byCode.name;
  return (PAYMENT_METHOD_LABELS as Record<string, string>)[forma] ?? forma;
}

/** Status da conta para exibir cor: atrasado, vence em breve (7 dias), pendente */
function getBillStatus(dueDate: string | null): 'atrasado' | 'vence_breve' | 'pendente' {
  if (!dueDate) return 'pendente';
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'atrasado';
  if (diffDays <= 7) return 'vence_breve';
  return 'pendente';
}

const MASKED_VALUE = 'R$ •••••••';

// Cada empresa vê só suas carteiras (API filtra por company_id); sem fallback para não exibir dados de outra empresa
function WalletSaldoCard({
  name,
  saldo,
  valuesVisible,
  compact,
}: {
  name: string;
  saldo: number;
  valuesVisible: boolean;
  compact?: boolean;
}) {
  const isNegative = saldo < 0;
  const displaySaldo = valuesVisible ? currencyFormatters.brl(saldo) : MASKED_VALUE;
  if (compact) {
    return (
      <Card className="overflow-hidden min-w-0 flex-1 basis-0 min-h-0 flex flex-col rounded-lg">
        <CardHeader className="pb-0 pt-1.5 px-2 sm:pt-2">
          <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground flex items-center gap-1 truncate">
            <Wallet className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{name}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-1.5 sm:pb-2 pt-0 flex-1 flex flex-col justify-end min-h-0">
          <p className={cn('text-xs sm:text-base font-bold tabular-nums truncate', isNegative ? 'text-destructive' : 'text-foreground')}>
            {displaySaldo}
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Wallet className="h-4 w-4" />
          {name}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <p className={cn('text-2xl font-bold tabular-nums', isNegative ? 'text-destructive' : 'text-foreground')}>
          {displaySaldo}
        </p>
      </CardContent>
    </Card>
  );
}

function SaldoCard({
  forma,
  saldo,
  bruto,
  taxa,
  valuesVisible,
  paymentMethods,
  compact,
}: {
  forma: string;
  saldo: number;
  bruto: number;
  taxa: number;
  valuesVisible: boolean;
  paymentMethods?: { code: string; name: string }[];
  compact?: boolean;
}) {
  const isNegative = saldo < 0;
  const displaySaldo = valuesVisible ? currencyFormatters.brl(saldo) : MASKED_VALUE;
  const displayBruto = valuesVisible ? currencyFormatters.brl(bruto) : MASKED_VALUE;
  const displayTaxa = valuesVisible ? currencyFormatters.brl(taxa) : MASKED_VALUE;
  if (compact) {
    return (
      <Card className="overflow-hidden min-w-0 min-w-[100px] flex-1 basis-0 min-h-[72px] flex flex-col">
        <CardHeader className="pb-0.5 pt-2 px-2">
          <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground flex items-center gap-1 truncate">
            <Banknote className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{labelForma(forma, paymentMethods)}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-2 pt-0 flex-1 flex flex-col justify-end min-h-[2.5rem]">
          <p className={cn('text-sm sm:text-base font-bold tabular-nums truncate', isNegative ? 'text-destructive' : 'text-foreground')}>
            {displaySaldo}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5 min-h-[1rem] line-clamp-2 break-words">
            {(bruto > 0 || taxa !== 0) ? (
              <>Bruto {displayBruto}{taxa > 0 && <> · −{displayTaxa}</>}</>
            ) : (
              <span className="invisible">—</span>
            )}
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Banknote className="h-4 w-4" />
          {labelForma(forma, paymentMethods)}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <p className={cn('text-2xl font-bold tabular-nums', isNegative ? 'text-destructive' : 'text-foreground')}>
          {displaySaldo}
        </p>
        {(bruto > 0 || taxa !== 0) && (
          <p className="text-xs text-muted-foreground mt-1">
            Bruto {displayBruto}
            {taxa > 0 && <> · Taxa −{displayTaxa}</>}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ledgerTipoLabel(tipo: LedgerEntry['tipo']): string {
  switch (tipo) {
    case 'entrada_venda': return 'Venda';
    case 'sangria': return 'Sangria';
    case 'suprimento': return 'Suprimento';
    case 'transferencia': return 'Transferência';
    case 'pagamento_conta': return 'Conta a pagar';
    case 'retirada_lucro': return 'Ret. lucro';
    default: return tipo;
  }
}

function LedgerRow({ entry, valuesVisible, paymentMethods }: { entry: LedgerEntry; valuesVisible: boolean; paymentMethods?: { code: string; name: string }[] }) {
  const isEntrada = entry.tipo === 'entrada_venda' || entry.tipo === 'suprimento';
  const isSaida = entry.tipo === 'sangria' || entry.tipo === 'transferencia' || entry.tipo === 'pagamento_conta' || entry.tipo === 'retirada_lucro';
  const bruto = valuesVisible ? currencyFormatters.brl(entry.valor_bruto) : MASKED_VALUE;
  const taxa = valuesVisible ? (entry.valor_taxa > 0 ? `−${currencyFormatters.brl(entry.valor_taxa)}` : '—') : MASKED_VALUE;
  const liquido = valuesVisible
    ? (isSaida ? `−${currencyFormatters.brl(Math.abs(entry.valor_liquido))}` : currencyFormatters.brl(entry.valor_liquido))
    : MASKED_VALUE;
  const badgeVariant = entry.tipo === 'entrada_venda' ? 'default' : entry.tipo === 'sangria' ? 'destructive' : entry.tipo === 'transferencia' || entry.tipo === 'pagamento_conta' || entry.tipo === 'retirada_lucro' ? 'outline' : 'secondary';
  return (
    <TableRow>
      <TableCell className="text-muted-foreground whitespace-nowrap">
        {dateFormatters.withTime(entry.data)}
      </TableCell>
      <TableCell>
        <Badge variant={badgeVariant}>
          {ledgerTipoLabel(entry.tipo)}
        </Badge>
      </TableCell>
      <TableCell>{labelForma(entry.forma_pagamento, paymentMethods)}</TableCell>
      <TableCell>{entry.descricao}</TableCell>
      <TableCell className="text-right tabular-nums">{bruto}</TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">{taxa}</TableCell>
      <TableCell className={cn('text-right tabular-nums font-medium', isSaida ? 'text-destructive' : isEntrada ? 'text-green-600 dark:text-green-400' : '')}>
        {liquido}
      </TableCell>
    </TableRow>
  );
}

export interface CaixaGeralProps {
  dateFilter: CaixaGeralDateFilter;
  setDateFilter: (v: CaixaGeralDateFilter) => void;
  customDateStart?: Date;
  customDateEnd?: Date;
  setCustomDateStart: (v: Date | undefined) => void;
  setCustomDateEnd: (v: Date | undefined) => void;
  showDatePicker: boolean;
  setShowDatePicker: (v: boolean) => void;
  statusFilter: 'all' | 'open' | 'closed';
  setStatusFilter: (v: 'all' | 'open' | 'closed') => void;
  /** Quando passado pelo layout (ex.: FinanceiroCaixaPage), usa o olhinho do header e não exibe o interno */
  valuesVisible?: boolean;
  setValuesVisible?: (v: boolean) => void;
}

export function CaixaGeral({
  dateFilter,
  setDateFilter,
  customDateStart,
  customDateEnd,
  setCustomDateStart,
  setCustomDateEnd,
  showDatePicker,
  setShowDatePicker,
  statusFilter,
  setStatusFilter,
  valuesVisible: valuesVisibleProp,
  setValuesVisible: setValuesVisibleProp,
}: CaixaGeralProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const period = { dateFilter, customDateStart, customDateEnd };
  const { saldoPorForma, totaisPorForma, sangriaTotal, suprimentoTotal, ledger, isLoading, refetch } = useCaixaGeral(period);

  const { paymentMethods = [], wallets = [], fetchPaymentMethods, fetchWallets } = usePaymentMethods();
  useEffect(() => {
    fetchPaymentMethods(true);
    fetchWallets();
  }, [fetchPaymentMethods, fetchWallets]);

  const [internalVisible, setInternalVisible] = useState(getCaixaValuesVisible);
  useEffect(() => {
    setCaixaValuesVisible(internalVisible);
  }, [internalVisible]);

  const valuesVisible = valuesVisibleProp ?? internalVisible;
  const setValuesVisible = setValuesVisibleProp ?? setInternalVisible;
  const showInternalToggle = valuesVisibleProp === undefined;

  const [showRetiradaDialog, setShowRetiradaDialog] = useState(false);
  const [retiradaTipo, setRetiradaTipo] = useState<'sangria' | 'transferencia' | 'pagamento_conta' | 'retirada_lucro'>('sangria');
  const [retiradaSessionId, setRetiradaSessionId] = useState('');
  const [retiradaValor, setRetiradaValor] = useState('');
  const [retiradaMotivo, setRetiradaMotivo] = useState('');
  const [retiradaFormaOrigem, setRetiradaFormaOrigem] = useState('');
  const [retiradaFormaDestino, setRetiradaFormaDestino] = useState('');
  const [retiradaWalletOrigem, setRetiradaWalletOrigem] = useState('');
  const [retiradaWalletDestino, setRetiradaWalletDestino] = useState('');
  const [retiradaBillId, setRetiradaBillId] = useState('');
  const [isSubmittingRetirada, setIsSubmittingRetirada] = useState(false);

  const walletList = wallets || [];
  const saldoPorWallet = useMemo(() => {
    const out: Record<string, number> = {};
    walletList.forEach((w) => {
      const saldo = (paymentMethods || [])
        .filter((p) => p.wallet_id === w.id)
        .reduce((s, p) => s + (saldoPorForma[p.code] ?? 0), 0);
      out[w.id] = round2(saldo);
    });
    return out;
  }, [walletList, paymentMethods, saldoPorForma]);

  const firstFormaCodeForWallet = (walletId: string): string => {
    const pm = (paymentMethods || []).find((p) => p.wallet_id === walletId);
    return pm?.code ?? '';
  };

  const paymentMethodsForLabel = useMemo(() => (paymentMethods || []).map((p) => ({ code: p.code, name: p.name })), [paymentMethods]);
  const formasOptions = useMemo(() => (paymentMethods || []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)), [paymentMethods]);

  const { data: billsPendentes = [] } = useQuery({
    queryKey: ['bills-pendentes-caixa-geral'],
    queryFn: async () => {
      const { data, error } = await from('bills_to_pay')
        .select('id, description, amount, due_date, status')
        .in('status', ['pendente', 'atrasado'])
        .order('due_date', { ascending: true })
        .limit(100)
        .execute();
      if (error) return [];
      return (data || []) as any[];
    },
    enabled: showRetiradaDialog && retiradaTipo === 'pagamento_conta',
  });

  const operadorNome = profile?.display_name ?? (user as any)?.user_metadata?.name ?? user?.email ?? 'Operador';

  const handleRetiradaSubmit = async () => {
    const v = parseFloat(String(retiradaValor).replace(',', '.'));
    if (isNaN(v) || v <= 0) {
      toast({ title: 'Informe um valor válido', variant: 'destructive' });
      return;
    }
    setIsSubmittingRetirada(true);
    try {
      const formaOrigem = retiradaTipo === 'sangria'
        ? firstFormaCodeForWallet(retiradaWalletOrigem)
        : (retiradaWalletOrigem ? firstFormaCodeForWallet(retiradaWalletOrigem) : retiradaFormaOrigem || '');
      const formaDestino = retiradaTipo === 'transferencia' && retiradaWalletDestino
        ? firstFormaCodeForWallet(retiradaWalletDestino)
        : retiradaFormaDestino;

      if (retiradaTipo === 'sangria') {
        if (!retiradaWalletOrigem || !formaOrigem) {
          toast({ title: 'Selecione a carteira de origem', variant: 'destructive' });
          setIsSubmittingRetirada(false);
          return;
        }
        const { error: treasuryError } = await from('treasury_movements')
          .insert({
            tipo: 'sangria',
            forma_origem: formaOrigem,
            forma_destino: null,
            valor: v,
            motivo: retiradaMotivo.trim() || null,
            operador_id: user?.id ?? null,
            operador_nome: operadorNome,
          })
          .execute();
        if (treasuryError) throw treasuryError;
        toast({ title: 'Sangria registrada (carteira debitada).' });
      } else {
        if (!formaOrigem) {
          toast({ title: 'Selecione a carteira de origem', variant: 'destructive' });
          setIsSubmittingRetirada(false);
          return;
        }
        if (retiradaTipo === 'transferencia' && !formaDestino) {
          toast({ title: 'Selecione a carteira de destino', variant: 'destructive' });
          setIsSubmittingRetirada(false);
          return;
        }
        if (retiradaTipo === 'pagamento_conta' && !retiradaBillId) {
          toast({ title: 'Selecione a conta a pagar', variant: 'destructive' });
          setIsSubmittingRetirada(false);
          return;
        }
        const { error: treasuryError } = await from('treasury_movements')
          .insert({
            tipo: retiradaTipo,
            forma_origem: formaOrigem,
            forma_destino: retiradaTipo === 'transferencia' ? formaDestino : null,
            valor: v,
            motivo: retiradaMotivo.trim() || null,
            bill_id: retiradaTipo === 'pagamento_conta' ? retiradaBillId : null,
            operador_id: user?.id ?? null,
            operador_nome: operadorNome,
          })
          .execute();
        if (treasuryError) throw treasuryError;
        if (retiradaTipo === 'pagamento_conta' && retiradaBillId) {
          await from('bills_to_pay')
            .update({
              status: 'pago',
              payment_date: new Date().toISOString().split('T')[0],
              payment_method: formaOrigem,
              paid_by: user?.id,
            })
            .eq('id', retiradaBillId)
            .execute();
        }
        toast({
          title: retiradaTipo === 'transferencia' ? 'Transferência registrada.' : retiradaTipo === 'pagamento_conta' ? 'Conta paga e movimentação registrada.' : 'Retirada como lucro registrada.',
        });
      }
      setShowRetiradaDialog(false);
      setRetiradaSessionId('');
      setRetiradaValor('');
      setRetiradaMotivo('');
      setRetiradaFormaOrigem('');
      setRetiradaFormaDestino('');
      setRetiradaWalletOrigem('');
      setRetiradaWalletDestino('');
      setRetiradaBillId('');
      queryClient.invalidateQueries({ queryKey: ['caixa-geral-payments'] });
      queryClient.invalidateQueries({ queryKey: ['caixa-geral-movements'] });
      queryClient.invalidateQueries({ queryKey: ['caixa-geral-treasury'] });
      queryClient.invalidateQueries({ queryKey: ['cash-register-sessions-admin'] });
      queryClient.invalidateQueries({ queryKey: ['cash-register-sessions-open-caixa-geral'] });
      queryClient.invalidateQueries({ queryKey: ['bills-to-pay'] });
      queryClient.invalidateQueries({ queryKey: ['bills-pendentes-caixa-geral'] });
      refetch();
    } catch (e: any) {
      toast({ title: e?.message || 'Erro ao registrar movimentação', variant: 'destructive' });
    } finally {
      setIsSubmittingRetirada(false);
    }
  };

  const canSubmitRetirada =
    retiradaValor && parseFloat(String(retiradaValor).replace(',', '.')) > 0 &&
    (retiradaTipo !== 'sangria' || retiradaWalletOrigem) &&
    (retiradaTipo !== 'transferencia' || (retiradaWalletOrigem && retiradaWalletDestino)) &&
    (retiradaTipo !== 'pagamento_conta' || (retiradaWalletOrigem && retiradaBillId)) &&
    (retiradaTipo !== 'retirada_lucro' || retiradaWalletOrigem);

  // Apenas formas de pagamento cadastradas em /admin/configuracoes/pagamentos (ordem por sort_order)
  const formasComSaldo = useMemo(() => {
    if (paymentMethods?.length) {
      const ordered = [...paymentMethods].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      return ordered.map((p) => p.code);
    }
    const fallback = ['dinheiro', 'pix', 'debito', 'credito', 'link_pagamento', 'carteira_digital', 'fiado'];
    return [...fallback, ...Object.keys(saldoPorForma).filter((f) => !fallback.includes(f))];
  }, [paymentMethods, saldoPorForma]);

  const totalGeral = useMemo(() => {
    return formasComSaldo.reduce((a, forma) => round2(a + (saldoPorForma[forma] ?? 0)), 0);
  }, [formasComSaldo, saldoPorForma]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg font-semibold shrink-0">Caixa geral (tesouraria)</h2>
        {/* Único bloco de filtros: Período + Status + ações — mobile: wrap e toque confortável */}
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <Label className="text-muted-foreground whitespace-nowrap text-xs">Período</Label>
            <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'min-h-[44px] sm:h-8 w-full min-w-[140px] sm:w-[160px] text-xs justify-start font-normal rounded-xl sm:rounded-md touch-manipulation',
                    dateFilter === 'custom' && customDateStart && customDateEnd && 'text-foreground'
                  )}
                >
                  <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                  {dateFilter === 'custom' && customDateStart && customDateEnd ? (
                    <span className="truncate">
                      {format(customDateStart, 'dd/MM/yy', { locale: ptBR })} - {format(customDateEnd, 'dd/MM/yy', { locale: ptBR })}
                    </span>
                  ) : dateFilter === 'today' ? (
                    'Hoje'
                  ) : dateFilter === 'week' ? (
                    '7 dias'
                  ) : dateFilter === 'month' ? (
                    'Últimos 30 dias'
                  ) : (
                    'Todos'
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="p-2 border-b space-y-1">
                  <div className="grid grid-cols-2 gap-1">
                    <Button variant={dateFilter === 'today' ? 'default' : 'outline'} size="sm" className="h-8 text-xs" onClick={() => { setDateFilter('today'); setShowDatePicker(false); }}>Hoje</Button>
                    <Button variant={dateFilter === 'week' ? 'default' : 'outline'} size="sm" className="h-8 text-xs" onClick={() => { setDateFilter('week'); setShowDatePicker(false); }}>7 dias</Button>
                    <Button variant={dateFilter === 'month' ? 'default' : 'outline'} size="sm" className="h-8 text-xs" onClick={() => { setDateFilter('month'); setShowDatePicker(false); }}>30 dias</Button>
                    <Button variant={dateFilter === 'all' ? 'default' : 'outline'} size="sm" className="h-8 text-xs" onClick={() => { setDateFilter('all'); setShowDatePicker(false); }}>Todos</Button>
                  </div>
                  <div className="text-[10px] text-muted-foreground text-center">ou período personalizado:</div>
                </div>
                <div className="p-2 space-y-2">
                  <div className="grid grid-cols-2 gap-1">
                    <div>
                      <Label className="text-[10px]">Início</Label>
                      <Input
                        type="date"
                        value={customDateStart ? format(customDateStart, 'yyyy-MM-dd') : ''}
                        onChange={(e) => { if (e.target.value) setCustomDateStart(new Date(e.target.value + 'T00:00:00')); }}
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Fim</Label>
                      <Input
                        type="date"
                        value={customDateEnd ? format(customDateEnd, 'yyyy-MM-dd') : ''}
                        onChange={(e) => { if (e.target.value) setCustomDateEnd(new Date(e.target.value + 'T23:59:59')); }}
                        className="h-7 text-xs"
                      />
                    </div>
                  </div>
                  <Button className="w-full h-8 text-xs" size="sm" disabled={!customDateStart || !customDateEnd} onClick={() => { setDateFilter('custom'); setShowDatePicker(false); }}>Aplicar</Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Label htmlFor="caixa-status" className="text-muted-foreground whitespace-nowrap text-xs">Status</Label>
            <Select
              value={statusFilter}
              onValueChange={(v: string) => {
                if (v === 'all' || v === 'open' || v === 'closed') setStatusFilter(v);
              }}
            >
              <SelectTrigger id="caixa-status" className="min-h-[44px] sm:h-8 w-[100px] text-xs rounded-xl sm:rounded-md touch-manipulation">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="open">Abertos</SelectItem>
                <SelectItem value="closed">Fechados</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {showInternalToggle && (
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px] min-w-[44px] sm:h-8 sm:w-8 p-0 shrink-0 rounded-xl sm:rounded-md touch-manipulation"
              onClick={() => setValuesVisible(!valuesVisible)}
              title={valuesVisible ? 'Ocultar valores' : 'Exibir valores'}
              aria-label={valuesVisible ? 'Ocultar valores em reais' : 'Exibir valores em reais'}
            >
              {valuesVisible ? <Eye className="h-4 w-4 text-muted-foreground" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
            </Button>
          )}
          <Button variant="outline" size="sm" className="min-h-[44px] sm:h-8 text-xs rounded-xl sm:rounded-md touch-manipulation shrink-0" onClick={() => setShowRetiradaDialog(true)}>
            <MinusCircle className="h-3.5 w-3.5 mr-1" />
            Retirar
          </Button>
          <Button variant="outline" size="sm" className="min-h-[44px] sm:h-8 text-xs rounded-xl sm:rounded-md touch-manipulation shrink-0" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1', isLoading && 'animate-spin')} />
            Atualizar
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground py-8 text-center">Carregando saldos...</div>
      ) : (
        <>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-medium text-muted-foreground mb-1.5 sm:mb-2 flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Carteiras (saldo real)
            </h3>
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:justify-center gap-1.5 sm:gap-2 min-w-0">
              {walletList.map((w) => (
                <div key={w.id} className="min-w-0 w-full sm:w-[min(100%,200px)]">
                  <WalletSaldoCard
                    name={w.name}
                    saldo={round2(saldoPorWallet[w.id] ?? 0)}
                    valuesVisible={valuesVisible}
                    compact
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Por forma de pagamento</h3>
            <div className="flex flex-wrap justify-center gap-2 min-w-0">
              {formasComSaldo.map((forma) => (
                <div key={forma} className="w-[min(100%,140px)] sm:w-[min(100%,160px)]">
                  <SaldoCard
                    forma={forma}
                    saldo={round2(saldoPorForma[forma] ?? 0)}
                    bruto={totaisPorForma[forma]?.bruto ?? 0}
                    taxa={totaisPorForma[forma]?.taxa ?? 0}
                    valuesVisible={valuesVisible}
                    paymentMethods={paymentMethodsForLabel}
                    compact
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-1 text-muted-foreground">
              <TrendingDown className="h-4 w-4 text-destructive" /> Sangrias totais: <strong className="text-foreground">{valuesVisible ? currencyFormatters.brl(sangriaTotal) : MASKED_VALUE}</strong>
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-green-600" /> Suprimentos totais: <strong className="text-foreground">{valuesVisible ? currencyFormatters.brl(suprimentoTotal) : MASKED_VALUE}</strong>
            </span>
            <span className="font-semibold tabular-nums">
              Saldo geral: {valuesVisible ? currencyFormatters.brl(totalGeral) : MASKED_VALUE}
            </span>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Espelho (movimentos)</CardTitle>
              <p className="text-sm text-muted-foreground">Entradas e saídas por forma de pagamento — valores líquidos (após taxas de cada forma de pagamento).</p>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Forma</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Bruto</TableHead>
                      <TableHead className="text-right">Taxa</TableHead>
                      <TableHead className="text-right">Líquido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledger.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Nenhum movimento no período.
                        </TableCell>
                      </TableRow>
                    ) : (
                      ledger.map((entry) => (
                        <LedgerRow key={entry.id} entry={entry} valuesVisible={valuesVisible} paymentMethods={paymentMethodsForLabel} />
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={showRetiradaDialog} onOpenChange={(open) => { setShowRetiradaDialog(open); if (!open) { setRetiradaTipo('sangria'); setRetiradaSessionId(''); setRetiradaValor(''); setRetiradaMotivo(''); setRetiradaFormaOrigem(''); setRetiradaFormaDestino(''); setRetiradaWalletOrigem(''); setRetiradaWalletDestino(''); setRetiradaBillId(''); } }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Movimentação da tesouraria</DialogTitle>
            <DialogDescription>
              Retirar ou transferir entre carteiras, pagar conta a pagar ou registrar retirada como lucro. Todas as retiradas debitam da carteira escolhida.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Tipo de movimentação</Label>
              <Select value={retiradaTipo} onValueChange={(v) => setRetiradaTipo(v as typeof retiradaTipo)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sangria" className="flex items-center gap-2">
                    <MinusCircle className="h-4 w-4" /> Sangria (retirar de uma carteira)
                  </SelectItem>
                  <SelectItem value="transferencia" className="flex items-center gap-2">
                    <ArrowRightLeft className="h-4 w-4" /> Transferência entre carteiras
                  </SelectItem>
                  <SelectItem value="pagamento_conta" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Pagar conta a pagar
                  </SelectItem>
                  <SelectItem value="retirada_lucro" className="flex items-center gap-2">
                    <Wallet className="h-4 w-4" /> Retirada como lucro
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{retiradaTipo === 'sangria' ? 'Carteira de origem (de onde sai o valor)' : 'Carteira de origem (de onde sai o pagamento)'}</Label>
              <Select value={retiradaWalletOrigem} onValueChange={(val) => setRetiradaWalletOrigem(val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a carteira" />
                </SelectTrigger>
                <SelectContent>
                  {walletList.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name} — {valuesVisible ? currencyFormatters.brl(saldoPorWallet[w.id] ?? 0) : '•••'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {retiradaTipo === 'transferencia' && (
              <div className="space-y-2">
                <Label>Carteira de destino (para onde vai o valor)</Label>
                <Select value={retiradaWalletDestino} onValueChange={(val) => { setRetiradaWalletDestino(val); setRetiradaFormaDestino(firstFormaCodeForWallet(val)); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a carteira" />
                  </SelectTrigger>
                  <SelectContent>
                    {walletList.filter((w) => w.id !== retiradaWalletOrigem).map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name} — {valuesVisible ? currencyFormatters.brl(saldoPorWallet[w.id] ?? 0) : '•••'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {retiradaTipo === 'pagamento_conta' && (
              <div className="space-y-2">
                <Label>Conta a pagar</Label>
                <Select value={retiradaBillId} onValueChange={(id) => { setRetiradaBillId(id); const b = billsPendentes.find((x: any) => x.id === id); if (b?.amount) setRetiradaValor(String(b.amount)); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {billsPendentes.length === 0 ? (
                      <SelectItem value="_none" disabled>Nenhuma conta pendente</SelectItem>
                    ) : (
                      billsPendentes.map((b: any) => {
                        const status = getBillStatus(b.due_date);
                        const statusDot = cn(
                          'shrink-0 w-2 h-2 rounded-full',
                          status === 'atrasado' && 'bg-red-500',
                          status === 'vence_breve' && 'bg-amber-500',
                          status === 'pendente' && 'bg-emerald-500'
                        );
                        const statusLabel = status === 'atrasado' ? 'Atrasado' : status === 'vence_breve' ? 'Vence em breve' : 'Pendente';
                        return (
                          <SelectItem key={b.id} value={b.id}>
                            <span className="flex items-center gap-2">
                              <span className={statusDot} title={statusLabel} aria-hidden />
                              <span>{b.description ?? 'Sem descrição'} — {valuesVisible ? currencyFormatters.brl(Number(b.amount) || 0) : MASKED_VALUE} (venc. {b.due_date ? format(new Date(b.due_date), 'dd/MM/yy', { locale: ptBR }) : '-'})</span>
                            </span>
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground flex items-center gap-2 flex-wrap">
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Atrasado</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Vence em 7 dias</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Pendente</span>
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={retiradaValor}
                onChange={(e) => setRetiradaValor(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Motivo (opcional)</Label>
              <Textarea
                placeholder={retiradaTipo === 'transferencia' ? 'Ex: Ajuste entre contas' : retiradaTipo === 'retirada_lucro' ? 'Ex: Pro-labore' : 'Observação'}
                value={retiradaMotivo}
                onChange={(e) => setRetiradaMotivo(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRetiradaDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleRetiradaSubmit}
              disabled={isSubmittingRetirada || !canSubmitRetirada}
            >
              {isSubmittingRetirada ? 'Salvando…' : retiradaTipo === 'sangria' ? 'Registrar sangria' : retiradaTipo === 'transferencia' ? 'Transferir' : retiradaTipo === 'pagamento_conta' ? 'Pagar conta' : 'Registrar retirada'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const round2 = (n: number) => Math.round(n * 100) / 100;
