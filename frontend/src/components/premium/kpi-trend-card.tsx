import type { ComponentType, ReactNode } from "react";
import { KpiCardPremium, type KpiDelta } from "./kpi-card-premium";

/** KPI com ênfase em variação (período anterior / meta). */
export function KPITrendCard(props: {
  label: string;
  value: ReactNode;
  hint?: string;
  source?: string;
  icon?: ComponentType<{ className?: string }>;
  delta?: KpiDelta;
  deltaInvert?: boolean;
  loading?: boolean;
  className?: string;
  compact?: boolean;
}) {
  const { compact, ...rest } = props;
  return <KpiCardPremium variant={compact ? "compact" : "secondary"} {...rest} />;
}
