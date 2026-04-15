import { api } from "./api";

export type CheckoutEventRow = {
  id: string;
  source: string;
  externalEventId: string;
  eventType: string;
  status: string;
  transactionId: string;
  productId: string | null;
  productName: string | null;
  buyerEmail: string | null;
  buyerName: string | null;
  amountBrl: number;
  currency: string;
  utmSource: string | null;
  utmCampaign: string | null;
  mappedCampaignId: string | null;
  mappedChannel: string | null;
  occurredAt: string;
  createdAt: string;
};

export type CheckoutRevenueSummary = {
  totalSales: number;
  totalRefunds: number;
  totalNet: number;
  countApproved: number;
  countRefunded: number;
  countTotal: number;
  bySource: Record<string, { sales: number; refunds: number; net: number; count: number }>;
};

export type CheckoutCampaignRevenue = {
  campaignId: string;
  channel: string | null;
  revenue: number;
  refunds: number;
  net: number;
  count: number;
};

export type CheckoutProductMappingRow = {
  id: string;
  organizationId: string;
  source: string;
  productId: string;
  productName: string | null;
  campaignId: string;
  channel: string;
  createdAt: string;
  updatedAt: string;
};

export async function fetchCheckoutEvents(params?: {
  limit?: number;
  offset?: number;
  source?: string;
  eventType?: string;
  startDate?: string;
  endDate?: string;
}): Promise<{ items: CheckoutEventRow[]; total: number }> {
  const q = new URLSearchParams();
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.offset) q.set("offset", String(params.offset));
  if (params?.source) q.set("source", params.source);
  if (params?.eventType) q.set("eventType", params.eventType);
  if (params?.startDate) q.set("startDate", params.startDate);
  if (params?.endDate) q.set("endDate", params.endDate);
  const qs = q.toString();
  return api.get<{ items: CheckoutEventRow[]; total: number }>(
    `/workspace/checkout-events${qs ? `?${qs}` : ""}`
  );
}

export async function fetchCheckoutRevenueSummary(
  startDate: string,
  endDate: string
): Promise<CheckoutRevenueSummary> {
  return api.get<CheckoutRevenueSummary>(
    `/workspace/checkout-events/summary?startDate=${startDate}&endDate=${endDate}`
  );
}

export async function fetchCheckoutRevenueByCampaign(
  startDate: string,
  endDate: string
): Promise<CheckoutCampaignRevenue[]> {
  const res = await api.get<{ items: CheckoutCampaignRevenue[] }>(
    `/workspace/checkout-events/by-campaign?startDate=${startDate}&endDate=${endDate}`
  );
  return res.items;
}

export async function fetchCheckoutProductMappings(): Promise<CheckoutProductMappingRow[]> {
  const res = await api.get<{ items: CheckoutProductMappingRow[] }>(
    "/workspace/checkout-product-mappings"
  );
  return res.items;
}

export async function upsertCheckoutProductMapping(body: {
  source: string;
  productId: string;
  productName?: string;
  campaignId: string;
  channel: "facebook" | "google";
}): Promise<CheckoutProductMappingRow> {
  const res = await api.post<{ item: CheckoutProductMappingRow }>(
    "/workspace/checkout-product-mappings",
    body
  );
  return res.item;
}

export async function deleteCheckoutProductMapping(id: string): Promise<void> {
  await api.delete(`/workspace/checkout-product-mappings/${id}`);
}
