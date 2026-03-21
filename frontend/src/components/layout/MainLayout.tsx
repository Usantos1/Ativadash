import { useState, useEffect } from "react";
import { Link, useNavigate, Outlet } from "react-router-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Moon, Sun, User, Settings, LogOut } from "lucide-react";
import { Sidebar, SidebarHeaderControl } from "@/components/layout/Sidebar";
import { useUIStore } from "@/stores/ui-store";
import { useAuthStore, type AuthMeResponse } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OrganizationSwitcher } from "@/components/layout/OrganizationSwitcher";

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  useEffect(() => {
    useUIStore.getState().setTheme(useUIStore.getState().theme);
  }, []);

  /** Sincroniza perfil, vínculos e empresas gerenciadas (revenda) após login, refresh ou troca de empresa */
  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    api
      .get<AuthMeResponse>("/auth/me")
      .then((profile) => {
        if (cancelled) return;
        useAuthStore.setState({
          user: {
            id: profile.id,
            email: profile.email,
            name: profile.name,
            organizationId: profile.organizationId,
            organization: profile.organization,
          },
          memberships: profile.memberships,
          managedOrganizations: profile.managedOrganizations,
        });
      })
      .catch(() => {
        /* 401 já redireciona em api.ts */
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sidebarOpen]);

  return (
    <div className="min-h-dvh overflow-x-hidden bg-background">
      <Sidebar
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />
      <main
        className={cn(
          /* Sem w-full: 100% + margin-left da sidebar estoura a viewport (scroll horizontal) */
          "min-h-dvh min-w-0 max-w-full transition-[margin] duration-200 supports-[padding:max(0px)]:pt-[env(safe-area-inset-top)]",
          sidebarCollapsed ? "md:ml-14" : "md:ml-[220px]"
        )}
      >
        <header className="sticky top-0 z-20 flex min-h-14 min-w-0 flex-wrap items-center gap-2 border-b border-border/50 bg-card/95 px-3 py-2 shadow-sm backdrop-blur-sm sm:h-16 sm:flex-nowrap sm:gap-3 sm:px-4 sm:py-0 md:gap-4">
          <SidebarHeaderControl onMobileOpen={() => setSidebarOpen(true)} />
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:order-3 sm:ml-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 sm:h-9 sm:w-9"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Modo claro" : "Modo escuro"}
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full border border-border/60 sm:h-9 sm:w-9"
                  aria-label="Menu do usuário"
                >
                  <User className="h-5 w-5 text-muted-foreground" />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="min-w-[180px] rounded-lg border border-border bg-popover p-1 shadow-md"
                  sideOffset={6}
                  align="end"
                  collisionPadding={12}
                >
                  {user && (
                    <div className="mb-1 px-2 py-1.5 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">{user.name}</p>
                      <p className="truncate text-xs">{user.email}</p>
                      {user.organization && (
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          Empresa: <span className="text-foreground">{user.organization.name}</span>
                        </p>
                      )}
                    </div>
                  )}
                  <DropdownMenu.Item asChild>
                    <Link to="/configuracoes" className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 outline-none focus:bg-accent focus:text-accent-foreground">
                      <Settings className="h-4 w-4" />
                      Configurações
                    </Link>
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="my-1 bg-border" />
                  <DropdownMenu.Item
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-destructive outline-none focus:bg-destructive/10 focus:text-destructive"
                    onSelect={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    Sair
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
          <div className="w-full min-w-0 basis-full sm:order-2 sm:w-auto sm:flex-1 sm:basis-auto">
            <OrganizationSwitcher />
          </div>
        </header>
        <div className="min-w-0 max-w-full px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6 md:py-6 md:pb-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
