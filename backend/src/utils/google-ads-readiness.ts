import { env } from "../config/env.js";

/** Developer token obrigatório para qualquer chamada à Google Ads API (incl. listAccessibleCustomers). */
export function isGoogleAdsDeveloperTokenConfigured(): boolean {
  return Boolean(env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim());
}

/** Flag de produto: API/anúncio de UX ainda não liberado para o cliente. */
export function isGoogleAdsUxPending(): boolean {
  return Boolean(env.GOOGLE_ADS_UX_PENDING);
}

export type GoogleAdsIntegrationUiStatus =
  | "not_connected"
  | "connected"
  | "pending_configuration"
  | "api_not_ready";

/**
 * Status agregado para o painel (sem chamar a API do Google).
 * - `api_not_ready`: UX pendente no servidor.
 * - `pending_configuration`: integração OAuth ok, mas falta developer token (ou equivalente) no servidor.
 */
export function computeGoogleAdsIntegrationUiStatus(googleIntegrationConnected: boolean): GoogleAdsIntegrationUiStatus {
  if (isGoogleAdsUxPending()) {
    return "api_not_ready";
  }
  if (!isGoogleAdsDeveloperTokenConfigured()) {
    if (googleIntegrationConnected) {
      return "pending_configuration";
    }
    return "not_connected";
  }
  if (!googleIntegrationConnected) {
    return "not_connected";
  }
  return "connected";
}
