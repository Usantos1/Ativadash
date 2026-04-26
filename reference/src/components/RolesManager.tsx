import { useState, useEffect, useMemo } from 'react';
import { from } from '@/integrations/db/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useCompanySegment } from '@/hooks/useCompanySegment';
import { Plus, Edit, Trash2, Shield, ChevronDown, ChevronRight, CheckSquare } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SYSTEM_MODULES, type PermissionModule } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';

interface Role {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  is_system: boolean;
  segmento_slug?: string | null;
  home_path?: string | null;
  created_at: string;
  updated_at: string;
}

interface Permission {
  id: string;
  resource: string;
  action: string;
  description: string;
  category: string;
}

const SEGMENTO_LABELS: Record<string, string> = {
  oficina_mecanica: 'Oficina Mecânica',
  assistencia_tecnica: 'Assistência Técnica',
  comercio: 'Comércio',
};

export function RolesManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { segmentoSlug } = useCompanySegment();
  const [roles, setRoles] = useState<Role[]>([]);
  const [dbPermissions, setDbPermissions] = useState<Permission[]>([]);
  const [rolesPermissionsMap, setRolesPermissionsMap] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [rolePermissions, setRolePermissions] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    description: '',
  });
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [roleMenuTab, setRoleMenuTab] = useState<'info' | 'permissoes'>('info');

  // Mapear chaves de permissão (resource.action) para IDs do banco
  const permKeyToId = useMemo(() => {
    const map = new Map<string, string>();
    dbPermissions.forEach(p => map.set(`${p.resource}.${p.action}`, p.id));
    return map;
  }, [dbPermissions]);

  const permIdToKey = useMemo(() => {
    const map = new Map<string, string>();
    dbPermissions.forEach(p => map.set(p.id, `${p.resource}.${p.action}`));
    return map;
  }, [dbPermissions]);

  useEffect(() => {
    loadData();
  }, [segmentoSlug]);

  const loadData = async () => {
    try {
      setLoading(true);

      const { data: rolesData, error: rolesError } = await from('roles')
        .select('*')
        .order('display_name', { ascending: true })
        .execute();
      if (rolesError) throw rolesError;

      const allRoles = (rolesData || []) as Role[];
      setRoles(allRoles.filter(r => r.segmento_slug == null || r.segmento_slug === segmentoSlug));

      const { data: permsData, error: permsError } = await from('permissions')
        .select('*')
        .order('category', { ascending: true })
        .execute();
      if (permsError) throw permsError;
      setDbPermissions(permsData || []);

      const { data: rolePermsData } = await from('role_permissions')
        .select('role_id')
        .execute();
      if (rolePermsData) {
        const countMap = new Map<string, number>();
        rolePermsData.forEach((rp: any) => {
          countMap.set(rp.role_id, (countMap.get(rp.role_id) || 0) + 1);
        });
        setRolesPermissionsMap(countMap);
      }
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      toast({ title: 'Erro', description: 'Erro ao carregar cargos e permissões', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadRolePermissions = async (roleId: string) => {
    try {
      const { data, error } = await from('role_permissions')
        .select('permission_id')
        .eq('role_id', roleId)
        .execute();
      if (error) throw error;

      const permKeys = new Set<string>();
      (data || []).forEach((rp: any) => {
        const key = permIdToKey.get(rp.permission_id);
        if (key) permKeys.add(key);
      });
      setRolePermissions(permKeys);
    } catch (error: any) {
      console.error('Erro ao carregar permissões do cargo:', error);
    }
  };

  const handleOpenDialog = (role?: Role) => {
    if (role) {
      setEditingRole(role);
      setFormData({
        name: role.name,
        display_name: role.display_name,
        description: role.description || '',
      });
      loadRolePermissions(role.id);
    } else {
      setEditingRole(null);
      setFormData({ name: '', display_name: '', description: '' });
      setRolePermissions(new Set());
    }
    setExpandedModules(new Set(SYSTEM_MODULES.map(m => m.key)));
    setRoleMenuTab('info');
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingRole(null);
    setFormData({ name: '', display_name: '', description: '' });
    setRolePermissions(new Set());
    setExpandedModules(new Set());
  };

  const togglePermission = (permKey: string) => {
    setRolePermissions(prev => {
      const next = new Set(prev);
      if (next.has(permKey)) next.delete(permKey);
      else next.add(permKey);
      return next;
    });
  };

  const toggleModule = (mod: PermissionModule) => {
    const allKeys = mod.permissions.map(p => p.key);
    const allSelected = allKeys.every(k => rolePermissions.has(k));

    setRolePermissions(prev => {
      const next = new Set(prev);
      if (allSelected) {
        allKeys.forEach(k => next.delete(k));
      } else {
        allKeys.forEach(k => next.add(k));
      }
      return next;
    });
  };

  const toggleModuleExpand = (modKey: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(modKey)) next.delete(modKey);
      else next.add(modKey);
      return next;
    });
  };

  const getModuleCount = (mod: PermissionModule) => {
    const selected = mod.permissions.filter(p => rolePermissions.has(p.key)).length;
    return { selected, total: mod.permissions.length };
  };

  const handleSave = async () => {
    try {
      if (!formData.name || !formData.display_name) {
        toast({ title: 'Erro', description: 'Nome e nome de exibição são obrigatórios', variant: 'destructive' });
        return;
      }

      let roleId: string;

      if (editingRole) {
        const { data, error } = await from('roles')
          .update({
            display_name: formData.display_name,
            description: formData.description || null,
          })
          .eq('id', editingRole.id)
          .select('*')
          .single();
        if (error) throw error;
        roleId = data.id;
      } else {
        const { data: existing } = await from('roles')
          .select('id, name, segmento_slug')
          .eq('name', formData.name)
          .execute();

        const sameSegment = (existing || []).find(
          (r: any) => (r.segmento_slug ?? null) === (segmentoSlug ?? null)
        );
        if (sameSegment) {
          throw new Error(`Já existe um cargo com o nome "${formData.name}" neste segmento.`);
        }

        const { data, error } = await from('roles')
          .insert({
            name: formData.name,
            display_name: formData.display_name,
            description: formData.description || null,
            is_system: false,
            segmento_slug: segmentoSlug || null,
          })
          .select('*')
          .single();
        if (error) throw error;
        roleId = data.id;
      }

      // Salvar permissões
      const { error: deleteError } = await from('role_permissions')
        .delete()
        .eq('role_id', roleId)
        .execute();
      if (deleteError) throw deleteError;

      if (rolePermissions.size > 0) {
        const inserts: { role_id: string; permission_id: string }[] = [];
        rolePermissions.forEach(permKey => {
          const permId = permKeyToId.get(permKey);
          if (permId) inserts.push({ role_id: roleId, permission_id: permId });
        });

        const BATCH_SIZE = 25;
        for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
          const batch = inserts.slice(i, i + BATCH_SIZE);
          const { error: insertError } = await from('role_permissions')
            .insert(batch)
            .execute();
          if (insertError) throw insertError;
        }
      }

      toast({
        title: 'Sucesso',
        description: editingRole ? 'Cargo atualizado com sucesso' : 'Cargo criado com sucesso',
      });

      handleCloseDialog();
      loadData();
      queryClient.invalidateQueries({ queryKey: ['roles-for-user-form'] });
      window.dispatchEvent(new Event('permissions-changed'));
    } catch (error: any) {
      console.error('Erro ao salvar cargo:', error);
      toast({ title: 'Erro', description: error.message || 'Erro ao salvar cargo', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!roleToDelete) return;

    try {
      const { data: usersWithRole } = await from('profiles')
        .select('user_id')
        .eq('role', roleToDelete.name)
        .execute();

      const userCount = usersWithRole?.length || 0;
      if (userCount > 0) {
        const confirmed = window.confirm(
          `ATENÇÃO: Há ${userCount} usuário(s) usando a função "${roleToDelete.display_name}".\n\n` +
          `Ao remover, os usuários ficarão sem função definida.\n\nContinuar?`
        );
        if (!confirmed) {
          setDeleteDialogOpen(false);
          setRoleToDelete(null);
          return;
        }
      }

      await from('user_position_departments').update({ role_id: null }).eq('role_id', roleToDelete.id).execute().catch(() => {});
      await from('role_permissions').delete().eq('role_id', roleToDelete.id).execute().catch(() => {});

      const { error } = await from('roles').delete().eq('id', roleToDelete.id).execute();
      if (error) throw error;

      toast({ title: 'Sucesso', description: `Cargo "${roleToDelete.display_name}" removido.` });
      setDeleteDialogOpen(false);
      setRoleToDelete(null);
      loadData();
      queryClient.invalidateQueries({ queryKey: ['roles-for-user-form'] });
    } catch (error: any) {
      console.error('Erro ao excluir cargo:', error);
      let msg = error?.message || 'Erro ao excluir cargo';
      if (msg.includes('foreign key') || msg.includes('constraint') || msg.includes('violates')) {
        msg = 'Não é possível excluir: há dados relacionados usando este cargo.';
      }
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  const totalSystemPerms = SYSTEM_MODULES.reduce((acc, m) => acc + m.permissions.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gerenciar Cargos</h2>
          <p className="text-sm text-muted-foreground">
            Crie e gerencie cargos com permissões específicas por módulo
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Cargo
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cargos do Sistema</CardTitle>
          <CardDescription>
            As permissões definidas aqui aplicam-se aos usuários com o cargo correspondente.
            {segmentoSlug && (
              <> Exibindo cargos globais e do segmento <strong>{SEGMENTO_LABELS[segmentoSlug] || segmentoSlug}</strong>.</>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cargo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Permissões</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map(role => {
                const permCount = rolesPermissionsMap.get(role.id) || 0;
                const isAdmin = role.name === 'admin';
                return (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">{role.display_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{role.description || '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {role.segmento_slug ? (SEGMENTO_LABELS[role.segmento_slug] || role.segmento_slug) : 'Global'}
                    </TableCell>
                    <TableCell>
                      {role.is_system
                        ? <Badge variant="outline">Sistema</Badge>
                        : <Badge variant="secondary">Customizado</Badge>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {isAdmin ? 'Total' : `${permCount} / ${totalSystemPerms}`}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(role)} title="Editar cargo">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setRoleToDelete(role); setDeleteDialogOpen(true); }}
                          title="Remover cargo"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de criar/editar cargo */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl w-[95vw] max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingRole ? 'Editar cargo' : 'Novo cargo'}</DialogTitle>
            <DialogDescription>
              {editingRole
                ? 'Configure informações e permissões do cargo.'
                : 'Crie um novo cargo e defina suas permissões.'}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={roleMenuTab} onValueChange={(v) => setRoleMenuTab(v as 'info' | 'permissoes')} className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="info">Informações</TabsTrigger>
              <TabsTrigger value="permissoes">
                Permissões
                <Badge variant="secondary" className="ml-2 text-xs">
                  {rolePermissions.size}/{totalSystemPerms}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="flex-1 overflow-y-auto mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome (código) *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: vendedor_senior"
                    disabled={!!editingRole}
                  />
                  <p className="text-xs text-muted-foreground">
                    {editingRole ? 'Nome não pode ser alterado' : 'Identificador único do cargo'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Nome de Exibição *</Label>
                  <Input
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    placeholder="Ex: Vendedor Sênior"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descreva o propósito deste cargo"
                  rows={3}
                />
              </div>
            </TabsContent>

            <TabsContent value="permissoes" className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Selecione as permissões por módulo. Use o checkbox do grupo para marcar/desmarcar todos.
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setExpandedModules(new Set(SYSTEM_MODULES.map(m => m.key)))}
                  >
                    Expandir todos
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setExpandedModules(new Set())}
                  >
                    Recolher todos
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-[calc(95vh-280px)] border rounded-lg">
                <div className="p-3 space-y-1">
                  {SYSTEM_MODULES.map(mod => {
                    const { selected, total } = getModuleCount(mod);
                    const isExpanded = expandedModules.has(mod.key);
                    const allSelected = selected === total;
                    const someSelected = selected > 0 && selected < total;

                    return (
                      <div key={mod.key} className="rounded-lg border bg-card">
                        {/* Header do módulo */}
                        <div
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 rounded-t-lg select-none"
                          onClick={() => toggleModuleExpand(mod.key)}
                        >
                          {isExpanded
                            ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                            : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}

                          <Checkbox
                            checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                            onCheckedChange={(e) => {
                              e; // prevent ts unused
                              toggleModule(mod);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0"
                          />

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4 text-primary shrink-0" />
                              <span className="font-semibold text-sm">{mod.label}</span>
                              <span className="text-xs text-muted-foreground hidden sm:inline">— {mod.description}</span>
                            </div>
                          </div>

                          <Badge
                            variant={selected === 0 ? 'outline' : allSelected ? 'default' : 'secondary'}
                            className={cn(
                              'shrink-0 text-xs tabular-nums',
                              allSelected && 'bg-emerald-600 text-white',
                            )}
                          >
                            {selected}/{total}
                          </Badge>
                        </div>

                        {/* Permissões do módulo */}
                        {isExpanded && (
                          <div className="px-4 pb-3 pt-1 border-t">
                            <div className="space-y-1 pl-9">
                              {mod.permissions.map(perm => {
                                const isChecked = rolePermissions.has(perm.key);
                                return (
                                  <div
                                    key={perm.key}
                                    className="flex items-center gap-3 py-1.5 px-2 hover:bg-muted/50 rounded -mx-2 cursor-pointer"
                                    onClick={() => togglePermission(perm.key)}
                                  >
                                    <Checkbox
                                      checked={isChecked}
                                      onCheckedChange={() => togglePermission(perm.key)}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <Label className="text-sm cursor-pointer flex-1 font-normal">
                                      {perm.label}
                                    </Label>
                                    <code className="text-[10px] text-muted-foreground/60 hidden sm:inline">
                                      {perm.key}
                                    </code>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>Cancelar</Button>
            <Button onClick={handleSave}>
              {editingRole ? 'Salvar alterações' : 'Criar cargo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o cargo "{roleToDelete?.display_name}"?
              {roleToDelete?.is_system && (
                <span className="block mt-2 font-semibold text-amber-600 dark:text-amber-400">
                  Este é um cargo do sistema. Certifique-se de que nenhum usuário está usando.
                </span>
              )}
              <span className="block mt-2">Esta ação não pode ser desfeita.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRoleToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
