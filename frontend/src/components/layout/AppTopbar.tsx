import { useEffect, useMemo, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { WorkspaceSwitcher } from "@/components/layout/WorkspaceSwitcher";
import { TopbarActions } from "@/components/layout/TopbarActions";
import { useAuthStore } from "@/stores/auth-store";
import {
  canAccessMatrizResellerNav,
  resolveAppNavMode,
  resolveSidebarNavVariant,
} from "@/lib/navigation-mode";
import { filterNavGroupsByPlan } from "@/lib/nav-plan-features";
import { useOrganizationPlanFeatures } from "@/components/layout/organization-plan-features-context";
import { buildAppNavGroups, splitPrimaryAppNavItems } from "@/components/layout/app-navigation";

function isPathActive(pathname: string, href: string, end?: boolean) {
  if (end) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppTopbar({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const user = useAuthStore((s) => s.user);
  const memberships = useAuthStore((s) => s.memberships);
  const planFeatures = useOrganizationPlanFeatures();
  const isImpersonating = user?.isImpersonating === true;
  const isMemberOfActiveOrg = useMemo(
    () =>
      user?.organizationId != null &&
      (memberships?.some((m) => m.organizationId === user.organizationId) ?? false),
    [memberships, user?.organizationId]
  );
  const showSupportBadge =
    !isImpersonating &&
    user?.platformAdmin === true &&
    user.organizationId != null &&
    !isMemberOfActiveOrg &&
    resolveAppNavMode(user) !== "platform_full";
  const [menuOpen, setMenuOpen] = useState(false);
  const showMatrizNav = canAccessMatrizResellerNav(user ?? null, memberships);
  const navVariant = resolveSidebarNavVariant(user ?? null, memberships ?? null);

  const navGroups = useMemo(
    () =>
      filterNavGroupsByPlan(
        buildAppNavGroups(navVariant, { showMatrizNav, platformAdmin: user?.platformAdmin === true }),
        planFeatures,
        { bypassPlanFeatures: user?.platformAdmin === true }
      ),
    [navVariant, planFeatures, showMatrizNav, user?.platformAdmin]
  );

  const { primaryItems, groupedMenuItems } = useMemo(() => splitPrimaryAppNavItems(navGroups), [navGroups]);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const firstName = user?.firstName?.trim() || user?.name?.trim()?.split(" ")[0] || null;

  function openCommandPalette() {
    window.dispatchEvent(new CustomEvent("ativadash:open-command-palette"));
  }

  return (
    <header className="fixed left-0 right-0 top-0 z-30 w-full border-b border-emerald-100/70 bg-background/95 backdrop-blur-xl supports-[padding:max(0px)]:pt-[env(safe-area-inset-top)] dark:border-emerald-950/30">
      <div className="px-[2vw] py-2.5 md:py-3">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex w-full min-w-0 items-center gap-2">
              <Link
                to="/dashboard"
                className="flex shrink-0 items-center px-1 py-0.5 transition-opacity hover:opacity-90"
                aria-label="Ativa Dash"
              >
                <img src="/logo-ativa-dash.png" alt="Ativa Dash" className="h-12 w-auto max-w-[170px] object-contain" />
              </Link>

              <div className="hidden min-w-0 items-center gap-2 lg:flex">
                {primaryItems.map((item) => {
                  const Icon = item.icon;
                  const active = isPathActive(pathname, item.to, item.end);
                  return (
                    <button
                      key={item.to}
                      type="button"
                      onClick={() => navigate(item.to)}
                      className={cn(
                        "flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium shadow-sm transition-all",
                        active
                          ? "border-primary bg-primary text-primary-foreground hover:opacity-95"
                          : "border-emerald-200/80 bg-white text-foreground hover:bg-emerald-50/80 dark:border-emerald-900/40 dark:bg-slate-950 dark:hover:bg-emerald-950/20"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>

              <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    className="relative z-20 flex h-11 shrink-0 items-center justify-between gap-3 rounded-full border border-emerald-200/80 bg-white pl-4 pr-2.5 text-sm font-medium text-foreground shadow-sm transition-all hover:bg-emerald-50/80 dark:border-emerald-900/40 dark:bg-slate-950 dark:hover:bg-emerald-950/20"
                    aria-label="Abrir menu de navegação"
                  >
                    Menu
                    <ChevronDown className="h-4 w-4 opacity-70" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="start"
                    sideOffset={10}
                    collisionPadding={12}
                    className="z-50 max-h-[72vh] w-[min(360px,calc(100vw-2rem))] overflow-y-auto rounded-[28px] border border-border/70 bg-popover p-3 shadow-[0_18px_50px_rgba(16,24,40,0.18)]"
                  >
                    {groupedMenuItems.map((group, index) => (
                      <div key={group.label} className="min-w-0">
                        {index > 0 ? <DropdownMenu.Separator className="my-2 h-px bg-border/60" /> : null}
                        <DropdownMenu.Label className="px-3 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          {group.label}
                        </DropdownMenu.Label>
                        {group.items.map((item) => {
                          const Icon = item.icon;
                          const isCurrentPage = isPathActive(pathname, item.to, item.end);
                          return (
                            <DropdownMenu.Item
                              key={item.to}
                              onSelect={() => navigate(item.to)}
                              className={cn(
                                "relative flex cursor-pointer items-start gap-3 rounded-2xl border-l-2 border-l-transparent px-3 py-3.5 outline-none",
                                "focus:bg-muted/70 data-[highlighted]:border-l-emerald-500 data-[highlighted]:bg-muted/70",
                                isCurrentPage && "border-l-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/20"
                              )}
                            >
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30">
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="truncate text-[15px] font-semibold text-foreground">{item.label}</span>
                                  {isCurrentPage ? (
                                    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                      Página atual
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                                  {item.description || group.label}
                                </p>
                              </div>
                            </DropdownMenu.Item>
                          );
                        })}
                      </div>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>

              <button
                type="button"
                className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full border border-emerald-200/80 bg-white text-emerald-600 shadow-sm transition-all hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-slate-950 dark:hover:bg-emerald-950/20 sm:flex"
                aria-label="Busca rápida"
                title="Busca rápida (Ctrl+K)"
                onClick={openCommandPalette}
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
          </div>

          {showSupportBadge ? (
            <span
              className="hidden shrink-0 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary 2xl:inline"
              title="Administrador global a navegar no contexto de um tenant"
            >
              Modo suporte
            </span>
          ) : null}

          <div className="hidden shrink-0 items-center text-sm font-mono text-muted-foreground xl:flex">
            <span>{currentTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
            {firstName ? (
              <>
                <span className="mx-2 text-border">|</span>
                <span className="font-sans font-medium text-foreground">{firstName}</span>
              </>
            ) : null}
          </div>

          <div className="hidden min-w-0 max-w-[320px] lg:block">
            <WorkspaceSwitcher
              contextFace={{
                primary: user?.organization?.name ?? "Workspace",
                secondary: "Workspace ativo",
              }}
            />
          </div>

          <div className="ml-auto flex shrink-0 items-center pl-1">
            <TopbarActions onLogout={onLogout} />
          </div>
        </div>
      </div>
    </header>
  );
}
