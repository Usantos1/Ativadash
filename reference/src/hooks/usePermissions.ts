import { useState, useEffect, useMemo, useCallback } from 'react';
import { from } from '@/integrations/db/client';
import { useAuth } from '@/contexts/AuthContext';

interface Permission {
  id: string;
  resource: string;
  action: string;
  description: string;
  category: string;
}

// ═══════════════════════════════════════════════════════════════
// DEFINIÇÃO DOS MÓDULOS DO SISTEMA (fonte de verdade)
// ═══════════════════════════════════════════════════════════════

export interface PermissionModule {
  key: string;
  label: string;
  description: string;
  permissions: { key: string; label: string }[];
}

export const SYSTEM_MODULES: PermissionModule[] = [
  {
    key: 'dashboard', label: 'Dashboard', description: 'Painel inicial e gestão',
    permissions: [
      { key: 'dashboard.view', label: 'Visualizar dashboard' },
      { key: 'dashboard.gestao', label: 'Dashboard de gestão' },
    ],
  },
  {
    key: 'vendas', label: 'Vendas / PDV', description: 'Ponto de venda e gestão de vendas',
    permissions: [
      { key: 'vendas.view', label: 'Visualizar vendas' },
      { key: 'vendas.create', label: 'Criar vendas' },
      { key: 'vendas.edit', label: 'Editar vendas' },
      { key: 'vendas.manage', label: 'Gerenciar vendas (devoluções, cupom)' },
      { key: 'vendas.delete', label: 'Excluir vendas' },
    ],
  },
  {
    key: 'caixa', label: 'Caixa', description: 'Controle de caixa e movimentações',
    permissions: [
      { key: 'caixa.view', label: 'Visualizar caixa' },
      { key: 'caixa.open', label: 'Abrir caixa' },
      { key: 'caixa.close', label: 'Fechar caixa' },
      { key: 'caixa.sangria', label: 'Realizar sangria' },
      { key: 'caixa.suprimento', label: 'Realizar suprimento' },
    ],
  },
  {
    key: 'os', label: 'Ordem de Serviço', description: 'Ordens de serviço e assistência',
    permissions: [
      { key: 'os.view', label: 'Visualizar ordens de serviço' },
      { key: 'os.create', label: 'Criar ordens de serviço' },
      { key: 'os.edit', label: 'Editar ordens de serviço' },
      { key: 'os.delete', label: 'Excluir ordens de serviço' },
      { key: 'os.config.status', label: 'Configurar status de OS' },
    ],
  },
  {
    key: 'clientes', label: 'Clientes', description: 'Cadastro e gestão de clientes',
    permissions: [
      { key: 'clientes.view', label: 'Visualizar clientes' },
      { key: 'clientes.create', label: 'Cadastrar clientes' },
      { key: 'clientes.edit', label: 'Editar clientes' },
      { key: 'clientes.delete', label: 'Excluir clientes' },
    ],
  },
  {
    key: 'produtos', label: 'Produtos / Estoque', description: 'Catálogo, estoque e inventário',
    permissions: [
      { key: 'produtos.view', label: 'Visualizar produtos' },
      { key: 'produtos.create', label: 'Cadastrar produtos' },
      { key: 'produtos.edit', label: 'Editar produtos' },
      { key: 'produtos.manage', label: 'Gerenciar estoque (marcas, modelos, inventário)' },
    ],
  },
  {
    key: 'financeiro', label: 'Financeiro', description: 'Módulo financeiro completo',
    permissions: [
      { key: 'financeiro.view', label: 'Visualizar financeiro' },
      { key: 'financeiro.create', label: 'Criar lançamentos' },
      { key: 'financeiro.edit', label: 'Editar lançamentos' },
      { key: 'financeiro.delete', label: 'Excluir lançamentos' },
    ],
  },
  {
    key: 'relatorios', label: 'Relatórios', description: 'Relatórios e análises',
    permissions: [
      { key: 'relatorios.view', label: 'Visualizar relatórios' },
      { key: 'relatorios.vendas', label: 'Relatórios de vendas' },
      { key: 'relatorios.financeiro', label: 'Relatórios financeiros' },
      { key: 'relatorios.geral', label: 'Relatórios gerais' },
    ],
  },
  {
    key: 'pos_venda', label: 'Pós-venda', description: 'Acompanhamento e follow-up de clientes',
    permissions: [
      { key: 'pos_venda.view', label: 'Visualizar pós-venda' },
      { key: 'pos_venda.manage', label: 'Gerenciar mensagens de pós-venda' },
      { key: 'pos_venda.config', label: 'Configurar pós-venda' },
    ],
  },
  {
    key: 'alertas', label: 'Alertas', description: 'Painel de alertas automáticos',
    permissions: [
      { key: 'alertas.view', label: 'Visualizar alertas' },
      { key: 'alertas.config', label: 'Configurar alertas' },
    ],
  },
  {
    key: 'admin', label: 'Administração', description: 'Configurações e gestão do sistema',
    permissions: [
      { key: 'admin.view', label: 'Acesso administrativo geral' },
      { key: 'admin.config', label: 'Configurações do sistema' },
      { key: 'admin.users', label: 'Gerenciar usuários' },
      { key: 'admin.logs', label: 'Visualizar logs' },
      { key: 'admin.timeclock', label: 'Administrar ponto eletrônico' },
      { key: 'admin.disc', label: 'Administrar avaliação DISC' },
    ],
  },
  {
    key: 'rh', label: 'Recursos Humanos', description: 'Gestão de equipe e RH',
    permissions: [
      { key: 'rh.view', label: 'Visualizar RH' },
      { key: 'rh.ponto', label: 'Registrar ponto eletrônico' },
      { key: 'rh.manage', label: 'Gerenciar equipe e departamentos' },
    ],
  },
];

export const ALL_PERMISSION_KEYS = SYSTEM_MODULES.flatMap(m => m.permissions.map(p => p.key));

// Cache global
const PERMISSIONS_CACHE_TTL_MS = 5 * 60 * 1000;
let permissionsCache: { key: string; permissions: Set<string>; timestamp: number } | null = null;

export function usePermissions() {
  const { user, profile, loading: authLoading } = useAuth();
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const isAdminRole = useMemo(() => {
    if (!profile?.role) return false;
    const role = profile.role.toLowerCase();
    return role === 'admin' || role === 'administrador' || role === 'administrator';
  }, [profile?.role]);

  const loadPermissions = useCallback(async () => {
    if (!user || !profile) return;
    const userRole = (profile.role || 'member').toLowerCase();
    const cacheKey = `${user.id}-${userRole}`;

    try {
      if (isAdminRole) {
        setPermissions(new Set(['*']));
        setLoading(false);
        return;
      }

      if (permissionsCache?.key === cacheKey && (Date.now() - permissionsCache.timestamp) < PERMISSIONS_CACHE_TTL_MS) {
        setPermissions(permissionsCache.permissions);
        setLoading(false);
        return;
      }

      setLoading(true);
      const permSet = new Set<string>();

      // Buscar role no banco pelo nome (aceita variações)
      const roleSynonyms: Record<string, string[]> = {
        vendedor: ['vendedor', 'sales'],
        sales: ['sales', 'vendedor'],
        gerente: ['gerente', 'manager'],
        manager: ['manager', 'gerente'],
        financeiro: ['financeiro', 'financial'],
        atendente: ['atendente', 'attendant'],
        caixa: ['caixa', 'cashier'],
        estoquista: ['estoquista', 'stock'],
        tecnico: ['tecnico', 'technical'],
        visualizador: ['visualizador', 'viewer'],
        member: ['member', 'membro'],
        membro: ['membro', 'member'],
        employee: ['employee', 'funcionario'],
      };

      const exactRole = (profile.role || '').trim();
      const seen = new Set<string>();
      const rolesToTry: string[] = [];
      for (const r of [exactRole, userRole, ...(roleSynonyms[userRole] || [])]) {
        const k = r.toLowerCase();
        if (k && !seen.has(k)) {
          seen.add(k);
          rolesToTry.push(k);
        }
      }

      let roleData: { id: string; name: string } | null = null;
      for (const roleName of rolesToTry) {
        const { data, error } = await from('roles')
          .select('id, name')
          .ilike('name', roleName)
          .maybeSingle();
        if (error) continue;
        if (data) { roleData = data; break; }
      }

      if (roleData?.id) {
        const { data: rolePermsData } = await from('role_permissions')
          .select('permission_id')
          .eq('role_id', roleData.id)
          .execute();

        if (rolePermsData && rolePermsData.length > 0) {
          const permissionIds = rolePermsData.map((rp: any) => rp.permission_id);
          const { data: permsData } = await from('permissions')
            .select('resource, action')
            .in('id', permissionIds)
            .execute();

          if (permsData) {
            permsData.forEach((perm: any) => {
              permSet.add(`${perm.resource}.${perm.action}`);
            });
          }
        }
      }

      // Se nenhuma permissão veio do banco, dar pelo menos dashboard.view e rh.ponto
      if (permSet.size === 0) {
        permSet.add('dashboard.view');
        permSet.add('rh.ponto');
      }

      // Overrides por usuário
      try {
        const { data: userPerms } = await from('user_permissions')
          .select('permission_id, granted')
          .eq('user_id', user.id)
          .execute();

        if (userPerms && userPerms.length > 0) {
          const permissionIds = userPerms.map((up: any) => up.permission_id);
          const { data: permsData } = await from('permissions')
            .select('id, resource, action')
            .in('id', permissionIds)
            .execute();

          if (permsData) {
            const permMap = new Map(permsData.map((p: any) => [p.id, p]));
            userPerms.forEach((up: any) => {
              const perm = permMap.get(up.permission_id);
              if (perm) {
                const permKey = `${perm.resource}.${perm.action}`;
                if (up.granted === false) {
                  permSet.delete(permKey);
                } else if (up.granted === true) {
                  permSet.add(permKey);
                }
              }
            });
          }
        }
      } catch (_) { /* user_permissions pode não existir */ }

      permissionsCache = { key: cacheKey, permissions: permSet, timestamp: Date.now() };
      setPermissions(permSet);
    } catch (error) {
      console.error('[usePermissions] Erro ao carregar permissões:', error);
    } finally {
      setLoading(false);
    }
  }, [user, profile, isAdminRole]);

  useEffect(() => {
    if (authLoading) { setLoading(true); return; }
    if (!user) { setPermissions(new Set()); setLoading(false); return; }
    if (!profile) { setLoading(true); return; }
    loadPermissions();

    const handleChange = () => {
      permissionsCache = null;
      loadPermissions();
    };
    window.addEventListener('permissions-changed', handleChange);
    return () => window.removeEventListener('permissions-changed', handleChange);
  }, [user, profile, authLoading, loadPermissions]);

  const hasPermission = useMemo(() => {
    return (permission: string): boolean => {
      if (!user || !profile) return false;
      if (isAdminRole) return true;
      if (permissions.has('*')) return true;
      return permissions.has(permission);
    };
  }, [permissions, user, profile, isAdminRole]);

  const hasAnyPermission = useMemo(() => {
    return (permissionList: string[]): boolean => {
      if (!user || !profile) return false;
      if (isAdminRole) return true;
      return permissionList.some(perm => permissions.has(perm));
    };
  }, [permissions, user, profile, isAdminRole]);

  const hasAllPermissions = useMemo(() => {
    return (permissionList: string[]): boolean => {
      if (!user || !profile) return false;
      if (isAdminRole) return true;
      return permissionList.every(perm => permissions.has(perm));
    };
  }, [permissions, user, profile, isAdminRole]);

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    permissions: Array.from(permissions),
    loading,
    isAdmin: isAdminRole,
    refresh: loadPermissions,
  };
}
