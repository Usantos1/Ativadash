/** Alinhado ao backend `assertCanMutateAds` (authorization.service). */
const MUTATE_MARKETING_ADS_ROLES = new Set([
  "workspace_owner",
  "workspace_admin",
  "owner",
  "admin",
  "agency_owner",
  "agency_admin",
  "media_meta_manager",
  "media_google_manager",
  "media_manager",
]);

export function canUserMutateMarketingAds(role: string | undefined | null): boolean {
  if (!role) return false;
  return MUTATE_MARKETING_ADS_ROLES.has(role);
}
