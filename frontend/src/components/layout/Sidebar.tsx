import type React from "react";
import { useMemo } from "react";
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
  X,
  Users2,
  Layers,
  SlidersHorizontal,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  resolveSidebarNavVariant,
  canAccessMatrizResellerNav,
  isAgencyBranchExpandedOpsEnabled,
  type SidebarNavVariant,
} from "@/lib/navigation-mode";
import { filterNavGroupsByPlan } from "@/lib/nav-plan-features";
import { useOrganizationPlanFeatures } from "@/components/layout/organization-plan-features-context";

const SIDEBAR_WIDTH = 220;
const SIDEBAR_COLLAPSED = 56;

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
};

type NavGroup = { label: string; items: NavItem[] };

const NAV_ICON_CLASS = "h-[18px] w-[18px] shrink-0";

const FULL_NAV_GROUPS: NavGroup[] = [
  {
    label: "Visão geral",
    items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "ADS",
    items: [
      { to: "/marketing", label: "Painel ADS", icon: Megaphone, end: true },
      { to: "/marketing/captacao", label: "Captação", icon: Target },
      { to: "/marketing/conversao", label: "Conversão", icon: TrendingUp },
      { to: "/marketing/receita", label: "Receita", icon: DollarSign },
    ],
  },
  {
    label: "Conexões",
    items: [
      { to: "/marketing/integracoes", label: "Integrações", icon: Plug },
      { to: "/ads/metas-alertas", label: "Alertas e regras", icon: Bell },
      { to: "/marketing/configuracoes", label: "Metas por canal", icon: SlidersHorizontal },
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
];

function buildNavGroups(
  variant: SidebarNavVariant,
  opts: { showMatrizNav: boolean }
): NavGroup[] {
  const contaItems: NavItem[] = [];
  if (opts.showMatrizNav) {
    contaItems.push({ to: "/revenda", label: "Revenda", icon: Layers });
  }
  contaItems.push({ to: "/configuracoes", label: "Configurações", icon: Settings });

  if (variant === "agency_client_portal") {
    return [
      {
        label: "Visão geral",
        items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
      },
      {
        label: "ADS",
        items: [
          { to: "/marketing", label: "Painel ADS", icon: Megaphone, end: true },
          { to: "/marketing/captacao", label: "Captação", icon: Target },
          { to: "/marketing/conversao", label: "Conversão", icon: TrendingUp },
          { to: "/marketing/receita", label: "Receita", icon: DollarSign },
        ],
      },
      {
        label: "Conta",
        items: [{ to: "/configuracoes", label: "Configurações", icon: Settings }],
      },
    ];
  }

  if (variant === "agency_branch") {
    const conexoes: NavGroup = {
      label: "Conexões",
      items: [
        { to: "/marketing/integracoes", label: "Integrações", icon: Plug },
        { to: "/ads/metas-alertas", label: "Alertas e regras", icon: Bell },
        { to: "/marketing/configuracoes", label: "Metas por canal", icon: SlidersHorizontal },
      ],
    };
    if (isAgencyBranchExpandedOpsEnabled()) {
      const adsGroup = FULL_NAV_GROUPS[1];
      return [
        {
          label: "Visão geral",
          items: [{ to: "/dashboard", label: "Visão geral", icon: LayoutDashboard }],
        },
        adsGroup,
        conexoes,
        {
          label: "Operação",
          items: [
            { to: "/clientes", label: "Clientes", icon: Users },
            { to: "/projetos", label: "Projetos", icon: FolderKanban },
            { to: "/lancamentos", label: "Lançamentos", icon: Rocket },
            { to: "/usuarios", label: "Equipe", icon: Users2 },
          ],
        },
        { label: "Conta", items: contaItems },
      ];
    }
    return [
      {
        label: "Visão geral",
        items: [{ to: "/dashboard", label: "Visão geral", icon: LayoutDashboard }],
      },
      {
        label: "Operação",
        items: [{ to: "/clientes", label: "Clientes", icon: Users }],
      },
      conexoes,
      { label: "Conta", items: contaItems },
    ];
  }

  if (variant === "client_workspace") {
    return [
      ...FULL_NAV_GROUPS.filter((g) => g.label !== "Operação"),
      {
        label: "Operação",
        items: [{ to: "/usuarios", label: "Equipe", icon: Users2 }],
      },
      { label: "Conta", items: contaItems },
    ];
  }

  return [...FULL_NAV_GROUPS, { label: "Conta", items: contaItems }];
}

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
  const user = useAuthStore((s) => s.user);
  const memberships = useAuthStore((s) => s.memberships);
  const planFeatures = useOrganizationPlanFeatures();
  const showMatrizNav = canAccessMatrizResellerNav(user ?? null, memberships);

  const variant = resolveSidebarNavVariant(user ?? null, memberships ?? null);
  const baseNav = useMemo(
    () => buildNavGroups(variant, { showMatrizNav }),
    [variant, showMatrizNav]
  );

  const groups: NavGroup[] = useMemo(
    () =>
      filterNavGroupsByPlan(baseNav, planFeatures, {
        bypassPlanFeatures: user?.platformAdmin === true,
      }),
    [baseNav, planFeatures, user?.platformAdmin]
  );

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
            <div className="mb-1.5 flex items-center gap-2 px-2.5 pt-1">
              <span className="h-px w-3 shrink-0 rounded-full bg-primary/35" aria-hidden />
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/90">
                {group.label}
              </span>
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
                <item.icon className={NAV_ICON_CLASS} />
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
    <div className="flex h-12 shrink-0 items-center justify-center border-b border-border/60 bg-card/55 px-2 backdrop-blur-[2px]">
      <NavLink
        to="/dashboard"
        className="flex justify-center py-1.5"
        title="Ativa Dash"
        aria-label="Ativa Dash"
      >
        <img
          src="/logo-ativa-dash.png"
          alt="Ativa Dash"
          className={cn("h-8 w-auto object-contain", !collapsed && "max-w-full sm:h-9")}
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
        className="h-9 w-9 shrink-0 rounded-lg md:hidden"
        onClick={onMobileOpen}
        aria-label="Abrir menu"
      >
        <Menu className="h-[1.125rem] w-[1.125rem]" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="hidden h-9 w-9 shrink-0 rounded-lg md:flex"
        onClick={() => toggleCollapsed()}
        aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
      >
        {collapsed ? (
          <ChevronRight className="h-[1.125rem] w-[1.125rem]" />
        ) : (
          <ChevronLeft className="h-[1.125rem] w-[1.125rem]" />
        )}
      </Button>
    </>
  );
}

/** Rodapé do workspace na sidebar — UI removida; assinatura mantida para chamadores. */
export function SidebarWorkspaceFooter(): null {
  return null;
}

export { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED };
