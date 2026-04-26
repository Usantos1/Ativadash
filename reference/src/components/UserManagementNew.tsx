import React, { useState, useEffect, useMemo } from 'react';
import { from } from '@/integrations/db/client';
import { authAPI } from '@/integrations/auth/api-client';
import { apiClient } from '@/integrations/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Shield, User, Trash2, Edit, Search, Filter, Lock, Unlock, Mail, Phone, Building2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useQuery } from '@tanstack/react-query';
import { useDepartments } from '@/hooks/useDepartments';
import { useCompanySegment } from '@/hooks/useCompanySegment';
import { useAuth } from '@/contexts/AuthContext';
import { getDemoAwareErrorMessage, isDemoSession } from '@/utils/demoMode';

// Tipos de função disponíveis
type UserRoleType = 'admin' | 'gerente' | 'supervisor' | 'vendedor' | 'caixa' | 'estoquista' | 'financeiro' | 'atendente' | 'member';

// Labels das funções em português
const USER_ROLE_LABELS: Record<UserRoleType, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  supervisor: 'Supervisor',
  vendedor: 'Vendedor',
  caixa: 'Operador de Caixa',
  estoquista: 'Estoquista',
  financeiro: 'Financeiro',
  atendente: 'Atendente',
  member: 'Membro'
};

// Descrições das funções
const USER_ROLE_DESCRIPTIONS: Record<UserRoleType, string> = {
  admin: 'Acesso total ao sistema',
  gerente: 'Gerencia equipes, vendas, estoque e relatórios',
  supervisor: 'Supervisiona equipe e operações diárias',
  vendedor: 'Realiza vendas e atendimento ao cliente',
  caixa: 'Opera o caixa e recebe pagamentos',
  estoquista: 'Gerencia entradas e saídas de estoque',
  financeiro: 'Acessa relatórios financeiros e contas',
  atendente: 'Atendimento básico ao cliente',
  member: 'Acesso básico ao sistema'
};

interface UserProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  role: string;
  department: string | null;
  approved: boolean;
  approved_at: string | null;
  created_at: string;
  email?: string;
  phone?: string | null;
}

interface UserRole {
  role_id: string;
  role?: {
    id: string;
    name: string;
    display_name: string;
  };
}

interface UserWithRole extends UserProfile {
  currentRole?: UserRole;
  authEmail?: string;
  isBlocked?: boolean;
}

// Tradução de roles para português
const roleTranslations: Record<string, string> = {
  'admin': 'Administrador',
  'vendedor': 'Vendedor',
  'tecnico': 'Técnico',
  'financeiro': 'Financeiro',
  'rh': 'Recursos Humanos',
  'visualizador': 'Visualizador',
  'gerente': 'Gerente',
  'atendente': 'Atendente',
};

export const UserManagementNew = () => {
  const { toast } = useToast();
  const { departments } = useDepartments();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Obter company_id do usuário logado para filtrar usuários
  const currentCompanyId = currentUser?.company_id;
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [newUserDialogOpen, setNewUserDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserWithRole | null>(null);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    display_name: '',
    department: '',
    role: '' as string,
  });
  const [editFormData, setEditFormData] = useState({
    display_name: '',
    email: '',
    phone: '',
    department: '',
    role: '' as string,
    approved: true,
    password: '',
  });

  const { segmentoSlug } = useCompanySegment();

  // Funções vêm da mesma tabela da aba "Funções" (roles); filtradas pelo segmento da empresa
  const { data: rolesFromApi = [] } = useQuery({
    queryKey: ['roles-for-user-form', segmentoSlug],
    queryFn: async ({ queryKey }) => {
      const seg = queryKey[1] as string | null | undefined;
      const { data, error } = await from('roles')
        .select('id, name, display_name, description, segmento_slug')
        .order('display_name', { ascending: true })
        .execute();
      if (error) throw error;
      const list = (data || []) as { id: string; name: string; display_name: string; description?: string; segmento_slug?: string | null }[];
      return list.filter((r) => r.segmento_slug == null || r.segmento_slug === seg);
    },
  });

  const roleDisplayName = useMemo(() => {
    const map = new Map<string, string>();
    rolesFromApi.forEach((r) => map.set(r.name, r.display_name));
    return (roleName: string) => map.get(roleName) || roleName;
  }, [rolesFromApi]);

  const roleDescription = useMemo(() => {
    const map = new Map<string, string>();
    rolesFromApi.forEach((r) => { if (r.description) map.set(r.name, r.description); });
    return (roleName: string) => map.get(roleName) || '';
  }, [rolesFromApi]);

  useEffect(() => {
    if (currentCompanyId) {
      fetchUsers();
    }
  }, [currentCompanyId]);

  const fetchUsers = async () => {
    try {
      setLoading(true);

      // IMPORTANTE: Filtrar usuários pela mesma empresa do usuário logado
      // Primeiro buscar os user_ids da tabela users que pertencem à mesma empresa
      let usersQuery = from('users').select('id, email, company_id');
      
      // Se o usuário tem company_id, filtrar apenas usuários da mesma empresa
      if (currentCompanyId) {
        usersQuery = usersQuery.eq('company_id', currentCompanyId);
      }
      
      const { data: usersData, error: usersError } = await usersQuery.execute();
      
      if (usersError) {
        console.error('Erro ao buscar usuários:', usersError);
        toast({
          title: "Erro",
          description: getDemoAwareErrorMessage(usersError, "Erro ao carregar usuários"),
          variant: "destructive"
        });
        return;
      }

      // Obter IDs dos usuários da mesma empresa
      const companyUserIds = (usersData || []).map((u: any) => u.id).filter(Boolean);
      
      if (companyUserIds.length === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }

      // Buscar perfis apenas dos usuários da mesma empresa
      const { data: profilesData, error: profilesError } = await from('profiles')
        .select('*')
        .in('user_id', companyUserIds)
        .order('created_at', { ascending: false })
        .execute();

      if (profilesError) {
        toast({
          title: "Erro",
          description: getDemoAwareErrorMessage(profilesError, "Erro ao carregar perfis"),
          variant: "destructive"
        });
        return;
      }

      const profileUserIds = (profilesData || []).map((p: any) => p.user_id).filter(Boolean);

      // Buscar roles dos usuários (sem join/alias no select, pois nosso backend não suporta sintaxe com ":")
      const { data: updRolesData } = await from('user_position_departments')
        .select('user_id, role_id')
        .eq('is_primary', true)
        .not('role_id', 'is', null)
        .execute();

      // Buscar catálogo de roles
      const { data: rolesCatalog } = await from('roles')
        .select('id, name, display_name')
        .execute();

      const roleById = new Map<string, any>();
      (rolesCatalog || []).forEach((r: any) => roleById.set(r.id, r));

      // Mapear profiles por user_id
      const profileByUserId = new Map<string, any>();
      (profilesData || []).forEach((p: any) => {
        if (p?.user_id) profileByUserId.set(p.user_id, p);
      });

      // Mapear emails pelos usuários já buscados
      const emailById = new Map<string, string>();
      (usersData || []).forEach((u: any) => {
        if (u?.id && u?.email) emailById.set(u.id, u.email);
      });

      // Mapear TODOS os usuários, incluindo os sem profile
      const usersWithRolesAndEmails: UserWithRole[] = (usersData || []).map((user: any) => {
        const profile = profileByUserId.get(user.id);
        const roleRow = (updRolesData || []).find((r: any) => r.user_id === user.id);
        const role = roleRow?.role_id ? roleById.get(roleRow.role_id) : undefined;
        const authEmail = emailById.get(user.id) || '';

        // Se não tem profile, criar objeto básico
        if (!profile) {
          return {
            user_id: user.id,
            id: user.id, // Alguns componentes podem usar id ao invés de user_id
            display_name: authEmail.split('@')[0] || 'Sem nome',
            email: authEmail,
            authEmail,
            phone: null,
            department: null,
            role: null,
            approved: false,
            currentRole: roleRow
              ? ({ role_id: roleRow.role_id, role } as any)
              : undefined,
            created_at: user.created_at,
            updated_at: user.updated_at,
          } as UserWithRole;
        }

        // Se tem profile, usar dados do profile
        return {
          ...profile,
          currentRole: roleRow
            ? ({ role_id: roleRow.role_id, role } as any)
            : undefined,
          authEmail,
          email: authEmail || profile.email,
        } as UserWithRole;
      });

      setUsers(usersWithRolesAndEmails);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast({
        title: "Erro",
        description: getDemoAwareErrorMessage(error, "Erro ao carregar usuários"),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm || 
      user.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.authEmail?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDepartment = departmentFilter === 'all' || user.department === departmentFilter;
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'approved' && user.approved) ||
      (statusFilter === 'pending' && !user.approved);

    return matchesSearch && matchesDepartment && matchesStatus;
  });

  const handleEditUser = async (user: UserWithRole) => {
    try {
      // Buscar email do usuário - primeiro tenta do cache local
      let userEmail = user.authEmail || user.email || '';
      
      // Se não tem email, buscar diretamente na tabela users
      if (!userEmail && user.user_id) {
        try {
          const { data: userData } = await from('users')
            .select('email')
            .eq('id', user.user_id)
            .maybeSingle();
          userEmail = userData?.email || '';
        } catch (e) {
          console.warn('Não foi possível buscar email do usuário:', e);
        }
      }

      setEditFormData({
        display_name: user.display_name || '',
        email: userEmail,
        phone: user.phone || '',
        department: user.department || '',
        role: user.role,
        approved: user.approved,
        password: '',
      });
      setSelectedUser(user);
      setEditDialogOpen(true);
    } catch (error: any) {
      console.error('Erro ao carregar dados do usuário:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados do usuário",
        variant: "destructive"
      });
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;

    try {
      setLoading(true);

      // Verificar se o profile existe antes de atualizar
      const { data: existingProfile, error: checkError } = await from('profiles')
        .select('user_id')
        .eq('user_id', selectedUser.user_id)
        .maybeSingle();

      if (checkError) throw checkError;

      // Se não existe profile, criar um novo
      if (!existingProfile) {
        const { error: createError } = await from('profiles')
          .insert({
            user_id: selectedUser.user_id,
            display_name: editFormData.display_name,
            phone: editFormData.phone || null,
            department: editFormData.department || null,
            role: editFormData.role,
            approved: editFormData.approved,
            approved_at: editFormData.approved ? new Date().toISOString() : null,
          });

        if (createError) throw createError;
      } else {
        // Se existe, atualizar
        const { error: profileError } = await from('profiles')
          .update({
            display_name: editFormData.display_name,
            phone: editFormData.phone || null,
            department: editFormData.department || null,
            role: editFormData.role,
            approved: editFormData.approved,
            approved_at: editFormData.approved && !selectedUser.approved ? new Date().toISOString() : selectedUser.approved_at,
          })
          .eq('user_id', selectedUser.user_id);

        if (profileError) throw profileError;
      }

      // Atualizar email e/ou senha via edge function
      const needsAuthUpdate = editFormData.email !== (selectedUser.authEmail || '') || editFormData.password.trim() !== '';
      
      if (needsAuthUpdate) {
        const updateData: any = {};
        if (editFormData.email !== (selectedUser.authEmail || '')) {
          updateData.email = editFormData.email;
        }
        if (editFormData.password.trim() !== '') {
          updateData.password = editFormData.password;
        }

        const { error: authError } = await apiClient.invokeFunction('admin-update-user', {
          userId: selectedUser.user_id,
          ...updateData
        });

        if (authError) {
          console.error('Erro ao atualizar auth:', authError);
          toast({
            title: "Aviso",
            description: "Perfil atualizado, mas houve erro ao atualizar email/senha. Verifique se o email é válido.",
            variant: "destructive"
          });
        }
      }

      toast({
        title: "Sucesso",
        description: selectedUser.user_id !== currentUser?.id
          ? "Usuário atualizado. Se alterou a função, peça ao usuário para sair e entrar novamente para as permissões terem efeito."
          : "Usuário atualizado com sucesso",
      });

      // Se o admin editou o próprio usuário, atualizar o profile e permissões no contexto
      if (selectedUser.user_id === currentUser?.id) {
        window.dispatchEvent(new CustomEvent('profile-changed'));
        window.dispatchEvent(new CustomEvent('permissions-changed'));
      }

      setEditDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Erro ao atualizar usuário:', error);
      console.error('Detalhes do erro:', JSON.stringify(error, null, 2));
      toast({
        title: "Erro",
        description: error?.message || error?.error?.message || "Erro ao atualizar usuário",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBlockUser = async (user: UserWithRole) => {
    try {
      const { error } = await from('profiles')
        .update({
          approved: !user.approved,
          approved_at: !user.approved ? new Date().toISOString() : null,
          approved_by: !user.approved ? (await authAPI.getCurrentUser()).data.user?.id : null
        })
        .eq('user_id', user.user_id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: user.approved ? "Usuário bloqueado com sucesso" : "Usuário desbloqueado com sucesso",
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao bloquear/desbloquear usuário",
        variant: "destructive"
      });
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      setLoading(true);

      const userId = userToDelete.user_id;
      const { data, error } = await apiClient.invokeFunction('admin-delete-user', { userId });
      if (error) {
        const errAny = error as any;
        throw new Error(errAny?.data?.error || errAny?.message || 'Erro ao excluir usuário');
      }
      if (!data?.data?.success && !data?.success) {
        throw new Error('Falha ao excluir usuário');
      }

      toast({
        title: "Sucesso",
        description: "Usuário excluído com sucesso",
      });

      setDeleteDialogOpen(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Erro ao excluir usuário:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir usuário",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const approveUser = async (userId: string) => {
    try {
      const currentUserData = await authAPI.getCurrentUser();
      const approvedBy = currentUserData.data?.user?.id;
      
      const { error } = await from('profiles')
        .update({
          approved: true,
          approved_at: new Date().toISOString(),
          approved_by: approvedBy
        })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Usuário aprovado com sucesso",
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao aprovar usuário",
        variant: "destructive"
      });
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDemoSession()) {
      toast({
        title: "Conta demonstração",
        description: "Funcionalidade não disponível na conta demonstração. Cadastre-se para criar usuários.",
        variant: "destructive"
      });
      return;
    }
    if (!newUser.email || !newUser.password || !newUser.display_name || !newUser.department) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    try {
      // Criar usuário via API PostgreSQL
      // IMPORTANTE: Passar company_id para associar usuário à empresa correta
      const authResponse = await authAPI.signup(
        newUser.email,
        newUser.password,
        {
          display_name: newUser.display_name,
          department: newUser.department,
          role: newUser.role,
          company_id: currentCompanyId, // Associar à mesma empresa do admin
        }
      );

      // authResponse retorna { data: { user }, error }
      const newCreatedUser = authResponse.data?.user;
      
      if (authResponse.error) {
        throw new Error(authResponse.error.message || 'Erro ao criar usuário');
      }
      
      if (newCreatedUser) {
        const { error: profileError } = await from('profiles')
          .update({
            display_name: newUser.display_name,
            department: newUser.department,
            role: newUser.role,
            approved: true,
            approved_at: new Date().toISOString(),
            approved_by: (await authAPI.getCurrentUser()).data.user?.id
          })
          .eq('user_id', newCreatedUser.id)
          .execute();

        if (profileError) {
          console.error('Error updating profile:', profileError);
        }
      }

      toast({
        title: "Sucesso",
        description: "Usuário criado e aprovado automaticamente",
      });

      setNewUser({
        email: '',
        password: '',
        display_name: '',
        department: '',
        role: rolesFromApi[0]?.name ?? '',
      });
      setNewUserDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: getDemoAwareErrorMessage(error, "Erro ao criar usuário"),
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const pendingUsers = filteredUsers.filter(user => !user.approved);
  const approvedUsers = filteredUsers.filter(user => user.approved);

  return (
    <div className="space-y-6">
      {/* Header com busca e filtros */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Gestão de Usuários e Permissões
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Gerencie usuários, funções e permissões do sistema
              </p>
            </div>
            {!isDemoSession() && (
            <Button onClick={() => {
              setNewUser(prev => ({ ...prev, role: rolesFromApi[0]?.name ?? prev.role ?? '' }));
              setNewUserDialogOpen(true);
            }}>
              <UserPlus className="h-4 w-4 mr-2" />
              Novo Usuário
            </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Departamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os departamentos</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="approved">Aprovados</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Usuários Pendentes */}
      {pendingUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Usuários Pendentes ({pendingUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Data de Registro</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.display_name || 'Sem nome'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        {user.authEmail || user.email || '-'}
                      </div>
                    </TableCell>
                    <TableCell>{user.department || '-'}</TableCell>
                    <TableCell>
                      {new Date(user.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => approveUser(user.user_id)}>
                          Aprovar
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => {
                            setUserToDelete(user);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Excluir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Usuários Aprovados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Usuários Aprovados ({approvedUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[70vh] overflow-auto scrollbar-thin">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {approvedUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {user.display_name || 'Sem nome'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      {user.authEmail || user.email || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3 w-3 text-muted-foreground" />
                      {user.department || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'admin' || user.role === 'Administrador' ? 'default' : user.role === 'gerente' || user.role === 'Gerente' ? 'default' : 'secondary'}>
                      {roleDisplayName(user.role)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.approved ? 'default' : 'destructive'}>
                      {user.approved ? 'Ativo' : 'Bloqueado'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditUser(user)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBlockUser(user)}
                      >
                        {user.approved ? (
                          <>
                            <Lock className="h-4 w-4 mr-1" />
                            Bloquear
                          </>
                        ) : (
                          <>
                            <Unlock className="h-4 w-4 mr-1" />
                            Desbloquear
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setUserToDelete(user);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Excluir
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Editar Usuário */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Edite as informações do usuário. Deixe a senha em branco para não alterá-la.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit_display_name">Nome Completo *</Label>
                <Input
                  id="edit_display_name"
                  value={editFormData.display_name}
                  onChange={(e) => setEditFormData({ ...editFormData, display_name: e.target.value })}
                  placeholder="Nome do usuário"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_email">Email *</Label>
                <Input
                  id="edit_email"
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  placeholder="email@empresa.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_phone">Telefone</Label>
                <Input
                  id="edit_phone"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_department">Departamento *</Label>
                <Select 
                  value={editFormData.department} 
                  onValueChange={(value) => setEditFormData({ ...editFormData, department: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_role">Função *</Label>
                <Select 
                  value={editFormData.role || undefined} 
                  onValueChange={(value: string) => setEditFormData({ ...editFormData, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={rolesFromApi.length === 0 ? "Carregando funções..." : "Selecione a função"} />
                  </SelectTrigger>
                  <SelectContent>
                    {rolesFromApi.map((r) => (
                      <SelectItem key={r.id} value={r.name}>
                        {r.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editFormData.role && roleDescription(editFormData.role) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {roleDescription(editFormData.role)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Para alterar o que cada função pode acessar, use a aba <strong>Funções</strong> nesta página.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_password">Nova Senha</Label>
                <Input
                  id="edit_password"
                  type="password"
                  value={editFormData.password}
                  onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                  placeholder="Deixe em branco para não alterar"
                />
                <p className="text-xs text-muted-foreground">
                  Deixe em branco se não quiser alterar a senha
                </p>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="edit_approved">Status do Usuário</Label>
                  <p className="text-sm text-muted-foreground">
                    {editFormData.approved ? 'Usuário está ativo e pode acessar o sistema' : 'Usuário está bloqueado e não pode acessar'}
                  </p>
                </div>
                <Switch
                  id="edit_approved"
                  checked={editFormData.approved}
                  onCheckedChange={(checked) => setEditFormData({ ...editFormData, approved: checked })}
                />
              </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => {
              setEditDialogOpen(false);
              setSelectedUser(null);
            }}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Criar Novo Usuário */}
      <Dialog open={newUserDialogOpen} onOpenChange={setNewUserDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Novo Usuário</DialogTitle>
            <DialogDescription>
              Preencha os dados para criar um novo usuário no sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                placeholder="email@empresa.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo *</Label>
              <Input
                id="nome"
                value={newUser.display_name}
                onChange={(e) => setNewUser({...newUser, display_name: e.target.value})}
                placeholder="Nome do usuário"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senha">Senha Temporária *</Label>
              <Input
                id="senha"
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Departamento *</Label>
              <Select value={newUser.department} onValueChange={(value) => setNewUser({...newUser, department: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {departments.map(dept => (
                    <SelectItem key={dept.id} value={dept.nome}>{dept.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Função *</Label>
              <Select value={newUser.role || undefined} onValueChange={(value: string) => setNewUser({...newUser, role: value})}>
                <SelectTrigger>
                  <SelectValue placeholder={rolesFromApi.length === 0 ? "Carregando funções..." : "Selecione a função"} />
                </SelectTrigger>
                <SelectContent>
                  {rolesFromApi.map((r) => (
                    <SelectItem key={r.id} value={r.name}>
                      {r.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {newUser.role && roleDescription(newUser.role) && (
                <p className="text-xs text-muted-foreground">
                  {roleDescription(newUser.role)}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewUserDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => createUser({ preventDefault: () => {} } as React.FormEvent)} disabled={loading || !newUser.role || rolesFromApi.length === 0}>
              {loading ? 'Criando...' : 'Criar Usuário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o usuário <strong>{userToDelete?.display_name}</strong>?
              Esta ação não pode ser desfeita e irá remover todos os dados do usuário do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeleteDialogOpen(false);
              setUserToDelete(null);
            }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-destructive text-destructive-foreground"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Novo Usuário */}
      <Dialog open={newUserDialogOpen} onOpenChange={setNewUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Usuário</DialogTitle>
            <DialogDescription>
              Preencha os dados para criar um novo usuário no sistema.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                placeholder="email@empresa.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="display_name">Nome Completo *</Label>
              <Input
                id="display_name"
                value={newUser.display_name}
                onChange={(e) => setNewUser({...newUser, display_name: e.target.value})}
                placeholder="Nome do usuário"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha Temporária *</Label>
              <Input
                id="password"
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                placeholder="Senha inicial"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Departamento *</Label>
              <Select value={newUser.department} onValueChange={(value) => setNewUser({...newUser, department: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o departamento" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Função *</Label>
              <Select value={newUser.role || undefined} onValueChange={(value: string) => setNewUser({...newUser, role: value})}>
                <SelectTrigger>
                  <SelectValue placeholder={rolesFromApi.length === 0 ? "Carregando funções..." : "Selecione a função"} />
                </SelectTrigger>
                <SelectContent>
                  {rolesFromApi.map((r) => (
                    <SelectItem key={r.id} value={r.name}>
                      {r.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {newUser.role && roleDescription(newUser.role) && (
                <p className="text-xs text-muted-foreground">
                  {roleDescription(newUser.role)}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewUserDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!newUser.role || rolesFromApi.length === 0}>Criar Usuário</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

