import { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';

interface PermissionGateProps {
  permission: string | string[];
  children: ReactNode;
  fallback?: ReactNode;
  requireAll?: boolean; // Se true, requer todas as permissões. Se false, requer qualquer uma
}

export function PermissionGate({ 
  permission, 
  children, 
  fallback = null,
  requireAll = false 
}: PermissionGateProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  const hasAccess = Array.isArray(permission)
    ? (requireAll ? hasAllPermissions(permission) : hasAnyPermission(permission))
    : hasPermission(permission);

  if (hasAccess) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}


