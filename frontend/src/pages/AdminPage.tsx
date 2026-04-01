import { Navigate } from "react-router-dom";

/** Compatibilidade: bookmarks antigos `/admin` → hub de configurações. */
export function AdminPage() {
  return <Navigate to="/configuracoes/admin" replace />;
}
