import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { formatPageTitle, usePageTitle } from "@/hooks/usePageTitle";
import { resolveSidebarNavVariant } from "@/lib/navigation-mode";
import { AgencyPortfolioDashboard } from "@/components/dashboard/AgencyPortfolioDashboard";
import { DashboardSingleClient } from "@/pages/DashboardSingleClient";
import { switchWorkspaceOrganization } from "@/lib/organization-api";
import { DASHBOARD_HOME_PATH } from "@/lib/dashboard-path";
import type { MembershipSummary, OrganizationSummary } from "@/stores/auth-store";

function resolveOrganizationIdForSlug(
  slug: string,
  memberships: MembershipSummary[] | null,
  managed: OrganizationSummary[] | null
): string | null {
  const wanted = slug.trim();
  if (!wanted) return null;
  for (const m of memberships ?? []) {
    const s = m.organization.slug?.trim();
    if (s && s === wanted) return m.organizationId;
  }
  for (const o of managed ?? []) {
    const s = o.slug?.trim();
    if (s && s === wanted) return o.id;
  }
  for (const m of memberships ?? []) {
    if (m.organizationId === wanted) return m.organizationId;
  }
  for (const o of managed ?? []) {
    if (o.id === wanted) return o.id;
  }
  return null;
}

/** Troca de workspace quando a URL é `/dashboard/:workspaceSlug`. */
function useDashboardWorkspaceSlugSync() {
  const { workspaceSlug } = useParams<{ workspaceSlug?: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const memberships = useAuthStore((s) => s.memberships);
  const managed = useAuthStore((s) => s.managedOrganizations);
  const setAuth = useAuthStore((s) => s.setAuth);
  const busy = useRef(false);

  useEffect(() => {
    if (!workspaceSlug || workspaceSlug.trim() === "") return;
    if (!user?.organizationId) return;
    if (user.isImpersonating) {
      navigate(DASHBOARD_HOME_PATH, { replace: true });
      return;
    }

    const wanted = workspaceSlug.trim();
    const currentSlug = user.organization?.slug?.trim() ?? "";
    if (currentSlug && currentSlug === wanted) return;
    if (!currentSlug && user.organizationId === wanted) return;

    const targetId = resolveOrganizationIdForSlug(wanted, memberships, managed);
    if (!targetId) {
      if (memberships === null || managed === null) return;
      navigate(DASHBOARD_HOME_PATH, { replace: true });
      return;
    }
    if (targetId === user.organizationId) return;

    let cancelled = false;
    (async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        const res = await switchWorkspaceOrganization(targetId);
        if (cancelled) return;
        setAuth(
          { ...res.user, organization: res.user.organization },
          res.accessToken,
          res.refreshToken,
          {
            memberships: res.memberships,
            managedOrganizations: res.managedOrganizations ?? [],
          }
        );
      } catch {
        if (!cancelled) navigate(DASHBOARD_HOME_PATH, { replace: true });
      } finally {
        busy.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    workspaceSlug,
    user?.organizationId,
    user?.organization?.slug,
    user?.isImpersonating,
    memberships,
    managed,
    navigate,
    setAuth,
  ]);
}

export function Dashboard() {
  useDashboardWorkspaceSlugSync();
  usePageTitle(formatPageTitle(["Dashboard"]));
  const user = useAuthStore((s) => s.user);
  const memberships = useAuthStore((s) => s.memberships);
  const variant = resolveSidebarNavVariant(user ?? null, memberships ?? null);
  if (variant === "agency_branch") {
    return <AgencyPortfolioDashboard />;
  }
  return <DashboardSingleClient />;
}
