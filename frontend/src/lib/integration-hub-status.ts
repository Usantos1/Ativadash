import type { IntegrationHubItem } from "@/lib/integration-hub-registry";
import type { AtivaCrmHubFromApi, IntegrationFromApi } from "@/lib/integrations-api";

/** Ativa CRM usa MarketingSettings, não a tabela `Integration`. */
export function isAtivaCrmHubItem(item: IntegrationHubItem): boolean {
  return item.id === "ativa-crm";
}

/**
 * “Conectado” no hub: OAuth (Google/Meta) ou critérios Ativa CRM alinhados ao backend
 * (`ativaCrmHub.connected`).
 */
export function isHubIntegrationConnected(
  item: IntegrationHubItem,
  row: IntegrationFromApi | undefined,
  ativaCrmHub: AtivaCrmHubFromApi
): boolean {
  if (!item.available) return false;
  if (isAtivaCrmHubItem(item)) return ativaCrmHub.connected;
  return row?.status === "connected";
}
