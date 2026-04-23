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
  "member",
  "analyst",
  "performance_analyst",
  "agency_ops",
]);

export function canUserMutateMarketingAds(role: string | undefined | null): boolean {
  if (!role) return false;
  return MUTATE_MARKETING_ADS_ROLES.has(role);
}

/**
 * Versão "efetiva" — cobre modo suporte (impersonação) e membership em matriz/agência.
 * Espelha o backend `effectiveWorkspaceRole`: permissão herdada do matriz quando o usuário
 * opera em um workspace filho sem membership direta.
 */
export function canUserMutateMarketingAdsEffective(input: {
  directRole: string | undefined | null;
  isImpersonating?: boolean;
  memberships?: Array<{ role: string }> | null;
}): boolean {
  if (canUserMutateMarketingAds(input.directRole)) return true;
  if (input.isImpersonating) return true;
  if (input.memberships?.some((m) => MUTATE_MARKETING_ADS_ROLES.has(m.role))) return true;
  return false;
}

/** Alinhado a `CAP_MARKETING_SETTINGS_WRITE` (workspace admin / matriz). */
const MARKETING_SETTINGS_WRITE_ROLES = new Set([
  "workspace_owner",
  "workspace_admin",
  "owner",
  "admin",
  "agency_owner",
  "agency_admin",
]);

export function canUserEditMarketingSettings(role: string | undefined | null): boolean {
  if (!role) return false;
  return MARKETING_SETTINGS_WRITE_ROLES.has(role);
}

/**
 * Versão "efetiva" do check — alinhada ao backend `effectiveWorkspaceRole`, que sobe a
 * cadeia até achar um membership matriz com papel admin (agência/revenda).
 *
 * Usar em UIs que decidem habilitar edição em workspaces-filhos, porque em "modo suporte"
 * (impersonação) o usuário não tem `Membership` direta no filho, mas o backend aceita a
 * mutação por herança do matriz. Fontes de permissão consideradas:
 *
 * 1. Papel direto no workspace ativo (membership local).
 * 2. Impersonação ativa: o backend só emite sessão de modo suporte para quem é admin matriz,
 *    então tratamos como permitido aqui também (o backend revalida em todas as mutações).
 * 3. Qualquer membership com papel admin de agência/matriz em outra org — cobre casos em que
 *    o usuário acessa o filho por contexto sem impersonação.
 */
export function canUserEditMarketingSettingsEffective(input: {
  directRole: string | undefined | null;
  isImpersonating?: boolean;
  memberships?: Array<{ role: string }> | null;
}): boolean {
  if (canUserEditMarketingSettings(input.directRole)) return true;
  if (input.isImpersonating) return true;
  if (input.memberships?.some((m) => MARKETING_SETTINGS_WRITE_ROLES.has(m.role))) return true;
  return false;
}
