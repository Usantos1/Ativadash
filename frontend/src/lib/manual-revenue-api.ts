import { api } from "./api";

export type ManualRevenueRow = {
  campaignId: string;
  channel: string;
  manualRevenue: number;
};

/**
 * Busca receitas manuais agregadas por campanha/canal.
 * Se `range` for fornecido, o backend soma apenas entradas com `referenceDate` no intervalo.
 * Sem range, retorna todo o histórico.
 */
export async function fetchManualRevenues(range?: {
  start?: string;
  end?: string;
}): Promise<ManualRevenueRow[]> {
  const qs: string[] = [];
  if (range?.start) qs.push(`start=${encodeURIComponent(range.start)}`);
  if (range?.end) qs.push(`end=${encodeURIComponent(range.end)}`);
  const suffix = qs.length ? `?${qs.join("&")}` : "";
  const res = await api.get<{ ok: boolean; rows: ManualRevenueRow[] }>(
    `/marketing/manual-revenue${suffix}`
  );
  return res.rows ?? [];
}

/**
 * Persiste uma entrada de receita manual atribuída a um dia específico (default = hoje).
 * Valor zero remove a entrada do dia; para apagar todo o histórico de uma campanha,
 * chame sem `referenceDate` com `revenueAmount = 0`.
 */
export async function upsertManualRevenue(
  campaignId: string,
  channel: string,
  revenueAmount: number,
  referenceDate?: string
): Promise<{ ok: boolean }> {
  const body: {
    campaignId: string;
    channel: string;
    revenueAmount: number;
    referenceDate?: string;
  } = { campaignId, channel, revenueAmount };
  if (referenceDate) body.referenceDate = referenceDate;
  return api.put("/marketing/manual-revenue", body);
}
