import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

export function useCompanyNavigationData() {
  const { user, profile, isAdmin: isAdminAuth } = useAuth();
  const { loading: permissionsLoading, isAdmin } = usePermissions();

  const isAdminDirect =
    profile?.role?.toLowerCase() === 'admin' ||
    profile?.role?.toLowerCase() === 'administrador' ||
    profile?.role?.toLowerCase() === 'administrator';

  const cachedIsAdmin = localStorage.getItem('user_is_admin') === 'true';
  const userIsAdmin = !permissionsLoading && (isAdmin || isAdminAuth || isAdminDirect || cachedIsAdmin);

  const apiBase =
    import.meta.env.VITE_API_URL && !String(import.meta.env.VITE_API_URL).includes('localhost')
      ? String(import.meta.env.VITE_API_URL).replace(/\/$/, '')
      : 'https://api.ativafix.com/api';

  const { data: segmentMenuData } = useQuery({
    queryKey: ['segment-menu', user?.company_id],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) return { menu: [] };
      try {
        const res = await fetch(`${apiBase}/me/segment-menu`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        const menu = Array.isArray(data?.menu) ? data.menu : [];
        return { menu, segmento_nome: data?.segmento_nome };
      } catch {
        return { menu: [] };
      }
    },
    enabled: !!user?.company_id,
    staleTime: 0,
  });

  const { data: roleMenuData, isPending: roleMenuPending } = useQuery({
    queryKey: ['role-menu', user?.id],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) return { menu: [], home_path: null, role_display_name: null };
      const res = await fetch(`${apiBase}/me/role-menu`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      return {
        menu: data.menu || [],
        home_path: data.home_path || null,
        role_display_name: data.role_display_name || null,
      };
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  const segmentMenu = Array.isArray(segmentMenuData?.menu) ? segmentMenuData.menu : [];
  const hasSegmentMenu = segmentMenu.length > 0;
  const roleMenu = roleMenuData?.menu ?? [];
  const hasRoleMenu = Array.isArray(roleMenu) && roleMenu.length > 0;
  const roleDisplayName = roleMenuData?.role_display_name || null;
  const useRoleMenu = hasRoleMenu;
  const menuToUse = useRoleMenu ? roleMenu : segmentMenu;
  const useSegmentOrRoleList = (hasSegmentMenu || hasRoleMenu) && (hasSegmentMenu || !userIsAdmin);

  return {
    permissionsLoading,
    userIsAdmin,
    segmentMenu,
    hasSegmentMenu,
    roleMenu,
    hasRoleMenu,
    roleDisplayName,
    useRoleMenu,
    menuToUse,
    useSegmentOrRoleList,
    roleMenuPending,
  };
}
