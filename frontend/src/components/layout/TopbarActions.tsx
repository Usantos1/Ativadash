import { Link } from "react-router-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Bell, LogOut, Moon, Settings, Sun, User } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useUIStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

const iconBtn =
  "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/90 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function TopbarActions({ onLogout }: { onLogout: () => void }) {
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
      <button
        type="button"
        className={iconBtn}
        onClick={toggleTheme}
        aria-label={theme === "dark" ? "Modo claro" : "Modo escuro"}
      >
        {theme === "dark" ? <Sun className="h-[1.125rem] w-[1.125rem]" /> : <Moon className="h-[1.125rem] w-[1.125rem]" />}
      </button>

      <button
        type="button"
        className={cn(iconBtn, "cursor-not-allowed opacity-40")}
        disabled
        aria-label="Notificações em breve"
        title="Notificações em breve"
      >
        <Bell className="h-[1.125rem] w-[1.125rem]" />
      </button>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className={cn(
              "ml-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-gradient-to-b from-muted/50 to-muted/25 text-muted-foreground shadow-sm ring-1 ring-black/[0.04] transition-all hover:border-border hover:from-muted/70 hover:to-muted/40 hover:text-foreground dark:ring-white/[0.06]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            )}
            aria-label="Menu do usuário"
          >
            <User className="h-[1.125rem] w-[1.125rem]" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="z-50 min-w-[200px] rounded-xl border border-border/80 bg-popover p-1.5 shadow-[var(--shadow-surface)]"
            sideOffset={8}
            align="end"
            collisionPadding={12}
          >
            {user && (
              <div className="mb-1.5 rounded-lg bg-muted/40 px-2.5 py-2">
                <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                {user.organization && (
                  <p className="mt-1.5 truncate border-t border-border/50 pt-1.5 text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground/90">{user.organization.name}</span>
                  </p>
                )}
              </div>
            )}
            <DropdownMenu.Item asChild>
              <Link
                to="/configuracoes"
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground"
              >
                <Settings className="h-4 w-4 opacity-70" />
                Configurações
              </Link>
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 bg-border/60" />
            <DropdownMenu.Item
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-destructive outline-none focus:bg-destructive/10 focus:text-destructive"
              onSelect={onLogout}
            >
              <LogOut className="h-4 w-4" />
              Sair
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
