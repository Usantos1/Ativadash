import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ModernLayout } from '@/components/ModernLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Save, X, Plus, Search, Phone, Printer, Send, Trash2, Edit,
  User, Smartphone, FileText, Check, AlertTriangle, Package, DollarSign, Download, ArrowLeft, Image, Upload, Settings, ChevronDown, ChevronUp,
  CreditCard, Wallet, QrCode, Banknote, History, MessageCircle
} from 'lucide-react';
import { 
  useOrdensServico, useClientes, useMarcasModelos, 
  usePagamentos, usePagamentosOSAPI, type PagamentoOSAPI, buscarCEP, useConfiguracaoStatus
} from '@/hooks/useAssistencia';
import { useItensOSSupabase } from '@/hooks/useItensOSSupabase';
import { useProdutosSupabase } from '@/hooks/useProdutosSupabase';
import { useOrdensServicoSupabase } from '@/hooks/useOrdensServicoSupabase';
import { from } from '@/integrations/db/client';
import { useClientesSupabase } from '@/hooks/useClientesSupabase';
import { useMarcasModelosSupabase } from '@/hooks/useMarcasModelosSupabase';
import { useFornecedores } from '@/hooks/useFornecedores';
import { useCargos } from '@/hooks/useCargos';
import { useWhatsApp } from '@/hooks/useWhatsApp';
import { 
  OrdemServicoFormData, CHECKLIST_ITENS, ItemOS, FormaPagamento,
  STATUS_OS_LABELS, STATUS_OS_COLORS, StatusOS, CARGOS_LABELS
} from '@/types/assistencia';
import { PAYMENT_METHOD_LABELS } from '@/types/pdv';
import { PatternLock } from '@/components/assistencia/PatternLock';
import { useOSImageReference } from '@/hooks/useOSImageReference';
import { OSImageReferenceViewer } from '@/components/assistencia/OSImageReferenceViewer';
import { CameraCapture } from '@/components/assistencia/CameraCapture';
import { currencyFormatters, dateFormatters, parseJsonArray } from '@/utils/formatters';
import { getDemoAwareErrorMessage } from '@/utils/demoMode';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { LoadingButton } from '@/components/LoadingButton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useTelegram } from '@/hooks/useTelegram';
import { useTelegramConfig } from '@/hooks/useTelegramConfig';
import { OSSummaryHeader } from '@/components/assistencia/OSSummaryHeader';
import { generateOSTermica } from '@/utils/osTermicaGenerator';
import { generateOSPDF } from '@/utils/osPDFGenerator';
import { printTermica, generateCupomTermica } from '@/utils/pdfGenerator';
import { updatePrintStatus, printViaIframe } from '@/utils/printUtils';
import { printOSTermicaDirect, resolveClienteForOsPrint, fetchPagamentosOsForTermica } from '@/utils/osPrintUtils';
import { useChecklistConfig } from '@/hooks/useChecklistConfig';
import { useAlertsFire } from '@/hooks/useAlerts';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanySegment } from '@/hooks/useCompanySegment';
import { usePaymentMethods as usePaymentMethodsHook } from '@/hooks/usePaymentMethods';
import { useRegisterPagamentoOS } from '@/hooks/usePDV';

interface OrdemServicoFormProps {
  osId?: string;
  onClose?: () => void;
  isModal?: boolean;
}

interface OSMovimentacao {
  id: string;
  data: string;
  tipo: string;
  acao: string;
  usuario: string;
  descricao: string;
  dados_anteriores?: any;
  dados_novos?: any;
}

// Componente para exibir movimentações da OS
function OSMovimentacoesTab({ osId }: { osId: string }) {
  const { data: movimentacoes = [], isLoading } = useQuery({
    queryKey: ['os_movimentacoes', osId],
    queryFn: async () => {
      const logs: OSMovimentacao[] = [];

      // 1. Buscar logs de auditoria da OS
      try {
        const { data: auditLogs } = await from('audit_logs')
          .select('id, acao, entidade, user_nome, descricao, dados_anteriores, dados_novos, created_at')
          .eq('entidade', 'ordem_servico')
          .eq('entidade_id', osId)
          .order('created_at', { ascending: false })
          .limit(500)
          .execute();

        if (auditLogs) {
          auditLogs.forEach((log: any) => {
            logs.push({
              id: `audit-${log.id}`,
              data: log.created_at,
              tipo: 'Auditoria',
              acao: log.acao,
              usuario: log.user_nome || 'Sistema',
              descricao: log.descricao || `${log.acao} em ordem de serviço`,
              dados_anteriores: log.dados_anteriores,
              dados_novos: log.dados_novos,
            });
          });
        }
      } catch (error) {
        console.error('Erro ao buscar audit logs:', error);
      }

      // 2. Buscar histórico de itens da OS (os_items com created_at e updated_at)
      try {
        const { data: osItens } = await from('os_items')
          .select('id, descricao, tipo, quantidade, valor_total, created_at, updated_at, colaborador_nome, created_by')
          .eq('ordem_servico_id', osId)
          .order('created_at', { ascending: false })
          .execute();

        if (osItens) {
          // Buscar nomes dos usuários que criaram os itens
          const userIds = [...new Set(osItens.map((item: any) => item.created_by).filter(Boolean))];
          const userMap = new Map();
          
          if (userIds.length > 0) {
            try {
              const { data: users } = await from('users')
                .select('id, display_name, email')
                .in('id', userIds)
                .execute();
              
              if (users) {
                users.forEach((u: any) => {
                  userMap.set(u.id, u.display_name || u.email || 'Usuário');
                });
              }
            } catch (e) {
              console.warn('Erro ao buscar usuários:', e);
            }
          }

          osItens.forEach((item: any) => {
            const usuarioNome = item.colaborador_nome || userMap.get(item.created_by) || 'Sistema';
            
            // Log de criação do item
            logs.push({
              id: `item-create-${item.id}`,
              data: item.created_at,
              tipo: 'Item',
              acao: 'Adicionado',
              usuario: usuarioNome,
              descricao: `${item.tipo === 'peca' ? 'Peça' : item.tipo === 'servico' ? 'Serviço' : 'Mão de Obra'}: ${item.descricao} - Qtd: ${item.quantidade}, Valor: ${currencyFormatters.brl(item.valor_total || 0)}`,
            });

            // Se foi atualizado, log de edição
            if (item.updated_at && item.updated_at !== item.created_at) {
              logs.push({
                id: `item-update-${item.id}`,
                data: item.updated_at,
                tipo: 'Item',
                acao: 'Editado',
                usuario: usuarioNome,
                descricao: `Item editado: ${item.descricao}`,
              });
            }
          });
        }
      } catch (error) {
        console.error('Erro ao buscar itens da OS:', error);
      }

      // 3. Buscar histórico da própria OS (apenas criação - atualizações vêm dos audit_logs)
      try {
        const { data: os } = await from('ordens_servico')
          .select('id, numero, created_at, created_by, vendedor_nome, atendente_nome')
          .eq('id', osId)
          .single();

        if (os) {
          // Buscar nome do usuário que criou a OS
          let criadorNome = os.vendedor_nome || os.atendente_nome || 'Sistema';
          if (os.created_by) {
            try {
              const { data: criador } = await from('users')
                .select('id, display_name, email')
                .eq('id', os.created_by)
                .single();
              
              if (criador) {
                criadorNome = criador.display_name || criador.email || criadorNome;
              }
            } catch (e) {
              console.warn('Erro ao buscar criador da OS:', e);
            }
          }

          // Log de criação da OS (apenas se não houver log de auditoria de criação)
          const temLogCriacao = logs.some(l => l.tipo === 'OS' && l.acao === 'Criada');
          if (!temLogCriacao) {
            logs.push({
              id: `os-create-${os.id}`,
              data: os.created_at,
              tipo: 'OS',
              acao: 'Criada',
              usuario: criadorNome,
              descricao: `Ordem de Serviço #${os.numero} criada`,
            });
          }
        }
      } catch (error) {
        console.error('Erro ao buscar OS:', error);
      }

      // Ordenar por data decrescente
      logs.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

      return logs;
    },
    enabled: !!osId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Logs da OS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Carregando histórico...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (movimentacoes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Logs da OS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum log registrado ainda</p>
            <p className="text-sm mt-2">Todas as edições, adições e exclusões aparecerão aqui</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const tipoBadgeColors: Record<string, string> = {
    'OS': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    'Item': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    'Auditoria': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  };

  const acaoBadgeColors: Record<string, string> = {
    'Criada': 'bg-green-100 text-green-700',
    'Atualizada': 'bg-blue-100 text-blue-700',
    'Adicionado': 'bg-emerald-100 text-emerald-700',
    'Editado': 'bg-yellow-100 text-yellow-700',
    'Removido': 'bg-red-100 text-red-700',
    'create': 'bg-green-100 text-green-700',
    'update': 'bg-blue-100 text-blue-700',
    'delete': 'bg-red-100 text-red-700',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Logs da OS
        </CardTitle>
        <CardDescription>
          Histórico completo de todas as ações e edições ({movimentacoes.length} registros)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden max-h-[600px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead className="w-[140px]">Data/Hora</TableHead>
                <TableHead className="w-[100px]">Tipo</TableHead>
                <TableHead className="w-[100px]">Ação</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-[150px]">Usuário</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimentacoes.map((mov) => {
                const dataFormatada = format(new Date(mov.data), "dd/MM/yyyy");
                const horaFormatada = format(new Date(mov.data), "HH:mm:ss");
                const tipoColor = tipoBadgeColors[mov.tipo] || 'bg-muted';
                const acaoColor = acaoBadgeColors[mov.acao] || acaoBadgeColors[mov.acao.toLowerCase()] || 'bg-gray-100 text-gray-700';

                return (
                  <TableRow key={mov.id} className="hover:bg-muted/50">
                    <TableCell className="text-sm">
                      <div className="flex flex-col">
                        <span className="font-medium">{dataFormatada}</span>
                        <span className="text-xs text-muted-foreground">{horaFormatada}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${tipoColor}`}>
                        {mov.tipo}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${acaoColor}`}>
                        {mov.acao}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{mov.descricao}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {mov.usuario}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OrdemServicoForm({ osId, onClose, isModal = false }: OrdemServicoFormProps = {} as OrdemServicoFormProps) {
  const navigate = useNavigate();
  const { id: routeId, tab: routeTab } = useParams<{ id?: string; tab?: string }>();
  const id = osId || routeId;
  const isEditing = Boolean(id);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const { segmentoSlug } = useCompanySegment();
  const isOficinaMecanica = segmentoSlug === 'oficina_mecanica';
  const currentUserNome = profile?.display_name || user?.email || 'Usuário';

  // Hooks
  const { createOS, updateOS, getOSById, updateStatus } = useOrdensServicoSupabase();
  const { clientes, searchClientes, searchClientesAsync, createCliente, getClienteById } = useClientesSupabase();
  const { marcas, modelos, getModelosByMarca, createModelo } = useMarcasModelosSupabase();
  const { produtos, searchProdutos, updateProduto, isLoading: isLoadingProdutos } = useProdutosSupabase();
  
  const { configuracoes, getConfigByStatus } = useConfiguracaoStatus();
  const { tecnicos, colaboradores, getColaboradorById, isLoading: isLoadingCargos } = useCargos();
  const { sendMessage, loading: whatsappLoading } = useWhatsApp();
  const { fire: fireAlert } = useAlertsFire();
  const { sendMultiplePhotos: sendTelegramPhotos, deleteMessage: deleteTelegramMessage, loading: telegramLoading } = useTelegram();
  const { imageUrl: osImageReferenceUrl } = useOSImageReference();
  const { itemsEntrada: checklistEntradaConfig, itemsSaida: checklistSaidaConfig } = useChecklistConfig();
  const { paymentMethods, fetchPaymentMethods } = usePaymentMethodsHook();
  
  // Configurações do Telegram do banco de dados
  const {
    chatIdEntrada: telegramChatIdEntradaFromDB,
    chatIdProcesso: telegramChatIdProcessoFromDB,
    chatIdSaida: telegramChatIdSaidaFromDB,
    updateChatIdEntrada,
    updateChatIdProcesso,
    updateChatIdSaida,
    isUpdating: isUpdatingTelegramConfig,
  } = useTelegramConfig();

  // Estados locais para Chat IDs do Telegram (carregados do banco ou da OS específica)
  const [telegramChatIdEntrada, setTelegramChatIdEntrada] = useState<string>('');
  const [telegramChatIdProcesso, setTelegramChatIdProcesso] = useState<string>('');
  const [telegramChatIdSaida, setTelegramChatIdSaida] = useState<string>('');

  // Carregar chat IDs do banco quando disponíveis (valores padrão globais)
  useEffect(() => {
    if (telegramChatIdEntradaFromDB) {
      setTelegramChatIdEntrada(telegramChatIdEntradaFromDB);
    }
  }, [telegramChatIdEntradaFromDB]);

  useEffect(() => {
    if (telegramChatIdProcessoFromDB) {
      setTelegramChatIdProcesso(telegramChatIdProcessoFromDB);
    }
  }, [telegramChatIdProcessoFromDB]);

  useEffect(() => {
    if (telegramChatIdSaidaFromDB) {
      setTelegramChatIdSaida(telegramChatIdSaidaFromDB);
    }
  }, [telegramChatIdSaidaFromDB]);

  // Carregar formas de pagamento (mesmas do PDV / Admin → Configurações → Pagamentos)
  useEffect(() => {
    fetchPaymentMethods(true);
  }, [fetchPaymentMethods]);

  // Estados do formulário (Oficina Mecânica: padrão veículo; Assistência: celular)
  const [formData, setFormData] = useState<OrdemServicoFormData>({
    cliente_id: '',
    telefone_contato: '', // Obrigatório
    tipo_aparelho: isOficinaMecanica ? 'veiculo' : 'celular',
    marca_id: '',
    modelo_id: '',
    imei: '',
    numero_serie: '',
    cor: '',
    senha_aparelho: '',
    senha_numerica: '', // Para iPhone
    padrao_desbloqueio: '', // Padrão de desbloqueio
    possui_senha: false,
    possui_senha_tipo: '', // Obrigatório: 'sim', 'nao', 'deslizar', 'nao_sabe', 'nao_autorizou'
    deixou_aparelho: true,
    apenas_agendamento: false,
    descricao_problema: '',
    condicoes_equipamento: '',
    previsao_entrega: '',
    hora_previsao: '18:00',
    observacoes: '',
    observacoes_internas: '',
    checklist_entrada: [],
    areas_defeito: [],
    observacoes_checklist: '',
    // Resolução
    problema_constatado: '',
    tecnico_id: '',
    servico_executado: '',
    // Orçamento (vazio em OS nova; 0 não deve aparecer nos campos)
    orcamento_parcelado: undefined as number | undefined,
    orcamento_desconto: undefined as number | undefined,
    orcamento_autorizado: false,
    apenas_orcamento: false,
  });

  // Estados para checklist de entrada (modal)
  const [showChecklistEntradaModal, setShowChecklistEntradaModal] = useState(false);
  const [checklistEntradaModalOSId, setChecklistEntradaModalOSId] = useState<string | null>(null);
  const [checklistEntradaModalMarcados, setChecklistEntradaModalMarcados] = useState<string[]>([]);
  const [checklistEntradaModalObservacoes, setChecklistEntradaModalObservacoes] = useState('');
  
  // Estados para checklist de saída
  const [showChecklistSaidaModal, setShowChecklistSaidaModal] = useState(false);
  const [checklistSaidaMarcados, setChecklistSaidaMarcados] = useState<string[]>([]);
  const [checklistSaidaAprovado, setChecklistSaidaAprovado] = useState<boolean | null>(null);
  const [checklistSaidaObservacoes, setChecklistSaidaObservacoes] = useState('');
  const [pendingStatusChange, setPendingStatusChange] = useState<string | null>(null);
  const [isSubmittingChecklistSaida, setIsSubmittingChecklistSaida] = useState(false);

  const [currentOS, setCurrentOS] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [localActiveTab, setLocalActiveTab] = useState('dados');
  const activeTab = isModal ? localActiveTab : (routeTab || 'dados');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [osLoaded, setOsLoaded] = useState(false); // Flag para evitar recarregar OS

  // Função para navegar entre as abas
  const handleTabChange = (tab: string) => {
    if (isModal) {
      // Se for modal, apenas muda o estado local
      setLocalActiveTab(tab);
      return;
    }
    // Se for página, navega pela URL
    if (isEditing && id) {
      navigate(`/os/${id}/${tab}`);
    } else {
      navigate(`/os/nova/${tab}`);
    }
  };

  // Estados para busca de cliente
  const [clienteSearch, setClienteSearch] = useState('');
  const [clienteResults, setClienteResults] = useState<any[]>([]);
  const [clienteSearchField, setClienteSearchField] = useState<'nome' | 'cpf_cnpj' | 'telefone'>('nome');
  const [isSearchingCliente, setIsSearchingCliente] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // Estados para novo cliente
  const [showNovoClienteModal, setShowNovoClienteModal] = useState(false);
  const [novoClienteData, setNovoClienteData] = useState({
    tipo_pessoa: 'fisica' as 'fisica' | 'juridica',
    nome: '',
    nome_fantasia: '',
    cpf_cnpj: '',
    rg: '',
    data_nascimento: '',
    telefone: '',
    whatsapp: '',
    telefone2: '',
    email: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
  });
  const [isCreatingCliente, setIsCreatingCliente] = useState(false);
  const [isBuscandoCEP, setIsBuscandoCEP] = useState(false);
  
  // Estados para novo modelo
  const [showNovoModeloModal, setShowNovoModeloModal] = useState(false);
  const [modeloPopoverOpen, setModeloPopoverOpen] = useState(false);
  const [modeloSearch, setModeloSearch] = useState('');
  const [novoModeloNome, setNovoModeloNome] = useState('');
  const [isCreatingModelo, setIsCreatingModelo] = useState(false);
  const [showClienteSearch, setShowClienteSearch] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<any>(null);
  const clienteSearchAnchorRef = useRef<HTMLDivElement>(null);
  const [clienteDropdownRect, setClienteDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);

  // Estados para itens da OS
  const [showAddItem, setShowAddItem] = useState(false);
  const [produtoSearch, setProdutoSearch] = useState('');
  const [produtoResults, setProdutoResults] = useState<any[]>([]);
  /** Produto escolhido na busca (mantém estoque_grade para exibir seletor de grade) */
  const [selectedProdutoForItem, setSelectedProdutoForItem] = useState<any>(null);
  const [itemForm, setItemForm] = useState({
    tipo: 'servico' as 'peca' | 'servico' | 'mao_de_obra',
    produto_id: undefined as string | undefined,
    descricao: '',
    quantidade: 1,
    valor_unitario: 0,
    valor_minimo: 0,
    desconto: 0,
    garantia: 90,
    colaborador_id: user?.id || '',
    fornecedor_id: '' as string,
    fornecedor_nome: '' as string,
    com_aro: '' as '' | 'com_aro' | 'sem_aro',
    grade_cor: '' as string,
  });
  const [editingItem, setEditingItem] = useState<ItemOS | null>(null);

  // Itens e pagamentos (apenas para edição)
  // Usar um ID temporário se a OS ainda não foi criada
  const osIdParaItens = id || currentOS?.id || 'temp';
  const { itens, total, addItem, updateItem, removeItem, isLoading: isLoadingItens, isAddingItem, isUpdatingItem, isRemovingItem } = useItensOSSupabase(osIdParaItens);
  const { pagamentos, totalPago, addPagamento } = usePagamentos(osIdParaItens);

  const { fornecedores, createFornecedor, updateFornecedor, deleteFornecedor } = useFornecedores();
  const [fornecedorPopoverOpen, setFornecedorPopoverOpen] = useState(false);
  const [fornecedorSearch, setFornecedorSearch] = useState('');
  const [showNovoFornecedorDialog, setShowNovoFornecedorDialog] = useState(false);
  const [novoFornecedorNome, setNovoFornecedorNome] = useState('');
  const [showEditFornecedorDialog, setShowEditFornecedorDialog] = useState(false);
  const [editFornecedorId, setEditFornecedorId] = useState<string | null>(null);
  const [editFornecedorNome, setEditFornecedorNome] = useState('');
  const [fornecedorToDelete, setFornecedorToDelete] = useState<{ id: string; nome: string } | null>(null);
  const [isDeletingFornecedor, setIsDeletingFornecedor] = useState(false);
  const fornecedoresFiltrados = useMemo(() => {
    const q = (fornecedorSearch || '').trim().toLowerCase();
    if (!q) return fornecedores.slice(0, 50);
    return fornecedores.filter(f => f.nome.toLowerCase().includes(q)).slice(0, 50);
  }, [fornecedores, fornecedorSearch]);
  const { pagamentos: pagamentosAPI, totalPago: totalPagoAPI, isLoading: isLoadingPagamentosAPI, refetch: refetchPagamentosAPI } = usePagamentosOSAPI(osIdParaItens);
  const { registerPagamentoOS, cancelPagamentoOS } = useRegisterPagamentoOS();
  const isAdmin = profile?.role === 'admin';

  // Resetar osLoaded quando o id mudar
  useEffect(() => {
    setOsLoaded(false);
  }, [id]);

  // Ao abrir uma OS, refetch da lista para evitar status diferente entre abas/ambientes (localhost x nuvem)
  useEffect(() => {
    if (isEditing && id) {
      queryClient.refetchQueries({ queryKey: ['ordens_servico'] });
    }
  }, [isEditing, id, queryClient]);

  // Quando a lista de OS atualizar (ex.: após refetch), atualizar currentOS para exibir status/dados em dia
  useEffect(() => {
    if (!isEditing || !id || !osLoaded || !currentOS) return;
    const fresh = getOSById(id);
    if (fresh && (fresh.status !== currentOS.status || fresh.updated_at !== currentOS.updated_at)) {
      setCurrentOS(fresh);
    }
  }, [id, isEditing, osLoaded, currentOS, getOSById]);

  // Carregar OS existente - APENAS UMA VEZ
  useEffect(() => {
    if (isEditing && id && !osLoaded) {
      // Tentar carregar múltiplas vezes se não encontrar (para casos de criação recente)
      let tentativas = 0;
      const carregarOS = async () => {
        const os = getOSById(id);
        if (os) {
          setCurrentOS(os);
          setFormData({
          cliente_id: os.cliente_id,
          telefone_contato: os.telefone_contato || '',
          tipo_aparelho: os.tipo_aparelho || 'celular',
          marca_id: os.marca_id || '',
          modelo_id: os.modelo_id || '',
          imei: os.imei || '',
          numero_serie: os.numero_serie || '',
          cor: os.cor || '',
          senha_aparelho: os.senha_aparelho || '',
          senha_numerica: os.senha_numerica || '',
          padrao_desbloqueio: (() => {
            const p = os.padrao_desbloqueio;
            if (typeof p === 'string' && p.trim()) return p;
            if (Array.isArray(p) && p.length >= 2) return p.map(n => Number(n)).filter(n => !isNaN(n) && n >= 0 && n <= 8).join('-');
            return '';
          })(),
          possui_senha: os.possui_senha,
          possui_senha_tipo: os.possui_senha_tipo || (os.possui_senha ? (os.padrao_desbloqueio ? 'deslizar' : 'sim') : 'nao'),
          deixou_aparelho: os.deixou_aparelho,
          apenas_agendamento: os.apenas_agendamento || false,
          descricao_problema: os.descricao_problema,
          condicoes_equipamento: os.condicoes_equipamento || '',
          previsao_entrega: (() => {
            const p = os.previsao_entrega;
            if (!p) return '';
            if (typeof p === 'string') return p.includes('T') ? p.split('T')[0] : p;
            if (p instanceof Date) return format(p, 'yyyy-MM-dd');
            return String(p).split('T')[0] || '';
          })(),
          hora_previsao: os.hora_previsao || '18:00',
          observacoes: os.observacoes || '',
          observacoes_internas: os.observacoes_internas || '',
          checklist_entrada: parseJsonArray(os.checklist_entrada),
          areas_defeito: parseJsonArray(os.areas_defeito),
          observacoes_checklist: os.observacoes_checklist || '',
          checklist_entrada_realizado_por_id: os.checklist_entrada_realizado_por_id || '',
          checklist_entrada_realizado_por_nome: os.checklist_entrada_realizado_por_nome || '',
          checklist_entrada_realizado_em: os.checklist_entrada_realizado_em || '',
          problema_constatado: os.problema_constatado || '',
          tecnico_id: os.tecnico_id || '',
          servico_executado: os.servico_executado || '',
          orcamento_parcelado: os.orcamento_parcelado || 0,
          orcamento_desconto: os.orcamento_desconto || 0,
          orcamento_autorizado: os.orcamento_autorizado || false,
          apenas_orcamento: (os as any).apenas_orcamento || false,
        });
        
        // Primeiro tenta buscar cliente localmente
        let cliente = getClienteById(os.cliente_id);
        
        // Se não encontrou localmente e tem cliente_id, buscar via API
        if (!cliente && os.cliente_id) {
          try {
            const API_URL = (import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.includes('localhost')) 
              ? import.meta.env.VITE_API_URL 
              : 'https://api.ativafix.com/api';
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`${API_URL}/query/clientes`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({ where: { id: os.cliente_id } }),
            });
            if (response.ok) {
              const result = await response.json();
              const clienteData = result.rows?.[0] || result.data?.[0];
              if (clienteData) {
                cliente = clienteData;
              }
            }
          } catch (error) {
            console.error('[OrdemServicoForm] Erro ao buscar cliente via API:', error);
          }
        }
        
        if (cliente) {
          setSelectedCliente(cliente);
        }

        // Carregar Chat IDs salvos na OS ou usar os do localStorage
        if (os.telegram_chat_id_entrada) {
          setTelegramChatIdEntrada(os.telegram_chat_id_entrada);
        }
        if (os.telegram_chat_id_processo) {
          setTelegramChatIdProcesso(os.telegram_chat_id_processo);
        }
        if (os.telegram_chat_id_saida) {
          setTelegramChatIdSaida(os.telegram_chat_id_saida);
        }
        
        setOsLoaded(true); // Marcar como carregado para não recarregar
        } else if (tentativas < 5) {
          tentativas++;
          setTimeout(carregarOS, 500);
        }
      };
      carregarOS();
    }
  }, [id, isEditing, getOSById, getClienteById, osLoaded]);

  // Atualizar valor_total da OS quando itens mudarem (com debounce para evitar várias requisições ao remover/adicionar vários itens)
  const valorTotalUpdateRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isEditing || !currentOS || total === undefined || total < 0 || isLoadingItens) return;
    const valorTotalAtual = Number(currentOS.valor_total || 0);
    const novoTotal = Number(total || 0);
    if (Math.abs(novoTotal - valorTotalAtual) <= 0.01 && !(novoTotal > 0 && valorTotalAtual === 0)) return;

    if (valorTotalUpdateRef.current) clearTimeout(valorTotalUpdateRef.current);
    valorTotalUpdateRef.current = setTimeout(() => {
      valorTotalUpdateRef.current = null;
      updateOS(currentOS.id, { valor_total: novoTotal })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['ordens_servico'] });
          queryClient.invalidateQueries({ queryKey: ['os_items_all'] });
        })
        .catch(error => {
          console.error('[OrdemServicoForm] Erro ao atualizar valor_total:', error);
        });
    }, 500);

    return () => {
      if (valorTotalUpdateRef.current) clearTimeout(valorTotalUpdateRef.current);
    };
  }, [total, isEditing, currentOS, updateOS, itens.length, queryClient, isLoadingItens]);

  // Atualizar nomes de colaboradores que estão faltando nos itens
  useEffect(() => {
    if (itens.length > 0 && colaboradores.length > 0) {
      itens.forEach(item => {
        if (item.colaborador_id && !item.colaborador_nome) {
          const colab = getColaboradorById(item.colaborador_id);
          if (colab) {
            updateItem(item.id, { colaborador_nome: colab.nome });
          }
        }
      });
    }
  }, [itens, colaboradores, getColaboradorById, updateItem]);

  // Buscar cliente (com debounce para evitar flickering)
  useEffect(() => {
    // Limpar timeout anterior
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (clienteSearch.length < 2) {
      setClienteResults([]);
      setIsSearchingCliente(false);
      return;
    }

    setIsSearchingCliente(true);

    // Debounce de 400ms para evitar múltiplas requisições
    const timeout = setTimeout(async () => {
      try {
        // Busca assíncrona com filtro de campo
        const asyncResults = await searchClientesAsync(clienteSearch, 20, clienteSearchField);
        setClienteResults(asyncResults);
      } catch (error) {
        console.error('Erro na busca de clientes:', error);
        setClienteResults([]);
      } finally {
        setIsSearchingCliente(false);
      }
    }, 400);

    setSearchTimeout(timeout);

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [clienteSearch, clienteSearchField, searchClientesAsync]);

  // Posição do dropdown de clientes (para portal) — atualiza quando abre ou ao scroll/resize
  const updateClienteDropdownRect = useCallback(() => {
    if (!clienteSearchAnchorRef.current) return;
    const rect = clienteSearchAnchorRef.current.getBoundingClientRect();
    setClienteDropdownRect({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }, []);
  useEffect(() => {
    const shouldShow = showClienteSearch && !selectedCliente && (
      (!isSearchingCliente && clienteResults.length > 0) ||
      (!isSearchingCliente && clienteSearch.length >= 2 && clienteResults.length === 0)
    );
    if (shouldShow) {
      updateClienteDropdownRect();
      window.addEventListener('scroll', updateClienteDropdownRect, true);
      window.addEventListener('resize', updateClienteDropdownRect);
      return () => {
        window.removeEventListener('scroll', updateClienteDropdownRect, true);
        window.removeEventListener('resize', updateClienteDropdownRect);
      };
    }
    setClienteDropdownRect(null);
  }, [showClienteSearch, selectedCliente, isSearchingCliente, clienteResults.length, clienteSearch.length, updateClienteDropdownRect]);

  // Buscar produtos - SEMPRE filtrar apenas produtos com estoque disponível
  useEffect(() => {
    if (produtoSearch.length >= 2) {
      const results = searchProdutos(produtoSearch);
      
      // Filtrar produtos com estoque > 0
      let produtosFiltrados = results.filter(prod => (prod.quantidade || 0) > 0);
      
      // Se o tipo for "peca", também filtrar por tipo
      if (itemForm.tipo === 'peca') {
        produtosFiltrados = produtosFiltrados.filter(prod => {
          const isPeca = prod.tipo === 'peca' || prod.tipo === 'produto' || prod.tipo === 'PECA' || prod.tipo === 'PRODUTO';
          return isPeca;
        });
      }
      
      setProdutoResults(produtosFiltrados.slice(0, 10));
    } else {
      setProdutoResults([]);
    }
  }, [produtoSearch, searchProdutos, itemForm.tipo, produtos.length]);

  // Modelos filtrados por marca
  const modelosFiltrados = useMemo(() => {
    if (!formData.marca_id) return [];
    return getModelosByMarca(formData.marca_id);
  }, [formData.marca_id, getModelosByMarca]);

  // Modelos filtrados por pesquisa (dropdown Modelo em os/nova)
  const modelosFiltradosBySearch = useMemo(() => {
    const q = (modeloSearch || '').trim().toLowerCase();
    if (!q) return modelosFiltrados.filter(m => m.situacao === 'ativo');
    return modelosFiltrados.filter(m => m.situacao === 'ativo' && m.nome.toLowerCase().includes(q));
  }, [modelosFiltrados, modeloSearch]);

  // Garantir que marcas sejam inicializadas
  useEffect(() => {
    // O hook useMarcasModelos já inicializa automaticamente
    // Mas vamos forçar a inicialização se necessário
    // Sem logs aqui para evitar spam no console
  }, [marcas]);

  // Selecionar cliente
  const handleSelectCliente = (cliente: any) => {
    setSelectedCliente(cliente);
    setFormData(prev => ({
      ...prev,
      cliente_id: cliente.id,
      telefone_contato: cliente.whatsapp || cliente.telefone || '',
    }));
    setShowClienteSearch(false);
    setClienteSearch('');
  };

  // Criar novo cliente e selecionar
  const handleCreateNovoCliente = async () => {
    if (!novoClienteData.nome.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }
    if (!novoClienteData.whatsapp.trim()) {
      toast({ title: 'Celular/WhatsApp é obrigatório', variant: 'destructive' });
      return;
    }

    setIsCreatingCliente(true);
    try {
      const novoCliente = await createCliente({
        tipo_pessoa: novoClienteData.tipo_pessoa,
        nome: novoClienteData.nome.trim(),
        nome_fantasia: novoClienteData.nome_fantasia?.trim() || null,
        cpf_cnpj: novoClienteData.cpf_cnpj?.trim() || null,
        rg: novoClienteData.rg?.trim() || null,
        data_nascimento: novoClienteData.data_nascimento || null,
        telefone: novoClienteData.whatsapp.trim(),
        whatsapp: novoClienteData.whatsapp.trim(),
        email: novoClienteData.email?.trim() || null,
        cep: novoClienteData.cep?.trim() || null,
        logradouro: novoClienteData.logradouro?.trim() || null,
        numero: novoClienteData.numero?.trim() || null,
        complemento: novoClienteData.complemento?.trim() || null,
        bairro: novoClienteData.bairro?.trim() || null,
        cidade: novoClienteData.cidade?.trim() || null,
        estado: novoClienteData.estado?.trim() || null,
      });

      // Selecionar o cliente recém-criado
      handleSelectCliente(novoCliente);
      
      // Limpar e fechar modal
      resetNovoClienteForm();
      setShowNovoClienteModal(false);
      
      toast({ title: 'Cliente cadastrado com sucesso!' });
    } catch (error: any) {
      console.error('Erro ao criar cliente:', error);
      toast({
        title: 'Erro ao cadastrar cliente',
        description: getDemoAwareErrorMessage(error, 'Tente novamente'),
        variant: 'destructive'
      });
    } finally {
      setIsCreatingCliente(false);
    }
  };

  // Resetar form de novo cliente
  const resetNovoClienteForm = () => {
    setNovoClienteData({
      tipo_pessoa: 'fisica',
      nome: '',
      nome_fantasia: '',
      cpf_cnpj: '',
      rg: '',
      data_nascimento: '',
      telefone: '',
      whatsapp: '',
      telefone2: '',
      email: '',
      cep: '',
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      estado: '',
    });
  };

  // Buscar CEP para novo cliente
  const handleBuscarCEPNovoCliente = async () => {
    if (!novoClienteData.cep || novoClienteData.cep.length < 8) return;
    
    setIsBuscandoCEP(true);
    try {
      const endereco = await buscarCEP(novoClienteData.cep.replace(/\D/g, ''));
      if (endereco) {
        setNovoClienteData(prev => ({
          ...prev,
          logradouro: endereco.logradouro || '',
          bairro: endereco.bairro || '',
          cidade: endereco.localidade || '',
          estado: endereco.uf || '',
        }));
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    } finally {
      setIsBuscandoCEP(false);
    }
  };

  // Abrir modal de novo cliente com nome da busca
  const handleOpenNovoClienteModal = () => {
    resetNovoClienteForm();
    setNovoClienteData(prev => ({ 
      ...prev, 
      nome: clienteSearch.trim() 
    }));
    setShowNovoClienteModal(true);
    setShowClienteSearch(false);
  };

  // Criar novo modelo
  const handleCreateNovoModelo = async () => {
    if (!novoModeloNome.trim()) {
      toast({ title: 'Nome do modelo é obrigatório', variant: 'destructive' });
      return;
    }
    if (!formData.marca_id) {
      toast({ title: 'Selecione uma marca primeiro', variant: 'destructive' });
      return;
    }

    setIsCreatingModelo(true);
    try {
      const novoModelo = await createModelo(formData.marca_id, novoModeloNome.trim());
      
      // Selecionar o modelo recém-criado
      setFormData(prev => ({ ...prev, modelo_id: novoModelo.id }));
      
      // Limpar e fechar modal
      setNovoModeloNome('');
      setShowNovoModeloModal(false);
      
      toast({ title: 'Modelo cadastrado com sucesso!' });
    } catch (error: any) {
      console.error('Erro ao criar modelo:', error);
      toast({
        title: 'Erro ao cadastrar modelo',
        description: getDemoAwareErrorMessage(error, 'Tente novamente'),
        variant: 'destructive'
      });
    } finally {
      setIsCreatingModelo(false);
    }
  };

  // Toggle checklist
  const toggleChecklist = (itemId: string) => {
    const userId = user?.id || '';
    const userNome = profile?.display_name || user?.email || '';
    const agora = new Date().toISOString();
    setFormData(prev => {
      const currentChecklist = parseJsonArray(prev.checklist_entrada);
      const nextChecklist = currentChecklist.includes(itemId)
        ? currentChecklist.filter(i => i !== itemId)
        : [...currentChecklist, itemId];
      return {
        ...prev,
        checklist_entrada: nextChecklist,
        checklist_entrada_realizado_por_id: userId || prev.checklist_entrada_realizado_por_id,
        checklist_entrada_realizado_por_nome: userNome || prev.checklist_entrada_realizado_por_nome,
        checklist_entrada_realizado_em: agora,
      };
    });
  };

  // Adicionar/Editar item
  const handleSubmitItem = async () => {
    try {
      // Validar produto e estoque quando há produto vinculado (peça ou serviço com produto)
      if (itemForm.tipo === 'peca' && !itemForm.produto_id && itemForm.descricao.trim()) {
        // Peça sem produto selecionado mas com descrição: permitir (sem controle de estoque)
      } else if (itemForm.tipo === 'peca' && !itemForm.produto_id) {
        toast({
          title: 'Produto obrigatório',
          description: 'Selecione uma peça do estoque para adicionar.',
          variant: 'destructive',
        });
        return;
      }
      if (itemForm.produto_id) {
        const produto = produtos.find(p => p.id === itemForm.produto_id) as any;
        if (!produto) {
          toast({
            title: 'Produto não encontrado',
            description: 'O produto selecionado não foi encontrado.',
            variant: 'destructive',
          });
          return;
        }
        const gradePorCor = produto?.estoque_grade?.tipo === 'cor' && produto?.estoque_grade?.itens && Object.keys(produto.estoque_grade.itens).length > 0;
        const gradePorAro = produto?.estoque_grade?.tipo === 'aro' && produto?.estoque_grade?.itens && Object.keys(produto.estoque_grade.itens).length > 0;
        if (gradePorCor && (!itemForm.grade_cor || !itemForm.grade_cor.trim())) {
          toast({
            title: 'Grade obrigatória',
            description: 'Este produto tem grade por cor. Selecione a cor no modal.',
            variant: 'destructive',
          });
          return;
        }
        if (gradePorAro && (!itemForm.com_aro || (itemForm.com_aro !== 'com_aro' && itemForm.com_aro !== 'sem_aro'))) {
          toast({
            title: 'Grade obrigatória',
            description: 'Este produto tem grade (Com Aro / Sem Aro). Selecione a opção no modal.',
            variant: 'destructive',
          });
          return;
        }
        let estoqueDisponivel = produto.quantidade || 0;
        if (gradePorCor && itemForm.grade_cor && produto.estoque_grade?.itens?.[itemForm.grade_cor] != null) {
          estoqueDisponivel = Number(produto.estoque_grade.itens[itemForm.grade_cor]) || 0;
        }
        if (gradePorAro && itemForm.com_aro) {
          const aroKey = comAroToGradeKey(itemForm.com_aro);
          if (aroKey && produto.estoque_grade?.itens?.[aroKey] != null) {
            estoqueDisponivel = Number(produto.estoque_grade.itens[aroKey]) || 0;
          }
        }
        if (estoqueDisponivel < itemForm.quantidade) {
          const gradeLabel = itemForm.grade_cor ? ` (cor: ${itemForm.grade_cor})` : (itemForm.com_aro ? ` (${itemForm.com_aro === 'com_aro' ? 'Com Aro' : 'Sem Aro'})` : '');
          toast({
            title: 'Estoque insuficiente',
            description: `Estoque disponível: ${estoqueDisponivel} unidades${gradeLabel}. Quantidade solicitada: ${itemForm.quantidade}`,
            variant: 'destructive',
          });
          return;
        }
      }
      
      if (!itemForm.descricao.trim()) {
        toast({
          title: 'Descrição obrigatória',
          description: 'Informe a descrição do item.',
          variant: 'destructive',
        });
        return;
      }
      
      // Se não tiver ID e não tiver OS criada, criar a OS primeiro
      if (!id && !currentOS) {
        toast({
          title: 'OS não encontrada',
          description: 'Salve a OS primeiro antes de adicionar itens.',
          variant: 'destructive',
        });
        return;
      }
      
      // Se não tiver ID mas tiver OS criada, usar o ID da OS
      const osIdParaItem = id || currentOS?.id;
      if (!osIdParaItem) {
        toast({
          title: 'OS não encontrada',
          description: 'Não foi possível identificar a ordem de serviço.',
          variant: 'destructive',
        });
        return;
      }

      let osNumero = 0;
      if (id) {
        const os = getOSById(id);
        osNumero = os?.numero ?? 0;
      }
      if (!osNumero && currentOS?.numero) osNumero = currentOS.numero;

      // Calcular dados do item
      const valorTotal = (itemForm.quantidade * itemForm.valor_unitario) - itemForm.desconto;
      const isCreatingItem = !editingItem;
      const resolvedColaboradorId = isCreatingItem ? (user?.id || '') : (itemForm.colaborador_id || '');
      const colaborador = resolvedColaboradorId ? getColaboradorById(resolvedColaboradorId) : null;
      const resolvedColaboradorNome =
        colaborador?.nome ||
        (isCreatingItem ? currentUserNome : (editingItem?.colaborador_nome || currentUserNome));
      const comAroValido = (itemForm.com_aro === 'com_aro' || itemForm.com_aro === 'sem_aro')
        ? itemForm.com_aro
        : (gradeKeyToComAro(itemForm.com_aro) || null);
      const gradeCorValido = (itemForm.grade_cor && itemForm.grade_cor.trim()) ? itemForm.grade_cor.trim() : null;
      const itemData = {
        tipo: itemForm.tipo,
        produto_id: itemForm.produto_id ?? null,
        descricao: itemForm.descricao,
        quantidade: Number(itemForm.quantidade),
        valor_unitario: Number(itemForm.valor_unitario),
        valor_minimo: Number(itemForm.valor_minimo || 0),
        desconto: Number(itemForm.desconto),
        garantia: Number(itemForm.garantia || 90),
        colaborador_id: resolvedColaboradorId || null,
        colaborador_nome: resolvedColaboradorNome || null,
        fornecedor_id: itemForm.fornecedor_id || null,
        fornecedor_nome: itemForm.fornecedor_nome?.trim() || null,
        com_aro: comAroValido,
        grade_cor: gradeCorValido,
        valor_total: Number(valorTotal),
      };

      if (editingItem) {
        // Editar: ajustar estoque só se quantidade mudou e item tem produto
        if (itemForm.produto_id) {
          const produto = produtos.find(p => p.id === itemForm.produto_id) as any;
          if (produto) {
            const quantidadeAntiga = editingItem.quantidade || 0;
            const quantidadeNova = itemForm.quantidade;
            const diferenca = quantidadeNova - quantidadeAntiga;
            if (diferenca !== 0) {
              const grade = produto.estoque_grade;
              const gradeCor = grade?.tipo === 'cor' && itemForm.grade_cor && grade?.itens?.[itemForm.grade_cor] != null;
              const gradeAro = grade?.tipo === 'aro' && itemForm.com_aro;
              const aroKey = gradeAro ? comAroToGradeKey(itemForm.com_aro) : null;
              let estoqueAtual: number;
              let payload: { quantidade: number; estoque_grade?: { tipo: string; itens: Record<string, number> } };
              if (gradeCor) {
                estoqueAtual = Number(grade.itens[itemForm.grade_cor]) || 0;
                const novoValor = Math.max(0, estoqueAtual - diferenca);
                const newItens = { ...grade.itens, [itemForm.grade_cor]: novoValor };
                const newTotal = Object.values(newItens).reduce((a, b) => a + (Number(b) || 0), 0);
                payload = { quantidade: newTotal, estoque_grade: { tipo: 'cor', itens: newItens } };
              } else if (gradeAro && aroKey && grade?.itens?.[aroKey] != null) {
                estoqueAtual = Number(grade.itens[aroKey]) || 0;
                const novoValor = Math.max(0, estoqueAtual - diferenca);
                const newItens = { ...grade.itens, [aroKey]: novoValor };
                const newTotal = Object.values(newItens).reduce((a, b) => a + (Number(b) || 0), 0);
                payload = { quantidade: newTotal, estoque_grade: { tipo: 'aro', itens: newItens } };
              } else {
                estoqueAtual = produto.quantidade || 0;
                const novoEstoque = Math.max(0, estoqueAtual - diferenca);
                payload = { quantidade: novoEstoque };
              }
              const novoEstoque = payload.quantidade;
              if (diferenca > 0 && estoqueAtual < diferenca) {
                toast({
                  title: 'Estoque insuficiente',
                  description: `Estoque disponível: ${estoqueAtual} unidades. Não é possível aumentar a quantidade em ${diferenca} unidades.`,
                  variant: 'destructive',
                });
                return;
              }
              await updateProduto(produto.id, payload, { skipMovementLog: true });
              try {
                const houveSaida = diferenca > 0;
                await from('produto_movimentacoes')
                  .insert({
                    produto_id: produto.id,
                    tipo: houveSaida ? 'baixa_os' : 'devolucao_os',
                    motivo: houveSaida
                      ? `Quantidade adicionada na OS #${osNumero || '?'}`
                      : `Quantidade devolvida da OS #${osNumero || '?'}`,
                    quantidade_antes: estoqueAtual,
                    quantidade_depois: payload.quantidade,
                    quantidade_delta: -diferenca,
                    user_id: user?.id || null,
                    user_nome: currentUserNome,
                  })
                  .execute();
              } catch (movError) {
                console.error('Erro ao registrar movimentação de edição OS:', movError);
              }
              queryClient.invalidateQueries({ queryKey: ['produto_movimentacoes'] });
              queryClient.invalidateQueries({ queryKey: ['produtos'] });
            }
          }
        }
        await updateItem(editingItem.id, itemData);
        setEditingItem(null);
        toast({
          title: 'Item atualizado',
          description: 'O item foi atualizado com sucesso.',
        });
      } else {
        // Adicionar: primeiro gravar o item; depois baixa no estoque e movimentação (evita inconsistência se addItem falhar)
        await addItem(itemData);
        if (itemForm.produto_id) {
          const produto = produtos.find(p => p.id === itemForm.produto_id) as any;
          if (produto) {
            const grade = produto.estoque_grade;
            const gradeCor = grade?.tipo === 'cor' && itemForm.grade_cor && grade?.itens?.[itemForm.grade_cor] != null;
            const gradeAro = grade?.tipo === 'aro' && itemForm.com_aro;
            const aroKey = gradeAro ? comAroToGradeKey(itemForm.com_aro) : null;
            let estoqueAtual: number;
            let payload: { quantidade: number; estoque_grade?: { tipo: string; itens: Record<string, number> } };
            if (gradeCor) {
              estoqueAtual = Number(grade.itens[itemForm.grade_cor]) || 0;
              const novoValor = Math.max(0, estoqueAtual - itemForm.quantidade);
              const newItens = { ...grade.itens, [itemForm.grade_cor]: novoValor };
              payload = { quantidade: Object.values(newItens).reduce((a, b) => a + (Number(b) || 0), 0), estoque_grade: { tipo: 'cor', itens: newItens } };
            } else if (gradeAro && aroKey && grade?.itens?.[aroKey] != null) {
              estoqueAtual = Number(grade.itens[aroKey]) || 0;
              const novoValor = Math.max(0, estoqueAtual - itemForm.quantidade);
              const newItens = { ...grade.itens, [aroKey]: novoValor };
              payload = { quantidade: Object.values(newItens).reduce((a, b) => a + (Number(b) || 0), 0), estoque_grade: { tipo: 'aro', itens: newItens } };
            } else {
              estoqueAtual = produto.quantidade || 0;
              payload = { quantidade: Math.max(0, estoqueAtual - itemForm.quantidade) };
            }
            await updateProduto(produto.id, payload, { skipMovementLog: true });
            try {
              await from('produto_movimentacoes')
                .insert({
                  produto_id: produto.id,
                  tipo: 'baixa_os',
                  motivo: `Item adicionado na OS #${osNumero || '?'}`,
                  quantidade_antes: produto.quantidade ?? 0,
                  quantidade_depois: payload.quantidade,
                  quantidade_delta: -itemForm.quantidade,
                  user_id: user?.id || null,
                  user_nome: currentUserNome,
                })
                .execute();
            } catch (movError) {
              console.error('Erro ao registrar movimentação de adição OS:', movError);
            }
            queryClient.invalidateQueries({ queryKey: ['produto_movimentacoes'] });
            queryClient.invalidateQueries({ queryKey: ['produtos'] });
          }
        }
        toast({
          title: 'Item adicionado',
          description: 'O item foi adicionado à ordem de serviço.',
        });
      }

      setShowAddItem(false);
      setSelectedProdutoForItem(null);
      setItemForm({
        tipo: 'servico',
        produto_id: undefined,
        descricao: '',
        quantidade: 1,
        valor_unitario: 0,
        valor_minimo: 0,
        desconto: 0,
        garantia: 90,
        colaborador_id: user?.id || '',
        fornecedor_id: '',
        fornecedor_nome: '',
        com_aro: '',
        grade_cor: '',
      });
      setProdutoSearch('');
    } catch (error: any) {
      toast({
        title: editingItem ? 'Erro ao atualizar item' : 'Erro ao adicionar item',
        description: (error && ((error as any).error ?? (error as any).message)) || (editingItem ? 'Ocorreu um erro ao atualizar o item.' : 'Ocorreu um erro ao adicionar o item. Verifique o console para mais detalhes.'),
        variant: 'destructive',
      });
    }
  };

  // Editar item
  const handleCreateFornecedor = async () => {
    if (!novoFornecedorNome.trim()) return;
    try {
      const novo = await createFornecedor(novoFornecedorNome.trim());
      setItemForm(prev => ({ ...prev, fornecedor_id: novo.id, fornecedor_nome: novo.nome }));
      setShowNovoFornecedorDialog(false);
      setNovoFornecedorNome('');
    } catch (_) {}
  };

  const handleEditFornecedor = async () => {
    if (!editFornecedorId || !editFornecedorNome.trim()) return;
    try {
      const atualizado = await updateFornecedor(editFornecedorId, editFornecedorNome.trim());
      if (itemForm.fornecedor_id === editFornecedorId) {
        setItemForm(prev => ({ ...prev, fornecedor_nome: atualizado.nome }));
      }
      setShowEditFornecedorDialog(false);
      setEditFornecedorId(null);
      setEditFornecedorNome('');
    } catch (_e) {
      // toast já é exibido pelo hook
    }
  };

  const handleConfirmDeleteFornecedor = async () => {
    if (!fornecedorToDelete) return;
    setIsDeletingFornecedor(true);
    try {
      await deleteFornecedor(fornecedorToDelete.id);
      if (itemForm.fornecedor_id === fornecedorToDelete.id) {
        setItemForm(prev => ({ ...prev, fornecedor_id: '', fornecedor_nome: '' }));
      }
      setFornecedorToDelete(null);
    } catch (_e) {
      // toast no hook
    } finally {
      setIsDeletingFornecedor(false);
    }
  };

  const handleEditItem = (item: ItemOS) => {
    setEditingItem(item);
    setItemForm({
      tipo: item.tipo,
      produto_id: item.produto_id,
      descricao: item.descricao,
      quantidade: item.quantidade,
      valor_unitario: item.valor_unitario,
      valor_minimo: item.valor_minimo || 0,
      desconto: item.desconto,
      garantia: item.garantia || 0,
      colaborador_id: item.colaborador_id || '',
      fornecedor_id: item.fornecedor_id || '',
      fornecedor_nome: item.fornecedor_nome || '',
      com_aro: (item as any).com_aro || '',
      grade_cor: (item as any).grade_cor || '',
    });
    setShowAddItem(true);
  };

  // Dialog Registrar Pagamento (OS Financeiro)
  const [showPagamentoOSDialog, setShowPagamentoOSDialog] = useState(false);
  const [pagamentoOSForm, setPagamentoOSForm] = useState({
    valor: '' as string | number,
    forma_pagamento: 'dinheiro' as FormaPagamento,
    tipo: 'adiantamento' as 'adiantamento' | 'pagamento_final',
    observacao: '',
  });
  const [isSavingPagamentoOS, setIsSavingPagamentoOS] = useState(false);
  const [imprimirCupomAposPagamento, setImprimirCupomAposPagamento] = useState(true);
  const [pagamentoToCancel, setPagamentoToCancel] = useState<PagamentoOSAPI | null>(null);
  const [isCancellingPagamento, setIsCancellingPagamento] = useState(false);

  // Remover item — reversão de estoque é feita no hook useItensOSSupabase (evitar dupla reversão)
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const handleRemoveItem = async (itemId: string) => {
    const item = itens.find(i => i.id === itemId);
    if (!item) return;
    setRemovingItemId(itemId);
    try {
      await removeItem(itemId);
      toast({
        title: 'Item removido',
        description: 'O item foi removido da ordem de serviço e o estoque foi revertido (quando for peça).',
      });
    } catch (error: any) {
      console.error('[OrdemServicoForm] Erro ao remover item:', error);
      toast({
        title: 'Erro ao remover item',
        description: error?.message || 'Não foi possível remover o item. Tente novamente ou verifique permissões.',
        variant: 'destructive',
      });
    } finally {
      setRemovingItemId(null);
    }
  };

  // Registrar pagamento na OS como venda (documento rastreável, soma no caixa)
  const handleRegistrarPagamentoOS = async () => {
    const valorNum = typeof pagamentoOSForm.valor === 'number' ? pagamentoOSForm.valor : parseFloat(String(pagamentoOSForm.valor || '0').replace(',', '.'));
    if (!valorNum || valorNum <= 0) {
      toast({ title: 'Valor inválido', description: 'Informe um valor maior que zero.', variant: 'destructive' });
      return;
    }
    if (!currentOS?.id || !osIdParaItens) {
      toast({ title: 'Erro', description: 'OS não identificada.', variant: 'destructive' });
      return;
    }
    setIsSavingPagamentoOS(true);
    try {
      const clienteNome = selectedCliente?.nome || currentOS?.cliente_nome || 'Cliente';
      const tipoPag = pagamentoOSForm.tipo;
      const { sale } = await registerPagamentoOS({
        ordem_servico_id: currentOS.id,
        numero_os: currentOS.numero ?? 0,
        tecnico_id: currentOS?.tecnico_id ?? '',
        cliente_nome: clienteNome,
        cliente_id: selectedCliente?.id || currentOS?.cliente_id || null,
        valor: valorNum,
        forma_pagamento: pagamentoOSForm.forma_pagamento,
        tipo: pagamentoOSForm.tipo,
        observacao: pagamentoOSForm.observacao || undefined,
      });
      await refetchPagamentosAPI();
      setShowPagamentoOSDialog(false);
      setPagamentoOSForm({ valor: '', forma_pagamento: 'dinheiro', tipo: 'adiantamento', observacao: '' });
      toast({
        title: 'Pagamento registrado',
        description: sale
          ? `${currencyFormatters.brl(valorNum)} · Venda #${sale.numero} (${tipoPag === 'adiantamento' ? 'adiantamento' : 'pagamento final'}). Valor entra no fechamento do caixa aberto.`
          : `${currencyFormatters.brl(valorNum)} registrado.`,
      });

      if (imprimirCupomAposPagamento) {
        const dataRetirada = new Date();
        const vencGarantia = new Date(dataRetirada);
        vencGarantia.setDate(vencGarantia.getDate() + 90);
        const cupomData = {
          numero: sale?.numero ?? currentOS.numero ?? 0,
          data: dataRetirada.toLocaleDateString('pt-BR'),
          hora: dataRetirada.toLocaleTimeString('pt-BR'),
          empresa: { nome: 'PRIME CAMP', cnpj: '31.833.574/0001-74' },
          cliente: { nome: clienteNome },
          vendedor: currentUserNome,
          vendedor_label: 'Registrado por',
          itens: [{ nome: `PAGAMENTO OS #${currentOS.numero} - ${pagamentoOSForm.tipo === 'adiantamento' ? 'ADIANTAMENTO' : 'PAGAMENTO'}`, quantidade: 1, valor_unitario: valorNum, desconto: 0, valor_total: valorNum }],
          subtotal: valorNum,
          desconto_total: 0,
          total: valorNum,
          pagamentos: [{ forma: pagamentoOSForm.forma_pagamento, valor: valorNum }],
          mostrar_termos_garantia_os: true,
          data_vencimento_garantia: vencGarantia.toLocaleDateString('pt-BR'),
        };
        const html = await generateCupomTermica(cupomData);
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
        document.body.appendChild(iframe);
        const doc = iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(html);
          doc.close();
          setTimeout(() => { iframe.contentWindow?.print(); setTimeout(() => iframe.parentNode?.removeChild(iframe), 2000); }, 800);
        }
      }
    } catch (e: any) {
      const err = e?.error ?? e;
      const msg =
        (typeof err === 'string' ? err : null) ||
        err?.message ||
        e?.message ||
        err?.error_description ||
        e?.error_description ||
        err?.details ||
        (err?.code && err?.details ? `[${err.code}] ${err.details}` : null) ||
        (err?.code ? String(err.code) : null) ||
        (err && typeof err === 'object' && typeof err.message !== 'string' ? JSON.stringify(err) : null) ||
        String(e);
      let msgStr = typeof msg === 'string' ? msg : (msg != null ? String(msg) : 'Tente novamente.');
      if (msgStr === '[object Object]' && e && typeof e === 'object') {
        const o = e?.error ?? e;
        msgStr = (typeof o?.message === 'string' && o.message) || (typeof o?.details === 'string' && o.details) || (o?.code ? `Erro ${o.code}` : '') || 'Erro ao registrar. Verifique o console (F12) ou tente novamente.';
      }
      const isTableMissing = /relation.*os_pagamentos|os_pagamentos.*does not exist|tabela.*não existe/i.test(msgStr);
      const description = isTableMissing
        ? 'A tabela os_pagamentos não existe no banco. Execute no PostgreSQL o script CRIAR_TABELA_OS_PAGAMENTOS.sql do projeto.'
        : msgStr;
      toast({ title: 'Erro ao registrar pagamento', description, variant: 'destructive' });
    } finally {
      setIsSavingPagamentoOS(false);
    }
  };

  const handleCancelPagamentoOS = async () => {
    if (!pagamentoToCancel || !isAdmin) return;
    setIsCancellingPagamento(true);
    try {
      await cancelPagamentoOS(pagamentoToCancel.id, pagamentoToCancel.sale_id);
      await refetchPagamentosAPI();
      setPagamentoToCancel(null);
      toast({ title: 'Pagamento cancelado', description: 'O valor foi retirado do caixa e do financeiro da OS.' });
    } catch (e: any) {
      toast({ title: 'Erro ao cancelar', description: e?.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setIsCancellingPagamento(false);
    }
  };

  // Mapeia valor com_aro para a chave da grade no produto (estoque_grade.itens)
  const comAroToGradeKey = (v: string): string | null => {
    if (v === 'com_aro' || v === 'Com Aro') return 'Com Aro';
    if (v === 'sem_aro' || v === 'Sem Aro') return 'Sem Aro';
    return null;
  };
  const gradeKeyToComAro = (key: string): '' | 'com_aro' | 'sem_aro' =>
    key === 'Com Aro' ? 'com_aro' : key === 'Sem Aro' ? 'sem_aro' : '';

  // Selecionar produto
  const handleSelectProduto = (produto: Produto) => {
    const garantiaProduto = produto.garantia_dias || 90;
    const grade = (produto as any).estoque_grade;
    const gradePorCor = grade?.tipo === 'cor' && grade?.itens && Object.keys(grade.itens).length > 0;
    const gradePorAro = grade?.tipo === 'aro' && grade?.itens && Object.keys(grade.itens).length > 0;
    const temGrade = gradePorCor || gradePorAro;
    const primeiraCor = gradePorCor ? Object.keys(grade.itens)[0] : '';
    const primeiraAro = gradePorAro ? Object.keys(grade.itens)[0] : '';
    const comAroInicial = gradePorAro && primeiraAro ? gradeKeyToComAro(primeiraAro) : '';

    // Produto com grade sempre como peça para exibir seletor de grade e dar baixa correta
    const tipoItem = temGrade ? 'peca' : (produto.tipo === 'peca' ? 'peca' : (produto.tipo === 'produto' ? 'peca' : 'servico'));

    setItemForm(prev => ({
      ...prev,
      produto_id: produto.id,
      descricao: produto.nome || produto.descricao || '',
      valor_unitario: produto.valor_dinheiro_pix || produto.valor_venda || produto.preco_venda || 0,
      garantia: garantiaProduto,
      tipo: tipoItem,
      quantidade: 1,
      grade_cor: primeiraCor,
      com_aro: comAroInicial || prev.com_aro,
    }));
    setSelectedProdutoForItem(produto);
    setProdutoSearch('');
    setProdutoResults([]);
  };

  // Estado para campos faltando (para destacar visualmente)
  const [camposFaltandoState, setCamposFaltandoState] = useState<Set<string>>(new Set());

  // Salvar OS
  const handleSubmit = async () => {
    // Prevenir múltiplos cliques
    if (isLoading) {
      toast({ title: 'Aguarde...', description: 'Salvando OS...', variant: 'default' });
      return;
    }

    // Validações de campos obrigatórios com feedback visual consolidado
    const camposFaltando: string[] = [];
    const camposFaltandoSet = new Set<string>();

    if (!selectedCliente?.id && !formData.cliente_id) {
      camposFaltando.push('Cliente');
      camposFaltandoSet.add('cliente');
    }

    if (!formData.telefone_contato || formData.telefone_contato.trim() === '') {
      camposFaltando.push('Telefone para contato');
      camposFaltandoSet.add('telefone');
    }

    if (!formData.marca_id) {
      camposFaltando.push('Marca');
      camposFaltandoSet.add('marca');
    }

    if (!formData.modelo_id) {
      camposFaltando.push('Modelo');
      camposFaltandoSet.add('modelo');
    }

    if (!formData.descricao_problema || formData.descricao_problema.trim() === '') {
      camposFaltando.push('Descrição do problema');
      camposFaltandoSet.add('descricao_problema');
    }

    if (!formData.cor || formData.cor.trim() === '') {
      camposFaltando.push('Cor do equipamento');
      camposFaltandoSet.add('cor');
    }

    if (!formData.condicoes_equipamento || formData.condicoes_equipamento.trim() === '') {
      camposFaltando.push('Condições do equipamento');
      camposFaltandoSet.add('condicoes_equipamento');
    }

    if (!formData.previsao_entrega || formData.previsao_entrega.trim() === '') {
      camposFaltando.push('Previsão de entrega');
      camposFaltandoSet.add('previsao_entrega');
    }

    const possuiSenhaValidos = ['sim', 'deslizar', 'nao', 'nao_sabe', 'nao_autorizou'];
    if (!formData.possui_senha_tipo || !possuiSenhaValidos.includes(formData.possui_senha_tipo)) {
      camposFaltando.push('Possui senha');
      camposFaltandoSet.add('possui_senha');
    }

    // Se "Possui senha" = SIM, a senha do aparelho é obrigatória
    if (formData.possui_senha_tipo === 'sim' && (!formData.senha_aparelho || String(formData.senha_aparelho).trim() === '')) {
      camposFaltando.push(isOficinaMecanica ? 'Chave ou código do veículo' : 'Senha do aparelho');
      camposFaltandoSet.add('senha_aparelho');
    }

    // Se houver campos faltando, exibir toast com lista e log no console
    if (camposFaltando.length > 0) {
      console.warn('[VALIDAÇÃO OS] Campos obrigatórios faltando:', camposFaltando);
      setCamposFaltandoState(camposFaltandoSet);
      toast({ 
        title: 'Campos obrigatórios não preenchidos', 
        description: `Preencha os seguintes campos: ${camposFaltando.join(', ')}`,
        variant: 'destructive'
      });
      return;
    }

    // Limpar estado de campos faltando se validação passou
    setCamposFaltandoState(new Set());

    setIsLoading(true);
    try {
      const tecnico = formData.tecnico_id ? getColaboradorById(formData.tecnico_id) : null;
      
      // ID da OS já existente: em memória (currentOS) OU só na URL (evita create duplicado se o cache ainda não carregou)
      const existingOsId = currentOS?.id ?? (isEditing && id ? id : undefined);

      // Atualizar se já existe OS (edição por URL, cache atrasado ou OS recém-criada antes do checklist)
      if (existingOsId) {
        // Marcar orçamento como autorizado se houver valores
        const temOrcamento = (formData.orcamento_desconto && formData.orcamento_desconto > 0) || 
                            (formData.orcamento_parcelado && formData.orcamento_parcelado > 0);
        
        const osAtualizada = await updateOS(existingOsId, {
          ...formData,
          orcamento_parcelado: formData.orcamento_parcelado ?? 0,
          orcamento_desconto: formData.orcamento_desconto ?? 0,
          cliente_nome: selectedCliente?.nome,
          cliente_empresa: selectedCliente?.nome_fantasia,
          marca_nome: marcas.find(m => m.id === formData.marca_id)?.nome,
          modelo_nome: modelos.find(m => m.id === formData.modelo_id)?.nome,
          tecnico_nome: tecnico?.nome,
          orcamento_autorizado: temOrcamento || formData.orcamento_autorizado || false,
          apenas_orcamento: formData.apenas_orcamento || false,
        });
        
        if (osAtualizada) {
          setCurrentOS(osAtualizada);
          setFormData(prev => ({
            ...prev,
            possui_senha_tipo: osAtualizada.possui_senha_tipo || (osAtualizada.possui_senha ? (osAtualizada.padrao_desbloqueio ? 'deslizar' : 'sim') : 'nao'),
            senha_aparelho: osAtualizada.senha_aparelho || prev.senha_aparelho,
            padrao_desbloqueio: osAtualizada.padrao_desbloqueio || prev.padrao_desbloqueio,
          }));
          
          toast({ title: 'OS salva com sucesso!' });
        }
        // Mostrar toast centralizado
        setShowSuccessToast(true);
        setTimeout(() => {
          setShowSuccessToast(false);
        }, 2000);
      } else {
        // Marcar orçamento como autorizado se houver valores
        const temOrcamento = (formData.orcamento_desconto && formData.orcamento_desconto > 0) || 
                            (formData.orcamento_parcelado && formData.orcamento_parcelado > 0);
        
        const novaOS = await createOS({
          ...formData,
          orcamento_parcelado: formData.orcamento_parcelado ?? 0,
          orcamento_desconto: formData.orcamento_desconto ?? 0,
          cliente_nome: selectedCliente?.nome,
          cliente_empresa: selectedCliente?.nome_fantasia,
          marca_nome: marcas.find(m => m.id === formData.marca_id)?.nome,
          modelo_nome: modelos.find(m => m.id === formData.modelo_id)?.nome,
          tecnico_nome: tecnico?.nome,
          orcamento_autorizado: temOrcamento || formData.orcamento_autorizado || false,
          apenas_orcamento: formData.apenas_orcamento || false,
          vendedor_id: user?.id || undefined,
          vendedor_nome: currentUserNome,
        } as any);
        
        // Validar se o ID foi retornado
        if (!novaOS?.id) {
          console.error('OS criada mas ID não retornado:', novaOS);
          toast({ 
            title: 'Erro ao criar OS', 
            description: 'A OS foi criada mas o ID não foi retornado. Recarregue a página.',
            variant: 'destructive' 
          });
          return;
        }
        
        toast({ title: `OS #${novaOS.numero} criada!` });
        
        // Enviar mensagem do status "OS Aberta" se configurado (nova OS já nasce com status aberta)
        try {
          const statusInicial = novaOS.status || 'aberta';
          const configAberta = getConfigByStatus(statusInicial);
          if (configAberta?.notificar_whatsapp && configAberta.mensagem_whatsapp) {
            const telefone = formData.telefone_contato || selectedCliente?.whatsapp || selectedCliente?.telefone;
            if (telefone) {
              const marca = marcas.find(m => m.id === formData.marca_id);
              const modelo = modelos.find(m => m.id === formData.modelo_id);
              
              const linkOs = `${window.location.origin}/acompanhar-os/${novaOS.id}`;
              let mensagem = configAberta.mensagem_whatsapp
                .replace(/{cliente}/g, selectedCliente?.nome || novaOS.cliente_nome || 'Cliente')
                .replace(/{numero}/g, novaOS.numero?.toString() || '')
                .replace(/{link_os}/g, linkOs)
                .replace(/{status}/g, configAberta.label)
                .replace(/{marca}/g, marca?.nome || novaOS.marca_nome || '')
                .replace(/{modelo}/g, modelo?.nome || novaOS.modelo_nome || '');
              
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
                await sendMessage({ number: numero, body: mensagem });
              }
            }
          }
        } catch (error: any) {
          console.error('Erro ao enviar notificação de abertura (OS Aberta):', error);
          // Não bloquear a criação se o envio falhar
        }

        // Painel de Alertas: disparar "Nova OS aberta" para números configurados (principal + adicionais)
        try {
          const linkOs = `${window.location.origin}/acompanhar-os/${novaOS.id}`;
          await fireAlert({
            codigo_alerta: 'os.criada',
            payload: {
              numero_os: novaOS.numero,
              cliente: selectedCliente?.nome || novaOS.cliente_nome || 'Cliente',
              marca: marcas.find(m => m.id === formData.marca_id)?.nome || novaOS.marca_nome || '',
              modelo: modelos.find(m => m.id === formData.modelo_id)?.nome || novaOS.modelo_nome || '',
              defeito: formData.descricao_problema || novaOS.descricao_problema || '',
              usuario: currentUserNome,
              link_os: linkOs,
              empresa: profile?.company_name ?? '',
            },
          });
        } catch (err: any) {
          console.error('Painel de Alertas: falha ao disparar os.criada:', err?.message || err);
        }

        if (isModal && onClose) {
          onClose();
        } else if (isOficinaMecanica) {
          // Oficina Mecânica: não exige checklist de entrada; apenas invalida e navega
          queryClient.invalidateQueries({ queryKey: ['ordens_servico'] });
          navigate(`/os/${novaOS.id}`, { replace: true });
        } else {
          // Assistência Técnica: abrir modal de checklist de entrada após criar OS
          // Marcar currentOS para que, se o usuário fechar o checklist e salvar de novo, atualize a mesma OS em vez de criar outra
          setCurrentOS(novaOS);
          queryClient.invalidateQueries({ queryKey: ['ordens_servico'] });
          setChecklistEntradaModalOSId(novaOS.id);
          setChecklistEntradaModalMarcados([]);
          setChecklistEntradaModalObservacoes('');
          setShowChecklistEntradaModal(true);
        }
      }
    } catch (error: any) {
      console.error('Erro ao salvar OS:', error);
      toast({
        title: 'Erro ao salvar OS',
        description: getDemoAwareErrorMessage(error, 'Ocorreu um erro inesperado'),
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Alterar status
  const handleChangeStatus = async (status: StatusOS | string) => {
    if (!currentOS) return;
    
    // Se mudar para "manutenção finalizada" ou "finalizada", abrir modal de checklist de saída (exceto Oficina Mecânica)
    if (!isOficinaMecanica && (status === 'finalizada' || status === 'manutencao_finalizada' || status.toLowerCase().includes('finalizada'))) {
      setPendingStatusChange(status);
      setShowChecklistSaidaModal(true);
      return;
    }
    
    const config = getConfigByStatus(status);
    
    // Se configurado para notificar via WhatsApp, enviar mensagem
    if (config?.notificar_whatsapp && config.mensagem_whatsapp) {
      const cliente = getClienteById(currentOS.cliente_id);
      const telefone = currentOS.telefone_contato || cliente?.whatsapp || cliente?.telefone;
      
      if (telefone) {
        try {
          // Substituir variáveis na mensagem
          const marca = marcas.find(m => m.id === currentOS.marca_id);
          const modelo = modelos.find(m => m.id === currentOS.modelo_id);
          
          const linkOs = `${window.location.origin}/acompanhar-os/${currentOS.id}`;
          let mensagem = config.mensagem_whatsapp
            .replace(/{cliente}/g, cliente?.nome || currentOS.cliente_nome || 'Cliente')
            .replace(/{numero}/g, currentOS.numero?.toString() || '')
            .replace(/{link_os}/g, linkOs)
            .replace(/{status}/g, config.label)
            .replace(/{marca}/g, marca?.nome || currentOS.marca_nome || '')
            .replace(/{modelo}/g, modelo?.nome || currentOS.modelo_nome || '');
          
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
          
          // Enviar via API do Ativa CRM
          if (numero.length >= 12 && numero.length <= 13) {
            await sendMessage({
              number: numero,
              body: mensagem
            });
          }
        } catch (error: any) {
          console.error('Erro ao enviar notificação de status:', error);
          // Não bloquear a mudança de status se o envio falhar
        }
      }
    }
    
    await updateStatus(currentOS.id, status as StatusOS, config?.notificar_whatsapp);
    setCurrentOS((prev: any) => prev ? { ...prev, status } : null);
    
    toast({ 
      title: 'Status atualizado', 
      description: config?.notificar_whatsapp ? 'Status atualizado e cliente notificado via WhatsApp.' : 'Status atualizado com sucesso.'
    });
  };

  // Finalizar checklist de entrada (modal)
  const handleFinalizarChecklistEntrada = async () => {
    if (!checklistEntradaModalOSId) {
      toast({ 
        title: 'Erro', 
        description: 'OS não encontrada.',
        variant: 'destructive' 
      });
      return;
    }

    try {
      // Buscar OS atualizada
      const osAtualizada = getOSById(checklistEntradaModalOSId);
      if (!osAtualizada) {
        toast({ 
          title: 'Erro', 
          description: 'OS não encontrada.',
          variant: 'destructive' 
        });
        return;
      }

      const userId = user?.id || null;
      const userNome = profile?.display_name || user?.email || null;
      const agora = new Date().toISOString();

      // 1) Primeiro salvar o checklist na OS (updateOS retorna a OS já com os dados salvos)
      const osParaImprimir = await updateOS(checklistEntradaModalOSId, {
        checklist_entrada: checklistEntradaModalMarcados,
        observacoes_checklist: checklistEntradaModalObservacoes || null,
        checklist_entrada_realizado_por_id: userId,
        checklist_entrada_realizado_por_nome: userNome,
        checklist_entrada_realizado_em: agora,
      });

      // Manter status "aberta" ao salvar checklist (não mudar para em_andamento automaticamente)
      // 2) Só depois de salvo, imprimir — usar OS com checklist que acabamos de salvar para a primeira impressão já sair com o checklist (evita falha de cache/retorno da API)
      if (osParaImprimir) {
        try {
          const clienteData = getClienteById(osParaImprimir.cliente_id);
          const marcaData = marcas.find(m => m.id === osParaImprimir.marca_id);
          const modeloData = modelos.find(m => m.id === osParaImprimir.modelo_id);

          const osComChecklistGarantido = {
            ...osParaImprimir,
            checklist_entrada: checklistEntradaModalMarcados,
            observacoes_checklist: checklistEntradaModalObservacoes || osParaImprimir.observacoes_checklist,
          };

          // Imprimir em 2 vias automaticamente (usando checklist recém-salvo para sair na primeira impressão)
          await printOSTermicaDirect(
            osComChecklistGarantido,
            clienteData,
            marcaData,
            modeloData,
            checklistEntradaConfig,
            osImageReferenceUrl
          );

          toast({ title: 'Checklist salvo e OS impressa automaticamente!' });
        } catch (printError) {
          console.error('Erro ao imprimir OS após checklist de entrada:', printError);
          toast({ 
            title: 'Checklist salvo, mas erro ao imprimir', 
            description: 'Tente imprimir manualmente.',
            variant: 'destructive' 
          });
        }
      }

      // Fechar modal e limpar estados
      setShowChecklistEntradaModal(false);
      const osIdParaNavegar = checklistEntradaModalOSId;
      setChecklistEntradaModalOSId(null);
      setChecklistEntradaModalMarcados([]);
      setChecklistEntradaModalObservacoes('');

      // Navegar para a OS editada
      queryClient.invalidateQueries({ queryKey: ['ordens_servico'] });
      navigate(`/os/${osIdParaNavegar}`, { replace: true });
    } catch (error: any) {
      console.error('Erro ao finalizar checklist de entrada:', error);
      toast({ 
        title: 'Erro ao salvar checklist', 
        description: error.message || 'Ocorreu um erro inesperado',
        variant: 'destructive' 
      });
    }
  };

  // Finalizar checklist de saída
  const handleFinalizarChecklistSaida = async () => {
    if (!currentOS || !pendingStatusChange) {
      toast({ 
        title: 'Erro', 
        description: 'OS não encontrada ou status não definido.',
        variant: 'destructive' 
      });
      return;
    }

    // Validar se foi marcado como aprovado ou reprovado
    if (checklistSaidaAprovado === null) {
      toast({ 
        title: 'Selecione o resultado', 
        description: 'Marque se o aparelho foi aprovado ou reprovado no checklist de saída.',
        variant: 'destructive' 
      });
      return;
    }

    // Evitar duplo envio (botão desabilitado + guard)
    if (isSubmittingChecklistSaida) return;
    setIsSubmittingChecklistSaida(true);

    try {
      // Atualizar OS com checklist de saída
      const checklistSaidaIds = checklistSaidaMarcados;
      const userId = user?.id || null;
      const userNome = profile?.display_name || user?.email || null;
      const agora = new Date().toISOString();

      const updatedOS = await updateOS(currentOS.id, {
        checklist_saida: checklistSaidaIds,
        observacoes_checklist_saida: checklistSaidaObservacoes || null,
        checklist_saida_aprovado: checklistSaidaAprovado,
        checklist_saida_realizado_por_id: userId,
        checklist_saida_realizado_por_nome: userNome,
        checklist_saida_realizado_em: agora,
      });

      // Atualizar status
      const config = getConfigByStatus(pendingStatusChange);
      await updateStatus(currentOS.id, pendingStatusChange as StatusOS, config?.notificar_whatsapp);

      // Notificar cliente via WhatsApp somente se estiver definido em /pdv/configuracao-status (Notificar WhatsApp = Sim e mensagem preenchida)
      const cliente = getClienteById(currentOS.cliente_id);
      const telefone = currentOS.telefone_contato || cliente?.whatsapp || cliente?.telefone;

      if (telefone && checklistSaidaAprovado && config?.notificar_whatsapp && config.mensagem_whatsapp) {
        try {
          const marca = marcas.find(m => m.id === currentOS.marca_id);
          const modelo = modelos.find(m => m.id === currentOS.modelo_id);
          const linkOs = `${window.location.origin}/acompanhar-os/${currentOS.id}`;
          const mensagem = config.mensagem_whatsapp
            .replace(/{cliente}/g, cliente?.nome || currentOS.cliente_nome || 'Cliente')
            .replace(/{numero}/g, currentOS.numero?.toString() || '')
            .replace(/{link_os}/g, linkOs)
            .replace(/{status}/g, config.label)
            .replace(/{marca}/g, marca?.nome || currentOS.marca_nome || '')
            .replace(/{modelo}/g, modelo?.nome || currentOS.modelo_nome || '');

          let numero = telefone.replace(/\D/g, '');
          numero = numero.replace(/^0+/, '');
          if (!numero.startsWith('55')) {
            if (numero.startsWith('0')) numero = numero.substring(1);
            if (numero.length === 10 || numero.length === 11) numero = '55' + numero;
          }
          if (numero.length >= 12 && numero.length <= 13) {
            await sendMessage({ number: numero, body: mensagem });
          }
        } catch (error: any) {
          console.error('Erro ao enviar notificação de aprovação:', error);
        }
      }
      // Reprovação: não enviamos mensagem automática; só mensagens definidas em configuracao-status são enviadas

      // Atualizar estado local
      setCurrentOS((prev: any) => prev ? { 
        ...prev, 
        status: pendingStatusChange,
        checklist_saida: checklistSaidaIds,
        checklist_saida_aprovado: checklistSaidaAprovado,
        checklist_saida_realizado_por_id: userId,
        checklist_saida_realizado_por_nome: userNome,
        checklist_saida_realizado_em: agora,
      } : null);

      // Fechar modal e limpar estados
      setShowChecklistSaidaModal(false);
      setChecklistSaidaMarcados([]);
      setChecklistSaidaAprovado(null);
      setChecklistSaidaObservacoes('');
      setPendingStatusChange(null);

      toast({ 
        title: 'Checklist de saída finalizado', 
        description: checklistSaidaAprovado 
          ? 'Aparelho aprovado e cliente notificado.' 
          : 'Checklist de saída registrado com ressalvas.'
      });
    } catch (error: any) {
      let errorMessage = 'Ocorreu um erro ao finalizar o checklist de saída.';
      if (error.message) {
        errorMessage = error.message;
      } else if (error.details) {
        errorMessage = error.details;
      } else if (error.hint) {
        errorMessage = error.hint;
      }
      
      toast({ 
        title: 'Erro ao finalizar checklist', 
        description: errorMessage,
        variant: 'destructive',
        duration: 8000
      });
    } finally {
      setIsSubmittingChecklistSaida(false);
    }
  };

  // WhatsApp - Enviar via API do Ativa CRM
  const handleWhatsApp = async () => {
    if (!currentOS && !isEditing) {
      toast({ title: 'Salve a OS antes de enviar', variant: 'destructive' });
      return;
    }
    
    const os = currentOS || (isEditing ? getOSById(id || '') : null);
    if (!os) {
      console.error('[handleWhatsApp] OS não encontrada');
      toast({ title: 'OS não encontrada', variant: 'destructive' });
      return;
    }

    const cliente = getClienteById(os.cliente_id);
    const telefone = os.telefone_contato || cliente?.whatsapp || cliente?.telefone;
    
    if (!telefone) {
      console.error('[handleWhatsApp] Telefone não encontrado');
      toast({ title: 'Telefone não encontrado', variant: 'destructive' });
      return;
    }

    try {
      const marca = marcas.find(m => m.id === os.marca_id);
      const modelo = modelos.find(m => m.id === os.modelo_id);
      
      const isVeiculoMsg = os.tipo_aparelho === 'veiculo';
      const eqLabelMsg = isVeiculoMsg ? 'Veículo' : 'Aparelho';
      const condicoesMsg = isVeiculoMsg ? 'Os veículos não retirados' : 'Os aparelhos não retirados';
      const mensagem = `*ORDEM DE SERVIÇO #${os.numero}*

*Cliente:* ${cliente?.nome || os.cliente_nome}
*Telefone:* ${telefone}
*${eqLabelMsg}:* ${marca?.nome || ''} ${modelo?.nome || ''}
*Problema:* ${os.descricao_problema}
*Status:* ${STATUS_OS_LABELS[os.status as StatusOS]}
*Data Entrada:* ${dateFormatters.short(os.data_entrada)}
${os.previsao_entrega ? `*Previsão Entrega:* ${dateFormatters.short(os.previsao_entrega)}` : ''}

*Sobre a Garantia do Serviço:*
1 - A Empresa oferece Garantia de 90 dias em peças usadas no conserto, contados a partir da data de entrega.
2 - Não realizamos troca de peças danificadas por Mal Uso, Molhadas, Trincadas, Quebradas e riscadas.
3 - O ${eqLabelMsg} só será devolvido mediante a apresentação desta ou documento do proprietário, guarde-a com cuidado.
4 - Ao ligar para a loja, informe o número da Ordem de Serviço para melhor atendê-lo.
5 - ${condicoesMsg} em no máximo 30 dias serão acrescido despesas de armazenamento de 6% ao mês.
6 - ${condicoesMsg} em até 90 dias a partir da data da comunicação para sua retirada, serão descartados.`;

      // Formatar número para API do Ativa CRM
      // A API espera: número com código do país SEM o +, apenas dígitos
      let numero = telefone.replace(/\D/g, '');
      
      // Remover zeros à esquerda
      numero = numero.replace(/^0+/, '');
      
      // Se não começar com código do país, adicionar 55 (Brasil)
      if (!numero.startsWith('55')) {
        // Se começar com 0, remover
        if (numero.startsWith('0')) {
          numero = numero.substring(1);
        }
        // Adicionar código do país se não tiver
        // Número brasileiro: 10 dígitos (fixo) ou 11 dígitos (celular)
        if (numero.length === 10 || numero.length === 11) {
          numero = '55' + numero;
        }
      }
      
      // Validar formato final: deve ter 12 ou 13 dígitos (55 + 10 ou 11 dígitos)
      if (numero.length < 12 || numero.length > 13) {
        console.error('[handleWhatsApp] Número inválido após formatação:', { numero, length: numero.length, original: telefone });
        toast({
          title: 'Número inválido',
          description: `O número "${telefone}" não está em um formato válido. Use: (DDD) 9XXXX-XXXX ou (DDD) XXXX-XXXX`,
          variant: 'destructive',
        });
        return;
      }

      // Enviar via API do Ativa CRM
      const result = await sendMessage({
        number: numero,
        body: mensagem
      });

      // O hook useWhatsApp já exibe toast de sucesso
      toast({ 
        title: 'Mensagem enviada com sucesso!', 
        description: `Mensagem da OS #${os.numero} enviada para ${telefone}`,
      });
    } catch (error: any) {
      console.error('[handleWhatsApp] Erro completo ao enviar WhatsApp:', {
        error,
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      toast({ 
        title: 'Erro ao enviar WhatsApp', 
        description: error.message || 'Não foi possível enviar a mensagem. Verifique se o Ativa CRM está configurado.',
        variant: 'destructive' 
      });
    }
  };

  // Impressão e PDF
  const handlePrint = async (tipo: 'a4' | 'termica' | 'pdf') => {
    if (!currentOS && !isEditing) {
      toast({ title: 'Salve a OS antes de imprimir', variant: 'destructive' });
      return;
    }

    const os = currentOS || (isEditing ? getOSById(id || '') : null);
    if (!os) {
      toast({ title: 'OS não encontrada', variant: 'destructive' });
      return;
    }

    // Gerar na hora do clique: usar SEMPRE o estado atual do formulário para padrão/senha (não cache da OS)
    const normalizarPadrao = (p: unknown): string => {
      if (typeof p === 'string' && p.trim()) return p;
      if (Array.isArray(p) && p.length >= 2) return p.map((n: number) => Number(n)).filter((n: number) => !isNaN(n) && n >= 0 && n <= 8).join('-');
      return '';
    };
    const padraoAtual = isEditing && formData ? formData.padrao_desbloqueio : os.padrao_desbloqueio;
    const padraoParaImpressao = normalizarPadrao(padraoAtual);
    const osToPrint = isEditing && formData
      ? { ...os, padrao_desbloqueio: padraoParaImpressao, possui_senha: formData.possui_senha ?? os.possui_senha, possui_senha_tipo: formData.possui_senha_tipo ?? os.possui_senha_tipo, senha_numerica: formData.senha_numerica ?? os.senha_numerica, senha_aparelho: formData.senha_aparelho ?? os.senha_aparelho }
      : { ...os, padrao_desbloqueio: padraoParaImpressao };

    // CPF/endereço: sempre preferir dados do banco (cache do form costuma vazio na 1ª impressão / checklist)
    const clienteParaImpressao = await resolveClienteForOsPrint(
      osToPrint.cliente_id,
      getClienteById(osToPrint.cliente_id)
    );

    if (tipo === 'pdf' || tipo === 'a4') {
      // Usar a mesma função para PDF e A4 (baseada na térmica)
      try {
        const cliente = clienteParaImpressao;
        const marca = marcas.find(m => m.id === osToPrint.marca_id);
        const modelo = modelos.find(m => m.id === osToPrint.modelo_id);
        
        // Buscar primeira foto de entrada
        const fotoEntrada = osToPrint.fotos_telegram_entrada?.[0];
        const fotoEntradaUrl = fotoEntrada 
          ? (typeof fotoEntrada === 'string' ? fotoEntrada : (fotoEntrada.url || fotoEntrada.thumbnailUrl))
          : undefined;

        // Buscar imagem de referência do aparelho
        const imagemReferenciaUrl = osImageReferenceUrl || null;
        const areasDefeito = osToPrint.areas_defeito || [];
        const clienteCpfPdf = cliente?.cpf_cnpj || null;
        const clienteEnderecoPdfParts = cliente ? [
          cliente.logradouro,
          cliente.numero,
          cliente.complemento,
          cliente.bairro,
          [cliente.cidade, cliente.estado || cliente.uf].filter(Boolean).join('/'),
          cliente.cep,
        ].filter(Boolean) : [];
        const clienteEnderecoPdfStr = clienteEnderecoPdfParts.length > 0 ? clienteEnderecoPdfParts.join(', ') : null;

        // Gerar uma única página com ambas as vias lado a lado
        const htmlCompleto = await generateOSPDF({
          os: osToPrint,
          clienteNome: cliente?.nome || osToPrint.cliente_nome || 'Cliente',
          clienteCpf: clienteCpfPdf,
          clienteEndereco: clienteEnderecoPdfStr,
          marcaNome: marca?.nome || osToPrint.marca_nome,
          modeloNome: modelo?.nome || osToPrint.modelo_nome,
          checklistEntrada: checklistEntradaConfig,
          checklistEntradaMarcados: parseJsonArray(osToPrint.checklist_entrada),
          fotoEntradaUrl,
          imagemReferenciaUrl,
          areasDefeito,
          via: 'cliente', // Não importa, pois ambas as vias são geradas juntas
          formato: tipo === 'pdf' ? 'pdf' : 'a4',
        });

        if (tipo === 'pdf') {
          // Para PDF, abrir em nova janela e permitir download
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(htmlCompleto);
            printWindow.document.close();
            printWindow.onload = () => {
              printWindow.focus();
              printWindow.print();
            };
          }
        } else {
          // Para A4, apenas imprimir
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(htmlCompleto);
            printWindow.document.close();
            printWindow.onload = () => {
              printWindow.focus();
              printWindow.print();
            };
          }
        }

        toast({ title: `${tipo === 'pdf' ? 'PDF' : 'A4'} gerado`, description: '2 vias geradas (Cliente e Empresa)' });
      } catch (error: any) {
        console.error(`Erro ao gerar ${tipo}:`, error);
        toast({ 
          title: `Erro ao gerar ${tipo}`, 
          description: error.message || 'Ocorreu um erro ao gerar o documento.',
          variant: 'destructive' 
        });
      }
    } else if (tipo === 'termica') {
      // Impressão térmica com 2 vias
      try {
        const cliente = clienteParaImpressao;
        const marca = marcas.find(m => m.id === osToPrint.marca_id);
        const modelo = modelos.find(m => m.id === osToPrint.modelo_id);
        const pagamentosOs = await fetchPagamentosOsForTermica(osToPrint.id);
        
        // Buscar primeira foto de entrada
        const fotoEntrada = osToPrint.fotos_telegram_entrada?.[0];
        const fotoEntradaUrl = fotoEntrada 
          ? (typeof fotoEntrada === 'string' ? fotoEntrada : (fotoEntrada.url || fotoEntrada.thumbnailUrl))
          : undefined;

        // Buscar imagem de referência do aparelho
        const imagemReferenciaUrl = osImageReferenceUrl || null;
        const areasDefeito = osToPrint.areas_defeito || [];

        const clienteCpf = cliente?.cpf_cnpj || null;
        const clienteEnderecoParts = cliente ? [
          cliente.logradouro,
          cliente.numero,
          cliente.complemento,
          cliente.bairro,
          [cliente.cidade, cliente.estado || cliente.uf].filter(Boolean).join('/'),
          cliente.cep,
        ].filter(Boolean) : [];
        const clienteEnderecoStr = clienteEnderecoParts.length > 0 ? clienteEnderecoParts.join(', ') : null;

        const nomeCli = cliente?.nome || osToPrint.cliente_nome || 'Cliente';

        // Gerar via do cliente (com checklist nas duas vias)
        const htmlCliente = await generateOSTermica({
          os: osToPrint,
          clienteNome: nomeCli,
          clienteCpf,
          clienteEndereco: clienteEnderecoStr,
          marcaNome: marca?.nome || osToPrint.marca_nome,
          modeloNome: modelo?.nome || osToPrint.modelo_nome,
          checklistEntrada: checklistEntradaConfig,
          checklistEntradaMarcados: parseJsonArray(osToPrint.checklist_entrada),
          fotoEntradaUrl,
          imagemReferenciaUrl,
          areasDefeito,
          via: 'cliente',
          omitirChecklist: false,
          pagamentosOs,
        });

        // Gerar via da loja (com checklist nas duas vias)
        const htmlLoja = await generateOSTermica({
          os: osToPrint,
          clienteNome: nomeCli,
          clienteCpf,
          clienteEndereco: clienteEnderecoStr,
          marcaNome: marca?.nome || osToPrint.marca_nome,
          modeloNome: modelo?.nome || osToPrint.modelo_nome,
          checklistEntrada: checklistEntradaConfig,
          checklistEntradaMarcados: parseJsonArray(osToPrint.checklist_entrada),
          fotoEntradaUrl,
          imagemReferenciaUrl,
          areasDefeito,
          via: 'loja',
          omitirChecklist: false,
          pagamentosOs,
        });

        // Imprimir ambas as vias
        printTermica(htmlCliente);
        setTimeout(() => {
          printTermica(htmlLoja);
        }, 1000);

        toast({ title: 'Impressão térmica gerada', description: '2 vias impressas (Cliente e Loja)' });
      } catch (error: any) {
        console.error('Erro ao gerar impressão térmica:', error);
        toast({ 
          title: 'Erro ao gerar impressão térmica', 
          description: error.message || 'Ocorreu um erro ao gerar a impressão.',
          variant: 'destructive' 
        });
      }
    }
  };

  // Funções antigas removidas - agora usando generateOSPDF baseado na térmica
  /*
  const handleGeneratePDF = async (os: any) => {
    try {
      const cliente = getClienteById(os.cliente_id);
      const marca = marcas.find(m => m.id === os.marca_id);
      const modelo = modelos.find(m => m.id === os.modelo_id);

      const formatCurrency = (value?: number) =>
        value !== undefined && value !== null ? currencyFormatters.brl(value) : '-';

      // Formatar checklist de entrada (separando físico e funcional)
      const checklistFisico = checklistEntradaConfig
        .filter(item => item.categoria === 'fisico' && parseJsonArray(os.checklist_entrada).includes(item.item_id))
        .map(item => item.nome)
        .join(', ') || 'Nenhum problema encontrado';

      const checklistFuncional = checklistEntradaConfig
        .filter(item => item.categoria === 'funcional' && parseJsonArray(os.checklist_entrada).includes(item.item_id))
        .map(item => item.nome)
        .join(', ') || 'Nenhum item funcional verificado';

      // Buscar primeira foto de entrada
      const fotoEntrada = os.fotos_telegram_entrada?.[0];
      const fotoEntradaUrl = fotoEntrada 
        ? (typeof fotoEntrada === 'string' ? fotoEntrada : (fotoEntrada.url || fotoEntrada.thumbnailUrl))
        : undefined;

      // Removido: areasDefeito (agora apenas checklist)
      const senhaInfo = os.possui_senha
        ? (os.possui_senha_tipo || 'Sim')
        : 'Não';
      const senhaDetalhe = os.padrao_desbloqueio || os.senha_aparelho || os.senha_numerica || '';

      const telefoneLoja = '(19) 98768-0453';
      const logoUrl = 'https://primecamp.com.br/wp-content/uploads/2025/07/Design-sem-nome-4.png';
      const dataEntrada = dateFormatters.short(os.data_entrada);
      const horaEntrada = os.hora_entrada || os.hora_previsao || '-';

      const senhaLabel = os.possui_senha
        ? (os.possui_senha_tipo || 'Sim - senha')
        : 'Não';
      // Removido: areasDefeitoTexto (agora apenas checklist)

      const formatAddress = () => {
        const parts = [
          cliente?.logradouro,
          cliente?.bairro,
          cliente?.cidade,
          cliente?.uf,
          cliente?.cep,
        ].filter(Boolean);
        return parts.join(' - ') || '-';
      };

      // Grid 0-8 igual PatternLock e térmica: 0=top-left … 8=bot-right; aceita 1-9 convertendo para 0-8
      const patternToSvg = (pattern: string | undefined) => {
        if (!pattern) return '';
        const points: Record<string, [number, number]> = {
          '0': [20, 20], '1': [50, 20], '2': [80, 20],
          '3': [20, 50], '4': [50, 50], '5': [80, 50],
          '6': [20, 80], '7': [50, 80], '8': [80, 80],
        };
        let seq = pattern.replace(/\s/g, '').split(/[-,.]/).filter(Boolean);
        if (seq.every((d) => d >= '1' && d <= '9')) seq = seq.map((d) => String(Number(d) - 1));
        if (seq.length < 2) return '';
        const lines: string[] = [];
        for (let i = 0; i < seq.length - 1; i++) {
          const a = points[seq[i]];
          const b = points[seq[i + 1]];
          if (a && b) {
            lines.push(`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#111" stroke-width="1.5" />`);
          }
        }
        const circles = ['0','1','2','3','4','5','6','7','8'].map((k) => {
          const [x, y] = points[k];
          const active = seq.includes(k);
          return `<circle cx="${x}" cy="${y}" r="4" fill="${active ? '#2563eb' : '#fff'}" stroke="#111" stroke-width="1.5" />`;
        }).join('');
        return `
          <svg width="60" height="60" viewBox="0 0 100 100" style="display:inline-block;vertical-align:middle;">
            <rect x="5" y="5" width="90" height="90" rx="6" ry="6" fill="#fff" stroke="#111" stroke-width="1.5" />
            ${lines.join('')}
            ${circles}
          </svg>
        `;
      };

      // Função removida: defectsToSvg (não mais necessário - defeitos apenas via checklist)

      const patternSvg = patternToSvg(os.padrao_desbloqueio);
      // Removido: SVG de defeitos (agora apenas checklist)
      const defectsSvg = '';

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>OS #${os.numero}</title>
            <style>
              * { box-sizing: border-box; margin: 0; padding: 0; }
              @page { size: A4; margin: 8mm; }
              body { font-family: Arial, sans-serif; padding: 0; color: #111; font-size: 10px; line-height: 1.2; }
              h1 { margin: 0; font-size: 16px; }
              h2 { margin: 2px 0 4px; font-size: 12px; color: #333; }
              h3 { margin: 4px 0 2px; font-size: 10px; font-weight: bold; }
              .muted { color: #555; font-size: 9px; }
              .section { margin-bottom: 3px; }
              .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 8px; font-size: 9px; }
              .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px 8px; font-size: 9px; }
              .label { font-weight: bold; font-size: 9px; }
              .value { margin-left: 4px; font-size: 9px; }
              .card { border: 1px solid #ddd; padding: 4px 6px; border-radius: 3px; background: #fafafa; font-size: 9px; }
              ol { padding-left: 14px; margin: 2px 0; font-size: 8px; }
              ol li { margin: 1px 0; }
              .footer { margin-top: 4px; font-weight: bold; text-align: center; font-size: 9px; }
              .title-row { display: flex; justify-content: space-between; align-items: center; }
              .chip { border: 1px solid #999; padding: 2px 4px; border-radius: 2px; font-size: 8px; }
              .table { width: 100%; border-collapse: collapse; margin-top: 2px; }
              .table td { padding: 2px; border: 1px solid #e5e7eb; font-size: 8px; }
              .header { display: grid; grid-template-columns: 80px 1fr 140px; align-items: start; gap: 6px; border-bottom: 1px solid #111; padding-bottom: 4px; margin-bottom: 4px; }
              .header-logo img { max-width: 70px; max-height: 40px; object-fit: contain; }
              .header-info { font-size: 8px; line-height: 1.2; }
              .header-info .title { font-weight: bold; font-size: 10px; }
              .header-right { text-align: right; font-size: 9px; }
              .divider { height: 1px; background: #111; margin: 3px 0 4px; }
              .signature { margin-top: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
              .signature-line { border-top: 1px solid #000; padding-top: 2px; text-align: center; font-size: 8px; }
              .copy { page-break-inside: avoid; border: 1px solid #111; padding: 4px 5px; margin-bottom: 3px; }
              .copy-title { text-align: center; font-weight: bold; margin: 1px 0 3px; font-size: 9px; }
              .flex-row { display: flex; align-items: center; gap: 4px; }
              .bold { font-weight: bold; }
              .os-highlight { font-weight: bold; font-size: 11px; }
              svg { max-width: 50px; max-height: 50px; }
              @media print {
                .copy { page-break-inside: avoid; }
              }
            </style>
          </head>
          <body>
            ${['Via do Cliente', 'Via da Empresa'].map((via) => `
              <div class="copy">
                <div class="header">
                  <div class="header-logo">
                    <img src="${logoUrl}" alt="Prime Camp" />
                  </div>
                  <div class="header-info">
                    <div class="title">PRIME CAMP ASSISTÊNCIA TÉCNICA</div>
                    <div>CNPJ:31.833.574/0001-74 &nbsp;&nbsp; IE:122.047.010.118</div>
                    <div>AV. COM EMÍLIO PIERI, 823 - CAMPINAS/SP CEP: 13057-535 BAIRRO: CONJ. HABIT. VIDA NOVA</div>
                    <div>Tel/WhatsApp: ${telefoneLoja}</div>
                  </div>
                  <div class="header-right">
                    <div>Data: ${dataEntrada}</div>
                    <div>Hora: ${horaEntrada}</div>
                    <div class="os-highlight">OS Nº ${os.numero}</div>
                  </div>
                </div>
                <div class="copy-title">COMPROVANTE DE ENTRADA - ${via}</div>
                <div class="section grid-3">
                  <div><span class="label">Data:</span><span class="value">${dateFormatters.short(os.data_entrada)}</span></div>
                  <div><span class="label">Hora:</span><span class="value">${os.hora_entrada || horaEntrada || '-'}</span></div>
                  <div><span class="label">Status:</span><span class="value">${STATUS_OS_LABELS[os.status as StatusOS] || '-'}</span></div>
                </div>
                <h3>Cliente</h3>
                <div class="card grid-2">
                  <div><span class="label">Cliente:</span><span class="value">${cliente?.nome || os.cliente_nome || '-'}</span></div>
                  <div><span class="label">Contato:</span><span class="value">${os.telefone_contato || '-'}</span></div>
                  ${os.cliente_empresa ? `<div><span class="label">Empresa:</span><span class="value">${os.cliente_empresa}</span></div>` : ''}
                  <div><span class="label">Endereço:</span><span class="value">${formatAddress()}</span></div>
                </div>
                <h3>Equipamento</h3>
                <div class="card grid-3">
                  <div><span class="label">Equipamento:</span><span class="value">${os.tipo_aparelho || '-'}</span></div>
                  <div><span class="label">Modelo:</span><span class="value">${modelo?.nome || os.modelo_nome || '-'}</span></div>
                  <div><span class="label">Marca:</span><span class="value">${marca?.nome || os.marca_nome || '-'}</span></div>
                  ${os.cor ? `<div><span class="label">Cor:</span><span class="value"><strong>${os.cor}</strong></span></div>` : ''}
                  <div><span class="label">IMEI:</span><span class="value">${os.imei || os.numero_serie || '-'}</span></div>
                  <div><span class="label">Acessórios:</span><span class="value">${os.acessorios || os.observacoes_checklist || '-'}</span></div>
                  <div><span class="label">Série:</span><span class="value">${os.numero_serie || '-'}</span></div>
                </div>
                <h3>Problema Informado</h3>
                <div class="card">
                  <div>${os.descricao_problema || '-'}</div>
                  <div class="muted" style="margin-top:2px;"><span class="label">Possui Senha:</span> ${senhaLabel}</div>
                  ${patternSvg ? `<div style="margin-top:2px;">${patternSvg}</div>` : ''}
                </div>
                ${fotoEntradaUrl ? `
                <h3>Foto de Entrada</h3>
                <div class="card" style="text-align: center; padding: 8px;">
                  <img src="${fotoEntradaUrl}" style="max-width: 100%; max-height: 300px; object-fit: contain; border: 1px solid #ddd;" alt="Foto de Entrada" />
                </div>
                ` : ''}
                <h3>Checklist de Entrada</h3>
                <div class="card">
                  ${checklistFisico !== 'Nenhum problema encontrado' ? `
                    <div style="margin-bottom: 4px;">
                      <div class="label" style="color: #dc2626;">Problemas Encontrados:</div>
                      <div style="font-size: 8px; margin-left: 8px; margin-top: 2px;">${checklistFisico}</div>
                    </div>
                  ` : ''}
                  ${checklistFuncional !== 'Nenhum item funcional verificado' ? `
                    <div style="margin-top: 4px;">
                      <div class="label" style="color: #16a34a;">Funcional OK:</div>
                      <div style="font-size: 8px; margin-left: 8px; margin-top: 2px;">${checklistFuncional}</div>
                    </div>
                  ` : ''}
                  ${os.observacoes_checklist ? `
                    <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid #ddd;">
                      <div class="label">Observações:</div>
                      <div style="font-size: 8px; margin-left: 8px; margin-top: 2px;">${os.observacoes_checklist}</div>
                    </div>
                  ` : ''}
                </div>
                <h3>Condições do Aparelho</h3>
                <div class="card">
                  <div>${os.condicoes_equipamento || os.observacoes || '-'}</div>
                </div>
                <h3>Status da Ordem</h3>
                <div class="card grid-2">
                  <div><span class="label">Situação:</span><span class="value">${os.situacao || '-'}</span></div>
                  <div><span class="label">Serviço Executado:</span><span class="value">${os.servico_executado || os.problema_constatado || '-'}</span></div>
                </div>
                ${(os.orcamento_desconto || os.orcamento_parcelado) ? `
                <h3>Orçamento Pré Autorizado</h3>
                <div class="card">
                  <div><span class="label">Valor autorizado (PIX/Dinheiro):</span> ${formatCurrency(os.orcamento_desconto)}</div>
                  <div><span class="label">Valor autorizado (Cartão):</span> ${formatCurrency(os.orcamento_parcelado)}</div>
                </div>
                ` : ''}
                ${(os.subtotal || os.valor_total) ? `
                <h3>Valores</h3>
                <div class="card grid-3">
                  <div><span class="label">Subtotal:</span><span class="value">${formatCurrency(os.subtotal)}</span></div>
                  <div><span class="label">Desconto:</span><span class="value">${formatCurrency(os.desconto)}</span></div>
                  <div><span class="label">Total:</span><span class="value">${formatCurrency(os.valor_total)}</span></div>
                </div>
                ` : ''}
                ${(os.previsao_entrega || os.atendente_nome || os.vendedor_nome) ? `
                <h3>Previsão e Responsáveis</h3>
                <div class="card grid-3">
                  <div><span class="label">Previsão Entrega:</span><span class="value">${os.previsao_entrega ? dateFormatters.short(os.previsao_entrega) : '-'}</span></div>
                  <div><span class="label">Hora:</span><span class="value">${os.hora_previsao || '-'}</span></div>
                  <div><span class="label">Atendente/Vendedor:</span><span class="value">${os.atendente_nome || os.vendedor_nome || '-'}</span></div>
                </div>
                ` : ''}
                <h3>Condições de Serviço</h3>
                <div class="card">
                  <ol>
                    <li>A Empresa oferece Garantia de 90 dias em peças usadas no conserto, contados a partir da data de entrega.</li>
                    <li>Não realizamos troca de peças danificadas por Mal Uso, Molhadas, Trincadas, Quebradas e riscadas.</li>
                    <li>O Aparelho só será devolvido mediante a apresentação desta ou documento do proprietário, guarde-a com cuidado.</li>
                    <li>Ao ligar para a loja, informe o número da Ordem de Serviço para melhor atendê-lo.</li>
                    <li>Os aparelhos não retirados em no máximo 30 dias serão acrescido despesas de armazenamento de 6% ao mês.</li>
                    <li>Os aparelhos não retirados em até 90 dias a partir da data da comunicação para sua retirada, serão descartados.</li>
                  </ol>
                </div>
                <div class="signature">
                  <div class="signature-line">${cliente?.nome || os.cliente_nome || 'Cliente'}</div>
                  <div class="signature-line">${os.tecnico_nome || 'Técnico'}</div>
                </div>
                <div class="footer">${via}</div>
              </div>
            `).join('')}
          </body>
        </html>
      `;

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.onload = () => {
          printWindow.focus();
          printWindow.print();
        };
      }
    } catch (error) {
      toast({ title: 'Erro ao gerar PDF', variant: 'destructive' });
    }
  };
  */

  /*
  // Impressão A4
  const handlePrintA4 = async (os: any) => {
    try {
      const cliente = getClienteById(os.cliente_id);
      const marca = marcas.find(m => m.id === os.marca_id);
      const modelo = modelos.find(m => m.id === os.modelo_id);
      
      // Formatar checklist de entrada
      const checklistFisicoA4 = checklistEntradaConfig
        .filter(item => item.categoria === 'fisico' && parseJsonArray(os.checklist_entrada).includes(item.item_id))
        .map(item => item.nome)
        .join(', ') || 'Nenhum problema encontrado';

      const checklistFuncionalA4 = checklistEntradaConfig
        .filter(item => item.categoria === 'funcional' && parseJsonArray(os.checklist_entrada).includes(item.item_id))
        .map(item => item.nome)
        .join(', ') || 'Nenhum item funcional verificado';

      // Buscar primeira foto de entrada
      const fotoEntradaA4 = os.fotos_telegram_entrada?.[0];
      const fotoEntradaUrlA4 = fotoEntradaA4 
        ? (typeof fotoEntradaA4 === 'string' ? fotoEntradaA4 : (fotoEntradaA4.url || fotoEntradaA4.thumbnailUrl))
        : undefined;
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>OS #${os.numero}</title>
          <style>
            @media print {
              body { margin: 0; padding: 20px; }
            }
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .info { margin-bottom: 15px; }
            .info strong { display: inline-block; width: 150px; }
            .termo { margin-top: 30px; padding: 15px; border: 1px solid #ccc; background: #f9f9f9; }
            .termo h3 { margin-top: 0; }
            .termo ol { margin: 10px 0; padding-left: 20px; }
            .termo li { margin: 5px 0; }
            .checklist-section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; background: #fafafa; }
            .checklist-section h3 { margin-top: 0; color: #333; }
            .checklist-item { margin: 5px 0; padding-left: 20px; }
            .checklist-fisico { color: #dc2626; }
            .checklist-funcional { color: #16a34a; }
            .foto-entrada { text-align: center; margin: 20px 0; }
            .foto-entrada img { max-width: 100%; max-height: 400px; border: 1px solid #ddd; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>ORDEM DE SERVIÇO #${os.numero}</h1>
            <p>Prime Camp Assistência Técnica</p>
          </div>
          
          <div class="info">
            <strong>Cliente:</strong> ${cliente?.nome || os.cliente_nome || '-'}
          </div>
          <div class="info">
            <strong>Telefone:</strong> ${os.telefone_contato || '-'}
          </div>
          <div class="info">
            <strong>Aparelho:</strong> ${marca?.nome || ''} ${modelo?.nome || ''}
          </div>
          <div class="info">
            <strong>IMEI:</strong> ${os.imei || '-'}
          </div>
          <div class="info">
            <strong>Problema:</strong> ${os.descricao_problema || '-'}
          </div>
          <div class="info">
            <strong>Data Entrada:</strong> ${dateFormatters.short(os.data_entrada)}
          </div>
          <div class="info">
            <strong>Previsão Entrega:</strong> ${os.previsao_entrega ? dateFormatters.short(os.previsao_entrega) : '-'}
          </div>
          
          ${fotoEntradaUrlA4 ? `
          <div class="foto-entrada">
            <h3>Foto de Entrada</h3>
            <img src="${fotoEntradaUrlA4}" alt="Foto de Entrada" />
          </div>
          ` : ''}
          
          <div class="checklist-section">
            <h3>Checklist de Entrada</h3>
            ${checklistFisicoA4 !== 'Nenhum problema encontrado' ? `
              <div class="checklist-fisico">
                <strong>Problemas Encontrados:</strong>
                <div class="checklist-item">${checklistFisicoA4}</div>
              </div>
            ` : ''}
            ${checklistFuncionalA4 !== 'Nenhum item funcional verificado' ? `
              <div class="checklist-funcional" style="margin-top: 15px;">
                <strong>Funcional OK:</strong>
                <div class="checklist-item">${checklistFuncionalA4}</div>
              </div>
            ` : ''}
            ${os.observacoes_checklist ? `
              <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd;">
                <strong>Observações:</strong>
                <div style="margin-top: 5px;">${os.observacoes_checklist}</div>
              </div>
            ` : ''}
          </div>
          
          <div class="termo">
            <h3>Sobre a Garantia do Serviço:</h3>
            <ol>
              <li>A Empresa oferece Garantia de 90 dias em peças usadas no conserto, contados a partir da data de entrega.</li>
              <li>Não realizamos troca de peças danificadas por Mal Uso, Molhadas, Trincadas, Quebradas e riscadas.</li>
              <li>O Aparelho só será devolvido mediante a apresentação desta ou documento do proprietário, guarde-a com cuidado.</li>
              <li>Ao ligar para a loja, informe o número da Ordem de Serviço para melhor atendê-lo.</li>
              <li>Os aparelhos não retirados em no máximo 30 dias serão acrescido despesas de armazenamento de 6% ao mês.</li>
              <li>Os aparelhos não retirados em até 90 dias a partir da data da comunicação para sua retirada, serão descartados.</li>
            </ol>
          </div>
        </body>
        </html>
      `;

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
        }, 250);
      }
    } catch (error) {
      toast({ title: 'Erro ao imprimir', variant: 'destructive' });
    }
  };
  */

  const content = (
    <div className={cn("w-full h-full flex flex-col")}>
        {/* Tabs principais */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0 overflow-hidden">

          {/* Resumo Fixo da OS - Oculto no mobile, compacto no desktop */}
          {isEditing && currentOS && (
            <div className="flex-shrink-0 mb-2 px-2 hidden sm:block">
              <OSSummaryHeader
                numeroOS={currentOS.numero}
                clienteNome={selectedCliente?.nome || getClienteById(currentOS.cliente_id)?.nome}
                modeloNome={modelos.find(m => m.id === currentOS.modelo_id)?.nome || currentOS.modelo_nome}
                status={currentOS.status}
                valorTotal={total}
                valorPago={totalPagoAPI}
                previsaoEntrega={currentOS.previsao_entrega}
                tecnicoNome={currentOS.tecnico_id ? getColaboradorById(currentOS.tecnico_id)?.nome || currentOS.tecnico_nome : undefined}
              />
            </div>
          )}

          {/* Tab Dados - com scroll interno */}
          <TabsContent value="dados" className="flex-1 min-h-0 overflow-auto scrollbar-thin p-2 md:p-3">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
              {/* Widget 1: Dados do Cliente e Aparelho */}
              <Card className="border border-gray-200/80 shadow-sm rounded-xl bg-white">
                <CardHeader className="py-3 px-4 border-b border-gray-100 bg-gray-50/50 rounded-t-xl">
                  <CardTitle className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    Dados da OS
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-4">
                  {/* Cliente */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1.5 md:col-span-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Label className={cn("text-xs font-medium text-gray-600", camposFaltandoState.has('cliente') && "font-bold text-red-600")}>Cliente *</Label>
                          {camposFaltandoState.has('cliente') && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">Obrigatório</Badge>
                          )}
                        </div>
                        {/* Filtro de busca */}
                        {!selectedCliente && (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => setClienteSearchField('nome')}
                              className={cn(
                                "px-2 py-0.5 text-[10px] rounded-full transition-colors",
                                clienteSearchField === 'nome' 
                                  ? "bg-blue-600 text-white" 
                                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                              )}
                            >
                              Nome
                            </button>
                            <button
                              type="button"
                              onClick={() => setClienteSearchField('cpf_cnpj')}
                              className={cn(
                                "px-2 py-0.5 text-[10px] rounded-full transition-colors",
                                clienteSearchField === 'cpf_cnpj' 
                                  ? "bg-blue-600 text-white" 
                                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                              )}
                            >
                              CPF
                            </button>
                            <button
                              type="button"
                              onClick={() => setClienteSearchField('telefone')}
                              className={cn(
                                "px-2 py-0.5 text-[10px] rounded-full transition-colors",
                                clienteSearchField === 'telefone' 
                                  ? "bg-blue-600 text-white" 
                                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                              )}
                            >
                              Telefone
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="relative" ref={clienteSearchAnchorRef}>
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder={
                            clienteSearchField === 'nome' ? "Buscar por nome..." :
                            clienteSearchField === 'cpf_cnpj' ? "Buscar por CPF/CNPJ..." :
                            "Buscar por telefone..."
                          }
                          value={selectedCliente ? selectedCliente.nome : clienteSearch}
                          onChange={(e) => {
                            if (selectedCliente) {
                              setSelectedCliente(null);
                              setFormData(prev => ({ ...prev, cliente_id: '' }));
                            }
                            setClienteSearch(e.target.value);
                            setShowClienteSearch(true);
                          }}
                          onFocus={() => setShowClienteSearch(true)}
                          className={cn(
                            "pl-10 pr-10 h-10 text-sm border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg",
                            selectedCliente ? "bg-green-50 border-green-300 text-green-800 font-medium" : ""
                          )}
                        />
                        {/* Loading indicator */}
                        {isSearchingCliente && !selectedCliente && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                        {selectedCliente && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0 hover:bg-red-100 hover:text-red-600"
                            onClick={() => {
                              setSelectedCliente(null);
                              setFormData(prev => ({ ...prev, cliente_id: '' }));
                              setClienteSearch('');
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {/* Dropdown de clientes em portal para não ser cortado pelo overflow do tab */}
                      {clienteDropdownRect && createPortal(
                        <div
                          className="fixed z-[100] min-w-0 max-h-48 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg"
                          style={{
                            top: clienteDropdownRect.top,
                            left: clienteDropdownRect.left,
                            width: clienteDropdownRect.width,
                          }}
                        >
                          {clienteResults.length > 0 ? (
                            <>
                              {clienteResults.map(cliente => (
                                <div
                                  key={cliente.id}
                                  className="p-2.5 hover:bg-blue-50 cursor-pointer border-b-2 border-gray-200 last:border-b-0 transition-colors"
                                  onClick={() => handleSelectCliente(cliente)}
                                >
                                  <p className="font-semibold text-sm text-gray-800 truncate">{cliente.nome}</p>
                                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                                    {cliente.cpf_cnpj && <span>{cliente.cpf_cnpj} • </span>}
                                    {cliente.telefone || cliente.whatsapp || 'Sem telefone'}
                                    {cliente.cidade && <span> • {cliente.cidade}/{cliente.estado}</span>}
                                  </p>
                                </div>
                              ))}
                              <div
                                className="p-2.5 hover:bg-green-50 cursor-pointer border-t-2 border-gray-300 bg-gray-50 transition-colors flex items-center gap-2 text-green-700"
                                onClick={handleOpenNovoClienteModal}
                              >
                                <Plus className="h-4 w-4 shrink-0" />
                                <span className="font-medium text-sm">Cadastrar Novo Cliente</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="p-3 text-center border-b-2 border-gray-200">
                                <p className="text-sm text-gray-500">Nenhum cliente encontrado</p>
                                <p className="text-xs text-gray-400 mt-1">Verifique o termo ou cadastre um novo</p>
                              </div>
                              <div
                                className="p-2.5 hover:bg-green-50 cursor-pointer bg-gray-50 transition-colors flex items-center justify-center gap-2 text-green-700"
                                onClick={handleOpenNovoClienteModal}
                              >
                                <Plus className="h-4 w-4" />
                                <span className="font-medium text-sm">Cadastrar "{clienteSearch}"</span>
                              </div>
                            </>
                          )}
                        </div>,
                        document.body
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Label className={cn("text-xs font-medium text-gray-600", camposFaltandoState.has('telefone') && "font-bold text-red-600")}>Telefone *</Label>
                        {camposFaltandoState.has('telefone') && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">Obrigatório</Badge>
                        )}
                      </div>
                      <Input
                        value={formData.telefone_contato || selectedCliente?.telefone || selectedCliente?.whatsapp || ''}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, telefone_contato: e.target.value }));
                          if (camposFaltandoState.has('telefone') && e.target.value.trim() !== '') {
                            setCamposFaltandoState(prev => {
                              const next = new Set(prev);
                              next.delete('telefone');
                              return next;
                            });
                          }
                        }}
                        placeholder="(99) 99999-9999"
                        className={cn("h-10 text-sm border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg", camposFaltandoState.has('telefone') && "border-red-500 border-2 bg-red-50")}
                        required
                      />
                    </div>
                  </div>
                  {/* CPF e Endereço do cliente (somente quando houver cliente selecionado) */}
                  {(() => {
                    const clienteDados = selectedCliente || (formData.cliente_id ? getClienteById(formData.cliente_id) : null);
                    if (!clienteDados) return null;
                    const enderecoPartes = [
                      clienteDados.logradouro,
                      clienteDados.numero,
                      clienteDados.complemento,
                      clienteDados.bairro,
                      [clienteDados.cidade, clienteDados.estado || clienteDados.uf].filter(Boolean).join('/'),
                      clienteDados.cep,
                    ].filter(Boolean);
                    const enderecoCompleto = enderecoPartes.length > 0 ? enderecoPartes.join(', ') : null;
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 border-t border-gray-100">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-gray-500">CPF/CNPJ</Label>
                          <p className="text-sm text-gray-800 min-h-[1.25rem]">{clienteDados.cpf_cnpj || '—'}</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-gray-500">Endereço completo</Label>
                          <p className="text-sm text-gray-800 min-h-[1.25rem]">{enderecoCompleto || '—'}</p>
                        </div>
                      </div>
                    );
                  })()}
                  
                  {/* Aparelho - Linha 1 */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Label className={cn("text-xs font-medium text-gray-600", camposFaltandoState.has('marca') && "font-bold text-red-600")}>Marca *</Label>
                        {camposFaltandoState.has('marca') && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">Obrigatório</Badge>
                        )}
                      </div>
                      <Select 
                        value={formData.marca_id || ''} 
                        onValueChange={(v) => {
                          setFormData(prev => ({ 
                            ...prev, 
                            marca_id: v, 
                            modelo_id: '' 
                          }));
                          if (camposFaltandoState.has('marca')) {
                            setCamposFaltandoState(prev => {
                              const next = new Set(prev);
                              next.delete('marca');
                              return next;
                            });
                          }
                        }}
                      >
                        <SelectTrigger className={cn("w-full h-10 text-sm border-gray-200 rounded-lg", camposFaltandoState.has('marca') && "border-red-500 border-2 bg-red-50")}>
                          <SelectValue placeholder="Selecione a marca">
                            {formData.marca_id && marcas.length > 0 
                              ? (marcas.find(m => m.id === formData.marca_id)?.nome || currentOS?.marca_nome || '')
                              : ''}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="max-h-[200px]">
                          {marcas && marcas.length > 0 ? (
                            marcas.filter(m => m.situacao === 'ativo').map(m => (
                              <SelectItem key={m.id} value={m.id} className="text-sm">{m.nome}</SelectItem>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-sm text-gray-500">Nenhuma marca cadastrada. Acesse Marcas e Modelos para cadastrar.</div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Label className={cn("text-xs font-medium text-gray-600", camposFaltandoState.has('modelo') && "font-bold text-red-600")}>Modelo *</Label>
                        {camposFaltandoState.has('modelo') && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">Obrigatório</Badge>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Popover open={modeloPopoverOpen} onOpenChange={(open) => { setModeloPopoverOpen(open); if (!open) setModeloSearch(''); }}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className={cn("w-full h-10 text-sm border-gray-200 rounded-lg justify-between font-normal", camposFaltandoState.has('modelo') && "border-red-500 border-2 bg-red-50")}
                              disabled={!formData.marca_id}
                            >
                              <span className="truncate">
                                {formData.modelo_id && modelosFiltrados.length > 0
                                  ? (modelosFiltrados.find(m => m.id === formData.modelo_id)?.nome || currentOS?.modelo_nome || '')
                                  : 'Selecione o modelo'}
                              </span>
                              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                            {/* 1) Caixa de pesquisa no topo */}
                            <div className="p-2 border-b border-gray-100">
                              <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                  placeholder="Pesquisar modelo..."
                                  value={modeloSearch}
                                  onChange={(e) => setModeloSearch(e.target.value)}
                                  className="h-9 pl-8 text-sm"
                                  autoFocus
                                />
                              </div>
                            </div>
                            {/* 2) Cadastrar novo (abaixo da pesquisa) */}
                            {formData.marca_id && (
                              <button
                                type="button"
                                onClick={() => { setShowNovoModeloModal(true); setModeloPopoverOpen(false); }}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-green-700 font-medium hover:bg-green-50 border-b border-gray-100"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                <span>Cadastrar Novo Modelo</span>
                              </button>
                            )}
                            {/* 3) Lista de produtos/modelos */}
                            <ScrollArea className="max-h-[220px]">
                              {modelosFiltradosBySearch.length > 0 ? (
                                <div className="p-1">
                                  {modelosFiltradosBySearch.map(m => (
                                    <button
                                      key={m.id}
                                      type="button"
                                      className="w-full flex items-center px-3 py-2 text-sm text-left rounded-md hover:bg-accent"
                                      onClick={() => {
                                        setFormData(prev => ({ ...prev, modelo_id: m.id }));
                                        if (camposFaltandoState.has('modelo')) {
                                          setCamposFaltandoState(prev => { const next = new Set(prev); next.delete('modelo'); return next; });
                                        }
                                        setModeloPopoverOpen(false);
                                      }}
                                    >
                                      {m.nome}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <div className="px-3 py-4 text-sm text-gray-500 text-center">
                                  {formData.marca_id
                                    ? (modeloSearch.trim() ? 'Nenhum modelo encontrado.' : 'Nenhum modelo cadastrado. Use "Cadastrar Novo Modelo" acima.')
                                    : 'Selecione uma marca primeiro'}
                                </div>
                              )}
                            </ScrollArea>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-600">{isOficinaMecanica ? 'Placa' : 'IMEI'}</Label>
                      <Input
                        value={formData.imei}
                        onChange={(e) => setFormData(prev => ({ ...prev, imei: e.target.value }))}
                        placeholder={isOficinaMecanica ? 'Ex: ABC-1D23' : 'Digite o IMEI'}
                        className="h-10 text-sm border-gray-200 rounded-lg"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-600">{isOficinaMecanica ? 'Chassis' : 'Nº Série'}</Label>
                      <Input
                        value={formData.numero_serie}
                        onChange={(e) => setFormData(prev => ({ ...prev, numero_serie: e.target.value }))}
                        placeholder={isOficinaMecanica ? 'Número do chassi (opcional)' : 'Número de série'}
                        className="h-10 text-sm border-gray-200 rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Aparelho - Linha 2 */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Label className={cn("text-xs font-medium text-gray-600", camposFaltandoState.has('cor') && "font-bold text-red-600")}>Cor *</Label>
                        {camposFaltandoState.has('cor') && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">Obrigatório</Badge>
                        )}
                      </div>
                      <Input
                        value={formData.cor}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, cor: e.target.value }));
                          if (camposFaltandoState.has('cor') && e.target.value.trim() !== '') {
                            setCamposFaltandoState(prev => {
                              const next = new Set(prev);
                              next.delete('cor');
                              return next;
                            });
                          }
                        }}
                        placeholder="Ex: Preto, Branco"
                        className={cn("h-10 text-sm border-gray-200 rounded-lg", camposFaltandoState.has('cor') && "border-red-500 border-2 bg-red-50")}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-600">{isOficinaMecanica ? 'Deixou veículo' : 'Deixou aparelho'}</Label>
                      <Select 
                        value={formData.deixou_aparelho ? 'sim' : formData.apenas_agendamento ? 'agendado' : 'nao'} 
                        onValueChange={(v) => {
                          setFormData(prev => ({ 
                            ...prev, 
                            deixou_aparelho: v === 'sim',
                            apenas_agendamento: v === 'agendado'
                          }));
                        }}
                      >
                        <SelectTrigger className="w-full h-10 text-sm border-gray-200 rounded-lg">
                          <SelectValue placeholder="Selecione">
                            {formData.deixou_aparelho ? 'SIM' : formData.apenas_agendamento ? 'AGENDADO' : 'NÃO'}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="max-h-[200px]">
                          <SelectItem value="sim" className="text-sm">SIM</SelectItem>
                          <SelectItem value="nao" className="text-sm">NÃO</SelectItem>
                          <SelectItem value="agendado" className="text-sm">AGENDADO</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Label className={cn("text-xs font-medium text-gray-600", camposFaltandoState.has('previsao_entrega') && "font-bold text-red-600")}>Previsão Entrega *</Label>
                        {camposFaltandoState.has('previsao_entrega') && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">Obrigatório</Badge>
                        )}
                      </div>
                      <Input
                        type="date"
                        value={formData.previsao_entrega}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, previsao_entrega: e.target.value }));
                          if (camposFaltandoState.has('previsao_entrega') && e.target.value.trim() !== '') {
                            setCamposFaltandoState(prev => {
                              const next = new Set(prev);
                              next.delete('previsao_entrega');
                              return next;
                            });
                          }
                        }}
                        className={cn("h-10 text-sm border-gray-200 rounded-lg", camposFaltandoState.has('previsao_entrega') && "border-red-500 border-2 bg-red-50")}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-600">Hora</Label>
                      <Input
                        type="time"
                        value={formData.hora_previsao || '18:00'}
                        onChange={(e) => setFormData(prev => ({ ...prev, hora_previsao: e.target.value }))}
                        className="h-10 text-sm border-gray-200 rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Descrição e Condições */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Label className={cn("text-xs font-medium text-gray-600", camposFaltandoState.has('descricao_problema') && "font-bold text-red-600")}>Descrição do Problema *</Label>
                        {camposFaltandoState.has('descricao_problema') && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">Obrigatório</Badge>
                        )}
                      </div>
                      <Textarea
                        value={formData.descricao_problema}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, descricao_problema: e.target.value }));
                          if (camposFaltandoState.has('descricao_problema') && e.target.value.trim() !== '') {
                            setCamposFaltandoState(prev => {
                              const next = new Set(prev);
                              next.delete('descricao_problema');
                              return next;
                            });
                          }
                        }}
                        placeholder="Descreva detalhadamente o problema relatado pelo cliente..."
                        rows={3}
                        className={cn("resize-none text-sm border-gray-200 rounded-lg min-h-[80px]", camposFaltandoState.has('descricao_problema') && "border-red-500 border-2 bg-red-50")}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Label className={cn("text-xs font-medium text-gray-600", camposFaltandoState.has('condicoes_equipamento') && "font-bold text-red-600")}>{isOficinaMecanica ? 'Condições do veículo *' : 'Condições do Equipamento *'}</Label>
                        {camposFaltandoState.has('condicoes_equipamento') && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">Obrigatório</Badge>
                        )}
                      </div>
                      <Textarea
                        value={formData.condicoes_equipamento}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, condicoes_equipamento: e.target.value }));
                          if (camposFaltandoState.has('condicoes_equipamento') && e.target.value.trim() !== '') {
                            setCamposFaltandoState(prev => {
                              const next = new Set(prev);
                              next.delete('condicoes_equipamento');
                              return next;
                            });
                          }
                        }}
                        placeholder={isOficinaMecanica ? 'Estado físico do veículo: riscos, amassados, quilometragem...' : 'Estado físico do aparelho: riscos, trincas, amassados...'}
                        rows={3}
                        className={cn("resize-none text-sm border-gray-200 rounded-lg min-h-[80px]", camposFaltandoState.has('condicoes_equipamento') && "border-red-500 border-2 bg-red-50")}
                        required
                      />
                    </div>
                  </div>

                  {/* Orçamento Pré Autorizado */}
                  <div className="p-3 bg-gray-50/80 rounded-lg border border-gray-100">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <Label className="text-xs font-semibold text-gray-700">Orçamento Pré-Autorizado</Label>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="apenas-orcamento"
                          checked={!!formData.apenas_orcamento}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, apenas_orcamento: !!checked }))}
                          className="h-3 w-3 shrink-0 rounded border-gray-400"
                        />
                        <Label htmlFor="apenas-orcamento" className="text-[11px] text-gray-600 cursor-pointer">
                          Realizar Orçamento
                        </Label>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-gray-500">Cartão até 6x</Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          value={formData.orcamento_parcelado === 0 ? '' : (formData.orcamento_parcelado ?? '')}
                          onChange={(e) => {
                            const val = e.target.value;
                            const numValue = val === '' ? undefined : parseFloat(val);
                            setFormData(prev => ({ ...prev, orcamento_parcelado: numValue }));
                          }}
                          placeholder="R$ 0,00"
                          className="h-10 text-sm border-gray-200 rounded-lg"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-gray-500">Dinheiro ou PIX</Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          value={formData.orcamento_desconto === 0 ? '' : (formData.orcamento_desconto ?? '')}
                          onChange={(e) => {
                            const val = e.target.value;
                            const numValue = val === '' ? undefined : parseFloat(val);
                            setFormData(prev => ({ ...prev, orcamento_desconto: numValue }));
                          }}
                          placeholder="R$ 0,00"
                          className="h-10 text-sm border-gray-200 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Widget 2: Senha/Chave e Áreas com Defeito (veículo: só chave/código e referência; celular: senha + deslizar + referência) */}
              <Card className="border border-gray-200/80 shadow-sm rounded-xl bg-white">
                <CardHeader className="py-3 px-4 border-b border-gray-100 bg-gray-50/50 rounded-t-xl">
                  <CardTitle className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    {isOficinaMecanica ? 'Chave/Código e Defeitos' : 'Senha e Defeitos'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  {/* Seção Senha/Chave — obrigatório; oficina: só chave/código (sem opção deslizar) */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className={cn("text-xs font-medium text-gray-600", camposFaltandoState.has('possui_senha') && "font-bold text-red-600")}>
                        {isOficinaMecanica ? 'Possui chave ou código? *' : 'Possui senha *'}
                      </Label>
                      {camposFaltandoState.has('possui_senha') && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">Obrigatório</Badge>
                      )}
                    </div>
                    <Select 
                      value={formData.possui_senha_tipo === '' ? '__vazio__' : formData.possui_senha_tipo} 
                      onValueChange={(v) => {
                        if (v === '__vazio__') return;
                        setFormData(prev => ({ 
                          ...prev, 
                          possui_senha_tipo: v,
                          possui_senha: v !== 'nao' && v !== ''
                        }));
                        if (camposFaltandoState.has('possui_senha')) {
                          setCamposFaltandoState(prev => { const next = new Set(prev); next.delete('possui_senha'); return next; });
                        }
                      }}
                    >
                      <SelectTrigger className={cn("w-full h-10 text-sm border-gray-200 rounded-lg", camposFaltandoState.has('possui_senha') && "border-red-500 border-2 bg-red-50")}>
                        <SelectValue placeholder={isOficinaMecanica ? 'Selecione se deixou chave/código do veículo' : 'Selecione se o aparelho possui senha'}>
                          {(formData.possui_senha_tipo === 'sim' || (isOficinaMecanica && formData.possui_senha_tipo === 'deslizar')) && 'SIM'}
                          {formData.possui_senha_tipo === 'deslizar' && !isOficinaMecanica && 'SIM - DESLIZAR (DESENHO)'}
                          {formData.possui_senha_tipo === 'nao' && 'NÃO'}
                          {formData.possui_senha_tipo === 'nao_sabe' && 'NÃO SABE'}
                          {formData.possui_senha_tipo === 'nao_autorizou' && (isOficinaMecanica ? 'NÃO QUIS DEIXAR' : 'NÃO AUTORIZOU')}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        <SelectItem value="sim" className="text-sm">SIM</SelectItem>
                        {!isOficinaMecanica && <SelectItem value="deslizar" className="text-sm">SIM - DESLIZAR (DESENHO)</SelectItem>}
                        <SelectItem value="nao" className="text-sm">NÃO</SelectItem>
                        <SelectItem value="nao_sabe" className="text-sm">{isOficinaMecanica ? 'NÃO SABE / VAI PASSAR DEPOIS' : 'NÃO SABE, VAI PASSAR DEPOIS'}</SelectItem>
                        <SelectItem value="nao_autorizou" className="text-sm">{isOficinaMecanica ? 'CLIENTE NÃO QUIS DEIXAR CHAVE/CÓDIGO' : 'CLIENTE NÃO QUIS DEIXAR SENHA'}</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Senha - Campo de texto quando SIM (obrigatório) */}
                    {formData.possui_senha_tipo === 'sim' && (
                      <div className="space-y-1">
                        <Label className={cn("text-xs font-medium text-gray-600", camposFaltandoState.has('senha_aparelho') && "font-bold text-red-600")}>
                          {isOficinaMecanica ? 'Chave ou código do veículo *' : 'Senha do aparelho *'}
                        </Label>
                        {camposFaltandoState.has('senha_aparelho') && (
                          <p className="text-xs text-red-600">{isOficinaMecanica ? 'Preencha quando "Possui senha/chave" for SIM.' : 'Preencha a senha quando "Possui senha" for SIM.'}</p>
                        )}
                        <Input
                          type="text"
                          value={formData.senha_aparelho}
                          onChange={(e) => {
                            setFormData(prev => ({ ...prev, senha_aparelho: e.target.value }));
                            if (e.target.value.trim()) {
                              setCamposFaltandoState(prev => { const next = new Set(prev); next.delete('senha_aparelho'); return next; });
                            }
                          }}
                          placeholder={isOficinaMecanica ? 'Chave ou código (ex.: chave reserva)' : 'Digite a senha do aparelho'}
                          className={cn("h-10 text-sm border-gray-200 rounded-lg", camposFaltandoState.has('senha_aparelho') && "border-red-500 border-2 bg-red-50")}
                        />
                      </div>
                    )}

                    {/* Senha - PatternLock quando DESLIZAR (apenas celular; oficina não usa) */}
                    {!isOficinaMecanica && formData.possui_senha_tipo === 'deslizar' && (
                      <div className="space-y-2">
                        <div className="flex justify-center p-2 bg-gray-50 rounded-lg">
                          <PatternLock
                            value={formData.padrao_desbloqueio}
                            onChange={(pattern) => setFormData(prev => ({ ...prev, padrao_desbloqueio: pattern }))}
                            className="max-w-[180px]"
                          />
                        </div>
                        <Input
                          value={formData.senha_aparelho}
                          onChange={(e) => setFormData(prev => ({ ...prev, senha_aparelho: e.target.value }))}
                          placeholder="Senha adicional (opcional)"
                          className="h-10 text-sm border-gray-200 rounded-lg"
                        />
                      </div>
                    )}
                  </div>

                  {/* Seção Áreas com Defeito - Imagem de Referência Interativa */}
                  <div className="border-t border-gray-100 pt-4">
                    <Label className="text-xs font-medium text-gray-600 mb-2 block">{isOficinaMecanica ? 'Referência Visual do Veículo' : 'Referência Visual do Aparelho'}</Label>
                    <div className="h-[220px] flex items-center justify-center bg-gray-50/50 rounded-xl border border-gray-200 p-2">
                      <OSImageReferenceViewer
                        imageUrl={osImageReferenceUrl || null}
                        defects={formData.areas_defeito || []}
                        onDefectsChange={(defects) => setFormData(prev => ({ ...prev, areas_defeito: defects }))}
                        readOnly={false}
                        variant={isOficinaMecanica ? 'veiculo' : 'aparelho'}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2 px-1">
                      <p className="text-xs text-gray-500">
                        Clique para marcar defeitos ({formData.areas_defeito?.length || 0})
                      </p>
                      {formData.areas_defeito && formData.areas_defeito.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFormData(prev => ({ ...prev, areas_defeito: [] }));
                          }}
                          className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded px-2 py-1 transition-colors flex items-center gap-1"
                          title="Limpar todos os defeitos"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Limpar</span>
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab Checklist */}
          <TabsContent value="checklist" className="flex-1 min-h-0 overflow-auto scrollbar-thin space-y-2 mt-2 p-2">
            <Tabs defaultValue="entrada" className="w-full">
              <TabsList className="w-full justify-start mb-4">
                <TabsTrigger value="entrada">Checklist de Entrada</TabsTrigger>
                {isEditing && currentOS && (
                  <TabsTrigger value="saida">Checklist de Saída</TabsTrigger>
                )}
              </TabsList>

              {/* Auditoria: quem realizou */}
              <div className="flex flex-wrap items-center gap-2 mb-3 px-2">
                {formData.checklist_entrada_realizado_por_nome && (
                  <Badge variant="outline" className="border-gray-300 text-gray-800 text-xs font-semibold">
                    Entrada: {formData.checklist_entrada_realizado_por_nome}
                    {formData.checklist_entrada_realizado_em ? ` • ${dateFormatters.short(formData.checklist_entrada_realizado_em)}` : ''}
                  </Badge>
                )}
                {isEditing && currentOS?.checklist_saida_realizado_por_nome && (
                  <Badge variant="outline" className="border-gray-300 text-gray-800 text-xs font-semibold">
                    Saída: {currentOS.checklist_saida_realizado_por_nome}
                    {currentOS.checklist_saida_realizado_em ? ` • ${dateFormatters.short(currentOS.checklist_saida_realizado_em)}` : ''}
                  </Badge>
                )}
              </div>

              {/* Checklist de Entrada */}
              <TabsContent value="entrada" className="space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 px-2">
                  {/* Problemas Encontrados - Entrada */}
                  <Card className="border-2 border-gray-300 shadow-sm rounded-xl">
                    <CardHeader className="pb-2 pt-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base font-semibold text-destructive">Problemas Encontrados</CardTitle>
                          <CardDescription className="text-xs">Marque os problemas encontrados</CardDescription>
                        </div>
                        <Badge variant="destructive" className="text-xs">
                          {checklistEntradaConfig.filter(i => i.categoria === 'fisico').filter(item => parseJsonArray(formData.checklist_entrada).includes(item.item_id)).length} / {checklistEntradaConfig.filter(i => i.categoria === 'fisico').length}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 pt-2">
                      <ScrollArea className="h-[calc(100vh-20rem)] md:h-[400px]">
                        <div className="grid grid-cols-1 gap-1 pr-4">
                          {checklistEntradaConfig.filter(i => i.categoria === 'fisico').map(item => (
                            <div key={item.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50">
                              <Checkbox
                                id={`entrada-fisico-${item.id}`}
                                checked={parseJsonArray(formData.checklist_entrada).includes(item.item_id)}
                                onCheckedChange={() => toggleChecklist(item.item_id)}
                              />
                              <Label htmlFor={`entrada-fisico-${item.id}`} className="text-sm cursor-pointer flex-1 font-medium">
                                {item.nome}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  {/* Funcional OK - Entrada */}
                  <Card className="border-2 border-gray-300 shadow-sm rounded-xl">
                    <CardHeader className="pb-2 pt-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base font-semibold text-green-700">Funcional OK</CardTitle>
                          <CardDescription className="text-xs">Marque o que está funcionando</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                            {checklistEntradaConfig.filter(i => i.categoria === 'funcional').filter(item => parseJsonArray(formData.checklist_entrada).includes(item.item_id)).length} / {checklistEntradaConfig.filter(i => i.categoria === 'funcional').length}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              const funcionalIds = checklistEntradaConfig.filter(i => i.categoria === 'funcional').map(i => i.item_id);
                              const novosIds = [...new Set([...(formData.checklist_entrada || []), ...funcionalIds])];
                              const userId = user?.id || '';
                              const userNome = profile?.display_name || user?.email || '';
                              const agora = new Date().toISOString();
                              setFormData(prev => ({
                                ...prev,
                                checklist_entrada: novosIds,
                                checklist_entrada_realizado_por_id: userId || prev.checklist_entrada_realizado_por_id,
                                checklist_entrada_realizado_por_nome: userNome || prev.checklist_entrada_realizado_por_nome,
                                checklist_entrada_realizado_em: agora,
                              }));
                            }}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Marcar tudo OK
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 pt-2">
                      <ScrollArea className="h-[calc(100vh-20rem)] md:h-[400px]">
                        <div className="grid grid-cols-1 gap-1 pr-4">
                          {checklistEntradaConfig.filter(i => i.categoria === 'funcional').map(item => (
                            <div key={item.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50">
                              <Checkbox
                                id={`entrada-funcional-${item.id}`}
                                checked={parseJsonArray(formData.checklist_entrada).includes(item.item_id)}
                                onCheckedChange={() => toggleChecklist(item.item_id)}
                              />
                              <Label htmlFor={`entrada-funcional-${item.id}`} className="text-sm cursor-pointer flex-1 font-medium">
                                {item.nome}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
                
                {/* Observações do Checklist de Entrada */}
                <Card className="border-2 border-gray-300 shadow-sm rounded-xl">
                  <CardHeader className="pb-2 pt-3">
                    <CardTitle className="text-base font-semibold">Observações do Checklist de Entrada</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <Textarea
                      value={formData.observacoes_checklist || ''}
                      onChange={(e) => {
                        const userId = user?.id || '';
                        const userNome = profile?.display_name || user?.email || '';
                        const agora = new Date().toISOString();
                        setFormData(prev => ({
                          ...prev,
                          observacoes_checklist: e.target.value,
                          checklist_entrada_realizado_por_id: userId || prev.checklist_entrada_realizado_por_id,
                          checklist_entrada_realizado_por_nome: userNome || prev.checklist_entrada_realizado_por_nome,
                          checklist_entrada_realizado_em: agora,
                        }));
                      }}
                      placeholder="Adicione observações gerais sobre o checklist de entrada..."
                      rows={3}
                      className="resize-none"
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Checklist de Saída */}
              {isEditing && currentOS && (
                <TabsContent value="saida" className="space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 px-2">
                    {/* Problemas Encontrados - Saída */}
                    <Card className="border-2">
                      <CardHeader className="pb-2 pt-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base text-destructive">Problemas Encontrados</CardTitle>
                            <CardDescription className="text-xs">Itens verificados na saída</CardDescription>
                          </div>
                          <Badge variant="destructive" className="text-xs">
                            {checklistSaidaConfig.filter(i => i.categoria === 'fisico').filter(item => parseJsonArray(currentOS.checklist_saida).includes(item.item_id)).length} / {checklistSaidaConfig.filter(i => i.categoria === 'fisico').length}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="flex-1 pt-2">
                        <ScrollArea className="h-[calc(100vh-20rem)] md:h-[400px]">
                          <div className="grid grid-cols-1 gap-1 pr-4">
                            {checklistSaidaConfig.filter(i => i.categoria === 'fisico').map(item => (
                              <div key={item.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50">
                                <Checkbox
                                  id={`saida-fisico-${item.id}`}
                                  checked={parseJsonArray(currentOS.checklist_saida).includes(item.item_id)}
                                  disabled
                                />
                                <Label htmlFor={`saida-fisico-${item.id}`} className="text-sm cursor-default opacity-75 flex-1">
                                  {item.nome}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>

                    {/* Funcional OK - Saída */}
                    <Card className="border-2">
                      <CardHeader className="pb-2 pt-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base text-green-600">Funcional OK</CardTitle>
                            <CardDescription className="text-xs">Itens funcionais verificados na saída</CardDescription>
                          </div>
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                            {checklistSaidaConfig.filter(i => i.categoria === 'funcional').filter(item => parseJsonArray(currentOS.checklist_saida).includes(item.item_id)).length} / {checklistSaidaConfig.filter(i => i.categoria === 'funcional').length}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="flex-1 pt-2">
                        <ScrollArea className="h-[calc(100vh-20rem)] md:h-[400px]">
                          <div className="grid grid-cols-1 gap-1 pr-4">
                            {checklistSaidaConfig.filter(i => i.categoria === 'funcional').map(item => (
                              <div key={item.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50">
                                <Checkbox
                                  id={`saida-funcional-${item.id}`}
                                  checked={parseJsonArray(currentOS.checklist_saida).includes(item.item_id)}
                                  disabled
                                />
                                <Label htmlFor={`saida-funcional-${item.id}`} className="text-sm cursor-default opacity-75 flex-1">
                                  {item.nome}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* Status do Checklist de Saída */}
                  {currentOS.checklist_saida_aprovado !== null && (
                    <Card className="border-2 border-gray-300 shadow-sm rounded-xl">
                      <CardHeader className="pb-2 pt-3">
                        <CardTitle className="text-base font-semibold">Resultado do Checklist de Saída</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-2">
                        <div className="flex items-center gap-2">
                          <Badge className={cn(
                            "text-sm",
                            currentOS.checklist_saida_aprovado 
                              ? "bg-green-600 text-white" 
                              : "bg-red-600 text-white"
                          )}>
                            {currentOS.checklist_saida_aprovado ? '✓ Aprovado' : '✗ Reprovado'}
                          </Badge>
                          {currentOS.observacoes_checklist_saida && (
                            <p className="text-sm text-muted-foreground">
                              {currentOS.observacoes_checklist_saida}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              )}
            </Tabs>
          </TabsContent>
          
          {/* Tab Resolução e Info. Técnicas (mesclado) */}
          {isEditing && (
            <TabsContent value="resolucao" className="flex-1 min-h-0 overflow-auto scrollbar-thin space-y-3 mt-2 p-2">
              {/* Card Resolução do Problema */}
              <Card className="border border-gray-200/80 shadow-sm rounded-xl">
                <CardHeader className="pb-2 pt-3 border-b border-gray-200">
                  <CardTitle className="text-sm md:text-base font-semibold">Resolução do Problema</CardTitle>
                </CardHeader>
                <CardContent className="pt-3 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="problema-constatado" className="text-sm font-medium">Problema Constatado</Label>
                      <Textarea
                        id="problema-constatado"
                        value={formData.problema_constatado || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, problema_constatado: e.target.value }))}
                        placeholder="Descreva o problema constatado após análise técnica..."
                        rows={6}
                        className="min-h-[120px]"
                      />
                      <p className="text-xs text-muted-foreground">
                        Caracteres: {(formData.problema_constatado || '').length}
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="servico-executado">Serviço Executado</Label>
                      <Textarea
                        id="servico-executado"
                        value={formData.servico_executado || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, servico_executado: e.target.value }))}
                        placeholder="Descreva o serviço executado (ex.: troca de tela, troca de bateria, conector, limpeza, atualização, etc.)"
                        rows={6}
                        className="min-h-[120px]"
                      />
                      <p className="text-xs text-muted-foreground">
                        Campo livre para digitar exatamente o serviço realizado. Caracteres: {(formData.servico_executado || '').length}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Técnico Responsável</Label>
                    <Select
                      value={formData.tecnico_id || ''}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, tecnico_id: v }))}
                    >
                      <SelectTrigger className="max-w-sm">
                        <SelectValue placeholder="Selecione o técnico" />
                      </SelectTrigger>
                      <SelectContent>
                        {isLoadingCargos ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">Carregando técnicos...</div>
                        ) : tecnicos.length > 0 ? (
                          tecnicos.map(tecnico => (
                            <SelectItem key={tecnico.id} value={tecnico.id}>
                              {tecnico.nome}
                            </SelectItem>
                          ))
                        ) : colaboradores.length > 0 ? (
                          colaboradores.map(colab => (
                            <SelectItem key={colab.id} value={colab.id}>
                              {colab.nome}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">Nenhum técnico cadastrado</div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Card Informações Técnicas Internas */}
              <Card className="border border-gray-200/80 shadow-sm rounded-xl">
                <CardHeader className="pb-2 pt-3 border-b border-gray-200">
                  <CardTitle className="text-sm md:text-base font-semibold">Informações Técnicas Internas</CardTitle>
                  <CardDescription className="text-xs">Anotações internas que não aparecem para o cliente</CardDescription>
                </CardHeader>
                <CardContent className="pt-3">
                  <Textarea
                    value={formData.observacoes_internas || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, observacoes_internas: e.target.value }))}
                    placeholder="Ex: faltando parafuso, câmera não funciona, placa oxidada, peças removidas..."
                    className="resize-none w-full min-h-[120px]"
                    rows={5}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          )}
          
          {/* Tab Fotos */}
          {isEditing && (
            <TabsContent value="fotos" className="flex-1 min-h-0 overflow-auto scrollbar-thin space-y-4 p-2">
              <Card className="border-2 border-gray-300 shadow-lg">
                <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 to-purple-50 border-b-2 border-gray-300">
                  <CardTitle className="text-base md:text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Image className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
                    Fotos da Ordem de Serviço
                  </CardTitle>
                  <CardDescription className="text-xs md:text-sm text-gray-600">
                    Fotos serão enviadas automaticamente para o Telegram
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  {/* Botões de upload por tipo */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-2 p-3 rounded-lg border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/50">
                      <Label className="text-sm font-semibold text-blue-900 flex items-center gap-2">
                        <Image className="h-4 w-4 text-blue-600" />
                        Fotos de Entrada
                      </Label>
                      <div className="flex gap-2">
                        <input
                          type="file"
                          id="upload-entrada"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={async (e) => {
                            const files = Array.from(e.target.files || []);
                            if (files.length === 0) return;
                            
                            if (!currentOS?.numero) {
                              toast({
                                title: 'Erro',
                                description: 'Salve a OS antes de adicionar fotos',
                                variant: 'destructive'
                              });
                              return;
                            }

                            const chatId = telegramChatIdEntrada || currentOS?.telegram_chat_id_entrada;
                            if (!chatId) {
                              toast({
                                title: 'Erro',
                                description: 'Configure o Chat ID de Entrada acima',
                                variant: 'destructive'
                              });
                              return;
                            }

                            toast({
                              title: 'Enviando fotos...',
                              description: `Enviando ${files.length} foto(s) de entrada para o Telegram`,
                            });

                            try {
                              const results = await sendTelegramPhotos(
                                files,
                                currentOS.numero,
                                'entrada',
                                chatId,
                                `OS-${currentOS.numero} - Fotos de Entrada`
                              );

                              const successful = results.filter(r => r.success);
                              const failed = results.filter(r => !r.success);

                              if (successful.length > 0) {
                                const newPhotos = successful.map((r, idx) => ({
                                  url: r.fileUrl || undefined,
                                  thumbnailUrl: r.thumbnailUrl || undefined, // Thumbnail como fallback
                                  postLink: r.postLink || undefined, // Link do post como fallback
                                  fileName: files[idx]?.name || `foto_${idx + 1}.jpg`,
                                  tipo: 'entrada' as const,
                                  enviadoEm: new Date().toISOString(),
                                  messageId: r.messageId,
                                  fileId: r.fileId,
                                  chatId: chatId, // Salvar chatId para poder deletar depois
                                }));
                                const updatedFotos = [
                                  ...parseJsonArray(currentOS.fotos_telegram_entrada),
                                  ...newPhotos
                                ];

                                await updateOS(currentOS.id, {
                                  fotos_telegram_entrada: updatedFotos,
                                  telegram_chat_id_entrada: chatId,
                                });
                                
                                // Recarregar OS atualizada para atualizar o preview
                                const osAtualizada = getOSById(currentOS.id);
                                if (osAtualizada) {
                                  setCurrentOS(osAtualizada);
                                }

                                if (failed.length > 0) {
                                  toast({
                                    title: 'Parcialmente enviado',
                                    description: `${successful.length} foto(s) enviada(s), ${failed.length} falharam`,
                                  });
                                } else {
                                  toast({
                                    title: '✅ Fotos enviadas!',
                                    description: `${successful.length} foto(s) de entrada enviada(s) com sucesso`,
                                  });
                                }
                              } else {
                                toast({
                                  title: 'Erro no envio',
                                  description: failed[0]?.error || 'Falha ao enviar fotos',
                                  variant: 'destructive'
                                });
                              }
                            } catch (error: any) {
                              toast({
                                title: 'Erro',
                                description: error.message || 'Erro ao enviar fotos',
                                variant: 'destructive'
                              });
                            } finally {
                              e.target.value = '';
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1 border-2 border-blue-300 hover:border-blue-500 hover:bg-blue-50 transition-all duration-200"
                          disabled={!telegramChatIdEntrada || telegramLoading}
                          onClick={() => {
                            document.getElementById('upload-entrada')?.click();
                          }}
                        >
                          <Upload className="h-4 w-4 mr-2 text-blue-600" />
                          <span className="hidden sm:inline">{telegramLoading ? 'Enviando...' : 'Adicionar Fotos'}</span>
                          <span className="sm:hidden">{telegramLoading ? '...' : 'Arquivo'}</span>
                        </Button>
                        <CameraCapture
                          onCapture={async (files) => {
                            if (files.length === 0) return;
                            
                            if (!currentOS?.numero) {
                              toast({
                                title: 'Erro',
                                description: 'Salve a OS antes de adicionar fotos',
                                variant: 'destructive'
                              });
                              return;
                            }

                            const chatId = telegramChatIdEntrada || currentOS?.telegram_chat_id_entrada;
                            if (!chatId) {
                              toast({
                                title: 'Erro',
                                description: 'Configure o Chat ID de Entrada acima',
                                variant: 'destructive'
                              });
                              return;
                            }

                            toast({
                              title: 'Enviando fotos...',
                              description: `Enviando ${files.length} foto(s) de entrada para o Telegram`,
                            });

                            try {
                              const results = await sendTelegramPhotos(
                                files,
                                currentOS.numero,
                                'entrada',
                                chatId,
                                `OS-${currentOS.numero} - Fotos de Entrada`
                              );

                              const successful = results.filter(r => r.success);
                              const failed = results.filter(r => !r.success);

                              if (successful.length > 0) {
                                const newPhotos = successful.map((r, idx) => ({
                                  url: r.fileUrl || undefined,
                                  thumbnailUrl: r.thumbnailUrl || undefined,
                                  postLink: r.postLink || undefined,
                                  fileName: files[idx]?.name || `foto_${idx + 1}.jpg`,
                                  tipo: 'entrada' as const,
                                  enviadoEm: new Date().toISOString(),
                                  messageId: r.messageId,
                                  fileId: r.fileId,
                                  chatId: chatId,
                                }));
                                const updatedFotos = [
                                  ...parseJsonArray(currentOS.fotos_telegram_entrada),
                                  ...newPhotos
                                ];

                                await updateOS(currentOS.id, {
                                  fotos_telegram_entrada: updatedFotos,
                                  telegram_chat_id_entrada: chatId,
                                });
                                
                                const osAtualizada = getOSById(currentOS.id);
                                if (osAtualizada) {
                                  setCurrentOS(osAtualizada);
                                }

                                if (failed.length > 0) {
                                  toast({
                                    title: 'Parcialmente enviado',
                                    description: `${successful.length} foto(s) enviada(s), ${failed.length} falharam`,
                                  });
                                } else {
                                  toast({
                                    title: '✅ Fotos enviadas!',
                                    description: `${successful.length} foto(s) de entrada enviada(s) com sucesso`,
                                  });
                                }
                              } else {
                                toast({
                                  title: 'Erro no envio',
                                  description: failed[0]?.error || 'Falha ao enviar fotos',
                                  variant: 'destructive'
                                });
                              }
                            } catch (error: any) {
                              toast({
                                title: 'Erro',
                                description: error.message || 'Erro ao enviar fotos',
                                variant: 'destructive'
                              });
                            }
                          }}
                          multiple={true}
                          disabled={!telegramChatIdEntrada || telegramLoading || !currentOS?.numero}
                        />
                      </div>
                      {currentOS?.fotos_telegram_entrada && currentOS.fotos_telegram_entrada.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {currentOS.fotos_telegram_entrada.length} foto(s) cadastrada(s)
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 p-3 rounded-lg border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100/50">
                      <Label className="text-sm font-semibold text-orange-900 flex items-center gap-2">
                        <Image className="h-4 w-4 text-orange-600" />
                        Fotos de Processo
                      </Label>
                      <div className="flex gap-2">
                        <input
                          type="file"
                          id="upload-processo"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={async (e) => {
                            const files = Array.from(e.target.files || []);
                            if (files.length === 0) return;
                            
                            if (!currentOS?.numero) {
                              toast({
                                title: 'Erro',
                                description: 'Salve a OS antes de adicionar fotos',
                                variant: 'destructive'
                              });
                              return;
                            }

                            const chatId = telegramChatIdProcesso || currentOS?.telegram_chat_id_processo;
                            if (!chatId) {
                              toast({
                                title: 'Erro',
                                description: 'Configure o Chat ID de Processo acima',
                                variant: 'destructive'
                              });
                              return;
                            }

                            toast({
                              title: 'Enviando fotos...',
                              description: `Enviando ${files.length} foto(s) de processo para o Telegram`,
                            });

                            try {
                              const results = await sendTelegramPhotos(
                                files,
                                currentOS.numero,
                                'processo',
                                chatId,
                                `OS-${currentOS.numero} - Fotos de Processo`
                              );

                              const successful = results.filter(r => r.success);
                              const failed = results.filter(r => !r.success);

                              if (successful.length > 0) {
                                const newPhotos = successful.map((r, idx) => ({
                                  url: r.fileUrl || undefined,
                                  thumbnailUrl: r.thumbnailUrl || undefined, // Thumbnail como fallback
                                  postLink: r.postLink || undefined, // Link do post como fallback
                                  fileName: files[idx]?.name || `foto_${idx + 1}.jpg`,
                                  tipo: 'processo' as const,
                                  enviadoEm: new Date().toISOString(),
                                  messageId: r.messageId,
                                  fileId: r.fileId,
                                  chatId: chatId, // Salvar chatId para poder deletar depois
                                }));
                                const updatedFotos = [
                                  ...parseJsonArray(currentOS.fotos_telegram_processo),
                                  ...newPhotos
                                ];

                                await updateOS(currentOS.id, {
                                  fotos_telegram_processo: updatedFotos,
                                  telegram_chat_id_processo: chatId,
                                });
                                
                                // Recarregar OS atualizada para atualizar o preview
                                const osAtualizada = getOSById(currentOS.id);
                                if (osAtualizada) {
                                  setCurrentOS(osAtualizada);
                                }
                                
                                // Logs já foram salvos no banco pelo useTelegram

                                if (failed.length > 0) {
                                  toast({
                                    title: 'Parcialmente enviado',
                                    description: `${successful.length} foto(s) enviada(s), ${failed.length} falharam`,
                                    variant: 'default'
                                  });
                                } else {
                                  toast({
                                    title: '✅ Fotos enviadas!',
                                    description: `${successful.length} foto(s) de processo enviada(s) com sucesso`,
                                    variant: 'default'
                                  });
                                }
                              } else {
                                toast({
                                  title: 'Erro no envio',
                                  description: failed[0]?.error || 'Falha ao enviar fotos',
                                  variant: 'destructive'
                                });
                              }
                            } catch (error: any) {
                              toast({
                                title: 'Erro',
                                description: error.message || 'Erro ao enviar fotos',
                                variant: 'destructive'
                              });
                            } finally {
                              e.target.value = '';
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1 border-2 border-orange-300 hover:border-orange-500 hover:bg-orange-50 transition-all duration-200"
                          disabled={!telegramChatIdProcesso || telegramLoading}
                          onClick={() => {
                            document.getElementById('upload-processo')?.click();
                          }}
                        >
                          <Upload className="h-4 w-4 mr-2 text-orange-600" />
                          <span className="hidden sm:inline">{telegramLoading ? 'Enviando...' : 'Adicionar Fotos'}</span>
                          <span className="sm:hidden">{telegramLoading ? '...' : 'Arquivo'}</span>
                        </Button>
                        <CameraCapture
                          onCapture={async (files) => {
                            if (files.length === 0) return;
                            
                            if (!currentOS?.numero) {
                              toast({
                                title: 'Erro',
                                description: 'Salve a OS antes de adicionar fotos',
                                variant: 'destructive'
                              });
                              return;
                            }

                            const chatId = telegramChatIdProcesso || currentOS?.telegram_chat_id_processo;
                            if (!chatId) {
                              toast({
                                title: 'Erro',
                                description: 'Configure o Chat ID de Processo acima',
                                variant: 'destructive'
                              });
                              return;
                            }

                            toast({
                              title: 'Enviando fotos...',
                              description: `Enviando ${files.length} foto(s) de processo para o Telegram`,
                            });

                            try {
                              const results = await sendTelegramPhotos(
                                files,
                                currentOS.numero,
                                'processo',
                                chatId,
                                `OS-${currentOS.numero} - Fotos de Processo`
                              );

                              const successful = results.filter(r => r.success);
                              const failed = results.filter(r => !r.success);

                              if (successful.length > 0) {
                                const newPhotos = successful.map((r, idx) => ({
                                  url: r.fileUrl || undefined,
                                  thumbnailUrl: r.thumbnailUrl || undefined,
                                  postLink: r.postLink || undefined,
                                  fileName: files[idx]?.name || `foto_${idx + 1}.jpg`,
                                  tipo: 'processo' as const,
                                  enviadoEm: new Date().toISOString(),
                                  messageId: r.messageId,
                                  fileId: r.fileId,
                                  chatId: chatId,
                                }));
                                const updatedFotos = [
                                  ...parseJsonArray(currentOS.fotos_telegram_processo),
                                  ...newPhotos
                                ];

                                await updateOS(currentOS.id, {
                                  fotos_telegram_processo: updatedFotos,
                                  telegram_chat_id_processo: chatId,
                                });
                                
                                const osAtualizada = getOSById(currentOS.id);
                                if (osAtualizada) {
                                  setCurrentOS(osAtualizada);
                                }

                                if (failed.length > 0) {
                                  toast({
                                    title: 'Parcialmente enviado',
                                    description: `${successful.length} foto(s) enviada(s), ${failed.length} falharam`,
                                  });
                                } else {
                                  toast({
                                    title: '✅ Fotos enviadas!',
                                    description: `${successful.length} foto(s) de processo enviada(s) com sucesso`,
                                  });
                                }
                              } else {
                                toast({
                                  title: 'Erro no envio',
                                  description: failed[0]?.error || 'Falha ao enviar fotos',
                                  variant: 'destructive'
                                });
                              }
                            } catch (error: any) {
                              toast({
                                title: 'Erro',
                                description: error.message || 'Erro ao enviar fotos',
                                variant: 'destructive'
                              });
                            }
                          }}
                          multiple={true}
                          disabled={!telegramChatIdProcesso || telegramLoading || !currentOS?.numero}
                        />
                      </div>
                      {currentOS?.fotos_telegram_processo && currentOS.fotos_telegram_processo.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {currentOS.fotos_telegram_processo.length} foto(s) cadastrada(s)
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 p-3 rounded-lg border-2 border-green-200 bg-gradient-to-br from-green-50 to-green-100/50">
                      <Label className="text-sm font-semibold text-green-900 flex items-center gap-2">
                        <Image className="h-4 w-4 text-green-600" />
                        Fotos de Saída
                      </Label>
                      <div className="flex gap-2">
                        <input
                          type="file"
                          id="upload-saida"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={async (e) => {
                            const files = Array.from(e.target.files || []);
                            if (files.length === 0) return;
                            
                            if (!currentOS?.numero) {
                              toast({
                                title: 'Erro',
                                description: 'Salve a OS antes de adicionar fotos',
                                variant: 'destructive'
                              });
                              return;
                            }

                            const chatId = telegramChatIdSaida || currentOS?.telegram_chat_id_saida;
                            if (!chatId) {
                              toast({
                                title: 'Erro',
                                description: 'Configure o Chat ID de Saída acima',
                                variant: 'destructive'
                              });
                              return;
                            }

                            toast({
                              title: 'Enviando fotos...',
                              description: `Enviando ${files.length} foto(s) de saída para o Telegram`,
                            });

                            try {
                              const results = await sendTelegramPhotos(
                                files,
                                currentOS.numero,
                                'saida',
                                chatId,
                                `OS-${currentOS.numero} - Fotos de Saída`
                              );

                              const successful = results.filter(r => r.success);
                              const failed = results.filter(r => !r.success);

                              if (successful.length > 0) {
                                const newPhotos = successful.map((r, idx) => ({
                                  url: r.fileUrl || undefined,
                                  thumbnailUrl: r.thumbnailUrl || undefined, // Thumbnail como fallback
                                  postLink: r.postLink || undefined, // Link do post como fallback
                                  fileName: files[idx]?.name || `foto_${idx + 1}.jpg`,
                                  tipo: 'saida' as const,
                                  enviadoEm: new Date().toISOString(),
                                  messageId: r.messageId,
                                  fileId: r.fileId,
                                  chatId: chatId, // Salvar chatId para poder deletar depois
                                }));
                                const updatedFotos = [
                                  ...parseJsonArray(currentOS.fotos_telegram_saida),
                                  ...newPhotos
                                ];

                                await updateOS(currentOS.id, {
                                  fotos_telegram_saida: updatedFotos,
                                  telegram_chat_id_saida: chatId,
                                });
                                
                                // Recarregar OS atualizada para atualizar o preview
                                const osAtualizada = getOSById(currentOS.id);
                                if (osAtualizada) {
                                  setCurrentOS(osAtualizada);
                                }
                                
                                // Logs já foram salvos no banco pelo useTelegram

                                if (failed.length > 0) {
                                  toast({
                                    title: 'Parcialmente enviado',
                                    description: `${successful.length} foto(s) enviada(s), ${failed.length} falharam`,
                                  });
                                } else {
                                  toast({
                                    title: '✅ Fotos enviadas!',
                                    description: `${successful.length} foto(s) de saída enviada(s) com sucesso`,
                                  });
                                }
                              } else {
                                toast({
                                  title: 'Erro no envio',
                                  description: failed[0]?.error || 'Falha ao enviar fotos',
                                  variant: 'destructive'
                                });
                              }
                            } catch (error: any) {
                              toast({
                                title: 'Erro',
                                description: error.message || 'Erro ao enviar fotos',
                                variant: 'destructive'
                              });
                            } finally {
                              e.target.value = '';
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1 border-2 border-green-300 hover:border-green-500 hover:bg-green-50 transition-all duration-200"
                          disabled={!telegramChatIdSaida || telegramLoading}
                          onClick={() => {
                            document.getElementById('upload-saida')?.click();
                          }}
                        >
                          <Upload className="h-4 w-4 mr-2 text-green-600" />
                          <span className="hidden sm:inline">{telegramLoading ? 'Enviando...' : 'Adicionar Fotos'}</span>
                          <span className="sm:hidden">{telegramLoading ? '...' : 'Arquivo'}</span>
                        </Button>
                        <CameraCapture
                          onCapture={async (files) => {
                            if (files.length === 0) return;
                            
                            if (!currentOS?.numero) {
                              toast({
                                title: 'Erro',
                                description: 'Salve a OS antes de adicionar fotos',
                                variant: 'destructive'
                              });
                              return;
                            }

                            const chatId = telegramChatIdSaida || currentOS?.telegram_chat_id_saida;
                            if (!chatId) {
                              toast({
                                title: 'Erro',
                                description: 'Configure o Chat ID de Saída acima',
                                variant: 'destructive'
                              });
                              return;
                            }

                            toast({
                              title: 'Enviando fotos...',
                              description: `Enviando ${files.length} foto(s) de saída para o Telegram`,
                            });

                            try {
                              const results = await sendTelegramPhotos(
                                files,
                                currentOS.numero,
                                'saida',
                                chatId,
                                `OS-${currentOS.numero} - Fotos de Saída`
                              );

                              const successful = results.filter(r => r.success);
                              const failed = results.filter(r => !r.success);

                              if (successful.length > 0) {
                                const newPhotos = successful.map((r, idx) => ({
                                  url: r.fileUrl || undefined,
                                  thumbnailUrl: r.thumbnailUrl || undefined,
                                  postLink: r.postLink || undefined,
                                  fileName: files[idx]?.name || `foto_${idx + 1}.jpg`,
                                  tipo: 'saida' as const,
                                  enviadoEm: new Date().toISOString(),
                                  messageId: r.messageId,
                                  fileId: r.fileId,
                                  chatId: chatId,
                                }));
                                const updatedFotos = [
                                  ...parseJsonArray(currentOS.fotos_telegram_saida),
                                  ...newPhotos
                                ];

                                await updateOS(currentOS.id, {
                                  fotos_telegram_saida: updatedFotos,
                                  telegram_chat_id_saida: chatId,
                                });
                                
                                const osAtualizada = getOSById(currentOS.id);
                                if (osAtualizada) {
                                  setCurrentOS(osAtualizada);
                                }

                                if (failed.length > 0) {
                                  toast({
                                    title: 'Parcialmente enviado',
                                    description: `${successful.length} foto(s) enviada(s), ${failed.length} falharam`,
                                  });
                                } else {
                                  toast({
                                    title: '✅ Fotos enviadas!',
                                    description: `${successful.length} foto(s) de saída enviada(s) com sucesso`,
                                  });
                                }
                              } else {
                                toast({
                                  title: 'Erro no envio',
                                  description: failed[0]?.error || 'Falha ao enviar fotos',
                                  variant: 'destructive'
                                });
                              }
                            } catch (error: any) {
                              toast({
                                title: 'Erro',
                                description: error.message || 'Erro ao enviar fotos',
                                variant: 'destructive'
                              });
                            }
                          }}
                          multiple={true}
                          disabled={!telegramChatIdSaida || telegramLoading || !currentOS?.numero}
                        />
                      </div>
                      {currentOS?.fotos_telegram_saida && currentOS.fotos_telegram_saida.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {currentOS.fotos_telegram_saida.length} foto(s) cadastrada(s)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Resumo de Fotos com Badges */}
                  {(currentOS?.fotos_telegram_entrada?.length || 0) > 0 ||
                   (currentOS?.fotos_telegram_processo?.length || 0) > 0 ||
                   (currentOS?.fotos_telegram_saida?.length || 0) > 0 ? (
                    <div className="flex items-center gap-3 mb-4 p-4 bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 rounded-lg border-2 border-gray-200 shadow-md">
                      <Image className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
                      <span className="text-sm md:text-base font-semibold text-gray-800">Fotos:</span>
                      {currentOS?.fotos_telegram_entrada?.length > 0 && (
                        <Badge variant="outline" className="gap-1 border-2 border-blue-300 bg-blue-100 text-blue-900 font-semibold hover:bg-blue-200 transition-colors">
                          <Image className="h-3 w-3" />
                          Entrada: {currentOS.fotos_telegram_entrada.length}
                        </Badge>
                      )}
                      {currentOS?.fotos_telegram_processo?.length > 0 && (
                        <Badge variant="outline" className="gap-1 border-2 border-orange-300 bg-orange-100 text-orange-900 font-semibold hover:bg-orange-200 transition-colors">
                          <Image className="h-3 w-3" />
                          Processo: {currentOS.fotos_telegram_processo.length}
                        </Badge>
                      )}
                      {currentOS?.fotos_telegram_saida?.length > 0 && (
                        <Badge variant="outline" className="gap-1 border-2 border-green-300 bg-green-100 text-green-900 font-semibold hover:bg-green-200 transition-colors">
                          <Image className="h-3 w-3" />
                          Saída: {currentOS.fotos_telegram_saida.length}
                        </Badge>
                      )}
                    </div>
                  ) : null}

                  {/* Galeria de fotos com preview */}
                  {(currentOS?.fotos_telegram_entrada && currentOS.fotos_telegram_entrada.length > 0) ||
                   (currentOS?.fotos_telegram_processo && currentOS.fotos_telegram_processo.length > 0) ||
                   (currentOS?.fotos_telegram_saida && currentOS.fotos_telegram_saida.length > 0) ? (
                    <div className="space-y-4">
                      {currentOS?.fotos_telegram_entrada && currentOS.fotos_telegram_entrada.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                            <Image className="h-4 w-4" />
                            Fotos de Entrada
                            <Badge variant="secondary" className="ml-1">
                              {currentOS.fotos_telegram_entrada.length}
                            </Badge>
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {[...currentOS.fotos_telegram_entrada]
                              .sort((a, b) => {
                                const aData = typeof a === 'string' ? new Date(0) : (a.enviadoEm ? new Date(a.enviadoEm) : new Date(0));
                                const bData = typeof b === 'string' ? new Date(0) : (b.enviadoEm ? new Date(b.enviadoEm) : new Date(0));
                                return bData.getTime() - aData.getTime(); // Mais recente primeiro
                              })
                              .map((foto, index) => {
                              const fotoData = typeof foto === 'string' 
                                ? { url: foto, fileName: `foto_${index + 1}.jpg`, tipo: 'entrada' as const } 
                                : foto;
                              // Prioridade: url > thumbnailUrl
                              // Se não tiver nenhum, tentar usar postLink como fallback (pode ter thumbnail embutido)
                              const imageUrl = fotoData.url || fotoData.thumbnailUrl;
                              const hasImage = !!(fotoData.url || fotoData.thumbnailUrl);
                              const hasPostLink = !!fotoData.postLink;
                              // Se não tiver imagem mas tiver postLink, mostrar link
                              const chatId = fotoData.chatId || currentOS.telegram_chat_id_entrada;
                              
                              const handleDelete = async (e: React.MouseEvent) => {
                                e.stopPropagation();
                                if (!fotoData.messageId || !chatId) {
                                  toast({
                                    title: 'Erro',
                                    description: 'Não é possível deletar: dados da mensagem não encontrados',
                                    variant: 'destructive',
                                  });
                                  return;
                                }
                                
                                if (!confirm('Tem certeza que deseja deletar esta foto do Telegram?')) {
                                  return;
                                }
                                
                                const result = await deleteTelegramMessage(chatId, fotoData.messageId);
                                if (result.success) {
                                  // Remover foto da lista
                                  const updatedFotos = parseJsonArray(currentOS.fotos_telegram_entrada).filter((_, i) => i !== index);
                                  await updateOS(currentOS.id, {
                                    fotos_telegram_entrada: updatedFotos,
                                  });
                                  const osAtualizada = getOSById(currentOS.id);
                                  if (osAtualizada) {
                                    setCurrentOS(osAtualizada);
                                  }
                                }
                              };
                              
                              return (
                                <div key={index} className="relative aspect-square rounded-lg overflow-hidden border group cursor-pointer hover:border-primary transition-colors bg-muted">
                                  {hasImage && imageUrl ? (
                                    <>
                                      <img 
                                        src={imageUrl} 
                                        alt={fotoData.fileName || `Entrada ${index + 1}`}
                                        className="w-full h-full object-cover"
                                        onClick={() => {
                                          if (fotoData.postLink) {
                                            window.open(fotoData.postLink, '_blank');
                                          } else if (imageUrl) {
                                            window.open(imageUrl, '_blank');
                                          }
                                        }}
                                        onError={(e) => {
                                          // Se a imagem falhar, esconder e mostrar fallback
                                          const img = e.target as HTMLImageElement;
                                          img.style.display = 'none';
                                          // Mostrar fallback
                                          const parent = img.parentElement;
                                          if (parent) {
                                            const fallback = parent.querySelector('.image-fallback') as HTMLElement;
                                            if (fallback) {
                                              fallback.style.display = 'flex';
                                            }
                                          }
                                        }}
                                      />
                                      <div className="absolute inset-0 pointer-events-none bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                        <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-medium">
                                          {fotoData.postLink ? 'Clique para ver no Telegram' : 'Clique para ampliar'}
                                        </span>
                                      </div>
                                      {/* Fallback escondido inicialmente */}
                                      <div className="image-fallback hidden w-full h-full flex-col items-center justify-center p-2 text-center absolute inset-0 bg-muted">
                                        <Image className="h-8 w-8 text-muted-foreground mb-1" />
                                        <p className="text-xs font-medium truncate w-full">{fotoData.fileName}</p>
                                        <p className="text-xs text-muted-foreground">Enviada para Telegram</p>
                                        {fotoData.postLink && (
                                          <a 
                                            href={fotoData.postLink} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-xs text-primary hover:underline mt-1"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            Ver no Telegram
                                          </a>
                                        )}
                                      </div>
                                    </>
                                  ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
                                      <Image className="h-8 w-8 text-muted-foreground mb-1" />
                                      <p className="text-xs font-medium truncate w-full">{fotoData.fileName}</p>
                                      <p className="text-xs text-muted-foreground">Enviada para Telegram</p>
                                      {fotoData.enviadoEm && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                          {new Date(fotoData.enviadoEm).toLocaleString('pt-BR', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })}
                                        </p>
                                      )}
                                      {fotoData.postLink && (
                                        <a 
                                          href={fotoData.postLink} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-xs text-primary hover:underline mt-1"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          Ver no Telegram
                                        </a>
                                      )}
                                    </div>
                                  )}
                                  <div className="absolute top-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                                    {fotoData.tipo}
                                  </div>
                                  {fotoData.messageId && chatId && (
                                    <button
                                      onClick={handleDelete}
                                      className="absolute top-1 left-1 bg-destructive/80 hover:bg-destructive text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                      title="Deletar foto do Telegram"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {currentOS?.fotos_telegram_processo && currentOS.fotos_telegram_processo.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                            <Image className="h-4 w-4" />
                            Fotos de Processo
                            <Badge variant="secondary" className="ml-1">
                              {currentOS.fotos_telegram_processo.length}
                            </Badge>
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {currentOS.fotos_telegram_processo.map((foto, index) => {
                              const fotoData = typeof foto === 'string' 
                                ? { url: foto, fileName: `foto_${index + 1}.jpg`, tipo: 'processo' as const } 
                                : foto;
                              const imageUrl = fotoData.url || fotoData.thumbnailUrl;
                              const hasImage = !!(fotoData.url || fotoData.thumbnailUrl);
                              const hasPostLink = !!fotoData.postLink;
                              const chatId = fotoData.chatId || currentOS.telegram_chat_id_processo;
                              
                              const handleDelete = async (e: React.MouseEvent) => {
                                e.stopPropagation();
                                if (!fotoData.messageId || !chatId) {
                                  toast({
                                    title: 'Erro',
                                    description: 'Não é possível deletar: dados da mensagem não encontrados',
                                    variant: 'destructive',
                                  });
                                  return;
                                }
                                
                                if (!confirm('Tem certeza que deseja deletar esta foto do Telegram?')) {
                                  return;
                                }
                                
                                const result = await deleteTelegramMessage(chatId, fotoData.messageId);
                                if (result.success) {
                                  const updatedFotos = parseJsonArray(currentOS.fotos_telegram_processo).filter((_, i) => i !== index);
                                  await updateOS(currentOS.id, {
                                    fotos_telegram_processo: updatedFotos,
                                  });
                                  const osAtualizada = getOSById(currentOS.id);
                                  if (osAtualizada) {
                                    setCurrentOS(osAtualizada);
                                  }
                                }
                              };
                              
                              return (
                                <div key={index} className="relative aspect-square rounded-lg overflow-hidden border group cursor-pointer hover:border-primary transition-colors bg-muted">
                                  {hasImage && imageUrl ? (
                                    <>
                                      <img 
                                        src={imageUrl} 
                                        alt={fotoData.fileName || `Processo ${index + 1}`}
                                        className="w-full h-full object-cover"
                                        onClick={() => {
                                          if (fotoData.postLink) {
                                            window.open(fotoData.postLink, '_blank');
                                          } else if (imageUrl) {
                                            window.open(imageUrl, '_blank');
                                          }
                                        }}
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                      />
                                      <div className="absolute inset-0 pointer-events-none bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                        <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-medium">
                                          {fotoData.postLink ? 'Clique para ver no Telegram' : 'Clique para ampliar'}
                                        </span>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
                                      {fotoData.thumbnailUrl ? (
                                        <img 
                                          src={fotoData.thumbnailUrl} 
                                          alt={fotoData.fileName || `Processo ${index + 1}`}
                                          className="w-full h-full object-cover"
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                          }}
                                        />
                                      ) : (
                                        <Image className="h-8 w-8 text-muted-foreground mb-1" />
                                      )}
                                      <p className="text-xs font-medium truncate w-full">{fotoData.fileName}</p>
                                      <p className="text-xs text-muted-foreground">Enviada para Telegram</p>
                                      {fotoData.enviadoEm && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                          {new Date(fotoData.enviadoEm).toLocaleString('pt-BR', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })}
                                        </p>
                                      )}
                                      {fotoData.postLink && (
                                        <a 
                                          href={fotoData.postLink} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-xs text-primary hover:underline mt-1"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          Ver no Telegram
                                        </a>
                                      )}
                                    </div>
                                  )}
                                  <div className="absolute top-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                                    {fotoData.tipo}
                                  </div>
                                  {fotoData.messageId && chatId && (
                                    <button
                                      onClick={handleDelete}
                                      className="absolute top-1 left-1 bg-destructive/80 hover:bg-destructive text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                      title="Deletar foto do Telegram"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {currentOS?.fotos_telegram_saida && currentOS.fotos_telegram_saida.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                            <Image className="h-4 w-4" />
                            Fotos de Saída
                            <Badge variant="secondary" className="ml-1">
                              {currentOS.fotos_telegram_saida.length}
                            </Badge>
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {currentOS.fotos_telegram_saida.map((foto, index) => {
                              const fotoData = typeof foto === 'string' 
                                ? { url: foto, fileName: `foto_${index + 1}.jpg`, tipo: 'saida' as const } 
                                : foto;
                              const imageUrl = fotoData.url || fotoData.thumbnailUrl;
                              const hasImage = !!(fotoData.url || fotoData.thumbnailUrl);
                              const hasPostLink = !!fotoData.postLink;
                              const chatId = fotoData.chatId || currentOS.telegram_chat_id_saida;
                              
                              const handleDelete = async (e: React.MouseEvent) => {
                                e.stopPropagation();
                                if (!fotoData.messageId || !chatId) {
                                  toast({
                                    title: 'Erro',
                                    description: 'Não é possível deletar: dados da mensagem não encontrados',
                                    variant: 'destructive',
                                  });
                                  return;
                                }
                                
                                if (!confirm('Tem certeza que deseja deletar esta foto do Telegram?')) {
                                  return;
                                }
                                
                                const result = await deleteTelegramMessage(chatId, fotoData.messageId);
                                if (result.success) {
                                  const updatedFotos = parseJsonArray(currentOS.fotos_telegram_saida).filter((_, i) => i !== index);
                                  await updateOS(currentOS.id, {
                                    fotos_telegram_saida: updatedFotos,
                                  });
                                  const osAtualizada = getOSById(currentOS.id);
                                  if (osAtualizada) {
                                    setCurrentOS(osAtualizada);
                                  }
                                }
                              };
                              
                              return (
                                <div key={index} className="relative aspect-square rounded-lg overflow-hidden border group cursor-pointer hover:border-primary transition-colors bg-muted">
                                  {hasImage && imageUrl ? (
                                    <>
                                      <img 
                                        src={imageUrl} 
                                        alt={fotoData.fileName || `Saída ${index + 1}`}
                                        className="w-full h-full object-cover"
                                        onClick={() => {
                                          if (fotoData.postLink) {
                                            window.open(fotoData.postLink, '_blank');
                                          } else if (imageUrl) {
                                            window.open(imageUrl, '_blank');
                                          }
                                        }}
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                      />
                                      <div className="absolute inset-0 pointer-events-none bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                        <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-medium">
                                          {fotoData.postLink ? 'Clique para ver no Telegram' : 'Clique para ampliar'}
                                        </span>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
                                      {fotoData.thumbnailUrl ? (
                                        <img 
                                          src={fotoData.thumbnailUrl} 
                                          alt={fotoData.fileName || `Saída ${index + 1}`}
                                          className="w-full h-full object-cover"
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                          }}
                                        />
                                      ) : (
                                        <Image className="h-8 w-8 text-muted-foreground mb-1" />
                                      )}
                                      <p className="text-xs font-medium truncate w-full">{fotoData.fileName}</p>
                                      <p className="text-xs text-muted-foreground">Enviada para Telegram</p>
                                      {fotoData.enviadoEm && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                          {new Date(fotoData.enviadoEm).toLocaleString('pt-BR', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })}
                                        </p>
                                      )}
                                      {fotoData.postLink && (
                                        <a 
                                          href={fotoData.postLink} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-xs text-primary hover:underline mt-1"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          Ver no Telegram
                                        </a>
                                      )}
                                    </div>
                                  )}
                                  <div className="absolute top-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                                    {fotoData.tipo}
                                  </div>
                                  {fotoData.messageId && chatId && (
                                    <button
                                      onClick={handleDelete}
                                      className="absolute top-1 left-1 bg-destructive/80 hover:bg-destructive text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                      title="Deletar foto do Telegram"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Image className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-base font-medium mb-2">Nenhuma foto cadastrada ainda</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Adicione fotos de entrada, processo ou saída para documentar a OS
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Configure os Chat IDs do Telegram acima para enviar fotos automaticamente
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Tab Logs */}
          {isEditing && id && (
            <TabsContent value="logs" className="flex-1 min-h-0 overflow-auto scrollbar-thin space-y-4 p-2">
              <OSMovimentacoesTab osId={id} />
            </TabsContent>
          )}

          {/* Tab Itens (Peças/Serviços) */}
          {isEditing && (
            <TabsContent value="itens" className="flex-1 min-h-0 overflow-auto scrollbar-thin space-y-2 mt-2 p-2">
              <Card className="border-2">
                <CardHeader className="pb-2 pt-3 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Peças e Serviços</CardTitle>
                    <Button onClick={() => {
                      setEditingItem(null);
                      setItemForm({ tipo: 'servico', produto_id: undefined, descricao: '', quantidade: 1, valor_unitario: 0, valor_minimo: 0, desconto: 0, garantia: 90, colaborador_id: user?.id || '', fornecedor_id: '', fornecedor_nome: '', com_aro: '', grade_cor: '' });
                      setShowAddItem(true);
                    }} size="sm" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Adicionar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-2 flex-1 flex flex-col min-h-0">
                  {itens.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Package className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-base font-medium mb-2">Nenhum item adicionado ainda</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Adicione peças ou serviços para compor o orçamento da OS
                      </p>
                      <Button 
                        onClick={() => {
                          setEditingItem(null);
                          setItemForm({ tipo: 'servico', produto_id: undefined, descricao: '', quantidade: 1, valor_unitario: 0, valor_minimo: 0, desconto: 0, garantia: 90, colaborador_id: user?.id || '', fornecedor_id: '', fornecedor_nome: '', com_aro: '', grade_cor: '' });
                          setShowAddItem(true);
                        }}
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Adicionar Primeiro Item
                      </Button>
                    </div>
                  ) : (
                    <ScrollArea className="flex-1">
                      <div className="w-full overflow-x-auto">
                        <div className="min-w-[900px]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Tipo</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead className="text-right">Qtd</TableHead>
                            <TableHead className="text-right">Valor Unit.</TableHead>
                            <TableHead className="text-right">Valor Mín.</TableHead>
                            <TableHead className="text-right">Desconto</TableHead>
                            <TableHead className="text-right">Garantia</TableHead>
                            <TableHead title="Controle interno (não sai no cupom)">Fornecedor</TableHead>
                            <TableHead title="Controle interno (não sai no cupom)">Com aro</TableHead>
                            <TableHead title="Cor da grade (quando produto tem grade por cor)">Cor</TableHead>
                            <TableHead>Colaborador</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {itens.map(item => (
                            <TableRow key={item.id}>
                              <TableCell>
                                <Badge variant="outline">
                                  {item.tipo === 'peca' ? 'Peça' : item.tipo === 'servico' ? 'Serviço' : 'M.O.'}
                                </Badge>
                              </TableCell>
                              <TableCell>{item.descricao}</TableCell>
                              <TableCell className="text-right">{item.quantidade}</TableCell>
                              <TableCell className="text-right">{currencyFormatters.brl(item.valor_unitario)}</TableCell>
                              <TableCell className="text-right">{currencyFormatters.brl(item.valor_minimo || 0)}</TableCell>
                              <TableCell className="text-right">{currencyFormatters.brl(item.desconto)}</TableCell>
                              <TableCell className="text-right">{item.garantia ? `${item.garantia} dias` : '-'}</TableCell>
                              <TableCell className="text-muted-foreground text-xs" title="Controle interno (não sai no cupom)">
                                {item.tipo === 'peca' ? (item.fornecedor_nome || '-') : '-'}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-xs" title="Controle interno (não sai no cupom)">
                                {item.tipo === 'peca' ? ((item as any).com_aro === 'com_aro' ? 'Com aro' : (item as any).com_aro === 'sem_aro' ? 'Sem aro' : '-') : '-'}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-xs" title="Cor da grade">
                                {(item as any).grade_cor || '-'}
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  // Se tem colaborador_id mas não tem nome, tentar buscar
                                  if (item.colaborador_id && !item.colaborador_nome) {
                                    const colab = getColaboradorById(item.colaborador_id);
                                    if (colab) {
                                      // Atualizar o item com o nome encontrado
                                      updateItem(item.id, { colaborador_nome: colab.nome });
                                      return colab.nome;
                                    }
                                  }
                                  return item.colaborador_nome || '-';
                                })()}
                              </TableCell>
                              <TableCell className="text-right font-semibold">{currencyFormatters.brl(item.valor_total)}</TableCell>
                              <TableCell>
                                <div className="flex justify-end gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditItem(item)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveItem(item.id)} disabled={isRemovingItem || removingItemId === item.id} title="Remover item">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                        </div>
                      </div>
                    </ScrollArea>
                  )}
                  
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg flex justify-between items-center">
                    <span className="font-medium">Total:</span>
                    <span className="text-2xl font-bold">{currencyFormatters.brl(total)}</span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Tab Financeiro */}
          {isEditing && (
            <TabsContent value="financeiro" className="flex-1 min-h-0 overflow-auto scrollbar-thin space-y-2 mt-2 p-2">

              {/* Saldo Pendente em Destaque — usa totais da API (pagamentos rastreáveis) */}
              {total - totalPagoAPI > 0 && (
                <Card className="border-2 border-orange-500 bg-orange-50/50">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="h-6 w-6 text-orange-600" />
                        <div>
                          <p className="text-sm font-medium text-orange-900">Saldo Pendente</p>
                          <p className="text-2xl font-bold text-orange-600">
                            {currencyFormatters.brl(total - totalPagoAPI)}
                          </p>
                        </div>
                      </div>
                      <Button 
                        onClick={() => setShowPagamentoOSDialog(true)}
                        className="bg-orange-600 hover:bg-orange-700 text-white gap-2"
                        size="lg"
                      >
                        <Plus className="h-4 w-4" />
                        Registrar Pagamento
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 px-2 flex-shrink-0">
                <Card className="m-2">
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Valor Total</p>
                    <p className="text-3xl font-bold">{currencyFormatters.brl(total)}</p>
                  </CardContent>
                </Card>
                <Card className="m-2">
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Valor Pago</p>
                    <p className="text-3xl font-bold text-green-600">{currencyFormatters.brl(totalPagoAPI)}</p>
                  </CardContent>
                </Card>
                <Card className="m-2">
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Saldo Restante</p>
                    <p className={cn("text-3xl font-bold", total - totalPagoAPI > 0 ? "text-orange-600" : "text-green-600")}>
                      {currencyFormatters.brl(total - totalPagoAPI)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card className="m-2 flex flex-col flex-1 min-h-0">
                <CardHeader className="pb-2 pt-3 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Pagamentos (documentos rastreáveis, somam no caixa)</CardTitle>
                    <Button 
                      onClick={() => setShowPagamentoOSDialog(true)}
                      size="sm"
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Adicionar Pagamento
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-2 flex-1 flex flex-col min-h-0">
                  {isLoadingPagamentosAPI ? (
                    <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando pagamentos...</div>
                  ) : pagamentosAPI.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-base font-medium mb-2">Nenhum pagamento registrado</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Registre o primeiro pagamento para começar a controlar o financeiro desta OS. Cada pagamento gera uma venda e soma no caixa.
                      </p>
                      <Button 
                        onClick={() => setShowPagamentoOSDialog(true)}
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Registrar Primeiro Pagamento
                      </Button>
                    </div>
                  ) : (
                    <ScrollArea className="flex-1">
                      <div className="w-full overflow-x-auto">
                        <div className="min-w-[900px]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Data</TableHead>
                                <TableHead>Hora</TableHead>
                                <TableHead>Registrado por</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Forma de Pagamento</TableHead>
                                <TableHead className="text-right">Valor</TableHead>
                                <TableHead>Venda</TableHead>
                                {isAdmin && <TableHead className="w-[80px]">Ações</TableHead>}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {pagamentosAPI.map(pag => {
                                const getPaymentIcon = (forma: string) => {
                                  const formaLower = forma?.toLowerCase() || '';
                                  if (formaLower.includes('pix')) return <QrCode className="h-4 w-4" />;
                                  if (formaLower.includes('dinheiro') || formaLower.includes('cash')) return <Banknote className="h-4 w-4" />;
                                  if (formaLower.includes('cartão') || formaLower.includes('cartao') || formaLower.includes('card')) return <CreditCard className="h-4 w-4" />;
                                  return <Wallet className="h-4 w-4" />;
                                };
                                const createdDate = pag.sale_created_at || pag.created_at;
                                const dataStr = createdDate ? dateFormatters.short(createdDate) : '-';
                                const horaStr = createdDate ? format(new Date(createdDate), 'HH:mm') : '-';
                                return (
                                  <TableRow key={pag.id}>
                                    <TableCell>{dataStr}</TableCell>
                                    <TableCell>{horaStr}</TableCell>
                                    <TableCell className="text-muted-foreground">{pag.vendedor_nome || '-'}</TableCell>
                                    <TableCell>
                                      <Badge variant="outline">
                                        {pag.tipo === 'adiantamento' ? 'Adiantamento' : 'Pagamento Final'}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        {getPaymentIcon(pag.forma_pagamento)}
                                        <span>{PAYMENT_METHOD_LABELS[pag.forma_pagamento as keyof typeof PAYMENT_METHOD_LABELS] ?? pag.forma_pagamento}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right font-semibold">{currencyFormatters.brl(pag.valor)}</TableCell>
                                    <TableCell>
                                      {pag.sale_id && pag.sale_numero != null ? (
                                        <Link to={`/pdv/vendas?highlight=${pag.sale_id}`} className="text-primary font-medium hover:underline">
                                          Venda #{pag.sale_numero}
                                        </Link>
                                      ) : (
                                        <span className="text-muted-foreground">-</span>
                                      )}
                                    </TableCell>
                                    {isAdmin && (
                                      <TableCell>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                          onClick={() => setPagamentoToCancel(pag)}
                                          disabled={isCancellingPagamento}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </TableCell>
                                    )}
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Rodapé único - tabs (ícone + nome no mobile) e ações */}
          <div className="flex-shrink-0 z-20 bg-white dark:bg-background border-t border-gray-200 dark:border-gray-800 pb-20 sm:pb-1">
            <div className="overflow-x-auto scrollbar-none px-2 py-2 sm:px-2 sm:py-2 touch-pan-x">
              <div className="flex items-center justify-start sm:justify-center gap-1.5 min-w-max">
                {/* Tabs — mobile: ícone + nome sempre visíveis e área de toque confortável */}
                <TabsList className="inline-flex bg-muted/60 h-auto min-h-[44px] sm:min-h-0 sm:h-8 p-1 sm:p-0.5 gap-0.5 sm:gap-0 rounded-lg sm:rounded-md">
                  <TabsTrigger 
                    value="dados" 
                    className="gap-1.5 sm:gap-0.5 px-3 min-h-[40px] sm:h-7 rounded-md touch-manipulation data-[state=active]:bg-[hsl(var(--sidebar-primary))] data-[state=active]:text-white font-medium text-xs whitespace-nowrap"
                  >
                    <FileText className="h-4 w-4 sm:h-3.5 sm:w-3.5 shrink-0" />
                    <span>Dados</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="checklist" 
                    className="gap-1.5 sm:gap-0.5 px-3 min-h-[40px] sm:h-7 rounded-md touch-manipulation data-[state=active]:bg-[hsl(var(--sidebar-primary))] data-[state=active]:text-white font-medium text-xs whitespace-nowrap"
                  >
                    <Check className="h-4 w-4 sm:h-3.5 sm:w-3.5 shrink-0" />
                    <span>Checklist</span>
                  </TabsTrigger>
                  {isEditing && (
                    <>
                      <TabsTrigger 
                        value="resolucao" 
                        className="gap-1.5 sm:gap-0.5 px-3 min-h-[40px] sm:h-7 rounded-md touch-manipulation data-[state=active]:bg-[hsl(var(--sidebar-primary))] data-[state=active]:text-white font-medium text-xs whitespace-nowrap"
                      >
                        <AlertTriangle className="h-4 w-4 sm:h-3.5 sm:w-3.5 shrink-0" />
                        <span>Resolução</span>
                      </TabsTrigger>
                      <TabsTrigger 
                        value="itens" 
                        className="gap-1.5 sm:gap-0.5 px-3 min-h-[40px] sm:h-7 rounded-md touch-manipulation data-[state=active]:bg-[hsl(var(--sidebar-primary))] data-[state=active]:text-white font-medium text-xs whitespace-nowrap"
                      >
                        <Package className="h-4 w-4 sm:h-3.5 sm:w-3.5 shrink-0" />
                        <span>Peças</span>
                      </TabsTrigger>
                      <TabsTrigger 
                        value="financeiro" 
                        className="gap-1.5 sm:gap-0.5 px-3 min-h-[40px] sm:h-7 rounded-md touch-manipulation data-[state=active]:bg-[hsl(var(--sidebar-primary))] data-[state=active]:text-white font-medium text-xs whitespace-nowrap"
                      >
                        <DollarSign className="h-4 w-4 sm:h-3.5 sm:w-3.5 shrink-0" />
                        <span>Financeiro</span>
                      </TabsTrigger>
                      <TabsTrigger 
                        value="fotos" 
                        className="gap-1.5 sm:gap-0.5 px-3 min-h-[40px] sm:h-7 rounded-md touch-manipulation data-[state=active]:bg-[hsl(var(--sidebar-primary))] data-[state=active]:text-white font-medium text-xs whitespace-nowrap"
                      >
                        <Image className="h-4 w-4 sm:h-3.5 sm:w-3.5 shrink-0" />
                        <span>Fotos</span>
                      </TabsTrigger>
                      <TabsTrigger 
                        value="logs" 
                        className="gap-1.5 sm:gap-0.5 px-3 min-h-[40px] sm:h-7 rounded-md touch-manipulation data-[state=active]:bg-[hsl(var(--sidebar-primary))] data-[state=active]:text-white font-medium text-xs whitespace-nowrap"
                      >
                        <History className="h-4 w-4 sm:h-3.5 sm:w-3.5 shrink-0" />
                        <span>Logs</span>
                      </TabsTrigger>
                    </>
                  )}
                </TabsList>

                {/* Separador */}
                <div className="w-px h-6 sm:h-6 bg-gray-300 dark:bg-gray-600 mx-1 shrink-0" />

                {/* Ações — mobile: toque confortável */}
                {isEditing && currentOS && (
                  <>
                    <Select value={currentOS.status} onValueChange={handleChangeStatus}>
                      <SelectTrigger className={cn('w-auto min-w-[90px] min-h-[44px] sm:min-h-0 sm:h-8 text-white border-0 rounded-lg sm:rounded text-xs px-3 sm:px-2 touch-manipulation shrink-0', (() => {
                        const config = getConfigByStatus(currentOS.status);
                        return config?.cor || STATUS_OS_COLORS[currentOS.status as StatusOS] || 'bg-gray-500';
                      })())}>
                        <SelectValue placeholder="Status">
                          {(() => {
                            const config = getConfigByStatus(currentOS.status);
                            return config?.label || STATUS_OS_LABELS[currentOS.status as StatusOS] || currentOS.status;
                          })()}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {configuracoes
                          .filter(c => c.ativo)
                          .sort((a, b) => a.ordem - b.ordem)
                          .map((config) => (
                            <SelectItem key={config.status} value={config.status}>
                              {config.label}
                            </SelectItem>
                          ))}
                        {Object.entries(STATUS_OS_LABELS)
                          .filter(([value]) => !configuracoes.some(c => c.status === value))
                          .map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleWhatsApp()}
                      disabled={whatsappLoading}
                      className="min-h-[44px] sm:h-8 rounded-lg sm:rounded flex items-center gap-1.5 px-3 text-green-600 border-green-200 hover:bg-green-50 touch-manipulation shrink-0"
                      title="WhatsApp"
                    >
                      <span className="inline-flex h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 items-center justify-center">
                        <img src="/whatsapp-logo.png" alt="" className="h-full w-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; (e.currentTarget.nextElementSibling as HTMLElement)?.classList.remove('hidden'); }} />
                        <span className="hidden" aria-hidden><MessageCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></span>
                      </span>
                      <span className="text-xs font-medium whitespace-nowrap">WhatsApp</span>
                    </Button>
                    
                    <Select onValueChange={(v) => handlePrint(v as 'termica' | 'a4' | 'pdf')}>
                      <SelectTrigger className="w-auto min-h-[44px] sm:h-8 rounded-lg sm:rounded text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-foreground bg-white dark:bg-background px-3 touch-manipulation shrink-0">
                        <Printer className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                        <span className="ml-1 whitespace-nowrap">Imprimir</span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="termica">Térmica</SelectItem>
                        <SelectItem value="a4">A4</SelectItem>
                        <SelectItem value="pdf">Salvar PDF</SelectItem>
                      </SelectContent>
                    </Select>
                  </>
                )}

                <LoadingButton onClick={handleSubmit} loading={isLoading} size="sm" className="rounded-lg sm:rounded min-h-[44px] sm:h-8 px-4 bg-[hsl(var(--sidebar-primary))] hover:bg-[hsl(var(--sidebar-primary))]/90 text-xs sm:text-sm touch-manipulation shrink-0">
                  <Save className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 shrink-0" />
                  <span>Salvar</span>
                </LoadingButton>
              </div>
            </div>
          </div>
        </Tabs>

        {/* Dialog para adicionar/editar item */}
        <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
          <DialogContent className="max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Editar Item' : 'Adicionar Item'}</DialogTitle>
              <DialogDescription>Adicione peças ou serviços à ordem de serviço</DialogDescription>
            </DialogHeader>

            <ScrollArea className="flex-1 min-h-0 pr-2 -mr-2">
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto/serviço..."
                  value={produtoSearch}
                  onChange={(e) => setProdutoSearch(e.target.value)}
                  className="pl-9 text-base"
                />
                {produtoResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-40 overflow-auto">
                    {produtoResults.map(prod => (
                      <div
                        key={prod.id}
                        className="p-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
                        onClick={() => handleSelectProduto(prod)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium">{prod.nome}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-xs text-muted-foreground">
                                {currencyFormatters.brl(prod.valor_venda || prod.preco_venda || 0)}
                              </p>
                              {(prod as any).estoque_grade?.itens && Object.keys((prod as any).estoque_grade.itens).length > 0 && (
                                <Badge variant="secondary" className="text-xs">Grade</Badge>
                              )}
                              <Badge 
                                variant={(prod.quantidade || 0) > 0 ? "default" : "destructive"}
                                className="text-xs"
                              >
                                Estoque: {prod.quantidade || 0}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {produtoSearch.length >= 2 && produtoResults.length === 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg p-3">
                    <p className="text-sm text-muted-foreground">
                      Nenhum produto encontrado com estoque disponível.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Apenas produtos com estoque maior que zero são exibidos. Verifique se o produto está cadastrado e possui estoque disponível.
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select 
                    value={itemForm.tipo} 
                    onValueChange={(v: any) => {
                      setItemForm(prev => ({ 
                        ...prev, 
                        tipo: v, 
                        produto_id: undefined,
                        // descricao, valor_unitario e demais campos são mantidos
                      }));
                      // Limpar busca quando mudar o tipo
                      setProdutoSearch('');
                      setProdutoResults([]);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="servico">Serviço</SelectItem>
                      <SelectItem value="peca">Peça (do estoque)</SelectItem>
                      <SelectItem value="mao_de_obra">Mão de Obra</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Input
                    type="number"
                    min="1"
                    max={itemForm.tipo === 'peca' && itemForm.produto_id
                      ? (() => {
                          const produto = produtos.find(p => p.id === itemForm.produto_id) as any;
                          if (!produto) return undefined;
                          if (produto.estoque_grade?.tipo === 'cor' && itemForm.grade_cor && produto.estoque_grade?.itens?.[itemForm.grade_cor] != null) {
                            return Number(produto.estoque_grade.itens[itemForm.grade_cor]) || undefined;
                          }
                          if (produto.estoque_grade?.tipo === 'aro' && itemForm.com_aro) {
                            const aroKey = comAroToGradeKey(itemForm.com_aro);
                            if (aroKey && produto.estoque_grade?.itens?.[aroKey] != null) {
                              return Number(produto.estoque_grade.itens[aroKey]) || undefined;
                            }
                          }
                          return produto.quantidade || undefined;
                        })()
                      : undefined}
                    value={itemForm.quantidade}
                    onChange={(e) => {
                      const valor = parseInt(e.target.value) || 1;
                      if (itemForm.tipo === 'peca' && itemForm.produto_id) {
                        const produto = produtos.find(p => p.id === itemForm.produto_id) as any;
                        let estoqueDisponivel = produto?.quantidade || 0;
                        if (produto?.estoque_grade?.tipo === 'cor' && itemForm.grade_cor && produto.estoque_grade?.itens?.[itemForm.grade_cor] != null) {
                          estoqueDisponivel = Number(produto.estoque_grade.itens[itemForm.grade_cor]) || 0;
                        }
                        if (produto?.estoque_grade?.tipo === 'aro' && itemForm.com_aro) {
                          const aroKey = comAroToGradeKey(itemForm.com_aro);
                          if (aroKey && produto.estoque_grade?.itens?.[aroKey] != null) {
                            estoqueDisponivel = Number(produto.estoque_grade.itens[aroKey]) || 0;
                          }
                        }
                        if (produto && valor > estoqueDisponivel) {
                          const gradeLabel = itemForm.grade_cor ? ` (cor: ${itemForm.grade_cor})` : (itemForm.com_aro ? ` (${comAroToGradeKey(itemForm.com_aro) || itemForm.com_aro})` : '');
                          toast({
                            title: 'Quantidade excede estoque',
                            description: `Estoque disponível: ${estoqueDisponivel} unidades${gradeLabel}.`,
                            variant: 'destructive',
                          });
                          return;
                        }
                      }
                      setItemForm(prev => ({ ...prev, quantidade: valor }));
                    }}
                  />
                  {itemForm.tipo === 'peca' && itemForm.produto_id && (
                    <p className="text-xs text-muted-foreground">
                      Estoque disponível: {(() => {
                        const produto = produtos.find(p => p.id === itemForm.produto_id) as any;
                        if (!produto) return 0;
                        if (produto.estoque_grade?.tipo === 'cor' && itemForm.grade_cor && produto.estoque_grade?.itens?.[itemForm.grade_cor] != null) {
                          return `${Number(produto.estoque_grade.itens[itemForm.grade_cor]) || 0} (cor: ${itemForm.grade_cor})`;
                        }
                        if (produto.estoque_grade?.tipo === 'aro' && itemForm.com_aro) {
                          const aroKey = comAroToGradeKey(itemForm.com_aro);
                          if (aroKey && produto.estoque_grade?.itens?.[aroKey] != null) {
                            return `${Number(produto.estoque_grade.itens[aroKey]) || 0} (${aroKey})`;
                          }
                        }
                        return `${produto.quantidade || 0} unidades`;
                      })()}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  value={itemForm.descricao}
                  onChange={(e) => {
                    // Sempre permitir editar a descrição (pode ser ajustada manualmente)
                    setItemForm(prev => ({ ...prev, descricao: e.target.value }));
                  }}
                  placeholder={itemForm.tipo === 'peca' && !itemForm.produto_id ? "Selecione uma peça do estoque acima ou digite manualmente" : "Descrição do item"}
                />
                {itemForm.tipo === 'peca' && !itemForm.produto_id && (
                  <p className="text-xs text-muted-foreground">
                    Busque e selecione uma peça do estoque acima ou digite manualmente
                  </p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Valor Unitário</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={itemForm.valor_unitario || ''}
                    onChange={(e) => setItemForm(prev => ({ ...prev, valor_unitario: parseFloat(e.target.value) || 0 }))}
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor Mínimo</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={itemForm.valor_minimo || ''}
                    onChange={(e) => setItemForm(prev => ({ ...prev, valor_minimo: parseFloat(e.target.value) || 0 }))}
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Desconto</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={itemForm.desconto || ''}
                    onChange={(e) => setItemForm(prev => ({ ...prev, desconto: parseFloat(e.target.value) || 0 }))}
                    placeholder="0,00"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Garantia (dias)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={itemForm.garantia || 90}
                    onChange={(e) => setItemForm(prev => ({ ...prev, garantia: parseInt(e.target.value) || 90 }))}
                    placeholder="90"
                  />
                  <p className="text-xs text-muted-foreground">
                    Padrão: 90 dias (ou conforme cadastro do produto)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Fornecedor</Label>
                  <Popover open={fornecedorPopoverOpen} onOpenChange={(open) => { setFornecedorPopoverOpen(open); if (!open) setFornecedorSearch(''); }}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-between font-normal h-10"
                      >
                        <span className="truncate">{itemForm.fornecedor_nome || 'Selecione o fornecedor'}</span>
                        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="z-[110] w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <div className="p-2 border-b">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            placeholder="Pesquisar fornecedor..."
                            value={fornecedorSearch}
                            onChange={(e) => setFornecedorSearch(e.target.value)}
                            className="h-9 pl-8 text-sm"
                            autoFocus
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setShowNovoFornecedorDialog(true); setFornecedorPopoverOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-green-700 font-medium hover:bg-green-50 border-b"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Cadastrar novo fornecedor
                      </button>
                      <ScrollArea className="h-[200px] w-full">
                        {fornecedoresFiltrados.length > 0 ? (
                          <div className="p-1" onWheel={(e) => e.stopPropagation()}>
                            {fornecedoresFiltrados.map(f => (
                              <div
                                key={f.id}
                                className="flex items-center gap-1 group rounded-md hover:bg-accent"
                              >
                                <button
                                  type="button"
                                  className="flex-1 flex items-center px-3 py-2 text-sm text-left min-w-0"
                                  onClick={() => {
                                    setItemForm(prev => ({ ...prev, fornecedor_id: f.id, fornecedor_nome: f.nome }));
                                    setFornecedorPopoverOpen(false);
                                  }}
                                >
                                  <span className="truncate">{f.nome}</span>
                                </button>
                                <button
                                  type="button"
                                  className="p-1.5 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                  title="Editar nome do fornecedor"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditFornecedorId(f.id);
                                    setEditFornecedorNome(f.nome);
                                    setShowEditFornecedorDialog(true);
                                    setFornecedorPopoverOpen(false);
                                  }}
                                >
                                  <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                                </button>
                                <button
                                  type="button"
                                  className="p-1.5 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-foreground"
                                  title="Excluir fornecedor"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFornecedorToDelete({ id: f.id, nome: f.nome });
                                    setFornecedorPopoverOpen(false);
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                            {fornecedorSearch.trim() ? 'Nenhum fornecedor encontrado.' : 'Nenhum fornecedor cadastrado. Use "+ Cadastrar novo".'}
                          </div>
                        )}
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground">Não sai no cupom. Útil para garantia/retorno.</p>
                </div>
                {/* Grade para baixa no estoque: cor ou aro (sempre que o produto selecionado tiver grade) */}
                {itemForm.produto_id && (() => {
                  const produto = (selectedProdutoForItem?.id === itemForm.produto_id ? selectedProdutoForItem : produtos.find(p => p.id === itemForm.produto_id)) as any;
                  const gradePorCor = produto?.estoque_grade?.tipo === 'cor' && produto?.estoque_grade?.itens && Object.keys(produto.estoque_grade.itens).length > 0;
                  const gradePorAro = produto?.estoque_grade?.tipo === 'aro' && produto?.estoque_grade?.itens && Object.keys(produto.estoque_grade.itens).length > 0;
                  if (gradePorCor) {
                    const cores = Object.keys(produto.estoque_grade.itens).sort((a, b) => a.localeCompare(b));
                    return (
                      <div className="space-y-2">
                        <Label>Grade — Cor (para baixa no estoque)</Label>
                        <Select
                          value={itemForm.grade_cor || ''}
                          onValueChange={(v) => setItemForm(prev => ({ ...prev, grade_cor: v, quantidade: 1 }))}
                        >
                          <SelectTrigger className="w-full h-10">
                            <SelectValue placeholder="Selecione a cor" />
                          </SelectTrigger>
                          <SelectContent>
                            {cores.map((cor) => (
                              <SelectItem key={cor} value={cor}>
                                {cor} ({Number(produto.estoque_grade.itens[cor]) || 0} un.)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Selecione a cor para dar baixa no estoque certo.</p>
                      </div>
                    );
                  }
                  if (gradePorAro) {
                    const opcoes = Object.keys(produto.estoque_grade.itens).sort((a, b) => a.localeCompare(b));
                    return (
                      <div className="space-y-2">
                        <Label>Grade — Tipo (para baixa no estoque)</Label>
                        <Select
                          value={itemForm.com_aro || ''}
                          onValueChange={(v) => setItemForm(prev => ({ ...prev, com_aro: (v === 'com_aro' || v === 'sem_aro' ? v : '') as '' | 'com_aro' | 'sem_aro', quantidade: 1 }))}
                        >
                          <SelectTrigger className="w-full h-10">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {opcoes.map((opc) => (
                              <SelectItem key={opc} value={gradeKeyToComAro(opc) || opc}>
                                {opc} ({Number(produto.estoque_grade.itens[opc]) || 0} un.)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Selecione Com Aro ou Sem Aro para dar baixa no estoque certo.</p>
                      </div>
                    );
                  }
                  if (itemForm.tipo === 'peca') {
                    return (
                      <div className="space-y-2">
                        <Label>Com aro ou sem aro</Label>
                        <Select
                          value={itemForm.com_aro || 'none'}
                          onValueChange={(v) => setItemForm(prev => ({ ...prev, com_aro: (v === 'none' ? '' : v) as '' | 'com_aro' | 'sem_aro' }))}
                        >
                          <SelectTrigger className="w-full h-10">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            <SelectItem value="com_aro">Com aro</SelectItem>
                            <SelectItem value="sem_aro">Sem aro</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Controle interno. Não sai no cupom.</p>
                        <p className="text-xs text-amber-600 dark:text-amber-500">Para escolher cor ou tipo (grade), cadastre o produto em Produtos com &quot;Usar grade de estoque&quot; (por cor ou por aro).</p>
                      </div>
                    );
                  }
                  return null;
                })()}
                <div className="space-y-2">
                  <Label>Colaborador que lançou</Label>
                  <Input value={currentUserNome} readOnly className="bg-muted" />
                  <p className="text-xs text-muted-foreground">Preenchido automaticamente pelo usuário logado</p>
                </div>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg flex justify-between items-center">
                <span className="font-medium">Total do Item:</span>
                <span className="text-xl font-bold">
                  {currencyFormatters.brl((itemForm.quantidade * itemForm.valor_unitario) - itemForm.desconto)}
                </span>
              </div>
            </div>
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowAddItem(false); setSelectedProdutoForItem(null); }}>Cancelar</Button>
              <Button onClick={handleSubmitItem} disabled={!itemForm.descricao || isAddingItem || isUpdatingItem}>
                {editingItem ? 'Atualizar' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Novo Fornecedor */}
        <Dialog open={showNovoFornecedorDialog} onOpenChange={setShowNovoFornecedorDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Novo fornecedor</DialogTitle>
              <DialogDescription>Nome do fornecedor da peça (controle interno)</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <Input
                placeholder="Ex: Loja de Peças XYZ"
                value={novoFornecedorNome}
                onChange={(e) => setNovoFornecedorNome(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateFornecedor(); } }}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setShowNovoFornecedorDialog(false); setNovoFornecedorNome(''); }}>Cancelar</Button>
                <Button onClick={handleCreateFornecedor} disabled={!novoFornecedorNome.trim()}>
                  Cadastrar e selecionar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog Editar Fornecedor */}
        <Dialog open={showEditFornecedorDialog} onOpenChange={(open) => { setShowEditFornecedorDialog(open); if (!open) { setEditFornecedorId(null); setEditFornecedorNome(''); } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Editar fornecedor</DialogTitle>
              <DialogDescription>Altere o nome do fornecedor.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <Input
                placeholder="Nome do fornecedor"
                value={editFornecedorNome}
                onChange={(e) => setEditFornecedorNome(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleEditFornecedor(); } }}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setShowEditFornecedorDialog(false); setEditFornecedorId(null); setEditFornecedorNome(''); }}>Cancelar</Button>
                <Button onClick={handleEditFornecedor} disabled={!editFornecedorNome.trim()}>
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!fornecedorToDelete} onOpenChange={(open) => !open && setFornecedorToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir fornecedor?</AlertDialogTitle>
              <AlertDialogDescription>
                O fornecedor &quot;{fornecedorToDelete?.nome}&quot; será removido do cadastro. Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingFornecedor}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); handleConfirmDeleteFornecedor(); }}
                disabled={isDeletingFornecedor}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeletingFornecedor ? 'Excluindo...' : 'Excluir'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Toast centralizado de sucesso */}
        {showSuccessToast && (
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] pointer-events-none">
            <div className="bg-green-600 text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in-0 zoom-in-95 duration-200">
              <Check className="h-5 w-5" />
              <span className="font-semibold">OS salva com sucesso!</span>
            </div>
          </div>
        )}
      </div>
  );

  if (isModal) {
    return content;
  }

  return (
    <ModernLayout 
      title={isEditing ? `OS #${currentOS?.numero || ''}` : 'Nova Ordem de Serviço'} 
      subtitle={isEditing ? 'Editar ordem de serviço' : 'Cadastrar nova OS'}
    >
      {content}

      {/* Dialog Registrar Pagamento (OS Financeiro) */}
      <Dialog open={showPagamentoOSDialog} onOpenChange={setShowPagamentoOSDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
            <DialogDescription>
              Registre um adiantamento ou pagamento da OS. O comprovante pode ser impresso para o cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={pagamentoOSForm.valor}
                onChange={(e) => setPagamentoOSForm(prev => ({ ...prev, valor: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Forma de pagamento</Label>
              <Select
                value={
                  (() => {
                    const active = paymentMethods.filter(pm => pm.is_active);
                    if (active.length === 0) return '';
                    const code = pagamentoOSForm.forma_pagamento;
                    return active.some(pm => pm.code === code) ? code : (active[0]?.code ?? '');
                  })()
                }
                onValueChange={(v) => setPagamentoOSForm(prev => ({ ...prev, forma_pagamento: v as FormaPagamento }))}
                disabled={paymentMethods.filter(pm => pm.is_active).length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a forma" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.filter(pm => pm.is_active).map((pm) => (
                    <SelectItem key={pm.id} value={pm.code}>{pm.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {paymentMethods.filter(pm => pm.is_active).length === 0 && (
                <p className="text-xs text-amber-600">
                  Nenhuma forma de pagamento cadastrada. Configure em Admin → Configurações → Pagamentos.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={pagamentoOSForm.tipo}
                onValueChange={(v: 'adiantamento' | 'pagamento_final') => setPagamentoOSForm(prev => ({ ...prev, tipo: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="adiantamento">Adiantamento</SelectItem>
                  <SelectItem value="pagamento_final">Pagamento final</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observação (opcional)</Label>
              <Input
                placeholder="Ex.: entrada, parcela 1..."
                value={pagamentoOSForm.observacao}
                onChange={(e) => setPagamentoOSForm(prev => ({ ...prev, observacao: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="imprimir-cupom-pagamento"
                checked={imprimirCupomAposPagamento}
                onCheckedChange={(c) => setImprimirCupomAposPagamento(c === true)}
              />
              <Label htmlFor="imprimir-cupom-pagamento" className="text-sm font-normal cursor-pointer">Imprimir cupom para o cliente</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPagamentoOSDialog(false)}>Cancelar</Button>
            <LoadingButton loading={isSavingPagamentoOS} onClick={handleRegistrarPagamentoOS}>
              Registrar e {imprimirCupomAposPagamento ? 'Imprimir' : 'Salvar'}
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmar cancelamento de pagamento OS (apenas admin) */}
      <Dialog open={!!pagamentoToCancel} onOpenChange={(open) => !open && setPagamentoToCancel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar pagamento</DialogTitle>
            <DialogDescription>
              O pagamento de {pagamentoToCancel ? currencyFormatters.brl(pagamentoToCancel.valor) : ''} será cancelado.
              {pagamentoToCancel?.sale_id
                ? ` A venda vinculada (Venda #${pagamentoToCancel.sale_numero ?? '?'}) será anulada e o valor deixará de constar no caixa.`
                : ' O valor deixará de constar no caixa.'}
              {' '}Esta ação é irreversível.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPagamentoToCancel(null)}>Não</Button>
            <LoadingButton variant="destructive" loading={isCancellingPagamento} onClick={handleCancelPagamentoOS}>
              Sim, cancelar pagamento
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Checklist de Entrada */}
      <Dialog open={showChecklistEntradaModal} onOpenChange={setShowChecklistEntradaModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Checklist de Entrada</DialogTitle>
            <DialogDescription>
              Marque os itens verificados ao receber o equipamento. Após finalizar, a OS será impressa automaticamente em 2 vias.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Grid de Checklist */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Problemas Encontrados */}
              <Card>
                <CardHeader className="pb-2 pt-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-destructive">Problemas Encontrados</CardTitle>
                    <Badge variant="destructive" className="text-xs">
                      {checklistEntradaConfig.filter(i => i.categoria === 'fisico').filter(item => checklistEntradaModalMarcados.includes(item.item_id)).length} / {checklistEntradaConfig.filter(i => i.categoria === 'fisico').length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2 pr-4">
                      {checklistEntradaConfig.filter(i => i.categoria === 'fisico').map(item => (
                        <div key={item.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50">
                          <Checkbox
                            id={`modal-entrada-fisico-${item.id}`}
                            checked={checklistEntradaModalMarcados.includes(item.item_id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setChecklistEntradaModalMarcados(prev => [...prev, item.item_id]);
                              } else {
                                setChecklistEntradaModalMarcados(prev => prev.filter(id => id !== item.item_id));
                              }
                            }}
                          />
                          <Label htmlFor={`modal-entrada-fisico-${item.id}`} className="text-sm cursor-pointer flex-1">
                            {item.nome}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Funcional OK */}
              <Card>
                <CardHeader className="pb-2 pt-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-green-600">Funcional OK</CardTitle>
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                      {checklistEntradaConfig.filter(i => i.categoria === 'funcional').filter(item => checklistEntradaModalMarcados.includes(item.item_id)).length} / {checklistEntradaConfig.filter(i => i.categoria === 'funcional').length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2 pr-4">
                      {checklistEntradaConfig.filter(i => i.categoria === 'funcional').map(item => (
                        <div key={item.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50">
                          <Checkbox
                            id={`modal-entrada-funcional-${item.id}`}
                            checked={checklistEntradaModalMarcados.includes(item.item_id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setChecklistEntradaModalMarcados(prev => [...prev, item.item_id]);
                              } else {
                                setChecklistEntradaModalMarcados(prev => prev.filter(id => id !== item.item_id));
                              }
                            }}
                          />
                          <Label htmlFor={`modal-entrada-funcional-${item.id}`} className="text-sm cursor-pointer flex-1">
                            {item.nome}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Observações */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Observações do Checklist de Entrada</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={checklistEntradaModalObservacoes}
                  onChange={(e) => setChecklistEntradaModalObservacoes(e.target.value)}
                  placeholder="Adicione observações gerais sobre o checklist de entrada..."
                  rows={3}
                />
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowChecklistEntradaModal(false);
              setChecklistEntradaModalOSId(null);
              setChecklistEntradaModalMarcados([]);
              setChecklistEntradaModalObservacoes('');
            }}>
              Cancelar
            </Button>
            <Button onClick={handleFinalizarChecklistEntrada}>
              <Save className="h-4 w-4 mr-2" />
              Finalizar Checklist e Imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Checklist de Saída */}
      <Dialog open={showChecklistSaidaModal} onOpenChange={setShowChecklistSaidaModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Checklist de Saída - OS #{currentOS?.numero}</DialogTitle>
            <DialogDescription>
              Marque os itens verificados antes de finalizar a manutenção. O {isOficinaMecanica ? 'veículo' : 'aparelho'} será aprovado ou reprovado com base neste checklist.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Grid de Checklist */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Problemas Encontrados */}
              <Card>
                <CardHeader className="pb-2 pt-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-destructive">Problemas Encontrados</CardTitle>
                    <Badge variant="destructive" className="text-xs">
                      {checklistSaidaConfig.filter(i => i.categoria === 'fisico').filter(item => checklistSaidaMarcados.includes(item.item_id)).length} / {checklistSaidaConfig.filter(i => i.categoria === 'fisico').length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2 pr-4">
                      {checklistSaidaConfig.filter(i => i.categoria === 'fisico').map(item => (
                        <div key={item.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50">
                          <Checkbox
                            id={`saida-${item.item_id}`}
                            checked={checklistSaidaMarcados.includes(item.item_id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setChecklistSaidaMarcados(prev => [...prev, item.item_id]);
                              } else {
                                setChecklistSaidaMarcados(prev => prev.filter(id => id !== item.item_id));
                              }
                            }}
                          />
                          <Label htmlFor={`saida-${item.item_id}`} className="text-sm cursor-pointer flex-1">
                            {item.nome}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Funcional OK */}
              <Card>
                <CardHeader className="pb-2 pt-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-green-600">Funcional OK</CardTitle>
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                      {checklistSaidaConfig.filter(i => i.categoria === 'funcional').filter(item => checklistSaidaMarcados.includes(item.item_id)).length} / {checklistSaidaConfig.filter(i => i.categoria === 'funcional').length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2 pr-4">
                      {checklistSaidaConfig.filter(i => i.categoria === 'funcional').map(item => (
                        <div key={item.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50">
                          <Checkbox
                            id={`saida-${item.item_id}`}
                            checked={checklistSaidaMarcados.includes(item.item_id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setChecklistSaidaMarcados(prev => [...prev, item.item_id]);
                              } else {
                                setChecklistSaidaMarcados(prev => prev.filter(id => id !== item.item_id));
                              }
                            }}
                          />
                          <Label htmlFor={`saida-${item.item_id}`} className="text-sm cursor-pointer flex-1">
                            {item.nome}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Aprovação/Reprovação */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resultado do Checklist</CardTitle>
                <CardDescription>O {isOficinaMecanica ? 'veículo' : 'aparelho'} foi aprovado ou reprovado no checklist de saída?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Button
                    variant={checklistSaidaAprovado === true ? 'default' : 'outline'}
                    className={cn('flex-1', checklistSaidaAprovado === true && 'bg-green-600 hover:bg-green-700')}
                    onClick={() => setChecklistSaidaAprovado(true)}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Aprovado
                  </Button>
                  <Button
                    variant={checklistSaidaAprovado === false ? 'default' : 'outline'}
                    className={cn('flex-1', checklistSaidaAprovado === false && 'bg-red-600 hover:bg-red-700')}
                    onClick={() => setChecklistSaidaAprovado(false)}
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Reprovado
                  </Button>
                </div>

                {checklistSaidaAprovado === false && (
                  <div className="space-y-2">
                    <Label>Observações (Ressalvas)</Label>
                    <Textarea
                      value={checklistSaidaObservacoes}
                      onChange={(e) => setChecklistSaidaObservacoes(e.target.value)}
                      placeholder="Descreva as ressalvas ou problemas encontrados..."
                      rows={3}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowChecklistSaidaModal(false);
              setPendingStatusChange(null);
              setChecklistSaidaMarcados([]);
              setChecklistSaidaAprovado(null);
              setChecklistSaidaObservacoes('');
            }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleFinalizarChecklistSaida}
              disabled={checklistSaidaAprovado === null || isSubmittingChecklistSaida}
              className={cn(
                checklistSaidaAprovado === true && 'bg-green-600 hover:bg-green-700',
                checklistSaidaAprovado === false && 'bg-red-600 hover:bg-red-700'
              )}
            >
              {isSubmittingChecklistSaida ? (
                <>Enviando...</>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Finalizar Checklist e Atualizar Status
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Novo Cliente - Completo igual /clientes */}
      <Dialog open={showNovoClienteModal} onOpenChange={setShowNovoClienteModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-4 md:p-6">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <User className="h-5 w-5" />
              Novo Cliente
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do cliente. Após salvar, o cliente será selecionado automaticamente na OS.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Seção: Dados Pessoais */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Dados Pessoais</h3>
              
              {/* Tipo de Pessoa e CPF/CNPJ */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Pessoa</Label>
                  <Select 
                    value={novoClienteData.tipo_pessoa} 
                    onValueChange={(v: 'fisica' | 'juridica') => setNovoClienteData(prev => ({ ...prev, tipo_pessoa: v }))}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fisica">Pessoa Física</SelectItem>
                      <SelectItem value="juridica">Pessoa Jurídica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{novoClienteData.tipo_pessoa === 'fisica' ? 'CPF' : 'CNPJ'}</Label>
                  <Input
                    tabIndex={1}
                    value={novoClienteData.cpf_cnpj}
                    onChange={(e) => setNovoClienteData(prev => ({ ...prev, cpf_cnpj: e.target.value }))}
                    placeholder={novoClienteData.tipo_pessoa === 'fisica' ? '000.000.000-00' : '00.000.000/0000-00'}
                    className="h-10"
                  />
                </div>
                {novoClienteData.tipo_pessoa === 'fisica' && (
                  <div className="space-y-2">
                    <Label>RG <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                    <Input
                      tabIndex={2}
                      value={novoClienteData.rg}
                      onChange={(e) => setNovoClienteData(prev => ({ ...prev, rg: e.target.value }))}
                      placeholder="00.000.000-0"
                      className="h-10"
                    />
                  </div>
                )}
              </div>

              {/* Nome */}
              <div className="space-y-2">
                <Label>Nome Completo *</Label>
                <Input
                  tabIndex={3}
                  value={novoClienteData.nome}
                  onChange={(e) => setNovoClienteData(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Nome completo do cliente"
                  className="h-10 text-base"
                  autoFocus
                />
              </div>

              {novoClienteData.tipo_pessoa === 'juridica' && (
                <div className="space-y-2">
                  <Label>Nome Fantasia</Label>
                  <Input
                    tabIndex={4}
                    value={novoClienteData.nome_fantasia}
                    onChange={(e) => setNovoClienteData(prev => ({ ...prev, nome_fantasia: e.target.value }))}
                    placeholder="Nome fantasia da empresa"
                    className="h-10"
                  />
                </div>
              )}

              {/* Celular, Telefone e Data de Nascimento */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Celular / WhatsApp *</Label>
                  <Input
                    tabIndex={5}
                    value={novoClienteData.whatsapp}
                    onChange={(e) => setNovoClienteData(prev => ({ ...prev, whatsapp: e.target.value, telefone: e.target.value }))}
                    placeholder="(19) 99999-9999"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone Fixo</Label>
                  <Input
                    tabIndex={6}
                    value={novoClienteData.telefone2}
                    onChange={(e) => setNovoClienteData(prev => ({ ...prev, telefone2: e.target.value }))}
                    placeholder="(19) 3333-3333"
                    className="h-10"
                  />
                </div>
                {novoClienteData.tipo_pessoa === 'fisica' && (
                  <div className="space-y-2">
                    <Label>Data de Nascimento</Label>
                    <Input
                      tabIndex={7}
                      type="date"
                      value={novoClienteData.data_nascimento}
                      onChange={(e) => setNovoClienteData(prev => ({ ...prev, data_nascimento: e.target.value }))}
                      className="h-10"
                    />
                  </div>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  tabIndex={8}
                  type="email"
                  value={novoClienteData.email}
                  onChange={(e) => setNovoClienteData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                  className="h-10"
                />
              </div>
            </div>

            {/* Seção: Endereço */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Endereço</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <div className="flex gap-2">
                    <Input
                      tabIndex={9}
                      value={novoClienteData.cep}
                      onChange={(e) => setNovoClienteData(prev => ({ ...prev, cep: e.target.value }))}
                      placeholder="13000-000"
                      className="h-10"
                      onBlur={handleBuscarCEPNovoCliente}
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handleBuscarCEPNovoCliente} 
                      disabled={isBuscandoCEP}
                      className="h-10 w-10 p-0 shrink-0"
                      tabIndex={-1}
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="md:col-span-3 space-y-2">
                  <Label>Logradouro</Label>
                  <Input
                    tabIndex={10}
                    value={novoClienteData.logradouro}
                    onChange={(e) => setNovoClienteData(prev => ({ ...prev, logradouro: e.target.value }))}
                    placeholder="Rua, Avenida, etc."
                    className="h-10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label>Número</Label>
                  <Input
                    tabIndex={11}
                    value={novoClienteData.numero}
                    onChange={(e) => setNovoClienteData(prev => ({ ...prev, numero: e.target.value }))}
                    placeholder="123"
                    className="h-10"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label>Complemento</Label>
                  <Input
                    tabIndex={12}
                    value={novoClienteData.complemento}
                    onChange={(e) => setNovoClienteData(prev => ({ ...prev, complemento: e.target.value }))}
                    placeholder="Apto, Bloco, etc."
                    className="h-10"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label>Bairro</Label>
                  <Input
                    tabIndex={13}
                    value={novoClienteData.bairro}
                    onChange={(e) => setNovoClienteData(prev => ({ ...prev, bairro: e.target.value }))}
                    placeholder="Bairro"
                    className="h-10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="md:col-span-3 space-y-2">
                  <Label>Cidade</Label>
                  <Input
                    tabIndex={14}
                    value={novoClienteData.cidade}
                    onChange={(e) => setNovoClienteData(prev => ({ ...prev, cidade: e.target.value }))}
                    placeholder="Cidade"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>UF</Label>
                  <Input
                    tabIndex={15}
                    value={novoClienteData.estado}
                    onChange={(e) => setNovoClienteData(prev => ({ ...prev, estado: e.target.value.toUpperCase() }))}
                    maxLength={2}
                    placeholder="SP"
                    className="h-10"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t mt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setShowNovoClienteModal(false);
                resetNovoClienteForm();
              }}
              disabled={isCreatingCliente}
              className="h-10"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateNovoCliente}
              disabled={isCreatingCliente || !novoClienteData.nome.trim() || !novoClienteData.whatsapp.trim()}
              className="h-10 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isCreatingCliente ? (
                <>Salvando...</>
              ) : (
                <>Cadastrar</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Novo Modelo */}
      <Dialog open={showNovoModeloModal} onOpenChange={setShowNovoModeloModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Cadastrar Novo Modelo
            </DialogTitle>
            <DialogDescription>
              Marca selecionada: <strong>{marcas.find(m => m.id === formData.marca_id)?.nome || '-'}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Modelo *</Label>
              <Input
                value={novoModeloNome}
                onChange={(e) => setNovoModeloNome(e.target.value)}
                placeholder="Ex: iPhone 14, Galaxy S23, G22..."
                autoFocus
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowNovoModeloModal(false);
                setNovoModeloNome('');
              }}
              disabled={isCreatingModelo}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateNovoModelo}
              disabled={isCreatingModelo || !novoModeloNome.trim()}
              className="bg-green-600 hover:bg-green-700"
            >
              {isCreatingModelo ? (
                <>Salvando...</>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar Modelo
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModernLayout>
  );
}
