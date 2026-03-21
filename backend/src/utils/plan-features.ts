import type { Plan } from "@prisma/client";

export type PlanFeatureFlags = {
  marketingDashboard: boolean;
  performanceAlerts: boolean;
  multiUser: boolean;
  multiOrganization: boolean;
  integrations: boolean;
  webhooks: boolean;
};

const DEFAULT_FEATURES: PlanFeatureFlags = {
  marketingDashboard: true,
  performanceAlerts: true,
  multiUser: true,
  multiOrganization: true,
  integrations: true,
  webhooks: false,
};

export function mergePlanFeatures(plan: Plan | null): PlanFeatureFlags {
  if (!plan) return { ...DEFAULT_FEATURES };
  const raw = plan.features;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    return {
      marketingDashboard: Boolean(o.marketingDashboard ?? DEFAULT_FEATURES.marketingDashboard),
      performanceAlerts: Boolean(o.performanceAlerts ?? DEFAULT_FEATURES.performanceAlerts),
      multiUser: Boolean(o.multiUser ?? DEFAULT_FEATURES.multiUser),
      multiOrganization: Boolean(o.multiOrganization ?? DEFAULT_FEATURES.multiOrganization),
      integrations: Boolean(o.integrations ?? DEFAULT_FEATURES.integrations),
      webhooks: Boolean(o.webhooks ?? DEFAULT_FEATURES.webhooks),
    };
  }
  return { ...DEFAULT_FEATURES };
}
