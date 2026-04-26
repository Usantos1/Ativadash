import React, { useState, useEffect } from 'react';
import { from } from '@/integrations/db/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ModernSwitch } from '@/components/ui/modern-switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useDepartments } from '@/hooks/useDepartments';
import { Shield, Settings, Users, Target, BarChart3, FileText, Calendar, Mail } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TeamPermission {
  id: string;
  department_name: string;
  permission_key: string;
  enabled: boolean;
}

const AVAILABLE_PERMISSIONS = [
  { key: 'processes_create', name: 'Criar Processos', description: 'Permitir criação de novos processos', icon: Target },
  { key: 'processes_edit_all', name: 'Editar Todos os Processos', description: 'Editar processos de outros departamentos', icon: Target },
  { key: 'reports_advanced', name: 'Relatórios Avançados', description: 'Acesso a relatórios e análises avançadas', icon: BarChart3 },
  { key: 'tasks_assign_external', name: 'Atribuir Tarefas Externas', description: 'Atribuir tarefas para usuários de outros departamentos', icon: Users },
  { key: 'export_data', name: 'Exportar Dados', description: 'Exportar dados e relatórios do sistema', icon: FileText },
  { key: 'calendar_global', name: 'Calendário Global', description: 'Visualizar calendário com tarefas de todos os departamentos', icon: Calendar },
  { key: 'notifications_system', name: 'Notificações do Sistema', description: 'Receber notificações importantes do sistema', icon: Mail }
];

export const TeamPermissionsManager = () => {
  const { toast } = useToast();
  const { departments } = useDepartments();
  const [permissions, setPermissions] = useState<TeamPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const { data, error } = await from('team_permissions')
        .select('*')
        .order('department_name')
        .execute();

      if (error) {
        toast({ title: "Erro", description: "Erro ao carregar permissões", variant: "destructive" });
        return;
      }
      setPermissions(data || []);
    } catch (error) {
      console.error('Error fetching permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePermission = async (departmentName: string, permissionKey: string, enabled: boolean) => {
    try {
      const existingPermission = permissions.find(
        p => p.department_name === departmentName && p.permission_key === permissionKey
      );

      if (existingPermission) {
        const { error } = await supabase
          .from('team_permissions')
          .update({ enabled })
          .eq('id', existingPermission.id);
        if (error) {
          toast({ title: "Erro", description: "Erro ao atualizar permissão", variant: "destructive" });
          return;
        }
      } else {
        const { error } = await supabase
          .from('team_permissions')
          .insert({ department_name: departmentName, permission_key: permissionKey, enabled });
        if (error) {
          toast({ title: "Erro", description: "Erro ao criar permissão", variant: "destructive" });
          return;
        }
      }

      toast({ title: "Sucesso", description: `Permissão ${enabled ? 'ativada' : 'desativada'} com sucesso` });
      fetchPermissions();
    } catch (error) {
      console.error('Error updating permission:', error);
    }
  };

  const getPermissionStatus = (departmentName: string, permissionKey: string): boolean => {
    const permission = permissions.find(
      p => p.department_name === departmentName && p.permission_key === permissionKey
    );
    return permission ? permission.enabled : false;
  };

  const initializePermissionsForDepartment = async (departmentName: string) => {
    try {
      const promises = AVAILABLE_PERMISSIONS.map(permission =>
        supabase
          .from('team_permissions')
          .upsert(
            { department_name: departmentName, permission_key: permission.key, enabled: false },
            { onConflict: 'department_name,permission_key' }
          )
      );

      await Promise.all(promises);
      toast({ title: "Sucesso", description: `Permissões inicializadas para ${departmentName}` });
      fetchPermissions();
    } catch (error) {
      console.error('Error initializing permissions:', error);
      toast({ title: "Erro", description: "Erro ao inicializar permissões", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const filteredDepartments =
    selectedDepartment && selectedDepartment !== 'all'
      ? departments.filter(dept => dept.name === selectedDepartment)
      : departments;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Permissões por Equipe
          </CardTitle>
          <div className="flex gap-2">
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Filtrar por departamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os departamentos</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-6">
          {filteredDepartments.map((department) => (
            <Card key={department.id} className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    {department.name}
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => initializePermissionsForDepartment(department.name)}>
                    <Settings className="h-4 w-4 mr-2" />
                    Inicializar Permissões
                  </Button>
                </div>
                {department.description && (
                  <p className="text-sm text-muted-foreground">{department.description}</p>
                )}
              </CardHeader>

              <CardContent>
                <div className="grid gap-4">
                  {AVAILABLE_PERMISSIONS.map((permission) => {
                    const isEnabled = getPermissionStatus(department.name, permission.key);
                    const IconComponent = permission.icon;

                    return (
                      <div
                        key={permission.key}
                        className="group flex items-center justify-between p-6 rounded-2xl border border-border/50 bg-gradient-to-r from-background/95 to-muted/30 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:scale-[1.01]"
                      >
                        <div className="flex items-center gap-6">
                          <div
                            className={[
                              "p-3 rounded-full transition-all duration-300",
                              isEnabled
                                ? "bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-800/20 ring-2 ring-emerald-200 dark:ring-emerald-700/50"
                                : "bg-gradient-to-br from-muted/60 to-muted/40 group-hover:from-primary/10 group-hover:to-primary/5",
                            ].join(" ")}
                          >
                            <IconComponent
                              className={[
                                "h-6 w-6 transition-colors duration-300",
                                isEnabled ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground group-hover:text-primary/70",
                              ].join(" ")}
                            />
                          </div>

                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-3">
                              <h4 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors duration-300">
                                {permission.name}
                              </h4>
                              <Badge
                                variant={isEnabled ? "default" : "secondary"}
                                className={
                                  isEnabled
                                    ? "px-3 py-1 rounded-full font-medium bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md border-0"
                                    : "px-3 py-1 rounded-full font-medium bg-muted/80 text-muted-foreground border border-border/60 group-hover:border-primary/30"
                                }
                              >
                                {isEnabled ? "✓ Ativo" : "○ Inativo"}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed group-hover:text-foreground/80 transition-colors duration-300">
                              {permission.description}
                            </p>
                          </div>
                        </div>

                        <div className="ml-6">
                          <div className="flex items-center gap-3">
                            <span
                              className={[
                                "text-sm font-medium transition-colors duration-300",
                                isEnabled ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                              ].join(" ")}
                            >
                              {isEnabled ? "Ativo" : "Inativo"}
                            </span>
                            <ModernSwitch
                              checked={isEnabled}
                              onCheckedChange={(checked) =>
                                updatePermission(department.name, permission.key, checked)
                              }
                              size="md"
                              aria-label={`Alternar permissão: ${permission.name}`}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}

          {departments.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum departamento encontrado. Crie departamentos primeiro para gerenciar permissões.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
