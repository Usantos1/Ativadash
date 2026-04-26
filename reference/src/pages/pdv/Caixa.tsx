import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ModernLayout } from '@/components/ModernLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  DollarSign, Plus, Minus, Lock, Unlock, TrendingUp, TrendingDown,
  Calendar, Clock, User, FileText, CalendarDays, Printer
} from 'lucide-react';
import { useCashRegister, useCashMovements } from '@/hooks/usePDV';
import { useAuth } from '@/contexts/AuthContext';
import { CashRegisterSessionsManager } from '@/components/financeiro/CashRegisterSessionsManager';
import { usePermissions } from '@/hooks/usePermissions';
import { currencyFormatters, dateFormatters } from '@/utils/formatters';
import { getDemoAwareErrorMessage, isDemoSession } from '@/utils/demoMode';
import { useToast } from '@/hooks/use-toast';
import { LoadingButton } from '@/components/LoadingButton';
import { cn } from '@/lib/utils';
import { from } from '@/integrations/db/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { printTermica } from '@/utils/pdfGenerator';
import { buildCashClosingTermicaHtml } from '@/utils/cashClosingTermicaGenerator';

export default function Caixa() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isAdmin } = useAuth();
  const { hasPermission } = usePermissions();
  const { currentSession, isLoading, openCash, closeCash } = useCashRegister();
  const canOpenCash = hasPermission('caixa.open');
  const canCloseCash = hasPermission('caixa.close');
  const canMovement = hasPermission('caixa.sangria') || hasPermission('caixa.suprimento');
  const { movements, isLoading: movementsLoading, addMovement } = useCashMovements(
    currentSession?.id || ''
  );

  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showMovementDialog, setShowMovementDialog] = useState(false);
  const [valorInicial, setValorInicial] = useState('');
  const [valorFinal, setValorFinal] = useState('');
  const [divergencia, setDivergencia] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [movementType, setMovementType] = useState<'sangria' | 'suprimento'>('sangria');
  const [movementValor, setMovementValor] = useState('');
  const [movementMotivo, setMovementMotivo] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [sales, setSales] = useState<any[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);
  const [salePayments, setSalePayments] = useState<Record<string, any[]>>({});
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [showSaleDetails, setShowSaleDetails] = useState(false);
  const [adminDateFilter, setAdminDateFilter] = useState<'today' | 'week' | 'month' | 'all' | 'custom'>('month');
  const [adminCustomDateStart, setAdminCustomDateStart] = useState<Date | undefined>(undefined);
  const [adminCustomDateEnd, setAdminCustomDateEnd] = useState<Date | undefined>(undefined);
  const [adminShowDatePicker, setAdminShowDatePicker] = useState(false);
  const [adminStatusFilter, setAdminStatusFilter] = useState<'all' | 'open' | 'closed'>('all');

  useEffect(() => {
    if (currentSession?.id) {
      loadSales();
    }
  }, [currentSession?.id]);

  // Carregar itens da venda quando seleciona
  useEffect(() => {
    const loadSaleItems = async () => {
      if (selectedSale && showSaleDetails && !selectedSale.items) {
        const { data: itemsData } = await from('sale_items')
          .select('*')
          .eq('sale_id', selectedSale.id)
          .execute();
        
        if (itemsData) {
          setSelectedSale((prev: any) => prev ? { ...prev, items: itemsData } : null);
        }
      }
    };
    loadSaleItems();
  }, [selectedSale?.id, showSaleDetails]);

  const loadSales = async () => {
    if (!currentSession?.id) return;
    try {
      setLoadingSales(true);
      // 1) Preferência: vendas vinculadas diretamente ao caixa (cash_register_session_id)
      let salesData: any[] | null = null;
      let salesError: any = null;

      const direct = await from('sales')
        .select('*')
        .eq('cash_register_session_id', currentSession.id)
        .eq('status', 'paid')
        .order('created_at', { ascending: false })
        .execute();

      salesData = direct.data || [];
      salesError = direct.error;

      // 2) Fallback: se a coluna não existe / não está sendo preenchida, buscar por período do caixa (opened_at) e operador
      if (
        salesError?.code === 'PGRST204' ||
        String(salesError?.message || '').includes('cash_register_session_id') ||
        (Array.isArray(salesData) && salesData.length === 0)
      ) {
        const openedAt = (currentSession as any).opened_at || (currentSession as any).created_at;
        const operadorId = (currentSession as any).operador_id || user?.id;

        if (openedAt && operadorId) {
          const fallback = await from('sales')
            .select('*')
            .eq('status', 'paid')
            .eq('vendedor_id', operadorId)
            .gte('finalized_at', openedAt)
            .order('created_at', { ascending: false })
            .execute();

          // só sobrescreve se não der erro
          if (!fallback.error) {
            salesData = fallback.data || [];
          }
        }
      }

      setSales(salesData || []);
      
      // Carregar pagamentos de todas as vendas
      if (salesData && salesData.length > 0) {
        const saleIds = salesData.map(s => s.id);
        const { data: paymentsData, error: paymentsError } = await from('payments')
          .select('*')
          .in('sale_id', saleIds)
          .eq('status', 'confirmed')
          .execute();
        
        if (!paymentsError && paymentsData) {
          const paymentsBySale: Record<string, any[]> = {};
          paymentsData.forEach((payment: any) => {
            if (!paymentsBySale[payment.sale_id]) {
              paymentsBySale[payment.sale_id] = [];
            }
            paymentsBySale[payment.sale_id].push(payment);
          });
          setSalePayments(paymentsBySale);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar vendas:', error);
    } finally {
      setLoadingSales(false);
    }
  };

  const handleOpenCash = async () => {
    if (!valorInicial || parseFloat(valorInicial) < 0) {
      toast({ title: 'Valor inicial inválido', variant: 'destructive' });
      return;
    }

    try {
      setIsProcessing(true);
      await openCash({
        valor_inicial: parseFloat(valorInicial),
        operador_id: user?.id || '',
      });
      toast({ title: 'Caixa aberto com sucesso!' });
      setShowOpenDialog(false);
      setValorInicial('');
    } catch (error: any) {
      toast({ 
        title: isDemoSession() ? 'Não é possível na conta demo' : 'Erro ao abrir caixa', 
        description: getDemoAwareErrorMessage(error, 'Tente novamente'),
        variant: 'destructive' 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCloseCash = async () => {
    if (!valorFinal || parseFloat(valorFinal) < 0) {
      toast({ title: 'Valor final inválido', variant: 'destructive' });
      return;
    }

    if (!currentSession) return;

    try {
      setIsProcessing(true);
      const valorFinalNum = parseFloat(valorFinal);
      const divergenciaNum = divergencia ? parseFloat(divergencia) : undefined;
      
      await closeCash(
        currentSession.id,
        valorFinalNum,
        divergenciaNum,
        justificativa || undefined
      );
      
      toast({ title: 'Caixa fechado com sucesso!' });
      setShowCloseDialog(false);
      setValorFinal('');
      setDivergencia('');
      setJustificativa('');
    } catch (error: any) {
      toast({ 
        title: isDemoSession() ? 'Não é possível na conta demo' : 'Erro ao fechar caixa', 
        description: getDemoAwareErrorMessage(error, 'Tente novamente'),
        variant: 'destructive' 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddMovement = async () => {
    if (!movementValor || parseFloat(movementValor) <= 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' });
      return;
    }

    if (!currentSession) return;

    try {
      setIsProcessing(true);
      await addMovement({
        tipo: movementType,
        valor: parseFloat(movementValor),
        motivo: movementMotivo || undefined,
      });
      
      toast({ 
        title: `${movementType === 'sangria' ? 'Sangria' : 'Suprimento'} registrado com sucesso!` 
      });
      setShowMovementDialog(false);
      setMovementValor('');
      setMovementMotivo('');
    } catch (error: any) {
      toast({ 
        title: isDemoSession() ? 'Não é possível na conta demo' : 'Erro ao registrar movimento', 
        description: getDemoAwareErrorMessage(error, 'Tente novamente'),
        variant: 'destructive' 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Calcular totais
  const totalSuprimentos = movements
    .filter(m => m.tipo === 'suprimento')
    .reduce((sum, m) => sum + Number(m.valor), 0);
  
  const totalSaidas = movements
    .filter(m => m.tipo === 'sangria')
    .reduce((sum, m) => sum + Number(m.valor), 0);

  // Calcular total de vendas (valor faturado) para exibição
  const totalVendas = sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);

  // Valor aplicado à venda (para dinheiro com troco: se valor > total da venda, era "recebido" → usar valor - troco)
  const salesTotalById: Record<string, number> = {};
  sales.forEach((s: any) => { salesTotalById[s.id] = Number(s.total || 0); });
  const getValorAplicado = (p: any) => {
    const valor = Number(p.valor || 0);
    const troco = Number(p.troco || 0);
    const saleTotal = salesTotalById[p.sale_id] ?? 0;
    if ((p.forma_pagamento || '').toLowerCase() === 'dinheiro' && troco > 0 && valor > saleTotal) return valor - troco;
    return valor;
  };

  // Entradas de vendas que de fato entram no caixa nesta sessão (exclui Adiantamento OS — esse valor já entrou quando o adiantamento foi registrado)
  const totalEntradasVendas = Object.values(salePayments).flat().reduce((sum, p: any) => {
    if ((p.forma_pagamento || '').toLowerCase() === 'adiantamento os') return sum;
    return sum + getValorAplicado(p);
  }, 0);

  // Total de entradas para conferência: só o que entrou de fato (vendas sem adiantamento OS) + Suprimentos
  const totalEntradas = totalSuprimentos + totalEntradasVendas;
  
  // Conferência por forma: só pagamentos que de fato entram nesta sessão (exclui Adiantamento OS — já entrou quando foi registrado)
  const pagamentosPorForma: Record<string, number> = {};
  Object.values(salePayments).flat().forEach((payment: any) => {
    const forma = (payment.forma_pagamento || '').toLowerCase();
    if (forma === 'adiantamento os') return;
    const f = forma || 'outro';
    const valor = getValorAplicado(payment);
    pagamentosPorForma[f] = (pagamentosPorForma[f] || 0) + valor;
  });
  // Para conferência: Dinheiro = abertura + vendas em dinheiro (para contagem física)
  const valorAberturaSessao = Number(currentSession?.valor_inicial || 0);
  const totalDinheiroVendas = pagamentosPorForma['dinheiro'] || 0;
  const totalDinheiroParaConferencia = valorAberturaSessao + totalDinheiroVendas;
  
  const valorEsperado = currentSession 
    ? Number(currentSession.valor_inicial) + totalEntradas - totalSaidas
    : 0;

  const handlePrintFechamentoTermico = async () => {
    if (!currentSession) return;
    try {
      const vendasLinhas = [...sales]
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
        .map((sale: any) => {
          const plist = salePayments[sale.id] || [];
          const saleTotal = Number(sale.total || 0);
          const pags = plist
            .filter((p: any) => (p.forma_pagamento || '').toLowerCase() !== 'adiantamento os')
            .map((p: any) => ({
              forma: p.forma_pagamento,
              valor_exibido: getValorAplicado(p),
              troco: Number(p.troco || 0),
            }));
          return {
            numero: sale.numero ?? sale.id,
            cliente_nome: sale.cliente_nome || 'Consumidor final',
            data_hora: `${dateFormatters.short(sale.created_at)} ${new Date(sale.created_at).toLocaleTimeString('pt-BR')}`,
            total: saleTotal,
            pagamentos: pags,
          };
        });
      const movimentosLinhas = movements.map((m) => ({
        tipo: m.tipo as 'sangria' | 'suprimento',
        valor: Number(m.valor),
        motivo: m.motivo || undefined,
      }));
      const totaisLinhas = Object.entries(pagamentosPorForma)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([forma, valor]) => {
          const valorConf = forma === 'dinheiro' ? totalDinheiroParaConferencia : valor;
          let detalhe: string | undefined;
          if (forma === 'dinheiro' && valorAberturaSessao > 0) {
            detalhe = `Abertura ${currencyFormatters.brl(valorAberturaSessao)} + vendas ${currencyFormatters.brl(totalDinheiroVendas)}`;
          }
          return { forma, valor_conferencia: valorConf, detalhe_linha: detalhe };
        });
      const html = await buildCashClosingTermicaHtml({
        operador_nome: currentSession.operador_nome,
        valor_abertura: valorAberturaSessao,
        abertura_em: `${dateFormatters.short(currentSession.opened_at)} ${new Date(currentSession.opened_at).toLocaleTimeString('pt-BR')}`,
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

  if (isLoading) {
    return (
      <ModernLayout title="Caixa" subtitle="Gerenciamento de caixa">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </ModernLayout>
    );
  }

  return (
    <ModernLayout title="Caixa" subtitle="Abertura, fechamento e movimentos de caixa">
      <div className="flex flex-col min-h-0 flex-1 overflow-y-auto gap-2 md:gap-3">
        {/* Status do Caixa + Suprimento/Sangria ao lado de Abrir/Fechar */}
        <div className="flex-shrink-0 bg-card border border-gray-200 rounded-lg shadow-sm p-2 md:p-3">
          {currentSession ? (
            <>
              {/* Mobile: Layout compacto */}
              <div className="md:hidden space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Badge className="bg-green-100 text-green-800 text-[10px]">
                    <Unlock className="h-3 w-3 mr-1" />Aberto
                  </Badge>
                  <div className="flex items-center gap-1">
                    {canMovement && (
                      <>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setMovementType('suprimento'); setShowMovementDialog(true); }}>
                          <Plus className="h-3 w-3 mr-1" />Suprimento
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setMovementType('sangria'); setShowMovementDialog(true); }}>
                          <Minus className="h-3 w-3 mr-1" />Sangria
                        </Button>
                      </>
                    )}
                    {canCloseCash && (
                      <Button onClick={() => setShowCloseDialog(true)} variant="destructive" size="sm" className="h-7 text-xs">
                        <Lock className="h-3 w-3 mr-1" />Fechar
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin text-[10px]">
                  <span className="whitespace-nowrap px-1.5 py-0.5 bg-gray-100 rounded">Inicial: {currencyFormatters.brl(currentSession.valor_inicial)}</span>
                  <span className="whitespace-nowrap px-1.5 py-0.5 bg-green-100 text-green-700 rounded">+{currencyFormatters.brl(totalEntradas)}</span>
                  <span className="whitespace-nowrap px-1.5 py-0.5 bg-red-100 text-red-700 rounded">-{currencyFormatters.brl(totalSaidas)}</span>
                  <span className="whitespace-nowrap px-1.5 py-0.5 bg-blue-100 text-blue-700 font-bold rounded">= {currencyFormatters.brl(valorEsperado)}</span>
                </div>
              </div>

              {/* Desktop: Layout completo */}
              <div className="hidden md:flex flex-wrap items-center gap-3">
                <Badge className="bg-green-100 text-green-800 text-xs"><Unlock className="h-3 w-3 mr-1" />Caixa Aberto</Badge>
                <div className="flex items-center gap-4 flex-wrap flex-1">
                  <div className="flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs text-muted-foreground">Inicial:</span><span className="text-sm font-semibold">{currencyFormatters.brl(currentSession.valor_inicial)}</span></div>
                  <div className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-green-600" /><span className="text-xs text-muted-foreground">Entradas:</span><span className="text-sm font-semibold text-green-600">{currencyFormatters.brl(totalEntradas)}</span></div>
                  <div className="flex items-center gap-1.5"><TrendingDown className="h-3.5 w-3.5 text-red-600" /><span className="text-xs text-muted-foreground">Saídas:</span><span className="text-sm font-semibold text-red-600">{currencyFormatters.brl(totalSaidas)}</span></div>
                  <div className="flex items-center gap-1.5 bg-primary/10 px-2 py-1 rounded"><span className="text-xs text-muted-foreground">Esperado:</span><span className="text-sm font-bold text-primary">{currencyFormatters.brl(valorEsperado)}</span></div>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  {canMovement && (
                    <>
                      <Button variant="outline" size="sm" className="h-8" onClick={() => { setMovementType('suprimento'); setShowMovementDialog(true); }}>
                        <Plus className="h-3.5 w-3.5 mr-1" />Suprimento
                      </Button>
                      <Button variant="outline" size="sm" className="h-8" onClick={() => { setMovementType('sangria'); setShowMovementDialog(true); }}>
                        <Minus className="h-3.5 w-3.5 mr-1" />Sangria
                      </Button>
                    </>
                  )}
                  {canCloseCash && (
                    <Button onClick={() => setShowCloseDialog(true)} variant="destructive" size="sm" className="h-8"><Lock className="h-3.5 w-3.5 mr-1" />Fechar Caixa</Button>
                  )}
                </div>
                <div className="w-full flex items-center gap-3 text-xs text-muted-foreground mt-1 pt-2 border-t">
                  <span className="flex items-center gap-1"><User className="h-3 w-3" />{currentSession.operador_nome}</span>
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{dateFormatters.short(currentSession.opened_at)}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(currentSession.opened_at).toLocaleTimeString('pt-BR')}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 md:gap-3">
                <Badge variant="outline" className="text-[10px] md:text-xs"><Lock className="h-3 w-3 mr-1" />Fechado</Badge>
                <span className="text-xs md:text-sm text-muted-foreground hidden md:inline">
                  {canOpenCash ? 'Abra o caixa para começar a operar' : 'Sem permissão para abrir o caixa'}
                </span>
              </div>
              <div className="flex items-center gap-1 md:gap-2">
                {canMovement && (
                  <>
                    <Button variant="outline" size="sm" className="h-7 md:h-8 text-xs" disabled title="Abra o caixa para registrar suprimento">
                      <Plus className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1" />Suprimento
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 md:h-8 text-xs" disabled title="Abra o caixa para registrar sangria">
                      <Minus className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1" />Sangria
                    </Button>
                  </>
                )}
                {canOpenCash && (
                  <Button onClick={() => setShowOpenDialog(true)} size="sm" className="h-7 md:h-8 text-xs md:text-sm">
                    <Unlock className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1" />Abrir
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Conferência por forma de pagamento (antes de fechar o caixa) */}
        {currentSession && Object.keys(pagamentosPorForma).length > 0 && (
          <Card className="flex-shrink-0 border-2 border-blue-200 bg-blue-50/30">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Conferência por forma de pagamento
              </CardTitle>
              <p className="text-xs text-muted-foreground">Confira cada valor antes de fechar o caixa.</p>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {Object.entries(pagamentosPorForma)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([forma, valor]) => {
                    const valorExibir = forma === 'dinheiro' ? totalDinheiroParaConferencia : valor;
                    return (
                      <div
                        key={forma}
                        className="flex flex-col rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm"
                      >
                        <span className="text-xs font-medium text-muted-foreground">
                          {forma === 'dinheiro' ? 'Dinheiro (abertura + vendas)' : forma === 'pix' ? 'PIX' : forma === 'debito' ? 'Débito' : forma === 'credito' ? 'Crédito' : forma === 'credito_parcelado' ? 'Crédito parcelado' : forma}
                        </span>
                        <span className="text-lg font-bold text-primary">{currencyFormatters.brl(valorExibir)}</span>
                        {forma === 'dinheiro' && valorAberturaSessao > 0 && (
                          <span className="text-[10px] text-muted-foreground">{currencyFormatters.brl(valorAberturaSessao)} + {currencyFormatters.brl(totalDinheiroVendas)}</span>
                        )}
                      </div>
                    );
                  })}
              </div>
              <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between items-center">
                <span className="text-sm font-medium">Total entradas (vendas):</span>
                <span className="text-lg font-bold">{currencyFormatters.brl(totalEntradasVendas)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Vendas - Flex-1 com scroll interno */}
        {currentSession && (
          <Card className="flex-1 flex flex-col overflow-hidden min-h-0 border border-gray-200">
            <CardHeader className="flex-shrink-0 pb-2 pt-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Vendas do Caixa</CardTitle>
                <Badge variant="outline" className="text-xs">{sales.length} venda(s)</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col overflow-hidden min-h-0 p-0">
              {loadingSales ? (
                <div className="text-center py-4 text-muted-foreground text-sm">Carregando vendas...</div>
              ) : sales.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">Nenhuma venda registrada nesta sessão</p>
                </div>
              ) : (
                <>
                  {/* Desktop: Tabela com scroll */}
                  <div className="hidden md:flex flex-1 flex-col overflow-hidden min-h-0">
                    <div className="flex-1 overflow-auto scrollbar-thin border-t border-gray-200">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b-2 border-gray-300">
                          <TableHead className="font-semibold bg-muted/60 border-r border-gray-200">Número</TableHead>
                          <TableHead className="font-semibold bg-muted/60 border-r border-gray-200">Cliente</TableHead>
                          <TableHead className="font-semibold bg-muted/60 border-r border-gray-200">Data/Hora</TableHead>
                          <TableHead className="font-semibold bg-muted/60 border-r border-gray-200">Formas de Pagamento</TableHead>
                          <TableHead className="font-semibold bg-muted/60 text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sales.map((sale, index) => {
                          const salePaymentsList = salePayments[sale.id] || [];
                          return (
                            <TableRow 
                              key={sale.id} 
                              className={`cursor-pointer hover:bg-muted/50 border-b border-gray-200 ${index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}`}
                              onClick={() => {
                                setSelectedSale(sale);
                                setShowSaleDetails(true);
                              }}
                            >
                              <TableCell className="font-medium border-r border-gray-200">#{sale.numero}</TableCell>
                              <TableCell className="border-r border-gray-200">{sale.cliente_nome || 'Consumidor Final'}</TableCell>
                              <TableCell className="border-r border-gray-200">
                                {dateFormatters.short(sale.created_at)}{' '}
                                {new Date(sale.created_at).toLocaleTimeString('pt-BR')}
                              </TableCell>
                              <TableCell className="border-r border-gray-200">
                                {salePaymentsList.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {salePaymentsList.map((p: any, idx: number) => (
                                      <Badge key={idx} variant="outline" className="text-xs">
                                        {p.forma_pagamento === 'dinheiro' ? 'Dinheiro' : 
                                         p.forma_pagamento === 'pix' ? 'PIX' :
                                         p.forma_pagamento === 'debito' ? 'Débito' :
                                         p.forma_pagamento === 'credito' ? 'Crédito' :
                                         p.forma_pagamento === 'link_pagamento' ? 'Link' :
                                         p.forma_pagamento === 'carteira_digital' ? 'Carteira' : p.forma_pagamento}
                                        {' '}
                                        {currencyFormatters.brl(p.valor)}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-sm">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {currencyFormatters.brl(sale.total)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    </div>
                    {/* Rodapé fixo - Total (só valor que entrou no caixa; exclui Adiantamento OS) */}
                    <div className="flex-shrink-0 p-3 bg-muted/50 border-t border-gray-200">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm">Total de Vendas (entradas no caixa):</span>
                        <span className="text-lg font-bold text-primary">
                          {currencyFormatters.brl(totalEntradasVendas)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Mobile: Cards com scroll */}
                  <div className="md:hidden flex-1 overflow-auto scrollbar-thin p-3 space-y-3">
                    {sales.map((sale) => {
                      const salePaymentsList = salePayments[sale.id] || [];
                      return (
                        <Card 
                          key={sale.id}
                          className="border-2 border-gray-300 cursor-pointer hover:border-blue-400 transition-all active:scale-[0.98]"
                          onClick={() => {
                            setSelectedSale(sale);
                            setShowSaleDetails(true);
                          }}
                        >
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-center justify-between border-b-2 border-gray-200 pb-2">
                              <span className="font-semibold text-sm">Venda #{sale.numero}</span>
                              <span className="text-base font-bold text-primary">
                                {currencyFormatters.brl(sale.total)}
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              <div>
                                <p className="text-xs text-muted-foreground">Cliente</p>
                                <p className="text-sm font-medium">{sale.cliente_nome || 'Consumidor Final'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Data/Hora</p>
                                <p className="text-sm">
                                  {dateFormatters.short(sale.created_at)}{' '}
                                  {new Date(sale.created_at).toLocaleTimeString('pt-BR')}
                                </p>
                              </div>
                              {salePaymentsList.length > 0 && (
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Formas de Pagamento</p>
                                  <div className="flex flex-wrap gap-1">
                                    {salePaymentsList.map((p: any, idx: number) => (
                                      <Badge key={idx} variant="outline" className="text-[10px] border-2 border-gray-300">
                                        {p.forma_pagamento === 'dinheiro' ? 'Dinheiro' : 
                                         p.forma_pagamento === 'pix' ? 'PIX' :
                                         p.forma_pagamento === 'debito' ? 'Débito' :
                                         p.forma_pagamento === 'credito' ? 'Crédito' :
                                         p.forma_pagamento === 'link_pagamento' ? 'Link' :
                                         p.forma_pagamento === 'carteira_digital' ? 'Carteira' : p.forma_pagamento}
                                        {' '}
                                        {currencyFormatters.brl(p.valor)}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                    <div className="p-3 bg-muted/50 border-2 border-gray-300 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm">Total de Vendas (entradas no caixa):</span>
                        <span className="text-lg font-bold text-primary">
                          {currencyFormatters.brl(totalEntradasVendas)}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Admin: Todos os caixas (abertos e fechados) por dia/filtros */}
        {isAdmin && (
          <Card className="border-2 border-gray-300 flex flex-col overflow-hidden min-h-0">
            <CardHeader className="flex-shrink-0 pb-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Todos os caixas</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Sessões abertas e fechadas por período e status</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-muted-foreground whitespace-nowrap text-xs">Período</Label>
                    <Popover open={adminShowDatePicker} onOpenChange={setAdminShowDatePicker}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            'w-[180px] h-8 text-xs justify-start font-normal',
                            adminDateFilter === 'custom' && adminCustomDateStart && adminCustomDateEnd && 'text-foreground'
                          )}
                        >
                          <CalendarDays className="mr-2 h-3.5 w-3.5" />
                          {adminDateFilter === 'custom' && adminCustomDateStart && adminCustomDateEnd ? (
                            <span className="truncate">
                              {format(adminCustomDateStart, 'dd/MM/yy', { locale: ptBR })} - {format(adminCustomDateEnd, 'dd/MM/yy', { locale: ptBR })}
                            </span>
                          ) : adminDateFilter === 'today' ? (
                            'Hoje'
                          ) : adminDateFilter === 'week' ? (
                            'Últimos 7 dias'
                          ) : adminDateFilter === 'month' ? (
                            'Últimos 30 dias'
                          ) : (
                            'Todos os períodos'
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <div className="p-3 border-b space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <Button variant={adminDateFilter === 'today' ? 'default' : 'outline'} size="sm" onClick={() => { setAdminDateFilter('today'); setAdminShowDatePicker(false); }}>Hoje</Button>
                            <Button variant={adminDateFilter === 'week' ? 'default' : 'outline'} size="sm" onClick={() => { setAdminDateFilter('week'); setAdminShowDatePicker(false); }}>7 dias</Button>
                            <Button variant={adminDateFilter === 'month' ? 'default' : 'outline'} size="sm" onClick={() => { setAdminDateFilter('month'); setAdminShowDatePicker(false); }}>30 dias</Button>
                            <Button variant={adminDateFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => { setAdminDateFilter('all'); setAdminShowDatePicker(false); }}>Todos</Button>
                          </div>
                          <div className="text-xs text-muted-foreground text-center pt-1">ou selecione um período:</div>
                        </div>
                        <div className="p-3 space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Data Início</Label>
                              <Input
                                type="date"
                                value={adminCustomDateStart ? format(adminCustomDateStart, 'yyyy-MM-dd') : ''}
                                onChange={(e) => { if (e.target.value) setAdminCustomDateStart(new Date(e.target.value + 'T00:00:00')); }}
                                className="h-8 text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Data Fim</Label>
                              <Input
                                type="date"
                                value={adminCustomDateEnd ? format(adminCustomDateEnd, 'yyyy-MM-dd') : ''}
                                onChange={(e) => { if (e.target.value) setAdminCustomDateEnd(new Date(e.target.value + 'T23:59:59')); }}
                                className="h-8 text-xs"
                              />
                            </div>
                          </div>
                          <Button className="w-full" size="sm" disabled={!adminCustomDateStart || !adminCustomDateEnd} onClick={() => { setAdminDateFilter('custom'); setAdminShowDatePicker(false); }}>Aplicar Período</Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="pdv-admin-status" className="text-muted-foreground whitespace-nowrap text-xs">Status</Label>
                    <Select value={adminStatusFilter} onValueChange={(v) => setAdminStatusFilter(v as 'all' | 'open' | 'closed')}>
                      <SelectTrigger id="pdv-admin-status" className="w-[120px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="open">Abertos</SelectItem>
                        <SelectItem value="closed">Fechados</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col overflow-hidden min-h-0 p-4 pt-0">
              <CashRegisterSessionsManager dateFilter={adminDateFilter} customDateStart={adminCustomDateStart} customDateEnd={adminCustomDateEnd} statusFilter={adminStatusFilter} />
            </CardContent>
          </Card>
        )}

        {/* Movimentos — lista apenas; Suprimento/Sangria ficam ao lado de Abrir/Fechar Caixa */}
        <Card className="border-2 border-gray-300">
          <CardHeader className="pb-2 md:pb-3 pt-3 md:pt-6">
            <CardTitle className="text-base md:text-lg">Movimentos</CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6">
            {!currentSession ? (
              <div className="text-center py-6 md:py-8 text-muted-foreground">
                <FileText className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-2 opacity-50" />
                <p className="text-xs md:text-sm">Abra o caixa para registrar movimentos (suprimento ou sangria).</p>
              </div>
            ) : movements.length === 0 ? (
              <div className="text-center py-6 md:py-8 text-muted-foreground">
                <FileText className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-2 opacity-50" />
                <p className="text-xs md:text-sm">Nenhum movimento registrado</p>
              </div>
            ) : (
                <>
                  {/* Desktop: Tabela */}
                  <div className="hidden md:block border-2 border-gray-300 rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b-2 border-gray-300">
                          <TableHead className="font-semibold bg-muted/60 border-r border-gray-200">Tipo</TableHead>
                          <TableHead className="font-semibold bg-muted/60 border-r border-gray-200">Valor</TableHead>
                          <TableHead className="font-semibold bg-muted/60 border-r border-gray-200">Motivo</TableHead>
                          <TableHead className="font-semibold bg-muted/60 border-r border-gray-200">Operador</TableHead>
                          <TableHead className="font-semibold bg-muted/60">Data/Hora</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movements.map((movement, index) => (
                          <TableRow 
                            key={movement.id}
                            className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}`}
                          >
                            <TableCell className="border-r border-gray-200">
                              <Badge
                                className={cn(
                                  movement.tipo === 'sangria'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-green-100 text-green-800'
                                )}
                              >
                                {movement.tipo === 'sangria' ? 'Sangria' : 'Suprimento'}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold border-r border-gray-200">
                              {currencyFormatters.brl(movement.valor)}
                            </TableCell>
                            <TableCell className="border-r border-gray-200">{movement.motivo || '-'}</TableCell>
                            <TableCell className="border-r border-gray-200">{movement.operador_nome}</TableCell>
                            <TableCell>
                              {dateFormatters.short(movement.created_at)}{' '}
                              {new Date(movement.created_at).toLocaleTimeString('pt-BR')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile: Cards */}
                  <div className="md:hidden space-y-3">
                    {movements.map((movement) => (
                      <Card 
                        key={movement.id}
                        className="border-2 border-gray-300"
                      >
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-center justify-between border-b-2 border-gray-200 pb-2">
                            <Badge
                              className={cn(
                                'text-xs',
                                movement.tipo === 'sangria'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-green-100 text-green-800'
                              )}
                            >
                              {movement.tipo === 'sangria' ? 'Sangria' : 'Suprimento'}
                            </Badge>
                            <span className="text-base font-bold">
                              {currencyFormatters.brl(movement.valor)}
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            {movement.motivo && (
                              <div>
                                <p className="text-xs text-muted-foreground">Motivo</p>
                                <p className="text-sm">{movement.motivo}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-xs text-muted-foreground">Operador</p>
                              <p className="text-sm font-medium">{movement.operador_nome}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Data/Hora</p>
                              <p className="text-sm">
                                {dateFormatters.short(movement.created_at)}{' '}
                                {new Date(movement.created_at).toLocaleTimeString('pt-BR')}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
      </div>

      {/* Dialog: Abrir Caixa */}
      <Dialog open={showOpenDialog} onOpenChange={setShowOpenDialog}>
        <DialogContent className="p-3 md:p-6 max-w-[95vw] md:max-w-md">
          <DialogHeader className="pb-2 md:pb-4">
            <DialogTitle className="text-base md:text-lg">Abrir Caixa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 md:space-y-4">
            <div>
              <Label className="text-xs md:text-sm">Valor Inicial (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={valorInicial}
                onChange={(e) => setValorInicial(e.target.value)}
                placeholder="0.00"
                autoFocus
                className="h-9 md:h-10 text-sm border-2 border-gray-300"
              />
            </div>
            <div className="text-xs md:text-sm text-muted-foreground">
              <p>Informe o valor em dinheiro que está no caixa no momento da abertura.</p>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 pt-3 md:pt-4">
            <Button 
              variant="outline" 
              onClick={() => setShowOpenDialog(false)}
              className="w-full sm:w-auto h-9 md:h-10 border-2 border-gray-300"
            >
              Cancelar
            </Button>
            <LoadingButton 
              onClick={handleOpenCash} 
              loading={isProcessing}
              className="w-full sm:w-auto h-9 md:h-10"
            >
              Abrir Caixa
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Fechar Caixa — maior e mais visível */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent className="p-4 md:p-6 max-w-[96vw] md:max-w-4xl max-h-[95vh] overflow-y-auto text-base">
          <DialogHeader className="pb-3 md:pb-4">
            <DialogTitle className="text-lg md:text-xl">Fechar Caixa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 md:space-y-5">
            {/* Conferência por forma de pagamento */}
            {Object.keys(pagamentosPorForma).length > 0 && (
              <div className="rounded-xl border-2 border-blue-200 bg-blue-50/30 p-4 md:p-5">
                <p className="text-sm font-semibold text-muted-foreground mb-3">Conferência por forma de pagamento</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.entries(pagamentosPorForma)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([forma, valor]) => {
                      const valorExibir = forma === 'dinheiro' ? totalDinheiroParaConferencia : valor;
                      return (
                        <div key={forma} className="flex flex-col rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">
                              {forma === 'dinheiro' ? 'Dinheiro (abertura + vendas)' : forma === 'pix' ? 'PIX' : forma === 'debito' ? 'Débito' : forma === 'credito' ? 'Crédito' : forma === 'credito_parcelado' ? 'Crédito parcelado' : forma}
                            </span>
                            <span className="font-semibold">{currencyFormatters.brl(valorExibir)}</span>
                          </div>
                          {forma === 'dinheiro' && valorAberturaSessao > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">{currencyFormatters.brl(valorAberturaSessao)} abertura + {currencyFormatters.brl(totalDinheiroVendas)} vendas</p>
                          )}
                        </div>
                      );
                    })}
                </div>
                <div className="mt-3 pt-3 border-t-2 border-gray-200 space-y-1">
                  <div className="flex justify-between text-sm font-medium">
                    <span>Total vendas (entradas no caixa)</span>
                    <span>{currencyFormatters.brl(totalEntradasVendas)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-primary">
                    <span>Total do caixa (abertura + vendas)</span>
                    <span>{currencyFormatters.brl(valorEsperado)}</span>
                  </div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <div>
                <Label className="text-xs md:text-sm">Valor Esperado (R$)</Label>
                <Input
                  type="number"
                  value={valorEsperado.toFixed(2)}
                  disabled
                  className="bg-muted h-9 md:h-10 text-sm border-2 border-gray-300"
                />
                <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                  Calculado automaticamente
                </p>
              </div>
              <div>
                <Label className="text-xs md:text-sm">Valor Final Contado (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={valorFinal}
                  onChange={(e) => {
                    setValorFinal(e.target.value);
                    const final = parseFloat(e.target.value) || 0;
                    const diverg = final - valorEsperado;
                    setDivergencia(diverg.toFixed(2));
                  }}
                  placeholder="0.00"
                  autoFocus
                  className="h-9 md:h-10 text-sm border-2 border-gray-300"
                />
              </div>
            </div>
            
            <div>
              <Label className="text-xs md:text-sm">Divergência (R$)</Label>
              <Input
                type="number"
                value={divergencia}
                onChange={(e) => setDivergencia(e.target.value)}
                className={cn(
                  'h-9 md:h-10 text-sm border-2',
                  parseFloat(divergencia || '0') !== 0 ? 'border-orange-500' : 'border-gray-300'
                )}
                disabled
              />
              <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                {parseFloat(divergencia || '0') > 0 
                  ? 'Sobra no caixa' 
                  : parseFloat(divergencia || '0') < 0 
                  ? 'Falta no caixa' 
                  : 'Sem divergência'}
              </p>
            </div>

            {parseFloat(divergencia || '0') !== 0 && (
              <div>
                <Label className="text-xs md:text-sm">Justificativa da Divergência</Label>
                <Textarea
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  placeholder="Explique a divergência encontrada..."
                  rows={3}
                  className="text-sm border-2 border-gray-300"
                />
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 pt-3 md:pt-4 sm:justify-between">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handlePrintFechamentoTermico()}
              className="w-full sm:w-auto h-9 md:h-10 border-2 border-gray-300"
            >
              <Printer className="h-3.5 w-3.5 mr-1.5" />
              Imprimir extrato (térmica)
            </Button>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:ml-auto">
            <Button 
              variant="outline" 
              onClick={() => setShowCloseDialog(false)}
              className="w-full sm:w-auto h-9 md:h-10 border-2 border-gray-300"
            >
              Cancelar
            </Button>
            <LoadingButton 
              onClick={handleCloseCash} 
              loading={isProcessing}
              className="w-full sm:w-auto h-9 md:h-10"
            >
              Fechar Caixa
            </LoadingButton>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Movimento */}
      <Dialog open={showMovementDialog} onOpenChange={setShowMovementDialog}>
        <DialogContent className="p-3 md:p-6 max-w-[95vw] md:max-w-md">
          <DialogHeader className="pb-2 md:pb-4">
            <DialogTitle className="text-base md:text-lg">
              {movementType === 'sangria' ? 'Registrar Sangria' : 'Registrar Suprimento'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 md:space-y-4">
            <div>
              <Label className="text-xs md:text-sm">Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={movementValor}
                onChange={(e) => setMovementValor(e.target.value)}
                placeholder="0.00"
                autoFocus
                className="h-9 md:h-10 text-sm border-2 border-gray-300"
              />
            </div>
            <div>
              <Label className="text-xs md:text-sm">Motivo (Opcional)</Label>
              <Textarea
                value={movementMotivo}
                onChange={(e) => setMovementMotivo(e.target.value)}
                placeholder="Descreva o motivo do movimento..."
                rows={3}
                className="text-sm border-2 border-gray-300"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 pt-3 md:pt-4">
            <Button 
              variant="outline" 
              onClick={() => setShowMovementDialog(false)}
              className="w-full sm:w-auto h-9 md:h-10 border-2 border-gray-300"
            >
              Cancelar
            </Button>
            <LoadingButton 
              onClick={handleAddMovement} 
              loading={isProcessing}
              className="w-full sm:w-auto h-9 md:h-10"
            >
              Registrar
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Detalhes da Venda */}
      <Dialog open={showSaleDetails} onOpenChange={setShowSaleDetails}>
        <DialogContent className="p-3 md:p-6 max-w-[95vw] md:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-2 md:pb-4">
            <DialogTitle className="text-base md:text-lg">Detalhes da Venda #{selectedSale?.numero}</DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-3 md:space-y-4">
              {/* Informações da Venda */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div>
                  <Label className="text-xs md:text-sm text-muted-foreground">Cliente</Label>
                  <p className="font-medium text-sm md:text-base">{selectedSale.cliente_nome || 'Consumidor Final'}</p>
                </div>
                <div>
                  <Label className="text-xs md:text-sm text-muted-foreground">Data/Hora</Label>
                  <p className="font-medium text-sm md:text-base">
                    {dateFormatters.short(selectedSale.created_at)}{' '}
                    {new Date(selectedSale.created_at).toLocaleTimeString('pt-BR')}
                  </p>
                </div>
                <div>
                  <Label className="text-xs md:text-sm text-muted-foreground">Vendedor</Label>
                  <p className="font-medium text-sm md:text-base">{selectedSale.vendedor_nome || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs md:text-sm text-muted-foreground">Total</Label>
                  <p className="font-bold text-base md:text-lg">{currencyFormatters.brl(selectedSale.total)}</p>
                </div>
              </div>

              {/* Produtos */}
              <div>
                <Label className="text-xs md:text-sm font-semibold mb-2 block">Produtos:</Label>
                <div className="border-2 border-gray-300 rounded-lg overflow-hidden">
                  {/* Desktop: Tabela */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b-2 border-gray-300">
                          <TableHead className="font-semibold bg-muted/60 border-r border-gray-200">Produto</TableHead>
                          <TableHead className="font-semibold bg-muted/60 border-r border-gray-200 text-right">Qtd</TableHead>
                          <TableHead className="font-semibold bg-muted/60 border-r border-gray-200 text-right">Vl. Unit.</TableHead>
                          <TableHead className="font-semibold bg-muted/60 text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedSale.items && selectedSale.items.length > 0 ? (
                          selectedSale.items.map((item: any, index: number) => (
                            <TableRow 
                              key={item.id}
                              className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}`}
                            >
                              <TableCell className="border-r border-gray-200">{item.produto_nome}</TableCell>
                              <TableCell className="text-right border-r border-gray-200">{item.quantidade}</TableCell>
                              <TableCell className="text-right border-r border-gray-200">{currencyFormatters.brl(item.valor_unitario)}</TableCell>
                              <TableCell className="text-right font-semibold">{currencyFormatters.brl(item.valor_total)}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground">
                              Carregando produtos...
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {/* Mobile: Cards */}
                  <div className="md:hidden space-y-2 p-2">
                    {selectedSale.items && selectedSale.items.length > 0 ? (
                      selectedSale.items.map((item: any) => (
                        <Card key={item.id} className="border-2 border-gray-300">
                          <CardContent className="p-2 space-y-1">
                            <p className="font-medium text-sm">{item.produto_nome}</p>
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Qtd: {item.quantidade}</span>
                              <span>Unit: {currencyFormatters.brl(item.valor_unitario)}</span>
                            </div>
                            <div className="text-right pt-1 border-t border-gray-200">
                              <span className="font-bold text-sm">Total: {currencyFormatters.brl(item.valor_total)}</span>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        Carregando produtos...
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Pagamentos */}
              <div>
                <Label className="text-xs md:text-sm font-semibold mb-2 block">Formas de Pagamento:</Label>
                <div className="border-2 border-gray-300 rounded-lg overflow-hidden">
                  {/* Desktop: Tabela */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b-2 border-gray-300">
                          <TableHead className="font-semibold bg-muted/60 border-r border-gray-200">Forma</TableHead>
                          <TableHead className="font-semibold bg-muted/60 border-r border-gray-200 text-right">Valor</TableHead>
                          {salePayments[selectedSale.id]?.some((p: any) => p.troco > 0) && (
                            <TableHead className="font-semibold bg-muted/60 text-right">Troco</TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salePayments[selectedSale.id] && salePayments[selectedSale.id].length > 0 ? (
                          salePayments[selectedSale.id].map((payment: any, index: number) => (
                            <TableRow 
                              key={payment.id}
                              className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}`}
                            >
                              <TableCell className="capitalize border-r border-gray-200">
                                {payment.forma_pagamento === 'dinheiro' ? 'Dinheiro' : 
                                 payment.forma_pagamento === 'pix' ? 'PIX' :
                                 payment.forma_pagamento === 'debito' ? 'Débito' :
                                 payment.forma_pagamento === 'credito' ? 'Crédito' :
                                 payment.forma_pagamento === 'link_pagamento' ? 'Link de Pagamento' :
                                 payment.forma_pagamento === 'carteira_digital' ? 'Carteira Digital' : payment.forma_pagamento}
                              </TableCell>
                              <TableCell className={`text-right font-semibold ${salePayments[selectedSale.id]?.some((p: any) => p.troco > 0) ? 'border-r border-gray-200' : ''}`}>
                                {currencyFormatters.brl(payment.valor)}
                              </TableCell>
                              {salePayments[selectedSale.id]?.some((p: any) => p.troco > 0) && (
                                <TableCell className="text-right">
                                  {payment.troco > 0 ? currencyFormatters.brl(payment.troco) : '-'}
                                </TableCell>
                              )}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground">
                              Nenhum pagamento encontrado
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {/* Mobile: Cards */}
                  <div className="md:hidden space-y-2 p-2">
                    {salePayments[selectedSale.id] && salePayments[selectedSale.id].length > 0 ? (
                      salePayments[selectedSale.id].map((payment: any) => (
                        <Card key={payment.id} className="border-2 border-gray-300">
                          <CardContent className="p-2 space-y-1">
                            <p className="font-medium text-sm capitalize">
                              {payment.forma_pagamento === 'dinheiro' ? 'Dinheiro' : 
                               payment.forma_pagamento === 'pix' ? 'PIX' :
                               payment.forma_pagamento === 'debito' ? 'Débito' :
                               payment.forma_pagamento === 'credito' ? 'Crédito' :
                               payment.forma_pagamento === 'link_pagamento' ? 'Link de Pagamento' :
                               payment.forma_pagamento === 'carteira_digital' ? 'Carteira Digital' : payment.forma_pagamento}
                            </p>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Valor:</span>
                              <span className="font-bold">{currencyFormatters.brl(payment.valor)}</span>
                            </div>
                            {payment.troco > 0 && (
                              <div className="flex justify-between text-xs pt-1 border-t border-gray-200">
                                <span className="text-muted-foreground">Troco:</span>
                                <span className="font-semibold">{currencyFormatters.brl(payment.troco)}</span>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        Nenhum pagamento encontrado
                      </div>
                    )}
                  </div>
                  {salePayments[selectedSale.id] && salePayments[selectedSale.id].length > 0 && (
                    <div className="p-3 md:p-4 bg-muted/50 border-t-2 border-gray-300">
                      <div className="flex justify-between items-center font-bold text-sm md:text-base">
                        <span>Total Pago:</span>
                        <span className="text-base md:text-lg">
                          {currencyFormatters.brl(
                            salePayments[selectedSale.id].reduce((sum: number, p: any) => sum + Number(p.valor || 0), 0)
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="pt-3 md:pt-4">
            <Button 
              variant="outline" 
              onClick={() => setShowSaleDetails(false)}
              className="w-full sm:w-auto h-9 md:h-10 border-2 border-gray-300"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModernLayout>
  );
}

