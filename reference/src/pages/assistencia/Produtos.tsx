import { useState, useMemo, memo, useEffect } from 'react';
import { ModernLayout } from '@/components/ModernLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/EmptyState';
import { ImportarProdutos } from '@/components/ImportarProdutos';
import { ProductFormOptimized } from '@/components/assistencia/ProductFormOptimized';
import { InventarioDialog } from '@/components/assistencia/InventarioDialog';
import { useProdutosPaginated } from '@/hooks/useProdutosPaginated';
import { useMarcasModelosSupabase } from '@/hooks/useMarcasModelosSupabase';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { currencyFormatters } from '@/utils/formatters';
import { getDemoAwareErrorMessage } from '@/utils/demoMode';
import { generateEtiquetaPDF, generateEtiquetasA4, EtiquetaData } from '@/utils/etiquetaGenerator';
import { Produto } from '@/types/assistencia';
import * as XLSX from 'xlsx';

import {
  Barcode,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Edit,
  FileSpreadsheet,
  MoreVertical,
  Package,
  Plus,
  Search,
  Trash2,
  Warehouse,
  X,
  XCircle,
  Zap,
  ClipboardList,
  ExternalLink,
  Ban,
  Settings,
  Shield,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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

// Componente de linha da tabela otimizado com React.memo
const ProdutoTableRow = memo(({ 
  produto, 
  isSelected, 
  onSelect, 
  onEdit,
  onDelete,
  onInativar,
  onClone,
  index = 0
}: { 
  produto: Produto; 
  isSelected: boolean; 
  onSelect: () => void; 
  onEdit: () => void;
  onDelete: () => void;
  onInativar: () => void;
  onClone: () => void;
  index?: number;
}) => {
  const valorVenda = useMemo(() => 
    currencyFormatters.brl(produto.preco_venda || produto.valor_venda || 0),
    [produto.preco_venda, produto.valor_venda]
  );

  const valor6x = useMemo(() => 
    currencyFormatters.brl(produto.valor_parcelado_6x ?? produto.preco_venda ?? produto.valor_venda ?? 0),
    [produto.valor_parcelado_6x, produto.preco_venda, produto.valor_venda]
  );

  const descricaoCompleta = useMemo(() => 
    produto.nome || produto.descricao || '',
    [produto.nome, produto.descricao]
  );

  const infoSecundaria = useMemo(() => {
    const parts = [];
    if (produto.referencia) parts.push(`Ref: ${produto.referencia}`);
    if (produto.codigo_barras) parts.push(`EAN: ${produto.codigo_barras}`);
    return parts.join(' • ');
  }, [produto.referencia, produto.codigo_barras]);

  // Calcular status do estoque - CORES MAIS FORTES PARA OPERAÇÃO
  const estoqueStatus = useMemo(() => {
    const quantidade = produto.quantidade || 0;
    const estoqueMinimo = produto.estoque_minimo || 0;
    
    if (quantidade === 0) {
      return { status: 'zerado', label: 'Zerado', className: 'bg-red-500 text-white border-red-600 shadow-sm' };
    } else if (quantidade <= estoqueMinimo && estoqueMinimo > 0) {
      return { status: 'baixo', label: 'Baixo', className: 'bg-amber-500 text-white border-amber-600 shadow-sm' };
    } else {
      return { status: 'ok', label: 'OK', className: 'bg-emerald-500 text-white border-emerald-600 shadow-sm' };
    }
  }, [produto.quantidade, produto.estoque_minimo]);

  // Zebra striping - MAIS VISÍVEL
  const zebraClass = index % 2 === 0 ? 'bg-white dark:bg-gray-950' : 'bg-gray-50/80 dark:bg-gray-900/50';
  
  return (
    <tr
      className={`${isSelected ? 'bg-blue-100 dark:bg-blue-950/40 ring-1 ring-blue-400' : `${zebraClass} cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30`} border-b border-gray-200 dark:border-gray-700 transition-all duration-150`}
      onClick={onSelect}
      onDoubleClick={(e) => { e.stopPropagation(); onEdit(); }}
      title="Duplo clique para editar"
    >
      {/* Código */}
      <td className="font-mono text-sm py-3.5 px-3 text-right border-r border-gray-200 dark:border-gray-700 w-[90px] hidden md:table-cell text-gray-700 dark:text-gray-300">
        {produto.codigo || '-'}
      </td>
      {/* Referência */}
      <td className="font-mono text-sm py-3.5 px-3 text-left text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 w-[120px] hidden lg:table-cell">
        {produto.referencia || '-'}
      </td>
      {/* Código de Barras */}
      <td className="font-mono text-xs py-3.5 px-3 text-left text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 w-[160px] hidden lg:table-cell">
        {produto.codigo_barras || '-'}
      </td>
      {/* Descrição - DESTAQUE PRINCIPAL */}
      <td className="py-3.5 px-3 text-left border-r border-gray-200 dark:border-gray-700">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="truncate uppercase font-medium text-gray-900 dark:text-gray-100">{descricaoCompleta}</div>
            </TooltipTrigger>
            {descricaoCompleta.length > 30 && (
              <TooltipContent><p className="max-w-xs">{descricaoCompleta}</p></TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        <div className="text-xs text-gray-500 md:hidden mt-1">{infoSecundaria || '-'}</div>
      </td>
      {/* Localização */}
      <td className="text-sm py-3.5 px-3 text-left text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 w-[140px] hidden lg:table-cell">
        {produto.localizacao || '-'}
      </td>
      {/* Estoque - BADGE DESTACADO */}
      <td className="text-sm py-3.5 px-3 text-right border-r border-gray-200 dark:border-gray-700 w-[100px]">
        <div className="flex items-center justify-end gap-2">
          <span className="font-mono font-bold text-gray-800 dark:text-gray-200">{produto.quantidade || 0}</span>
          <Badge className={`${estoqueStatus.className} text-[10px] px-2 py-0.5 font-semibold`}>
            {estoqueStatus.label}
          </Badge>
        </div>
      </td>
      {/* Unidade */}
      <td className="text-sm py-3.5 px-3 text-center text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 w-[70px] hidden md:table-cell">
        UN
      </td>
      {/* Valor parcelado 6x - padrão */}
      <td className="text-sm py-3.5 px-3 text-right border-r border-gray-200 dark:border-gray-700 w-[95px]">
        <span className="font-semibold text-emerald-700 dark:text-emerald-400">{valor6x}</span>
      </td>
      {/* Valor à vista (Dinheiro/PIX) */}
      <td className="text-sm py-3.5 px-3 text-right border-r border-gray-200 dark:border-gray-700 w-[95px]">
        <span className="font-medium text-gray-700 dark:text-gray-300">{valorVenda}</span>
      </td>
      {/* Ações */}
      <td className="py-3.5 px-3 text-center w-[80px]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClone(); }}>
              <Copy className="h-4 w-4 mr-2" />
              Clonar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={(e) => { e.stopPropagation(); onInativar(); }}
              className="text-amber-600 focus:text-amber-600"
            >
              <Ban className="h-4 w-4 mr-2" />
              Inativar
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
});
ProdutoTableRow.displayName = 'ProdutoTableRow';

// Colunas disponíveis para exportação
const EXPORT_COLUMNS = [
  { id: 'codigo', label: 'Código', checked: true },
  { id: 'referencia', label: 'Referência', checked: true },
  { id: 'codigo_barras', label: 'Código de Barras', checked: true },
  { id: 'descricao', label: 'Descrição', checked: true },
  { id: 'localizacao', label: 'Localização', checked: true },
  { id: 'quantidade', label: 'Estoque', checked: true },
  { id: 'unidade', label: 'Unidade', checked: true },
  { id: 'preco_venda', label: 'Valor de Venda', checked: true },
];

export default function Produtos() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  // Mobile: um toque abre o produto (double-tap não é confiável em touch)
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(pointer: coarse)');
    setIsTouchDevice(m.matches);
    const listener = () => setIsTouchDevice(m.matches);
    m.addEventListener('change', listener);
    return () => m.removeEventListener('change', listener);
  }, []);

  // Hook paginado
  const hookResult = useProdutosPaginated();
  
  const produtos = hookResult?.produtos || [];
  const grupos = hookResult?.grupos || [];
  const isLoading = hookResult?.isLoading || false;
  const isFetching = hookResult?.isFetching || false;
  const page = hookResult?.page || 1;
  const totalCount = hookResult?.totalCount || 0;
  const totalPages = hookResult?.totalPages || 1;
  const goToNextPage = hookResult?.goToNextPage || (() => {});
  const goToPreviousPage = hookResult?.goToPreviousPage || (() => {});
  const searchTerm = hookResult?.searchTerm || '';
  const setSearchTerm = hookResult?.setSearchTerm || (() => {});
  const searchFieldFromHook = (hookResult as any)?.searchField || 'all';
  const setSearchFieldFromHook = (hookResult as any)?.setSearchField || (() => {});
  const grupo = hookResult?.grupo || '';
  const setGrupo = hookResult?.setGrupo || (() => {});
  const localizacao = (hookResult as any)?.localizacao || '';
  const setLocalizacao = (hookResult as any)?.setLocalizacao || (() => {});
  const localizacoes = (hookResult as any)?.localizacoes || [];
  const createProduto = hookResult?.createProduto || (async () => {});
  const updateProduto = hookResult?.updateProduto || (async () => {});
  const deleteProduto = hookResult?.deleteProduto || (async () => {});
  
  // Ordenação
  const orderBy = (hookResult as any)?.orderBy || 'nome';
  const setOrderBy = (hookResult as any)?.setOrderBy || (() => {});
  const orderDirection = (hookResult as any)?.orderDirection || 'asc';
  const setOrderDirection = (hookResult as any)?.setOrderDirection || (() => {});

  const { marcas, modelos } = useMarcasModelosSupabase();

  const [showForm, setShowForm] = useState(false);
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null);
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);
  const [showEtiquetaModal, setShowEtiquetaModal] = useState(false);
  const [quantidadeEtiquetas, setQuantidadeEtiquetas] = useState(1);
  const [showEstoqueModal, setShowEstoqueModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showInventario, setShowInventario] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showInativarDialog, setShowInativarDialog] = useState(false);
  const [produtoToDelete, setProdutoToDelete] = useState<Produto | null>(null);
  const [produtoToInativar, setProdutoToInativar] = useState<Produto | null>(null);
  
  // Campo de busca selecionado (usa o estado do hook)
  type SearchFieldType = 'all' | 'codigo' | 'referencia' | 'codigo_barras' | 'descricao' | 'localizacao';
  const searchField = searchFieldFromHook as SearchFieldType;
  const setSearchField = setSearchFieldFromHook as (field: SearchFieldType) => void;
  
  const SEARCH_FIELD_LABELS: Record<SearchFieldType, string> = {
    all: 'Todos os campos',
    codigo: 'Código',
    referencia: 'Referência',
    codigo_barras: 'Cód. Barras',
    descricao: 'Descrição',
    localizacao: 'Localização',
  };

  // ═══════════════════════════════════════════════════════════════
  // EXPORTAÇÃO
  // ═══════════════════════════════════════════════════════════════
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportColumns, setExportColumns] = useState(EXPORT_COLUMNS.map(c => ({ ...c })));
  const [exportEstoque, setExportEstoque] = useState<'todos' | 'zerado' | 'baixo' | 'acima'>('todos');
  const [exportEstoqueMinimo, setExportEstoqueMinimo] = useState(5);
  const [exportMarca, setExportMarca] = useState<string>('all');
  const [exportLocalizacao, setExportLocalizacao] = useState<string>('');
  const [exportValorMin, setExportValorMin] = useState<string>('');
  const [exportValorMax, setExportValorMax] = useState<string>('');
  const [exportUsarBuscaAtual, setExportUsarBuscaAtual] = useState(true);
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [isExporting, setIsExporting] = useState(false);

  // Localizações únicas dos produtos
  const localizacoesUnicas = useMemo(() => {
    const locs = new Set<string>();
    produtos.forEach(p => p.localizacao && locs.add(p.localizacao));
    return Array.from(locs).sort();
  }, [produtos]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Filtrar produtos para exportação
      let dadosParaExportar = [...produtos];

      // Aplicar filtros
      if (exportEstoque === 'zerado') {
        dadosParaExportar = dadosParaExportar.filter(p => (p.quantidade || 0) === 0);
      } else if (exportEstoque === 'baixo') {
        dadosParaExportar = dadosParaExportar.filter(p => {
          const qtd = p.quantidade || 0;
          const min = p.estoque_minimo || exportEstoqueMinimo;
          return qtd > 0 && qtd <= min;
        });
      } else if (exportEstoque === 'acima') {
        dadosParaExportar = dadosParaExportar.filter(p => (p.quantidade || 0) > exportEstoqueMinimo);
      }

      if (exportMarca && exportMarca !== 'all') {
        dadosParaExportar = dadosParaExportar.filter(p => p.marca_id === exportMarca || p.marca === exportMarca);
      }

      if (exportLocalizacao) {
        dadosParaExportar = dadosParaExportar.filter(p => 
          p.localizacao?.toLowerCase().includes(exportLocalizacao.toLowerCase())
        );
      }

      if (exportValorMin) {
        const min = parseFloat(exportValorMin);
        dadosParaExportar = dadosParaExportar.filter(p => (p.preco_venda || 0) >= min);
      }

      if (exportValorMax) {
        const max = parseFloat(exportValorMax);
        dadosParaExportar = dadosParaExportar.filter(p => (p.preco_venda || 0) <= max);
      }

      // Filtrar busca atual se selecionado
      if (exportUsarBuscaAtual && searchTerm) {
        const termo = searchTerm.toLowerCase();
        dadosParaExportar = dadosParaExportar.filter(p =>
          (p.descricao?.toLowerCase().includes(termo)) ||
          (p.nome?.toLowerCase().includes(termo)) ||
          (p.codigo?.toString().includes(termo)) ||
          (p.referencia?.toLowerCase().includes(termo)) ||
          (p.codigo_barras?.includes(termo))
        );
      }

      // Preparar dados com colunas selecionadas
      const colunasAtivas = exportColumns.filter(c => c.checked);
      
      const dadosFormatados = dadosParaExportar.map(p => {
        const row: Record<string, any> = {};
        colunasAtivas.forEach(col => {
          switch (col.id) {
            case 'codigo': row['Código'] = p.codigo || ''; break;
            case 'referencia': row['Referência'] = p.referencia || ''; break;
            case 'codigo_barras': row['Código de Barras'] = p.codigo_barras || ''; break;
            case 'descricao': row['Descrição'] = p.descricao || p.nome || ''; break;
            case 'localizacao': row['Localização'] = p.localizacao || ''; break;
            case 'quantidade': row['Estoque'] = p.quantidade || 0; break;
            case 'unidade': row['Unidade'] = 'UN'; break;
            case 'preco_venda': row['Valor de Venda'] = p.preco_venda || 0; break;
          }
        });
        return row;
      });

      // Gerar arquivo
      const ws = XLSX.utils.json_to_sheet(dadosFormatados);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Produtos');

      // Ajustar largura das colunas
      const colWidths = colunasAtivas.map(col => ({ wch: col.label.length + 5 }));
      ws['!cols'] = colWidths;

      const filename = `produtos_${new Date().toISOString().split('T')[0]}`;
      
      if (exportFormat === 'xlsx') {
        XLSX.writeFile(wb, `${filename}.xlsx`);
      } else {
        XLSX.writeFile(wb, `${filename}.csv`, { bookType: 'csv' });
      }

      toast({
        title: 'Exportação concluída!',
        description: `${dadosFormatados.length} produtos exportados com sucesso.`,
      });

      setShowExportModal(false);
    } catch (error: any) {
      console.error('Erro na exportação:', error);
      toast({
        title: 'Erro na exportação',
        description: error?.message || 'Ocorreu um erro ao exportar.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Presets rápidos
  const applyPreset = (preset: 'zerado' | 'baixo' | 'completo') => {
    if (preset === 'zerado') {
      setExportEstoque('zerado');
      setExportMarca('all');
      setExportLocalizacao('');
      setExportValorMin('');
      setExportValorMax('');
    } else if (preset === 'baixo') {
      setExportEstoque('baixo');
      setExportEstoqueMinimo(5);
      setExportMarca('all');
      setExportLocalizacao('');
      setExportValorMin('');
      setExportValorMax('');
    } else {
      setExportEstoque('todos');
      setExportMarca('all');
      setExportLocalizacao('');
      setExportValorMin('');
      setExportValorMax('');
      setExportColumns(EXPORT_COLUMNS.map(c => ({ ...c, checked: true })));
    }
  };

  const toggleExportColumn = (id: string) => {
    setExportColumns(prev => prev.map(c => 
      c.id === id ? { ...c, checked: !c.checked } : c
    ));
  };

  // ═══════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════
  const handleClearFilters = () => {
    setSearchTerm('');
    setGrupo('');
    setLocalizacao('');
    setSearchField('all');
  };

  const handleNew = () => {
    setEditingProduto(null);
    setSelectedProduto(null);
    setShowForm(true);
  };

  const handleEdit = (produto: Produto) => {
    setEditingProduto(produto);
    setSelectedProduto(produto);
    setShowForm(true);
  };

  const handleClone = (produto: Produto) => {
    // Criar uma cópia do produto removendo apenas campos únicos
    // O formulário vai tratar como novo produto (código gerado) mas preencher os dados
    const { id, codigo, codigo_barras, created_at, updated_at, quantidade, ...produtoData } = produto;
    const produtoClonado: Partial<Produto> = {
      ...produtoData,
      // Remover apenas campos únicos (id, codigo, codigo_barras já removidos no destructuring)
      // quantidade removida para ser zerada pelo formulário
    };
    
    setEditingProduto(produtoClonado as Produto);
    setSelectedProduto(null);
    setShowForm(true);
  };

  // Abrir diálogo de inativar
  const handleInativarClick = (produto: Produto) => {
    setProdutoToInativar(produto);
    setShowInativarDialog(true);
  };

  // Confirmar inativação
  const handleConfirmInativar = async () => {
    if (!produtoToInativar) return;
    try {
      await updateProduto(produtoToInativar.id, { ...produtoToInativar, ativo: false });
      toast({ title: 'Produto inativado!', description: 'O produto foi marcado como inativo.' });
      setSelectedProduto(null);
      setProdutoToInativar(null);
      setShowInativarDialog(false);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: getDemoAwareErrorMessage(error, 'Não foi possível inativar.'),
        variant: 'destructive',
      });
    }
  };

  // Abrir diálogo de excluir
  const handleDeleteClick = (produto: Produto) => {
    setProdutoToDelete(produto);
    setShowDeleteDialog(true);
  };

  // Confirmar exclusão
  const handleConfirmDelete = async () => {
    if (!produtoToDelete) return;
    try {
      await deleteProduto(produtoToDelete.id);
      toast({ title: 'Produto excluído!', description: 'O produto foi removido permanentemente.' });
      setSelectedProduto(null);
      setProdutoToDelete(null);
      setShowDeleteDialog(false);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: getDemoAwareErrorMessage(error, 'Não foi possível excluir.'),
        variant: 'destructive',
      });
    }
  };


  // Handler para o botão na toolbar (usando produto selecionado)
  const handleInativar = async () => {
    if (!selectedProduto) return;
    handleInativarClick(selectedProduto);
  };

  const gerarCodigoBarras = (produto: Produto): string => {
    if (produto.codigo_barras) return produto.codigo_barras;
    if (produto.codigo) {
      const d12 = produto.codigo.toString().padStart(12, '0');
      let soma = 0;
      for (let i = 0; i < 12; i++) {
        const n = parseInt(d12[i]!, 10);
        soma += i % 2 === 0 ? n : n * 3;
      }
      const dv = (10 - (soma % 10)) % 10;
      return d12 + String(dv);
    }
    const base = produto.id.replace(/-/g, '').substring(0, 12).padStart(12, '0');
    let soma = 0;
    for (let i = 0; i < 12; i++) {
      const n = parseInt(base[i]!, 10);
      soma += i % 2 === 0 ? n : n * 3;
    }
    const dv = (10 - (soma % 10)) % 10;
    return base + String(dv);
  };

  const handleGerarEtiqueta = async () => {
    if (!selectedProduto) {
      toast({ title: 'Produto não selecionado', variant: 'destructive' });
      return;
    }
    try {
      const codigoBarras = gerarCodigoBarras(selectedProduto);
      if (!selectedProduto.codigo_barras) {
        await updateProduto(selectedProduto.id, { ...selectedProduto, codigo_barras: codigoBarras });
        toast({ title: 'Código de barras gerado', description: `Código ${codigoBarras} salvo.` });
      }
      const etiquetaData: EtiquetaData = {
        descricao: selectedProduto.descricao,
        descricao_abreviada: selectedProduto.descricao_abreviada,
        preco_venda: selectedProduto.preco_venda,
        codigo_barras: codigoBarras,
        codigo: selectedProduto.codigo,
        referencia: selectedProduto.referencia,
        empresa: { nome: 'PRIMECAMP', logo: 'https://primecamp.com.br/wp-content/uploads/2025/07/Design-sem-nome-4.png' },
      };
      if (quantidadeEtiquetas > 1) {
        const itens = Array.from({ length: quantidadeEtiquetas }, () => etiquetaData);
        const doc = await generateEtiquetasA4(itens, 7, 5);
        doc.autoPrint();
        window.open(doc.output('bloburl'), '_blank');
      } else {
        const doc = await generateEtiquetaPDF(etiquetaData);
        doc.autoPrint();
        window.open(doc.output('bloburl'), '_blank');
      }
      toast({ title: 'Etiqueta gerada', description: `Abrindo impressão para ${quantidadeEtiquetas} etiqueta(s)...` });
      setShowEtiquetaModal(false);
      setQuantidadeEtiquetas(1);
    } catch (error: any) {
      console.error(error);
      toast({ title: 'Erro ao gerar etiqueta', description: getDemoAwareErrorMessage(error, 'Tente novamente.'), variant: 'destructive' });
    }
  };

  const handleSave = async (produtoData: Partial<Produto>) => {
    try {
      if (editingProduto && editingProduto.id) {
        await updateProduto(editingProduto.id, produtoData);
        toast({ title: 'Produto atualizado com sucesso!' });
      } else {
        await createProduto(produtoData);
        toast({ title: 'Produto criado com sucesso!' });
      }
      setEditingProduto(null);
      setShowForm(false);
    } catch (error: any) {
      toast({ title: 'Erro', description: getDemoAwareErrorMessage(error, 'Erro ao salvar'), variant: 'destructive' });
      throw error;
    }
  };

  return (
    <ModernLayout title="Pesquisa de Produtos" subtitle="Gerenciar produtos e serviços">
      <div className="flex flex-col min-h-0 md:h-full md:overflow-hidden gap-3 md:gap-0 min-w-0">
        
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* BARRA DE FILTROS — Mobile: toque confortável; Desktop: completa */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        
        {/* Mobile: Busca + botão e filtros — min-h 44px, sem scroll interno */}
        <div className="md:hidden shrink-0 space-y-2">
          <div className="flex items-stretch gap-2 min-h-[44px]">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Buscar produto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-11 min-h-[44px] pl-10 pr-3 text-base border-input rounded-xl touch-manipulation"
              />
            </div>
            <Button onClick={handleNew} size="sm" className="h-11 min-h-[44px] min-w-[48px] px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shrink-0 touch-manipulation" aria-label="Novo produto">
              <Plus className="h-5 w-5" />
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Select value={grupo && grupo.trim() !== '' ? grupo : 'all'} onValueChange={(v) => { setGrupo(v === 'all' ? '' : v); hookResult.setPage(1); }}>
              <SelectTrigger className="h-11 min-h-[44px] w-full text-sm border-input rounded-xl touch-manipulation [&>span]:truncate">
                <SelectValue placeholder="Grupo" />
              </SelectTrigger>
              <SelectContent className="z-[110]">
                <SelectItem value="all">Todos os grupos</SelectItem>
                {grupos.map((g) => (<SelectItem key={g.id || g.nome} value={g.nome}>{g.nome}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={localizacao && localizacao.trim() !== '' ? localizacao : 'all'} onValueChange={(v) => { setLocalizacao(v === 'all' ? '' : v); hookResult.setPage(1); }}>
              <SelectTrigger className="h-11 min-h-[44px] w-full text-sm border-input rounded-xl touch-manipulation [&>span]:truncate">
                <SelectValue placeholder="Localização" />
              </SelectTrigger>
              <SelectContent className="z-[110]">
                <SelectItem value="all">Todas localizações</SelectItem>
                {localizacoes.map((loc: string) => (<SelectItem key={loc} value={loc}>{loc}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          {(searchTerm || grupo || localizacao) && (
            <Button variant="ghost" size="sm" onClick={handleClearFilters} className="h-11 min-h-[44px] w-full sm:w-auto rounded-xl touch-manipulation text-sm">
              <XCircle className="h-4 w-4 mr-2" /> Limpar filtros
            </Button>
          )}
        </div>

        {/* Desktop: Header completo */}
        <div className="hidden md:block bg-background/95 backdrop-blur-sm shrink-0 shadow-sm rounded-xl mb-3 border border-gray-200/50">
          <div className="flex flex-wrap items-center gap-2 p-3">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder={searchField === 'all' ? "Buscar por código, descrição, referência ou código de barras..." : `Buscar por ${SEARCH_FIELD_LABELS[searchField]}...`} 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className={`h-9 pl-10 text-sm border-gray-200 focus:border-blue-400 focus:ring-blue-400/20 ${searchField !== 'all' ? 'pr-24' : ''}`} 
              />
              {searchField !== 'all' && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 border-blue-200">
                    {SEARCH_FIELD_LABELS[searchField]}
                  </Badge>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-5 w-5 p-0" 
                    onClick={() => setSearchField('all')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            <Select value={grupo && grupo.trim() !== '' ? grupo : 'all'} onValueChange={(value) => { setGrupo(value === 'all' ? '' : value); hookResult.setPage(1); }}>
              <SelectTrigger className="h-9 w-[170px] shrink-0 border-gray-200 text-sm"><SelectValue placeholder="Grupo" /></SelectTrigger>
              <SelectContent className="z-[110]">
                <SelectItem value="all">Todos os grupos</SelectItem>
                {grupos.map((g) => (<SelectItem key={g.id || g.nome} value={g.nome}>{g.nome}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={localizacao && localizacao.trim() !== '' ? localizacao : 'all'} onValueChange={(value) => { setLocalizacao(value === 'all' ? '' : value); hookResult.setPage(1); }}>
              <SelectTrigger className="h-9 w-[170px] shrink-0 border-gray-200 text-sm"><SelectValue placeholder="Localização" /></SelectTrigger>
              <SelectContent className="z-[110]">
                <SelectItem value="all">Todas localizações</SelectItem>
                {localizacoes.map((loc: string) => (<SelectItem key={loc} value={loc}>{loc}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select 
              value={`${orderBy}-${orderDirection}`} 
              onValueChange={(value) => {
                const [field, direction] = value.split('-');
                setOrderBy(field as 'nome' | 'codigo');
                setOrderDirection(direction as 'asc' | 'desc');
                hookResult.setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-[200px] shrink-0 border-gray-200 text-sm">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent className="z-[110]">
                <SelectItem value="nome-asc">
                  <div className="flex items-center gap-2">
                    <ArrowUp className="h-3 w-3" />
                    Nome (A-Z)
                  </div>
                </SelectItem>
                <SelectItem value="nome-desc">
                  <div className="flex items-center gap-2">
                    <ArrowDown className="h-3 w-3" />
                    Nome (Z-A)
                  </div>
                </SelectItem>
                <SelectItem value="codigo-asc">
                  <div className="flex items-center gap-2">
                    <ArrowUp className="h-3 w-3" />
                    Código (Menor → Maior)
                  </div>
                </SelectItem>
                <SelectItem value="codigo-desc">
                  <div className="flex items-center gap-2">
                    <ArrowDown className="h-3 w-3" />
                    Código (Maior → Menor)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={handleClearFilters} disabled={!searchTerm && !grupo && !localizacao} className="h-9 px-3 text-muted-foreground hover:text-foreground">
              <XCircle className="h-4 w-4 mr-1.5" />Limpar
            </Button>
            <div className="flex items-center gap-2 flex-wrap ml-auto">
              {/* Botões essenciais sempre visíveis */}
              <Button onClick={handleNew} size="sm" className="h-9 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                <Plus className="h-4 w-4" />
                <span>Novo</span>
              </Button>
              <Button 
                onClick={() => selectedProduto && handleEdit(selectedProduto)} 
                size="sm" 
                variant="outline" 
                disabled={!selectedProduto} 
                className="h-9 gap-1.5 border-gray-200"
              >
                <Edit className="h-4 w-4" />
                <span className="hidden sm:inline">Editar</span>
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                disabled={!selectedProduto} 
                onClick={() => setShowEstoqueModal(true)} 
                className="h-9 gap-1.5 border-gray-200"
              >
                <Warehouse className="h-4 w-4" />
                <span className="hidden sm:inline">Estoque</span>
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                disabled={!selectedProduto} 
                onClick={() => setShowEtiquetaModal(true)} 
                className="h-9 gap-1.5 border-gray-200"
              >
                <Barcode className="h-4 w-4" />
                <span className="hidden sm:inline">Etiqueta</span>
              </Button>
              
              {/* Menu Admin com opções avançadas */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-9 gap-1.5 border-gray-200"
                  >
                    <Shield className="h-4 w-4" />
                    <span className="hidden sm:inline">Admin</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => setShowImport(true)}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Importar Produtos
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowExportModal(true)}>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar Produtos
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleInativar} disabled={!selectedProduto}>
                    <X className="h-4 w-4 mr-2" />
                    Inativar Produto
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowInventario(true)}>
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Inventário
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* ÁREA DA TABELA — mobile: página rola; desktop: scroll interno */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="flex flex-col min-h-0 md:flex-1 md:overflow-hidden">
          <Card className="flex flex-col border-gray-200 dark:border-gray-700 shadow-sm rounded-xl md:rounded-lg overflow-hidden md:flex-1 md:overflow-hidden">
            <CardContent className="p-0 flex flex-col md:flex-1 md:overflow-hidden md:min-h-0">
              {hookResult.error ? (
                <div className="p-12 text-center">
                  <EmptyState
                    icon={<Package className="h-12 w-12" />}
                    title="Erro ao carregar produtos"
                    description={hookResult.error instanceof Error ? hookResult.error.message : 'Ocorreu um erro.'}
                    action={undefined}
                  />
                </div>
              ) : isLoading ? (
                <div className="p-10 text-center text-muted-foreground">
                  <div className="space-y-3">
                    <div className="h-4 bg-muted rounded animate-pulse w-3/4 mx-auto" />
                    <div className="h-4 bg-muted rounded animate-pulse w-1/2 mx-auto" />
                    <div className="h-4 bg-muted rounded animate-pulse w-2/3 mx-auto" />
                  </div>
                </div>
              ) : produtos.length === 0 ? (
                <div className="p-12 text-center">
                  <EmptyState
                    icon={<Package className="h-12 w-12" />}
                    title="Nenhum produto encontrado"
                    description={searchTerm ? 'Tente buscar por outro termo' : 'Cadastre seu primeiro produto'}
                    action={!searchTerm ? { label: 'Novo Produto', onClick: handleNew } : undefined}
                  />
                </div>
              ) : (
                <>
                  {/* Desktop: Tabela */}
                  <div className="hidden md:flex flex-1 flex-col overflow-hidden min-h-0">
                    <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
                      <table className="w-full caption-bottom text-sm border-collapse table-fixed">
                        <thead className="sticky top-0 z-20 bg-gray-100 dark:bg-gray-800 shadow-sm">
                          <tr className="border-b-2 border-gray-300 dark:border-gray-600">
                            <th 
                              className={`h-12 px-3 text-right align-middle font-semibold border-r border-gray-200 dark:border-gray-600 w-[90px] text-xs uppercase tracking-wide cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors ${searchField === 'codigo' ? 'bg-blue-200 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200'}`}
                              onClick={() => setSearchField(searchField === 'codigo' ? 'all' : 'codigo')}
                              title="Clique para filtrar por Código"
                            >
                              Código {searchField === 'codigo' && <Search className="inline h-3 w-3 ml-1" />}
                            </th>
                            <th 
                              className={`h-12 px-3 text-left align-middle font-semibold border-r border-gray-200 dark:border-gray-600 w-[120px] hidden lg:table-cell text-xs uppercase tracking-wide cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors ${searchField === 'referencia' ? 'bg-blue-200 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200'}`}
                              onClick={() => setSearchField(searchField === 'referencia' ? 'all' : 'referencia')}
                              title="Clique para filtrar por Referência"
                            >
                              Referência {searchField === 'referencia' && <Search className="inline h-3 w-3 ml-1" />}
                            </th>
                            <th 
                              className={`h-12 px-3 text-left align-middle font-semibold border-r border-gray-200 dark:border-gray-600 w-[160px] hidden lg:table-cell text-xs uppercase tracking-wide cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors ${searchField === 'codigo_barras' ? 'bg-blue-200 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200'}`}
                              onClick={() => setSearchField(searchField === 'codigo_barras' ? 'all' : 'codigo_barras')}
                              title="Clique para filtrar por Código de Barras"
                            >
                              Cód. Barras {searchField === 'codigo_barras' && <Search className="inline h-3 w-3 ml-1" />}
                            </th>
                            <th 
                              className={`h-12 px-3 text-left align-middle font-semibold border-r border-gray-200 dark:border-gray-600 min-w-[200px] text-xs uppercase tracking-wide cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors ${searchField === 'descricao' ? 'bg-blue-200 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200'}`}
                              onClick={() => setSearchField(searchField === 'descricao' ? 'all' : 'descricao')}
                              title="Clique para filtrar por Descrição"
                            >
                              Descrição {searchField === 'descricao' && <Search className="inline h-3 w-3 ml-1" />}
                            </th>
                            <th 
                              className={`h-12 px-3 text-left align-middle font-semibold border-r border-gray-200 dark:border-gray-600 w-[140px] hidden lg:table-cell text-xs uppercase tracking-wide cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors ${searchField === 'localizacao' ? 'bg-blue-200 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200'}`}
                              onClick={() => setSearchField(searchField === 'localizacao' ? 'all' : 'localizacao')}
                              title="Clique para filtrar por Localização"
                            >
                              Localização {searchField === 'localizacao' && <Search className="inline h-3 w-3 ml-1" />}
                            </th>
                            <th className="h-12 px-3 text-right align-middle font-semibold text-gray-700 dark:text-gray-200 border-r border-gray-200 dark:border-gray-600 w-[100px] text-xs uppercase tracking-wide">Estoque</th>
                            <th className="h-12 px-3 text-center align-middle font-semibold text-gray-700 dark:text-gray-200 border-r border-gray-200 dark:border-gray-600 w-[70px] hidden md:table-cell text-xs uppercase tracking-wide">Unid.</th>
                            <th className="h-12 px-3 text-right align-middle font-semibold text-gray-700 dark:text-gray-200 border-r border-gray-200 dark:border-gray-600 w-[95px] text-xs uppercase tracking-wide">Valor 6x</th>
                            <th className="h-12 px-3 text-right align-middle font-semibold text-gray-700 dark:text-gray-200 border-r border-gray-200 dark:border-gray-600 w-[95px] text-xs uppercase tracking-wide">À vista</th>
                            <th className="h-12 px-3 text-center align-middle font-semibold text-gray-700 dark:text-gray-200 w-[80px] text-xs uppercase tracking-wide">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {isFetching && !isLoading && produtos.length > 0 ? (
                            produtos.map((produto, index) => (
                              <tr key={`skeleton-${produto.id}`} className={`border-b border-gray-100 ${index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}`}>
                                <td colSpan={10} className="py-3.5 px-3">
                                  <div className="h-9 bg-muted rounded animate-pulse" />
                                </td>
                              </tr>
                            ))
                          ) : (
                            produtos.map((produto, index) => (
                              <ProdutoTableRow
                                key={produto.id}
                                produto={produto}
                                isSelected={selectedProduto?.id === produto.id}
                                onSelect={() => setSelectedProduto(produto)}
                                onEdit={() => handleEdit(produto)}
                                onDelete={() => handleDeleteClick(produto)}
                                onInativar={() => handleInativarClick(produto)}
                                onClone={() => handleClone(produto)}
                                index={index}
                              />
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Paginação Desktop */}
                    <div className="shrink-0 border-t border-gray-200 bg-gray-50/50 px-4 py-3 flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        {isLoading ? (
                          <span>Carregando...</span>
                        ) : totalCount > 0 ? (
                          <>
                            Mostrando <span className="font-medium">{(page - 1) * (hookResult?.pageSize || 50) + 1}</span> a{' '}
                            <span className="font-medium">{Math.min(page * (hookResult?.pageSize || 50), totalCount)}</span> de{' '}
                            <span className="font-medium">{totalCount}</span> produtos
                          </>
                        ) : produtos.length > 0 ? (
                          <>
                            Mostrando <span className="font-medium">{(page - 1) * (hookResult?.pageSize || 50) + 1}</span> a{' '}
                            <span className="font-medium">{(page - 1) * (hookResult?.pageSize || 50) + produtos.length}</span> produtos
                          </>
                        ) : (
                          <span>Nenhum produto encontrado</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={goToPreviousPage}
                          disabled={page === 1 || isFetching}
                          className="h-8 border-gray-200"
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Anterior
                        </Button>
                        <span className="text-sm font-medium px-3">
                          {page} / {totalPages || 1}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={goToNextPage}
                          disabled={!totalPages || page >= totalPages || isFetching}
                          className="h-8 border-gray-200"
                        >
                          Próxima
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Mobile: Cards compactos — sem scroll interno, página rola */}
                  <div className="md:hidden">
                    <p className="text-xs text-muted-foreground px-3 py-2 border-b border-border/60">Toque para selecionar · duplo toque para editar</p>
                    <div className="space-y-2 px-3 py-2 pb-3">
                    {produtos.map((produto) => {
                      const valor6x = currencyFormatters.brl(produto.valor_parcelado_6x ?? produto.preco_venda ?? produto.valor_venda ?? 0);
                      const valorVenda = currencyFormatters.brl(produto.preco_venda || produto.valor_venda || 0);
                      const descricaoCompleta = produto.nome || produto.descricao || '';
                      const quantidade = produto.quantidade || 0;
                      const estoqueMinimo = produto.estoque_minimo || 0;
                      let estoqueStatus: { label: string; className: string };
                      if (quantidade === 0) {
                        estoqueStatus = { label: 'Zerado', className: 'bg-red-500 text-white shadow-sm' };
                      } else if (quantidade <= estoqueMinimo && estoqueMinimo > 0) {
                        estoqueStatus = { label: 'Baixo', className: 'bg-amber-500 text-white shadow-sm' };
                      } else {
                        estoqueStatus = { label: 'OK', className: 'bg-emerald-500 text-white shadow-sm' };
                      }

                      return (
                        <Card
                          key={produto.id}
                          className={`rounded-xl border overflow-hidden touch-manipulation active:scale-[0.99] cursor-pointer transition-all ${
                            selectedProduto?.id === produto.id
                              ? 'border-blue-500 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-blue-400 ring-offset-2'
                              : 'border-gray-200 dark:border-gray-700'
                          }`}
                          onClick={() => isTouchDevice ? handleEdit(produto) : setSelectedProduto(produto)}
                          onDoubleClick={!isTouchDevice ? (e) => { e.stopPropagation(); handleEdit(produto); } : undefined}
                        >
                          <CardContent className="p-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-foreground text-sm leading-tight truncate uppercase">{descricaoCompleta}</p>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                                  <span className="font-mono font-semibold tabular-nums">{quantidade}</span>
                                  <Badge className={`${estoqueStatus.className} text-[10px] px-1.5 py-0`}>{estoqueStatus.label}</Badge>
                                  {produto.referencia && <span>· Ref: {produto.referencia}</span>}
                                </div>
                                <div className="flex items-center gap-3 mt-1.5 text-xs">
                                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{valor6x}</span>
                                  <span className="text-muted-foreground">À vista {valorVenda}</span>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 w-9 p-0 rounded-lg shrink-0 touch-manipulation"
                                onClick={(e) => { e.stopPropagation(); handleEdit(produto); }}
                                aria-label="Editar"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Mobile: Paginação — toque fácil */}
          <div className="md:hidden shrink-0 mt-3 px-3 py-3 flex items-center justify-between gap-3 rounded-xl bg-muted/40 border border-border">
            <p className="text-xs text-muted-foreground tabular-nums min-w-0 truncate">
              {isLoading ? 'Carregando...' : totalCount > 0
                ? `${(page - 1) * (hookResult?.pageSize || 50) + 1}–${Math.min(page * (hookResult?.pageSize || 50), totalCount)} de ${totalCount}`
                : produtos.length > 0
                  ? `${(page - 1) * (hookResult?.pageSize || 50) + 1}–${(page - 1) * (hookResult?.pageSize || 50) + produtos.length}`
                  : 'Nenhum produto'}
            </p>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPreviousPage}
                disabled={page === 1 || isFetching}
                className="h-10 min-h-[44px] w-10 p-0 rounded-xl touch-manipulation"
                aria-label="Página anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <span className="min-w-[2.5rem] text-center text-sm font-medium tabular-nums px-1">{page} / {totalPages || 1}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextPage}
                disabled={!totalPages || page >= totalPages || isFetching}
                className="h-10 min-h-[44px] w-10 p-0 rounded-xl touch-manipulation"
                aria-label="Próxima página"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* MODAL DE EXPORTAÇÃO */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Exportar Produtos
              </DialogTitle>
              <DialogDescription>
                Configure os filtros e selecione as colunas para exportação
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Presets rápidos */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Presets Rápidos</Label>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => applyPreset('zerado')} className="gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-red-500" />
                    Estoque Zerado
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => applyPreset('baixo')} className="gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-orange-500" />
                    Estoque Baixo
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => applyPreset('completo')} className="gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-blue-500" />
                    Catálogo Completo
                  </Button>
                </div>
              </div>

              {/* Filtro de Estoque */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Filtro de Estoque</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Button
                    variant={exportEstoque === 'todos' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setExportEstoque('todos')}
                    className="justify-start"
                  >
                    Todos
                  </Button>
                  <Button
                    variant={exportEstoque === 'zerado' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setExportEstoque('zerado')}
                    className="justify-start"
                  >
                    Zerado
                  </Button>
                  <Button
                    variant={exportEstoque === 'baixo' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setExportEstoque('baixo')}
                    className="justify-start"
                  >
                    Baixo (≤{exportEstoqueMinimo})
                  </Button>
                  <Button
                    variant={exportEstoque === 'acima' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setExportEstoque('acima')}
                    className="justify-start"
                  >
                    Acima de
                  </Button>
                </div>
                {(exportEstoque === 'baixo' || exportEstoque === 'acima') && (
                  <Input
                    type="number"
                    min="0"
                    value={exportEstoqueMinimo}
                    onChange={(e) => setExportEstoqueMinimo(parseInt(e.target.value) || 0)}
                    placeholder="Quantidade"
                    className="w-32 mt-2"
                  />
                )}
              </div>

              {/* Filtros adicionais */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Marca</Label>
                  <Select value={exportMarca} onValueChange={setExportMarca}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as marcas" />
                    </SelectTrigger>
                    <SelectContent className="z-[110]">
                      <SelectItem value="all">Todas as marcas</SelectItem>
                      {marcas.map((m: any) => (
                        <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Localização</Label>
                  <Input
                    value={exportLocalizacao}
                    onChange={(e) => setExportLocalizacao(e.target.value)}
                    placeholder="Filtrar por localização..."
                    list="localizacoes"
                  />
                  <datalist id="localizacoes">
                    {localizacoesUnicas.map(loc => (
                      <option key={loc} value={loc} />
                    ))}
                  </datalist>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Valor Mínimo (R$)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={exportValorMin}
                    onChange={(e) => setExportValorMin(e.target.value)}
                    placeholder="0,00"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Valor Máximo (R$)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={exportValorMax}
                    onChange={(e) => setExportValorMax(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
              </div>

              {/* Considerar busca atual */}
              {searchTerm && (
                <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <Checkbox
                    id="usarBusca"
                    checked={exportUsarBuscaAtual}
                    onCheckedChange={(checked) => setExportUsarBuscaAtual(checked as boolean)}
                  />
                  <label htmlFor="usarBusca" className="text-sm cursor-pointer">
                    Considerar busca atual: <span className="font-medium">"{searchTerm}"</span>
                  </label>
                </div>
              )}

              {/* Colunas para exportar */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Colunas para Exportar</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {exportColumns.map((col) => (
                    <div key={col.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={col.id}
                        checked={col.checked}
                        onCheckedChange={() => toggleExportColumn(col.id)}
                      />
                      <label htmlFor={col.id} className="text-sm cursor-pointer">{col.label}</label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Formato */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Formato do Arquivo</Label>
                <div className="flex gap-2">
                  <Button
                    variant={exportFormat === 'xlsx' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setExportFormat('xlsx')}
                  >
                    Excel (.xlsx)
                  </Button>
                  <Button
                    variant={exportFormat === 'csv' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setExportFormat('csv')}
                  >
                    CSV (.csv)
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowExportModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleExport} disabled={isExporting || !exportColumns.some(c => c.checked)}>
                {isExporting ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Exportando...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de cadastro/edição */}
        <ProductFormOptimized
          open={showForm}
          onOpenChange={setShowForm}
          produto={editingProduto}
          onSave={handleSave}
          grupos={grupos}
          marcas={marcas}
          modelos={modelos}
        />

        {/* Modal de Etiqueta */}
        <Dialog open={showEtiquetaModal} onOpenChange={setShowEtiquetaModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Gerar Etiqueta</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedProduto && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label>Produto</Label>
                    <span className="font-semibold text-right">{selectedProduto.descricao}</span>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>Quantidade de Etiquetas</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={quantidadeEtiquetas}
                  onChange={(e) => setQuantidadeEtiquetas(Math.max(1, parseInt(e.target.value || '1', 10)))}
                />
                <p className="text-xs text-muted-foreground">
                  {quantidadeEtiquetas > 1 ? `${quantidadeEtiquetas} etiquetas em uma página A4` : '1 etiqueta (50mm x 30mm)'}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEtiquetaModal(false)}>Cancelar</Button>
              <Button onClick={handleGerarEtiqueta}>
                <Barcode className="h-4 w-4 mr-2" />
                Gerar Etiqueta
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Estoque */}
        <Dialog open={showEstoqueModal} onOpenChange={setShowEstoqueModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Informações de Estoque</DialogTitle>
            </DialogHeader>
            {selectedProduto ? (
              <div className="space-y-6 py-4">
                <div className="border-b pb-4">
                  <h3 className="font-semibold text-lg mb-2">{selectedProduto.nome || selectedProduto.descricao}</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                    <div><span className="font-medium">Código:</span> {selectedProduto.codigo || selectedProduto.id}</div>
                    <div><span className="font-medium">Referência:</span> {selectedProduto.referencia || '-'}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Estoque Atual</p>
                    <p className="text-2xl font-bold">{selectedProduto.quantidade || selectedProduto.estoque_atual || 0}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Estoque Mínimo</p>
                    <p className="text-2xl font-semibold">{selectedProduto.estoque_minimo || 0}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Preço de Venda</p>
                    <p className="text-2xl font-semibold text-green-600">
                      {currencyFormatters.brl(selectedProduto.valor_venda || selectedProduto.preco_venda || 0)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Valor Total (custo)</p>
                    <p className="text-2xl font-semibold">
                      {currencyFormatters.brl((selectedProduto.quantidade || selectedProduto.estoque_atual || 0) * (selectedProduto.preco_custo || selectedProduto.valor_compra || 0))}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Valor Total em Estoque (venda)</p>
                    <p className="text-2xl font-bold text-green-600">
                      {currencyFormatters.brl((selectedProduto.quantidade || selectedProduto.estoque_atual || 0) * (selectedProduto.valor_venda || selectedProduto.preco_venda || 0))}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Lucro Potencial</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {currencyFormatters.brl(
                        ((selectedProduto.quantidade || selectedProduto.estoque_atual || 0) * (selectedProduto.valor_venda || selectedProduto.preco_venda || 0)) - 
                        ((selectedProduto.quantidade || selectedProduto.estoque_atual || 0) * (selectedProduto.preco_custo || selectedProduto.valor_compra || 0))
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-6 text-muted-foreground">Selecione um produto.</div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEstoqueModal(false)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Importação */}
        <Dialog open={showImport} onOpenChange={setShowImport}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Importar Produtos em Massa</DialogTitle>
            </DialogHeader>
            <ImportarProdutos />
          </DialogContent>
        </Dialog>

        {/* Inventário (página atual) */}
        <InventarioDialog
          open={showInventario}
          onOpenChange={setShowInventario}
          filtrosAtuais={{ searchTerm, grupo, localizacao }}
        />

        {/* Dialog de Confirmação - Inativar */}
        <AlertDialog open={showInativarDialog} onOpenChange={setShowInativarDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Inativar Produto</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja inativar o produto <strong>"{produtoToInativar?.descricao || produtoToInativar?.nome}"</strong>?
                <br /><br />
                O produto ficará oculto nas listagens, mas poderá ser reativado posteriormente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setProdutoToInativar(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleConfirmInativar}
                className="bg-amber-600 hover:bg-amber-700"
              >
                <Ban className="h-4 w-4 mr-2" />
                Inativar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog de Confirmação - Excluir */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Produto</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja <strong>excluir permanentemente</strong> o produto <strong>"{produtoToDelete?.descricao || produtoToDelete?.nome}"</strong>?
                <br /><br />
                <span className="text-destructive font-medium">Esta ação não pode ser desfeita!</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setProdutoToDelete(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleConfirmDelete}
                className="bg-destructive hover:bg-destructive/90"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </ModernLayout>
  );
}
