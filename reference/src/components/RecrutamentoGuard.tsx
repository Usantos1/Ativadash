import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

const RECRUTAMENTO_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

interface RecrutamentoGuardProps {
  children: React.ReactNode;
}

/**
 * Restringe acesso às rotas de Recrutamento (RH) apenas à empresa 1.
 * Outras empresas são redirecionadas para /rh.
 */
export function RecrutamentoGuard({ children }: RecrutamentoGuardProps) {
  const { user } = useAuth();

  if (!user?.company_id) {
    return <Navigate to="/rh" replace />;
  }

  if (user.company_id !== RECRUTAMENTO_COMPANY_ID) {
    return <Navigate to="/rh" replace />;
  }

  return <>{children}</>;
}
