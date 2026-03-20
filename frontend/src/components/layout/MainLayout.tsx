import { useState, useEffect } from "react";
import { Link, useNavigate, Outlet } from "react-router-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Moon, Sun, User, Settings, LogOut } from "lucide-react";
import { Sidebar, SidebarTrigger } from "@/components/layout/Sidebar";
import { useUIStore } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  useEffect(() => {
    useUIStore.getState().setTheme(useUIStore.getState().theme);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />
      <main
        className={cn(
          "min-h-screen transition-[margin] duration-200",
          "md:ml-[220px]",
          sidebarCollapsed && "md:ml-14"
        )}
      >
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border/50 bg-card/95 px-4 shadow-sm backdrop-blur-sm">
          <SidebarTrigger onOpen={() => setSidebarOpen(true)} />
          <div className="flex-1" />
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
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
                  className="h-9 w-9 rounded-full border border-border/60"
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
                >
                  {user && (
                    <div className="mb-1 px-2 py-1.5 text-sm text-muted-foreground">
                      {user.email}
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
        </header>
        <div className="p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
