import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarHeaderControl } from "@/components/layout/Sidebar";
import { OrganizationSwitcher } from "@/components/layout/OrganizationSwitcher";
import { TopbarActions } from "@/components/layout/TopbarActions";
import { resolveTopbarCrumbs } from "@/components/layout/topbar-crumbs";

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

  return (
    <header
      className={cn(
        "fixed right-0 top-0 z-30 flex h-[calc(3rem+env(safe-area-inset-top,0px))] min-h-12 w-full min-w-0 items-stretch border-b border-border/60 bg-card/90 shadow-[0_1px_0_0_hsl(var(--border)/0.35)] backdrop-blur-xl supports-[backdrop-filter]:bg-card/80",
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
          <div className="min-w-0 max-w-[min(100vw-12rem,280px)] sm:max-w-[min(100vw-14rem,300px)]">
            <OrganizationSwitcher />
          </div>
        </div>

        {/* Centro: breadcrumb */}
        <div className="flex min-w-0 flex-1 justify-center px-1 sm:px-2">
          {crumbs.length > 0 ? (
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
          ) : (
            <div
              className="h-px w-full max-w-[min(12rem,36vw)] rounded-full bg-gradient-to-r from-transparent via-border/80 to-transparent"
              aria-hidden
            />
          )}
        </div>

        {/* Direita: tema, notificações, perfil */}
        <div className="ml-auto flex shrink-0 items-center pl-1">
          <TopbarActions onLogout={onLogout} />
        </div>
      </div>
    </header>
  );
}
