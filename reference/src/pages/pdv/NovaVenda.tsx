import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ModernLayout } from '@/components/ModernLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Search, Plus, Minus, Trash2, ShoppingCart, User, X, ChevronDown, ChevronUp,
  CreditCard, DollarSign, QrCode, Printer, Send, Download, FileText, Wrench,
  FileCheck, ArrowRight, MessageCircle, Share2, CheckCircle2, BarChart3
} from 'lucide-react';
import { generateCupomTermica, generateCupomPDF, printTermica, generateOrcamentoPDF, generateOrcamentoHTML, OrcamentoData } from '@/utils/pdfGenerator';
import { APP_PUBLIC_URL } from '@/utils/appUrl';
import { openWhatsApp, formatVendaMessage } from '@/utils/whatsapp';
import { useSales, useSaleItems, usePayments, useCashRegister, useCashMovements } from '@/hooks/usePDV';
import { useQuotes } from '@/hooks/useQuotes';
import { useClientesSupabase as useClientes } from '@/hooks/useClientesSupabase';
import { useOrdensServicoSupabase as useOrdensServico } from '@/hooks/useOrdensServicoSupabase';
import { useItensOS, useConfiguracaoStatus } from '@/hooks/useAssistencia';
import { useProdutosSupabase } from '@/hooks/useProdutosSupabase';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { from } from '@/integrations/db/client';
import { Link } from 'react-router-dom';
import { useCupomConfig } from '@/hooks/useCupomConfig';
import { CartItem, PaymentFormData, PaymentMethod, PAYMENT_METHOD_LABELS, Quote, LIMITES_DESCONTO_PERFIL } from '@/types/pdv';
import { currencyFormatters, dateFormatters } from '@/utils/formatters';
import { buildCashClosingTermicaHtml } from '@/utils/cashClosingTermicaGenerator';
import { getDemoAwareErrorMessage, isDemoSession } from '@/utils/demoMode';
import { useToast } from '@/hooks/use-toast';
import { LoadingButton } from '@/components/LoadingButton';
import { cn } from '@/lib/utils';
import { useWhatsApp } from '@/hooks/useWhatsApp';
import { updatePrintStatus } from '@/utils/printUtils';
import { VoucherPayment } from '@/components/pdv/VoucherPayment';
import { useRefunds } from '@/hooks/useRefunds';
import { usePaymentMethods as usePaymentMethodsHook } from '@/hooks/usePaymentMethods';
import { scheduleOsPosVendaFollowup } from '@/utils/osPosVendaFollowupSchedule';

const PDV_SEARCH_FIELD_KEY = 'primecamp_pdv_search_field';

// Fallback quando a empresa não tem formas de pagamento configuradas (evita venda ficar só em rascunho)
const FALLBACK_PAYMENT_METHODS: { id: string; code: string; name: string; is_active: boolean; accepts_installments: boolean; max_installments: number }[] = [
  { id: '_dinheiro', code: 'dinheiro', name: 'Dinheiro', is_active: true, accepts_installments: false, max_installments: 1 },
  { id: '_pix', code: 'pix', name: 'PIX', is_active: true, accepts_installments: false, max_installments: 1 },
  { id: '_cartao', code: 'cartao_debito', name: 'Cartão (débito/crédito)', is_active: true, accepts_installments: true, max_installments: 12 },
];

export default function NovaVenda() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const { isAdmin, user, profile } = useAuth();
  const { hasPermission } = usePermissions();
  
  // Calcular limite máximo de desconto baseado no perfil
  const limiteDescontoMaximo = useMemo(() => {
    const role = profile?.role || 'member';
    return LIMITES_DESCONTO_PERFIL[role] || LIMITES_DESCONTO_PERFIL.default;
  }, [profile?.role]);
  const isEditing = Boolean(id);

  const { createSale, updateSale, finalizeSale, deleteSale, getSaleById } = useSales();
  const { items, addItem, updateItem, removeItem, isLoading: itemsLoading } = useSaleItems(id || '');
  const { payments, addPayment, confirmPayment, refreshPayments, isLoading: paymentsLoading } = usePayments(id || '');
  const { currentSession: cashSession, openCash, closeCash } = useCashRegister();
  const { movements: cashMovements } = useCashMovements(cashSession?.id || '');
  const { createQuote, convertToSale, markAsSentWhatsApp } = useQuotes();
  const { sendMessage: sendWhatsAppMessage, loading: sendingWhatsApp } = useWhatsApp();
  
  const { produtos, isLoading: produtosLoading } = useProdutosSupabase();
  const { data: cupomConfig } = useCupomConfig();
  
  // Buscar formas de pagamento configuradas
  const { paymentMethods, fetchPaymentMethods } = usePaymentMethodsHook();
  // Se a empresa não tiver formas configuradas, usar fallback para permitir finalizar venda (evita ficar só em rascunho)
  const paymentMethodsForCheckout = paymentMethods?.length ? paymentMethods : FALLBACK_PAYMENT_METHODS;
  
  useEffect(() => {
    fetchPaymentMethods(true, true); // Ativas + taxas (para cálculo de valor líquido no Caixa Geral)
  }, [fetchPaymentMethods]);
  
  // Função de busca de produtos
  const searchProdutos = (term: string, field: 'all' | 'codigo' | 'descricao' | 'referencia' | 'codigo_barras' = 'all') => {
    const trimmed = (term || '').trim();
    // Código e Cod. Barras: mínimo 1 caractere (códigos baixos / leitura de barras)
    const minLen = (field === 'codigo' || field === 'codigo_barras') ? 1 : 2;
    if (!trimmed || trimmed.length < minLen) return [];
    const search = trimmed.toLowerCase();

    let filtered: any[];
    if (field === 'codigo') {
      const termStr = trimmed;
      filtered = produtos.filter(p => {
        const cod = p.codigo?.toString() ?? '';
        return cod === termStr || cod.includes(termStr);
      });
      // Ordenar: exato primeiro, depois códigos que começam com o termo, depois por código numérico (códigos baixos primeiro)
      filtered.sort((a, b) => {
        const codA = a.codigo?.toString() ?? '';
        const codB = b.codigo?.toString() ?? '';
        const exactA = codA === termStr ? 0 : (codA.startsWith(termStr) ? 1 : 2);
        const exactB = codB === termStr ? 0 : (codB.startsWith(termStr) ? 1 : 2);
        if (exactA !== exactB) return exactA - exactB;
        const numA = Number(codA) || 0;
        const numB = Number(codB) || 0;
        if (numA > 0 && numB > 0) return numA - numB;
        return codA.localeCompare(codB, undefined, { numeric: true });
      });
      return filtered;
    } else if (field === 'codigo_barras') {
      const termStr = trimmed;
      filtered = produtos.filter(p => {
        const barras = (p.codigo_barras ?? '').toString().trim();
        return barras === termStr || barras.includes(termStr);
      });
      // Exato primeiro para leitor de código de barras
      filtered.sort((a, b) => {
        const barrasA = (a.codigo_barras ?? '').toString().trim();
        const barrasB = (b.codigo_barras ?? '').toString().trim();
        const exactA = barrasA === termStr ? 0 : 1;
        const exactB = barrasB === termStr ? 0 : 1;
        return exactA - exactB;
      });
      return filtered;
    } else if (field === 'descricao') {
      filtered = produtos.filter(p => p.descricao?.toLowerCase().includes(search));
    } else if (field === 'referencia') {
      filtered = produtos.filter(p => p.referencia?.toLowerCase().includes(search));
    } else {
      filtered = produtos.filter(p =>
        p.descricao?.toLowerCase().includes(search) ||
        p.codigo?.toString().includes(trimmed) ||
        p.codigo_barras?.includes(trimmed) ||
        p.referencia?.toLowerCase().includes(search)
      );
      // Na busca "all", quando o termo parece número, priorizar match por código (exato / começa com)
      if (/^\d+$/.test(trimmed)) {
        filtered.sort((a, b) => {
          const codA = a.codigo?.toString() ?? '';
          const codB = b.codigo?.toString() ?? '';
          const exactA = codA === trimmed ? 0 : (codA.startsWith(trimmed) ? 1 : 2);
          const exactB = codB === trimmed ? 0 : (codB.startsWith(trimmed) ? 1 : 2);
          if (exactA !== exactB) return exactA - exactB;
          const numA = Number(codA) || 0;
          const numB = Number(codB) || 0;
          if (numA > 0 && numB > 0) return numA - numB;
          return codA.localeCompare(codB, undefined, { numeric: true });
        });
      }
    }
    return filtered;
  };
  const { clientes, searchClientes, searchClientesAsync, createCliente } = useClientes();
  const { ordens, getOSById, updateStatus: updateOSStatus } = useOrdensServico();
  const { getConfigByStatus } = useConfiguracaoStatus();
  
  // Buscar todos os itens do localStorage
  // Removido: não precisa mais carregar itens do localStorage
  // Os itens de OS agora são carregados diretamente do Supabase quando necessário

  // Estados
  const [sale, setSale] = useState<any>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productSearchField, setProductSearchField] = useState<'all' | 'codigo' | 'descricao' | 'referencia' | 'codigo_barras'>(() => {
    try {
      const saved = localStorage.getItem(PDV_SEARCH_FIELD_KEY);
      if (saved === 'codigo' || saved === 'descricao' || saved === 'referencia' || saved === 'all' || saved === 'codigo_barras') return saved;
    } catch { /* ignore */ }
    return 'codigo';
  });
  const [productResults, setProductResults] = useState<any[]>([]);
  const [showProductSearch, setShowProductSearch] = useState(false);
  
  const [clienteSearch, setClienteSearch] = useState('');
  const [clienteSearchField, setClienteSearchField] = useState<'all' | 'nome' | 'cpf_cnpj' | 'telefone'>('all');
  const [clienteResults, setClienteResults] = useState<any[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<any>(null);
  const [showClienteSearch, setShowClienteSearch] = useState(false);
  const [clienteExpanded, setClienteExpanded] = useState(false);
  
  const [observacoes, setObservacoes] = useState('');
  const [vendedorId, setVendedorId] = useState('');
  
  const [showCheckout, setShowCheckout] = useState(false);
  const [showVoucherPayment, setShowVoucherPayment] = useState(false);
  const [checkoutPayment, setCheckoutPayment] = useState<PaymentFormData>({
    forma_pagamento: 'dinheiro',
    valor: undefined,
    troco: 0,
  });
  
  const [descontoTotal, setDescontoTotal] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [showEmitirCupomDialog, setShowEmitirCupomDialog] = useState(false);
  const [shouldEmitCupom, setShouldEmitCupom] = useState(true);
  const [pendingSaleForCupom, setPendingSaleForCupom] = useState<any>(null);
  
  // Estados para modal de faturar OS
  const [showFaturarOSModal, setShowFaturarOSModal] = useState(false);
  const [osList, setOsList] = useState<any[]>([]);
  const [isLoadingOS, setIsLoadingOS] = useState(false);
  const [osSearch, setOsSearch] = useState('');

  // Estados para orçamento
  const [showOrcamentoModal, setShowOrcamentoModal] = useState(false);
  const [orcamentoGerado, setOrcamentoGerado] = useState<Quote | null>(null);
  const [isGeneratingOrcamento, setIsGeneratingOrcamento] = useState(false);

  // Estados para modais Abrir/Fechar Caixa (barra inferior PDV)
  const [showOpenCashDialog, setShowOpenCashDialog] = useState(false);
  const [showCloseCashDialog, setShowCloseCashDialog] = useState(false);
  const [cashValorInicial, setCashValorInicial] = useState('');
  const [cashValorFinal, setCashValorFinal] = useState('');
  const [cashDivergencia, setCashDivergencia] = useState('');
  const [cashJustificativa, setCashJustificativa] = useState('');
  const [isProcessingCash, setIsProcessingCash] = useState(false);
  const [closeDialogValorEsperado, setCloseDialogValorEsperado] = useState(0);
  const [closeDialogLoadingValor, setCloseDialogLoadingValor] = useState(false);
  const [closeDialogPagamentosPorForma, setCloseDialogPagamentosPorForma] = useState<Record<string, number>>({});
  const [closeDialogTotalVendas, setCloseDialogTotalVendas] = useState(0);
  const [closeDialogSales, setCloseDialogSales] = useState<any[]>([]);
  const [closeDialogSalePayments, setCloseDialogSalePayments] = useState<Record<string, any[]>>({});
  const [closeDialogTotalEntradasPagamentos, setCloseDialogTotalEntradasPagamentos] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const addingPaymentRef = useRef(false);
  /** Callback executado ao fechar a janela de impressão do cupom (após finalizar venda) */
  const onCupomPrintClosedRef = useRef<(() => void) | null>(null);

  // Carregar venda se estiver editando
  useEffect(() => {
    if (isEditing && id) {
      loadSale();
    }
  }, [isEditing, id]);

  // Carregar valor esperado e conferência por forma de pagamento ao abrir o modal de Fechar Caixa
  useEffect(() => {
    if (!showCloseCashDialog || !cashSession?.id) return;
    const loadValorEsperado = async () => {
      setCloseDialogLoadingValor(true);
      try {
        const { data: salesData } = await from('sales')
          .select('id, numero, total, cliente_nome, created_at, ordem_servico_id')
          .eq('cash_register_session_id', cashSession.id)
          .eq('status', 'paid')
          .execute();
        const sales = salesData || [];
        const totalVendas = sales.reduce((s, r) => s + Number(r.total || 0), 0);
        setCloseDialogTotalVendas(totalVendas);
        setCloseDialogSales(sales);
        const saleIds = sales.map((r: any) => r.id).filter(Boolean);
        const salesTotalById: Record<string, number> = {};
        sales.forEach((r: any) => { salesTotalById[r.id] = Number(r.total || 0); });
        const getValorAplicado = (p: any) => {
          const valor = Number(p.valor || 0);
          const troco = Number(p.troco || 0);
          const saleTotal = salesTotalById[p.sale_id] ?? 0;
          if ((p.forma_pagamento || '').toLowerCase() === 'dinheiro' && troco > 0 && valor > saleTotal) return valor - troco;
          return valor;
        };
        const pagamentosPorForma: Record<string, number> = {};
        let paymentsData: any[] | null = null;
        const paymentsBySale: Record<string, any[]> = {};
        if (saleIds.length > 0) {
          const res = await from('payments')
            .select('sale_id, forma_pagamento, valor, troco')
            .in('sale_id', saleIds)
            .eq('status', 'confirmed')
            .execute();
          paymentsData = res.data || null;
          (paymentsData || []).forEach((p: any) => {
            const sid = p.sale_id;
            if (!paymentsBySale[sid]) paymentsBySale[sid] = [];
            paymentsBySale[sid].push(p);
            const forma = (p.forma_pagamento || '').toLowerCase();
            if (forma === 'adiantamento os') return;
            const f = forma || 'outro';
            const valor = getValorAplicado(p);
            pagamentosPorForma[f] = (pagamentosPorForma[f] || 0) + valor;
          });
        }
        setCloseDialogSalePayments(paymentsBySale);
        setCloseDialogPagamentosPorForma(pagamentosPorForma);
        const totalSuprimentos = (cashMovements || [])
          .filter((m: any) => m.tipo === 'suprimento')
          .reduce((s: number, m: any) => s + Number(m.valor || 0), 0);
        const totalSaidas = (cashMovements || [])
          .filter((m: any) => m.tipo === 'sangria')
          .reduce((s: number, m: any) => s + Number(m.valor || 0), 0);
        const valorInicial = Number(cashSession.valor_inicial) || 0;
        // Valor esperado: só o que entrou de fato (exclui Adiantamento OS — já entrou quando o adiantamento foi registrado)
        const totalEntradasVendas = (paymentsData || []).reduce((s: number, p: any) => {
          if ((p.forma_pagamento || '').toLowerCase() === 'adiantamento os') return s;
          return s + getValorAplicado(p);
        }, 0);
        setCloseDialogTotalEntradasPagamentos(totalEntradasVendas);
        setCloseDialogValorEsperado(valorInicial + totalEntradasVendas + totalSuprimentos - totalSaidas);
      } finally {
        setCloseDialogLoadingValor(false);
      }
    };
    loadValorEsperado();
  }, [showCloseCashDialog, cashSession?.id, cashSession?.valor_inicial, cashMovements]);

  const handleOpenCashPDV = async () => {
    if (!cashValorInicial || parseFloat(cashValorInicial) < 0) {
      toast({ title: 'Valor inicial inválido', variant: 'destructive' });
      return;
    }
    try {
      setIsProcessingCash(true);
      await openCash({
        valor_inicial: parseFloat(cashValorInicial),
        operador_id: user?.id || '',
      });
      toast({ title: 'Caixa aberto com sucesso!' });
      setShowOpenCashDialog(false);
      setCashValorInicial('');
    } catch (error: any) {
      toast({ title: isDemoSession() ? 'Não é possível na conta demo' : 'Erro ao abrir caixa', description: getDemoAwareErrorMessage(error, 'Tente novamente'), variant: 'destructive' });
    } finally {
      setIsProcessingCash(false);
    }
  };

  const handleCloseCashPDV = async () => {
    if (!cashValorFinal || parseFloat(cashValorFinal) < 0) {
      toast({ title: 'Valor final inválido', variant: 'destructive' });
      return;
    }
    if (!cashSession?.id) return;
    try {
      setIsProcessingCash(true);
      const valorFinalNum = parseFloat(cashValorFinal);
      const divergenciaNum = cashDivergencia ? parseFloat(cashDivergencia) : undefined;
      await closeCash(cashSession.id, valorFinalNum, divergenciaNum, cashJustificativa || undefined);
      toast({ title: 'Caixa fechado com sucesso!' });
      setShowCloseCashDialog(false);
      setCashValorFinal('');
      setCashDivergencia('');
      setCashJustificativa('');
    } catch (error: any) {
      toast({ title: isDemoSession() ? 'Não é possível na conta demo' : 'Erro ao fechar caixa', description: getDemoAwareErrorMessage(error, 'Tente novamente'), variant: 'destructive' });
    } finally {
      setIsProcessingCash(false);
    }
  };

  const handlePrintFechamentoTermicoPDV = async () => {
    if (!cashSession) return;
    try {
      const salesTotalById: Record<string, number> = {};
      closeDialogSales.forEach((r: any) => { salesTotalById[r.id] = Number(r.total || 0); });
      const getValorAplicado = (p: any) => {
        const valor = Number(p.valor || 0);
        const troco = Number(p.troco || 0);
        const saleTotal = salesTotalById[p.sale_id] ?? 0;
        if ((p.forma_pagamento || '').toLowerCase() === 'dinheiro' && troco > 0 && valor > saleTotal) return valor - troco;
        return valor;
      };
      const vendasLinhas = [...closeDialogSales]
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
        .map((sale: any) => {
          const plist = closeDialogSalePayments[sale.id] || [];
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
            total: Number(sale.total || 0),
            pagamentos: pags,
          };
        });
      const movimentosLinhas = (cashMovements || []).map((m: any) => ({
        tipo: m.tipo as 'sangria' | 'suprimento',
        valor: Number(m.valor),
        motivo: m.motivo || undefined,
      }));
      const valorAbertura = Number(cashSession.valor_inicial) || 0;
      const totalDinheiroVendas = closeDialogPagamentosPorForma['dinheiro'] || 0;
      const totaisLinhas = Object.entries(closeDialogPagamentosPorForma)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([forma, valor]) => {
          const valorConf = forma === 'dinheiro' ? valorAbertura + totalDinheiroVendas : valor;
          let detalhe: string | undefined;
          if (forma === 'dinheiro' && valorAbertura > 0) {
            detalhe = `Abertura ${currencyFormatters.brl(valorAbertura)} + vendas ${currencyFormatters.brl(totalDinheiroVendas)}`;
          }
          return { forma, valor_conferencia: valorConf, detalhe_linha: detalhe };
        });
      const openedAt = (cashSession as { opened_at?: string }).opened_at;
      const html = await buildCashClosingTermicaHtml({
        operador_nome: (cashSession as { operador_nome?: string }).operador_nome || user?.email || undefined,
        valor_abertura: valorAbertura,
        abertura_em: openedAt
          ? `${dateFormatters.short(openedAt)} ${new Date(openedAt).toLocaleTimeString('pt-BR')}`
          : '—',
        totais_por_forma: totaisLinhas,
        total_entradas_vendas: closeDialogTotalEntradasPagamentos,
        valor_esperado_caixa: closeDialogValorEsperado,
        vendas: vendasLinhas,
        movimentos: movimentosLinhas,
      });
      printTermica(html);
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro ao gerar impressão', variant: 'destructive' });
    }
  };

  const resolveClienteFromOS = useCallback(async (clienteId?: string | null) => {
    if (!clienteId) return null;

    const clienteLocal = clientes.find(c => c.id === clienteId);
    if (clienteLocal?.cpf_cnpj || clienteLocal?.telefone || clienteLocal?.whatsapp) {
      return clienteLocal;
    }

    try {
      const { data: clienteDb, error } = await from('clientes')
        .select('id, nome, cpf_cnpj, telefone, whatsapp')
        .eq('id', clienteId)
        .single();

      if (error) {
        console.warn('Erro ao buscar cliente da OS no banco:', error);
      }

      return clienteDb || clienteLocal || null;
    } catch (error) {
      console.warn('Erro ao resolver cliente da OS:', error);
      return clienteLocal || null;
    }
  }, [clientes]);

  // Função para importar OS automaticamente
  const handleImportarOS = useCallback(async (osId: string) => {
    try {
      console.log('[NovaVenda] Importando OS:', osId);
      
      // Buscar OS do Supabase
      const os = getOSById(osId);
      if (!os) {
        toast({
          title: 'OS não encontrada',
          description: 'A ordem de serviço não foi encontrada.',
          variant: 'destructive',
        });
        return;
      }

      // Buscar itens da OS do banco
      const { data: itensOS, error: itensError } = await from('os_items')
        .select('*')
        .eq('ordem_servico_id', osId)
        .in('tipo', ['peca', 'produto'])
        .execute();

      if (itensError) {
        console.error('Erro ao buscar itens da OS:', itensError);
        toast({
          title: 'Erro',
          description: 'Erro ao buscar itens da OS.',
          variant: 'destructive',
        });
        return;
      }

      if (!itensOS || itensOS.length === 0) {
        toast({
          title: 'OS sem produtos',
          description: 'Esta OS não possui produtos para faturar.',
          variant: 'destructive',
        });
        return;
      }

      // Buscar cliente completo para não depender da lista paginada carregada na tela
      const cliente = await resolveClienteFromOS(os.cliente_id);

      // Criar venda vinculada à OS
      const novaVenda = await createSale({
        cliente_id: os.cliente_id || null,
        cliente_nome: os.cliente_nome || cliente?.nome || 'Cliente não informado',
        cliente_cpf_cnpj: cliente?.cpf_cnpj || null,
        cliente_telefone: os.telefone_contato || cliente?.telefone || null,
        ordem_servico_id: os.id,
        sale_origin: 'OS',
        technician_id: os.tecnico_id || null,
        is_draft: true,
        observacoes: `Faturamento da OS #${os.numero}`,
      });

      // Adicionar itens da OS ao carrinho
      for (const itemOS of itensOS) {
        // Buscar produto se tiver produto_id (para código no cupom)
        let produto = null;
        if (itemOS.produto_id) {
          produto = produtos.find(p => p.id === itemOS.produto_id);
        }

        await addItem({
          produto_id: itemOS.produto_id || undefined,
          produto_nome: itemOS.descricao,
          produto_codigo: produto?.codigo != null ? String(produto.codigo) : undefined,
          produto_codigo_barras: produto?.codigo_barras || undefined,
          produto_tipo: itemOS.tipo === 'peca' ? 'produto' : 'produto',
          quantidade: Number(itemOS.quantidade) || 1,
          valor_unitario: Number(itemOS.valor_unitario) || 0,
          desconto: Number(itemOS.desconto || 0),
          observacao: `OS #${os.numero}`,
        }, novaVenda.id);
      }

      toast({
        title: 'OS importada com sucesso!',
        description: `OS #${os.numero} foi importada para o PDV.`,
      });

      // Navegar para editar a venda
      navigate(`/pdv/venda/${novaVenda.id}/editar`);
    } catch (error: any) {
      console.error('Erro ao importar OS:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao importar ordem de serviço.',
        variant: 'destructive',
      });
    }
  }, [getOSById, produtos, createSale, addItem, navigate, toast, resolveClienteFromOS]);

  // Importar OS do localStorage se houver
  useEffect(() => {
    if (!isEditing && !id) {
      const osIdParaImportar = localStorage.getItem('pdv_import_os_id');
      const osNumeroParaImportar = localStorage.getItem('pdv_import_os_numero');
      
      if (osIdParaImportar) {
        console.log('[NovaVenda] Importando OS:', osIdParaImportar, 'Número:', osNumeroParaImportar);
        handleImportarOS(osIdParaImportar);
        // Limpar após importar
        localStorage.removeItem('pdv_import_os_id');
        localStorage.removeItem('pdv_import_os_numero');
      }
    }
  }, [isEditing, id, handleImportarOS]);

  // Função auxiliar para normalizar tipo do produto
  const normalizeProdutoTipo = (tipo: any): 'produto' | 'servico' | undefined => {
    if (!tipo) return 'produto';
    const tipoStr = String(tipo).toLowerCase();
    if (tipoStr === 'servico' || tipoStr === 'serviço') return 'servico';
    if (tipoStr === 'produto' || tipoStr === 'peca' || tipoStr === 'peça') return 'produto';
    return 'produto';
  };

  // Carregar itens quando a venda for carregada
  useEffect(() => {
    if (sale && items) {
      const loadItems = async () => {
        console.log('=== CARREGANDO ITENS DA VENDA ===');
        console.log(`Venda ID: ${sale.id}`);
        console.log(`Total de itens no banco: ${items.length}`);
        
        // Função auxiliar para identificar itens duplicados
        const getItemKey = (item: any) => {
          return `${item.produto_id || 'no-id'}_${item.produto_nome}_${item.produto_codigo || 'no-code'}_${item.produto_codigo_barras || 'no-barcode'}`;
        };
        
        // Remover duplicados baseado em chave única
        const uniqueItems = items.reduce((acc: any[], item) => {
          const key = getItemKey(item);
          const existing = acc.find(i => getItemKey(i) === key);
          
          if (!existing) {
            acc.push(item);
          } else {
            // Se já existe, verificar se este é mais recente ou tem mais informações
            if (item.id > existing.id || (item.produto_id && !existing.produto_id)) {
              const index = acc.indexOf(existing);
              acc[index] = item;
            }
          }
          return acc;
        }, []);
        
        if (uniqueItems.length !== items.length) {
          console.warn(`⚠️ DUPLICAÇÃO DETECTADA: ${items.length} itens no banco, ${uniqueItems.length} únicos`);
          // Remover duplicados do banco
          const duplicates = items.filter(item => {
            const key = getItemKey(item);
            const firstIndex = items.findIndex(i => getItemKey(i) === key);
            return items.indexOf(item) !== firstIndex;
          });
          
          console.log(`Removendo ${duplicates.length} itens duplicados do banco...`);
          for (const dup of duplicates) {
            try {
              await removeItem(dup.id);
            } catch (error) {
              console.error(`Erro ao remover item duplicado ${dup.id}:`, error);
            }
          }
        }
        
        const cartItems = uniqueItems.map(item => {
          const quantidade = Number(item.quantidade) || 1;
          const valorUnitario = Number(item.valor_unitario) || 0;
          const desconto = Number(item.desconto || 0);
          const total = (valorUnitario * quantidade) - desconto;
          
          // Calcular percentual de desconto baseado no valor salvo
          const valorBruto = valorUnitario * quantidade;
          const descontoPercentual = valorBruto > 0 ? (desconto / valorBruto) * 100 : 0;
          
          console.log(`Item: ${item.produto_nome} (ID: ${item.id})`);
          console.log(`  Quantidade: ${quantidade}`);
          console.log(`  Valor Unitário: ${currencyFormatters.brl(valorUnitario)}`);
          console.log(`  Desconto: ${currencyFormatters.brl(desconto)} (${descontoPercentual.toFixed(1)}%)`);
          console.log(`  Total: ${currencyFormatters.brl(total)}`);
          
          return {
            produto_id: item.produto_id || undefined,
            produto_nome: item.produto_nome,
            produto_codigo: item.produto_codigo || undefined,
            produto_codigo_barras: item.produto_codigo_barras || undefined,
            produto_tipo: normalizeProdutoTipo(item.produto_tipo),
            quantidade: quantidade,
            valor_unitario: valorUnitario,
            desconto: desconto,
            desconto_percentual: Number(descontoPercentual.toFixed(1)),
            observacao: item.observacao || undefined,
            garantia_dias: item.garantia_dias || undefined,
          };
        });
        
        const subtotalCalculado = cartItems.reduce((sum, item) => 
          sum + (item.valor_unitario * item.quantidade), 0
        );
        console.log(`Subtotal calculado: ${currencyFormatters.brl(subtotalCalculado)}`);
        console.log(`Subtotal da venda: ${currencyFormatters.brl(sale.subtotal || 0)}`);
        
        setCart(cartItems);
        
        if (sale.cliente_id) {
          const cliente = clientes.find(c => c.id === sale.cliente_id);
          if (cliente) setSelectedCliente(cliente);
        }
        
        setObservacoes(sale.observacoes || '');
        // Faturamento de OS: não carregar desconto extra (total já vem dos itens)
        setDescontoTotal(sale.ordem_servico_id ? 0 : Number(sale.desconto_total || 0));
      };
      
      loadItems();
    }
  }, [sale, items, clientes, removeItem]);

  const loadSale = async () => {
    if (!id) return;
    const loadedSale = await getSaleById(id);
    if (loadedSale) {
      setSale(loadedSale);

      // Venda faturada de OS: garantir que pagamentos (ex.: Adiantamento OS) sejam recarregados
      if (loadedSale.ordem_servico_id) {
        refreshPayments();

        // Sincronizar adiantamento da OS quando a venda foi criada sem ele (ex.: vendas antigas ou race)
        // Consultar payments direto para evitar race: getSaleById pode ter sido chamado antes do insert do faturamento
        const { data: paymentsAtual } = await from('payments')
          .select('id, forma_pagamento, valor, status')
          .eq('sale_id', id)
          .execute();
        const totalPagoNaVenda = Number(loadedSale.total_pago ?? 0);
        const jaTemAdiantamento = (paymentsAtual || []).some(
          (p: { forma_pagamento?: string; status?: string }) =>
            p.forma_pagamento === 'Adiantamento OS' && p.status === 'confirmed'
        );
        const totalJaEmPayments = (paymentsAtual || [])
          .filter((p: { status?: string }) => p.status === 'confirmed')
          .reduce((s: number, p: { valor?: number }) => s + Number(p.valor || 0), 0);
        if (totalPagoNaVenda === 0 && !jaTemAdiantamento && totalJaEmPayments === 0) {
          try {
            const { data: pagamentosOS } = await from('os_pagamentos')
              .select('valor, cancelled_at')
              .eq('ordem_servico_id', loadedSale.ordem_servico_id)
              .execute();
            const totalPagoOS = (pagamentosOS || [])
              .filter((p: { cancelled_at?: string | null }) => !p.cancelled_at)
              .reduce((s: number, p: { valor?: number }) => s + Number(p.valor || 0), 0);
            const totalVenda = Number(loadedSale.total ?? 0);
            const valorCreditar = totalPagoOS > 0 && totalVenda > 0 ? Math.min(totalPagoOS, totalVenda) : 0;

            if (valorCreditar > 0) {
              const now = new Date().toISOString();
              await from('payments')
                .insert({
                  sale_id: id,
                  forma_pagamento: 'Adiantamento OS',
                  valor: valorCreditar,
                  troco: 0,
                  parcelas: 1,
                  status: 'confirmed',
                  confirmed_at: now,
                  confirmed_by: user?.id || null,
                })
                .execute();
              const novoStatus = valorCreditar >= totalVenda ? 'paid' : 'partial';
              await from('sales')
                .update({ total_pago: valorCreditar, status: novoStatus })
                .eq('id', id)
                .execute();
              const updated = await getSaleById(id);
              if (updated) setSale(updated);
              refreshPayments();
            }
          } catch (err) {
            console.error('Erro ao sincronizar adiantamento OS na venda:', err);
          }
        }
      }
      
      // Se a venda foi cancelada, redirecionar para a lista
      if (loadedSale.status === 'canceled') {
        toast({
          title: 'Venda cancelada',
          description: 'Esta venda foi cancelada e não pode ser editada.',
          variant: 'destructive',
        });
        navigate('/pdv/vendas');
        return;
      }
    }
  };

  // Carregar OSs finalizadas com produtos para faturar
  const loadOSParaFaturar = async () => {
    setIsLoadingOS(true);
    try {
      console.log('Carregando OSs para faturar...');
      
      // Buscar OSs finalizadas
      const ordensFromStorage = ordens.filter(os => os.status === 'finalizada');
      console.log(`Encontradas ${ordensFromStorage.length} OSs finalizadas`);

      // Verificar quais OSs já foram faturadas (venda com itens de faturamento, não só adiantamento)
      let osFaturadas = new Set<string>();
      try {
        const { data: vendasComOS } = await from('sales')
          .select('id, ordem_servico_id')
          .not('ordem_servico_id', 'is', null)
          .execute();
        if (vendasComOS && vendasComOS.length > 0) {
          const saleIds = vendasComOS.map((v: any) => v.id).filter(Boolean);
          const { data: itensVendas } = await from('sale_items')
            .select('sale_id, produto_nome')
            .in('sale_id', saleIds)
            .execute();
          const itensPorSale = (itensVendas || []).reduce((acc: Record<string, { produto_nome: string }[]>, row: any) => {
            if (!acc[row.sale_id]) acc[row.sale_id] = [];
            acc[row.sale_id].push({ produto_nome: row.produto_nome || '' });
            return acc;
          }, {});
          vendasComOS.forEach((v: any) => {
            const itens = itensPorSale[v.id] || [];
            const soPagamento = itens.length === 1 && /^PAGAMENTO OS #\d+ - (ADIANTAMENTO|PAGAMENTO)$/i.test(itens[0].produto_nome || '');
            if (!soPagamento) {
              osFaturadas.add(v.ordem_servico_id);
            }
          });
        }
      } catch (error) {
        console.warn('Não foi possível verificar OSs faturadas:', error);
      }

      // Para cada OS, buscar TODOS os seus itens do banco
      const ordensComProdutos = await Promise.all(
        ordensFromStorage
          .filter(os => {
            // Verificar se já foi faturada
            if (osFaturadas.has(os.id)) {
              console.log(`OS #${os.numero} já foi faturada, ignorando...`);
              return false;
            }
            return true;
          })
          .map(async (os) => {
            // Buscar TODOS os itens da OS do banco (sem filtrar por tipo; limite alto)
            const { data: itens, error: itensError } = await from('os_items')
              .select('*')
              .eq('ordem_servico_id', os.id)
              .order('id', { ascending: true })
              .limit(500)
              .execute();
            
            if (itensError) {
              console.error(`Erro ao buscar itens da OS #${os.numero}:`, itensError);
              return { ...os, itens: [] };
            }
            
            console.log(`OS #${os.numero}: ${itens?.length || 0} itens encontrados`);
            return { ...os, itens: itens || [] };
          })
      );

      // Filtrar apenas OSs que tenham itens
      const ordensComProdutosFiltradas = ordensComProdutos.filter(os => {
        const itens = os.itens || [];
        const temItens = itens.length > 0;
        if (!temItens) {
          console.log(`OS #${os.numero} não tem itens, ignorando...`);
        }
        return temItens;
      });

      console.log(`Total de OSs com produtos para faturar: ${ordensComProdutosFiltradas.length}`);
      setOsList(ordensComProdutosFiltradas);
    } catch (error: any) {
      console.error('Erro ao carregar OSs:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao carregar ordens de serviço.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingOS(false);
    }
  };

  // Abrir modal de faturar OS
  const handleOpenFaturarOSModal = () => {
    setShowFaturarOSModal(true);
    loadOSParaFaturar();
  };

  // Faturar OS selecionada
  const handleFaturarOS = async (os: any) => {
    try {
      setIsLoadingOS(true);

      // Buscar TODOS os itens da OS do banco (limite alto para não depender de default da API)
      console.log(`Buscando todos os itens da OS #${os.numero} do banco...`);
      const { data: itensOS, error: itensError } = await from('os_items')
        .select('*')
        .eq('ordem_servico_id', os.id)
        .order('id', { ascending: true })
        .limit(500)
        .execute();

      if (itensError) {
        console.error('Erro ao buscar itens da OS:', itensError);
        toast({
          title: 'Erro',
          description: 'Erro ao buscar itens da OS.',
          variant: 'destructive',
        });
        return;
      }
      
      console.log(`Encontrados ${itensOS?.length || 0} itens para a OS #${os.numero}`);

      if (!itensOS || itensOS.length === 0) {
        toast({
          title: 'OS sem itens',
          description: 'Esta OS não possui itens para faturar.',
          variant: 'destructive',
        });
        return;
      }

      // Buscar cliente completo para não depender da lista paginada carregada na tela
      const cliente = await resolveClienteFromOS(os.cliente_id);

      // Validar technician_id antes de passar (deve ser UUID válido)
      // Se não for válido, passa null para evitar erro de foreign key
      const tecnicoId = os.tecnico_id && isValidUUID(os.tecnico_id) ? os.tecnico_id : null;

      // Criar venda vinculada à OS
      const novaVenda = await createSale({
        cliente_id: os.cliente_id || null,
        cliente_nome: os.cliente_nome || cliente?.nome || 'Cliente não informado',
        cliente_cpf_cnpj: cliente?.cpf_cnpj || null,
        cliente_telefone: os.telefone_contato || cliente?.telefone || null,
        ordem_servico_id: os.id,
        sale_origin: 'OS',
        technician_id: tecnicoId,
        is_draft: true,
        observacoes: `Faturamento da OS #${os.numero}`,
      });

      // Adicionar produtos da OS ao carrinho
      console.log('=== FATURAR OS - DETALHES DOS ITENS ===');
      
      // Primeiro, verificar se já existem itens na venda (para evitar duplicação)
      const { data: existingItems } = await from('sale_items')
        .select('*')
        .eq('sale_id', novaVenda.id)
        .execute();
      
      console.log(`Itens já existentes na venda: ${existingItems?.length || 0}`);
      
      // Função auxiliar para verificar se item já existe
      const itemExists = (itemOS: any, existing: any[]): boolean => {
        return existing.some(existingItem => {
          // Comparar por produto_id se ambos tiverem
          if (itemOS.produto_id && existingItem.produto_id) {
            return itemOS.produto_id === existingItem.produto_id;
          }
          // Comparar por nome
          return existingItem.produto_nome === itemOS.descricao;
        });
      };
      
      let itemsAdded = 0;
      let itemsSkipped = 0;
      
      for (const itemOS of itensOS) {
        // Verificar se item já existe antes de adicionar
        if (existingItems && itemExists(itemOS, existingItems)) {
          console.log(`⚠️ Item já existe, pulando: ${itemOS.descricao}`);
          itemsSkipped++;
          continue;
        }
        
        const quantidade = Number(itemOS.quantidade) || 1;
        const valorUnitario = Number(itemOS.valor_unitario) || 0;
        const desconto = Number(itemOS.desconto || 0);
        const produto = itemOS.produto_id ? produtos.find((p: any) => p.id === itemOS.produto_id) : null;
        
        console.log(`Adicionando item: ${itemOS.descricao}`);
        console.log(`  Quantidade: ${quantidade}`);
        console.log(`  Valor Unitário: ${currencyFormatters.brl(valorUnitario)}`);
        console.log(`  Desconto: ${currencyFormatters.brl(desconto)}`);
        console.log(`  Total: ${currencyFormatters.brl((valorUnitario * quantidade) - desconto)}`);
        
        try {
          await addItem({
            produto_id: itemOS.produto_id || undefined,
            produto_nome: itemOS.descricao,
            produto_codigo: produto?.codigo != null ? String(produto.codigo) : undefined,
            produto_codigo_barras: produto?.codigo_barras || undefined,
            // Faturamento OS: enviar como servico para a API não validar estoque (itens já saíram na OS)
            produto_tipo: 'servico',
            quantidade: quantidade,
            valor_unitario: valorUnitario,
            desconto: desconto,
            observacao: `OS #${os.numero}`,
          }, novaVenda.id);
          itemsAdded++;
          
          // Atualizar lista de itens existentes para próxima iteração
          if (existingItems) {
            existingItems.push({
              produto_id: itemOS.produto_id || null,
              produto_nome: itemOS.descricao,
            } as any);
          }
        } catch (error: any) {
          const msg = error?.error || error?.message || (typeof error === 'string' ? error : 'Erro ao adicionar');
          console.error(`Erro ao adicionar item ${itemOS.descricao}:`, error);
          toast({
            title: 'Item não adicionado',
            description: `${itemOS.descricao}: ${msg}`,
            variant: 'destructive',
          });
        }
      }
      
      console.log(`=== RESUMO: ${itemsAdded} adicionados, ${itemsSkipped} pulados (já existiam) ===`);
      const failedCount = (itensOS?.length || 0) - itemsAdded - itemsSkipped;
      if (failedCount > 0) {
        toast({
          title: 'Atenção',
          description: `${failedCount} item(ns) da OS não puderam ser adicionados. Verifique o console.`,
          variant: 'destructive',
        });
      }

      // Total já pago na OS (adiantamentos no financeiro) — descontar na venda de faturamento
      const { data: pagamentosOS } = await from('os_pagamentos')
        .select('valor, cancelled_at')
        .eq('ordem_servico_id', os.id)
        .execute();
      const totalPagoOS = (pagamentosOS || [])
        .filter((p: { cancelled_at?: string | null }) => !p.cancelled_at)
        .reduce((s: number, p: { valor: number }) => s + Number(p.valor || 0), 0);

      if (totalPagoOS > 0) {
        const { data: saleAtual } = await from('sales')
          .select('total')
          .eq('id', novaVenda.id)
          .single();
        const totalVenda = Number((saleAtual as any)?.total ?? 0);
        const valorCreditar = Math.min(totalPagoOS, totalVenda);

        if (valorCreditar > 0) {
          // Evitar duplicar: só inserir se ainda não existir pagamento "Adiantamento OS" para esta venda
          const { data: pagamentosExistentes } = await from('payments')
            .select('id')
            .eq('sale_id', novaVenda.id)
            .eq('forma_pagamento', 'Adiantamento OS')
            .eq('status', 'confirmed')
            .execute();
          if (!pagamentosExistentes?.length) {
            const now = new Date().toISOString();
            await from('payments')
              .insert({
                sale_id: novaVenda.id,
                forma_pagamento: 'Adiantamento OS',
                valor: valorCreditar,
                valor_parcela: valorCreditar,
                troco: 0,
                parcelas: 1,
                status: 'confirmed',
                confirmed_at: now,
                confirmed_by: user?.id || null,
              })
              .execute();

            const novoStatus = valorCreditar >= totalVenda ? 'paid' : 'partial';
            await from('sales')
              .update({ total_pago: valorCreditar, status: novoStatus })
              .eq('id', novaVenda.id)
              .execute();
          }

          // Vincular adiantamentos (sem venda) a esta venda de faturamento
          await from('os_pagamentos')
            .update({ sale_id: novaVenda.id })
            .eq('ordem_servico_id', os.id)
            .is('sale_id', null)
            .execute();
        }
      }

      // A OS será marcada como faturada automaticamente quando a venda for finalizada
      // através da função fatura_os_from_sale no trigger

      toast({
        title: 'OS faturada com sucesso!',
        description: `OS #${os.numero} foi vinculada à venda #${novaVenda.numero}`,
      });

      setShowFaturarOSModal(false);
      navigate(`/pdv/venda/${novaVenda.id}/editar`);
    } catch (error: any) {
      console.error('Erro ao faturar OS:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao faturar ordem de serviço.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingOS(false);
    }
  };

  // Buscar produtos (mínimo 1 caractere quando filtro é Código ou Cod. Barras, senão 2; exibir até 25)
  useEffect(() => {
    const minLen = (productSearchField === 'codigo' || productSearchField === 'codigo_barras') ? 1 : 2;
    if (productSearch.trim().length >= minLen) {
      const results = searchProdutos(productSearch, productSearchField);
      setProductResults(results.slice(0, 25));
      setShowProductSearch(true);
    } else {
      setProductResults([]);
      setShowProductSearch(false);
    }
  }, [productSearch, productSearchField, produtos]);

  // Auto-inserir produto quando buscar por Cod. Barras e houver 1 resultado exato (leitor de código de barras)
  const lastBarcodeAutoAdded = useRef<string | null>(null);
  useEffect(() => {
    if (!productSearch.trim()) {
      lastBarcodeAutoAdded.current = null;
      return;
    }
    if (productSearchField !== 'codigo_barras' || productResults.length !== 1) return;
    const trimmed = productSearch.trim();
    const barras = (productResults[0].codigo_barras ?? '').toString().trim();
    if (barras !== trimmed || lastBarcodeAutoAdded.current === trimmed) return;
    lastBarcodeAutoAdded.current = trimmed;
    handleAddProduct(productResults[0], 'avista');
    setProductSearch('');
    setProductResults([]);
    setShowProductSearch(false);
  }, [productSearch, productSearchField, productResults]);

  // Buscar clientes (no servidor - busca em todo o cadastro)
  const [clienteSearchLoading, setClienteSearchLoading] = useState(false);
  useEffect(() => {
    if (clienteSearch.length < 2) {
      setClienteResults([]);
      setShowClienteSearch(false);
      return;
    }
    let cancelled = false;
    setClienteSearchLoading(true);
    setShowClienteSearch(true);
    searchClientesAsync(clienteSearch, 15, clienteSearchField)
      .then((results) => {
        if (!cancelled) {
          setClienteResults(results.slice(0, 15));
        }
      })
      .catch(() => {
        if (!cancelled) setClienteResults([]);
      })
      .finally(() => {
        if (!cancelled) setClienteSearchLoading(false);
      });
    return () => { cancelled = true; };
  }, [clienteSearch, clienteSearchField, searchClientesAsync]);

  // Focar no campo de busca ao montar
  useEffect(() => {
    if (searchInputRef.current && !isEditing) {
      searchInputRef.current.focus();
    }
  }, [isEditing]);

  // Em faturamento de OS, não aplicar desconto extra (total = subtotal - desc. itens apenas)
  const effectiveDescontoTotal = sale?.ordem_servico_id ? 0 : descontoTotal;

  // Calcular totais (movido para antes de handleFinalize)
  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => 
      sum + (item.valor_unitario * item.quantidade), 0
    );
    const descontoItens = cart.reduce((sum, item) => sum + (item.desconto || 0), 0);
    const total = subtotal - descontoItens - effectiveDescontoTotal;
    
    return {
      subtotal,
      descontoItens,
      descontoTotal: effectiveDescontoTotal,
      total: Math.max(0, total),
    };
  }, [cart, effectiveDescontoTotal]);

  // Função auxiliar para validar UUID
  const isValidUUID = (str: string | undefined | null): boolean => {
    if (!str) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  // Limpar PDV para nova venda (definido antes de handleFinalize que o referencia)
  const limparPDV = useCallback(() => {
    setSale(null);
    setCart([]);
    setSelectedCliente(null);
    setClienteSearch('');
    setProductSearch('');
    setObservacoes('');
    setDescontoTotal(0);
    setShowProductSearch(false);
    setShowClienteSearch(false);
    setShowCheckout(false);
    setCheckoutPayment({
      forma_pagamento: 'dinheiro',
      valor: undefined,
      troco: 0,
    });
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  }, []);

  // Ao fechar a janela de impressão do cupom (afterprint), limpar PDV e ir para /pdv
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'primecamp-cupom-print-closed') {
        const fn = onCupomPrintClosedRef.current;
        onCupomPrintClosedRef.current = null;
        fn?.();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Finalizar venda
  const handleFinalize = useCallback(async () => {
    if (cart.length === 0) {
      toast({ title: 'Adicione pelo menos um item ao carrinho', variant: 'destructive' });
      return;
    }

    // VALIDAÇÃO CRÍTICA: Verificar estoque de todos os itens
    const itensComEstoqueInsuficiente = cart.filter(item => 
      item.produto_tipo === 'produto' && 
      item.estoque_disponivel !== undefined && 
      item.quantidade > item.estoque_disponivel
    );
    
    if (itensComEstoqueInsuficiente.length > 0) {
      const nomes = itensComEstoqueInsuficiente.map(i => i.produto_nome).join(', ');
      toast({ 
        title: 'Estoque insuficiente', 
        description: `Os seguintes produtos excedem o estoque: ${nomes}`,
        variant: 'destructive' 
      });
      return;
    }

    // Validar se o caixa está aberto — abrir modal de abrir caixa no próprio PDV (agilidade)
    if (!cashSession || cashSession.status !== 'open') {
      toast({ 
        title: 'Caixa fechado', 
        description: 'Abra o caixa no modal abaixo para continuar.',
        variant: 'destructive' 
      });
      setShowOpenCashDialog(true);
      return;
    }

    // Para vendas existentes, validar pagamentos antes de finalizar
    if (isEditing && id) {
      const confirmedPayments = payments.filter(p => p.status === 'confirmed');
      if (confirmedPayments.length === 0) {
        toast({ 
          title: 'Forma de pagamento obrigatória', 
          description: 'É necessário adicionar pelo menos uma forma de pagamento antes de finalizar a venda.',
          variant: 'destructive' 
        });
        setShowCheckout(true); // Abrir modal de pagamento
        return;
      }

      // Validar se o total pago é maior que zero
      const totalPago = confirmedPayments.reduce((sum, p) => sum + Number(p.valor || 0), 0);
      if (totalPago <= 0) {
        toast({ 
          title: 'Valor de pagamento inválido', 
          description: 'O valor total dos pagamentos deve ser maior que zero.',
          variant: 'destructive' 
        });
        setShowCheckout(true); // Abrir modal de pagamento
        return;
      }
    }

    setIsSaving(true);
    try {
      if (!isEditing || !id) {
        // Criar venda primeiro como rascunho
        const newSale = await createSale({
          cliente_id: selectedCliente?.id && isValidUUID(selectedCliente.id) ? selectedCliente.id : undefined,
          cliente_nome: selectedCliente?.nome,
          cliente_cpf_cnpj: selectedCliente?.cpf_cnpj,
          cliente_telefone: selectedCliente?.telefone || selectedCliente?.whatsapp,
          sale_origin: 'PDV',
          cashier_user_id: user?.id || undefined,
          observacoes,
          is_draft: true, // Criar como rascunho primeiro
        });

        // Adicionar itens
        for (const cartItem of cart) {
          await addItem(cartItem, newSale.id);
        }

        // Atualizar valores da venda
        await updateSale(newSale.id, {
          subtotal: totals.subtotal,
          desconto_total: totals.descontoTotal,
          total: totals.total,
        });

        // Redirecionar para a página da venda e abrir modal de pagamento
        navigate(`/pdv/venda/${newSale.id}`);
        setShowCheckout(true);
        setIsSaving(false);
        toast({ 
          title: 'Venda criada', 
          description: 'Adicione a forma de pagamento para finalizar a venda.',
        });
        return;
      }

      // Para vendas existentes, atualizar itens - IMPORTANTE: não adicionar itens que já existem no banco
        console.log('=== FINALIZAR VENDA - VERIFICANDO ITENS ===');
        console.log(`Itens no carrinho: ${cart.length}`);
        console.log(`Itens no banco: ${items.length}`);
        
        // Função auxiliar para comparar itens
        const itemsMatch = (item1: any, item2: any): boolean => {
          // Se ambos têm produto_id, comparar por isso (mais confiável)
          if (item1.produto_id && item2.produto_id) {
            return item1.produto_id === item2.produto_id;
          }
          // Se ambos têm código de barras, comparar por isso
          if (item1.produto_codigo_barras && item2.produto_codigo_barras) {
            return item1.produto_codigo_barras === item2.produto_codigo_barras;
          }
          // Se ambos têm código, comparar por isso
          if (item1.produto_codigo && item2.produto_codigo) {
            return item1.produto_codigo === item2.produto_codigo;
          }
          // Último recurso: comparar por nome (menos confiável)
          return item1.produto_nome === item2.produto_nome;
        };
        
        // Primeiro, remover itens que não estão mais no carrinho
        for (const item of items) {
          const stillInCart = cart.some(cartItem => itemsMatch(item, cartItem));
          
          if (!stillInCart) {
            console.log(`Removendo item do banco: ${item.produto_nome}`);
            await removeItem(item.id);
          }
        }

        // Adicionar/atualizar apenas itens que realmente mudaram ou não existem
        for (const cartItem of cart) {
          // Buscar item existente usando a função de comparação
          const existingItem = items.find(i => itemsMatch(i, cartItem));

          if (existingItem) {
            // Verificar se realmente mudou antes de atualizar
            const hasChanged = 
              Math.abs(existingItem.quantidade - cartItem.quantidade) > 0.001 ||
              Math.abs(existingItem.valor_unitario - cartItem.valor_unitario) > 0.01 ||
              Math.abs((existingItem.desconto || 0) - (cartItem.desconto || 0)) > 0.01;
            
            if (hasChanged) {
              console.log(`Atualizando item: ${cartItem.produto_nome}`);
              await updateItem(existingItem.id, cartItem);
            } else {
              console.log(`Item já existe e não mudou: ${cartItem.produto_nome} (ID: ${existingItem.id})`);
            }
          } else {
            console.log(`Adicionando novo item: ${cartItem.produto_nome}`);
            await addItem(cartItem, id);
          }
        }

        // Atualizar valores da venda antes de finalizar
        await updateSale(id, {
          subtotal: totals.subtotal,
          desconto_total: totals.descontoTotal,
          total: totals.total,
        });

        // Validar se há pelo menos um pagamento confirmado (ou venda de OS já quitada por adiantamento)
        const confirmedPayments = payments.filter(p => p.status === 'confirmed');
        const totalPagoFromPayments = confirmedPayments.reduce((sum, p) => sum + Number(p.valor || 0), 0);
        const totalPagoConsidered = sale?.ordem_servico_id && Number(sale?.total_pago ?? 0) > 0
          ? Math.max(totalPagoFromPayments, Number(sale.total_pago))
          : totalPagoFromPayments;
        const jaPagoPorOS = Boolean(sale?.ordem_servico_id && Number(sale?.total_pago ?? 0) >= totals.total);

        if (confirmedPayments.length === 0 && !jaPagoPorOS) {
          toast({ 
            title: 'Forma de pagamento obrigatória', 
            description: 'É necessário adicionar pelo menos uma forma de pagamento antes de finalizar a venda.',
            variant: 'destructive' 
          });
          setShowCheckout(true); // Abrir modal de pagamento
          setIsSaving(false);
          return;
        }

        if (totalPagoConsidered <= 0 && !jaPagoPorOS) {
          toast({ 
            title: 'Valor de pagamento inválido', 
            description: 'O valor total dos pagamentos deve ser maior que zero.',
            variant: 'destructive' 
          });
          setShowCheckout(true); // Abrir modal de pagamento
          setIsSaving(false);
          return;
        }

        // Pagamento integral obrigatório: não permitir finalizar com saldo restante
        const totalVenda = Number(totals.total) || 0;
        const totalPago = Number(totalPagoConsidered) || 0;
        const saldoRestanteAgora = totalVenda - totalPago;
        const toleranciaCentavos = 0.005; // tolerância para arredondamento
        if (saldoRestanteAgora > toleranciaCentavos) {
          toast({ 
            title: 'Pagamento integral obrigatório', 
            description: `Não é permitido finalizar a venda sem o pagamento integral. Total: ${currencyFormatters.brl(totalVenda)}. Pago: ${currencyFormatters.brl(totalPago)}. Falta: ${currencyFormatters.brl(saldoRestanteAgora)}.`,
            variant: 'destructive' 
          });
          setShowCheckout(true);
          setIsSaving(false);
          return;
        }

        // Finalizar (só chega aqui com pagamento >= total)
        await finalizeSale(id);
        
        // Finalizar a OS se houver vínculo
        const saleData = await getSaleById(id);
        if (saleData?.ordem_servico_id) {
          try {
            await updateOSStatus(saleData.ordem_servico_id, 'entregue_faturada');
            console.log(`OS #${saleData.ordem_servico_id} finalizada automaticamente após finalização da venda`);
            void scheduleOsPosVendaFollowup(saleData.ordem_servico_id);
          } catch (osError: any) {
            console.error('Erro ao finalizar OS:', osError);
            // Não bloquear a venda se houver erro ao finalizar a OS
          }
        }
        
        toast({ title: 'Venda finalizada com sucesso!' });
        // Limpar e redirecionar imediatamente para não deixar URL/estado amarrados à venda anterior
        const finalizedSaleId = id;
        limparPDV();
        navigate('/pdv', { replace: true });
        toast({ title: 'PDV limpo. Pronto para nova venda!' });
        // Ao fechar a janela de impressão do cupom, garantir PDV limpo e em /pdv
        onCupomPrintClosedRef.current = () => {
          limparPDV();
          navigate('/pdv', { replace: true });
        };
        // Impressão em segundo plano (sem bloquear a tela)
        setTimeout(async () => {
          try {
            const finalizedSale = await getSaleById(finalizedSaleId);
            if (finalizedSale?.items?.length && finalizedSale?.payments?.length) {
              try {
                await handlePrintCupomDirect(finalizedSale);
              } catch (printError) {
                console.error('Erro ao imprimir após finalizar:', printError);
              }
            } else {
              console.warn('[IMPRESSÃO] Impressão automática não executada: venda sem itens ou pagamentos', { id: finalizedSale?.id });
            }
          } catch (e) {
            console.error('Erro ao obter venda para impressão:', e);
          }
        }, 800);
    } catch (error: any) {
      console.error('Erro ao finalizar venda:', error);
      toast({
        title: 'Erro ao finalizar venda',
        description: getDemoAwareErrorMessage(error, 'Não foi possível finalizar a venda.'),
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  }, [cart, isEditing, id, sale, selectedCliente, observacoes, totals, items, payments, createSale, addItem, updateSale, finalizeSale, removeItem, updateItem, navigate, toast, setShowCheckout, setIsSaving, cashSession, updateOSStatus, getSaleById, limparPDV]);

  // Atalhos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F2 - Buscar produto
      if (e.key === 'F2' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
          // Garantir que o campo de busca está visível
          setShowProductSearch(true);
        }
      }
      
      // F3 - Buscar cliente
      if (e.key === 'F3' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        if (!selectedCliente) {
          setClienteExpanded(true);
          setTimeout(() => {
            const clienteInput = document.getElementById('cliente-search-input');
            if (clienteInput) clienteInput.focus();
          }, 100);
        }
      }
      
      // F4 - Finalizar venda
      if (e.key === 'F4' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        if (cart.length > 0 && !isSaving) {
          handleFinalize();
        }
      }
      
      // F6 - Importar OS (apenas se carrinho vazio e não editando)
      if (e.key === 'F6' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        if (!isEditing && cart.length === 0) {
          handleOpenFaturarOSModal();
        }
      }
      
      // ESC - Fechar modais
      if (e.key === 'Escape') {
        setShowProductSearch(false);
        setShowClienteSearch(false);
        setShowCheckout(false);
        setShowFaturarOSModal(false);
      }
    };

    // Adicionar listener com capture para garantir que seja capturado antes de outros handlers
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [cart, handleFinalize, isSaving, isEditing, handleOpenFaturarOSModal, selectedCliente]);

  // Adicionar produto ao carrinho (com validação de estoque). precoTipo: '6x' = valor parcelado 6x, 'avista' = valor à vista (Dinheiro/PIX)
  const handleAddProduct = (produto: any, precoTipo: '6x' | 'avista' = '6x') => {
    const valorAvista = Number(produto.preco_venda || produto.valor_venda || 0);
    const valor6x = Number(produto.valor_parcelado_6x ?? produto.preco_venda ?? produto.valor_venda ?? 0);
    const valorUnitario = precoTipo === 'avista' ? valorAvista : valor6x;

    const estoqueDisponivel = Number(produto.quantidade || 0);
    const existingItem = cart.find(item => 
      item.produto_id === produto.id || 
      item.produto_nome === produto.descricao
    );

    // Validar estoque para produtos (serviços não têm estoque)
    const isProduto = normalizeProdutoTipo(produto.tipo) === 'produto';
    
    if (existingItem) {
      const novaQuantidade = existingItem.quantidade + 1;
      
      // Bloquear se ultrapassar estoque (apenas para produtos)
      if (isProduto && novaQuantidade > estoqueDisponivel) {
        toast({ 
          title: 'Estoque insuficiente', 
          description: `Disponível: ${estoqueDisponivel} unidade(s)`,
          variant: 'destructive' 
        });
        return;
      }
      
      setCart(cart.map(item =>
        item === existingItem
          ? { ...item, quantidade: novaQuantidade }
          : item
      ));
    } else {
      // Bloquear se não tem estoque (apenas para produtos)
      if (isProduto && estoqueDisponivel < 1) {
        toast({ 
          title: 'Produto sem estoque', 
          description: 'Este produto não está disponível no momento.',
          variant: 'destructive' 
        });
        return;
      }
      
      setCart([...cart, {
        produto_id: produto.id && isValidUUID(produto.id) ? produto.id : undefined,
        produto_nome: produto.descricao || '',
        produto_codigo: produto.codigo?.toString(),
        produto_codigo_barras: produto.codigo_barras,
        produto_tipo: normalizeProdutoTipo(produto.tipo),
        quantidade: 1,
        valor_unitario: valorUnitario,
        desconto: 0,
        desconto_percentual: 0,
        estoque_disponivel: isProduto ? estoqueDisponivel : undefined,
      }]);
    }

    setProductSearch('');
    setShowProductSearch(false);
    searchInputRef.current?.focus();
  };

  // Atualizar quantidade (recalcula desconto baseado no percentual) COM VALIDAÇÃO DE ESTOQUE
  const handleUpdateQuantity = (index: number, delta: number) => {
    const item = cart[index];
    if (!item) return;
    
    const novaQuantidade = Math.max(0.001, item.quantidade + delta);
    
    // Validar estoque se for produto (não serviço)
    if (item.produto_tipo === 'produto' && item.estoque_disponivel !== undefined) {
      if (novaQuantidade > item.estoque_disponivel) {
        toast({ 
          title: 'Estoque insuficiente', 
          description: `Máximo disponível: ${item.estoque_disponivel} unidade(s)`,
          variant: 'destructive' 
        });
        return;
      }
    }
    
    setCart(cart.map((it, i) => {
      if (i !== index) return it;
      
      const valorBruto = it.valor_unitario * novaQuantidade;
      const descontoCalculado = (valorBruto * (it.desconto_percentual || 0)) / 100;
      
      return { 
        ...it, 
        quantidade: novaQuantidade,
        desconto: descontoCalculado
      };
    }));
  };

  // Remover item
  const handleRemoveItem = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  // Atualizar desconto do item (em percentual)
  const handleUpdateItemDiscount = (index: number, percentual: number) => {
    // Limitar ao percentual máximo permitido pelo perfil
    const percentualLimitado = Math.max(0, Math.min(percentual, limiteDescontoMaximo));
    
    setCart(cart.map((item, i) => {
      if (i !== index) return item;
      
      const valorBruto = item.valor_unitario * item.quantidade;
      const descontoCalculado = (valorBruto * percentualLimitado) / 100;
      
      return { 
        ...item, 
        desconto: descontoCalculado,
        desconto_percentual: percentualLimitado
      };
    }));
  };

  // Selecionar cliente
  const handleSelectCliente = (cliente: any) => {
    setSelectedCliente(cliente);
    setClienteSearch(cliente.nome);
    setShowClienteSearch(false);
  };

  // Salvar rascunho
  const handleSaveDraft = async () => {
    try {
      setIsSaving(true);
      
      if (isEditing && id) {
        // Atualizar venda existente
        await updateSale(id, {
          cliente_id: selectedCliente?.id && isValidUUID(selectedCliente.id) ? selectedCliente.id : undefined,
          cliente_nome: selectedCliente?.nome,
          cliente_cpf_cnpj: selectedCliente?.cpf_cnpj,
          cliente_telefone: selectedCliente?.telefone || selectedCliente?.whatsapp,
          observacoes,
          is_draft: true,
          subtotal: totals.subtotal,
          desconto_total: totals.descontoTotal,
          total: totals.total,
        });

        // Atualizar itens
        const currentItemIds = items.map(i => i.id);
        const cartItemIds = cart.map((_, i) => `temp-${i}`);

        // Remover itens que não estão mais no carrinho
        for (const item of items) {
          if (!cart.some((c, i) => c.produto_id === item.produto_id && c.produto_nome === item.produto_nome)) {
            await removeItem(item.id);
          }
        }

        // Adicionar/atualizar itens
        for (const cartItem of cart) {
          const existingItem = items.find(i => 
            i.produto_id === cartItem.produto_id && 
            i.produto_nome === cartItem.produto_nome
          );

          if (existingItem) {
            await updateItem(existingItem.id, cartItem);
          } else {
            await addItem(cartItem);
          }
        }

        toast({ title: 'Rascunho salvo com sucesso!' });
      } else {
        // Criar nova venda
        const newSale = await createSale({
          cliente_id: selectedCliente?.id && isValidUUID(selectedCliente.id) ? selectedCliente.id : undefined,
          cliente_nome: selectedCliente?.nome,
          cliente_cpf_cnpj: selectedCliente?.cpf_cnpj,
          cliente_telefone: selectedCliente?.telefone || selectedCliente?.whatsapp,
          sale_origin: 'PDV',
          cashier_user_id: user?.id || undefined,
          observacoes,
          is_draft: true,
        });

        // Adicionar itens
        for (const cartItem of cart) {
          await addItem(cartItem, newSale.id);
        }

        // Atualizar valores da venda
        await updateSale(newSale.id, {
          subtotal: totals.subtotal,
          desconto_total: totals.descontoTotal,
          total: totals.total,
        });

        toast({ title: 'Rascunho salvo com sucesso!' });
        navigate(`/pdv/venda/${newSale.id}/editar`);
      }
    } catch (error) {
      console.error('Erro ao salvar rascunho:', error);
      toast({ title: 'Erro ao salvar rascunho', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };


  // Excluir venda
  const handleDelete = async () => {
    if (!isEditing || !id) {
      return;
    }

    const confirmMessage = sale?.is_draft
      ? 'Tem certeza que deseja excluir este rascunho? Esta ação não pode ser desfeita.'
      : 'Tem certeza que deseja excluir esta venda? Esta ação não pode ser desfeita e irá reverter estoque e cancelar contas a receber.';

    if (!confirm(confirmMessage)) {
      return;
    }

    setIsDeleting(true);
    try {
      // Se for rascunho, excluir normalmente
      // Se for venda finalizada, usar force=true (apenas admin pode)
      await deleteSale(id, !sale?.is_draft && isAdmin);
      toast({ title: sale?.is_draft ? 'Rascunho excluído com sucesso!' : 'Venda excluída com sucesso!' });
      navigate('/pdv/vendas');
    } catch (error: any) {
      console.error('Erro ao excluir rascunho:', error);
      toast({ 
        title: 'Erro ao excluir rascunho', 
        description: error.message || 'Não foi possível excluir o rascunho.',
        variant: 'destructive' 
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const round2 = (n: number) => Math.round(n * 100) / 100;
  // Calcular taxa e valor líquido (repasse) conforme forma de pagamento e parcelas
  const getPaymentFeeAndNet = (forma: string, parcelas: number, valor: number) => {
    const pm = paymentMethods.find((p) => p.code === forma);
    const n = Math.max(1, parcelas || 1);
    const feeRow = pm?.fees?.find((f) => f.installments === n) ?? pm?.fees?.find((f) => f.installments === 1) ?? null;
    if (!feeRow || (!feeRow.fee_percentage && !feeRow.fee_fixed)) {
      return { taxa_cartao: 0, valor_repasse: null as number | null };
    }
    const feePct = Number(feeRow.fee_percentage) || 0;
    const feeFixed = Number(feeRow.fee_fixed) || 0;
    const feeAmount = round2((valor * feePct) / 100 + feeFixed);
    const valor_repasse = round2(valor - feeAmount);
    return { taxa_cartao: feePct, valor_repasse };
  };

  // Adicionar pagamento (bloqueia duplo clique para não duplicar forma de pagamento)
  const handleAddPayment = async () => {
    if (!id) return;
    if (addingPaymentRef.current || isAddingPayment) return;
    addingPaymentRef.current = true;
    setIsAddingPayment(true);
    const valorRecebido = Number(checkoutPayment.valor) || 0;
    if (valorRecebido <= 0) {
      addingPaymentRef.current = false;
      setIsAddingPayment(false);
      return;
    }
    // Em dinheiro com troco: gravar o valor aplicado à venda (valor que fica no caixa), não o valor recebido
    const troco = Number(checkoutPayment.troco) || 0;
    let valorAplicado = checkoutPayment.forma_pagamento === 'dinheiro' && troco > 0
      ? valorRecebido - troco
      : valorRecebido;
    // Não permitir pagamento acima do total da venda (evita duplicação e valor pago > total)
    const totalPagoAtual = payments
      .filter(p => p.status === 'confirmed')
      .reduce((s, p) => s + Number(p.valor), 0);
    const saldoRestanteAgora = Number(totals.total || 0) - totalPagoAtual;
    const tolerancia = 0.005;
    if (valorAplicado > saldoRestanteAgora + tolerancia) {
      addingPaymentRef.current = false;
      setIsAddingPayment(false);
      toast({
        title: 'Valor acima do permitido',
        description: `O pagamento não pode ser maior que o saldo restante da venda (${currencyFormatters.brl(saldoRestanteAgora)}). Total da venda: ${currencyFormatters.brl(totals.total)}.`,
        variant: 'destructive',
      });
      return;
    }
    // Limitar ao saldo restante (evita que PIX/cartão registrem acima do total)
    if (valorAplicado > saldoRestanteAgora) valorAplicado = saldoRestanteAgora;
    const { taxa_cartao, valor_repasse } = getPaymentFeeAndNet(
      checkoutPayment.forma_pagamento,
      checkoutPayment.parcelas ?? 1,
      valorAplicado
    );
    const payload = {
      ...checkoutPayment,
      valor: valorAplicado,
      taxa_cartao,
      valor_repasse: valor_repasse ?? undefined,
    };
    try {
      const payment = await addPayment(payload);
      await confirmPayment(payment.id);

      toast({ title: 'Pagamento adicionado com sucesso!' });

      // Recarregar dados para atualizar saldo restante
      await loadSale();

      // Resetar formulário mas manter modal aberto
      setCheckoutPayment({
        forma_pagamento: 'dinheiro',
        valor: undefined,
        troco: 0,
      });

      // Verificar se está totalmente pago e finalizar automaticamente
      const updatedSale = await getSaleById(id);
      if (updatedSale && Number(updatedSale.total_pago) >= Number(updatedSale.total)) {
        // Finalizar a venda automaticamente
        try {
          await finalizeSale(id);
          
          // Mudar status da OS para "entregue Faturada" se houver vínculo
          if (updatedSale.ordem_servico_id) {
            try {
              // Buscar OS para pegar dados
              const os = getOSById(updatedSale.ordem_servico_id);
              if (os) {
                // Mudar para "entregue Faturada" (ou "entregue" se não existir o status customizado)
                const novoStatus = 'entregue_faturada'; // Status customizado
                await updateOSStatus(updatedSale.ordem_servico_id, novoStatus);
                console.log(`OS #${os.numero} mudada para ${novoStatus} automaticamente após faturamento`);
                void scheduleOsPosVendaFollowup(updatedSale.ordem_servico_id);
                
                // Enviar mensagem configurada do status (config global por empresa, API)
                try {
                  const telefone = os.telefone_contato;
                  if (telefone) {
                    const configStatus = getConfigByStatus?.(novoStatus) ?? getConfigByStatus?.('entregue');
                    if (configStatus?.notificar_whatsapp && configStatus.mensagem_whatsapp) {
                      // Substituir variáveis na mensagem
                      let mensagem = configStatus.mensagem_whatsapp
                        .replace(/{cliente}/g, os.cliente_nome || 'Cliente')
                        .replace(/{numero}/g, os.numero?.toString() || '')
                        .replace(/{status}/g, configStatus.label || 'Entregue Faturada')
                        .replace(/{marca}/g, os.marca_nome || '')
                        .replace(/{modelo}/g, os.modelo_nome || '');
                      
                      // Formatar número
                      let numero = telefone.replace(/\D/g, '');
                      numero = numero.replace(/^0+/, '');
                      if (!numero.startsWith('55')) {
                        if (numero.startsWith('0')) {
                          numero = numero.substring(1);
                        }
                        if (numero.length === 10 || numero.length === 11) {
                          numero = '55' + numero;
                        }
                      }
                      
                      if (numero.length >= 12 && numero.length <= 13) {
                        await sendWhatsAppMessage({ number: numero, body: mensagem });
                      }
                    }
                  }
                } catch (msgError) {
                  console.error('Erro ao enviar mensagem de faturamento:', msgError);
                  // Não bloquear se falhar
                }
              }
            } catch (osError: any) {
              console.error('Erro ao atualizar status da OS:', osError);
              // Não bloquear a venda se houver erro
            }
          }
          
          toast({ title: 'Venda finalizada com sucesso!' });
          setShowCheckout(false);
          
          // Ao fechar a janela de impressão do cupom, limpar PDV e ir para /pdv (sem link da venda anterior)
          onCupomPrintClosedRef.current = () => {
            limparPDV();
            navigate('/pdv', { replace: true });
            toast({ title: 'PDV limpo. Pronto para nova venda!' });
          };
          // Aguardar e imprimir automaticamente com dados frescos da venda
          setPendingSaleForCupom(updatedSale);
          setTimeout(async () => {
            const finalSale = await getSaleById(id);
            if (finalSale?.items?.length && finalSale?.payments?.length) {
              console.log('[IMPRESSÃO] Iniciando impressão automática...', { saleId: finalSale.id });
              await handlePrintCupomDirect(finalSale);
            } else {
              console.warn('[IMPRESSÃO] Impressão automática não executada: venda sem itens ou pagamentos');
            }
          }, 800);
        } catch (error: any) {
          console.error('Erro ao finalizar venda automaticamente:', error);
          toast({
            title: 'Pagamento adicionado, mas erro ao finalizar',
            description: getDemoAwareErrorMessage(error, 'Finalize manualmente a venda.'),
            variant: 'destructive'
          });
        }
      }
    } catch (error) {
      console.error('Erro ao adicionar pagamento:', error);
      toast({ title: 'Erro ao adicionar pagamento', variant: 'destructive' });
    } finally {
      addingPaymentRef.current = false;
      setIsAddingPayment(false);
    }
  };

  // Confirmar emissão de cupom - SEMPRE imprime direto
  const handleConfirmEmitCupom = async () => {
    setShowEmitirCupomDialog(false);
    
    if (pendingSaleForCupom?.id) {
      try {
        // Ao fechar a janela de impressão, limpar PDV e ir para /pdv
        onCupomPrintClosedRef.current = () => {
          limparPDV();
          navigate('/pdv', { replace: true });
          toast({ title: 'PDV limpo. Pronto para nova venda!' });
        };
        const saleParaCupom = await getSaleById(pendingSaleForCupom.id);
        if (saleParaCupom?.items?.length && saleParaCupom?.payments?.length) {
          await handlePrintCupomDirect(saleParaCupom);
        } else {
          limparPDV();
          navigate('/pdv', { replace: true });
        }
      } catch (error) {
        console.error('Erro ao emitir cupom:', error);
        toast({ title: 'Erro ao emitir cupom', variant: 'destructive' });
        // Limpar mesmo em caso de erro
        limparPDV();
        navigate('/pdv', { replace: true });
      }
    } else {
      // Se não tiver venda pendente, apenas limpar
      limparPDV();
    }
    
    setPendingSaleForCupom(null);
  };

  // Imprimir cupom térmico (com janela)
  const handlePrintCupom = async () => {
    if (!sale || !items || !payments) return;

    try {
      const cupomData = {
        numero: sale.numero,
        data: new Date(sale.created_at).toLocaleDateString('pt-BR'),
        hora: new Date(sale.created_at).toLocaleTimeString('pt-BR'),
        empresa: {
          nome: 'PRIME CAMP', // TODO: Buscar de configuração
          cnpj: '31.833.574/0001-74', // TODO: Buscar de configuração
          endereco: undefined, // TODO: Buscar de configuração
          telefone: undefined, // TODO: Buscar de configuração
        },
        cliente: sale.cliente_nome ? {
          nome: sale.cliente_nome,
          cpf_cnpj: sale.cliente_cpf_cnpj || undefined,
          telefone: sale.cliente_telefone || undefined,
        } : undefined,
        itens: items.map(item => ({
          codigo: item.produto_codigo || item.produto_codigo_barras || undefined,
          nome: item.produto_nome,
          quantidade: Number(item.quantidade),
          valor_unitario: Number(item.valor_unitario),
          desconto: Number(item.desconto || 0),
          valor_total: Number(item.valor_total),
        })),
        subtotal: Number(sale.subtotal),
        total: Number(sale.total),
        desconto_total: (() => {
          const sub = Number(sale.subtotal || 0);
          const tot = Number(sale.total || 0);
          const fromSale = Math.max(0, sub - tot);
          if (fromSale > 0) return fromSale;
          const fromItens = items.reduce((s, i) => s + (Number(i.valor_unitario || 0) * Number(i.quantidade || 0) - Number(i.valor_total || 0)), 0);
          const extra = Number(sale.desconto_total || 0);
          return Math.max(0, fromItens + extra);
        })(),
        pagamentos: payments
          .filter(p => p.status === 'confirmed')
          .map(p => ({
            forma: p.forma_pagamento,
            valor: Number(p.valor),
            troco: p.troco ? Number(p.troco) : undefined,
          })),
        vendedor: sale.vendedor_nome || undefined,
        observacoes: sale.observacoes || undefined,
        mostrar_termos_garantia_os: !!sale.ordem_servico_id,
      };

      // Gerar QR code com URL para 2ª via do cupom
      const qrCodeData = `${APP_PUBLIC_URL}/cupom/${sale.id}`;
      const html = await generateCupomTermica(cupomData, qrCodeData, cupomConfig || undefined);
      printTermica(html);
    } catch (error) {
      console.error('Erro ao gerar cupom:', error);
      toast({ title: 'Erro ao gerar cupom', variant: 'destructive' });
    }
  };

  // Imprimir cupom térmico diretamente (sem abrir janela)
  // Aceita venda com items/payments (ex.: retorno de getSaleById) para impressão automática pós-finalizar
  const handlePrintCupomDirect = async (saleData?: any) => {
    try {
      const saleToUse = saleData || sale;
      const itensParaCupom = (saleToUse?.items?.length ? saleToUse.items : items) ?? [];
      const pagamentosParaCupom = (saleToUse?.payments?.length ? saleToUse.payments : payments) ?? [];
      if (!saleToUse || !itensParaCupom.length || !pagamentosParaCupom.length) {
        console.error('Dados insuficientes para imprimir cupom:', { saleToUse: !!saleToUse, itens: itensParaCupom.length, pagamentos: pagamentosParaCupom.length });
        return;
      }
      const cupomData = {
        numero: saleToUse.numero,
        data: new Date(saleToUse.created_at).toLocaleDateString('pt-BR'),
        hora: new Date(saleToUse.created_at).toLocaleTimeString('pt-BR'),
        empresa: {
          nome: 'PRIME CAMP',
          cnpj: '31.833.574/0001-74',
          endereco: undefined,
          telefone: undefined,
        },
        cliente: saleToUse.cliente_nome ? {
          nome: saleToUse.cliente_nome,
          cpf_cnpj: saleToUse.cliente_cpf_cnpj || undefined,
          telefone: saleToUse.cliente_telefone || undefined,
        } : undefined,
        itens: itensParaCupom.map((item: any) => ({
          codigo: item.produto_codigo || item.produto_codigo_barras || undefined,
          nome: item.produto_nome,
          quantidade: Number(item.quantidade),
          valor_unitario: Number(item.valor_unitario),
          desconto: Number(item.desconto || 0),
          valor_total: Number(item.valor_total),
        })),
        subtotal: Number(saleToUse.subtotal),
        total: Number(saleToUse.total),
        desconto_total: (() => {
          const sub = Number(saleToUse.subtotal || 0);
          const tot = Number(saleToUse.total || 0);
          const fromSale = Math.max(0, sub - tot);
          if (fromSale > 0) return fromSale;
          const fromItens = itensParaCupom.reduce((s: number, i: any) => s + (Number(i.valor_unitario || 0) * Number(i.quantidade || 0) - Number(i.valor_total || 0)), 0);
          const extra = Number(saleToUse.desconto_total || 0);
          return Math.max(0, fromItens + extra);
        })(),
        pagamentos: pagamentosParaCupom
          .filter((p: any) => p.status === 'confirmed')
          .map((p: any) => ({
            forma: p.forma_pagamento,
            valor: Number(p.valor),
            troco: p.troco ? Number(p.troco) : undefined,
            parcelas: p.parcelas || undefined,
            valor_parcela: p.parcelas && p.parcelas > 1 ? Number(p.valor) / p.parcelas : undefined,
          })),
        vendedor: saleToUse.vendedor_nome || undefined,
        observacoes: saleToUse.observacoes || undefined,
        mostrar_termos_garantia_os: !!saleToUse.ordem_servico_id,
      };

      // Gerar QR code com URL para 2ª via do cupom
      const qrCodeData = `${APP_PUBLIC_URL}/cupom/${saleToUse.id}`;
      const html = await generateCupomTermica(cupomData, qrCodeData, cupomConfig || undefined);
      
      const imprimirSemDialogo = cupomConfig?.imprimir_sem_dialogo !== false; // Default true
      const imprimir2Vias = cupomConfig?.imprimir_2_vias === true;
      
      console.log('[IMPRESSÃO] Configurações:', { imprimirSemDialogo, imprimir2Vias, cupomConfig });
      
      const printCupom = () => {
        return new Promise<void>((resolve) => {
          // Impressão direta sem abrir janela
          const printFrame = document.createElement('iframe');
          printFrame.style.position = 'fixed';
          printFrame.style.right = '0';
          printFrame.style.bottom = '0';
          printFrame.style.width = '0';
          printFrame.style.height = '0';
          printFrame.style.border = '0';
          document.body.appendChild(printFrame);
          
          const printDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
          if (printDoc) {
            printDoc.open();
            printDoc.write(html);
            printDoc.close();
            
            // Aguardar carregamento e imprimir
            setTimeout(() => {
              try {
                const win = printFrame.contentWindow;
                if (win) {
                  win.onafterprint = () => {
                    try {
                      win.parent?.postMessage?.({ type: 'primecamp-cupom-print-closed' }, '*');
                    } catch (_) {}
                  };
                  // Fallback: alguns navegadores não disparam onafterprint ao cancelar; assumir fechado após 4s
                  win.setTimeout(() => {
                    try {
                      win.parent?.postMessage?.({ type: 'primecamp-cupom-print-closed' }, '*');
                    } catch (_) {}
                  }, 4000);
                }
                printFrame.contentWindow?.focus();
                // Imprimir diretamente - navegadores podem mostrar diálogo
                printFrame.contentWindow?.print();
                console.log('[IMPRESSÃO] Comando de impressão enviado');
                
                // Remover iframe após impressão
                setTimeout(() => {
                  try {
                    if (printFrame.parentNode) {
                      document.body.removeChild(printFrame);
                    }
                  } catch (e) {
                    console.error('Erro ao remover iframe:', e);
                  }
                  resolve();
                }, 2000);
              } catch (e) {
                console.error('Erro ao imprimir:', e);
                toast({ title: 'Erro ao imprimir cupom', variant: 'destructive' });
                resolve();
              }
            }, 1000); // Delay para garantir que HTML está totalmente carregado
          } else {
            resolve();
          }
        });
      };
      
      // Imprimir primeira via
      console.log('[IMPRESSÃO] Iniciando impressão da primeira via');
      try {
        await printCupom();
        console.log('[IMPRESSÃO] Primeira via impressa');
        
        // Se configurado para 2 vias, imprimir novamente após um delay
        if (imprimir2Vias) {
          console.log('[IMPRESSÃO] Configurado para 2 vias, aguardando 3 segundos para imprimir segunda via');
          await new Promise(resolve => setTimeout(resolve, 3000));
          console.log('[IMPRESSÃO] Iniciando impressão da segunda via');
          await printCupom();
          console.log('[IMPRESSÃO] Segunda via impressa com sucesso');
        } else {
          console.log('[IMPRESSÃO] Apenas 1 via configurada (imprimir_2_vias = false)');
        }
        
        // Atualizar campos de impressão no banco (sucesso)
        await updatePrintStatus('sales', saleToUse.id, true);
      } catch (printError) {
        console.error('Erro ao imprimir:', printError);
        // Atualizar campos de impressão no banco (erro)
        await updatePrintStatus('sales', saleToUse.id, false);
        throw printError;
      }
    } catch (error) {
      console.error('Erro ao gerar cupom:', error);
      // Tentar atualizar status de erro mesmo se não conseguiu imprimir
      if (saleToUse?.id) {
        await updatePrintStatus('sales', saleToUse.id, false).catch(() => {});
      }
      toast({ title: 'Erro ao gerar cupom', variant: 'destructive' });
    }
  };

  // Enviar por WhatsApp
  const handleSendWhatsApp = () => {
    if (!sale || !items || !payments || !selectedCliente?.whatsapp) {
      toast({ 
        title: 'Cliente não possui WhatsApp cadastrado', 
        variant: 'destructive' 
      });
      return;
    }

    const message = formatVendaMessage({
      numero: sale.numero,
      data: new Date(sale.created_at).toLocaleDateString('pt-BR'),
      total: Number(sale.total),
      cliente: sale.cliente_nome || undefined,
      itens: items.map(item => ({
        nome: item.produto_nome,
        quantidade: Number(item.quantidade),
        valor_total: Number(item.valor_total),
      })),
      pagamentos: payments
        .filter(p => p.status === 'confirmed')
        .map(p => ({
          forma: p.forma_pagamento,
          valor: Number(p.valor),
        })),
    });

    openWhatsApp(selectedCliente.whatsapp, message);
  };

  // Salvar PDF
  const handleSavePDF = async () => {
    if (!sale || !items || !payments) return;

    try {
      const cupomData = {
        numero: sale.numero,
        data: new Date(sale.created_at).toLocaleDateString('pt-BR'),
        hora: new Date(sale.created_at).toLocaleTimeString('pt-BR'),
        empresa: {
          nome: 'PRIME CAMP', // TODO: Buscar de configuração
          cnpj: '31.833.574/0001-74', // TODO: Buscar de configuração
          endereco: undefined, // TODO: Buscar de configuração
          telefone: undefined, // TODO: Buscar de configuração
        },
        cliente: sale.cliente_nome ? {
          nome: sale.cliente_nome,
          cpf_cnpj: sale.cliente_cpf_cnpj || undefined,
          telefone: sale.cliente_telefone || undefined,
        } : undefined,
        itens: items.map(item => ({
          codigo: item.produto_codigo || item.produto_codigo_barras || undefined,
          nome: item.produto_nome,
          quantidade: Number(item.quantidade),
          valor_unitario: Number(item.valor_unitario),
          desconto: Number(item.desconto || 0),
          valor_total: Number(item.valor_total),
        })),
        subtotal: Number(sale.subtotal),
        total: Number(sale.total),
        desconto_total: (() => {
          const sub = Number(sale.subtotal || 0);
          const tot = Number(sale.total || 0);
          const fromSale = Math.max(0, sub - tot);
          if (fromSale > 0) return fromSale;
          const fromItens = items.reduce((s, i) => s + (Number(i.valor_unitario || 0) * Number(i.quantidade || 0) - Number(i.valor_total || 0)), 0);
          const extra = Number(sale.desconto_total || 0);
          return Math.max(0, fromItens + extra);
        })(),
        pagamentos: payments
          .filter(p => p.status === 'confirmed')
          .map(p => ({
            forma: p.forma_pagamento,
            valor: Number(p.valor),
            troco: p.troco ? Number(p.troco) : undefined,
          })),
        vendedor: sale.vendedor_nome || undefined,
        observacoes: sale.observacoes || undefined,
        mostrar_termos_garantia_os: !!sale.ordem_servico_id,
      };

      // Gerar QR code com URL para 2ª via do cupom
      const qrCodeData = `${APP_PUBLIC_URL}/cupom/${sale.id}`;
      const pdf = await generateCupomPDF(cupomData, qrCodeData);
      pdf.save(`cupom-venda-${sale.numero}.pdf`);
      
      toast({ title: 'PDF salvo com sucesso!' });
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast({ title: 'Erro ao gerar PDF', variant: 'destructive' });
    }
  };

  const totalPagoFromPayments = payments
    .filter(p => p.status === 'confirmed')
    .reduce((sum, p) => sum + Number(p.valor), 0);
  // Venda faturada de OS: considerar total já pago da venda (ex.: adiantamento) mesmo antes dos pagamentos carregarem
  const totalPago = sale?.ordem_servico_id && Number(sale?.total_pago ?? 0) > 0
    ? Math.max(totalPagoFromPayments, Number(sale.total_pago))
    : totalPagoFromPayments;

  const saldoRestante = totals.total - totalPago;

  // ===== FUNÇÕES DE ORÇAMENTO =====
  
  // Gerar orçamento (não afeta estoque, não movimenta caixa)
  const handleGerarOrcamento = async () => {
    if (cart.length === 0) {
      toast({ title: 'Adicione pelo menos um item ao carrinho', variant: 'destructive' });
      return;
    }

    setIsGeneratingOrcamento(true);
    try {
      const novoOrcamento = await createQuote({
        cliente_id: selectedCliente?.id,
        cliente_nome: selectedCliente?.nome,
        cliente_cpf_cnpj: selectedCliente?.cpf_cnpj,
        cliente_telefone: selectedCliente?.telefone || selectedCliente?.whatsapp,
        observacoes,
        validade_dias: 7,
      }, cart);

      setOrcamentoGerado(novoOrcamento);
      setShowOrcamentoModal(true);
      
      toast({ 
        title: 'Orçamento gerado com sucesso!', 
        description: `Orçamento #${novoOrcamento.numero} criado.`,
      });
    } catch (error: any) {
      console.error('Erro ao gerar orçamento:', error);
      toast({ 
        title: 'Erro ao gerar orçamento', 
        description: error.message || 'Não foi possível gerar o orçamento.',
        variant: 'destructive' 
      });
    } finally {
      setIsGeneratingOrcamento(false);
    }
  };

  // Imprimir orçamento como PDF
  const handlePrintOrcamento = async () => {
    if (!orcamentoGerado) return;

    try {
      const orcamentoData: OrcamentoData = {
        numero: orcamentoGerado.numero,
        data: new Date(orcamentoGerado.created_at).toLocaleDateString('pt-BR'),
        hora: new Date(orcamentoGerado.created_at).toLocaleTimeString('pt-BR'),
        validade: orcamentoGerado.data_validade 
          ? new Date(orcamentoGerado.data_validade).toLocaleDateString('pt-BR')
          : undefined,
        empresa: {
          nome: 'PRIME CAMP ASSISTÊNCIA TÉCNICA',
          cnpj: '31.833.574/0001-74',
        },
        cliente: orcamentoGerado.cliente_nome ? {
          nome: orcamentoGerado.cliente_nome,
          cpf_cnpj: orcamentoGerado.cliente_cpf_cnpj || undefined,
          telefone: orcamentoGerado.cliente_telefone || undefined,
        } : undefined,
        itens: cart.map(item => ({
          nome: item.produto_nome,
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario,
          desconto: item.desconto || 0,
          valor_total: (item.valor_unitario * item.quantidade) - (item.desconto || 0),
        })),
        subtotal: totals.subtotal,
        desconto_total: totals.descontoItens + totals.descontoTotal,
        total: totals.total,
        vendedor: profile?.display_name || user?.email || undefined,
        observacoes: observacoes || undefined,
        condicoes_pagamento: 'Pagamento à vista ou parcelado. Consulte condições.',
      };

      const pdf = await generateOrcamentoPDF(orcamentoData);
      pdf.save(`orcamento-${orcamentoGerado.numero}.pdf`);
      
      toast({ title: 'PDF gerado com sucesso!' });
    } catch (error) {
      console.error('Erro ao gerar PDF do orçamento:', error);
      toast({ title: 'Erro ao gerar PDF', variant: 'destructive' });
    }
  };

  // Enviar orçamento por WhatsApp via API Ativa CRM
  const handleEnviarOrcamentoWhatsApp = async () => {
    if (!orcamentoGerado) return;

    const telefone = selectedCliente?.telefone || selectedCliente?.whatsapp;
    if (!telefone) {
      toast({ 
        title: 'Cliente sem telefone', 
        description: 'O cliente não possui telefone cadastrado.',
        variant: 'destructive' 
      });
      return;
    }

    try {
      // Formatar telefone (remover caracteres não numéricos e adicionar 55 se não tiver)
      let numeroFormatado = telefone.replace(/\D/g, '');
      if (!numeroFormatado.startsWith('55')) {
        numeroFormatado = '55' + numeroFormatado;
      }

      // Formatar mensagem do orçamento
      const itensTexto = cart.map(item => 
        `• ${item.produto_nome} (${item.quantidade}x) - ${currencyFormatters.brl((item.valor_unitario * item.quantidade) - (item.desconto || 0))}`
      ).join('\n');

      const mensagem = `Oi ${selectedCliente?.nome?.split(' ')[0] || ''} 👋

Conforme combinamos, segue o orçamento do seu atendimento na *PrimeCamp*:

📋 *Orçamento #${orcamentoGerado.numero}*
📅 Válido até: ${orcamentoGerado.data_validade ? new Date(orcamentoGerado.data_validade).toLocaleDateString('pt-BR') : '7 dias'}

${itensTexto}

💰 *Total: ${currencyFormatters.brl(totals.total)}*

Qualquer dúvida é só me chamar por aqui 😊

_PrimeCamp Assistência Técnica_`;

      // Enviar via API Ativa CRM
      await sendWhatsAppMessage({
        number: numeroFormatado,
        body: mensagem,
      });
      
      // Marcar como enviado no banco
      await markAsSentWhatsApp(orcamentoGerado.id);
      
      toast({ 
        title: 'Orçamento enviado!', 
        description: `Mensagem enviada para ${telefone} via WhatsApp.` 
      });
    } catch (error: any) {
      console.error('Erro ao enviar orçamento por WhatsApp:', error);
      toast({ 
        title: 'Erro ao enviar', 
        description: error.message || 'Não foi possível enviar via WhatsApp.',
        variant: 'destructive' 
      });
    }
  };

  // Converter orçamento em venda
  const handleConverterOrcamentoEmVenda = async () => {
    if (!orcamentoGerado) return;

    try {
      const saleId = await convertToSale(orcamentoGerado.id);
      
      toast({ 
        title: 'Orçamento convertido!', 
        description: 'Redirecionando para a venda...',
      });

      setShowOrcamentoModal(false);
      navigate(`/pdv/venda/${saleId}/editar`);
    } catch (error: any) {
      console.error('Erro ao converter orçamento:', error);
      toast({ 
        title: 'Erro ao converter', 
        description: error.message || 'Não foi possível converter o orçamento.',
        variant: 'destructive' 
      });
    }
  };

  // Fechar modal e limpar PDV após orçamento
  const handleFecharOrcamentoModal = (limpar: boolean = false) => {
    setShowOrcamentoModal(false);
    setOrcamentoGerado(null);
    
    if (limpar) {
      limparPDV();
      toast({ title: 'PDV limpo. Pronto para novo atendimento!' });
    }
  };

  return (
    <ModernLayout 
      title={isEditing ? `Venda #${sale?.numero || ''}` : 'Nova Venda'}
      subtitle={isEditing ? 'Editar venda' : 'Criar nova venda'}
    >
      <div className="space-y-3 md:space-y-4">
        {/* Header minimalista */}
        {isEditing && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge 
                variant={sale?.is_draft ? "secondary" : "default"} 
                className={cn(
                  "text-sm font-medium px-3 py-1",
                  !sale?.is_draft && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                )}
              >
                {sale?.is_draft ? '📝 Rascunho' : '✅ Venda Finalizada'}
              </Badge>
              {sale?.numero && (
                <span className="text-base font-semibold text-gray-700 dark:text-gray-300">#{sale.numero}</span>
              )}
            </div>
            {/* Ações movidas para o card Resumo */}
            <span></span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 min-h-[calc(100vh-200px)]">
          {/* Coluna esquerda - Busca, Cliente e Carrinho */}
          <div className="lg:col-span-2 flex flex-col gap-3">
            {/* Busca de produtos - Card mais forte */}
            <Card className="border-2 border-emerald-200 dark:border-emerald-800 bg-gradient-to-r from-emerald-50/50 to-white dark:from-emerald-900/20 dark:to-gray-900">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Search className="h-5 w-5 text-emerald-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-semibold">Buscar Produto</span>
                  <kbd className="ml-auto px-2 py-1 text-[10px] bg-emerald-100 dark:bg-emerald-900 rounded text-emerald-700 dark:text-emerald-300 font-mono border border-emerald-200 dark:border-emerald-800">F2</kbd>
                </div>
                <div className="flex gap-2">
                  <Input
                    ref={searchInputRef}
                    placeholder={
                      productSearchField === 'all'
                        ? "Buscar por código, descrição, referência..."
                        : productSearchField === 'codigo'
                        ? "Buscar por código..."
                        : productSearchField === 'codigo_barras'
                        ? "Leia o código de barras ou digite..."
                        : productSearchField === 'descricao'
                        ? "Buscar por descrição..."
                        : "Buscar por referência..."
                    }
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && productResults.length > 0) {
                        handleAddProduct(productResults[0], 'avista');
                      }
                    }}
                    className="h-12 text-base font-medium border-2 border-gray-200 dark:border-gray-700 focus:border-emerald-500 focus:ring-emerald-500 flex-1"
                  />
                  <Select
                    value={productSearchField}
                    onValueChange={(value: 'all' | 'codigo' | 'descricao' | 'referencia' | 'codigo_barras') => {
                      setProductSearchField(value);
                      try {
                        localStorage.setItem(PDV_SEARCH_FIELD_KEY, value);
                      } catch { /* ignore */ }
                    }}
                  >
                    <SelectTrigger className="h-12 w-[140px] border-2 border-gray-200 dark:border-gray-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="codigo">Código</SelectItem>
                      <SelectItem value="codigo_barras">Cod. Barras</SelectItem>
                      <SelectItem value="descricao">Descrição</SelectItem>
                      <SelectItem value="referencia">Referência</SelectItem>
                      <SelectItem value="all">Todos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="relative">
                  {showProductSearch && productResults.length > 0 && (
                    <div className="absolute z-50 w-full bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-72 overflow-auto mt-2">
                      {productResults.map(produto => {
                        const estoque = Number(produto.quantidade || 0);
                        const semEstoque = estoque <= 0 && normalizeProdutoTipo(produto.tipo) === 'produto';
                        const valorAvista = Number(produto.preco_venda || produto.valor_venda || 0);
                        return (
                          <div
                            key={produto.id}
                            className={cn(
                              "p-3 border-b last:border-0 transition-colors cursor-pointer",
                              semEstoque 
                                ? "bg-red-50 dark:bg-red-900/20" 
                                : "bg-white dark:bg-gray-900 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                            )}
                            onClick={() => !semEstoque && handleAddProduct(produto, 'avista')}
                          >
                            <div className="flex justify-between items-center gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-base truncate">{produto.descricao || ''}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-gray-500">
                                    {produto.codigo && `Cód: ${produto.codigo}`}
                                    {produto.codigo_barras && ` • ${produto.codigo_barras}`}
                                  </span>
                                  {normalizeProdutoTipo(produto.tipo) === 'produto' && (
                                    <span className={cn(
                                      "text-xs px-1.5 py-0.5 rounded",
                                      semEstoque 
                                        ? "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400" 
                                        : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400"
                                    )}>
                                      Est: {estoque}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="text-lg font-bold text-emerald-600 tabular-nums shrink-0">
                                {currencyFormatters.brl(valorAvista)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Cliente - Card mais visível */}
            <Card className={cn(
              "border-2 transition-all cursor-pointer",
              selectedCliente 
                ? "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-900/20" 
                : clienteExpanded
                  ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/30"
                  : "border-gray-200 hover:border-blue-300 dark:border-gray-700 dark:hover:border-blue-700"
            )}>
              <CardContent className="p-3">
                <div 
                  className="flex items-center gap-3"
                  onClick={() => !selectedCliente && setClienteExpanded(!clienteExpanded)}
                >
                  <User className={cn(
                    "h-5 w-5",
                    selectedCliente ? "text-blue-600" : "text-gray-400"
                  )} />
                  {selectedCliente ? (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{selectedCliente.nome}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {selectedCliente.cpf_cnpj} {selectedCliente.telefone && `• ${selectedCliente.telefone}`}
                        </p>
                      </div>
                      <button
                        className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-full transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCliente(null);
                          setClienteSearch('');
                        }}
                      >
                        <X className="h-4 w-4 text-gray-500 hover:text-red-500" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-gray-600 dark:text-gray-400 flex-1">Selecionar Cliente</span>
                      <kbd className="px-2 py-1 text-[10px] bg-gray-100 dark:bg-gray-800 rounded text-gray-500 font-mono border">F3</kbd>
                      <ChevronDown className={cn(
                        "h-4 w-4 text-gray-400 transition-transform",
                        clienteExpanded && "rotate-180"
                      )} />
                    </>
                  )}
                </div>
                
                {/* Busca Cliente expandida */}
                {clienteExpanded && !selectedCliente && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="cliente-search-input"
                          placeholder={
                            clienteSearchField === 'all'
                              ? "Buscar por nome, CPF, telefone..."
                              : clienteSearchField === 'nome'
                              ? "Buscar por nome..."
                              : clienteSearchField === 'cpf_cnpj'
                              ? "Buscar por CPF/CNPJ..."
                              : "Buscar por telefone..."
                          }
                          value={clienteSearch}
                          onChange={(e) => setClienteSearch(e.target.value)}
                          onFocus={() => setShowClienteSearch(true)}
                          className="pl-10 h-10 text-sm border-2 border-gray-200 focus:border-blue-500"
                          autoFocus
                        />
                      </div>
                      <Select value={clienteSearchField} onValueChange={(value: any) => setClienteSearchField(value)}>
                        <SelectTrigger className="h-10 w-[140px] border-2 border-gray-200 dark:border-gray-700">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="nome">Nome</SelectItem>
                          <SelectItem value="cpf_cnpj">CPF/CNPJ</SelectItem>
                          <SelectItem value="telefone">Telefone</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {showClienteSearch && clienteSearchLoading && (
                      <p className="mt-2 text-xs text-muted-foreground text-center py-2">Buscando...</p>
                    )}
                    {showClienteSearch && !clienteSearchLoading && clienteResults.length > 0 && (
                      <div className="mt-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg max-h-40 overflow-auto">
                        {clienteResults.map(cliente => (
                          <div
                            key={cliente.id}
                            className="p-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer border-b last:border-0 transition-colors"
                            onClick={() => {
                              handleSelectCliente(cliente);
                              setClienteExpanded(false);
                            }}
                          >
                            <p className="font-semibold text-sm">{cliente.nome}</p>
                            <p className="text-xs text-gray-500">
                              {cliente.cpf_cnpj} • {cliente.telefone || cliente.whatsapp}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                    {clienteSearch && !clienteSearchLoading && clienteResults.length === 0 && (
                      <p className="mt-2 text-xs text-gray-500 text-center py-2">Nenhum cliente encontrado</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Carrinho */}
            <Card className="border flex-1 flex flex-col min-h-[200px]">
              <CardHeader className="p-3 pb-2 border-b">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <ShoppingCart className="h-4 w-4" />
                    Carrinho
                  </span>
                  {cart.length > 0 && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded">
                      {cart.length} {cart.length === 1 ? 'item' : 'itens'}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-3 flex-1 overflow-auto">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-8">
                    <ShoppingCart className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-2" />
                    <p className="text-sm text-gray-400">Carrinho vazio</p>
                    <p className="text-xs text-gray-300 mt-1">Use <kbd className="px-1 bg-gray-100 rounded text-[10px]">F2</kbd> para buscar</p>
                  </div>
                ) : (
                  <div className="space-y-2 md:space-y-3">
                    {cart.map((item, index) => (
                      <div key={index} className="border rounded-lg p-2 md:p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0 pr-2">
                            <p className="font-medium text-sm md:text-base truncate">{item.produto_nome}</p>
                            {item.produto_codigo && (
                              <p className="text-xs text-muted-foreground">Cód: {item.produto_codigo}</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 md:h-6 md:w-6 flex-shrink-0"
                            onClick={() => handleRemoveItem(index)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
                          <div>
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">Qtd</Label>
                              {item.produto_tipo === 'produto' && item.estoque_disponivel !== undefined && (
                                <span className={cn(
                                  "text-[10px]",
                                  item.quantidade > item.estoque_disponivel 
                                    ? "text-red-500 font-medium" 
                                    : "text-gray-400"
                                )}>
                                  Est: {item.estoque_disponivel}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 md:h-7 md:w-7"
                                onClick={() => handleUpdateQuantity(index, -1)}
                                disabled={item.quantidade <= 0.001}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <Input
                                type="number"
                                value={item.quantidade}
                                onChange={(e) => {
                                  let qtd = Math.max(0.001, parseFloat(e.target.value) || 0);
                                  // Bloquear quantidade maior que estoque
                                  if (item.produto_tipo === 'produto' && item.estoque_disponivel !== undefined) {
                                    if (qtd > item.estoque_disponivel) {
                                      toast({ 
                                        title: 'Estoque insuficiente', 
                                        description: `Máximo: ${item.estoque_disponivel}`,
                                        variant: 'destructive' 
                                      });
                                      qtd = item.estoque_disponivel;
                                    }
                                  }
                                  const valorBruto = item.valor_unitario * qtd;
                                  const descontoCalculado = (valorBruto * (item.desconto_percentual || 0)) / 100;
                                  setCart(cart.map((it, i) =>
                                    i === index ? { ...it, quantidade: qtd, desconto: descontoCalculado } : it
                                  ));
                                }}
                                className={cn(
                                  "w-14 md:w-16 h-8 md:h-7 text-center text-xs md:text-sm",
                                  item.produto_tipo === 'produto' && 
                                  item.estoque_disponivel !== undefined && 
                                  item.quantidade > item.estoque_disponivel && 
                                  "border-red-500 text-red-500"
                                )}
                                min="0.001"
                                step="0.001"
                              />
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 md:h-7 md:w-7"
                                onClick={() => handleUpdateQuantity(index, 1)}
                                disabled={item.produto_tipo === 'produto' && item.estoque_disponivel !== undefined && item.quantidade >= item.estoque_disponivel}
                                title={item.produto_tipo === 'produto' && item.estoque_disponivel !== undefined && item.quantidade >= item.estoque_disponivel ? 'Estoque máximo atingido' : ''}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs">Unit.</Label>
                            <Input
                              type="number"
                              value={item.valor_unitario}
                              onChange={(e) => {
                                const valor = parseFloat(e.target.value) || 0;
                                const valorBruto = valor * item.quantidade;
                                const descontoCalculado = (valorBruto * (item.desconto_percentual || 0)) / 100;
                                setCart(cart.map((it, i) =>
                                  i === index ? { ...it, valor_unitario: valor, desconto: descontoCalculado } : it
                                ));
                              }}
                              className="h-8 md:h-7 text-xs md:text-sm"
                              step="0.01"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Desc. % (máx {limiteDescontoMaximo}%)</Label>
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                value={item.desconto_percentual || 0}
                                onChange={(e) => {
                                  const percentual = parseFloat(e.target.value) || 0;
                                  handleUpdateItemDiscount(index, percentual);
                                }}
                                className="h-8 md:h-7 text-xs md:text-sm w-16"
                                step="0.5"
                                min="0"
                                max={limiteDescontoMaximo}
                              />
                              <span className="text-xs text-muted-foreground">%</span>
                            </div>
                            {(item.desconto || 0) > 0 && (
                              <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">
                                -{currencyFormatters.brl(item.desconto || 0)}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <Label className="text-xs">Total</Label>
                            <p className="font-semibold text-sm md:text-base">
                              {currencyFormatters.brl((item.valor_unitario * item.quantidade) - (item.desconto || 0))}
                            </p>
                          </div>
                        </div>
                        {item.observacao && (
                          <div className="mt-2">
                            <Label className="text-xs">Observação</Label>
                            <Input
                              value={item.observacao}
                              onChange={(e) => {
                                setCart(cart.map((it, i) =>
                                  i === index ? { ...it, observacao: e.target.value } : it
                                ));
                              }}
                              placeholder="Ex: Película aplicada"
                              className="h-8 md:h-7 text-xs md:text-sm"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Coluna direita - Resumo + Ações */}
          <div className="flex flex-col h-full">
            <Card className="border border-gray-200 dark:border-gray-700 flex-1">
              <CardContent className="p-4 flex flex-col h-full">
                {/* Header Resumo */}
                <div className="flex items-center justify-between mb-3 pb-2 border-b">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Resumo</span>
                </div>
                
                {/* Valores */}
                {/* ESTADO PÓS-VENDA: Quando finalizada */}
                {isEditing && sale && !sale.is_draft ? (
                  <div className="space-y-4">
                    {/* Confirmação de venda */}
                    <div className="text-center py-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                      <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">Venda Finalizada</p>
                      <p className="text-3xl font-black text-gray-900 dark:text-white mt-1 tabular-nums">
                        {currencyFormatters.brl(totals.total)}
                      </p>
                    </div>
                    
                    {/* Info pagamento */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Pago</span>
                        <span className="font-semibold text-emerald-600">{currencyFormatters.brl(totalPago)}</span>
                      </div>
                      {saldoRestante > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Restante</span>
                          <span className="font-semibold text-orange-500">{currencyFormatters.brl(saldoRestante)}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Ações pós-venda */}
                    <div className="space-y-2">
                      <Button
                        className="w-full h-10 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => {
                          limparPDV();
                          // Navegar no próximo tick para garantir que o estado foi limpo antes da troca de rota
                          setTimeout(() => {
                            navigate('/pdv', { replace: true });
                          }, 0);
                        }}
                      >
                        Nova Venda
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={handlePrintCupom}
                        >
                          Reimprimir
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={() => navigate('/pdv/vendas')}
                        >
                          Ver Vendas
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* ESTADO NORMAL: Em edição/criação */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-baseline">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Subtotal</span>
                        <span className="text-base font-semibold tabular-nums">{currencyFormatters.brl(totals.subtotal)}</span>
                      </div>
                      {totals.descontoItens > 0 && (
                        <div className="flex justify-between items-baseline">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Desc. Itens</span>
                          <span className="text-base font-semibold text-red-500 tabular-nums">-{currencyFormatters.brl(totals.descontoItens)}</span>
                        </div>
                      )}
                      {/* Desconto extra: ocultar em faturamento de OS (total já é o da OS) */}
                      {!sale?.ordem_servico_id && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Desconto</span>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-400">R$</span>
                            <Input
                              type="number"
                              value={descontoTotal}
                              onChange={(e) => setDescontoTotal(parseFloat(e.target.value) || 0)}
                              className="h-8 w-24 text-sm text-right font-medium"
                              step="0.01"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* TOTAL - DESTAQUE MÁXIMO */}
                    <div className={cn(
                      "mt-4 p-4 rounded-xl",
                      totals.total > 0 
                        ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg" 
                        : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                    )}>
                      <div className="flex justify-between items-center">
                        <span className="text-base font-semibold">TOTAL</span>
                        <span className="text-3xl font-black tabular-nums tracking-tight">
                          {currencyFormatters.brl(totals.total)}
                        </span>
                      </div>
                    </div>

                    {/* Adiantamento OS: mostrar Total Pago e Saldo só em rascunho ou com itens (não mostrar resquícios de venda finalizada com carrinho vazio) */}
                    {totalPago > 0 && (sale?.is_draft === true || cart.length > 0) && (
                      <div className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Total Pago</span>
                          <span className="font-semibold text-emerald-600">{currencyFormatters.brl(totalPago)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Saldo restante</span>
                          <span className="font-semibold text-orange-500">{currencyFormatters.brl(saldoRestante)}</span>
                        </div>
                      </div>
                    )}

                    {/* AÇÕES PRINCIPAIS */}
                    <div className="mt-5 space-y-3">
                      {/* FINALIZAR VENDA - BOTÃO DOMINANTE */}
                      <Button
                        className="w-full h-12 text-base font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg transition-all"
                        onClick={handleFinalize}
                        disabled={cart.length === 0 || isSaving || isDeleting}
                      >
                        <DollarSign className="h-5 w-5 mr-2" />
                        {isSaving ? 'Finalizando...' : 'Finalizar Venda'}
                        <kbd className="ml-3 px-1.5 py-0.5 text-[10px] bg-emerald-700/50 rounded">F4</kbd>
                      </Button>

                      {/* GERAR ORÇAMENTO - Secundário */}
                      <Button
                        variant="outline"
                        className="w-full h-9 text-sm text-gray-600 border-gray-300 hover:bg-gray-100 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-800"
                        onClick={handleGerarOrcamento}
                        disabled={cart.length === 0 || isGeneratingOrcamento || isSaving}
                      >
                        <FileCheck className="h-4 w-4 mr-2" />
                        {isGeneratingOrcamento ? 'Gerando...' : 'Gerar Orçamento'}
                      </Button>

                      {/* Excluir rascunho */}
                      {isEditing && (sale?.is_draft || isAdmin) && (
                        <button
                          className="w-full text-xs text-gray-400 hover:text-red-500 py-1.5 transition-colors"
                          onClick={handleDelete}
                          disabled={isSaving || isDeleting}
                        >
                          {isDeleting ? 'Excluindo...' : 'Excluir rascunho'}
                        </button>
                      )}
                    </div>

                    {/* Observações */}
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <Textarea
                        value={observacoes}
                        onChange={(e) => setObservacoes(e.target.value)}
                        placeholder="Observações da venda..."
                        rows={2}
                        className="resize-none text-sm bg-gray-50 dark:bg-gray-800/50 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
                      />
                    </div>

                    {/* Links secundários - Importar OS e Vendas em destaque */}
                    <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2 flex-wrap">
                      {!isEditing && !sale?.ordem_servico_id && cart.length === 0 ? (
                        <button
                          type="button"
                          className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-violet-300 dark:border-violet-600 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/50 hover:border-violet-400 dark:hover:border-violet-500 transition-all font-medium text-sm shadow-sm"
                          onClick={handleOpenFaturarOSModal}
                        >
                          <Wrench className="h-4 w-4" />
                          Importar OS
                          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-violet-200 dark:bg-violet-800 border border-violet-300 dark:border-violet-600 rounded text-violet-800 dark:text-violet-200">F6</kbd>
                        </button>
                      ) : (
                        <span></span>
                      )}
                      <button
                        type="button"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:border-blue-400 dark:hover:border-blue-500 transition-all font-medium text-sm shadow-sm"
                        onClick={() => navigate('/pdv/vendas')}
                      >
                        <BarChart3 className="h-4 w-4" />
                        {isAdmin ? 'Vendas' : 'Minhas vendas'}
                      </button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Widget inferior - Atalhos e Status */}
        <div className="mt-4 px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 flex-wrap">
              <span className="font-semibold text-gray-700 dark:text-gray-300">Atalhos:</span>
              <span className="flex items-center gap-1.5">
                <kbd className="px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono shadow-sm">F2</kbd>
                <span>Produto</span>
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="px-2 py-1 bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700 rounded text-xs font-mono text-blue-700 dark:text-blue-300 shadow-sm">F3</kbd>
                <span>Cliente</span>
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 rounded text-xs font-mono text-emerald-700 dark:text-emerald-300 shadow-sm">F4</kbd>
                <span className="font-medium">Finalizar</span>
              </span>
              <span className="flex items-center gap-1.5 font-medium text-violet-700 dark:text-violet-300">
                <kbd className="px-2 py-1 bg-violet-100 dark:bg-violet-900 border border-violet-300 dark:border-violet-700 rounded text-xs font-mono text-violet-800 dark:text-violet-200 shadow-sm">F6</kbd>
                <span>Importar OS</span>
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono shadow-sm">ESC</kbd>
                <span>Fechar</span>
              </span>
            </div>
            {/* Configurar impressão + Abrir/Fechar Caixa */}
            <div className="flex items-center gap-4 text-sm">
              {!isEditing && (hasPermission('vendas.create') || hasPermission('vendas.view')) && (
                <Button variant="outline" size="sm" asChild className="gap-1.5">
                  <Link to="/pdv/configuracao-cupom">
                    <Printer className="h-4 w-4" />
                    Configurar impressão
                  </Link>
                </Button>
              )}
              {cashSession && cashSession.status === 'open' ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 border-orange-300 text-orange-600 hover:bg-orange-50 hover:text-orange-700 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950/50"
                  onClick={() => setShowCloseCashDialog(true)}
                >
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  Fechar Caixa
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 border-emerald-300 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                  onClick={() => setShowOpenCashDialog(true)}
                >
                  <span className="w-2 h-2 bg-orange-500 rounded-full" />
                  Abrir Caixa
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dialog: Abrir Caixa */}
      <Dialog open={showOpenCashDialog} onOpenChange={setShowOpenCashDialog}>
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
                value={cashValorInicial}
                onChange={(e) => setCashValorInicial(e.target.value)}
                placeholder="0.00"
                autoFocus
                className="h-9 md:h-10 text-sm border-2 border-gray-300"
              />
            </div>
            <p className="text-xs md:text-sm text-muted-foreground">
              Informe o valor em dinheiro que está no caixa no momento da abertura.
            </p>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 pt-3 md:pt-4">
            <Button variant="outline" onClick={() => setShowOpenCashDialog(false)} className="w-full sm:w-auto h-9 md:h-10">
              Cancelar
            </Button>
            <LoadingButton onClick={handleOpenCashPDV} loading={isProcessingCash} className="w-full sm:w-auto h-9 md:h-10">
              Abrir Caixa
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Fechar Caixa — maior e mais visível */}
      <Dialog open={showCloseCashDialog} onOpenChange={(open) => {
        setShowCloseCashDialog(open);
        if (!open) {
          setCashValorFinal('');
          setCashDivergencia('');
          setCashJustificativa('');
        }
      }}>
        <DialogContent className="p-4 md:p-6 max-w-[96vw] md:max-w-4xl max-h-[95vh] overflow-y-auto text-base">
          <DialogHeader className="pb-3 md:pb-4">
            <DialogTitle className="text-lg md:text-xl">Fechar Caixa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 md:space-y-5">
            {/* Conferência por forma de pagamento */}
            {!closeDialogLoadingValor && Object.keys(closeDialogPagamentosPorForma).length > 0 && (() => {
              const cashValorInicial = Number(cashSession?.valor_inicial || 0);
              const cashVendasDinheiro = closeDialogPagamentosPorForma['dinheiro'] || 0;
              const cashTotalDinheiro = cashValorInicial + cashVendasDinheiro;
              return (
              <div className="rounded-xl border-2 border-blue-200 bg-blue-50/30 p-4 md:p-5">
                <p className="text-sm font-semibold text-muted-foreground mb-3">Conferência por forma de pagamento</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.entries(closeDialogPagamentosPorForma)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([forma, valor]) => {
                      const valorExibir = forma === 'dinheiro' ? cashTotalDinheiro : valor;
                      return (
                        <div key={forma} className="flex flex-col rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">
                              {forma === 'dinheiro' ? 'Dinheiro (abertura + vendas)' : PAYMENT_METHOD_LABELS[forma as keyof typeof PAYMENT_METHOD_LABELS] || forma}
                            </span>
                            <span className="font-semibold">{currencyFormatters.brl(valorExibir)}</span>
                          </div>
                          {forma === 'dinheiro' && cashValorInicial > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">{currencyFormatters.brl(cashValorInicial)} abertura + {currencyFormatters.brl(cashVendasDinheiro)} vendas</p>
                          )}
                        </div>
                      );
                    })}
                </div>
                <div className="mt-3 pt-3 border-t-2 border-gray-200 space-y-1">
                  <div className="flex justify-between text-sm font-medium">
                    <span>Total vendas</span>
                    <span>{currencyFormatters.brl(closeDialogTotalVendas)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-primary">
                    <span>Total do caixa (abertura + vendas)</span>
                    <span>{currencyFormatters.brl(closeDialogValorEsperado)}</span>
                  </div>
                </div>
              </div>
              );
            })()}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <div>
                <Label className="text-xs md:text-sm">Valor Esperado (R$)</Label>
                <Input
                  type="text"
                  value={closeDialogLoadingValor ? '...' : closeDialogValorEsperado.toFixed(2)}
                  disabled
                  className="bg-muted h-9 md:h-10 text-sm border-2 border-gray-300"
                />
                <p className="text-[10px] md:text-xs text-muted-foreground mt-1">Calculado automaticamente</p>
              </div>
              <div>
                <Label className="text-xs md:text-sm">Valor Final Contado (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={cashValorFinal}
                  onChange={(e) => {
                    setCashValorFinal(e.target.value);
                    const final = parseFloat(e.target.value) || 0;
                    setCashDivergencia((final - closeDialogValorEsperado).toFixed(2));
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
                value={cashDivergencia}
                onChange={(e) => setCashDivergencia(e.target.value)}
                className={cn(
                  'h-9 md:h-10 text-sm border-2',
                  parseFloat(cashDivergencia || '0') !== 0 ? 'border-orange-500' : 'border-gray-300'
                )}
                disabled
              />
              <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                {parseFloat(cashDivergencia || '0') > 0 ? 'Sobra no caixa' : parseFloat(cashDivergencia || '0') < 0 ? 'Falta no caixa' : 'Sem divergência'}
              </p>
            </div>
            {parseFloat(cashDivergencia || '0') !== 0 && (
              <div>
                <Label className="text-xs md:text-sm">Justificativa da Divergência</Label>
                <Textarea
                  value={cashJustificativa}
                  onChange={(e) => setCashJustificativa(e.target.value)}
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
              disabled={closeDialogLoadingValor}
              onClick={() => void handlePrintFechamentoTermicoPDV()}
              className="w-full sm:w-auto h-9 md:h-10 border-2 border-gray-300"
            >
              <Printer className="h-3.5 w-3.5 mr-1.5" />
              Imprimir extrato (térmica)
            </Button>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:ml-auto">
            <Button variant="outline" onClick={() => setShowCloseCashDialog(false)} className="w-full sm:w-auto h-9 md:h-10">
              Cancelar
            </Button>
            <LoadingButton onClick={handleCloseCashPDV} loading={isProcessingCash} className="w-full sm:w-auto h-9 md:h-10">
              Fechar Caixa
            </LoadingButton>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Checkout */}
      <Dialog open={showCheckout} onOpenChange={(open) => {
        setShowCheckout(open);
        if (open) {
          // Resetar valores quando abrir o modal
          setCheckoutPayment({
            forma_pagamento: 'dinheiro',
            valor: undefined,
            troco: 0,
          });
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Finalizar Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Pagamentos já adicionados */}
            {payments && payments.filter((p: any) => p.status === 'confirmed').length > 0 && (
              <div className="bg-muted/50 p-4 rounded-lg">
                <Label className="text-sm font-semibold mb-2 block">Pagamentos Adicionados:</Label>
                <div className="space-y-2">
                  {payments
                    .filter((p: any) => p.status === 'confirmed')
                    .map((payment: any) => (
                      <div key={payment.id} className="flex justify-between items-center text-sm">
                        <span className="capitalize">{paymentMethodsForCheckout.find(p => p.code === payment.forma_pagamento)?.name || PAYMENT_METHOD_LABELS[payment.forma_pagamento as PaymentMethod] || payment.forma_pagamento}</span>
                        <span className="font-semibold">{currencyFormatters.brl(payment.valor)}</span>
                      </div>
                    ))}
                  <div className="flex justify-between items-center pt-2 border-t font-semibold">
                    <span>Total Pago:</span>
                    <span>{currencyFormatters.brl(totalPago)}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Forma de Pagamento</Label>
                <Select
                  value={checkoutPayment.forma_pagamento}
                  onValueChange={(v: PaymentMethod) => {
                    // Verificar se é voucher/vale - procurar no nome ou código da forma de pagamento
                    const selectedPM = paymentMethodsForCheckout.find(pm => pm.code === v);
                    const isVoucher = selectedPM && (
                      selectedPM.name.toLowerCase().includes('vale') ||
                      selectedPM.name.toLowerCase().includes('voucher') ||
                      selectedPM.code.toLowerCase().includes('vale') ||
                      selectedPM.code.toLowerCase().includes('voucher')
                    );
                    
                    if (isVoucher) {
                      // Abrir modal de voucher
                      setShowCheckout(false);
                      setShowVoucherPayment(true);
                      return;
                    }
                    
                    const isDinheiro = v === 'dinheiro';
                    const pm = paymentMethodsForCheckout.find(pm => pm.code === v);
                    const aceitaParcelas = pm?.accepts_installments ?? ['credito', 'credito_parcelado'].includes(v);
                    const maxParcelas = pm?.max_installments ?? 12;
                    setCheckoutPayment({
                      ...checkoutPayment,
                      forma_pagamento: v,
                      valor: undefined,
                      troco: 0,
                      parcelas: aceitaParcelas ? 1 : undefined,
                      taxa_juros: undefined,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethodsForCheckout
                      .filter(pm => pm.is_active)
                      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                      .map((pm) => (
                        <SelectItem key={pm.id} value={pm.code}>
                          {pm.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor Recebido</Label>
                <Input
                  type="number"
                  value={checkoutPayment.valor ?? ''}
                  onChange={(e) => {
                    const valor = e.target.value === '' ? undefined : parseFloat(e.target.value) || 0;
                    setCheckoutPayment({
                      ...checkoutPayment,
                      valor,
                      troco: checkoutPayment.forma_pagamento === 'dinheiro' && valor && valor > saldoRestante
                        ? valor - saldoRestante
                        : 0,
                    });
                  }}
                  step="0.01"
                  placeholder={`Máx: ${currencyFormatters.brl(saldoRestante)}`}
                />
              </div>
            </div>
            
            {checkoutPayment.forma_pagamento === 'dinheiro' && checkoutPayment.valor && checkoutPayment.valor > saldoRestante && (
              <div>
                <Label>Troco</Label>
                <Input
                  type="text"
                  value={currencyFormatters.brl(checkoutPayment.troco || 0)}
                  readOnly
                  className="bg-muted font-semibold text-lg"
                />
              </div>
            )}

            {(() => {
              const selectedPM = paymentMethodsForCheckout.find(pm => pm.code === checkoutPayment.forma_pagamento);
              const ehCredito = selectedPM?.name?.toLowerCase().includes('crédito') ?? selectedPM?.name?.toLowerCase().includes('credito') ?? ['credito', 'credito_parcelado', 'cartao_credito'].includes(checkoutPayment.forma_pagamento);
              const aceitaParcelas = selectedPM?.accepts_installments ?? ehCredito;
              const maxParcelas = Math.max(1, selectedPM?.max_installments ?? 12);
              if (!aceitaParcelas) return null;
              const opcoes = Array.from({ length: maxParcelas }, (_, i) => i + 1);
              return (
                <div>
                  <Label>Número de parcelas</Label>
                  <Select
                    value={checkoutPayment.parcelas?.toString() || '1'}
                    onValueChange={(v) => setCheckoutPayment({ ...checkoutPayment, parcelas: parseInt(v, 10) })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {opcoes.map(n => (
                        <SelectItem key={n} value={n.toString()}>{n === 1 ? '1x (à vista)' : `${n}x`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">A taxa é definida em Admin → Formas de Pagamento → Taxas.</p>
                </div>
              );
            })()}

            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between">
                <span>Total da Venda:</span>
                <span className="font-semibold">{currencyFormatters.brl(sale?.total || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Pago:</span>
                <span className="font-semibold">{currencyFormatters.brl(totalPago)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Saldo Restante:</span>
                <span className={saldoRestante > 0 ? 'text-red-600' : 'text-green-600'}>
                  {currencyFormatters.brl(saldoRestante)}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCheckout(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAddPayment}
              disabled={!checkoutPayment.valor || checkoutPayment.valor <= 0 || checkoutPayment.valor === undefined || isAddingPayment}
            >
              {isAddingPayment ? 'Confirmando...' : 'Confirmar Pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Pagamento com Voucher */}
      <VoucherPayment
        open={showVoucherPayment}
        onOpenChange={setShowVoucherPayment}
        saleTotal={saldoRestante}
        saleId={id}
        onVoucherApplied={async (voucherId, amount, voucherCode) => {
          if (!id) return;
          if (Number(amount) > saldoRestante + 0.01) {
            toast({
              title: 'Valor acima do permitido',
              description: `O voucher não pode ser maior que o saldo restante (${currencyFormatters.brl(saldoRestante)}).`,
              variant: 'destructive',
            });
            return;
          }
          try {
            // Criar pagamento usando voucher
            // Encontrar o código da forma de pagamento voucher
            const voucherPM = paymentMethods.find(pm => 
              pm.name.toLowerCase().includes('vale') || 
              pm.name.toLowerCase().includes('voucher') ||
              pm.code.toLowerCase().includes('vale') ||
              pm.code.toLowerCase().includes('voucher')
            );
            
            const paymentData: PaymentFormData = {
              forma_pagamento: (voucherPM?.code || 'carteira_digital') as PaymentMethod,
              valor: amount,
              troco: 0,
            };
            
            const payment = await addPayment(paymentData);
            await confirmPayment(payment.id);
            
            toast({ 
              title: 'Voucher aplicado com sucesso!', 
              description: `Voucher ${voucherCode} aplicado no valor de ${currencyFormatters.brl(amount)}`
            });
            
            // Recarregar dados
            await loadSale();
            
            // Fechar modal de voucher
            setShowVoucherPayment(false);
            
            // Verificar se está totalmente pago e finalizar automaticamente
            const updatedSale = await getSaleById(id);
            if (updatedSale && Number(updatedSale.total_pago) >= Number(updatedSale.total)) {
              await finalizeSale(id);
              
              // Mudar status da OS para "entregue_faturada" se houver vínculo
              if (updatedSale.ordem_servico_id) {
                try {
                  const os = getOSById(updatedSale.ordem_servico_id);
                  if (os) {
                    await updateOSStatus(updatedSale.ordem_servico_id, 'entregue_faturada');
                    console.log(`OS #${os.numero} mudada para entregue_faturada automaticamente após pagamento via voucher`);
                    void scheduleOsPosVendaFollowup(updatedSale.ordem_servico_id);
                    
                    // Enviar mensagem configurada (config global por empresa, API)
                    try {
                      const telefone = os.telefone_contato;
                      if (telefone) {
                        const configStatus = getConfigByStatus?.('entregue_faturada') ?? getConfigByStatus?.('entregue');
                        if (configStatus?.notificar_whatsapp && configStatus.mensagem_whatsapp) {
                          let mensagem = configStatus.mensagem_whatsapp
                            .replace(/{cliente}/g, os.cliente_nome || 'Cliente')
                            .replace(/{numero}/g, os.numero?.toString() || '')
                            .replace(/{status}/g, configStatus.label || 'Entregue Faturada')
                            .replace(/{marca}/g, os.marca_nome || '')
                            .replace(/{modelo}/g, os.modelo_nome || '');
                          
                          let numero = telefone.replace(/\D/g, '');
                          numero = numero.replace(/^0+/, '');
                          if (!numero.startsWith('55')) {
                            if (numero.startsWith('0')) {
                              numero = numero.substring(1);
                            }
                            if (numero.length === 10 || numero.length === 11) {
                              numero = '55' + numero;
                            }
                          }
                          
                          if (numero.length >= 12 && numero.length <= 13) {
                            await sendWhatsAppMessage({ number: numero, body: mensagem });
                          }
                        }
                      }
                    } catch (msgError) {
                      console.error('Erro ao enviar mensagem:', msgError);
                    }
                  }
                } catch (osError: any) {
                  console.error('Erro ao finalizar OS:', osError);
                  // Não bloquear a venda se houver erro ao finalizar a OS
                }
              }
              
              toast({ title: 'Venda finalizada com sucesso!' });
              
              // Preparar para impressão
              setPendingSaleForCupom(updatedSale);
              setTimeout(async () => {
                await loadSale();
                setTimeout(async () => {
                  const finalSale = await getSaleById(id);
                  if (finalSale) {
                    await handlePrintCupom(finalSale);
                  }
                }, 500);
              }, 500);
            }
          } catch (error: any) {
            console.error('Erro ao aplicar voucher:', error);
            toast({
              title: 'Erro ao aplicar voucher',
              description: error.message || 'Não foi possível aplicar o voucher',
              variant: 'destructive'
            });
          }
        }}
      />

      {/* Modal de Faturar OS */}
      <Dialog open={showFaturarOSModal} onOpenChange={setShowFaturarOSModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Faturar Ordem de Serviço</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Busca */}
            <div>
              <Input
                placeholder="Buscar OS por número, cliente ou telefone..."
                value={osSearch}
                onChange={(e) => setOsSearch(e.target.value)}
                className="w-full text-base"
              />
            </div>

            {/* Lista de OSs */}
            {isLoadingOS ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Carregando OSs...</p>
              </div>
            ) : (
              <div className="space-y-2">
                {osList
                  .filter(os => {
                    if (!osSearch) return true;
                    const search = osSearch.toLowerCase();
                    return (
                      os.numero?.toString().includes(search) ||
                      os.cliente_nome?.toLowerCase().includes(search) ||
                      os.telefone_contato?.includes(search)
                    );
                  })
                  .map(os => {
                    const itens = os.itens || [];
                    // Incluir peça, produto e serviço no total (evita Total R$ 0 quando OS tem só serviço)
                    const itensComValor = itens.filter((item: any) =>
                      item.tipo === 'peca' || item.tipo === 'produto' || item.tipo === 'servico'
                    );
                    const totalPorItens = itensComValor.reduce((sum: number, item: any) =>
                      sum + (Number(item.valor_total) || 0), 0
                    );
                    // Fallback: usar valor_total da OS quando a soma dos itens for zero
                    const totalOS = totalPorItens > 0 ? totalPorItens : (Number((os as any).valor_total) || 0);

                    return (
                      <Card key={os.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline">OS #{os.numero}</Badge>
                              <span className="font-semibold">{os.cliente_nome}</span>
                              {os.telefone_contato && (
                                <span className="text-sm text-muted-foreground">
                                  {os.telefone_contato}
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p>Produtos: {(os.itens || []).length}</p>
                              <p>Total: {currencyFormatters.brl(totalOS)}</p>
                              {os.tipo_aparelho && (
                                <p>Aparelho: {os.tipo_aparelho} {os.marca_nome} {os.modelo_nome}</p>
                              )}
                            </div>
                          </div>
                          <Button
                            onClick={() => handleFaturarOS(os)}
                            disabled={isLoadingOS}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Faturar
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                
                {osList.filter(os => {
                  if (!osSearch) return true;
                  const search = osSearch.toLowerCase();
                  return (
                    os.numero?.toString().includes(search) ||
                    os.cliente_nome?.toLowerCase().includes(search) ||
                    os.telefone_contato?.includes(search)
                  );
                }).length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      {osSearch ? 'Nenhuma OS encontrada' : 'Nenhuma OS finalizada com produtos para faturar'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFaturarOSModal(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Sucesso do Orçamento */}
      <Dialog open={showOrcamentoModal} onOpenChange={(open) => !open && handleFecharOrcamentoModal(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <DialogTitle className="text-xl">Orçamento Gerado!</DialogTitle>
                <DialogDescription>
                  Orçamento #{orcamentoGerado?.numero} criado com sucesso
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Resumo do orçamento */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Cliente:</span>
                <span className="font-medium">{orcamentoGerado?.cliente_nome || 'Não identificado'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Itens:</span>
                <span className="font-medium">{cart.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Validade:</span>
                <span className="font-medium">
                  {orcamentoGerado?.data_validade 
                    ? new Date(orcamentoGerado.data_validade).toLocaleDateString('pt-BR')
                    : '7 dias'
                  }
                </span>
              </div>
              <div className="border-t dark:border-gray-700 pt-2 flex justify-between">
                <span className="font-semibold">Total:</span>
                <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400">
                  {currencyFormatters.brl(orcamentoGerado?.total || totals.total)}
                </span>
              </div>
            </div>

            {/* Ações */}
            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">O que deseja fazer?</p>
              
              {/* Imprimir/PDF */}
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-12"
                onClick={handlePrintOrcamento}
              >
                <Printer className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                <div className="text-left">
                  <div className="font-medium">Salvar PDF</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Baixar orçamento em PDF</div>
                </div>
              </Button>

              {/* WhatsApp via Ativa CRM */}
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-12 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-950"
                onClick={handleEnviarOrcamentoWhatsApp}
                disabled={sendingWhatsApp || (!selectedCliente?.telefone && !selectedCliente?.whatsapp)}
              >
                {sendingWhatsApp ? (
                  <div className="animate-spin h-5 w-5 border-2 border-green-600 border-t-transparent rounded-full" />
                ) : (
                  <MessageCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                )}
                <div className="text-left">
                  <div className="font-medium text-green-700 dark:text-green-400">
                    {sendingWhatsApp ? 'Enviando...' : 'Enviar por WhatsApp'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {selectedCliente?.telefone || selectedCliente?.whatsapp || 'Cliente sem telefone'}
                  </div>
                </div>
              </Button>

              {/* Converter em Venda */}
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-12 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950"
                onClick={handleConverterOrcamentoEmVenda}
              >
                <ArrowRight className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <div className="text-left">
                  <div className="font-medium text-blue-700 dark:text-blue-400">Converter em Venda</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Abrir como venda para finalizar</div>
                </div>
              </Button>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="ghost" 
              onClick={() => handleFecharOrcamentoModal(true)}
              className="text-gray-500"
            >
              Novo Atendimento
            </Button>
            <Button 
              onClick={() => handleFecharOrcamentoModal(false)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModernLayout>
  );
}

