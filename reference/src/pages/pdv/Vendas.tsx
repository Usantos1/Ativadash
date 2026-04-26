import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ModernLayout } from '@/components/ModernLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PermissionGate } from '@/components/PermissionGate';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Plus, Search, Eye, Edit, Filter, Printer, Download, Send, MoreVertical, X, Trash2,
  ShoppingCart, DollarSign, Calendar, User, Upload, CalendarDays, ReceiptText,
  CheckCircle, XCircle, AlertCircle, ChevronLeft, ChevronRight
} from 'lucide-react';
import { ImportarVendasRetroativas } from '@/components/pdv/ImportarVendasRetroativas';
import { generateCupomPDF, generateCupomTermica, printTermica } from '@/utils/pdfGenerator';
import { APP_PUBLIC_URL } from '@/utils/appUrl';
import { openWhatsApp, formatVendaMessage } from '@/utils/whatsapp';
import { useSales, useCancelRequests } from '@/hooks/usePDV';
import { useAuth } from '@/contexts/AuthContext';
import { Sale, SALE_STATUS_LABELS } from '@/types/pdv';
import type { CancelRequest } from '@/types/pdv';
import { from } from '@/integrations/db/client';
import { currencyFormatters, dateFormatters } from '@/utils/formatters';
import { getStoredValuesVisible, ValuesVisibilityToggle, MASKED_VALUE } from '@/components/dashboard/FinancialCards';
import { EmptyState } from '@/components/EmptyState';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const SALE_STATUS_COLORS: Record<Sale['status'], string> = {
  draft: 'bg-gray-100 text-gray-800',
  open: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  partial: 'bg-yellow-100 text-yellow-800',
  canceled: 'bg-red-100 text-red-800',
  refunded: 'bg-orange-100 text-orange-800',
  partial_refund: 'bg-amber-100 text-amber-800',
};

export default function Vendas() {
  const navigate = useNavigate();
  const { sales, isLoading, getSaleById, cancelSale, deleteSale } = useSales();
  const { isAdmin, profile } = useAuth();
  const { createRequest, requests: cancelRequests, isLoading: cancelRequestsLoading, approveRequest, rejectRequest, refreshRequests } = useCancelRequests();
  const { toast } = useToast();
  const [saleInfoMap, setSaleInfoMap] = useState<Record<string, { numero: number; total: number }>>({});
  const [requestToReject, setRequestToReject] = useState<CancelRequest | null>(null);
  const [rejectMotivo, setRejectMotivo] = useState('');
  const [isApproving, setIsApproving] = useState<string | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  // Default: mostrar histórico (últimos 30 dias) para não ficar "tudo zerado"
  const [dateFilter, setDateFilter] = useState<string>('today');
  
  // Estado do período personalizado
  const [customDateStart, setCustomDateStart] = useState<Date | undefined>(undefined);
  const [customDateEnd, setCustomDateEnd] = useState<Date | undefined>(undefined);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Estado do modal de cancelamento
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [isCanceling, setIsCanceling] = useState(false);
  
  // Estado do modal de exclusão
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSaleToDelete, setSelectedSaleToDelete] = useState<Sale | null>(null);
  const [deleteMotivo, setDeleteMotivo] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Estado do modal de preview
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewSale, setPreviewSale] = useState<any>(null);
  const [previewItems, setPreviewItems] = useState<any[]>([]);
  const [previewPayments, setPreviewPayments] = useState<any[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  
  // Estado do modal de importação retroativa
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Paginação
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const [valuesVisible, setValuesVisible] = useState(getStoredValuesVisible);
  const fmt = (n: number) => (valuesVisible ? currencyFormatters.brl(n) : MASKED_VALUE);

  const pendingCancelRequests = useMemo(() => cancelRequests.filter(r => r.status === 'pending'), [cancelRequests]);

  // Buscar número e total das vendas das solicitações pendentes
  useEffect(() => {
    if (pendingCancelRequests.length === 0) {
      setSaleInfoMap({});
      return;
    }
    const saleIds = [...new Set(pendingCancelRequests.map(r => r.sale_id))];
    from('sales')
      .select('id, numero, total')
      .in('id', saleIds)
      .execute()
      .then(({ data }) => {
        const map: Record<string, { numero: number; total: number }> = {};
        (data || []).forEach((s: any) => {
          map[s.id] = { numero: s.numero ?? 0, total: Number(s.total ?? 0) };
        });
        setSaleInfoMap(map);
      })
      .catch(() => setSaleInfoMap({}));
  }, [pendingCancelRequests.length, pendingCancelRequests.map(r => r.sale_id).join(',')]);

  const handleApproveRequest = async (req: CancelRequest) => {
    setIsApproving(req.id);
    try {
      await cancelSale(req.sale_id, req.motivo);
      await approveRequest(req.id, req.sale_id);
      refreshRequests();
      const info = saleInfoMap[req.sale_id];
      toast({
        title: 'Solicitação aprovada',
        description: info ? `Venda #${info.numero} foi cancelada.` : 'Venda cancelada.',
      });
    } catch (err: any) {
      toast({
        title: 'Erro ao aprovar',
        description: err.message || 'Não foi possível cancelar a venda.',
        variant: 'destructive',
      });
    } finally {
      setIsApproving(null);
    }
  };

  const handleRejectRequest = async () => {
    if (!requestToReject || !rejectMotivo.trim()) {
      toast({ title: 'Informe o motivo da rejeição', variant: 'destructive' });
      return;
    }
    setIsRejecting(true);
    try {
      await rejectRequest(requestToReject.id, rejectMotivo.trim());
      setRequestToReject(null);
      setRejectMotivo('');
      refreshRequests();
      toast({ title: 'Solicitação rejeitada' });
    } catch (err: any) {
      toast({
        title: 'Erro ao rejeitar',
        description: err.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsRejecting(false);
    }
  };

  // Filtrar vendas
  const filteredSales = useMemo(() => {
    let result = [...sales];

    // Filtro por status
    if (statusFilter !== 'all') {
      result = result.filter(sale => sale.status === statusFilter);
    }

    // Filtro por data
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (dateFilter === 'today') {
      result = result.filter(sale => {
        const saleDate = new Date(sale.created_at);
        saleDate.setHours(0, 0, 0, 0);
        return saleDate.getTime() === today.getTime();
      });
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      result = result.filter(sale => new Date(sale.created_at) >= weekAgo);
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      result = result.filter(sale => new Date(sale.created_at) >= monthAgo);
    } else if (dateFilter === 'custom' && customDateStart && customDateEnd) {
      const startDate = new Date(customDateStart);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(customDateEnd);
      endDate.setHours(23, 59, 59, 999);
      result = result.filter(sale => {
        const saleDate = new Date(sale.created_at);
        return saleDate >= startDate && saleDate <= endDate;
      });
    } else if (dateFilter === 'all') {
      // Sem filtro de data
    }

    // Filtro por busca
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(sale =>
        sale.numero.toString().includes(search) ||
        sale.cliente_nome?.toLowerCase().includes(search) ||
        sale.cliente_cpf_cnpj?.includes(search) ||
        sale.vendedor_nome?.toLowerCase().includes(search)
      );
    }

    return result;
  }, [sales, statusFilter, dateFilter, searchTerm, customDateStart, customDateEnd]);

  // Paginação: fatia da lista filtrada
  const totalPages = Math.max(1, Math.ceil(filteredSales.length / pageSize));
  const paginatedSales = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSales.slice(start, start + pageSize);
  }, [filteredSales, page, pageSize]);

  // Resetar página ao mudar filtros
  useEffect(() => {
    setPage(1);
  }, [statusFilter, dateFilter, searchTerm, customDateStart, customDateEnd]);

  // Estatísticas
  const stats = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    // Vendas de hoje
    const vendasHoje = sales.filter(s => {
      const data = new Date(s.created_at);
      data.setHours(0, 0, 0, 0);
      return data.getTime() === hoje.getTime();
    });

    const totalHoje = vendasHoje
      .filter(s => s.status === 'paid')
      .reduce((sum, s) => sum + Number(s.total), 0);

    // Vendas do período filtrado (usando filteredSales)
    const vendasPeriodo = filteredSales.filter(s => s.status === 'paid');
    const totalPeriodo = vendasPeriodo.reduce((sum, s) => sum + Number(s.total), 0);
    const ticketMedio = vendasPeriodo.length > 0 ? totalPeriodo / vendasPeriodo.length : 0;

    // Rascunhos e pendentes do período
    const rascunhos = filteredSales.filter(s => s.status === 'draft').length;
    const pendentes = filteredSales.filter(s => s.status === 'open' || s.status === 'partial').length;

    return {
      totalHoje: vendasHoje.filter(s => s.status === 'paid').length,
      totalHojeValor: totalHoje,
      // Período filtrado
      qtdPeriodo: vendasPeriodo.length,
      totalPeriodo,
      ticketMedio,
      rascunhos,
      pendentes,
    };
  }, [sales, filteredSales]);

  // Ações rápidas
  const handlePrintCupom = async (sale: Sale) => {
    try {
      const fullSale = await getSaleById(sale.id);
      if (!fullSale || !fullSale.items || !fullSale.payments) return;

      const cupomData = {
        numero: fullSale.numero,
        data: new Date(fullSale.created_at).toLocaleDateString('pt-BR'),
        hora: new Date(fullSale.created_at).toLocaleTimeString('pt-BR'),
        cliente: fullSale.cliente_nome ? {
          nome: fullSale.cliente_nome,
          cpf_cnpj: fullSale.cliente_cpf_cnpj || undefined,
          telefone: fullSale.cliente_telefone || undefined,
        } : undefined,
        itens: fullSale.items.map((item: any) => ({
          codigo: item.produto_codigo || item.produto_codigo_barras || undefined,
          nome: item.produto_nome,
          quantidade: Number(item.quantidade),
          valor_unitario: Number(item.valor_unitario),
          desconto: Number(item.desconto || 0),
          valor_total: Number(item.valor_total),
        })),
        subtotal: Number(fullSale.subtotal),
        total: Number(fullSale.total),
        desconto_total: (() => {
          const sub = Number(fullSale.subtotal || 0);
          const tot = Number(fullSale.total || 0);
          const fromSale = Math.max(0, sub - tot);
          if (fromSale > 0) return fromSale;
          const fromItens = (fullSale.items || []).reduce((s: number, i: any) => s + (Number(i.valor_unitario || 0) * Number(i.quantidade || 0) - Number(i.valor_total || 0)), 0);
          const extra = Number(fullSale.desconto_total || 0);
          return Math.max(0, fromItens + extra);
        })(),
        pagamentos: fullSale.payments
          .filter((p: any) => p.status === 'confirmed')
          .map((p: any) => ({
            forma: p.forma_pagamento,
            valor: Number(p.valor),
            troco: p.troco ? Number(p.troco) : undefined,
          })),
        vendedor: fullSale.vendedor_nome || undefined,
        observacoes: fullSale.observacoes || undefined,
        mostrar_termos_garantia_os: !!fullSale.ordem_servico_id,
      };

      // Gerar QR code com URL para 2ª via do cupom
      const qrCodeData = `${APP_PUBLIC_URL}/cupom/${fullSale.id}`;
      const html = await generateCupomTermica(cupomData, qrCodeData);
      
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
            printFrame.contentWindow?.focus();
            printFrame.contentWindow?.print();
            
            // Remover iframe após impressão
            setTimeout(() => {
              try {
                if (printFrame.parentNode) {
                  document.body.removeChild(printFrame);
                }
              } catch (e) {
                console.error('Erro ao remover iframe:', e);
              }
            }, 1000);
          } catch (e) {
            console.error('Erro ao imprimir:', e);
            toast({ title: 'Erro ao imprimir cupom', variant: 'destructive' });
          }
        }, 500);
      }
    } catch (error) {
      console.error('Erro ao imprimir cupom:', error);
    }
  };

  const handleSavePDF = async (sale: Sale) => {
    try {
      const fullSale = await getSaleById(sale.id);
      if (!fullSale || !fullSale.items || !fullSale.payments) return;

      const cupomData = {
        numero: fullSale.numero,
        data: new Date(fullSale.created_at).toLocaleDateString('pt-BR'),
        hora: new Date(fullSale.created_at).toLocaleTimeString('pt-BR'),
        empresa: {
          nome: 'PRIME CAMP', // TODO: Buscar de configuração
          cnpj: '31.833.574/0001-74', // TODO: Buscar de configuração
          endereco: undefined, // TODO: Buscar de configuração
          telefone: undefined, // TODO: Buscar de configuração
        },
        cliente: fullSale.cliente_nome ? {
          nome: fullSale.cliente_nome,
          cpf_cnpj: fullSale.cliente_cpf_cnpj || undefined,
          telefone: fullSale.cliente_telefone || undefined,
        } : undefined,
        itens: fullSale.items.map((item: any) => ({
          codigo: item.produto_codigo || item.produto_codigo_barras || undefined,
          nome: item.produto_nome,
          quantidade: Number(item.quantidade),
          valor_unitario: Number(item.valor_unitario),
          desconto: Number(item.desconto || 0),
          valor_total: Number(item.valor_total),
        })),
        subtotal: Number(fullSale.subtotal),
        total: Number(fullSale.total),
        desconto_total: (() => {
          const sub = Number(fullSale.subtotal || 0);
          const tot = Number(fullSale.total || 0);
          const fromSale = Math.max(0, sub - tot);
          if (fromSale > 0) return fromSale;
          const fromItens = (fullSale.items || []).reduce((s: number, i: any) => s + (Number(i.valor_unitario || 0) * Number(i.quantidade || 0) - Number(i.valor_total || 0)), 0);
          const extra = Number(fullSale.desconto_total || 0);
          return Math.max(0, fromItens + extra);
        })(),
        pagamentos: fullSale.payments
          .filter((p: any) => p.status === 'confirmed')
          .map((p: any) => ({
            forma: p.forma_pagamento,
            valor: Number(p.valor),
            troco: p.troco ? Number(p.troco) : undefined,
          })),
        vendedor: fullSale.vendedor_nome || undefined,
        observacoes: fullSale.observacoes || undefined,
        mostrar_termos_garantia_os: !!fullSale.ordem_servico_id,
        termos_garantia: 'A Empresa oferece Garantia de 90 dias em peças usadas no conserto, contados a partir da data de entrega. A garantia não cobre danos causados por mau uso, quedas, água ou outros fatores externos.',
      };

      // Gerar QR code com URL para 2ª via do cupom
      const qrCodeData = `${APP_PUBLIC_URL}/cupom/${fullSale.id}`;
      const pdf = await generateCupomPDF(cupomData, qrCodeData);
      pdf.save(`cupom-venda-${fullSale.numero}.pdf`);
    } catch (error) {
      console.error('Erro ao salvar PDF:', error);
    }
  };

  const handleSendWhatsApp = async (sale: Sale) => {
    try {
      const fullSale = await getSaleById(sale.id);
      if (!fullSale || !fullSale.items || !fullSale.payments || !fullSale.cliente_telefone) {
        return;
      }

      const message = formatVendaMessage({
        numero: fullSale.numero,
        data: new Date(fullSale.created_at).toLocaleDateString('pt-BR'),
        total: Number(fullSale.total),
        cliente: fullSale.cliente_nome || undefined,
        itens: fullSale.items.map((item: any) => ({
          nome: item.produto_nome,
          quantidade: Number(item.quantidade),
          valor_total: Number(item.valor_total),
        })),
        pagamentos: fullSale.payments
          .filter((p: any) => p.status === 'confirmed')
          .map((p: any) => ({
            forma: p.forma_pagamento,
            valor: Number(p.valor),
          })),
      });

      openWhatsApp(fullSale.cliente_telefone, message);
    } catch (error) {
      console.error('Erro ao enviar WhatsApp:', error);
    }
  };

  // Verificar se é admin ou gestor (pode ser baseado em department ou cargo)
  const canCancelDirectly = isAdmin || profile?.department === 'gestao' || profile?.department === 'gerencia';
  const canDelete = isAdmin || profile?.department === 'gestao' || profile?.department === 'gerencia';

  // Abrir modal de exclusão
  const handleOpenDeleteDialog = (sale: Sale, e?: React.MouseEvent) => {
    // Prevenir propagação de eventos
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    // Verificar permissões
    if (!sale.is_draft && !canDelete) {
      toast({
        title: 'Ação não permitida',
        description: 'Apenas administradores podem excluir vendas finalizadas.',
        variant: 'destructive',
      });
      return false;
    }
    
    setSelectedSaleToDelete(sale);
    setDeleteMotivo('');
    setDeleteDialogOpen(true);
    return false;
  };

  // Confirmar exclusão
  const handleConfirmDelete = async (e?: React.MouseEvent) => {
    // Prevenir fechamento automático do modal
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!selectedSaleToDelete) {
      return;
    }

    // Se for venda finalizada, motivo é obrigatório
    if (!selectedSaleToDelete.is_draft && !deleteMotivo.trim()) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Por favor, informe o motivo da exclusão.',
        variant: 'destructive',
      });
      return;
    }

    setIsDeleting(true);
    try {
      console.log('=== INICIANDO EXCLUSÃO ===');
      console.log('Venda ID:', selectedSaleToDelete.id);
      console.log('É rascunho:', selectedSaleToDelete.is_draft);
      console.log('Can delete:', canDelete);
      console.log('Force:', !selectedSaleToDelete.is_draft && canDelete);
      
      // Se for rascunho, excluir normalmente
      // Se for venda finalizada, usar force=true (apenas admin/gestor pode)
      await deleteSale(selectedSaleToDelete.id, !selectedSaleToDelete.is_draft && canDelete);
      
      console.log('=== VENDA EXCLUÍDA COM SUCESSO ===');
      
      toast({
        title: 'Venda excluída',
        description: `Venda #${selectedSaleToDelete.numero} foi excluída com sucesso.`,
      });
      
      // Fechar modal primeiro
      setDeleteDialogOpen(false);
      setSelectedSaleToDelete(null);
      setDeleteMotivo('');
    } catch (error: any) {
      console.error('=== ERRO AO EXCLUIR VENDA ===');
      console.error('Erro completo:', error);
      console.error('Mensagem:', error.message);
      console.error('Stack:', error.stack);
      
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao excluir venda. Verifique o console para mais detalhes.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      console.log('=== FIM DA EXCLUSÃO ===');
    }
  };

  // Abrir modal de preview
  const handleViewSale = async (sale: Sale) => {
    setIsLoadingPreview(true);
    setPreviewDialogOpen(true);
    try {
      const fullSale = await getSaleById(sale.id);
      if (fullSale) {
        setPreviewSale(fullSale);
        setPreviewItems(fullSale.items || []);
        setPreviewPayments(fullSale.payments || []);
      }
    } catch (error) {
      console.error('Erro ao carregar venda:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os detalhes da venda.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Abrir modal de cancelamento
  const handleOpenCancelDialog = (sale: Sale, e?: React.MouseEvent) => {
    // Prevenir propagação de eventos
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    // Não pode cancelar rascunhos ou vendas já canceladas
    if (sale.is_draft || sale.status === 'canceled') {
      toast({
        title: 'Ação não permitida',
        description: 'Esta venda não pode ser cancelada.',
        variant: 'destructive',
      });
      return false;
    }
    setSelectedSale(sale);
    setCancelMotivo('');
    setCancelDialogOpen(true);
    return false;
  };

  // Confirmar cancelamento
  const handleConfirmCancel = async () => {
    if (!selectedSale || !cancelMotivo.trim()) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Por favor, informe o motivo do cancelamento.',
        variant: 'destructive',
      });
      return;
    }

    setIsCanceling(true);
    try {
      if (canCancelDirectly) {
        // Admin/Gestor: cancelar diretamente
        await cancelSale(selectedSale.id, cancelMotivo);
        toast({
          title: 'Venda cancelada',
          description: `Venda #${selectedSale.numero} foi cancelada com sucesso.`,
        });
      } else {
        // Usuário normal: criar solicitação
        await createRequest(selectedSale.id, cancelMotivo);
        toast({
          title: 'Solicitação enviada',
          description: `Solicitação de cancelamento da venda #${selectedSale.numero} foi enviada para aprovação.`,
        });
      }
      setCancelDialogOpen(false);
      setSelectedSale(null);
      setCancelMotivo('');
      
      // Recarregar lista de vendas (já é feito automaticamente pelo hook, mas garantimos)
      // Não redirecionar, apenas fechar o modal e atualizar a lista
    } catch (error: any) {
      console.error('Erro ao cancelar venda:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao processar cancelamento.',
        variant: 'destructive',
      });
    } finally {
      setIsCanceling(false);
    }
  };

  if (isLoading) {
    return (
      <ModernLayout title="Vendas" subtitle="Gerenciamento de vendas">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </ModernLayout>
    );
  }

  return (
    <ModernLayout
      title="Vendas"
      subtitle="Gerenciamento de vendas do PDV"
      headerActions={<ValuesVisibilityToggle valuesVisible={valuesVisible} setValuesVisible={setValuesVisible} />}
    >
      <div className="flex flex-col gap-3 md:gap-3 pb-8 min-w-0">
        {/* Estatísticas — Mobile: grid 2 colunas, toque confortável */}
        <div className="md:hidden grid grid-cols-2 sm:grid-cols-3 gap-2 shrink-0">
          <div className="flex items-center justify-between gap-2 min-h-[44px] px-3 py-2.5 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-800 touch-manipulation">
            <span className="text-green-600 dark:text-green-400 font-bold tabular-nums">{fmt(stats.totalPeriodo)}</span>
            <span className="text-green-600 dark:text-green-400 text-xs">({stats.qtdPeriodo})</span>
          </div>
          <div className="flex items-center justify-between gap-2 min-h-[44px] px-3 py-2.5 bg-purple-50 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-800 touch-manipulation">
            <span className="text-purple-600 dark:text-purple-400 text-xs">Ticket</span>
            <span className="text-purple-600 dark:text-purple-400 font-bold tabular-nums">{fmt(stats.ticketMedio)}</span>
          </div>
          <div className="flex items-center justify-between gap-2 min-h-[44px] px-3 py-2.5 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800 touch-manipulation">
            <span className="text-blue-600 dark:text-blue-400 font-bold tabular-nums">{stats.totalHoje}</span>
            <span className="text-blue-600 dark:text-blue-400 text-xs">hoje</span>
          </div>
          <div className="flex items-center justify-between gap-2 min-h-[44px] px-3 py-2.5 bg-yellow-50 dark:bg-yellow-950/30 rounded-xl border border-yellow-200 dark:border-yellow-800 touch-manipulation">
            <span className="text-yellow-600 dark:text-yellow-400 font-bold tabular-nums">{stats.rascunhos}</span>
            <span className="text-yellow-600 dark:text-yellow-400 text-xs">rasc.</span>
          </div>
          <div className="flex items-center justify-between gap-2 min-h-[44px] px-3 py-2.5 bg-orange-50 dark:bg-orange-950/30 rounded-xl border border-orange-200 dark:border-orange-800 touch-manipulation col-span-2 sm:col-span-1">
            <span className="text-orange-600 dark:text-orange-400 font-bold tabular-nums">{stats.pendentes}</span>
            <span className="text-orange-600 dark:text-orange-400 text-xs">pend.</span>
          </div>
        </div>

        {/* Estatísticas - Desktop: cards completos (refletem o período filtrado) */}
        <div className="hidden md:grid flex-shrink-0 grid-cols-4 gap-3">
          <Card className="border-2 border-l-4 border-l-blue-500 border-gray-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-6">
              <CardTitle className="text-sm font-medium">Vendas Hoje</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-6 pb-3">
              <div className="text-2xl font-bold">{stats.totalHoje}</div>
              <p className="text-xs text-muted-foreground mt-1">{fmt(stats.totalHojeValor)}</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-l-4 border-l-green-500 border-gray-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-6">
              <CardTitle className="text-sm font-medium">Total do Período</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-6 pb-3">
              <div className="text-2xl font-bold text-green-600">{fmt(stats.totalPeriodo)}</div>
              <p className="text-xs text-muted-foreground mt-1">{stats.qtdPeriodo} vendas pagas</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-l-4 border-l-purple-500 border-gray-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-6">
              <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-6 pb-3">
              <div className="text-2xl font-bold text-purple-600">{fmt(stats.ticketMedio)}</div>
              <p className="text-xs text-muted-foreground mt-1">por venda</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-l-4 border-l-orange-500 border-gray-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-6">
              <CardTitle className="text-sm font-medium">Rascunhos / Pendentes</CardTitle>
              <Edit className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-6 pb-3">
              <div className="text-2xl font-bold">
                <span className="text-yellow-600">{stats.rascunhos}</span>
                <span className="text-muted-foreground mx-1">/</span>
                <span className="text-orange-600">{stats.pendentes}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">no período</p>
            </CardContent>
          </Card>
        </div>

        {/* Solicitações de cancelamento (admin/gestão) */}
        {canCancelDirectly && (
          <Card className="border-2 border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  Solicitações de cancelamento
                  {pendingCancelRequests.length > 0 && (
                    <Badge variant="secondary" className="ml-1">{pendingCancelRequests.length}</Badge>
                  )}
                </CardTitle>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {pendingCancelRequests.length > 0
                  ? 'Vendedores solicitaram cancelamento destas vendas. Aprove ou rejeite.'
                  : 'Quando um vendedor solicitar cancelamento de uma venda, as solicitações aparecerão aqui.'}
              </p>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {cancelRequestsLoading ? (
                <p className="text-sm text-muted-foreground py-4">Carregando...</p>
              ) : pendingCancelRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3">Nenhuma solicitação pendente.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Venda</TableHead>
                      <TableHead className="text-xs">Solicitante</TableHead>
                      <TableHead className="text-xs">Motivo</TableHead>
                      <TableHead className="text-xs">Data</TableHead>
                      <TableHead className="text-xs text-right w-[180px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingCancelRequests.map((req) => {
                      const info = saleInfoMap[req.sale_id];
                      return (
                        <TableRow key={req.id}>
                          <TableCell className="font-medium">
                            {info ? `#${info.numero}` : `#${req.sale_id.slice(0, 8)}…`}
                            {info != null && (
                              <span className="text-muted-foreground text-xs ml-1">{fmt(info.total)}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{req.solicitante_nome}</TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate" title={req.motivo}>{req.motivo}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{dateFormatters.short(req.created_at)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="default"
                                className="h-8 gap-1 bg-green-600 hover:bg-green-700"
                                onClick={() => handleApproveRequest(req)}
                                disabled={!!isApproving}
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                Aprovar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1 text-destructive border-destructive hover:bg-destructive/10"
                                onClick={() => { setRequestToReject(req); setRejectMotivo(''); }}
                                disabled={!!isApproving}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                Rejeitar
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Card principal - lista de vendas */}
        <Card className="border border-gray-200 dark:border-gray-700 rounded-xl md:rounded-lg overflow-hidden">
          <CardHeader className="pb-2 pt-3 px-3 sm:px-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold">Lista de Vendas</CardTitle>
              <PermissionGate permission="vendas.create">
                <div className="flex gap-2 flex-wrap">
                  <Button 
                    onClick={() => navigate('/pdv/devolucoes')} 
                    size="sm"
                    variant="ghost"
                    className="gap-1 h-9 min-h-[44px] md:min-h-0 text-muted-foreground hover:text-foreground rounded-xl md:rounded-md touch-manipulation"
                    title="Devoluções e Vouchers"
                  >
                    <ReceiptText className="h-4 w-4" />
                    <span className="text-xs hidden lg:inline">Devoluções</span>
                  </Button>
                  <Button 
                    onClick={() => setImportDialogOpen(true)} 
                    size="sm"
                    variant="outline"
                    className="gap-2 h-9 min-h-[44px] md:min-h-0 rounded-xl md:rounded-md touch-manipulation"
                  >
                    <Upload className="h-4 w-4" />
                    <span className="text-xs hidden sm:inline">Importar</span>
                  </Button>
                  <Button 
                    onClick={() => navigate('/pdv/venda/nova')} 
                    size="sm"
                    className="gap-2 h-9 min-h-[44px] md:min-h-0 bg-blue-600 hover:bg-blue-700 text-white rounded-xl md:rounded-md touch-manipulation"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="text-xs">Nova Venda</span>
                  </Button>
                </div>
              </PermissionGate>
            </div>
          </CardHeader>
          <CardContent className="p-3 space-y-3">
            {/* Filtros — mobile: toque confortável, 100% largura */}
            <div className="flex-shrink-0 flex flex-col md:flex-row gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Buscar por nº venda, cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-11 min-h-[44px] md:h-10 md:min-h-0 text-base md:text-sm border-2 border-gray-300 dark:border-gray-600 rounded-xl md:rounded-md touch-manipulation"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:flex-1 md:flex-initial">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[180px] h-11 min-h-[44px] md:h-10 md:min-h-0 text-sm border-2 border-gray-300 dark:border-gray-600 rounded-xl md:rounded-md touch-manipulation [&>span]:truncate">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="open">Aberta</SelectItem>
                    <SelectItem value="paid">Paga</SelectItem>
                    <SelectItem value="partial">Parcial</SelectItem>
                    <SelectItem value="canceled">Cancelada</SelectItem>
                    <SelectItem value="refunded">Devolvida</SelectItem>
                    <SelectItem value="partial_refund">Dev. Parcial</SelectItem>
                  </SelectContent>
                </Select>
                <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className={cn(
                        "w-full sm:w-[220px] h-11 min-h-[44px] md:h-10 md:min-h-0 text-sm border-2 border-gray-300 dark:border-gray-600 justify-start text-left font-normal rounded-xl md:rounded-md touch-manipulation",
                        dateFilter === 'custom' && customDateStart && customDateEnd && "text-foreground"
                      )}
                    >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {dateFilter === 'custom' && customDateStart && customDateEnd ? (
                      <span className="truncate">
                        {format(customDateStart, 'dd/MM/yy', { locale: ptBR })} - {format(customDateEnd, 'dd/MM/yy', { locale: ptBR })}
                      </span>
                    ) : dateFilter === 'today' ? (
                      'Hoje'
                    ) : dateFilter === 'week' ? (
                      'Últimos 7 dias'
                    ) : dateFilter === 'month' ? (
                      'Últimos 30 dias'
                    ) : (
                      'Todos os períodos'
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <div className="p-3 border-b space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Button 
                        variant={dateFilter === 'today' ? 'default' : 'outline'} 
                        size="sm"
                        onClick={() => { setDateFilter('today'); setShowDatePicker(false); }}
                      >
                        Hoje
                      </Button>
                      <Button 
                        variant={dateFilter === 'week' ? 'default' : 'outline'} 
                        size="sm"
                        onClick={() => { setDateFilter('week'); setShowDatePicker(false); }}
                      >
                        7 dias
                      </Button>
                      <Button 
                        variant={dateFilter === 'month' ? 'default' : 'outline'} 
                        size="sm"
                        onClick={() => { setDateFilter('month'); setShowDatePicker(false); }}
                      >
                        30 dias
                      </Button>
                      <Button 
                        variant={dateFilter === 'all' ? 'default' : 'outline'} 
                        size="sm"
                        onClick={() => { setDateFilter('all'); setShowDatePicker(false); }}
                      >
                        Todos
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground text-center pt-1">
                      ou selecione um período:
                    </div>
                  </div>
                  <div className="p-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Data Início</Label>
                        <Input
                          type="date"
                          value={customDateStart ? format(customDateStart, 'yyyy-MM-dd') : ''}
                          onChange={(e) => {
                            if (e.target.value) {
                              setCustomDateStart(new Date(e.target.value + 'T00:00:00'));
                            }
                          }}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Data Fim</Label>
                        <Input
                          type="date"
                          value={customDateEnd ? format(customDateEnd, 'yyyy-MM-dd') : ''}
                          onChange={(e) => {
                            if (e.target.value) {
                              setCustomDateEnd(new Date(e.target.value + 'T23:59:59'));
                            }
                          }}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    <Button 
                      className="w-full" 
                      size="sm"
                      disabled={!customDateStart || !customDateEnd}
                      onClick={() => { 
                        setDateFilter('custom'); 
                        setShowDatePicker(false); 
                      }}
                    >
                      Aplicar Período
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              </div>
            </div>

            {/* Tabela de vendas */}
            {filteredSales.length === 0 ? (
              <EmptyState
                variant="no-data"
                title="Nenhuma venda encontrada"
                description="Cadastre uma nova venda para começar."
                action={{ label: 'Nova Venda', onClick: () => navigate('/pdv/venda/nova') }}
              />
            ) : (
              <>
                {/* Desktop: Tabela */}
                <div className="hidden md:block border border-gray-200 rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b-2 border-gray-300">
                        <TableHead className="font-semibold bg-muted/60 border-r border-gray-200 w-[72px]">Nº</TableHead>
                        <TableHead className="font-semibold bg-muted/60 border-r border-gray-200 min-w-[120px] max-w-[180px]">Cliente</TableHead>
                        <TableHead className="font-semibold bg-muted/60 border-r border-gray-200 w-[100px]">Vendedor</TableHead>
                        <TableHead className="font-semibold bg-muted/60 border-r border-gray-200 w-[140px]">Status</TableHead>
                        <TableHead className="font-semibold bg-muted/60 border-r border-gray-200 whitespace-nowrap">Data / Hora</TableHead>
                        <TableHead className="font-semibold bg-muted/60 border-r border-gray-200 text-right">Total</TableHead>
                        <TableHead className="font-semibold bg-muted/60 border-r border-gray-200 text-right">Pago</TableHead>
                        <TableHead className="font-semibold bg-muted/60 text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedSales.map((sale, index) => (
                        <TableRow 
                          key={sale.id}
                          className={`cursor-pointer hover:bg-muted/50 border-b border-gray-200 ${index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}`}
                          onClick={() => navigate(`/pdv/venda/${sale.id}`)}
                        >
                          <TableCell className="border-r border-gray-200">
                            <button
                              type="button"
                              className={cn(
                                "underline underline-offset-2 hover:text-blue-600",
                                sale.status === 'paid' && !sale.is_draft ? "font-semibold text-muted-foreground" : "font-bold text-primary"
                              )}
                              onClick={async (e) => {
                                e.stopPropagation();
                                await handleViewSale(sale);
                              }}
                              title="Visualizar venda"
                            >
                              #{sale.numero}
                            </button>
                          </TableCell>
                          <TableCell className="border-r border-gray-200 min-w-[120px] max-w-[180px]">
                            <div className="truncate">
                              <p className="font-medium truncate" title={sale.cliente_nome || 'Consumidor Final'}>{sale.cliente_nome || 'Consumidor Final'}</p>
                              {sale.cliente_cpf_cnpj && (
                                <p className="text-xs text-muted-foreground">{sale.cliente_cpf_cnpj}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="border-r border-gray-200">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{sale.vendedor_nome || '-'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="border-r border-gray-200 w-[140px]">
                            <div className="flex flex-wrap items-center gap-1">
                              <Badge className={cn(SALE_STATUS_COLORS[sale.status], "whitespace-nowrap")}>
                                {SALE_STATUS_LABELS[sale.status]}
                              </Badge>
                              {sale.is_draft && (
                                <Badge variant="outline" className="whitespace-nowrap">Rascunho</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="border-r border-gray-200 text-sm whitespace-nowrap">
                            {dateFormatters.withTime(sale.created_at)}
                          </TableCell>
                          <TableCell className="text-right font-semibold border-r border-gray-200">
                            {fmt(sale.total)}
                          </TableCell>
                          <TableCell className="text-right border-r border-gray-200">
                            <span className={cn(
                              "font-semibold",
                              Number(sale.total_pago) >= Number(sale.total) ? "text-green-600" : "text-orange-600"
                            )}>
                              {fmt(sale.total_pago)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await handleViewSale(sale);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {!sale.is_draft && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                    <DropdownMenuItem 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handlePrintCupom(sale);
                                      }}
                                    >
                                      <Printer className="h-4 w-4 mr-2" />
                                      Reimprimir Cupom
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/pdv/venda/${sale.id}/editar`);
                                      }}
                                    >
                                      <Edit className="h-4 w-4 mr-2" />
                                      Editar Venda
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSavePDF(sale);
                                      }}
                                    >
                                      <Download className="h-4 w-4 mr-2" />
                                      Salvar PDF
                                    </DropdownMenuItem>
                                    {sale.status === 'paid' && (
                                      <DropdownMenuItem 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigate(`/pdv/devolucoes?sale=${sale.id}`);
                                        }}
                                      >
                                        <ReceiptText className="h-4 w-4 mr-2" />
                                        Devolução/Troca
                                      </DropdownMenuItem>
                                    )}
                                    {sale.cliente_telefone && (
                                      <DropdownMenuItem 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleSendWhatsApp(sale);
                                        }}
                                      >
                                        <Send className="h-4 w-4 mr-2" />
                                        Enviar WhatsApp
                                      </DropdownMenuItem>
                                    )}
                                    {!sale.is_draft && sale.status !== 'canceled' && (
                                      <DropdownMenuItem 
                                        onSelect={(e) => {
                                          e.preventDefault();
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          handleOpenCancelDialog(sale, e);
                                        }}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        <X className="h-4 w-4 mr-2" />
                                        Cancelar Venda
                                      </DropdownMenuItem>
                                    )}
                                    {(sale.is_draft || canDelete) && (
                                      <DropdownMenuItem 
                                        onSelect={(e) => {
                                          e.preventDefault();
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          handleOpenDeleteDialog(sale, e);
                                        }}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Excluir Venda
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                              {sale.is_draft && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/pdv/venda/${sale.id}/editar`);
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenDeleteDialog(sale, e);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {!sale.is_draft && canDelete && sale.status !== 'canceled' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenDeleteDialog(sale, e);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile: Cards compactos — toque confortável, hierarquia clara */}
                <div className="md:hidden space-y-2.5">
                  {paginatedSales.map((sale) => (
                    <Card
                      key={sale.id}
                      className="border-2 border-gray-300 dark:border-gray-600 cursor-pointer hover:border-blue-400 transition-all active:scale-[0.99] rounded-xl overflow-hidden touch-manipulation"
                      onClick={() => navigate(`/pdv/venda/${sale.id}`)}
                    >
                      <CardContent className="p-3">
                        {/* Topo: nº venda + badge + total */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <button
                              type="button"
                              className="font-semibold text-sm underline underline-offset-2 hover:text-blue-600 text-left truncate"
                              onClick={async (e) => {
                                e.stopPropagation();
                                await handleViewSale(sale);
                              }}
                              title="Visualizar venda"
                            >
                              #{sale.numero}
                            </button>
                            <Badge className={cn('text-xs font-medium shrink-0', SALE_STATUS_COLORS[sale.status])}>
                              {SALE_STATUS_LABELS[sale.status]}
                            </Badge>
                            {sale.is_draft && (
                              <Badge variant="outline" className="text-xs shrink-0">Rasc.</Badge>
                            )}
                          </div>
                          <span className="font-semibold text-primary tabular-nums shrink-0">{fmt(sale.total)}</span>
                        </div>
                        {/* Cliente em destaque */}
                        <p className="font-medium text-foreground text-sm truncate mb-1">
                          {sale.cliente_nome || 'Consumidor Final'}
                        </p>
                        {/* Meta: vendedor · data em uma linha */}
                        <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-2">
                          <span>{sale.vendedor_nome || '-'}</span>
                          <span>·</span>
                          <span>{dateFormatters.withTime(sale.created_at)}</span>
                        </div>
                        {/* Footer: Pago + ações */}
                        <div className="flex items-center justify-between pt-2 border-t border-border/60">
                          <span className={cn(
                            "text-sm font-semibold tabular-nums",
                            Number(sale.total_pago) >= Number(sale.total) ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"
                          )}>
                            Pago: {fmt(sale.total_pago)}
                          </span>
                          <div className="flex gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 min-h-[44px] rounded-xl touch-manipulation"
                              onClick={async (e) => {
                                e.stopPropagation();
                                await handleViewSale(sale);
                              }}
                              aria-label="Visualizar"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {sale.is_draft && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-10 w-10 min-h-[44px] rounded-xl touch-manipulation"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/pdv/venda/${sale.id}/editar`);
                                  }}
                                  aria-label="Editar"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-10 w-10 min-h-[44px] rounded-xl text-destructive hover:text-destructive touch-manipulation"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenDeleteDialog(sale, e);
                                  }}
                                  aria-label="Excluir"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {!sale.is_draft && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <Button variant="ghost" size="icon" className="h-10 w-10 min-h-[44px] rounded-xl touch-manipulation" aria-label="Mais opções">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                  <DropdownMenuItem 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/pdv/venda/${sale.id}/editar`);
                                    }}
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePrintCupom(sale);
                                    }}
                                  >
                                    <Printer className="h-4 w-4 mr-2" />
                                    Imprimir
                                  </DropdownMenuItem>
                                  {sale.status === 'paid' && (
                                    <DropdownMenuItem 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/pdv/devolucoes?sale=${sale.id}`);
                                      }}
                                    >
                                      <ReceiptText className="h-4 w-4 mr-2" />
                                      Devolver
                                    </DropdownMenuItem>
                                  )}
                                  {sale.cliente_telefone && (
                                    <DropdownMenuItem 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSendWhatsApp(sale);
                                      }}
                                    >
                                      <Send className="h-4 w-4 mr-2" />
                                      WhatsApp
                                    </DropdownMenuItem>
                                  )}
                                  {!sale.is_draft && sale.status !== 'canceled' && (
                                    <DropdownMenuItem 
                                      onSelect={(e) => e.preventDefault()}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        handleOpenCancelDialog(sale, e);
                                      }}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <X className="h-4 w-4 mr-2" />
                                      Cancelar
                                    </DropdownMenuItem>
                                  )}
                                  {(sale.is_draft || canDelete) && (
                                    <DropdownMenuItem 
                                      onSelect={(e) => e.preventDefault()}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        handleOpenDeleteDialog(sale, e);
                                      }}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Excluir
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Paginação — mobile: toque fácil */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs sm:text-sm text-muted-foreground order-2 sm:order-1 tabular-nums min-w-0 truncate">
                      {filteredSales.length} venda(s) · {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, filteredSales.length)} de {filteredSales.length}
                    </p>
                    <div className="flex items-center gap-1 sm:gap-2 order-1 sm:order-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 min-h-[44px] w-10 p-0 sm:h-9 sm:w-auto sm:min-h-0 sm:gap-1 sm:px-3 rounded-xl sm:rounded-md touch-manipulation"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        aria-label="Página anterior"
                      >
                        <ChevronLeft className="h-5 w-5 sm:h-4 sm:w-4" />
                        <span className="hidden sm:inline">Anterior</span>
                      </Button>
                      <span className="min-w-[2.5rem] text-center text-sm font-medium tabular-nums px-1">
                        {page}/{totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 min-h-[44px] w-10 p-0 sm:h-9 sm:w-auto sm:min-h-0 sm:gap-1 sm:px-3 rounded-xl sm:rounded-md touch-manipulation"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        aria-label="Próxima página"
                      >
                        <span className="hidden sm:inline">Próxima</span>
                        <ChevronRight className="h-5 w-5 sm:h-4 sm:w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de Preview da Venda */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="p-3 md:p-6 max-w-[95vw] md:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-2 md:pb-4">
            <DialogTitle className="text-base md:text-lg">Visualizar Venda #{previewSale?.numero || ''}</DialogTitle>
          </DialogHeader>
          
          {isLoadingPreview ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground text-sm">Carregando...</p>
            </div>
          ) : previewSale ? (
            <div className="space-y-3 md:space-y-4">
              {/* Informações da Venda */}
              <Card className="border-2 border-gray-300">
                <CardHeader className="pb-2 md:pb-3 pt-3 md:pt-6">
                  <CardTitle className="text-base md:text-lg">Informações da Venda</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4 p-3 md:p-6">
                  <div>
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <div>
                      <Badge className={cn(SALE_STATUS_COLORS[previewSale.status])}>
                        {SALE_STATUS_LABELS[previewSale.status]}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Data</Label>
                    <p className="text-sm">{new Date(previewSale.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Vendedor</Label>
                    <p className="text-sm">{previewSale.vendedor_nome || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Total</Label>
                    <p className="text-sm font-semibold">{fmt(previewSale.total)}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Cliente */}
              {previewSale.cliente_nome && (
                <Card className="border-2 border-gray-300">
                  <CardHeader className="pb-2 md:pb-3 pt-3 md:pt-6">
                    <CardTitle className="text-base md:text-lg">Cliente</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 md:p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Nome</Label>
                        <p className="text-sm">{previewSale.cliente_nome}</p>
                      </div>
                      {previewSale.cliente_cpf_cnpj && (
                        <div>
                          <Label className="text-xs text-muted-foreground">CPF/CNPJ</Label>
                          <p className="text-sm">{previewSale.cliente_cpf_cnpj}</p>
                        </div>
                      )}
                      {previewSale.cliente_telefone && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Telefone</Label>
                          <p className="text-sm">{previewSale.cliente_telefone}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Itens */}
              <Card className="border-2 border-gray-300">
                <CardHeader className="pb-2 md:pb-3 pt-3 md:pt-6">
                  <CardTitle className="text-base md:text-lg">Itens ({previewItems.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-3 md:p-6">
                  <div className="space-y-2">
                    {previewItems.map((item) => (
                      <div key={item.id} className="flex justify-between items-center py-2 border-b-2 border-gray-200">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm md:text-base truncate">{item.produto_nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantidade}x {fmt(item.valor_unitario)}
                            {item.desconto > 0 && ` - Desc: ${fmt(item.desconto)}`}
                          </p>
                        </div>
                        <p className="font-semibold text-sm md:text-base ml-2">{fmt(item.valor_total)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t-2 border-gray-300 space-y-1 text-sm md:text-base">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>{fmt(previewSale.subtotal)}</span>
                    </div>
                    {previewSale.desconto_total > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>Desconto:</span>
                        <span>-{fmt(previewSale.desconto_total)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg pt-2">
                      <span>Total:</span>
                      <span>{fmt(previewSale.total)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Pagamentos */}
              {previewPayments.length > 0 && (
                <Card className="border-2 border-gray-300">
                  <CardHeader className="pb-2 md:pb-3 pt-3 md:pt-6">
                    <CardTitle className="text-base md:text-lg">Pagamentos</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 md:p-6">
                    <div className="space-y-2">
                      {previewPayments
                        .filter((p: any) => p.status === 'confirmed')
                        .map((payment: any) => (
                          <div key={payment.id} className="flex justify-between items-center py-2 border-b-2 border-gray-200">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm md:text-base capitalize">{payment.forma_pagamento}</p>
                              {payment.troco > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  Troco: {fmt(payment.troco)}
                                </p>
                              )}
                            </div>
                            <p className="font-semibold text-sm md:text-base ml-2">{fmt(payment.valor)}</p>
                          </div>
                        ))}
                    </div>
                    <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t-2 border-gray-300 text-sm md:text-base">
                      <div className="flex justify-between">
                        <span>Total Pago:</span>
                        <span className={cn(
                          "font-semibold",
                          Number(previewSale.total_pago) >= Number(previewSale.total) ? "text-green-600" : "text-orange-600"
                        )}>
                          {fmt(previewSale.total_pago)}
                        </span>
                      </div>
                      {Number(previewSale.total_pago) < Number(previewSale.total) && (
                        <div className="flex justify-between text-orange-600 mt-1">
                          <span>Saldo Restante:</span>
                          <span className="font-semibold">
                            {fmt(Number(previewSale.total) - Number(previewSale.total_pago))}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Observações */}
              {previewSale.observacoes && (
                <Card className="border-2 border-gray-300">
                  <CardHeader className="pb-2 md:pb-3 pt-3 md:pt-6">
                    <CardTitle className="text-base md:text-lg">Observações</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 md:p-6">
                    <p className="text-xs md:text-sm whitespace-pre-wrap">{previewSale.observacoes}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground text-sm">Venda não encontrada</p>
            </div>
          )}
          
          <DialogFooter className="flex-col sm:flex-row gap-2 pt-3 md:pt-4">
            <Button 
              variant="outline" 
              onClick={() => setPreviewDialogOpen(false)}
              className="w-full sm:w-auto h-9 md:h-10 border-2 border-gray-300"
            >
              Fechar
            </Button>
            {previewSale && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setPreviewDialogOpen(false);
                    navigate(`/pdv/venda/${previewSale.id}`);
                  }}
                  className="w-full sm:w-auto h-9 md:h-10 border-2 border-gray-300"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (previewSale) {
                      await handlePrintCupom(previewSale);
                    }
                  }}
                  className="w-full sm:w-auto h-9 md:h-10 border-2 border-gray-300"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Exclusão */}
      <AlertDialog 
        open={deleteDialogOpen} 
        onOpenChange={(open) => {
          // Não permitir fechar durante exclusão
          if (!isDeleting) {
            setDeleteDialogOpen(open);
          }
        }}
      >
        <AlertDialogContent className="p-3 md:p-6 max-w-[95vw] md:max-w-md">
          <AlertDialogHeader className="pb-2 md:pb-4">
            <AlertDialogTitle className="text-base md:text-lg">
              {selectedSaleToDelete?.is_draft ? 'Excluir Rascunho' : 'Excluir Venda'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedSaleToDelete?.is_draft ? (
                <>
                  Tem certeza que deseja excluir o rascunho <strong>#{selectedSaleToDelete?.numero}</strong>?
                  <br />
                  <br />
                  Esta ação <strong>não pode ser desfeita</strong> e irá remover permanentemente todos os dados relacionados.
                </>
              ) : (
                <>
                  Tem certeza que deseja excluir a venda <strong>#{selectedSaleToDelete?.numero}</strong>?
                  <br />
                  <br />
                  Esta ação <strong>não pode ser desfeita</strong> e irá:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Reverter o estoque dos produtos vendidos</li>
                    <li>Cancelar contas a receber relacionadas</li>
                    <li>Remover permanentemente todos os dados da venda</li>
                  </ul>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!selectedSaleToDelete?.is_draft && (
            <div className="space-y-2">
              <Label htmlFor="delete-motivo" className="text-xs md:text-sm">Motivo da Exclusão *</Label>
              <Textarea
                id="delete-motivo"
                placeholder="Informe o motivo da exclusão desta venda..."
                value={deleteMotivo}
                onChange={(e) => setDeleteMotivo(e.target.value)}
                rows={3}
                className="resize-none text-sm border-2 border-gray-300"
              />
            </div>
          )}
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 pt-3 md:pt-4">
            <AlertDialogCancel 
              disabled={isDeleting} 
              onClick={(e) => {
                if (!isDeleting) {
                  setDeleteDialogOpen(false);
                  setSelectedSaleToDelete(null);
                  setDeleteMotivo('');
                }
              }}
              className="w-full sm:w-auto h-9 md:h-10 border-2 border-gray-300"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleConfirmDelete(e);
              }}
              disabled={isDeleting || (!selectedSaleToDelete?.is_draft && !deleteMotivo.trim())}
              className="w-full sm:w-auto h-9 md:h-10 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Cancelamento */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent className="p-3 md:p-6 max-w-[95vw] md:max-w-md">
          <AlertDialogHeader className="pb-2 md:pb-4">
            <AlertDialogTitle className="text-base md:text-lg">Cancelar Venda</AlertDialogTitle>
            <AlertDialogDescription>
              {canCancelDirectly ? (
                <>
                  Você tem permissão para cancelar vendas diretamente. Esta ação não pode ser desfeita.
                  <br />
                  <strong>Venda #{selectedSale?.numero}</strong>
                </>
              ) : (
                <>
                  Você não tem permissão para cancelar vendas diretamente. Uma solicitação será enviada para aprovação do administrador.
                  <br />
                  <strong>Venda #{selectedSale?.numero}</strong>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 md:space-y-4 py-3 md:py-4">
            <div>
              <Label htmlFor="cancel-motivo" className="text-xs md:text-sm">Motivo do Cancelamento *</Label>
              <Textarea
                id="cancel-motivo"
                placeholder="Descreva o motivo do cancelamento..."
                value={cancelMotivo}
                onChange={(e) => setCancelMotivo(e.target.value)}
                rows={4}
                className="mt-2 text-sm border-2 border-gray-300"
              />
            </div>
          </div>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 pt-3 md:pt-4">
            <AlertDialogCancel 
              disabled={isCanceling}
              className="w-full sm:w-auto h-9 md:h-10 border-2 border-gray-300"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              disabled={isCanceling || !cancelMotivo.trim()}
              className="w-full sm:w-auto h-9 md:h-10 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCanceling ? (
                'Processando...'
              ) : canCancelDirectly ? (
                'Confirmar Cancelamento'
              ) : (
                'Enviar Solicitação'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Rejeitar solicitação de cancelamento */}
      <AlertDialog open={!!requestToReject} onOpenChange={(open) => { if (!open) setRequestToReject(null); setRejectMotivo(''); }}>
        <AlertDialogContent className="p-3 md:p-6 max-w-[95vw] md:max-w-md">
          <AlertDialogHeader className="pb-2 md:pb-4">
            <AlertDialogTitle className="text-base md:text-lg">Rejeitar solicitação de cancelamento</AlertDialogTitle>
            <AlertDialogDescription>
              {requestToReject && (
                <>
                  Solicitação de <strong>{requestToReject.solicitante_nome}</strong> para cancelar a venda.
                  Informe o motivo da rejeição (será registrado).
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-3">
            <Label htmlFor="reject-motivo" className="text-xs md:text-sm">Motivo da rejeição *</Label>
            <Textarea
              id="reject-motivo"
              placeholder="Ex.: Venda já entregue, cliente não autorizou..."
              value={rejectMotivo}
              onChange={(e) => setRejectMotivo(e.target.value)}
              rows={3}
              className="resize-none text-sm border-2 border-gray-300"
            />
          </div>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 pt-3">
            <AlertDialogCancel disabled={isRejecting} onClick={() => { setRequestToReject(null); setRejectMotivo(''); }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRejectRequest}
              disabled={isRejecting || !rejectMotivo.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRejecting ? 'Rejeitando...' : 'Rejeitar solicitação'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Importação Retroativa */}
      <ImportarVendasRetroativas
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onSuccess={() => window.location.reload()}
      />
    </ModernLayout>
  );
}

