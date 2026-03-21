import type { ComponentType, ReactNode } from "react";
import {
  KpiCardPremium,
  type KpiCardVariant,
  type KpiDelta,
} from "@/components/premium/kpi-card-premium";

export type { KpiDelta };

/** @deprecated Prefer `KpiCardPremium` com `variant` explícito; mantido para páginas legadas. */
export function KpiPremium({
  size = "md",
  variant,
  ...rest
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  source?: string;
  icon?: ComponentType<{ className?: string }>;
  delta?: KpiDelta;
  deltaInvert?: boolean;
  size?: "sm" | "md";
  variant?: KpiCardVariant;
  className?: string;
}) {
  const v: KpiCardVariant = variant ?? (size === "sm" ? "compact" : "secondary");
  return <KpiCardPremium variant={v} {...rest} />;
}
