import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { canAccessMatrizResellerNav } from "@/lib/navigation-mode";
import { RevendaShellNav } from "@/pages/revenda/RevendaShellNav";
import { PageHint } from "@/pages/revenda/PageHint";
import { TooltipProvider } from "@/components/ui/tooltip";

function RevendaHeader({ isPlatformRoute }: { isPlatformRoute: boolean }) {
  if (isPlatformRoute) {
    return (
      <header className="flex flex-wrap items-center gap-2 border-b border-border/40 pb-3">
        <h1 className="text-lg font-semibold tracking-tight">Admin do produto</h1>
        <PageHint label="Sobre este painel">
          Uso restrito à equipe Ativa Dash: todas as empresas raiz, planos globais e assinaturas do SaaS.
        </PageHint>
      </header>
    );
  }

  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-border/40 pb-3">
      <h1 className="text-lg font-semibold tracking-tight">Matriz</h1>
      <PageHint label="Sobre este painel">
        Contas, planos e usuários da sua revenda. Anúncios e relatórios ficam no dashboard e no marketing.
      </PageHint>
    </header>
  );
}

export function RevendaLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const memberships = useAuthStore((s) => s.memberships);
  const accessToken = useAuthStore((s) => s.accessToken);
  const platformAdmin = user?.platformAdmin === true;

  const isPlatformRoute = location.pathname === "/revenda/plataforma";

  useEffect(() => {
    if (!accessToken || !user) return;
    if (!canAccessMatrizResellerNav(user, memberships)) {
      navigate("/dashboard", { replace: true });
    }
  }, [accessToken, user, memberships, navigate]);

  return (
    <TooltipProvider delayDuration={280}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 pb-10">
        <RevendaHeader isPlatformRoute={isPlatformRoute} />
        <RevendaShellNav platformAdmin={platformAdmin} />

        <div className="min-h-0 min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </TooltipProvider>
  );
}
