import type React from "react";
import { NavLink } from "react-router-dom";
import { useUIStore } from "@/stores/ui-store";
import {
  LayoutDashboard,
  Megaphone,
  Users,
  FolderKanban,
  Rocket,
  Plug,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  Target,
  TrendingUp,
  DollarSign,
  Wrench,
  X,
  Users2,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const SIDEBAR_WIDTH = 220;
const SIDEBAR_COLLAPSED = 56;

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
};

const mainNav: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/marketing", label: "Marketing", icon: Megaphone, end: true },
  { to: "/marketing/captacao", label: "Captação", icon: Target },
  { to: "/marketing/conversao", label: "Conversão", icon: TrendingUp },
  { to: "/marketing/receita", label: "Receita", icon: DollarSign },
  { to: "/marketing/integracoes", label: "Integrações", icon: Plug },
  { to: "/marketing/configuracoes", label: "Config. Marketing", icon: Wrench },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/projetos", label: "Projetos", icon: FolderKanban },
  { to: "/lancamentos", label: "Lançamentos", icon: Rocket },
  { to: "/usuarios", label: "Equipe", icon: Users2 },
  { to: "/planos", label: "Planos", icon: CreditCard },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

function NavBlock({
  showLabels,
  onLinkClick,
}: {
  showLabels: boolean;
  onLinkClick?: () => void;
}) {
  const iconClass = "h-5 w-5 shrink-0";
  const navItemClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-colors min-h-[44px] md:min-h-0 md:py-2",
      active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
    );

  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2 scrollbar-thin">
      {mainNav.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onLinkClick}
          className={({ isActive: active }) => cn(navItemClass(active))}
        >
          <item.icon className={iconClass} />
          {showLabels ? <span className="truncate">{item.label}</span> : null}
        </NavLink>
      ))}
    </nav>
  );
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);

  const desktopShowLabels = !collapsed;

  const desktopHeader = (
    <div className="flex h-16 shrink-0 items-center justify-center border-b border-border/60 px-2">
      <NavLink
        to="/dashboard"
        className="flex justify-center py-2"
        title="Ativa Dash"
        aria-label="Ativa Dash"
      >
        <img
          src="/logo-ativa-dash.png"
          alt="Ativa Dash"
          className={cn("h-10 w-auto object-contain sm:h-11", !collapsed && "max-w-full sm:h-12")}
        />
      </NavLink>
    </div>
  );

  const mobileHeader = (
    <div className="flex h-16 shrink-0 items-center gap-2 border-b border-border/60 px-3">
      <NavLink
        to="/dashboard"
        className="flex min-w-0 flex-1 justify-center"
        onClick={onMobileClose}
        aria-label="Início"
      >
        <img src="/logo-ativa-dash.png" alt="Ativa Dash" className="h-10 w-auto max-w-[70%] object-contain" />
      </NavLink>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-10 w-10 shrink-0"
        onClick={onMobileClose}
        aria-label="Fechar menu"
      >
        <X className="h-5 w-5" />
      </Button>
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 hidden h-dvh max-h-dvh flex-col border-r border-border/60 bg-card transition-[width] duration-200 md:flex",
          collapsed ? "w-14" : "w-[min(100vw-3rem,220px)]"
        )}
      >
        {desktopHeader}
        <NavBlock showLabels={desktopShowLabels} />
      </aside>
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={onMobileClose}
          onKeyDown={(e) => e.key === "Escape" && onMobileClose?.()}
          role="presentation"
          aria-hidden
        />
      ) : null}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-dvh max-h-dvh w-[min(280px,85vw)] flex-col border-r border-border/60 bg-card shadow-xl transition-transform duration-200 ease-out md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
        )}
        aria-hidden={!mobileOpen}
      >
        {mobileHeader}
        <NavBlock showLabels onLinkClick={onMobileClose} />
      </aside>
    </>
  );
}

/** Mobile: abre o drawer. Desktop (md+): recolhe/expande a sidebar (mesmo lugar do antigo menu). */
export function SidebarHeaderControl({ onMobileOpen }: { onMobileOpen: () => void }) {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleCollapsed = useUIStore((s) => s.toggleSidebarCollapsed);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-10 w-10 shrink-0 md:hidden"
        onClick={onMobileOpen}
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="hidden h-10 w-10 shrink-0 md:flex md:h-9 md:w-9"
        onClick={() => toggleCollapsed()}
        aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
      >
        {collapsed ? (
          <ChevronRight className="h-5 w-5" />
        ) : (
          <ChevronLeft className="h-5 w-5" />
        )}
      </Button>
    </>
  );
}

export { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED };
