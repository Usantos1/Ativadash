import { API_URL } from "./env";
import type { LandingTracking } from "./utm";

export type LeadProfile = "AGENCY" | "CLIENT" | "FREELANCER" | "UNKNOWN";
export type LeadAdsBudget =
  | "UNDER_5K"
  | "FROM_5K_TO_25K"
  | "FROM_25K_TO_100K"
  | "OVER_100K"
  | "UNKNOWN";

export type CreateLeadPayload = {
  fullName: string;
  email: string;
  whatsapp: string;
  companyName?: string | null;
  websiteUrl?: string | null;
  profile?: LeadProfile;
  monthlyAdsBudget?: LeadAdsBudget;
  monthlyRevenueBrl?: number | null;
  managedAccountsCount?: number | null;
  teamSize?: number | null;
  primaryChannel?: string | null;
  goal?: string | null;
  /** Honeypot anti-bot: enviar string vazia. */
  company_website?: string;
} & Partial<LandingTracking>;

export class LeadSubmitError extends Error {
  readonly status: number;
  readonly fieldErrors: Record<string, string[]> | null;
  constructor(message: string, status: number, fieldErrors: Record<string, string[]> | null = null) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export async function submitLead(payload: CreateLeadPayload): Promise<{ ok: true; leadId?: string }> {
  const res = await fetch(`${API_URL}/api/leads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* sem JSON: deixa null */
  }

  if (!res.ok) {
    const message =
      (body && typeof body === "object" && "message" in body && typeof (body as { message: unknown }).message === "string"
        ? (body as { message: string }).message
        : null) || `Falha ao enviar (HTTP ${res.status})`;
    const fieldErrors =
      body && typeof body === "object" && "errors" in body
        ? ((body as { errors: Record<string, string[]> | null }).errors ?? null)
        : null;
    throw new LeadSubmitError(message, res.status, fieldErrors);
  }

  return { ok: true, leadId: body && typeof body === "object" && "leadId" in body ? String((body as { leadId: unknown }).leadId) : undefined };
}
