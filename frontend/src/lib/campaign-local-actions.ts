export type CampaignActionLogEntry = {
  at: string;
  channel: "Meta" | "Google";
  externalId: string;
  campaignName: string;
  kind: "pause" | "activate" | "budget_set" | "bulk_pause" | "bulk_budget";
  detail?: string;
};

const KEY = "ativadash:ads-campaign-actions:v1";
const MAX = 200;

export function appendCampaignActionLog(e: CampaignActionLogEntry): void {
  try {
    const raw = localStorage.getItem(KEY);
    const arr: CampaignActionLogEntry[] = raw ? (JSON.parse(raw) as CampaignActionLogEntry[]) : [];
    arr.unshift(e);
    localStorage.setItem(KEY, JSON.stringify(arr.slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

export function readCampaignActionLog(externalId: string): CampaignActionLogEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr: CampaignActionLogEntry[] = raw ? (JSON.parse(raw) as CampaignActionLogEntry[]) : [];
    return arr.filter((x) => x.externalId === externalId);
  } catch {
    return [];
  }
}
