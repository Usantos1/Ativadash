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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const SIDEBAR_WIDTH = 220;
const SIDEBAR_COLLAPSED = 56;

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Só destaca em rota exata (ex.: /marketing sem filhas) */
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
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleCollapsed = useUIStore((s) => s.toggleSidebarCollapsed);
  const iconClass = "h-5 w-5 shrink-0";
  const navItemClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
      active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
    );

  const content = (
    <>
      <div className="flex h-16 items-center justify-between border-b border-border/60 px-2">
        {!collapsed ? (
          <>
            <div className="w-8 shrink-0" aria-hidden />
            <NavLink to="/dashboard" className="flex flex-1 justify-center" title="Ativa Dash">
              <img src="/logo-ativa-dash.png" alt="Ativa Dash" className="h-12 w-auto max-w-full object-contain" />
            </NavLink>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => toggleCollapsed()}
              aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <NavLink to="/dashboard" className="flex w-full justify-center py-2" aria-label="Ativa Dash">
            <img src="/logo-ativa-dash.png" alt="" className="h-11 w-auto object-contain" />
          </NavLink>
        )}
      </div>
      {collapsed && (
        <div className="flex justify-center border-b border-border/60 py-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => toggleCollapsed()}
            aria-label="Expandir menu"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2 scrollbar-thin">
        {mainNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onMobileClose}
            className={({ isActive: active }) => cn(navItemClass(active))}
          >
            <item.icon className={iconClass} />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>
    </>
  );

  return (
    <>
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border/60 bg-card transition-[width] duration-200",
          "hidden md:flex",
          collapsed ? "w-14" : "w-[220px]"
        )}
      >
        {content}
      </aside>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={onMobileClose}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen w-[220px] flex-col border-r border-border/60 bg-card transition-transform duration-200 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {content}
      </aside>
    </>
  );
}

export function SidebarTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <Button variant="ghost" size="icon" className="md:hidden" onClick={onOpen} aria-label="Abrir menu">
      <Menu className="h-5 w-5" />
    </Button>
  );
}

export { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED };
