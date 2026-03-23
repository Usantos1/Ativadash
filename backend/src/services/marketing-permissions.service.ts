import { assertCanMutateAds as authAssertMutate, assertCanReadMarketing as authAssertRead } from "./authorization.service.js";

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
