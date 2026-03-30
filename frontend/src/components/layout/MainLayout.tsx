import { useState, useEffect } from "react";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppTopbar } from "@/components/layout/AppTopbar";
import { AppShell } from "@/components/shell/AppShell";
import { useUIStore } from "@/stores/ui-store";
import { useAuthStore, type AuthMeResponse } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AnalyticsShell } from "@/components/analytics/AnalyticsShell";
import {
  resolveAppNavMode,
  isPathAllowedForAgencyBranch,
  isPathBlockedForClientWorkspaceClients,
  canAccessAdminPage,
  shouldEnforceAgencyBranchRouteGuard,
  shouldEnforceClientWorkspaceClientsGuard,
  canAccessMatrizResellerNav,
} from "@/lib/navigation-mode";

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const memberships = useAuthStore((s) => s.memberships);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();

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
            firstName: profile.firstName,
            organizationId: profile.organizationId,
            organization: profile.organization,
            platformAdmin: profile.platformAdmin,
            rootResellerPartner: profile.rootResellerPartner,
            organizationKind: profile.organizationKind,
            parentOrganizationId: profile.parentOrganizationId,
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

  /**
   * /revenda: bloqueio imediato sem confiar em estado parcial.
   * Sem `memberships` carregados (ou vazios), não-plataforma não entra — evita menu fantasma com JWT/user antigo.
   */
  useEffect(() => {
    if (!accessToken || !user) return;
    const path = location.pathname;
    if (path !== "/revenda" && !path.startsWith("/revenda/")) return;
    if (user.platformAdmin === true) return;
    if (!memberships || memberships.length === 0) {
      navigate("/dashboard", { replace: true });
      return;
    }
    if (!canAccessMatrizResellerNav(user, memberships)) {
      navigate("/dashboard", { replace: true });
    }
  }, [accessToken, location.pathname, navigate, user, memberships]);

  /** Deep links: agência filial e workspace cliente só em rotas permitidas; /admin só para perfis autorizados. */
  useEffect(() => {
    if (!accessToken || !user) return;
    const mode = resolveAppNavMode(user);
    const path = location.pathname;
    if (shouldEnforceAgencyBranchRouteGuard(user) && !isPathAllowedForAgencyBranch(path)) {
      navigate("/dashboard", { replace: true });
      return;
    }
    if (shouldEnforceClientWorkspaceClientsGuard(user) && isPathBlockedForClientWorkspaceClients(path)) {
      navigate("/dashboard", { replace: true });
      return;
    }
    if (path === "/admin" && !canAccessAdminPage(user, memberships, mode)) {
      navigate("/configuracoes", { replace: true });
    }
  }, [accessToken, location.pathname, navigate, user, memberships]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sidebarOpen]);

  return (
    <AppShell>
      <Sidebar
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />
      <main
        className={cn(
          /* Sem w-full: 100% + margin-left da sidebar estoura a viewport (scroll horizontal) */
          "min-h-dvh min-w-0 max-w-full overflow-x-hidden transition-[margin] duration-200",
          sidebarCollapsed ? "md:ml-14" : "md:ml-[228px]"
        )}
      >
        <AppTopbar
          sidebarCollapsed={sidebarCollapsed}
          onMobileOpen={() => setSidebarOpen(true)}
          onLogout={handleLogout}
        />
        <div className="min-w-0 max-w-full px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[calc(1rem+3rem+env(safe-area-inset-top,0px))] sm:px-5 md:px-8 md:pb-6 md:pt-[calc(1.5rem+3rem+env(safe-area-inset-top,0px))]">
          <AnalyticsShell>
            <Outlet />
          </AnalyticsShell>
        </div>
      </main>
    </AppShell>
  );
}
