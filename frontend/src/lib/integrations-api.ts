import { api } from "./api";

export interface IntegrationFromApi {
  id: string;
  platform: string;
  slug: string;
  status: string;
  lastSyncAt: string | null;
  createdAt: string;
}

export async function fetchIntegrations(): Promise<IntegrationFromApi[]> {
  const res = await api.get<{ integrations: IntegrationFromApi[] }>("/integrations");
  return res.integrations;
}

export async function getGoogleAdsAuthUrl(): Promise<string> {
  const res = await api.get<{ url: string }>("/integrations/google-ads/auth-url");
  return res.url;
}

export async function disconnectIntegration(id: string): Promise<void> {
  await api.delete(`/integrations/${id}`);
}
