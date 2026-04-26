import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import {
  adminItemsBase,
  dedupeNavigationItems,
  estoqueItemsBase,
  getQuickNavItemsForPath,
  gestaoItemsBase,
  operacaoItemsBase,
  relatoriosItemsBase,
  toNavigationItem,
  type NavigationItem,
  type SegmentMenuEntry,
} from '@/lib/navigation-config';

type UseNavigationItemsParams = {
  menuToUse?: SegmentMenuEntry[];
  useRoleMenu?: boolean;
  useSegmentOrRoleList?: boolean;
};

export function useNavigationItems(params: UseNavigationItemsParams = {}) {
  const location = useLocation();
  const { isAdmin } = useAuth();
  const { hasPermission, loading: permissionsLoading } = usePermissions();

  const menuToUse = params.menuToUse ?? [];
  const useRoleMenu = !!params.useRoleMenu;
  const useSegmentOrRoleList = !!params.useSegmentOrRoleList;

  const checkPermission = (permission?: string) => {
    if (!permission) return true;
    if (isAdmin) return true;
    return hasPermission(permission);
  };

  const segmentByCategory = useMemo(() => {
    if (!menuToUse.length) return { operacao: [], estoque: [], gestao: [] as NavigationItem[] };

    const cat = (m: SegmentMenuEntry) => m.categoria || 'operacao';
    const operacao = menuToUse.filter((m) => cat(m) === 'operacao').map((m) => toNavigationItem(m, useRoleMenu));
    const estoque = menuToUse.filter((m) => cat(m) === 'estoque').map((m) => toNavigationItem(m, useRoleMenu));
    const gestao = menuToUse.filter((m) => cat(m) === 'gestao').map((m) => toNavigationItem(m, useRoleMenu));
    return { operacao, estoque, gestao };
  }, [menuToUse, useRoleMenu]);

  const operacaoItems = useMemo(() => {
    const raw = useSegmentOrRoleList ? segmentByCategory.operacao : operacaoItemsBase;
    return raw.filter((item) => useRoleMenu || checkPermission(item.permission));
  }, [useRoleMenu, useSegmentOrRoleList, segmentByCategory.operacao, isAdmin, hasPermission]);

  const estoqueItems = useMemo(() => {
    const raw = useSegmentOrRoleList ? segmentByCategory.estoque : estoqueItemsBase;
    return raw.filter((item) => useRoleMenu || checkPermission(item.permission));
  }, [useRoleMenu, useSegmentOrRoleList, segmentByCategory.estoque, isAdmin, hasPermission]);

  const relatoriosItems = useMemo(() => {
    if (permissionsLoading) return [];

    const raw = useSegmentOrRoleList
      ? (() => {
          const basePaths = new Set(relatoriosItemsBase.map((item) => item.path));
          const extraFromGestao = segmentByCategory.gestao.filter((item) => !basePaths.has(item.path));
          return [...relatoriosItemsBase, ...extraFromGestao];
        })()
      : relatoriosItemsBase;

    return raw.filter((item) => checkPermission(item.permission));
  }, [useSegmentOrRoleList, segmentByCategory.gestao, permissionsLoading, isAdmin, hasPermission]);

  const gestaoItems = useMemo(() => {
    const raw = useSegmentOrRoleList ? [] : gestaoItemsBase;
    return raw.filter((item) => useRoleMenu || checkPermission(item.permission));
  }, [useRoleMenu, useSegmentOrRoleList, isAdmin, hasPermission]);

  const adminItems = useMemo(() => {
    return isAdmin ? adminItemsBase : [];
  }, [isAdmin]);

  const quickNavItems = useMemo(() => {
    let items = getQuickNavItemsForPath(location.pathname);
    const canSeeRelatorios = isAdmin || hasPermission('relatorios.view') || hasPermission('relatorios.financeiro');
    if (!canSeeRelatorios) {
      items = items.filter((item) => item.path !== '/relatorios');
    }
    return items;
  }, [location.pathname, isAdmin, hasPermission]);

  const allItems = useMemo(() => {
    return dedupeNavigationItems([
      ...operacaoItems,
      ...estoqueItems,
      ...relatoriosItems,
      ...gestaoItems,
      ...adminItems,
    ]);
  }, [operacaoItems, estoqueItems, relatoriosItems, gestaoItems, adminItems]);

  return {
    operacaoItems,
    estoqueItems,
    relatoriosItems,
    gestaoItems,
    adminItems,
    quickNavItems,
    allItems,
    permissionsLoading,
  };
}
