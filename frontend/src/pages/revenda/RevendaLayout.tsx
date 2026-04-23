import { useEffect } from "react";
import { formatPageTitle, usePageTitle } from "@/hooks/usePageTitle";
import { Outlet, useLocation } from "react-router-dom";
import { RevendaShellNav } from "@/pages/revenda/RevendaShellNav";
import { PageHint } from "@/pages/revenda/PageHint";
import { TooltipProvider } from "@/components/ui/tooltip";

export function RevendaLayout() {
  usePageTitle(formatPageTitle(["Revenda"]));
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <TooltipProvider delayDuration={280}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 pb-10">
        <header className="flex flex-wrap items-center gap-2 border-b border-border/40 pb-3">
          <h1 className="text-lg font-semibold tracking-tight">Painel da revenda</h1>
          <PageHint label="Sobre este painel">
            Contas, planos e pessoas da sua rede. Anúncios e relatórios ficam no dashboard e no marketing.
          </PageHint>
        </header>
        <RevendaShellNav />

        <div className="min-h-0 min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </TooltipProvider>
  );
}
