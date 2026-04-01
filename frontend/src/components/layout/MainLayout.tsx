import { useState, useEffect } from "react";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import {
  firstAllowedPathForPlanAndNav,
  isSidebarPathEnabledByPlan,
} from "@/lib/nav-plan-features";
import {
  OrganizationPlanFeaturesProvider,
  useOrganizationPlanFeatures,
} from "@/components/layout/organization-plan-features-context";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppTopbar } from "@/components/layout/AppTopbar";
import { AppShell } from "@/components/shell/AppShell";
import { useUIStore } from "@/stores/ui-store";
import { useAuthStore, type AuthMeResponse } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AnalyticsShell } from "@/components/analytics/AnalyticsShell";
import { useGlobalHotkeys } from "@/hooks/useGlobalHotkeys";
import { ShortcutsHelpModal } from "@/components/layout/ShortcutsHelpModal";
import {
  resolveAppNavMode,
  isPathAllowedForAgencyBranch,
  isPathBlockedForClientWorkspaceClients,
  isPathAllowedForAgencyClientPortal,
  canAccessAdminPage,
  shouldEnforceAgencyBranchRouteGuard,
  shouldEnforceClientWorkspaceClientsGuard,
  canAccessMatrizResellerNav,
  isAgencyClientPortalUser,
} from "@/lib/navigation-mode";

function MainLayoutInner() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const orgPlanFeatures = useOrganizationPlanFeatures();
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const memberships = useAuthStore((s) => s.memberships);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  useGlobalHotkeys();

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
            matrizNavEligible: profile.matrizNavEligible,
            organizationKind: profile.organizationKind,
            parentOrganizationId: profile.parentOrganizationId,
          },
          memberships: profile.memberships.map((m) => ({
            ...m,
            jobTitle: m.jobTitle ?? null,
          })),
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

  /** /revenda: critério só `matrizNavEligible` da API (ou platformAdmin). */
  useEffect(() => {
    if (!accessToken || !user) return;
    const path = location.pathname;
    if (path !== "/revenda" && !path.startsWith("/revenda/")) return;
    if (!canAccessMatrizResellerNav(user, memberships)) {
      navigate("/dashboard", { replace: true });
    }
  }, [accessToken, location.pathname, navigate, user, memberships]);

  /** Deep links: agência filial e workspace cliente só em rotas permitidas; /admin só para perfis autorizados. */
  useEffect(() => {
    if (!accessToken || !user) return;
    const mode = resolveAppNavMode(user);
    const path = location.pathname;
    if (shouldEnforceAgencyBranchRouteGuard(user, memberships) && !isPathAllowedForAgencyBranch(path)) {
      navigate("/dashboard", { replace: true });
      return;
    }
    if (shouldEnforceClientWorkspaceClientsGuard(user, memberships) && isPathBlockedForClientWorkspaceClients(path)) {
      navigate("/dashboard", { replace: true });
      return;
    }
    if (isAgencyClientPortalUser(user, memberships) && !isPathAllowedForAgencyClientPortal(path)) {
      navigate("/dashboard", { replace: true });
      return;
    }
    if (
      (path === "/admin" || path === "/configuracoes/admin") &&
      !canAccessAdminPage(user, memberships, mode)
    ) {
      navigate("/configuracoes", { replace: true });
    }
  }, [accessToken, location.pathname, navigate, user, memberships]);

  /** Deep links: URL fora do plano (`enabledFeatures`) → primeira rota permitida para o perfil. */
  useEffect(() => {
    if (!accessToken || !user) return;
    if (user.platformAdmin) return;
    if (orgPlanFeatures === null) return;
    const raw = location.pathname;
    const path = raw.replace(/\/$/, "") || "/";
    if (isSidebarPathEnabledByPlan(path, orgPlanFeatures)) return;
    const next = firstAllowedPathForPlanAndNav(orgPlanFeatures, user, memberships);
    if (next !== path) navigate(next, { replace: true });
  }, [accessToken, location.pathname, navigate, user, memberships, orgPlanFeatures]);

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
      <ShortcutsHelpModal />
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

export function MainLayout() {
  return (
    <OrganizationPlanFeaturesProvider>
      <MainLayoutInner />
    </OrganizationPlanFeaturesProvider>
  );
}
