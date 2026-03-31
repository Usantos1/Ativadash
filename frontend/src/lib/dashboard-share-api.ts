import { api } from "@/lib/api";
import { API_BASE } from "@/lib/api-config";

export type DashboardSharePage = "painel" | "captacao" | "conversao" | "receita";

export type DashboardShareSections = {
  kpis: boolean;
  channels: boolean;
  chart: boolean;
  table: boolean;
  insights: boolean;
};

export type ShareExpirationOption = "never" | "7d" | "30d" | "90d";

export async function createDashboardShare(payload: {
  page: DashboardSharePage;
  sections: DashboardShareSections;
  startDate: string;
  endDate: string;
  periodLabel: string;
  expiration: ShareExpirationOption;
}): Promise<{ token: string }> {
  return api.post<{ token: string }>("/marketing/dashboard-shares", payload);
}

export type PublicShareMeta = {
  organizationName: string;
  page: string;
  periodLabel: string;
  startDate: string;
  endDate: string;
  sections: DashboardShareSections;
  expired: boolean;
  expiresAt: string | null;
};

export async function fetchPublicShareMeta(token: string): Promise<PublicShareMeta> {
  const res = await fetch(`${API_BASE}/public/dashboard-share/${encodeURIComponent(token)}`);
  const data = (await res.json().catch(() => ({}))) as { message?: string } & Partial<PublicShareMeta>;
  if (!res.ok) {
    throw new Error(typeof data.message === "string" ? data.message : "Link inválido.");
  }
  return data as PublicShareMeta;
}

export type PublicShareSnapshot = PublicShareMeta & {
  hasGoogle: boolean;
  hasMeta: boolean;
  googleError: string | null;
  metaError: string | null;
  totals: {
    spend: number;
    impressions: number;
    clicks: number;
    leads: number;
    revenue: number;
    ctr: number | null;
    cpc: number | null;
    cpl: number | null;
    roas: number | null;
  };
  topCampaigns: { name: string; channel: string; spend: number; leads: number; revenue: number }[];
};

export async function fetchPublicShareSnapshot(token: string): Promise<PublicShareSnapshot> {
  const res = await fetch(`${API_BASE}/public/dashboard-share/${encodeURIComponent(token)}/snapshot`);
  const data = (await res.json().catch(() => ({}))) as { message?: string } & Partial<PublicShareSnapshot>;
  if (!res.ok) {
    throw new Error(typeof data.message === "string" ? data.message : "Não foi possível carregar o snapshot.");
  }
  return data as PublicShareSnapshot;
}
