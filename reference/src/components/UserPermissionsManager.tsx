import { useState, useEffect } from 'react';
import { from } from '@/integrations/db/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useCompanySegment } from '@/hooks/useCompanySegment';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shield, User, X, History } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { dateFormatters } from '@/utils/formatters';

interface Permission {
  id: string;
  resource: string;
  action: string;
  description: string;
  category: string;
}

interface Role {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  is_system: boolean;
  segmento_slug?: string | null;
}

interface UserPermission {
  permission_id: string;
  granted: boolean;
  permission?: Permission;
}

interface Props {
  userId: string;
  onClose: () => void;
  onSave: () => void;
}

interface PermissionHistory {
  id: string;
  change_type: string;
  resource: string | null;
  action: string | null;
  role_name: string | null;
  description: string | null;
  created_at: string;
  changed_by: string | null;
  changed_by_display_name?: string | null;
}

export function UserPermissionsManager({ userId, onClose, onSave }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { segmentoSlug } = useCompanySegment();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [customPermissions, setCustomPermissions] = useState<Map<string, boolean>>(new Map());
  const [permissionHistory, setPermissionHistory] = useState<PermissionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [userId, segmentoSlug]);

  const getDefaultDepartmentName = async (): Promise<string> => {
    const { data: profileData } = await from('profiles')
      .select('department')
      .eq('user_id', userId)
      .maybeSingle();
    return (profileData as any)?.department || 'Geral';
  };

  const getDefaultPositionId = async (): Promise<string | null> => {
    // Pega a posição com maior nível como default (fallback)
    const { data: positionData } = await from('positions')
      .select('id')
      .order('level', { ascending: false })
      .limit(1)
      .maybeSingle();
    return (positionData as any)?.id || null;
  };

  const ensurePrimaryUserPositionDepartment = async (): Promise<{ id: string } | null> => {
    // 1) Se já existe primário, use.
    const { data: primary } = await from('user_position_departments')
      .select('id, position_id, department_name')
      .eq('user_id', userId)
      .eq('is_primary', true)
      .maybeSingle();

    if ((primary as any)?.id) {
      return { id: (primary as any).id };
    }

    // 2) Se existe algum registro, promova para primário.
    const { data: anyRecord } = await from('user_position_departments')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if ((anyRecord as any)?.id) {
      const { error: promoteError } = await from('user_position_departments')
        .update({ is_primary: true })
        .eq('id', (anyRecord as any).id)
        .execute();

      if (promoteError) {
        console.error('Erro ao promover registro existente:', promoteError);
        return null;
      }

      return { id: (anyRecord as any).id };
    }

    // 3) Se não existe nada, crie com position_id + department_name válidos.
    const [departmentName, positionId] = await Promise.all([
      getDefaultDepartmentName(),
      getDefaultPositionId(),
    ]);

    if (!positionId) {
      toast({
        title: 'Erro',
        description: 'Não existe nenhum cargo cadastrado em "positions". Cadastre um cargo primeiro para atribuir role.',
        variant: 'destructive',
      });
      return null;
    }

    const { data: inserted, error: insertError } = await from('user_position_departments')
      .insert({
        user_id: userId,
        position_id: positionId,
        department_name: departmentName,
        is_primary: true,
      })
      .single();

    if (insertError) {
      console.error('Erro ao criar registro primário (user_position_departments):', insertError);
      return null;
    }

    return inserted?.id ? { id: inserted.id } : null;
  };

  const loadData = async () => {
    try {
      setLoading(true);

      // Carregar todas as permissões
      const { data: permsData } = await from('permissions')
        .select('*')
        .order('category', { ascending: true })
        .order('resource', { ascending: true })
        .order('action', { ascending: true })
        .execute();

      if (permsData) {
        setPermissions(permsData as Permission[]);
      }

      // Carregar roles (globais + do segmento da empresa)
      const { data: rolesData } = await from('roles')
        .select('*')
        .order('display_name', { ascending: true })
        .execute();

      if (rolesData) {
        const allRoles = rolesData as Role[];
        const filtered = allRoles.filter(
          (r) => r.segmento_slug == null || r.segmento_slug === segmentoSlug
        );
        setRoles(filtered);
      }

      // Carregar role atual do usuário
      const { data: userRoleData } = await from('user_position_departments')
        .select('role_id')
        .eq('user_id', userId)
        .eq('is_primary', true)
        .maybeSingle();

      if (userRoleData?.role_id) {
        setSelectedRoleId(userRoleData.role_id);
      } else {
        setSelectedRoleId('');
      }

      // Carregar permissões customizadas do usuário
      const { data: userPermsData } = await from('user_permissions')
        .select('permission_id, granted')
        .eq('user_id', userId)
        .execute();

      if (userPermsData) {
        const permMap = new Map<string, boolean>();
        userPermsData.forEach((up: any) => {
          const perm = (permsData as any[])?.find((p: any) => p.id === up.permission_id);
          if (!perm) return;
          const key = `${perm.resource}.${perm.action}`;
          permMap.set(key, up.granted);
        });
        setCustomPermissions(permMap);
      }

      // Carregar histórico de alterações
      const { data: historyData } = await from('permission_changes_history')
        .select('id, change_type, resource, action, role_name, description, created_at, changed_by')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)
        .execute();

      if (historyData) {
        const changerIds = Array.from(
          new Set((historyData as any[]).map(h => h.changed_by).filter(Boolean))
        );

        let namesByUserId = new Map<string, string | null>();
        if (changerIds.length > 0) {
          const { data: profilesData } = await from('profiles')
            .select('user_id, display_name')
            .in('user_id', changerIds)
            .execute();

          (profilesData as any[] | null)?.forEach((p: any) => {
            namesByUserId.set(p.user_id, p.display_name || null);
          });
        }

        setPermissionHistory(
          (historyData as any[]).map((h: any) => ({
            ...h,
            changed_by_display_name: h.changed_by ? (namesByUserId.get(h.changed_by) ?? null) : null,
          })) as PermissionHistory[]
        );
      }
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar permissões',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (roleId: string) => {
    const finalRoleId = roleId === 'none' ? '' : roleId;
    setSelectedRoleId(finalRoleId);

    // Se selecionou um role, atualizar user_position_departments
    if (finalRoleId) {
      const ensured = await ensurePrimaryUserPositionDepartment();
      if (!ensured?.id) return;

      const { error: updateError } = await from('user_position_departments')
        .update({ role_id: finalRoleId })
        .eq('id', ensured.id)
        .execute();

      if (updateError) {
        console.error('Erro ao atualizar role:', updateError);
        toast({
          title: 'Erro',
          description: 'Erro ao salvar role do usuário',
          variant: 'destructive',
        });
      }
    } else {
      // Remover role se selecionou "none"
      const { data: updData } = await from('user_position_departments')
        .select('id')
        .eq('user_id', userId)
        .eq('is_primary', true)
        .maybeSingle();

      if (updData) {
        await from('user_position_departments')
          .update({ role_id: null })
          .eq('id', updData.id)
          .execute();
      }
    }
  };

  const handlePermissionToggle = (permission: Permission, granted: boolean) => {
    const key = `${permission.resource}.${permission.action}`;
    const newMap = new Map(customPermissions);
    newMap.set(key, granted);
    setCustomPermissions(newMap);
  };

  const logPermissionChange = async (
    changeType: string,
    resource: string | null,
    action: string | null,
    roleId: string | null,
    roleName: string | null,
    description: string
  ) => {
    if (!user?.id) return;

    try {
      await from('permission_changes_history')
        .insert({
          user_id: userId,
          changed_by: user.id,
          change_type: changeType,
          resource,
          action,
          role_id: roleId,
          role_name: roleName,
          description,
        });
    } catch (error) {
      console.error('Erro ao registrar histórico:', error);
      // Não falhar o processo se o log falhar
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Buscar role anterior para histórico
      const { data: oldRoleData } = await from('user_position_departments')
        .select('role_id')
        .eq('user_id', userId)
        .eq('is_primary', true)
        .maybeSingle();

      const oldRoleId = (oldRoleData as any)?.role_id || null;
      const oldRoleName = oldRoleId ? (roles.find(r => r.id === oldRoleId)?.display_name || null) : null;

      // Salvar role se selecionado
      if (selectedRoleId) {
        const selectedRole = roles.find(r => r.id === selectedRoleId);

        const ensured = await ensurePrimaryUserPositionDepartment();
        if (!ensured?.id) return;

        const { error: updateError } = await from('user_position_departments')
          .update({ role_id: selectedRoleId })
          .eq('id', ensured.id)
          .execute();

        if (updateError) {
          console.error('Erro ao atualizar role:', updateError);
          toast({
            title: 'Erro',
            description: 'Erro ao salvar role do usuário',
            variant: 'destructive',
          });
          return;
        }

        // Log de mudança de role
        if (oldRoleName !== selectedRole?.display_name) {
          await logPermissionChange(
            oldRoleName ? 'role_changed' : 'role_assigned',
            null,
            null,
            selectedRoleId,
            selectedRole?.display_name || null,
            oldRoleName
              ? `Role alterado de "${oldRoleName}" para "${selectedRole?.display_name}"`
              : `Role "${selectedRole?.display_name}" atribuído`
          );
        }
      } else if (oldRoleName) {
        // Remover role se não há seleção
        const { data: updData } = await from('user_position_departments')
          .select('id')
          .eq('user_id', userId)
          .eq('is_primary', true)
          .maybeSingle();

        if (updData) {
          await from('user_position_departments')
            .update({ role_id: null })
            .eq('id', updData.id)
            .execute();
        }

        // Log de remoção de role
        await logPermissionChange(
          'role_removed',
          null,
          null,
          null,
          oldRoleName,
          `Role "${oldRoleName}" removido`
        );
      }

      // Buscar permissões anteriores para histórico
      const { data: oldPermsData } = await from('user_permissions')
        .select('permission_id, granted')
        .eq('user_id', userId)
        .execute();

      const oldPermsMap = new Map<string, boolean>();
      (oldPermsData || []).forEach((up: any) => {
        const perm = permissions.find(p => p.id === up.permission_id);
        if (!perm) return;
        const key = `${perm.resource}.${perm.action}`;
        oldPermsMap.set(key, up.granted);
      });

      // Remover todas as permissões customizadas existentes
      await from('user_permissions')
        .eq('user_id', userId)
        .delete();

      // Inserir novas permissões customizadas
      if (customPermissions.size > 0) {
        const permissionsToInsert = Array.from(customPermissions.entries()).map(([key, granted]) => {
          const [resource, action] = key.split('.');
          const permission = permissions.find(p => p.resource === resource && p.action === action);
          if (permission) {
            return {
              user_id: userId,
              permission_id: permission.id,
              granted,
            };
          }
          return null;
        }).filter(Boolean);

        if (permissionsToInsert.length > 0) {
          await from('user_permissions')
            .insert(permissionsToInsert)
            .execute();
        }
      }

      // Log de mudanças de permissões
      for (const [key, granted] of customPermissions.entries()) {
        const [resource, action] = key.split('.');
        const permission = permissions.find(p => p.resource === resource && p.action === action);
        const oldGranted = oldPermsMap.get(key);

        if (oldGranted !== granted) {
          await logPermissionChange(
            granted ? 'permission_granted' : 'permission_denied',
            resource,
            action,
            null,
            null,
            granted
              ? `Permissão "${permission?.description}" concedida`
              : `Permissão "${permission?.description}" negada`
          );
        }
      }

      // Log de permissões removidas
      for (const [key, oldGranted] of oldPermsMap.entries()) {
        if (!customPermissions.has(key)) {
          const [resource, action] = key.split('.');
          const permission = permissions.find(p => p.resource === resource && p.action === action);
          await logPermissionChange(
            'permission_removed',
            resource,
            action,
            null,
            null,
            `Permissão "${permission?.description}" removida`
          );
        }
      }

      toast({
        title: 'Sucesso',
        description: 'Permissões atualizadas com sucesso.',
      });

      // Disparar evento para recarregar permissões
      window.dispatchEvent(new CustomEvent('permissions-changed'));

      // Recarregar histórico
      await loadData();

      onSave();
      onClose();
    } catch (error: any) {
      console.error('Erro ao salvar permissões:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao salvar permissões',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const permissionsByCategory = permissions.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  const categoryLabels: Record<string, string> = {
    dashboard: 'Dashboard',
    vendas: 'Vendas / PDV',
    caixa: 'Caixa',
    os: 'Ordem de Serviço',
    clientes: 'Clientes',
    produtos: 'Produtos / Estoque',
    financeiro: 'Financeiro',
    relatorios: 'Relatórios',
    pos_venda: 'Pós-venda',
    alertas: 'Alertas',
    admin: 'Administração',
    rh: 'Recursos Humanos',
    pdv: 'PDV - Vendas',
    assistencia: 'Assistência Técnica',
    gestao: 'Gestão',
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="role" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="role">Função Predefinida</TabsTrigger>
          <TabsTrigger value="custom">Permissões Customizadas</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="role" className="space-y-4">
          <div>
            <Label>Selecionar Role</Label>
            <Select 
              value={selectedRoleId || undefined} 
              onValueChange={(value) => handleRoleChange(value === 'none' ? '' : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um role (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum role (apenas customizadas)</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      <span>{role.display_name}</span>
                      {role.is_system && (
                        <Badge variant="outline" className="ml-2 text-xs">Sistema</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRoleId && (
              <p className="text-xs text-muted-foreground mt-2">
                {roles.find(r => r.id === selectedRoleId)?.description}
              </p>
            )}
          </div>

          {selectedRoleId && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Permissões do Role</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  {(() => {
                    const selectedRole = roles.find(r => r.id === selectedRoleId);
                    if (!selectedRole) return null;

                    // Buscar permissões do role (seria melhor fazer uma query, mas por enquanto vamos mostrar)
                    return (
                      <div className="text-sm text-muted-foreground">
                        As permissões do role "{selectedRole.display_name}" serão aplicadas automaticamente.
                        Você pode adicionar permissões customizadas na aba "Permissões Customizadas".
                      </div>
                    );
                  })()}
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Permissões Customizadas</CardTitle>
              <p className="text-xs text-muted-foreground">
                Marque as permissões que deseja conceder ou negar explicitamente.
                Permissões negadas têm prioridade sobre o role.
              </p>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-6">
                  {Object.entries(permissionsByCategory).map(([category, perms]) => (
                    <div key={category}>
                      <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        {categoryLabels[category] || category}
                      </h4>
                      <div className="space-y-2 pl-6">
                        {perms.map((perm) => {
                          const key = `${perm.resource}.${perm.action}`;
                          const granted = customPermissions.get(key) ?? null;
                          return (
                            <div key={perm.id} className="flex items-center gap-3 py-1">
                              <div className="flex items-center gap-2 flex-1">
                                <Checkbox
                                  id={`perm-${perm.id}`}
                                  checked={granted === true}
                                  onCheckedChange={(checked) =>
                                    handlePermissionToggle(perm, checked === true)
                                  }
                                />
                                <Label
                                  htmlFor={`perm-${perm.id}`}
                                  className="text-sm cursor-pointer flex-1"
                                >
                                  {perm.description}
                                </Label>
                              </div>
                              {granted === false && (
                                <Badge variant="destructive" className="text-xs">
                                  Negado
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <Separator className="mt-4" />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <History className="h-4 w-4" />
                Histórico de Alterações
              </CardTitle>
            </CardHeader>
            <CardContent>
              {permissionHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma alteração registrada
                </p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Alterado por</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {permissionHistory.map((change) => {
                        const changeTypeLabels: Record<string, string> = {
                          role_assigned: 'Role Atribuído',
                          role_removed: 'Role Removido',
                          role_changed: 'Role Alterado',
                          permission_granted: 'Permissão Concedida',
                          permission_denied: 'Permissão Negada',
                          permission_removed: 'Permissão Removida',
                        };

                        const changeTypeColors: Record<string, string> = {
                          role_assigned: 'bg-blue-100 text-blue-800',
                          role_removed: 'bg-red-100 text-red-800',
                          role_changed: 'bg-yellow-100 text-yellow-800',
                          permission_granted: 'bg-green-100 text-green-800',
                          permission_denied: 'bg-orange-100 text-orange-800',
                          permission_removed: 'bg-gray-100 text-gray-800',
                        };

                        return (
                          <TableRow key={change.id}>
                            <TableCell className="text-xs">
                              {dateFormatters.short(change.created_at)} {new Date(change.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </TableCell>
                            <TableCell>
                              <Badge className={changeTypeColors[change.change_type] || 'bg-gray-100 text-gray-800'}>
                                {changeTypeLabels[change.change_type] || change.change_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {change.description || '-'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {change.changed_by_display_name || 'Sistema'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar Permissões'}
        </Button>
      </div>
    </div>
  );
}

