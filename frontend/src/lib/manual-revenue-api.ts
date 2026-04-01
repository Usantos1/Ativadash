import { api } from "./api";

export type ManualRevenueRow = {
  campaignId: string;
  channel: string;
  manualRevenue: number;
};

export async function fetchManualRevenues(): Promise<ManualRevenueRow[]> {
  const res = await api.get<{ ok: boolean; rows: ManualRevenueRow[] }>("/marketing/manual-revenue");
  return res.rows ?? [];
}

export async function upsertManualRevenue(
  campaignId: string,
  channel: string,
  revenueAmount: number
): Promise<{ ok: boolean }> {
  return api.put("/marketing/manual-revenue", { campaignId, channel, revenueAmount });
}
