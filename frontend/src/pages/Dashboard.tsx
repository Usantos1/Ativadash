import { useAuthStore } from "@/stores/auth-store";
import { formatPageTitle, usePageTitle } from "@/hooks/usePageTitle";
import { resolveSidebarNavVariant } from "@/lib/navigation-mode";
import { AgencyPortfolioDashboard } from "@/components/dashboard/AgencyPortfolioDashboard";
import { DashboardSingleClient } from "@/pages/DashboardSingleClient";

export function Dashboard() {
  usePageTitle(formatPageTitle(["Dashboard"]));
  const user = useAuthStore((s) => s.user);
  const memberships = useAuthStore((s) => s.memberships);
  const variant = resolveSidebarNavVariant(user ?? null, memberships ?? null);
  if (variant === "agency_branch") {
    return <AgencyPortfolioDashboard />;
  }
  return <DashboardSingleClient />;
}
