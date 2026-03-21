import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarHeaderControl } from "@/components/layout/Sidebar";
import { OrganizationSwitcher } from "@/components/layout/OrganizationSwitcher";
import { TopbarActions } from "@/components/layout/TopbarActions";
import { resolveTopbarCrumbs } from "@/components/layout/topbar-crumbs";

export function AppTopbar({ onMobileOpen, onLogout }: { onMobileOpen: () => void; onLogout: () => void }) {
  const { pathname } = useLocation();
  const crumbs = useMemo(() => resolveTopbarCrumbs(pathname), [pathname]);

  return (
    <header
      className={cn(
        "sticky top-0 z-20 grid min-h-12 w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border/60 bg-card/80 px-2.5 py-1.5 shadow-[0_1px_0_0_hsl(var(--border)/0.35)] backdrop-blur-xl supports-[backdrop-filter]:bg-card/70 sm:gap-3 sm:px-4 md:grid-cols-[auto_minmax(0,1fr)_auto] md:px-5",
        "supports-[padding:max(0px)]:pt-[max(0.375rem,env(safe-area-inset-top))]"
      )}
    >
      {/* Esquerda: menu + organização */}
      <div className="flex min-w-0 max-w-full items-center gap-1.5 sm:gap-2.5 md:max-w-[min(100%,520px)]">
        <SidebarHeaderControl onMobileOpen={onMobileOpen} />
        <span className="hidden h-6 w-px shrink-0 bg-border/70 md:block" aria-hidden />
        <div className="min-w-0 flex-1 md:flex-initial">
          <OrganizationSwitcher />
        </div>
      </div>

      {/* Centro: breadcrumb discreto ou traço (desktop) */}
      <div className="hidden min-w-0 justify-center px-2 md:flex">
        {crumbs.length > 0 ? (
          <nav
            className="flex max-w-full items-center justify-center gap-1 overflow-hidden text-[11px] font-medium text-muted-foreground/90"
            aria-label="Navegação contextual"
          >
            {crumbs.map((c, i) => (
              <span key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1">
                {i > 0 ? <ChevronRight className="h-3 w-3 shrink-0 opacity-45" aria-hidden /> : null}
                {c.href ? (
                  <Link
                    to={c.href}
                    className="truncate transition-colors hover:text-foreground"
                  >
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
            className="h-px max-w-[min(12rem,40vw)] flex-1 rounded-full bg-gradient-to-r from-transparent via-border/80 to-transparent"
            aria-hidden
          />
        )}
      </div>

      <div className="col-start-2 md:col-start-3">
        <TopbarActions onLogout={onLogout} />
      </div>
    </header>
  );
}
