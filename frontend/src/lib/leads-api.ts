import { api } from "./api";

export type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "WON" | "LOST";
export type LeadProfile = "AGENCY" | "CLIENT" | "FREELANCER" | "UNKNOWN";
export type LeadAdsBudget =
  | "UNDER_5K"
  | "FROM_5K_TO_25K"
  | "FROM_25K_TO_100K"
  | "OVER_100K"
  | "UNKNOWN";

export type LeadAssignedUser = {
  id: string;
  name: string;
  email: string;
};

export type LeadRow = {
  id: string;
  fullName: string;
  email: string;
  whatsapp: string;
  companyName: string | null;
  websiteUrl: string | null;
  profile: LeadProfile;
  monthlyAdsBudget: LeadAdsBudget;
  monthlyRevenueBrl: string | number | null;
  managedAccountsCount: number | null;
  teamSize: number | null;
  primaryChannel: string | null;
  goal: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  referrer: string | null;
  pageUrl: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  status: LeadStatus;
  assignedToUserId: string | null;
  assignedToUser: LeadAssignedUser | null;
  notes: string | null;
  contactedAt: string | null;
  qualifiedAt: string | null;
  wonAt: string | null;
  lostAt: string | null;
  lostReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LeadStats = {
  NEW: number;
  CONTACTED: number;
  QUALIFIED: number;
  WON: number;
  LOST: number;
  TOTAL: number;
};

export type ListLeadsResponse = {
  items: LeadRow[];
  total: number;
  limit: number;
  offset: number;
  stats: LeadStats;
};

export async function fetchLeads(params?: {
  status?: LeadStatus | "ALL";
  search?: string;
  assignedToUserId?: string | "UNASSIGNED";
  limit?: number;
  offset?: number;
}): Promise<ListLeadsResponse> {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.search?.trim()) q.set("search", params.search.trim());
  if (params?.assignedToUserId) q.set("assignedToUserId", params.assignedToUserId);
  if (params?.limit != null) q.set("limit", String(params.limit));
  if (params?.offset != null) q.set("offset", String(params.offset));
  const qs = q.toString();
  return api.get(`/platform/leads${qs ? `?${qs}` : ""}`);
}

export async function fetchLead(id: string): Promise<{ lead: LeadRow }> {
  return api.get(`/platform/leads/${encodeURIComponent(id)}`);
}

export async function patchLead(
  id: string,
  body: {
    status?: LeadStatus;
    assignedToUserId?: string | null;
    notes?: string | null;
    lostReason?: string | null;
  }
): Promise<{ lead: LeadRow }> {
  return api.patch(`/platform/leads/${encodeURIComponent(id)}`, body);
}

export async function deleteLead(id: string): Promise<void> {
  return api.delete(`/platform/leads/${encodeURIComponent(id)}`);
}

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: "Novo",
  CONTACTED: "Contatado",
  QUALIFIED: "Qualificado",
  WON: "Ganho",
  LOST: "Perdido",
};

export const LEAD_PROFILE_LABEL: Record<LeadProfile, string> = {
  AGENCY: "Agência",
  CLIENT: "Cliente final",
  FREELANCER: "Profissional autônomo",
  UNKNOWN: "Não informado",
};

export const LEAD_BUDGET_LABEL: Record<LeadAdsBudget, string> = {
  UNDER_5K: "< R$ 5k/mês",
  FROM_5K_TO_25K: "R$ 5k–25k/mês",
  FROM_25K_TO_100K: "R$ 25k–100k/mês",
  OVER_100K: "R$ 100k+/mês",
  UNKNOWN: "Não informado",
};
