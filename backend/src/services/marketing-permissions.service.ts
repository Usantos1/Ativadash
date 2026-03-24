import { assertCanMutateAds as authAssertMutate, assertCanReadMarketing as authAssertRead } from "./authorization.service.js";
import { getEffectivePlanFeatures } from "./effective-plan-features.service.js";

/** Leitura de marketing: tenancy + módulo do plano efetivo. */
export async function userCanReadMarketing(userId: string, organizationId: string): Promise<boolean> {
  try {
    await authAssertRead(userId, organizationId);
    return true;
  } catch {
    return false;
  }
}

export async function assertCanMutateAds(userId: string, organizationId: string): Promise<void> {
  await authAssertMutate(userId, organizationId);
}

/** Plano efetivo permite mutações em campanhas (Meta/Google). */
export async function assertCampaignWriteOnPlan(organizationId: string): Promise<void> {
  const features = await getEffectivePlanFeatures(organizationId);
  if (!features.campaignWrite) {
    throw new Error("O plano desta empresa não inclui edição de campanhas nas redes.");
  }
}
