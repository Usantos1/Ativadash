import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarHeaderControl } from "@/components/layout/Sidebar";
import { WorkspaceSwitcher } from "@/components/layout/WorkspaceSwitcher";
import { TopbarActions } from "@/components/layout/TopbarActions";
import { resolveTopbarCrumbs } from "@/components/layout/topbar-crumbs";
import { useAuthStore } from "@/stores/auth-store";
import { resolveAppNavMode } from "@/lib/navigation-mode";

export function AppTopbar({
  sidebarCollapsed,
  onMobileOpen,
  onLogout,
}: {
  sidebarCollapsed: boolean;
  onMobileOpen: () => void;
  onLogout: () => void;
}) {
  const { pathname } = useLocation();
  const crumbs = useMemo(() => resolveTopbarCrumbs(pathname), [pathname]);
  const user = useAuthStore((s) => s.user);
  const isImpersonating = user?.isImpersonating === true;
  const showSupportBadge =
    !isImpersonating &&
    user?.platformAdmin === true && user.organizationId != null && resolveAppNavMode(user) !== "platform_full";

  const showCenterCrumbs = crumbs.length > 0;

  return (
    <header
      className={cn(
        "fixed right-0 top-0 z-30 flex h-[calc(3rem+env(safe-area-inset-top,0px))] min-h-12 w-full min-w-0 items-stretch border-b border-border/40 bg-card/85 shadow-[0_1px_0_0_hsl(var(--border)/0.22)] backdrop-blur-xl supports-[backdrop-filter]:bg-card/75",
        "supports-[padding:max(0px)]:pt-[env(safe-area-inset-top)]",
        "left-0",
        sidebarCollapsed ? "md:left-14 md:w-[calc(100%-3.5rem)]" : "md:left-[228px] md:w-[calc(100%-228px)]"
      )}
    >
      <div className="flex h-12 w-full min-w-0 items-center gap-2 px-2.5 sm:gap-3 sm:px-4 md:px-5">
        {/* Esquerda: colapsar sidebar + workspace */}
        <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
          <SidebarHeaderControl onMobileOpen={onMobileOpen} />
          <span className="hidden h-6 w-px shrink-0 bg-border/70 md:block" aria-hidden />
          <div className="min-w-0 max-w-[min(100vw-10rem,360px)] sm:max-w-[min(100vw-12rem,380px)]">
            <WorkspaceSwitcher />
          </div>
          {showSupportBadge ? (
            <span
              className="hidden shrink-0 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary md:inline"
              title="Administrador global a navegar no contexto de um tenant"
            >
              Modo suporte
            </span>
          ) : null}
        </div>

        {/* Centro: breadcrumb (sem duplicar saudação — ela fica só no seletor de workspace) */}
        <div className="flex min-w-0 flex-1 justify-center px-1 sm:px-2">
          {showCenterCrumbs ? (
            <nav
              className="flex max-w-full items-center justify-center gap-1 overflow-hidden text-[11px] font-medium text-muted-foreground/90"
              aria-label="Navegação contextual"
            >
              {crumbs.map((c, i) => (
                <span key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1">
                  {i > 0 ? <ChevronRight className="h-3 w-3 shrink-0 opacity-45" aria-hidden /> : null}
                  {c.href ? (
                    <Link to={c.href} className="truncate transition-colors hover:text-foreground">
                      {c.label}
                    </Link>
                  ) : (
                    <span className="truncate text-foreground/80">{c.label}</span>
                  )}
                </span>
              ))}
            </nav>
          ) : null}
        </div>

        {/* Direita: tema, notificações, perfil */}
        <div className="ml-auto flex shrink-0 items-center pl-1">
          <TopbarActions onLogout={onLogout} />
        </div>
      </div>
    </header>
  );
}
