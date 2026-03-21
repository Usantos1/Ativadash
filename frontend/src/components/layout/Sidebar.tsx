import type React from "react";
import { NavLink } from "react-router-dom";
import { useUIStore } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";
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
  Shield,
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

type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: "Visão geral",
    items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Marketing",
    items: [
      { to: "/marketing", label: "Marketing", icon: Megaphone, end: true },
      { to: "/marketing/captacao", label: "Captação", icon: Target },
      { to: "/marketing/conversao", label: "Conversão", icon: TrendingUp },
      { to: "/marketing/receita", label: "Receita", icon: DollarSign },
    ],
  },
  {
    label: "Conexões",
    items: [
      { to: "/marketing/integracoes", label: "Integrações", icon: Plug },
      { to: "/marketing/configuracoes", label: "Config. Marketing", icon: Wrench },
    ],
  },
  {
    label: "Operação",
    items: [
      { to: "/clientes", label: "Clientes", icon: Users },
      { to: "/projetos", label: "Projetos", icon: FolderKanban },
      { to: "/lancamentos", label: "Lançamentos", icon: Rocket },
      { to: "/usuarios", label: "Equipe", icon: Users2 },
    ],
  },
  {
    label: "Conta",
    items: [
      { to: "/planos", label: "Planos", icon: CreditCard },
      { to: "/configuracoes", label: "Configurações", icon: Settings },
    ],
  },
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
  const platformAdmin = useAuthStore((s) => s.user?.platformAdmin);
  const iconClass = "h-[18px] w-[18px] shrink-0";
  const groups: NavGroup[] = platformAdmin
    ? [
        ...navGroups,
        {
          label: "Plataforma",
          items: [{ to: "/plataforma", label: "Administração", icon: Shield }],
        },
      ]
    : navGroups;

  const navItemClass = (active: boolean) =>
    cn(
      "group/nav flex items-center gap-3 rounded-xl py-2.5 text-[13px] font-medium transition-all duration-150 min-h-[44px] md:min-h-0 md:py-2",
      showLabels ? "px-2.5" : "justify-center px-0",
      active
        ? "bg-primary/[0.14] font-semibold text-primary shadow-[inset_3px_0_0_0_hsl(var(--primary)),0_1px_0_rgba(255,255,255,0.06)] dark:shadow-[inset_3px_0_0_0_hsl(var(--primary))]"
        : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
    );

  return (
    <nav className="flex flex-1 flex-col gap-3 overflow-y-auto p-2 pt-1 scrollbar-thin">
      {groups.map((group, gi) => (
        <div key={group.label} className="min-w-0">
          {showLabels ? (
            <div className="mb-1.5 px-2.5 pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/90">
              {group.label}
            </div>
          ) : gi > 0 ? (
            <div className="mx-2 my-1 h-px bg-border/50" aria-hidden />
          ) : null}
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onLinkClick}
                title={!showLabels ? item.label : undefined}
                className={({ isActive: active }) => cn(navItemClass(active))}
              >
                <item.icon className={iconClass} />
                {showLabels ? <span className="truncate">{item.label}</span> : null}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);

  const desktopShowLabels = !collapsed;

  const desktopHeader = (
    <div className="flex h-[3.25rem] shrink-0 items-center justify-center border-b border-border/50 bg-card/50 px-2">
      <NavLink
        to="/dashboard"
        className="flex justify-center py-2"
        title="Ativa Dash"
        aria-label="Ativa Dash"
      >
        <img
          src="/logo-ativa-dash.png"
          alt="Ativa Dash"
          className={cn("h-9 w-auto object-contain sm:h-10", !collapsed && "max-w-full sm:h-11")}
        />
      </NavLink>
    </div>
  );

  const mobileHeader = (
    <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border/60 px-3">
      <NavLink
        to="/dashboard"
        className="flex min-w-0 flex-1 justify-center"
        onClick={onMobileClose}
        aria-label="Início"
      >
        <img src="/logo-ativa-dash.png" alt="Ativa Dash" className="h-9 w-auto max-w-[70%] object-contain" />
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
          "fixed left-0 top-0 z-40 hidden h-dvh max-h-dvh flex-col border-r border-border/50 bg-gradient-to-b from-card via-card to-muted/[0.35] shadow-[4px_0_32px_-16px_rgba(15,23,42,0.14)] transition-[width] duration-200 dark:from-card dark:via-card dark:to-card/90 dark:shadow-none md:flex",
          collapsed ? "w-14" : "w-[min(100vw-3rem,228px)]"
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
          "fixed left-0 top-0 z-40 flex h-dvh max-h-dvh w-[min(300px,88vw)] flex-col border-r border-border/50 bg-gradient-to-b from-card to-muted/20 shadow-2xl transition-transform duration-200 ease-out md:hidden",
          mobileOpen ? "translate-x-0" : "pointer-events-none -translate-x-full"
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
