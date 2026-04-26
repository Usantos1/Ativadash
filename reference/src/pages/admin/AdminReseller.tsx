import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ModernLayout } from '@/components/ModernLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useReseller, Company, Plan } from '@/hooks/useReseller';
import { useSegments, type Segmento, type Modulo, type Recurso } from '@/hooks/useSegments';
import { useAuth } from '@/contexts/AuthContext';
import { Building2, Plus, Search, Edit, DollarSign, Users, AlertCircle, Layers, Box, KeyRound, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ADMIN_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

export default function AdminReseller() {
  const { user, profile, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const { 
    loading, 
    error: resellerError, 
    listCompanies, 
    getCompany,
    createCompany, 
    updateCompany,
    listPlans,
    createPlan,
    updatePlan,
    deletePlan,
    createSubscription,
    listCompanyUsers,
    createCompanyUser,
    resetUserPassword,
    toggleUserActive
  } = useReseller();

  const {
    listSegmentos,
    getSegmento,
    createSegmento,
    updateSegmento,
    getSegmentoModulos,
    updateSegmentoModulos,
    getSegmentoRecursos,
    updateSegmentoRecursos,
    getSegmentoMenuPreview,
    listModulos,
    createModulo,
    updateModulo,
    listRecursos,
    createRecurso,
    updateRecurso,
  } = useSegments();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false);
  const [usersDialogOpen, setUsersDialogOpen] = useState(false);
  const [plansDialogOpen, setPlansDialogOpen] = useState(false);
  const [companyUsers, setCompanyUsers] = useState<any[]>([]);
  const [planFormData, setPlanFormData] = useState<Partial<Plan>>({});
  const [userFormData, setUserFormData] = useState({
    email: '',
    password: '',
    display_name: '',
    role: 'member',
    phone: ''
  });
  const [formData, setFormData] = useState<Partial<Company> & { plan_id?: string; billing_cycle?: 'monthly' | 'yearly'; segmento_id?: string }>({
    name: '',
    cnpj: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    status: 'trial'
  });

  // Multi-segmento: estado para abas Segmentos, Módulos, Recursos
  const [segmentos, setSegmentos] = useState<Segmento[]>([]);
  const [selectedSegmento, setSelectedSegmento] = useState<Segmento | null>(null);
  const [segmentoEditOpen, setSegmentoEditOpen] = useState(false);
  const [segmentoForm, setSegmentoForm] = useState<Partial<Segmento>>({ nome: '', slug: '', descricao: '', icone: 'briefcase', cor: '#3b82f6', ativo: true });
  const [segmentoTab, setSegmentoTab] = useState('info');
  const [segmentoModulos, setSegmentoModulos] = useState<Modulo[]>([]);
  const [segmentoRecursos, setSegmentoRecursos] = useState<{ modulos: Modulo[]; recursos: Recurso[] }>({ modulos: [], recursos: [] });
  const [menuPreview, setMenuPreview] = useState<Modulo[]>([]);
  const [segmentoEditLoading, setSegmentoEditLoading] = useState(false);
  const [modulosGlobal, setModulosGlobal] = useState<Modulo[]>([]);
  const [recursosGlobal, setRecursosGlobal] = useState<Recurso[]>([]);
  const [moduloForm, setModuloForm] = useState<Partial<Modulo>>({});
  const [recursoForm, setRecursoForm] = useState<Partial<Recurso> & { modulo_id?: string }>({});
  const [segmentosListKey, setSegmentosListKey] = useState(0);

  // Revenda: apenas admin da empresa principal (empresa 1) pode acessar
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    if (!isAdmin || profile?.role !== 'admin') {
      toast.error('Acesso negado. Apenas administradores podem acessar esta página.');
      navigate('/admin', { replace: true });
      return;
    }
    if (user.company_id !== ADMIN_COMPANY_ID) {
      toast.error('Acesso negado. Apenas administradores da empresa principal podem acessar a Gestão de Revenda.');
      navigate('/admin', { replace: true });
    }
  }, [user, profile, isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin && profile?.role === 'admin') {
      loadCompanies();
    }
  }, [pagination.page, search, statusFilter, user, isAdmin, profile]);

  useEffect(() => {
    if (user && isAdmin && profile?.role === 'admin') {
      loadPlans();
      loadSegmentos();
    }
  }, [user, isAdmin, profile]);

  // Quando o modal de empresa (criar/editar) abre e segmentos está vazio, tenta carregar de novo
  useEffect(() => {
    if (dialogOpen && segmentos.length === 0) {
      loadSegmentos();
    }
  }, [dialogOpen]);

  const loadSegmentos = async () => {
    try {
      const data = await listSegmentos();
      setSegmentos(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setSegmentos([]);
      toast.error(err?.message || 'Erro ao carregar segmentos. Verifique se a API está no mesmo banco onde rodou o script REVENDA_MULTI_SEGMENTO.sql.');
    }
  };
  const loadModulosGlobal = async () => {
    try {
      const data = await listModulos();
      setModulosGlobal(Array.isArray(data) ? data : []);
    } catch (_) {
      setModulosGlobal([]);
    }
  };
  const loadRecursosGlobal = async () => {
    try {
      const data = await listRecursos();
      setRecursosGlobal(Array.isArray(data) ? data : []);
    } catch (_) {
      setRecursosGlobal([]);
    }
  };

  const loadCompanies = async () => {
    try {
      const data = await listCompanies({
        page: pagination.page,
        limit: pagination.limit,
        search: search || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter || undefined
      });
      
      // Se retornar erro 403, significa que não é admin da empresa principal
      if (data.error && data.error.includes('Acesso negado')) {
        toast.error('Acesso negado. Apenas administradores da empresa principal podem acessar esta página.');
        navigate('/admin');
        return;
      }
      
      setCompanies(data.data || []);
      if (data.pagination) {
        setPagination(prev => ({
          ...prev,
          ...data.pagination,
          page: data.pagination?.page || prev.page
        }));
      }
    } catch (err: any) {
      // Se for erro 403, redirecionar
      if (err.message?.includes('403') || err.message?.includes('Acesso negado')) {
        toast.error('Acesso negado. Apenas administradores da empresa principal podem acessar esta página.');
        navigate('/admin');
        return;
      }
      toast.error(err.message || 'Erro ao carregar empresas');
    }
  };

  const loadPlans = async () => {
    try {
      const plansData = await listPlans();
      console.log('[AdminReseller] Planos carregados:', plansData);
      
      // Se retornar erro 403, significa que não é admin da empresa principal
      if (plansData?.error && plansData.error.includes('Acesso negado')) {
        toast.error('Acesso negado. Apenas administradores da empresa principal podem acessar esta página.');
        navigate('/admin');
        return;
      }
      
      setPlans(Array.isArray(plansData) ? plansData : []);
    } catch (err: any) {
      // Se for erro 403, redirecionar
      if (err.message?.includes('403') || err.message?.includes('Acesso negado')) {
        toast.error('Acesso negado. Apenas administradores da empresa principal podem acessar esta página.');
        navigate('/admin');
        return;
      }
      console.error('Erro ao carregar planos:', err);
      toast.error('Erro ao carregar planos: ' + err.message);
      setPlans([]);
    }
  };

  const handleCreateCompany = async () => {
    const name = (formData.name || '').trim();
    const email = (formData.email || '').trim();
    if (!name) {
      toast.error('Informe o nome da empresa.');
      return;
    }
    if (!email) {
      toast.error('Informe o e-mail da empresa.');
      return;
    }
    try {
      const payload = {
        ...formData,
        name,
        email,
        plan_id: formData.plan_id || undefined,
        billing_cycle: formData.billing_cycle || 'monthly',
        segmento_id: formData.segmento_id || undefined,
      };
      await createCompany(payload);
      toast.success(formData.plan_id ? 'Empresa e assinatura criadas com sucesso!' : 'Empresa criada com sucesso!');
      setDialogOpen(false);
      resetForm();
      loadCompanies();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar empresa');
    }
  };

  const handleUpdateCompany = async () => {
    if (!selectedCompany) return;
    try {
      await updateCompany(selectedCompany.id, { ...formData, segmento_id: formData.segmento_id || null });
      toast.success('Empresa atualizada com sucesso!');
      setDialogOpen(false);
      resetForm();
      loadCompanies();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar empresa');
    }
  };

  const handleCreateSubscription = async () => {
    if (!selectedCompany || !formData.plan_id) return;
    try {
      await createSubscription(
        selectedCompany.id,
        formData.plan_id,
        formData.billing_cycle || 'monthly'
      );
      toast.success('Assinatura criada com sucesso!');
      setSubscriptionDialogOpen(false);
      resetForm();
      loadCompanies();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar assinatura');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      cnpj: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      status: 'trial'
    });
    setSelectedCompany(null);
  };

  const openCreateDialog = async () => {
    resetForm();
    setFormData(prev => ({ ...prev, plan_id: '', billing_cycle: 'monthly' }));
    await Promise.all([loadSegmentos(), loadPlans()]);
    setDialogOpen(true);
  };

  const openEditDialog = async (company: Company) => {
    try {
      await loadSegmentos();
      const fullCompany = await getCompany(company.id);
      setSelectedCompany(fullCompany);
      setFormData({
        name: fullCompany.name,
        cnpj: fullCompany.cnpj,
        email: fullCompany.email,
        phone: fullCompany.phone,
        address: fullCompany.address,
        city: fullCompany.city,
        state: fullCompany.state,
        zip_code: fullCompany.zip_code,
        status: fullCompany.status,
        segmento_id: (fullCompany as any).segmento_id ?? undefined
      });
      setDialogOpen(true);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar empresa');
    }
  };

  const openSubscriptionDialog = (company: Company) => {
    setSelectedCompany(company);
    setFormData({ plan_id: '', billing_cycle: 'monthly' });
    setSubscriptionDialogOpen(true);
  };

  const openUsersDialog = async (company: Company) => {
    setSelectedCompany(company);
    setUsersDialogOpen(true);
    try {
      const users = await listCompanyUsers(company.id);
      setCompanyUsers(users || []);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar usuários');
    }
  };

  const openPlansDialog = () => {
    setPlansDialogOpen(true);
    loadPlans();
  };

  const handleCreatePlan = async () => {
    try {
      await createPlan(planFormData);
      toast.success('Plano criado com sucesso!');
      setPlansDialogOpen(false);
      setPlanFormData({});
      loadPlans();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar plano');
    }
  };

  const handleUpdatePlan = async (plan: Plan) => {
    try {
      await updatePlan(plan.id, planFormData);
      toast.success('Plano atualizado com sucesso!');
      setPlansDialogOpen(false);
      setPlanFormData({});
      loadPlans();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar plano');
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!confirm('Tem certeza que deseja desativar este plano?')) return;
    try {
      await deletePlan(planId);
      toast.success('Plano desativado com sucesso!');
      loadPlans();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao desativar plano');
    }
  };

  const handleCreateUser = async () => {
    if (!selectedCompany) return;
    try {
      await createCompanyUser(selectedCompany.id, userFormData);
      toast.success('Usuário criado com sucesso!');
      setUserFormData({ email: '', password: '', display_name: '', role: 'member', phone: '' });
      const users = await listCompanyUsers(selectedCompany.id);
      setCompanyUsers(users || []);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar usuário');
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (!selectedCompany) return;
    const newPassword = prompt('Digite a nova senha (mínimo 6 caracteres):');
    if (!newPassword || newPassword.length < 6) {
      toast.error('Senha deve ter pelo menos 6 caracteres');
      return;
    }
    try {
      await resetUserPassword(selectedCompany.id, userId, newPassword);
      toast.success('Senha resetada com sucesso!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao resetar senha');
    }
  };

  const handleToggleUserActive = async (userId: string) => {
    if (!selectedCompany) return;
    try {
      await toggleUserActive(selectedCompany.id, userId);
      toast.success('Status do usuário alterado!');
      const users = await listCompanyUsers(selectedCompany.id);
      setCompanyUsers(users || []);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao alterar status do usuário');
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
      trial: 'secondary',
      suspended: 'destructive',
      cancelled: 'outline'
    };
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      trial: 'bg-blue-100 text-blue-800',
      suspended: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };
    return (
      <Badge className={colors[status] || ''} variant={variants[status] || 'outline'}>
        {status === 'active' ? 'Ativa' : 
         status === 'trial' ? 'Trial' : 
         status === 'suspended' ? 'Suspensa' : 
         status === 'cancelled' ? 'Cancelada' : status}
      </Badge>
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (user && user.company_id !== ADMIN_COMPANY_ID) return null;

  return (
    <ModernLayout
      title="Gestão de Revenda"
      subtitle="Gerencie empresas, assinaturas e pagamentos"
    >
      <div className="space-y-4">
        {plans.length === 0 && !loading && (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
            <CardContent className="flex items-start gap-3 pt-6">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">Nenhum plano cadastrado</p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Para vender para novos clientes, crie pelo menos um plano em <strong>Gerenciar Planos</strong>.
                  Você também pode cadastrar apenas a empresa e vincular o plano depois pelo ícone de assinatura.
                  Se as tabelas de revenda ainda não existirem no banco, execute o script{' '}
                  <code className="text-xs bg-amber-100 dark:bg-amber-900/40 px-1 rounded">db/migrations/manual/INSTALAR_SISTEMA_REVENDA_COMPLETO.sql</code> no PostgreSQL.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="empresas" className="w-full" onValueChange={(v) => { if (v === 'empresas' || v === 'segmentos') loadSegmentos(); if (v === 'modulos') loadModulosGlobal(); if (v === 'recursos') loadRecursosGlobal(); }}>
          <TabsList className="grid w-full grid-cols-5 mb-4">
            <TabsTrigger value="empresas" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Empresas
            </TabsTrigger>
            <TabsTrigger value="planos" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Planos
            </TabsTrigger>
            <TabsTrigger value="segmentos" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Segmentos
            </TabsTrigger>
            <TabsTrigger value="modulos" className="flex items-center gap-2">
              <Box className="h-4 w-4" />
              Módulos
            </TabsTrigger>
            <TabsTrigger value="recursos" className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              Recursos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="empresas" className="space-y-4">
        {/* Filtros e ações */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="flex-1 flex flex-col md:flex-row gap-2 w-full md:w-auto">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="revenda-busca-empresas"
                    type="search"
                    autoComplete="off"
                    placeholder="Buscar por nome, email ou CNPJ..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="suspended">Suspensa</SelectItem>
                    <SelectItem value="cancelled">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={openPlansDialog} variant="outline" className="w-full md:w-auto">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Gerenciar Planos
                </Button>
                <Button onClick={openCreateDialog} className="w-full md:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Empresa
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Tabela de empresas */}
        <Card>
          <CardHeader>
            <CardTitle>Empresas Cadastradas</CardTitle>
            <CardDescription>
              {pagination.total} empresa(s) encontrada(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : companies.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {resellerError ? (
                  <p className="text-destructive font-medium">{resellerError}</p>
                ) : (
                  'Nenhuma empresa encontrada'
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                      <TableRow>
                        <TableHead>Empresa</TableHead>
                        <TableHead>CNPJ</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Segmento</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Usuários</TableHead>
                        <TableHead>Expira em</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies.map((company) => (
                      <TableRow key={company.id}>
                        <TableCell className="font-medium">{company.name}</TableCell>
                        <TableCell>{company.cnpj || '-'}</TableCell>
                        <TableCell>{company.email}</TableCell>
                        <TableCell>
                          {(company as any).segmento_nome ? (
                            <Badge variant="outline">{(company as any).segmento_nome}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {company.plan_name ? (
                            <Badge variant="outline">{company.plan_name}</Badge>
                          ) : (
                            <span className="text-muted-foreground">Sem plano</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(company.status)}</TableCell>
                        <TableCell>{company.user_count || 0}</TableCell>
                        <TableCell>
                          {company.subscription_expires_at ? (
                            format(new Date(company.subscription_expires_at), 'dd/MM/yyyy', { locale: ptBR })
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(company)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openSubscriptionDialog(company)}
                            >
                              <DollarSign className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openUsersDialog(company)}
                            >
                              <Users className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Paginação */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Página {pagination.page} de {pagination.totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page === 1}
                    onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page === pagination.totalPages}
                    onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog de criar/editar empresa */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedCompany ? 'Editar Empresa' : 'Nova Empresa'}
              </DialogTitle>
              <DialogDescription>
                {selectedCompany ? 'Atualize os dados da empresa' : 'Preencha os dados para cadastrar uma nova empresa'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Empresa *</Label>
                  <Input
                    id="name"
                    autoComplete="organization"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nome da empresa"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    autoComplete="off"
                    value={formData.cnpj}
                    onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                    placeholder="00.000.000/0000-00"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contato@empresa.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    autoComplete="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  autoComplete="street-address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Rua, número"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Cidade"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">Estado</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="SP"
                    maxLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip_code">CEP</Label>
                  <Input
                    id="zip_code"
                    value={formData.zip_code}
                    onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                    placeholder="00000-000"
                  />
                </div>
              </div>
              {!selectedCompany && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="plan_id">Plano (opcional — venda em 1 passo)</Label>
                    <Select
                      value={formData.plan_id || 'none'}
                      onValueChange={(value) => setFormData({ ...formData, plan_id: value === 'none' ? '' : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Nenhum plano (só cadastrar empresa)" />
                      </SelectTrigger>
                      <SelectContent className="z-[110]">
                        <SelectItem value="none">Nenhum plano (só cadastrar empresa)</SelectItem>
                        {plans.filter(p => p.active !== false).map((plan) => (
                          <SelectItem key={plan.id} value={plan.id}>
                            {plan.name} — {formatCurrency(plan.price_monthly)}/mês
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.plan_id && (
                    <div className="space-y-2">
                      <Label htmlFor="billing_cycle">Período de cobrança</Label>
                      <Select
                        value={formData.billing_cycle || 'monthly'}
                        onValueChange={(value: 'monthly' | 'yearly') => setFormData({ ...formData, billing_cycle: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[110]">
                          <SelectItem value="monthly">Mensal</SelectItem>
                          <SelectItem value="yearly">Anual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}
              {selectedCompany && (
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: any) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[110]">
                      <SelectItem value="active">Ativa</SelectItem>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="suspended">Suspensa</SelectItem>
                      <SelectItem value="cancelled">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="segmento_id">Segmento de negócio</Label>
                {segmentos.length === 0 ? (
                  <>
                    <p className="text-sm text-muted-foreground">Carregando segmentos...</p>
                    <Button type="button" variant="outline" size="sm" onClick={() => loadSegmentos()}>
                      Carregar segmentos
                    </Button>
                  </>
                ) : (
                  <>
                    <Select
                      key={`segmento-${segmentos.length}`}
                      value={formData.segmento_id || 'none'}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, segmento_id: value === 'none' ? undefined : value }))}
                    >
                      <SelectTrigger id="segmento_id">
                        <SelectValue placeholder="Nenhum (padrão)" />
                      </SelectTrigger>
                      <SelectContent className="z-[110]">
                        <SelectItem value="none">Nenhum (padrão)</SelectItem>
                        {segmentos.filter((s) => s.ativo).map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Define o menu e os recursos disponíveis para esta empresa. Pode ser alterado ao criar ou editar.
                    </p>
                  </>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={selectedCompany ? handleUpdateCompany : handleCreateCompany}>
                {selectedCompany ? 'Atualizar' : 'Criar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de criar assinatura */}
        <Dialog open={subscriptionDialogOpen} onOpenChange={setSubscriptionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Assinatura</DialogTitle>
              <DialogDescription>
                Selecione o plano e período de cobrança para {selectedCompany?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="plan_id">Plano *</Label>
                <Select
                  value={formData.plan_id || undefined}
                  onValueChange={(value) => setFormData({ ...formData, plan_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um plano" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.length > 0 ? (
                      plans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name} - {formatCurrency(plan.price_monthly)}/mês
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-plans" disabled>Nenhum plano disponível</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="billing_cycle">Período de Cobrança</Label>
                <Select
                  value={formData.billing_cycle || 'monthly'}
                  onValueChange={(value: 'monthly' | 'yearly') => setFormData({ ...formData, billing_cycle: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="yearly">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.plan_id && (
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-sm font-medium mb-2">Resumo da Assinatura</div>
                  {(() => {
                    const plan = plans.find(p => p.id === formData.plan_id);
                    if (!plan) return null;
                    const price = formData.billing_cycle === 'yearly' && plan.price_yearly 
                      ? plan.price_yearly 
                      : plan.price_monthly;
                    return (
                      <div className="space-y-1 text-sm">
                        <div>Plano: <strong>{plan.name}</strong></div>
                        <div>Valor: <strong>{formatCurrency(price)}</strong></div>
                        <div>Período: <strong>{formData.billing_cycle === 'yearly' ? 'Anual' : 'Mensal'}</strong></div>
                        <div>Limite de usuários: <strong>{plan.max_users}</strong></div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSubscriptionDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleCreateSubscription}
                disabled={!formData.plan_id}
              >
                Criar Assinatura
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de gerenciar usuários */}
        <Dialog open={usersDialogOpen} onOpenChange={setUsersDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Usuários de {selectedCompany?.name}</DialogTitle>
              <DialogDescription>
                Gerencie os usuários desta empresa
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Formulário de criar usuário — dentro de <form> para evitar aviso do navegador e autofill em outros campos */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Novo Usuário</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form
                    onSubmit={(e) => { e.preventDefault(); handleCreateUser(); }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="user_email">Email *</Label>
                        <Input
                          id="user_email"
                          type="email"
                          autoComplete="off"
                          value={userFormData.email}
                          onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                          placeholder="usuario@empresa.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="user_password">Senha *</Label>
                        <Input
                          id="user_password"
                          type="password"
                          autoComplete="new-password"
                          value={userFormData.password}
                          onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                          placeholder="Mínimo 6 caracteres"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="user_display_name">Nome</Label>
                        <Input
                          id="user_display_name"
                          autoComplete="off"
                          value={userFormData.display_name}
                          onChange={(e) => setUserFormData({ ...userFormData, display_name: e.target.value })}
                          placeholder="Nome completo"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="user_role">Função</Label>
                        <Select
                          value={userFormData.role}
                          onValueChange={(value) => setUserFormData({ ...userFormData, role: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Membro</SelectItem>
                            <SelectItem value="admin">Administrador</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button type="submit" className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Criar Usuário
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Lista de usuários */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Usuários Cadastrados ({companyUsers.length})</h3>
                <div className="space-y-2">
                  {companyUsers.map((user) => (
                    <Card key={user.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{user.display_name || user.email}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                            <div className="text-xs text-muted-foreground">
                              {user.role} • {user.email_verified ? 'Ativo' : 'Inativo'}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResetPassword(user.id)}
                            >
                              Resetar Senha
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleUserActive(user.id)}
                            >
                              {user.email_verified ? 'Desativar' : 'Ativar'}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {companyUsers.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum usuário cadastrado
                    </div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUsersDialogOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de gerenciar planos */}
        <Dialog open={plansDialogOpen} onOpenChange={setPlansDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Gerenciar Planos</DialogTitle>
              <DialogDescription>
                Crie, edite ou desative planos de assinatura
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Formulário de criar/editar plano */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {planFormData.id ? 'Editar Plano' : 'Novo Plano'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="plan_name">Nome *</Label>
                      <Input
                        id="plan_name"
                        value={planFormData.name || ''}
                        onChange={(e) => setPlanFormData({ ...planFormData, name: e.target.value })}
                        placeholder="Ex: Básico"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="plan_code">Código *</Label>
                      <Input
                        id="plan_code"
                        value={planFormData.code || ''}
                        onChange={(e) => setPlanFormData({ ...planFormData, code: e.target.value })}
                        placeholder="Ex: basic"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="plan_description">Descrição</Label>
                    <Input
                      id="plan_description"
                      value={planFormData.description || ''}
                      onChange={(e) => setPlanFormData({ ...planFormData, description: e.target.value })}
                      placeholder="Descrição do plano"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="plan_price_monthly">Preço Mensal *</Label>
                      <Input
                        id="plan_price_monthly"
                        type="number"
                        step="0.01"
                        value={planFormData.price_monthly || ''}
                        onChange={(e) => setPlanFormData({ ...planFormData, price_monthly: parseFloat(e.target.value) })}
                        placeholder="99.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="plan_price_yearly">Preço Anual</Label>
                      <Input
                        id="plan_price_yearly"
                        type="number"
                        step="0.01"
                        value={planFormData.price_yearly || ''}
                        onChange={(e) => setPlanFormData({ ...planFormData, price_yearly: parseFloat(e.target.value) })}
                        placeholder="990.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="plan_max_users">Máx. Usuários</Label>
                      <Input
                        id="plan_max_users"
                        type="number"
                        value={planFormData.max_users || ''}
                        onChange={(e) => setPlanFormData({ ...planFormData, max_users: parseInt(e.target.value) || null })}
                        placeholder="Ilimitado"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={planFormData.id ? () => handleUpdatePlan(planFormData as Plan) : handleCreatePlan}
                      className="flex-1"
                    >
                      {planFormData.id ? 'Atualizar' : 'Criar'} Plano
                    </Button>
                    {planFormData.id && (
                      <Button 
                        variant="outline"
                        onClick={() => setPlanFormData({})}
                      >
                        Cancelar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Lista de planos */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Planos Cadastrados ({plans.length})</h3>
                <div className="space-y-2">
                  {plans.map((plan) => (
                    <Card key={plan.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{plan.name} ({plan.code})</div>
                            <div className="text-sm text-muted-foreground">
                              {formatCurrency(plan.price_monthly)}/mês
                              {plan.price_yearly && ` • ${formatCurrency(plan.price_yearly)}/ano`}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Máx. {plan.max_users || '∞'} usuários • {plan.active ? 'Ativo' : 'Inativo'}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPlanFormData(plan)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {plan.active && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeletePlan(plan.id)}
                              >
                                Desativar
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setPlansDialogOpen(false);
                setPlanFormData({});
              }}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
          </TabsContent>

          <TabsContent value="planos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Planos de assinatura</CardTitle>
                <CardDescription>Gerencie os planos disponíveis para as empresas. Para criar ou editar, use o botão Gerenciar Planos na aba Empresas.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" onClick={() => { openPlansDialog(); }} className="mb-4">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Abrir gerenciador de planos
                </Button>
                <div className="text-sm text-muted-foreground">Os planos são configurados no diálogo &quot;Gerenciar Planos&quot; da aba Empresas.</div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="segmentos" className="space-y-4" key={segmentosListKey}>
            <Card>
              <CardHeader>
                <div className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Segmentos de negócio</CardTitle>
                    <CardDescription>Configure nichos (Oficina Mecânica, Comércio, etc.) com módulos e recursos próprios.</CardDescription>
                  </div>
                  <Button onClick={async () => {
                    setSegmentoForm({ nome: '', slug: '', descricao: '', icone: 'briefcase', cor: '#3b82f6', ativo: true });
                    setSelectedSegmento(null);
                    setSegmentoEditOpen(true);
                    setSegmentoTab('info');
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo segmento
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {segmentos.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum segmento cadastrado. Execute <code className="text-xs bg-muted px-1 rounded">db/migrations/manual/REVENDA_MULTI_SEGMENTO.sql</code> para criar Oficina Mecânica e Comércio, ou crie um novo.
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {segmentos.map((seg) => (
                      <Card key={seg.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={async () => {
                        setSelectedSegmento(seg);
                        setSegmentoForm({ nome: seg.nome, slug: seg.slug, descricao: seg.descricao ?? '', icone: seg.icone ?? 'briefcase', cor: seg.cor ?? '#3b82f6', ativo: seg.ativo });
                        setSegmentoEditOpen(true);
                        setSegmentoTab('info');
                        setSegmentoModulos([]);
                        setSegmentoRecursos({ modulos: [], recursos: [] });
                        setMenuPreview([]);
                        setSegmentoEditLoading(true);
                        try {
                          const [mods, recs, menu] = await Promise.all([
                            getSegmentoModulos(seg.id),
                            getSegmentoRecursos(seg.id),
                            getSegmentoMenuPreview(seg.id),
                          ]);
                          setSegmentoModulos(Array.isArray(mods) ? mods : []);
                          setSegmentoRecursos(
                            recs && typeof recs === 'object' && Array.isArray(recs.modulos) && Array.isArray(recs.recursos)
                              ? recs
                              : { modulos: [], recursos: [] }
                          );
                          setMenuPreview(Array.isArray(menu) ? menu : []);
                        } catch (e: unknown) {
                          toast.error(e instanceof Error ? e.message : 'Erro ao carregar módulos e recursos do segmento.');
                        } finally {
                          setSegmentoEditLoading(false);
                        }
                      }}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-semibold">{seg.nome}</p>
                              <p className="text-sm text-muted-foreground line-clamp-2">{seg.descricao || seg.slug}</p>
                              <div className="flex gap-2 mt-2">
                                <Badge variant="secondary">{seg.modulos_count ?? 0} módulos</Badge>
                                <Badge variant="outline">{seg.recursos_count ?? 0} recursos</Badge>
                              </div>
                            </div>
                            <Badge className={seg.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}>{seg.ativo ? 'Ativo' : 'Inativo'}</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="modulos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Módulos do sistema</CardTitle>
                <CardDescription>Cadastro global de módulos. A associação aos segmentos é feita na aba Segmentos.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Slug</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Path</TableHead>
                        <TableHead>Menu</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {modulosGlobal.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="font-medium">{m.nome}</TableCell>
                          <TableCell>{m.slug}</TableCell>
                          <TableCell>{m.categoria || '-'}</TableCell>
                          <TableCell>{m.path || '-'}</TableCell>
                          <TableCell>{m.label_menu || m.nome}</TableCell>
                          <TableCell><Badge variant={m.ativo ? 'default' : 'secondary'}>{m.ativo ? 'Ativo' : 'Inativo'}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {modulosGlobal.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4">Nenhum módulo. Execute REVENDA_MULTI_SEGMENTO.sql para popular.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recursos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recursos por módulo</CardTitle>
                <CardDescription>Recursos (ações) vinculados a cada módulo. A liberação por segmento é feita na aba Segmentos.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Módulo</TableHead>
                        <TableHead>Recurso</TableHead>
                        <TableHead>Slug</TableHead>
                        <TableHead>Permissão</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recursosGlobal.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-muted-foreground">{r.modulo_nome || r.modulo_slug || '-'}</TableCell>
                          <TableCell className="font-medium">{r.nome}</TableCell>
                          <TableCell>{r.slug}</TableCell>
                          <TableCell className="text-xs">{r.permission_key || '-'}</TableCell>
                          <TableCell><Badge variant={r.ativo ? 'default' : 'secondary'}>{r.ativo ? 'Ativo' : 'Inativo'}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {recursosGlobal.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4">Nenhum recurso. Execute REVENDA_MULTI_SEGMENTO.sql para popular.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialog Editar Segmento (4 abas) */}
        <Dialog open={segmentoEditOpen} onOpenChange={setSegmentoEditOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>{selectedSegmento ? 'Editar segmento' : 'Novo segmento'}</DialogTitle>
              <DialogDescription>
                {selectedSegmento ? 'Altere as informações e os módulos/recursos do segmento.' : 'Preencha os dados do novo segmento.'}
              </DialogDescription>
            </DialogHeader>
            <Tabs
              value={segmentoTab}
              onValueChange={(tab) => {
                setSegmentoTab(tab);
                if (tab !== 'info' && selectedSegmento && !segmentoEditLoading) {
                  const emptyModulos = tab === 'modulos' && segmentoModulos.length === 0;
                  const emptyRecursos = tab === 'recursos' && segmentoRecursos.modulos.length === 0;
                  const emptyPreview = tab === 'preview' && menuPreview.length === 0;
                  if (emptyModulos || emptyRecursos || emptyPreview) {
                    setSegmentoEditLoading(true);
                    Promise.all([
                      getSegmentoModulos(selectedSegmento.id),
                      getSegmentoRecursos(selectedSegmento.id),
                      getSegmentoMenuPreview(selectedSegmento.id),
                    ])
                      .then(([mods, recs, menu]) => {
                        setSegmentoModulos(Array.isArray(mods) ? mods : []);
                        setSegmentoRecursos(
                          recs && typeof recs === 'object' && Array.isArray(recs.modulos) && Array.isArray(recs.recursos)
                            ? recs
                            : { modulos: [], recursos: [] }
                        );
                        setMenuPreview(Array.isArray(menu) ? menu : []);
                      })
                      .catch(() => toast.error('Erro ao recarregar dados do segmento.'))
                      .finally(() => setSegmentoEditLoading(false));
                  }
                }
              }}
              className="flex-1 overflow-hidden flex flex-col min-h-0"
            >
              <TabsList className="grid grid-cols-4">
                <TabsTrigger value="info">Informações</TabsTrigger>
                <TabsTrigger value="modulos">Módulos</TabsTrigger>
                <TabsTrigger value="recursos">Recursos</TabsTrigger>
                <TabsTrigger value="preview">Prévia do menu</TabsTrigger>
              </TabsList>
              <div className="overflow-y-auto flex-1 py-4 min-h-0">
                <TabsContent value="info" className="mt-0 space-y-4">
                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nome</Label>
                        <Input value={segmentoForm.nome ?? ''} onChange={(e) => setSegmentoForm({ ...segmentoForm, nome: e.target.value })} placeholder="Ex: Oficina Mecânica" />
                      </div>
                      <div className="space-y-2">
                        <Label>Slug</Label>
                        <Input value={segmentoForm.slug ?? ''} onChange={(e) => setSegmentoForm({ ...segmentoForm, slug: e.target.value })} placeholder="oficina_mecanica" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Input value={segmentoForm.descricao ?? ''} onChange={(e) => setSegmentoForm({ ...segmentoForm, descricao: e.target.value })} placeholder="Descrição do segmento" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Ícone (nome Lucide)</Label>
                        <Input value={segmentoForm.icone ?? ''} onChange={(e) => setSegmentoForm({ ...segmentoForm, icone: e.target.value })} placeholder="car" />
                      </div>
                      <div className="space-y-2">
                        <Label>Cor</Label>
                        <Input type="color" className="h-10 w-20 p-1 cursor-pointer" value={segmentoForm.cor ?? '#3b82f6'} onChange={(e) => setSegmentoForm({ ...segmentoForm, cor: e.target.value })} />
                        <span className="text-xs text-muted-foreground ml-2">{segmentoForm.cor}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={segmentoForm.ativo ?? true} onCheckedChange={(v) => setSegmentoForm({ ...segmentoForm, ativo: v })} />
                      <Label>Ativo</Label>
                    </div>
                  </div>
                  <DialogFooter className="pt-4">
                    <Button variant="outline" onClick={() => setSegmentoEditOpen(false)}>Cancelar</Button>
                    <Button onClick={async () => {
                      try {
                        if (selectedSegmento) {
                          await updateSegmento(selectedSegmento.id, segmentoForm);
                          toast.success('Segmento atualizado');
                        } else {
                          await createSegmento(segmentoForm);
                          toast.success('Segmento criado');
                        }
                        setSegmentoEditOpen(false);
                        loadSegmentos();
                        setSegmentosListKey((k) => k + 1);
                      } catch (err: any) {
                        toast.error(err.message || 'Erro ao salvar');
                      }
                    }}>{selectedSegmento ? 'Atualizar' : 'Criar'}</Button>
                  </DialogFooter>
                </TabsContent>
                <TabsContent value="modulos" className="mt-0">
                  {selectedSegmento && (
                    <>
                      <p className="text-sm text-muted-foreground mb-4">Ative os módulos que este segmento possui e defina a ordem no menu.</p>
                      {segmentoEditLoading ? (
                        <p className="text-sm text-muted-foreground py-6">Carregando módulos...</p>
                      ) : segmentoModulos.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4">Nenhum módulo disponível. Execute a migration REVENDA_MULTI_SEGMENTO.sql no banco ou verifique a conexão.</p>
                      ) : (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {(() => {
                          const activeOrdered = segmentoModulos.filter((x) => x.link_ativo).sort((a, b) => (a.ordem_menu ?? 999) - (b.ordem_menu ?? 999));
                          return segmentoModulos.map((m) => {
                          const activeIndex = activeOrdered.findIndex((x) => x.id === m.id);
                          const canMoveUp = m.link_ativo && activeIndex > 0;
                          const canMoveDown = m.link_ativo && activeIndex >= 0 && activeIndex < activeOrdered.length - 1;
                          return (
                            <div key={m.id} className="flex items-center gap-2 p-2 rounded border">
                              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                              <Switch
                                checked={!!m.link_ativo}
                                onCheckedChange={async (checked) => {
                                  const next = segmentoModulos.map((x) => ({
                                    modulo_id: x.id,
                                    ativo: x.id === m.id ? checked : !!x.link_ativo,
                                    ordem_menu: x.link_ativo ? (x.ordem_menu ?? 0) : segmentoModulos.filter((y) => y.link_ativo).length,
                                  }));
                                  const withOrder = next.filter((n) => n.ativo).map((n, i) => ({ ...n, ordem_menu: i }));
                                  await updateSegmentoModulos(selectedSegmento.id, withOrder);
                                  const list = await getSegmentoModulos(selectedSegmento.id);
                                  setSegmentoModulos(list);
                                  getSegmentoMenuPreview(selectedSegmento.id).then(setMenuPreview);
                                  loadSegmentos();
                                }}
                              />
                              <span className="flex-1 font-medium min-w-0 truncate">{m.path === '/inventario' ? 'Inventário' : (m.label_menu || m.nome)}</span>
                              <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">{m.path || m.slug}</span>
                              <div className="flex flex-col shrink-0">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  disabled={!canMoveUp}
                                  aria-label="Subir"
                                  onClick={async () => {
                                    if (!canMoveUp || !selectedSegmento) return;
                                    const newOrder = [...activeOrdered];
                                    [newOrder[activeIndex - 1], newOrder[activeIndex]] = [newOrder[activeIndex], newOrder[activeIndex - 1]];
                                    const withOrder = newOrder.map((mod, i) => ({ modulo_id: mod.id, ativo: true, ordem_menu: i }));
                                    await updateSegmentoModulos(selectedSegmento.id, withOrder);
                                    const list = await getSegmentoModulos(selectedSegmento.id);
                                    setSegmentoModulos(list);
                                    getSegmentoMenuPreview(selectedSegmento.id).then(setMenuPreview);
                                    loadSegmentos();
                                    toast.success('Ordem atualizada');
                                  }}
                                >
                                  <ChevronUp className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  disabled={!canMoveDown}
                                  aria-label="Descer"
                                  onClick={async () => {
                                    if (!canMoveDown || !selectedSegmento) return;
                                    const newOrder = [...activeOrdered];
                                    [newOrder[activeIndex], newOrder[activeIndex + 1]] = [newOrder[activeIndex + 1], newOrder[activeIndex]];
                                    const withOrder = newOrder.map((mod, i) => ({ modulo_id: mod.id, ativo: true, ordem_menu: i }));
                                    await updateSegmentoModulos(selectedSegmento.id, withOrder);
                                    const list = await getSegmentoModulos(selectedSegmento.id);
                                    setSegmentoModulos(list);
                                    getSegmentoMenuPreview(selectedSegmento.id).then(setMenuPreview);
                                    loadSegmentos();
                                    toast.success('Ordem atualizada');
                                  }}
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        });
                        })()}
                      </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">Ordem do menu: use as setas ↑↓ para reordenar; módulos ativos são exibidos na ordem definida (ordem_menu).</p>
                    </>
                  )}
                  {!selectedSegmento && <p className="text-muted-foreground">Salve o segmento primeiro para configurar módulos.</p>}
                </TabsContent>
                <TabsContent value="recursos" className="mt-0">
                  {selectedSegmento && (
                    <>
                      <p className="text-sm text-muted-foreground mb-4">Recursos liberados para este segmento (por módulo).</p>
                      {segmentoEditLoading ? (
                        <p className="text-sm text-muted-foreground py-6">Carregando recursos...</p>
                      ) : (segmentoRecursos.modulos?.length ?? 0) === 0 ? (
                        <p className="text-sm text-muted-foreground py-4">Nenhum recurso disponível. Ative módulos na aba Módulos primeiro.</p>
                      ) : (
                      <div className="space-y-4 max-h-[300px] overflow-y-auto">
                        {segmentoRecursos.modulos.map((mod) => (
                          <div key={mod.id}>
                            <p className="font-medium text-sm">{mod.nome}</p>
                            <div className="pl-4 space-y-1">
                              {segmentoRecursos.recursos.filter((r) => r.modulo_id === mod.id).map((r) => (
                                <div key={r.id} className="flex items-center gap-2 text-sm">
                                  <Switch checked={!!r.link_ativo} disabled />
                                  <span>{r.nome}</span>
                                  {r.permission_key && <span className="text-xs text-muted-foreground">({r.permission_key})</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">Os recursos seguem os módulos ativos do segmento. Para alterar, ative/desative módulos na aba Módulos.</p>
                    </>
                  )}
                  {!selectedSegmento && <p className="text-muted-foreground">Salve o segmento primeiro para ver recursos.</p>}
                </TabsContent>
                <TabsContent value="preview" className="mt-0">
                  <p className="text-sm text-muted-foreground mb-4">Como o menu do sistema aparecerá para empresas deste segmento:</p>
                  {segmentoEditLoading ? (
                    <p className="text-sm text-muted-foreground py-6">Carregando prévia...</p>
                  ) : (
                    <>
                      <ul className="space-y-1 list-disc list-inside">
                        {menuPreview.map((m) => (
                          <li key={m.id}><strong>{m.path === '/inventario' ? 'Inventário' : (m.label_menu || m.nome)}</strong> — {m.path || m.slug}</li>
                        ))}
                      </ul>
                      {menuPreview.length === 0 && selectedSegmento && <p className="text-muted-foreground mt-2">Nenhum módulo ativo no segmento. Ative módulos na aba Módulos.</p>}
                    </>
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>
    </ModernLayout>
  );
}

