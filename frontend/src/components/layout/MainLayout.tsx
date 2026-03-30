import { useState, useEffect } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppTopbar } from "@/components/layout/AppTopbar";
import { AppShell } from "@/components/shell/AppShell";
import { useUIStore } from "@/stores/ui-store";
import { useAuthStore, type AuthMeResponse } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AnalyticsShell } from "@/components/analytics/AnalyticsShell";

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
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
            platformAdmin: profile.platformAdmin,
            rootResellerPartner: profile.rootResellerPartner,
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
