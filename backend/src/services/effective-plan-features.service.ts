import { prisma } from "../utils/prisma.js";
import { mergePlanFeaturesWithOverrides, type PlanFeatureFlags } from "../utils/plan-features.js";
import { resolveBillingOrganizationId, resolveEffectivePlan } from "./plan-limits.service.js";

export async function getEffectivePlanFeatures(organizationId: string): Promise<PlanFeatureFlags> {
  const billingId = await resolveBillingOrganizationId(organizationId);
  const { plan } = await resolveEffectivePlan(organizationId);
  const billingOrg = await prisma.organization.findFirst({
    where: { id: billingId, deletedAt: null },
    select: { featureOverrides: true },
  });
  return mergePlanFeaturesWithOverrides(plan, billingOrg?.featureOverrides);
}
