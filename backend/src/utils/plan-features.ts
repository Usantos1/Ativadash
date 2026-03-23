import type { Plan } from "@prisma/client";

/** Módulos legados (compat) + chaves adicionais do painel master / SaaS. */
export type PlanFeatureFlags = {
  marketingDashboard: boolean;
  performanceAlerts: boolean;
  multiUser: boolean;
  multiOrganization: boolean;
  integrations: boolean;
  webhooks: boolean;
  marketing: boolean;
  captacao: boolean;
  conversao: boolean;
  receita: boolean;
  whatsappcrm: boolean;
  revenda: boolean;
  auditoria: boolean;
  relatorios_avancados: boolean;
  dashboards_premium: boolean;
  api: boolean;
  automacoes: boolean;
};

const DEFAULT_FEATURES: PlanFeatureFlags = {
  marketingDashboard: true,
  performanceAlerts: true,
  multiUser: true,
  multiOrganization: true,
  integrations: true,
  webhooks: false,
  marketing: false,
  captacao: false,
  conversao: false,
  receita: false,
  whatsappcrm: false,
  revenda: false,
  auditoria: false,
  relatorios_avancados: false,
  dashboards_premium: false,
  api: false,
  automacoes: false,
};

function readBool(raw: Record<string, unknown>, key: string, fallback: boolean): boolean {
  if (!(key in raw)) return fallback;
  return Boolean(raw[key]);
}

export function mergePlanFeatures(plan: Plan | null): PlanFeatureFlags {
  if (!plan) return { ...DEFAULT_FEATURES };
  const raw = plan.features;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_FEATURES };
  }
  const o = raw as Record<string, unknown>;
  return {
    marketingDashboard: readBool(o, "marketingDashboard", DEFAULT_FEATURES.marketingDashboard),
    performanceAlerts: readBool(o, "performanceAlerts", DEFAULT_FEATURES.performanceAlerts),
    multiUser: readBool(o, "multiUser", DEFAULT_FEATURES.multiUser),
    multiOrganization: readBool(o, "multiOrganization", DEFAULT_FEATURES.multiOrganization),
    integrations: readBool(o, "integrations", DEFAULT_FEATURES.integrations),
    webhooks: readBool(o, "webhooks", DEFAULT_FEATURES.webhooks),
    marketing: readBool(o, "marketing", DEFAULT_FEATURES.marketing),
    captacao: readBool(o, "captacao", DEFAULT_FEATURES.captacao),
    conversao: readBool(o, "conversao", DEFAULT_FEATURES.conversao),
    receita: readBool(o, "receita", DEFAULT_FEATURES.receita),
    whatsappcrm: readBool(o, "whatsappcrm", DEFAULT_FEATURES.whatsappcrm),
    revenda: readBool(o, "revenda", DEFAULT_FEATURES.revenda),
    auditoria: readBool(o, "auditoria", DEFAULT_FEATURES.auditoria),
    relatorios_avancados: readBool(o, "relatorios_avancados", DEFAULT_FEATURES.relatorios_avancados),
    dashboards_premium: readBool(o, "dashboards_premium", DEFAULT_FEATURES.dashboards_premium),
    api: readBool(o, "api", DEFAULT_FEATURES.api),
    automacoes: readBool(o, "automacoes", DEFAULT_FEATURES.automacoes),
  };
}

/** Merge do plano + overrides gravados na Organization (painel revenda). */
export function mergePlanFeaturesWithOverrides(plan: Plan | null, overrides: unknown | null | undefined): PlanFeatureFlags {
  const base = mergePlanFeatures(plan);
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) {
    return base;
  }
  const o = overrides as Record<string, unknown>;
  const keys = Object.keys(base) as (keyof PlanFeatureFlags)[];
  const out = { ...base };
  for (const k of keys) {
    if (o[k as string] !== undefined) {
      out[k] = Boolean(o[k as string]);
    }
  }
  return out;
}
