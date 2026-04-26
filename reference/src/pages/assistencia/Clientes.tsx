import { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ModernLayout } from '@/components/ModernLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
// Tabs removidas - formulário único sem abas
import { 
  Plus, Search, Edit, Trash2, Phone, Mail, MapPin, User, ExternalLink, Wrench, ShoppingCart, Cake, Settings, Upload,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X, Car, RefreshCcw, Send, CalendarClock, Ban
} from 'lucide-react';
import { ImportarClientes } from '@/components/ImportarClientes';
import { useClientesSupabase as useClientes } from '@/hooks/useClientesSupabase';
import { buscarCEP } from '@/hooks/useAssistencia';
import { Cliente, ClienteFormData } from '@/types/assistencia';
import { EmptyState } from '@/components/EmptyState';
import { LoadingButton } from '@/components/LoadingButton';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { from } from '@/integrations/db/client';
import { useCompanySegment } from '@/hooks/useCompanySegment';
import { currencyFormatters, dateFormatters } from '@/utils/formatters';
import { getDemoAwareErrorMessage } from '@/utils/demoMode';
import { STATUS_OS_LABELS, STATUS_OS_COLORS } from '@/types/assistencia';
import { apiClient } from '@/integrations/api/client';

interface BirthdayConfig {
  mensagem: string;
  horario: string;
  ativo: boolean;
  timezone?: string;
}

interface BirthdayJob {
  id: string;
  cliente_id: string;
  cliente_nome: string | null;
  cliente_whatsapp: string | null;
  cliente_telefone: string | null;
  cliente_telefone2: string | null;
  data_nascimento: string | null;
  telefone: string | null;
  status: 'pendente' | 'agendado' | 'enviado' | 'erro' | 'cancelado';
  scheduled_at: string;
  sent_at: string | null;
  error_message: string | null;
  skip_reason: string | null;
  mensagem_preview: string | null;
  source_date: string;
}

interface BirthdayJobsResponse {
  jobs: BirthdayJob[];
  summary: {
    total_jobs: number;
    pending_jobs: number;
    sent_jobs: number;
    error_jobs: number;
    cancelled_jobs: number;
  };
}

const INITIAL_FORM: ClienteFormData = {
  tipo_pessoa: 'fisica',
  nome: '',
  cpf_cnpj: '',
  rg: '',
  data_nascimento: '',
  telefone: '',
  whatsapp: '',
  email: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
};

// Tipos de campo de busca
type SearchFieldType = 'all' | 'nome' | 'cpf_cnpj' | 'rg' | 'telefone' | 'email';

const SEARCH_FIELD_LABELS: Record<SearchFieldType, string> = {
  all: 'Todos',
  nome: 'Nome',
  cpf_cnpj: 'CPF/CNPJ',
  rg: 'RG',
  telefone: 'Telefone',
  email: 'Email',
};

interface VeiculoFormRow {
  id?: string;
  placa: string;
  marca_id: string | null;
  modelo_id: string | null;
  marca_nome: string;
  modelo_nome: string;
  ano: string;
  versao: string;
  chassi: string;
  cor: string;
  km_atual: string;
}

const emptyVeiculoRow = (): VeiculoFormRow => ({
  id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  placa: '',
  marca_id: null,
  modelo_id: null,
  marca_nome: '',
  modelo_nome: '',
  ano: '',
  versao: '',
  chassi: '',
  cor: '',
  km_atual: '',
});

export default function Clientes() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { segmentoSlug } = useCompanySegment();
  const isOficina = segmentoSlug === 'oficina_mecanica';
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState<SearchFieldType>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [formData, setFormData] = useState<ClienteFormData>(INITIAL_FORM);
  const [veiculosForm, setVeiculosForm] = useState<VeiculoFormRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAniversarioConfig, setShowAniversarioConfig] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [aniversarioConfig, setAniversarioConfig] = useState<BirthdayConfig>({
    mensagem: '🎉 *Feliz Aniversário!*\n\nOlá {nome}! 🎂\n\nHoje é um dia muito especial! Desejamos um feliz aniversário repleto de alegria, saúde e muitas realizações!\n\nQue este novo ano de vida seja cheio de momentos especiais e conquistas!\n\nParabéns! 🎈🎁',
    horario: '09:00',
    ativo: false,
    timezone: 'America/Sao_Paulo',
  });
  const [birthdayJobFilter, setBirthdayJobFilter] = useState<'all' | 'agendado' | 'enviado' | 'erro' | 'cancelado'>('all');
  const [birthdaySaving, setBirthdaySaving] = useState(false);
  const [birthdaySyncing, setBirthdaySyncing] = useState(false);
  const [birthdayProcessing, setBirthdayProcessing] = useState(false);
  
  const { 
    clientes, 
    createCliente, 
    updateCliente, 
    deleteCliente,
    searchClientesAsync,
    page,
    totalPages,
    totalCount,
    goToPage,
    nextPage,
    prevPage,
    pageSize,
  } = useClientes(50);
  const { toast } = useToast();

  const { data: birthdayJobsData, refetch: refetchBirthdayJobs, isFetching: loadingBirthdayJobs } = useQuery({
    queryKey: ['birthday-message-jobs', birthdayJobFilter],
    queryFn: async () => {
      const query = new URLSearchParams({
        limit: '100',
        status: birthdayJobFilter,
        period: 'today',
      });
      const { data, error } = await apiClient.get(`/birthday-messages/jobs?${query.toString()}`);
      if (error) throw new Error(typeof error === 'string' ? error : 'Erro ao carregar agendamentos');
      return (data || { jobs: [], summary: {} }) as BirthdayJobsResponse;
    },
    enabled: showAniversarioConfig,
  });
  
  // Estado para clientes da busca no servidor
  const [searchResults, setSearchResults] = useState<Cliente[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Buscar OSs do cliente
  const { data: clienteOSs = [], isLoading: loadingOSs } = useQuery({
    queryKey: ['cliente_os', editingCliente?.id],
    queryFn: async () => {
      if (!editingCliente?.id) return [];
      const { data, error } = await from('ordens_servico')
        .select('*')
        .eq('cliente_id', editingCliente.id)
        .order('created_at', { ascending: false })
        .limit(50)
        .execute();
      if (error) throw error;
      return data || [];
    },
    enabled: !!editingCliente?.id && showForm,
  });

  // Buscar veículos do cliente (oficina)
  const { data: clienteVeiculos = [] } = useQuery({
    queryKey: ['cliente_veiculos', editingCliente?.id],
    queryFn: async () => {
      if (!editingCliente?.id) return [];
      const { data, error } = await from('veiculos').select('*').eq('cliente_id', editingCliente.id).execute();
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!editingCliente?.id && showForm && isOficina,
  });

  // Marcas/Modelos para o formulário de veículos (oficina)
  const { data: marcasList = [] } = useQuery({
    queryKey: ['marcas-clientes'],
    queryFn: async () => {
      const { data, error } = await from('marcas').select('id, nome').eq('situacao', 'ativo').order('nome', { ascending: true }).execute();
      if (error) throw error;
      return (data || []) as { id: string; nome: string }[];
    },
    enabled: isOficina && showForm,
  });
  const { data: modelosList = [] } = useQuery({
    queryKey: ['modelos-clientes', veiculosForm.map(v => v.marca_id).filter(Boolean).join(',')],
    queryFn: async () => {
      const marcaIds = [...new Set(veiculosForm.map(v => v.marca_id).filter(Boolean))] as string[];
      if (marcaIds.length === 0) return [];
      const all: { id: string; nome: string; marca_id: string }[] = [];
      for (const mid of marcaIds) {
        const { data, error } = await from('modelos').select('id, nome, marca_id').eq('marca_id', mid).eq('situacao', 'ativo').order('nome', { ascending: true }).execute();
        if (!error && data) all.push(...(data as any));
      }
      return all;
    },
    enabled: isOficina && showForm && veiculosForm.some(v => v.marca_id),
  });

  useEffect(() => {
    if (!showForm || !isOficina) return;
    if (!editingCliente) {
      setVeiculosForm([]);
      return;
    }
    setVeiculosForm(clienteVeiculos.map((v: any) => ({
      id: v.id,
      placa: v.placa || '',
      marca_id: v.marca_id || null,
      modelo_id: v.modelo_id || null,
      marca_nome: v.marca_nome || '',
      modelo_nome: v.modelo_nome || '',
      ano: v.ano || '',
      versao: v.versao || '',
      chassi: v.chassi || '',
      cor: v.cor || '',
      km_atual: v.km_atual != null ? String(v.km_atual) : '',
    })));
  }, [editingCliente?.id, showForm, isOficina, clienteVeiculos]);

  // Buscar vendas do cliente
  const { data: clienteVendas = [], isLoading: loadingVendas } = useQuery({
    queryKey: ['cliente_vendas', editingCliente?.id],
    queryFn: async () => {
      if (!editingCliente?.id) return [];
      const { data, error } = await from('sales')
        .select('*')
        .eq('cliente_id', editingCliente.id)
        .order('created_at', { ascending: false })
        .limit(50)
        .execute();
      if (error) throw error;
      return data || [];
    },
    enabled: !!editingCliente?.id && showForm,
  });

  // Buscar no servidor quando o termo de busca muda
  useEffect(() => {
    if (!searchTerm || searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchClientesAsync(searchTerm, 100);
        // Filtrar por campo específico se selecionado
        if (searchField !== 'all') {
          const q = searchTerm.toLowerCase();
          const filtered = results.filter(c => {
            const value = c[searchField as keyof Cliente];
            return value && String(value).toLowerCase().includes(q);
          });
          setSearchResults(filtered);
        } else {
          setSearchResults(results);
        }
      } catch (error) {
        console.error('Erro na busca:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300); // Debounce de 300ms

    return () => clearTimeout(timer);
  }, [searchTerm, searchField, searchClientesAsync]);

  // Usar resultados da busca do servidor quando há termo de busca
  const filteredClientes = useMemo(() => {
    if (!searchTerm) return clientes;
    if (searchTerm.length < 2) {
      // Busca local para termos muito curtos
      const q = searchTerm.toLowerCase();
      return clientes.filter(c => {
        if (searchField === 'all') {
          return (c.nome || '').toLowerCase().includes(q) ||
            c.cpf_cnpj?.includes(searchTerm) ||
            c.telefone?.includes(searchTerm);
        }
        const value = c[searchField as keyof Cliente];
        return value && String(value).toLowerCase().includes(q);
      });
    }
    // Usar resultados da busca no servidor
    return searchResults;
  }, [clientes, searchTerm, searchField, searchResults]);

  // Abrir form para novo cliente
  const handleNew = () => {
    setEditingCliente(null);
    setFormData(INITIAL_FORM);
    setVeiculosForm([]);
    setShowForm(true);
  };

  // Abrir form para editar
  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setFormData({
      tipo_pessoa: cliente.tipo_pessoa,
      nome: cliente.nome,
      nome_fantasia: cliente.nome_fantasia,
      cpf_cnpj: cliente.cpf_cnpj || '',
      rg: cliente.rg,
      sexo: cliente.sexo,
      data_nascimento: cliente.data_nascimento,
      telefone: cliente.telefone || '',
      telefone2: cliente.telefone2,
      whatsapp: cliente.whatsapp || '',
      email: cliente.email || '',
      cep: cliente.cep || '',
      logradouro: cliente.logradouro || '',
      numero: cliente.numero || '',
      complemento: cliente.complemento || '',
      bairro: cliente.bairro || '',
      cidade: cliente.cidade || '',
      estado: cliente.estado || cliente.uf || '',
    });
    setShowForm(true);
  };

  const addVeiculoRow = () => setVeiculosForm(prev => [...prev, emptyVeiculoRow()]);
  const updateVeiculoRow = (index: number, patch: Partial<VeiculoFormRow>) => {
    setVeiculosForm(prev => prev.map((row, i) => i === index ? { ...row, ...patch } : row));
  };
  const removeVeiculoRow = async (index: number) => {
    const row = veiculosForm[index];
    if (row?.id) {
      try {
        await from('veiculos').delete().eq('id', row.id).execute();
        queryClient.invalidateQueries({ queryKey: ['cliente_veiculos', editingCliente?.id] });
        queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      } catch (e: any) {
        toast({ title: e?.message || 'Erro ao excluir veículo', variant: 'destructive' });
        return;
      }
    }
    setVeiculosForm(prev => prev.filter((_, i) => i !== index));
  };

  // Buscar CEP
  const handleBuscarCEP = async () => {
    if (!formData.cep || formData.cep.length < 8) return;
    
    setIsLoading(true);
    try {
      const endereco = await buscarCEP(formData.cep);
      if (endereco) {
        setFormData(prev => ({
          ...prev,
          logradouro: endereco.logradouro,
          bairro: endereco.bairro,
          cidade: endereco.cidade,
          estado: endereco.uf,
        }));
        toast({ title: 'CEP encontrado!' });
      } else {
        toast({ title: 'CEP não encontrado', variant: 'destructive' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Salvar cliente
  const handleSubmit = async () => {
    if (!formData.nome) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      let clienteId: string;
      if (editingCliente) {
        const payload: Record<string, unknown> = { ...formData };
        if (payload.estado !== undefined) payload.uf = payload.estado;
        await updateCliente(editingCliente.id, payload as any);
        clienteId = editingCliente.id;
        toast({ title: 'Cliente atualizado!' });
      } else {
        const newCliente = await createCliente(formData as any);
        clienteId = newCliente.id;
        toast({ title: 'Cliente cadastrado com sucesso!' });
        setSearchTerm(formData.nome.split(' ')[0]);
      }

      if (isOficina && veiculosForm.length > 0) {
        for (const v of veiculosForm) {
          if (editingCliente && v.id) continue;
          const marca = marcasList.find(m => m.id === v.marca_id);
          const modelo = modelosList.find(m => m.id === v.modelo_id);
          await from('veiculos').insert({
            cliente_id: clienteId,
            placa: v.placa.trim() || null,
            marca_id: v.marca_id || null,
            modelo_id: v.modelo_id || null,
            marca_nome: marca?.nome || v.marca_nome || null,
            modelo_nome: modelo?.nome || v.modelo_nome || null,
            ano: v.ano.trim() || null,
            versao: v.versao.trim() || null,
            chassi: v.chassi.trim() || null,
            cor: v.cor.trim() || null,
            km_atual: v.km_atual.trim() ? parseFloat(v.km_atual.replace(/,/g, '.')) : null,
          }).execute();
        }
        queryClient.invalidateQueries({ queryKey: ['veiculos'] });
        queryClient.invalidateQueries({ queryKey: ['cliente_veiculos', clienteId] });
      }

      setShowForm(false);
      setFormData(INITIAL_FORM);
      setVeiculosForm([]);
    } catch (error: any) {
      console.error('Erro ao salvar cliente:', error);
      toast({
        title: 'Erro ao salvar cliente',
        description: getDemoAwareErrorMessage(error, 'Tente novamente'),
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Deletar cliente
  const handleDelete = async (id: string) => {
    if (confirm('Deseja realmente excluir este cliente?')) {
      try {
        await deleteCliente(id);
        toast({ title: 'Cliente excluído!' });
        // Atualizar resultados da busca removendo o cliente excluído
        if (searchResults.length > 0) {
          setSearchResults(prev => prev.filter(c => c.id !== id));
        }
      } catch (error: any) {
        console.error('Erro ao excluir cliente:', error);
        toast({
          title: 'Erro ao excluir',
          description: getDemoAwareErrorMessage(error, 'Tente novamente'),
          variant: 'destructive'
        });
      }
    }
  };

  const loadAniversarioConfig = async () => {
    try {
      const { data, error } = await apiClient.get('/birthday-messages/settings');
      if (error) {
        throw new Error(typeof error === 'string' ? error : 'Erro ao carregar configuração');
      }
      setAniversarioConfig({
        mensagem: data?.template_mensagem || aniversarioConfig.mensagem,
        horario: data?.horario_envio || '09:00',
        ativo: !!data?.ativo,
        timezone: data?.timezone || 'America/Sao_Paulo',
      });
    } catch (error) {
      console.error('Erro ao carregar configuração de aniversário:', error);
      toast({
        title: 'Erro ao carregar configuração',
        description: getDemoAwareErrorMessage(error, 'Não foi possível carregar a configuração de aniversário.'),
        variant: 'destructive',
      });
    }
  };

  const handleOpenAniversarioConfig = async () => {
    await loadAniversarioConfig();
    setShowAniversarioConfig(true);
  };

  const handleSaveAniversarioConfig = async () => {
    try {
      setBirthdaySaving(true);
      const payload = {
        ativo: aniversarioConfig.ativo,
        horario_envio: aniversarioConfig.horario,
        timezone: aniversarioConfig.timezone || 'America/Sao_Paulo',
        template_mensagem: aniversarioConfig.mensagem,
      };
      const { error } = await apiClient.put('/birthday-messages/settings', payload);
      if (error) {
        throw new Error(typeof error === 'string' ? error : (error as any)?.message || 'Erro ao salvar configuração');
      }
      await refetchBirthdayJobs();
      toast({
        title: 'Configuração salva!',
        description: aniversarioConfig.ativo
          ? 'O agendamento automático de aniversários foi atualizado e sincronizado.'
          : 'As mensagens de aniversário foram desativadas para esta empresa.',
      });
      setShowAniversarioConfig(false);
    } catch (error: any) {
      console.error('Erro ao salvar configuração:', error);
      toast({ 
        title: 'Erro ao salvar',
        description: getDemoAwareErrorMessage(error, 'Não foi possível salvar a configuração.'),
        variant: 'destructive'
      });
    } finally {
      setBirthdaySaving(false);
    }
  };

  const handleSyncBirthdayJobs = async () => {
    try {
      setBirthdaySyncing(true);
      const { data, error } = await apiClient.post('/birthday-messages/sync', {});
      if (error) {
        throw new Error(typeof error === 'string' ? error : (error as any)?.message || 'Erro ao sincronizar');
      }
      await refetchBirthdayJobs();
      toast({
        title: 'Agendamentos sincronizados',
        description: `${data?.created || 0} agendados, ${data?.duplicates || 0} já existentes.`,
      });
    } catch (error) {
      toast({
        title: 'Erro ao sincronizar',
        description: getDemoAwareErrorMessage(error, 'Não foi possível gerar os agendamentos de aniversário.'),
        variant: 'destructive',
      });
    } finally {
      setBirthdaySyncing(false);
    }
  };

  const handleProcessBirthdayJobs = async () => {
    try {
      setBirthdayProcessing(true);
      const { data, error } = await apiClient.post('/birthday-messages/process', {});
      if (error) {
        throw new Error(typeof error === 'string' ? error : (error as any)?.message || 'Erro ao processar envios');
      }
      await refetchBirthdayJobs();
      toast({
        title: 'Fila processada',
        description: `${data?.sent || 0} enviados, ${data?.errors || 0} com erro.`,
      });
    } catch (error) {
      toast({
        title: 'Erro ao processar fila',
        description: getDemoAwareErrorMessage(error, 'Não foi possível processar a fila de aniversário.'),
        variant: 'destructive',
      });
    } finally {
      setBirthdayProcessing(false);
    }
  };

  const handleRescheduleBirthdayJob = async (job: BirthdayJob) => {
    try {
      const { error } = await apiClient.patch(`/birthday-messages/jobs/${job.id}`, {
        status: 'agendado',
        telefone: job.telefone || job.cliente_whatsapp || job.cliente_telefone || job.cliente_telefone2 || '',
      });
      if (error) {
        throw new Error(typeof error === 'string' ? error : (error as any)?.message || 'Erro ao reagendar');
      }
      await refetchBirthdayJobs();
      toast({ title: 'Agendamento atualizado!', description: 'A mensagem voltou para a fila de envio.' });
    } catch (error) {
      toast({
        title: 'Erro ao reagendar',
        description: getDemoAwareErrorMessage(error, 'Não foi possível reagendar a mensagem.'),
        variant: 'destructive',
      });
    }
  };

  const handleDeleteBirthdayJob = async (jobId: string) => {
    try {
      const { error } = await apiClient.delete(`/birthday-messages/jobs/${jobId}`);
      if (error) {
        throw new Error(typeof error === 'string' ? error : (error as any)?.message || 'Erro ao remover');
      }
      await refetchBirthdayJobs();
      toast({ title: 'Agendamento removido!' });
    } catch (error) {
      toast({
        title: 'Erro ao remover',
        description: getDemoAwareErrorMessage(error, 'Não foi possível remover o agendamento.'),
        variant: 'destructive',
      });
    }
  };

  const birthdaySummary = birthdayJobsData?.summary || {
    total_jobs: 0,
    pending_jobs: 0,
    sent_jobs: 0,
    error_jobs: 0,
    cancelled_jobs: 0,
  };

  return (
    <ModernLayout title="Clientes" subtitle="Gerenciar clientes">
      <div className="flex flex-col min-h-0 md:h-full md:overflow-hidden gap-3 md:gap-3 min-w-0">
        {/* Mobile: Busca + botão — toque confortável */}
        <div className="md:hidden shrink-0 space-y-2">
          <div className="flex items-stretch gap-2 min-h-[44px]">
            <div className="relative flex-1 min-w-0">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none ${isSearching ? 'text-blue-500 animate-pulse' : 'text-muted-foreground'}`} />
              <Input
                placeholder={searchField === 'all' ? "Buscar cliente..." : `Buscar por ${SEARCH_FIELD_LABELS[searchField]}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-11 min-h-[44px] pl-10 pr-3 text-base border-input rounded-xl touch-manipulation"
              />
              {searchField !== 'all' && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                    {SEARCH_FIELD_LABELS[searchField]}
                  </Badge>
                  <button type="button" onClick={() => setSearchField('all')} className="text-muted-foreground hover:text-foreground p-1 rounded touch-manipulation" aria-label="Limpar filtro de busca">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
            <Button onClick={handleNew} size="sm" className="h-11 min-h-[44px] min-w-[48px] px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shrink-0 touch-manipulation" aria-label="Novo cliente">
              <Plus className="h-5 w-5" />
            </Button>
          </div>
          <Button
            onClick={handleOpenAniversarioConfig}
            variant="outline"
            className="h-11 min-h-[44px] w-full justify-between rounded-xl border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 touch-manipulation"
          >
            <span className="flex items-center gap-2">
              <Cake className="h-4 w-4" />
              <span>Painel de aniversários</span>
            </span>
            <Badge variant="secondary" className="bg-white/80 text-amber-800">
              Hoje
            </Badge>
          </Button>
          <Select value={searchField} onValueChange={(v) => setSearchField(v as SearchFieldType)}>
            <SelectTrigger className="h-11 min-h-[44px] w-full text-sm border-input rounded-xl touch-manipulation [&>span]:truncate">
              <SelectValue placeholder="Buscar por" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SEARCH_FIELD_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Desktop: Barra de ações completa */}
        <div className="hidden md:block flex-shrink-0 bg-card border border-gray-200 rounded-lg p-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isSearching ? 'text-blue-500 animate-pulse' : 'text-muted-foreground'}`} />
              <Input 
                placeholder={searchField === 'all' ? "Buscar por nome, CPF, telefone... (clique na coluna para filtrar)" : `Buscar por ${SEARCH_FIELD_LABELS[searchField]}...`} 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className={`pl-9 h-9 text-sm border-gray-200 ${searchField !== 'all' ? 'pr-24' : ''}`} 
              />
              {searchField !== 'all' && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 border-blue-200">
                    {SEARCH_FIELD_LABELS[searchField]}
                  </Badge>
                  <button onClick={() => setSearchField('all')} className="text-gray-400 hover:text-gray-600">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
            <Button onClick={handleNew} size="sm" className="gap-2 h-9 bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="h-4 w-4" /><span>Novo Cliente</span>
            </Button>
            <Button onClick={() => setShowImportDialog(true)} variant="outline" size="sm" className="gap-2 h-9">
              <Upload className="h-4 w-4" /><span>Importar</span>
            </Button>
            <Button onClick={handleOpenAniversarioConfig} variant="outline" size="sm" className="gap-2 h-9 border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100">
              <Cake className="h-4 w-4" /><span>Painel Aniversários</span>
            </Button>
          </div>
        </div>

        {/* Lista de clientes — mobile: página rola; desktop: scroll interno */}
        <Card className="flex flex-col border border-gray-200 dark:border-gray-700 rounded-xl md:rounded-lg overflow-hidden md:flex-1 md:min-h-0 md:overflow-hidden">
          <CardContent className="flex flex-col p-0 md:flex-1 md:overflow-hidden md:min-h-0">
            {filteredClientes.length === 0 ? (
              <div className="p-6 md:p-12">
                <EmptyState
                  icon={<User className="h-12 w-12" />}
                  title="Nenhum cliente encontrado"
                  description={searchTerm ? "Tente buscar por outro termo" : "Cadastre seu primeiro cliente"}
                  action={!searchTerm ? { label: "Novo Cliente", onClick: handleNew } : undefined}
                />
              </div>
            ) : (
              <>
                {/* Desktop: Tabela com scroll interno */}
                <div className="hidden md:flex flex-1 flex-col overflow-hidden min-h-0">
                  <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
                  <table className="w-full caption-bottom text-sm border-collapse">
                    <thead className="sticky top-0 z-20 bg-background shadow-sm">
                      <tr className="border-b-[3px] border-gray-400">
                        <th 
                          className={`h-12 px-4 text-left align-middle font-semibold border-r border-gray-200 cursor-pointer hover:bg-blue-100 transition-colors ${searchField === 'nome' ? 'bg-blue-200 text-blue-700' : 'bg-muted/60'}`}
                          onClick={() => setSearchField(searchField === 'nome' ? 'all' : 'nome')}
                          title="Clique para filtrar por Nome"
                        >
                          Nome {searchField === 'nome' && <Search className="inline h-3 w-3 ml-1" />}
                        </th>
                        <th 
                          className={`h-12 px-4 text-left align-middle font-semibold border-r border-gray-200 cursor-pointer hover:bg-blue-100 transition-colors ${searchField === 'cpf_cnpj' ? 'bg-blue-200 text-blue-700' : 'bg-muted/60'}`}
                          onClick={() => setSearchField(searchField === 'cpf_cnpj' ? 'all' : 'cpf_cnpj')}
                          title="Clique para filtrar por CPF/CNPJ"
                        >
                          CPF/CNPJ {searchField === 'cpf_cnpj' && <Search className="inline h-3 w-3 ml-1" />}
                        </th>
                        <th 
                          className={`h-12 px-4 text-left align-middle font-semibold border-r border-gray-200 cursor-pointer hover:bg-blue-100 transition-colors ${searchField === 'rg' ? 'bg-blue-200 text-blue-700' : 'bg-muted/60'}`}
                          onClick={() => setSearchField(searchField === 'rg' ? 'all' : 'rg')}
                          title="Clique para filtrar por RG"
                        >
                          RG {searchField === 'rg' && <Search className="inline h-3 w-3 ml-1" />}
                        </th>
                        <th 
                          className={`h-12 px-4 text-left align-middle font-semibold border-r border-gray-200 cursor-pointer hover:bg-blue-100 transition-colors ${searchField === 'telefone' ? 'bg-blue-200 text-blue-700' : 'bg-muted/60'}`}
                          onClick={() => setSearchField(searchField === 'telefone' ? 'all' : 'telefone')}
                          title="Clique para filtrar por Telefone"
                        >
                          Telefone {searchField === 'telefone' && <Search className="inline h-3 w-3 ml-1" />}
                        </th>
                        <th 
                          className={`h-12 px-4 text-left align-middle font-semibold border-r border-gray-200 cursor-pointer hover:bg-blue-100 transition-colors ${searchField === 'email' ? 'bg-blue-200 text-blue-700' : 'bg-muted/60'}`}
                          onClick={() => setSearchField(searchField === 'email' ? 'all' : 'email')}
                          title="Clique para filtrar por Email"
                        >
                          Email {searchField === 'email' && <Search className="inline h-3 w-3 ml-1" />}
                        </th>
                        <th className="h-12 px-4 text-left align-middle font-semibold bg-muted/60 border-r border-gray-200">Cidade</th>
                        <th className="h-12 px-4 text-right align-middle font-semibold bg-muted/60">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClientes.map((cliente, index) => (
                        <tr 
                          key={cliente.id}
                          className={`border-b-2 border-gray-300 cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-950/20 ${index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}`}
                          onDoubleClick={() => handleEdit(cliente)}
                          title="Duplo clique para editar"
                        >
                          <td className="py-3.5 px-3 align-middle font-medium border-r border-gray-200">{cliente.nome}</td>
                          <td className="py-3.5 px-3 align-middle border-r border-gray-200">{cliente.cpf_cnpj || '-'}</td>
                          <td className="py-3.5 px-3 align-middle border-r border-gray-200">{cliente.rg || '-'}</td>
                          <td className="py-3.5 px-3 align-middle border-r border-gray-200">
                            {cliente.whatsapp || cliente.telefone || '-'}
                          </td>
                          <td className="py-3.5 px-3 align-middle border-r border-gray-200">{cliente.email || '-'}</td>
                          <td className="py-3.5 px-3 align-middle border-r border-gray-200">{cliente.cidade || '-'}</td>
                          <td className="py-3.5 px-3 align-middle">
                            <div className="flex justify-end gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => handleEdit(cliente)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-destructive"
                                onClick={() => handleDelete(cliente.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>

                {/* Mobile: Cards compactos — sem scroll interno, página rola */}
                <div className="md:hidden">
                  <p className="text-xs text-muted-foreground px-3 py-2 border-b border-border/60">Toque para abrir · duplo toque para editar</p>
                  <div className="space-y-2 px-3 py-2 pb-3">
                  {filteredClientes.map((cliente) => (
                    <Card
                      key={cliente.id}
                      className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden touch-manipulation active:scale-[0.99] cursor-pointer"
                      onClick={() => handleEdit(cliente)}
                      onDoubleClick={(e) => { e.stopPropagation(); handleEdit(cliente); }}
                    >
                      <CardContent className="p-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-foreground text-sm truncate">{cliente.nome}</p>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                              {(cliente.whatsapp || cliente.telefone) && (
                                <span>{cliente.whatsapp || cliente.telefone}</span>
                              )}
                              {cliente.cidade && (
                                <span>{(cliente.whatsapp || cliente.telefone) ? '·' : ''} {cliente.cidade}</span>
                              )}
                            </div>
                            {cliente.email && (
                              <p className="text-[10px] text-muted-foreground truncate mt-0.5">{cliente.email}</p>
                            )}
                          </div>
                          <div className="flex gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-lg touch-manipulation" onClick={() => handleEdit(cliente)} aria-label="Editar">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-lg text-destructive hover:text-destructive touch-manipulation" onClick={() => handleDelete(cliente.id)} aria-label="Excluir">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  </div>
                </div>

                {/* Paginação — mobile: toque fácil; desktop: primeira/última + prev/next */}
                {totalPages > 1 && (
                  <div className="flex-shrink-0 flex flex-col sm:flex-row items-center justify-between gap-2 px-3 sm:px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-muted/30 rounded-b-xl sm:rounded-none">
                    <p className="text-xs text-muted-foreground tabular-nums order-2 sm:order-1">
                      {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, totalCount)} de {totalCount}
                    </p>
                    <div className="flex items-center gap-1 order-1 sm:order-2">
                      <Button variant="outline" size="icon" className="hidden sm:flex h-8 w-8" onClick={() => goToPage(1)} disabled={page === 1} aria-label="Primeira página">
                        <ChevronsLeft className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="outline" size="sm" className="h-10 min-h-[44px] w-10 p-0 rounded-xl touch-manipulation md:h-8 md:w-8 md:min-h-0 md:rounded-md" onClick={prevPage} disabled={page === 1} aria-label="Página anterior">
                        <ChevronLeft className="h-5 w-5 md:h-3.5 md:w-3.5" />
                      </Button>
                      <span className="min-w-[2.5rem] text-center text-sm font-medium tabular-nums px-1">{page} / {totalPages}</span>
                      <Button variant="outline" size="sm" className="h-10 min-h-[44px] w-10 p-0 rounded-xl touch-manipulation md:h-8 md:w-8 md:min-h-0 md:rounded-md" onClick={nextPage} disabled={page === totalPages} aria-label="Próxima página">
                        <ChevronRight className="h-5 w-5 md:h-3.5 md:w-3.5" />
                      </Button>
                      <Button variant="outline" size="icon" className="hidden sm:flex h-8 w-8" onClick={() => goToPage(totalPages)} disabled={page === totalPages} aria-label="Última página">
                        <ChevronsRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Form Dialog - Formulário único sem abas */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-4 md:p-6">
            <DialogHeader className="pb-4">
              <DialogTitle className="text-lg font-semibold">
                {editingCliente ? 'Editar Cliente' : 'Novo Cliente'}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-6">
              {/* Seção: Dados Pessoais */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Dados Pessoais</h3>
                
                {/* Tipo de Pessoa e CPF/CNPJ na mesma linha */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de Pessoa</Label>
                    <Select 
                      value={formData.tipo_pessoa} 
                      onValueChange={(v: any) => setFormData(prev => ({ ...prev, tipo_pessoa: v }))}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[110]">
                        <SelectItem value="fisica">Pessoa Física</SelectItem>
                        <SelectItem value="juridica">Pessoa Jurídica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{formData.tipo_pessoa === 'fisica' ? 'CPF' : 'CNPJ'}</Label>
                    <Input
                      tabIndex={1}
                      value={formData.cpf_cnpj}
                      onChange={(e) => setFormData(prev => ({ ...prev, cpf_cnpj: e.target.value }))}
                      placeholder={formData.tipo_pessoa === 'fisica' ? '000.000.000-00' : '00.000.000/0000-00'}
                      className="h-10"
                    />
                  </div>
                  {formData.tipo_pessoa === 'fisica' && (
                    <div className="space-y-2">
                      <Label>RG <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                      <Input
                        tabIndex={2}
                        value={formData.rg || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, rg: e.target.value }))}
                        placeholder="00.000.000-0"
                        className="h-10"
                      />
                    </div>
                  )}
                </div>

                {/* Nome - Campo principal */}
                <div className="space-y-2">
                  <Label>Nome Completo *</Label>
                  <Input
                    tabIndex={3}
                    value={formData.nome}
                    onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                    placeholder="Nome completo do cliente"
                    className="h-10 text-base"
                    autoFocus
                    required
                  />
                </div>

                {formData.tipo_pessoa === 'juridica' && (
                  <div className="space-y-2">
                    <Label>Nome Fantasia</Label>
                    <Input
                      tabIndex={4}
                      value={formData.nome_fantasia || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, nome_fantasia: e.target.value }))}
                      placeholder="Nome fantasia da empresa"
                      className="h-10"
                    />
                  </div>
                )}

                {/* Celular e Data de Nascimento */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Celular / WhatsApp *</Label>
                    <Input
                      tabIndex={5}
                      value={formData.whatsapp}
                      onChange={(e) => setFormData(prev => ({ ...prev, whatsapp: e.target.value, telefone: e.target.value }))}
                      placeholder="(19) 99999-9999"
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone Fixo</Label>
                    <Input
                      tabIndex={6}
                      value={formData.telefone2 || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, telefone2: e.target.value }))}
                      placeholder="(19) 3333-3333"
                      className="h-10"
                    />
                  </div>
                  {formData.tipo_pessoa === 'fisica' && (
                    <div className="space-y-2">
                      <Label>Data de Nascimento</Label>
                      <Input
                        tabIndex={7}
                        type="date"
                        value={formData.data_nascimento || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, data_nascimento: e.target.value }))}
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
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
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
                        value={formData.cep}
                        onChange={(e) => setFormData(prev => ({ ...prev, cep: e.target.value }))}
                        placeholder="13000-000"
                        className="h-10"
                        onBlur={handleBuscarCEP}
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={handleBuscarCEP} 
                        disabled={isLoading}
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
                      value={formData.logradouro}
                      onChange={(e) => setFormData(prev => ({ ...prev, logradouro: e.target.value }))}
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
                      value={formData.numero}
                      onChange={(e) => setFormData(prev => ({ ...prev, numero: e.target.value }))}
                      placeholder="123"
                      className="h-10"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>Complemento</Label>
                    <Input
                      tabIndex={12}
                      value={formData.complemento}
                      onChange={(e) => setFormData(prev => ({ ...prev, complemento: e.target.value }))}
                      placeholder="Apto, Bloco, etc."
                      className="h-10"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>Bairro</Label>
                    <Input
                      tabIndex={13}
                      value={formData.bairro}
                      onChange={(e) => setFormData(prev => ({ ...prev, bairro: e.target.value }))}
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
                      value={formData.cidade}
                      onChange={(e) => setFormData(prev => ({ ...prev, cidade: e.target.value }))}
                      placeholder="Cidade"
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>UF</Label>
                    <Input
                      tabIndex={15}
                      value={formData.estado}
                      onChange={(e) => setFormData(prev => ({ ...prev, estado: e.target.value.toUpperCase() }))}
                      maxLength={2}
                      placeholder="SP"
                      className="h-10"
                    />
                  </div>
                </div>
              </div>

              {/* Veículos (oficina) - cadastro no perfil do cliente */}
              {isOficina && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground border-b pb-2 flex items-center gap-2">
                    <Car className="h-4 w-4" />
                    Veículos do cliente
                  </h3>
                  <p className="text-xs text-muted-foreground">Cadastre os carros vinculados a este cliente (placa, marca, modelo, chassi, etc.).</p>
                  <div className="space-y-3">
                    {veiculosForm.map((v, idx) => (
                      <div key={v.id || idx} className="p-3 border rounded-lg space-y-2 bg-muted/30">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium text-muted-foreground">Veículo {idx + 1}</span>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeVeiculoRow(idx)} aria-label="Remover veículo">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Placa</Label>
                            <Input className="h-9" placeholder="ABC-1D23" value={v.placa} onChange={(e) => updateVeiculoRow(idx, { placa: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Marca</Label>
                            <Select value={v.marca_id || '__none__'} onValueChange={(val) => updateVeiculoRow(idx, { marca_id: val === '__none__' ? null : val, modelo_id: null, modelo_nome: '' })}>
                              <SelectTrigger className="h-9"><SelectValue placeholder="Marca" /></SelectTrigger>
                              <SelectContent className="z-[110]">
                                <SelectItem value="__none__">—</SelectItem>
                                {marcasList.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Modelo</Label>
                            <Select value={v.modelo_id || '__none__'} onValueChange={(val) => updateVeiculoRow(idx, { modelo_id: val === '__none__' ? null : val })} disabled={!v.marca_id}>
                              <SelectTrigger className="h-9"><SelectValue placeholder="Modelo" /></SelectTrigger>
                              <SelectContent className="z-[110]">
                                <SelectItem value="__none__">—</SelectItem>
                                {modelosList.filter(m => m.marca_id === v.marca_id).map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Ano</Label>
                            <Input className="h-9" placeholder="2020" value={v.ano} onChange={(e) => updateVeiculoRow(idx, { ano: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Versão</Label>
                            <Input className="h-9" placeholder="1.0" value={v.versao} onChange={(e) => updateVeiculoRow(idx, { versao: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Chassi</Label>
                            <Input className="h-9" placeholder="Chassi" value={v.chassi} onChange={(e) => updateVeiculoRow(idx, { chassi: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Cor</Label>
                            <Input className="h-9" placeholder="Cor" value={v.cor} onChange={(e) => updateVeiculoRow(idx, { cor: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Km atual</Label>
                            <Input className="h-9" type="number" placeholder="Km" value={v.km_atual} onChange={(e) => updateVeiculoRow(idx, { km_atual: e.target.value })} />
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="relative z-10 mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); addVeiculoRow(); }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="gap-2 shrink-0"
                      >
                        <Plus className="h-4 w-4" />
                        Adicionar veículo
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Histórico (apenas na edição) - links e dados das OS e Vendas */}
              {editingCliente && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Histórico</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                      <div className="font-medium flex items-center gap-1">
                        <Wrench className="h-4 w-4" />
                        Ordens de Serviço
                      </div>
                      <div className="text-2xl font-bold text-blue-600 mt-1">{loadingOSs ? '...' : clienteOSs.length}</div>
                      <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                        {clienteOSs.length === 0 && !loadingOSs && <span className="text-muted-foreground text-xs">Nenhuma OS</span>}
                        {clienteOSs.slice(0, 10).map((os: any) => (
                          <Link
                            key={os.id}
                            to={`/os/${os.id}`}
                            className="block text-xs text-blue-700 dark:text-blue-300 hover:underline truncate"
                            onClick={() => setShowForm(false)}
                          >
                            OS #{os.numero ?? os.id?.slice(0, 8)} · {os.data_entrada ? dateFormatters.short(os.data_entrada) : '-'} · {STATUS_OS_LABELS[os.status as keyof typeof STATUS_OS_LABELS] ?? os.status ?? '-'}
                          </Link>
                        ))}
                        {clienteOSs.length > 10 && <span className="text-xs text-muted-foreground">+{clienteOSs.length - 10} mais</span>}
                      </div>
                    </div>
                    <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                      <div className="font-medium flex items-center gap-1">
                        <ShoppingCart className="h-4 w-4" />
                        Vendas
                      </div>
                      <div className="text-2xl font-bold text-green-600 mt-1">{loadingVendas ? '...' : clienteVendas.length}</div>
                      <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                        {clienteVendas.length === 0 && !loadingVendas && <span className="text-muted-foreground text-xs">Nenhuma venda</span>}
                        {clienteVendas.slice(0, 10).map((v: any) => (
                          <Link
                            key={v.id}
                            to={`/pdv/venda/${v.id}`}
                            className="block text-xs text-green-700 dark:text-green-300 hover:underline truncate"
                            onClick={() => setShowForm(false)}
                          >
                            {v.created_at ? dateFormatters.short(v.created_at) : '-'} · {(v.total ?? v.valor_total) != null ? currencyFormatters.brl(Number(v.total ?? v.valor_total)) : '-'}
                          </Link>
                        ))}
                        {clienteVendas.length > 10 && <span className="text-xs text-muted-foreground">+{clienteVendas.length - 10} mais</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </form>

            <DialogFooter className="pt-4 border-t mt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowForm(false)}
                className="h-10"
              >
                Cancelar
              </Button>
              <LoadingButton 
                onClick={handleSubmit} 
                loading={isLoading}
                className="h-10 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {editingCliente ? 'Atualizar' : 'Cadastrar'}
              </LoadingButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Configuração de Aniversário */}
        <Dialog open={showAniversarioConfig} onOpenChange={setShowAniversarioConfig}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-3 md:p-6">
            <DialogHeader className="pb-2 md:pb-4">
              <DialogTitle className="text-base md:text-lg flex items-center gap-2">
                <Cake className="h-5 w-5" />
                Configuração de Mensagem de Aniversário
              </DialogTitle>
              <DialogDescription>
                Configure o envio automático e acompanhe quais clientes possuem mensagem agendada para hoje.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 md:py-4">
              <div className="space-y-2">
                <Label className="text-xs md:text-sm">Horário de Envio</Label>
                <Input
                  type="time"
                  value={aniversarioConfig.horario}
                  onChange={(e) => setAniversarioConfig(prev => ({ ...prev, horario: e.target.value }))}
                  className="h-9 md:h-10 text-base md:text-sm border-2 border-gray-300"
                />
                <p className="text-[10px] md:text-xs text-muted-foreground">
                  As mensagens serão enviadas automaticamente neste horário para clientes que fazem aniversário no dia.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs md:text-sm">Mensagem de Aniversário</Label>
                <Textarea
                  value={aniversarioConfig.mensagem}
                  onChange={(e) => setAniversarioConfig(prev => ({ ...prev, mensagem: e.target.value }))}
                  rows={8}
                  className="text-sm border-2 border-gray-300 font-mono"
                  placeholder="Digite a mensagem que será enviada..."
                />
                <p className="text-[10px] md:text-xs text-muted-foreground">
                  Use {'{nome}'} para incluir o nome do cliente na mensagem. A mensagem será enviada via WhatsApp.
                </p>
              </div>

              <div className="flex items-center justify-between p-3 border-2 border-gray-300 rounded-lg">
                <div>
                  <Label className="text-xs md:text-sm">Ativar envio automático</Label>
                  <p className="text-[10px] md:text-xs text-muted-foreground">
                    Quando ativado, as mensagens serão enviadas automaticamente
                  </p>
                </div>
                <Switch
                  checked={aniversarioConfig.ativo}
                  onCheckedChange={(checked) => setAniversarioConfig(prev => ({ ...prev, ativo: checked }))}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <Card className="border border-emerald-200">
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Agendadas</p>
                    <p className="text-2xl font-semibold">{birthdaySummary.pending_jobs}</p>
                  </CardContent>
                </Card>
                <Card className="border border-blue-200">
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Enviadas hoje</p>
                    <p className="text-2xl font-semibold">{birthdaySummary.sent_jobs}</p>
                  </CardContent>
                </Card>
                <Card className="border border-amber-200">
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Com erro</p>
                    <p className="text-2xl font-semibold">{birthdaySummary.error_jobs}</p>
                  </CardContent>
                </Card>
                <Card className="border border-rose-200">
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Canceladas</p>
                    <p className="text-2xl font-semibold">{birthdaySummary.cancelled_jobs}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-medium">Fila de aniversários</p>
                  <p className="text-xs text-muted-foreground">
                    Gere os agendamentos do dia e acompanhe o status de envio por cliente.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={birthdayJobFilter} onValueChange={(value) => setBirthdayJobFilter(value as typeof birthdayJobFilter)}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Filtrar status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="agendado">Agendados</SelectItem>
                      <SelectItem value="enviado">Enviados</SelectItem>
                      <SelectItem value="erro">Com erro</SelectItem>
                      <SelectItem value="cancelado">Cancelados</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={handleSyncBirthdayJobs} disabled={birthdaySyncing}>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    {birthdaySyncing ? 'Sincronizando...' : 'Sincronizar'}
                  </Button>
                  <Button variant="outline" onClick={handleProcessBirthdayJobs} disabled={birthdayProcessing}>
                    <Send className="mr-2 h-4 w-4" />
                    {birthdayProcessing ? 'Processando...' : 'Processar fila'}
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Agendado</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Mensagem</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingBirthdayJobs ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                          Carregando agendamentos...
                        </TableCell>
                      </TableRow>
                    ) : birthdayJobsData?.jobs?.length ? (
                      birthdayJobsData.jobs.map((job) => (
                        <TableRow key={job.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium">{job.cliente_nome || 'Cliente sem nome'}</p>
                              <p className="text-xs text-muted-foreground">
                                Nasc.: {job.data_nascimento ? dateFormatters.short(job.data_nascimento) : '-'}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>{job.telefone || job.cliente_whatsapp || job.cliente_telefone || '-'}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p>{job.scheduled_at ? new Date(job.scheduled_at).toLocaleString('pt-BR') : '-'}</p>
                              {job.sent_at && (
                                <p className="text-xs text-muted-foreground">
                                  Enviado: {new Date(job.sent_at).toLocaleString('pt-BR')}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Badge
                                variant={job.status === 'enviado' ? 'default' : job.status === 'erro' ? 'destructive' : 'secondary'}
                              >
                                {job.status}
                              </Badge>
                              {(job.error_message || job.skip_reason) && (
                                <p className="max-w-[220px] text-xs text-muted-foreground">
                                  {job.error_message || job.skip_reason}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[260px]">
                            <p className="line-clamp-3 text-xs text-muted-foreground">{job.mensagem_preview || '-'}</p>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRescheduleBirthdayJob(job)}
                                title="Reagendar"
                              >
                                <CalendarClock className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                                onClick={() => handleDeleteBirthdayJob(job.id)}
                                title="Remover"
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                          Nenhum cliente com mensagem agendada para o filtro selecionado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2 pt-3 md:pt-4">
              <Button 
                variant="outline" 
                onClick={() => setShowAniversarioConfig(false)}
                className="w-full sm:w-auto h-9 md:h-10 border-2 border-gray-300"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleSaveAniversarioConfig}
                disabled={birthdaySaving}
                className="w-full sm:w-auto h-9 md:h-10 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-0"
              >
                {birthdaySaving ? 'Salvando...' : 'Salvar Configuração'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Importação de Clientes */}
        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-3 md:p-6">
            <DialogHeader className="pb-2 md:pb-4">
              <DialogTitle className="text-base md:text-lg flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Importar Clientes em Massa
              </DialogTitle>
            </DialogHeader>
            <ImportarClientes 
              onClose={() => setShowImportDialog(false)}
              onSuccess={() => {
                setShowImportDialog(false);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
    </ModernLayout>
  );
}
