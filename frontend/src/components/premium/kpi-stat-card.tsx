import type { ComponentType, ReactNode } from "react";
import { KpiCardPremium, type KpiDelta } from "./kpi-card-premium";

/** KPI principal executivo — atalho para `KpiCardPremium` primary. */
export function KPIStatCard(props: {
  label: string;
  value: ReactNode;
  hint?: string;
  source?: string;
  hideSource?: boolean;
  hintAsTooltip?: boolean;
  icon?: ComponentType<{ className?: string }>;
  delta?: KpiDelta;
  deltaInvert?: boolean;
  loading?: boolean;
  className?: string;
}) {
  return <KpiCardPremium variant="primary" {...props} />;
}
