import React, { useState, useEffect } from 'react';
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Check, X, UserPlus, Mail, Calendar, Shield, User, Trash2, Edit, Plus, Star } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useDepartments } from '@/hooks/useDepartments';
import { usePositions, Position } from '@/hooks/usePositions';
import { TeamPermissionsManager } from '@/components/TeamPermissionsManager';
import { UserPermissionsManager } from '@/components/UserPermissionsManager';
import { useAuth } from '@/contexts/AuthContext';

interface UserProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  role: 'admin' | 'member';
  department: string | null;
  approved: boolean;
  approved_at: string | null;
  created_at: string;
  email?: string;
  phone?: string | null;
}

interface UserPosition {
  id: string;
  user_id: string;
  position_id: string;
  department_name: string;
  is_primary: boolean;
  position?: Position;
}

interface UserWithPositions extends UserProfile {
  positions: UserPosition[];
}

export const UserManagement = () => {
  const { toast } = useToast();
  const { departments } = useDepartments();
  const { positions, loading: positionsLoading } = usePositions();
  const [users, setUsers] = useState<UserWithPositions[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<UserWithPositions | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    display_name: '',
    department: '',
    role: 'member' as 'admin' | 'member',
    selectedPositions: [] as string[]
  });
  const [newDepartment, setNewDepartment] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      // Buscar perfis
      const { data: profilesData, error: profilesError } = await from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .execute();

      if (profilesError) {
        toast({
          title: "Erro",
          description: "Erro ao carregar usuários",
          variant: "destructive"
        });
        return;
      }

      // Buscar posições dos usuários
      const { data: positionsData, error: positionsError } = await from('user_position_departments')
        .select('*, position:positions(*)')
        .execute();

      if (positionsError) {
        console.error('Error fetching positions:', positionsError);
      }

      // Combinar dados
      const usersWithPositions: UserWithPositions[] = (profilesData || []).map(profile => {
        const userPositions = (positionsData || [])
          .filter((up: any) => up.user_id === profile.user_id)
          .map((up: any) => ({
            id: up.id,
            user_id: up.user_id,
            position_id: up.position_id,
            department_name: up.department_name,
            is_primary: up.is_primary || false,
            position: up.position
          }));

        return {
          ...profile,
          role: (profile.role === 'admin' || profile.role === 'member') ? profile.role : 'member',
          positions: userPositions
        } as UserWithPositions;
      });

      setUsers(usersWithPositions);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateUserPositions = async (userId: string, positionIds: string[], departmentName: string, primaryPositionId?: string) => {
    try {
      // Remover todas as posições atuais do usuário neste departamento
      const { error: deleteError } = await from('user_position_departments')
        .delete()
        .eq('user_id', userId)
        .eq('department_name', departmentName)
        .execute();

      if (deleteError) {
        throw deleteError;
      }

      // Adicionar novas posições
      if (positionIds.length > 0) {
        const positionsToInsert = positionIds.map((positionId, index) => ({
          user_id: userId,
          position_id: positionId,
          department_name: departmentName,
          is_primary: primaryPositionId === positionId || (index === 0 && !primaryPositionId)
        }));

        const { error: insertError } = await from('user_position_departments')
          .insert(positionsToInsert)
          .execute();

        if (insertError) {
          throw insertError;
        }
      }

      toast({
        title: "Sucesso",
        description: "Cargos atualizados com sucesso",
      });

      fetchUsers();
    } catch (error: any) {
      console.error('Error updating positions:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar cargos",
        variant: "destructive"
      });
    }
  };

  const approveUser = async (userId: string) => {
    try {
      const { error } = await from('profiles')
        .update({
          approved: true,
          approved_at: new Date().toISOString(),
          approved_by: (await authAPI.getUser()).data.user?.id
        })
        .eq('user_id', userId)
        .execute();

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

  const rejectUser = async (userId: string) => {
    try {
      const { error } = await from('profiles')
        .update({
          approved: false,
          approved_at: null,
          approved_by: null
        })
        .eq('user_id', userId)
        .execute();

      if (error) throw error;

      toast({
        title: "Usuário rejeitado",
        description: "Acesso removido do usuário",
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao rejeitar usuário",
        variant: "destructive"
      });
    }
  };

  const updateUserRole = async (userId: string, role: 'admin' | 'member') => {
    try {
      const { error } = await from('profiles')
        .update({ role })
        .eq('user_id', userId)
        .execute();

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Função do usuário atualizada",
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar função",
        variant: "destructive"
      });
    }
  };

  const updateUserDepartment = async (userId: string, department: string) => {
    try {
      const { error } = await from('profiles')
        .update({ department })
        .eq('user_id', userId)
        .execute();

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Departamento atualizado",
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar departamento",
        variant: "destructive"
      });
    }
  };

  const deleteUser = async (userId: string, displayName: string) => {
    try {
      const { user } = useAuth();
      
      if (user?.id === userId) {
        toast({
          title: "Erro",
          description: "Você não pode excluir sua própria conta",
          variant: "destructive"
        });
        return;
      }

      const { data: result, error: deleteError } = await apiClient.invokeFunction('admin-delete-user', {
        userId
      });

      if (deleteError) throw deleteError;

      if (result?.success) {
        toast({
          title: result.warning ? "Aviso" : "Sucesso",
          description: result.message || `Usuário ${displayName} excluído`,
          variant: result.warning ? "default" : "default"
        });
      } else {
        throw new Error(result?.error || "Erro ao excluir usuário");
      }

      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir usuário",
        variant: "destructive"
      });
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalDepartment = newUser.department;
    
    if (newDepartment.trim()) {
      try {
        const { data: userData } = await authAPI.getUser();
        const { data: deptData, error: deptError } = await from('departments')
          .insert({
            name: newDepartment.trim(),
            created_by: userData.user?.id
          })
          .select()
          .single()
          .execute();

        if (deptError) throw deptError;
        
        finalDepartment = newDepartment.trim();
        setNewDepartment('');
      } catch (error: any) {
        toast({
          title: "Erro",
          description: error.message || "Erro ao criar departamento",
          variant: "destructive"
        });
        return;
      }
    }
    
    if (!newUser.email || !newUser.password || !newUser.display_name || !finalDepartment) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    try {
      // Criar usuário via API PostgreSQL
      const authResponse = await authAPI.signup({
        email: newUser.email,
        password: newUser.password,
        display_name: newUser.display_name,
        department: finalDepartment,
        role: newUser.role,
      });

      if (authResponse.user) {
        const { error: profileError } = await from('profiles')
          .update({
            display_name: newUser.display_name,
            department: finalDepartment,
            role: newUser.role,
            approved: true,
            approved_at: new Date().toISOString(),
            approved_by: (await authAPI.getUser()).data.user?.id
          })
          .eq('user_id', authResponse.user.id)
          .execute();

        if (profileError) {
          console.error('Error updating profile:', profileError);
        }

        // Adicionar cargos se selecionados
        if (newUser.selectedPositions.length > 0) {
          const positionsToInsert = newUser.selectedPositions.map((positionId, index) => ({
            user_id: authData.user.id,
            position_id: positionId,
            department_name: finalDepartment,
            is_primary: index === 0
          }));

          const { error: positionsError } = await from('user_position_departments')
            .insert(positionsToInsert)
            .execute();

          if (positionsError) {
            console.error('Error adding positions:', positionsError);
          }
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
        role: 'member',
        selectedPositions: []
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar usuário",
        variant: "destructive"
      });
    }
  };

  if (loading || positionsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const pendingUsers = users.filter(user => !user.approved);
  const approvedUsers = users.filter(user => user.approved);

  return (
    <div className="space-y-6">
      {/* Team Permissions Management */}
      <TeamPermissionsManager />

      {/* Create New User */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Adicionar Novo Membro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <Label htmlFor="display_name">Nome Completo *</Label>
                <Input
                  id="display_name"
                  value={newUser.display_name}
                  onChange={(e) => setNewUser({...newUser, display_name: e.target.value})}
                  placeholder="Nome do usuário"
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
                <div className="flex gap-2 items-center">
                  <span className="text-sm text-muted-foreground">ou</span>
                  <Input
                    placeholder="Criar novo departamento"
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Função</Label>
                <Select value={newUser.role} onValueChange={(value: 'admin' | 'member') => setNewUser({...newUser, role: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Membro</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Cargos</Label>
                <Select 
                  value="" 
                  onValueChange={(value) => {
                    if (!newUser.selectedPositions.includes(value)) {
                      setNewUser({
                        ...newUser,
                        selectedPositions: [...newUser.selectedPositions, value]
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Adicionar cargo" />
                  </SelectTrigger>
                  <SelectContent>
                    {positions
                      .filter(p => !newUser.selectedPositions.includes(p.id))
                      .map((position) => (
                        <SelectItem key={position.id} value={position.id}>
                          {position.name} (Nível {position.level})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {newUser.selectedPositions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {newUser.selectedPositions.map((positionId) => {
                      const position = positions.find(p => p.id === positionId);
                      return position ? (
                        <Badge key={positionId} variant="secondary" className="flex items-center gap-1">
                          {position.name}
                          <button
                            type="button"
                            onClick={() => {
                              setNewUser({
                                ...newUser,
                                selectedPositions: newUser.selectedPositions.filter(id => id !== positionId)
                              });
                            }}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            </div>

            <Button type="submit" className="w-full">
              <UserPlus className="h-4 w-4 mr-2" />
              Criar Usuário
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Pending Approvals */}
      {pendingUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Usuários Pendentes de Aprovação ({pendingUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Data de Registro</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {user.display_name || 'Sem nome'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {new Date(user.created_at).toLocaleDateString('pt-BR')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="default"
                          onClick={() => approveUser(user.user_id)}
                        >
                          <Check className="h-4 w-4" />
                          Aprovar
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => rejectUser(user.user_id)}
                        >
                          <X className="h-4 w-4" />
                          Rejeitar
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setEditingUser(user);
                            setIsEditModalOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                          Editar
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive">
                              <Trash2 className="h-4 w-4" />
                              Excluir
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar Exclusão Permanente</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir permanentemente o usuário "{user.display_name || 'Sem nome'}"? 
                                Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => deleteUser(user.user_id, user.display_name || 'Usuário')}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir Permanentemente
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Approved Users */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Usuários Aprovados ({approvedUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Cargos</TableHead>
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
                    <Select 
                      value={user.department || ''} 
                      onValueChange={(value) => updateUserDepartment(user.user_id, value)}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Departamento" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <UserPositionsManager 
                      user={user}
                      positions={positions}
                      departments={departments}
                      onUpdate={() => fetchUsers()}
                    />
                  </TableCell>
                  <TableCell>
                    <Select 
                      value={user.role} 
                      onValueChange={(value: 'admin' | 'member') => updateUserRole(user.user_id, value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Membro</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.approved ? 'default' : 'secondary'}>
                      {user.approved ? 'Aprovado' : 'Pendente'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <UserPermissionsButton user={user} onUpdate={fetchUsers} />
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          setEditingUser(user);
                          setIsEditModalOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                        Editar
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => rejectUser(user.user_id)}
                      >
                        <X className="h-4 w-4" />
                        Remover Acesso
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive">
                            <Trash2 className="h-4 w-4" />
                            Excluir
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar Exclusão Permanente</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir permanentemente o usuário "{user.display_name || 'Sem nome'}"? 
                              Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => deleteUser(user.user_id, user.display_name || 'Usuário')}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Excluir Permanentemente
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

// Componente para gerenciar cargos do usuário
const UserPositionsManager = ({ 
  user, 
  positions, 
  departments,
  onUpdate 
}: { 
  user: UserWithPositions; 
  positions: Position[];
  departments: any[];
  onUpdate: () => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(user.department || '');
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [primaryPosition, setPrimaryPosition] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && user) {
      setSelectedDepartment(user.department || '');
      const userPositions = user.positions.filter(p => p.department_name === (user.department || ''));
      setSelectedPositions(userPositions.map(p => p.position_id));
      const primary = userPositions.find(p => p.is_primary);
      setPrimaryPosition(primary?.position_id || '');
    }
  }, [isOpen, user]);

  const handleSave = async () => {
    if (!selectedDepartment) {
      toast({
        title: "Erro",
        description: "Selecione um departamento",
        variant: "destructive"
      });
      return;
    }

    try {
      // Remover posições antigas deste departamento
      const { error: deleteError } = await from('user_position_departments')
        .delete()
        .eq('user_id', user.user_id)
        .eq('department_name', selectedDepartment)
        .execute();

      if (deleteError) throw deleteError;

      // Adicionar novas posições
      if (selectedPositions.length > 0) {
        const positionsToInsert = selectedPositions.map((positionId) => ({
          user_id: user.user_id,
          position_id: positionId,
          department_name: selectedDepartment,
          is_primary: primaryPosition === positionId || (selectedPositions[0] === positionId && !primaryPosition)
        }));

        const { error: insertError } = await from('user_position_departments')
          .insert(positionsToInsert)
          .execute();

        if (insertError) throw insertError;
      }

      toast({
        title: "Sucesso",
        description: "Cargos atualizados com sucesso",
      });

      setIsOpen(false);
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar cargos",
        variant: "destructive"
      });
    }
  };

  const userPositionsInDept = user.positions.filter(p => p.department_name === (user.department || ''));
  const positionNames = userPositionsInDept
    .map(up => {
      const pos = positions.find(p => p.id === up.position_id);
      return pos ? `${pos.name}${up.is_primary ? ' ⭐' : ''}` : null;
    })
    .filter(Boolean)
    .join(', ') || 'Nenhum';

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start">
          <Plus className="h-4 w-4 mr-2" />
          {positionNames || 'Adicionar cargos'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gerenciar Cargos - {user.display_name}</DialogTitle>
          <DialogDescription>
            Selecione múltiplos cargos para este usuário. O cargo principal será marcado com ⭐.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Departamento</Label>
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
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
            <Label>Cargos Disponíveis</Label>
            <div className="border rounded-md p-4 max-h-60 overflow-y-auto space-y-2">
              {positions.map((position) => (
                <div key={position.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`position-${position.id}`}
                    checked={selectedPositions.includes(position.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedPositions([...selectedPositions, position.id]);
                        if (!primaryPosition) {
                          setPrimaryPosition(position.id);
                        }
                      } else {
                        setSelectedPositions(selectedPositions.filter(id => id !== position.id));
                        if (primaryPosition === position.id) {
                          setPrimaryPosition(selectedPositions.find(id => id !== position.id) || '');
                        }
                      }
                    }}
                  />
                  <Label 
                    htmlFor={`position-${position.id}`}
                    className="flex-1 cursor-pointer flex items-center justify-between"
                  >
                    <span>{position.name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Nível {position.level}</Badge>
                      {selectedPositions.includes(position.id) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPrimaryPosition(position.id);
                          }}
                          className="text-yellow-500 hover:text-yellow-600"
                        >
                          {primaryPosition === position.id ? (
                            <Star className="h-4 w-4 fill-yellow-500" />
                          ) : (
                            <Star className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </Label>
                </div>
              ))}
            </div>
            {selectedPositions.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {selectedPositions.length} cargo(s) selecionado(s)
                {primaryPosition && (
                  <span className="ml-2">
                    • Principal: {positions.find(p => p.id === primaryPosition)?.name}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            Salvar Cargos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Componente para botão de gerenciar permissões
const UserPermissionsButton = ({ 
  user, 
  onUpdate 
}: { 
  user: UserWithPositions; 
  onUpdate: () => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Shield className="h-4 w-4 mr-2" />
          Permissões
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Permissões - {user.display_name}</DialogTitle>
          <DialogDescription>
            Configure as permissões de acesso deste usuário. Você pode selecionar um role predefinido ou definir permissões customizadas.
          </DialogDescription>
        </DialogHeader>
        <UserPermissionsManager
          userId={user.user_id}
          onClose={() => setIsOpen(false)}
          onSave={() => {
            onUpdate();
            setIsOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
};
