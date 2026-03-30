import { useAuthStore } from "@/stores/auth-store";
import { resolveSidebarNavVariant } from "@/lib/navigation-mode";
import { AgencyPortfolioDashboard } from "@/components/dashboard/AgencyPortfolioDashboard";
import { DashboardSingleClient } from "@/pages/DashboardSingleClient";

export function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const variant = resolveSidebarNavVariant(user ?? null);
  if (variant === "agency_branch") {
    return <AgencyPortfolioDashboard />;
  }
  return <DashboardSingleClient />;
}
