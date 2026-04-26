import { Navigate, useNavigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from './ProtectedRoute';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { isDemoSession } from '@/utils/demoMode';

const REDIRECT_DELAY_SECONDS = 5;

interface PermissionRouteProps {
  children: React.ReactNode;
  permission: string | string[];
  requireAll?: boolean;
  redirectTo?: string;
}

// Chave para cache de admin no localStorage
const ADMIN_CACHE_KEY = 'user_is_admin';

export function PermissionRoute({ 
  children, 
  permission,
  requireAll = false,
  redirectTo
}: PermissionRouteProps) {
  const navigate = useNavigate();
  const { hasPermission, hasAnyPermission, hasAllPermissions, loading, isAdmin } = usePermissions();
  const { profile, isAdmin: isAdminAuth, loading: authLoading, user } = useAuth();
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Verificar admin DIRETAMENTE do profile
  const isAdminDirect = profile?.role?.toLowerCase() === 'admin' || 
                        profile?.role?.toLowerCase() === 'administrador' ||
                        profile?.role?.toLowerCase() === 'administrator';

  // Verificar cache do localStorage (para acesso instantâneo durante loading)
  const cachedIsAdmin = localStorage.getItem(ADMIN_CACHE_KEY) === 'true';

  // Sessão demo: acesso total (evita "Acesso negado" ao abrir pelo iframe com um clique)
  const inDemoSession = isDemoSession();

  // Se QUALQUER indicador diz que é admin ou está em demo, tem acesso total
  const userIsAdmin = isAdmin || isAdminAuth || isAdminDirect || cachedIsAdmin || inDemoSession;

  // Atualizar cache quando descobrimos o status de admin
  useEffect(() => {
    if (profile?.role) {
      const adminStatus = isAdminDirect;
      localStorage.setItem(ADMIN_CACHE_KEY, adminStatus.toString());
    }
    // Limpar cache se não há usuário (logout)
    if (!user && !authLoading) {
      localStorage.removeItem(ADMIN_CACHE_KEY);
    }
  }, [profile?.role, isAdminDirect, user, authLoading]);

  // hasAccess e showAccessDenied precisam ser calculados sempre (antes de qualquer return)
  // para que o segundo useEffect rode com o mesmo número de hooks em toda renderização
  const hasAccess = Array.isArray(permission)
    ? (requireAll ? hasAllPermissions(permission) : hasAnyPermission(permission))
    : hasPermission(permission);
  const showAccessDenied = !hasAccess && !redirectTo;

  useEffect(() => {
    if (!showAccessDenied) return;
    redirectTimeoutRef.current = setTimeout(() => {
      navigate('/', { replace: true });
    }, REDIRECT_DELAY_SECONDS * 1000);
    return () => {
      if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current);
    };
  }, [showAccessDenied, navigate]);

  // Se temos cache de admin, liberar imediatamente (mesmo durante loading)
  if (userIsAdmin) {
    return <ProtectedRoute>{children}</ProtectedRoute>;
  }

  // Mostrar loading enquanto auth ou permissões estão carregando
  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!hasAccess) {
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            <CardTitle>Acesso negado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Você não tem permissão para acessar esta página. Se acredita que isso é um erro,
              peça ao administrador para ajustar suas permissões.
            </p>
            <p className="text-xs text-muted-foreground">
              Redirecionando para a página inicial em {REDIRECT_DELAY_SECONDS} segundos…
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <ProtectedRoute>{children}</ProtectedRoute>;
}

