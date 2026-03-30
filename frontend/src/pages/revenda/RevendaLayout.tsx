import { useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { canAccessMatrizResellerNav } from "@/lib/navigation-mode";
import { LayoutDashboard, Building2, Users, CreditCard, Puzzle, HeartPulse, ScrollText, Store } from "lucide-react";
import { AnalyticsPageHeader } from "@/components/analytics/AnalyticsPageHeader";
import { cn } from "@/lib/utils";

const NAV: {
  to: string;
  end?: boolean;
  label: string;
  icon: typeof LayoutDashboard;
}[] = [
  { to: "/revenda", end: true, label: "Visão geral", icon: LayoutDashboard },
  { to: "/revenda/empresas", label: "Empresas", icon: Building2 },
  { to: "/revenda/agencias", label: "Agências", icon: Store },
  { to: "/revenda/usuarios", label: "Usuários", icon: Users },
  { to: "/revenda/planos", label: "Planos e assinaturas", icon: CreditCard },
  { to: "/revenda/modulos", label: "Módulos e limites", icon: Puzzle },
  { to: "/revenda/saude", label: "Saúde operacional", icon: HeartPulse },
  { to: "/revenda/auditoria", label: "Auditoria", icon: ScrollText },
];

export function RevendaLayout() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const memberships = useAuthStore((s) => s.memberships);
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken || !user) return;
    if (!canAccessMatrizResellerNav(user, memberships)) {
      navigate("/dashboard", { replace: true });
    }
  }, [accessToken, user, memberships, navigate]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 pb-10">
      <AnalyticsPageHeader
        title="Painel da matriz (empresa principal)"
        subtitle="Aqui você gerencia o ecossistema: agências, empresas cliente, planos e equipes. O dia a dia de anúncios e métricas fica no Dashboard e no Painel ADS. Use o seletor de empresa no topo para entrar numa filial e operar como dono daquela agência ou empresa."
      />

      <nav
        className="flex flex-wrap gap-1 rounded-xl border border-border/60 bg-card/80 p-1 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
        aria-label="Seções do painel da matriz"
      >
        {NAV.map(({ to, end, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
