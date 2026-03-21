import type {
  GoogleAdsCampaignRow,
  GoogleAdsDailyRow,
  MetaAdsCampaignRow,
  MetaAdsDailyRow,
} from "@/lib/integrations-api";
import { eachDayOfInterval, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export type TempFilter = "geral" | "frio" | "quente";

const HOT_NAME_RE =
  /remarketing|retarget|retargeting|\brmkt\b|quente|warm|carrinho|checkout|compra|venda|purchase|boiler|\bsig\b|vivo|convers/i;

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function isHotCampaignName(name: string): boolean {
  return HOT_NAME_RE.test(normalizeName(name));
}

export function campaignMatchesLaunch(campaignName: string, launchName: string | null): boolean {
  if (!launchName?.trim()) return true;
  const a = normalizeName(campaignName);
  const b = normalizeName(launchName);
  if (a.includes(b) || b.includes(a)) return true;
  const tokens = b.split(/\s+/).filter((t) => t.length >= 3);
  return tokens.some((t) => a.includes(t));
}

export function matchesTempFilter(name: string, temp: TempFilter): boolean {
  if (temp === "geral") return true;
  const hot = isHotCampaignName(name);
  if (temp === "quente") return hot;
  return !hot;
}

export function filterGoogleCampaigns(
  rows: GoogleAdsCampaignRow[],
  launchName: string | null,
  temp: TempFilter
): GoogleAdsCampaignRow[] {
  return rows.filter(
    (r) => campaignMatchesLaunch(r.campaignName, launchName) && matchesTempFilter(r.campaignName, temp)
  );
}

export function filterMetaCampaigns(
  rows: MetaAdsCampaignRow[],
  launchName: string | null,
  temp: TempFilter
): MetaAdsCampaignRow[] {
  return rows.filter(
    (r) => campaignMatchesLaunch(r.campaignName, launchName) && matchesTempFilter(r.campaignName, temp)
  );
}

export function aggregateGoogle(rows: GoogleAdsCampaignRow[]) {
  return rows.reduce(
    (acc, r) => ({
      impressions: acc.impressions + r.impressions,
      clicks: acc.clicks + r.clicks,
      costMicros: acc.costMicros + r.costMicros,
      conversions: acc.conversions + r.conversions,
      conversionsValue: acc.conversionsValue + r.conversionsValue,
    }),
    { impressions: 0, clicks: 0, costMicros: 0, conversions: 0, conversionsValue: 0 }
  );
}

export function aggregateMeta(rows: MetaAdsCampaignRow[]) {
  return rows.reduce(
    (acc, r) => ({
      impressions: acc.impressions + r.impressions,
      clicks: acc.clicks + r.clicks,
      spend: acc.spend + r.spend,
      leads: acc.leads + r.leads,
      purchases: acc.purchases + r.purchases,
      purchaseValue: acc.purchaseValue + (r.purchaseValue ?? 0),
    }),
    { impressions: 0, clicks: 0, spend: 0, leads: 0, purchases: 0, purchaseValue: 0 }
  );
}

export type ChartDayPoint = {
  date: string;
  gasto: number;
  leads: number;
  cpa: number;
};

function scaleDailyGoogle(rows: GoogleAdsDailyRow[], scale: number): Map<string, GoogleAdsDailyRow> {
  const m = new Map<string, GoogleAdsDailyRow>();
  for (const r of rows) {
    m.set(r.date, {
      date: r.date,
      impressions: r.impressions * scale,
      clicks: r.clicks * scale,
      costMicros: Math.round(r.costMicros * scale),
      conversions: r.conversions * scale,
    });
  }
  return m;
}

function scaleDailyMeta(rows: MetaAdsDailyRow[], scale: number): Map<string, MetaAdsDailyRow> {
  const m = new Map<string, MetaAdsDailyRow>();
  for (const r of rows) {
    m.set(r.date, {
      date: r.date,
      impressions: r.impressions * scale,
      clicks: r.clicks * scale,
      spend: r.spend * scale,
      leads: r.leads * scale,
      purchases: r.purchases * scale,
    });
  }
  return m;
}

export function buildMergedDailyChart(
  startDate: string,
  endDate: string,
  googleDaily: GoogleAdsDailyRow[],
  metaDaily: MetaAdsDailyRow[],
  scale: number
): ChartDayPoint[] {
  const gMap = scale === 1 ? new Map(googleDaily.map((d) => [d.date, d])) : scaleDailyGoogle(googleDaily, scale);
  const mMap = scale === 1 ? new Map(metaDaily.map((d) => [d.date, d])) : scaleDailyMeta(metaDaily, scale);
  const from = parseISO(startDate);
  const to = parseISO(endDate);
  const days = eachDayOfInterval({ start: from, end: to });
  return days.map((day) => {
    const key = format(day, "yyyy-MM-dd");
    const g = gMap.get(key);
    const m = mMap.get(key);
    const gasto = (g?.costMicros ?? 0) / 1_000_000 + (m?.spend ?? 0);
    const leads = (g?.conversions ?? 0) + (m?.leads ?? 0);
    const cpa = leads > 0 ? gasto / leads : 0;
    return {
      date: format(day, "d/MMM", { locale: ptBR }),
      gasto,
      leads: Math.round(leads * 100) / 100,
      cpa: Math.round(cpa * 100) / 100,
    };
  });
}

export function buildGoogleOnlyDailyChart(
  startDate: string,
  endDate: string,
  googleDaily: GoogleAdsDailyRow[],
  scale: number
): ChartDayPoint[] {
  const gMap = scale === 1 ? new Map(googleDaily.map((d) => [d.date, d])) : scaleDailyGoogle(googleDaily, scale);
  const from = parseISO(startDate);
  const to = parseISO(endDate);
  const days = eachDayOfInterval({ start: from, end: to });
  return days.map((day) => {
    const key = format(day, "yyyy-MM-dd");
    const g = gMap.get(key);
    const gasto = (g?.costMicros ?? 0) / 1_000_000;
    const leads = g?.conversions ?? 0;
    const cpa = leads > 0 ? gasto / leads : 0;
    return {
      date: format(day, "d/MMM", { locale: ptBR }),
      gasto,
      leads: Math.round(leads * 100) / 100,
      cpa: Math.round(cpa * 100) / 100,
    };
  });
}

export function buildMetaOnlyDailyChart(
  startDate: string,
  endDate: string,
  metaDaily: MetaAdsDailyRow[],
  scale: number
): ChartDayPoint[] {
  const mMap = scale === 1 ? new Map(metaDaily.map((d) => [d.date, d])) : scaleDailyMeta(metaDaily, scale);
  const from = parseISO(startDate);
  const to = parseISO(endDate);
  const days = eachDayOfInterval({ start: from, end: to });
  return days.map((day) => {
    const key = format(day, "yyyy-MM-dd");
    const m = mMap.get(key);
    const gasto = m?.spend ?? 0;
    const leads = (m?.leads ?? 0) + (m?.purchases ?? 0);
    const cpa = leads > 0 ? gasto / leads : 0;
    return {
      date: format(day, "d/MMM", { locale: ptBR }),
      gasto,
      leads: Math.round(leads * 100) / 100,
      cpa: Math.round(cpa * 100) / 100,
    };
  });
}

export function splitHotColdLeadsSpend(
  googleRows: GoogleAdsCampaignRow[],
  metaRows: MetaAdsCampaignRow[]
): {
  hotLeads: number;
  coldLeads: number;
  hotSpend: number;
  coldSpend: number;
} {
  let hotLeads = 0;
  let coldLeads = 0;
  let hotSpend = 0;
  let coldSpend = 0;
  for (const r of googleRows) {
    const h = isHotCampaignName(r.campaignName);
    const vol = r.conversions;
    const sp = r.costMicros / 1_000_000;
    if (h) {
      hotLeads += vol;
      hotSpend += sp;
    } else {
      coldLeads += vol;
      coldSpend += sp;
    }
  }
  for (const r of metaRows) {
    const h = isHotCampaignName(r.campaignName);
    const vol = r.leads + r.purchases;
    const sp = r.spend;
    if (h) {
      hotLeads += vol;
      hotSpend += sp;
    } else {
      coldLeads += vol;
      coldSpend += sp;
    }
  }
  return { hotLeads, coldLeads, hotSpend, coldSpend };
}

export type GradePct = { A: number; B: number; C: number; D: number };

export function gradeDistributionFromCampaigns(
  googleRows: GoogleAdsCampaignRow[],
  metaRows: MetaAdsCampaignRow[]
): GradePct {
  type W = { ctr: number; weight: number };
  const items: W[] = [];
  for (const r of googleRows) {
    const w = r.conversions + r.clicks * 0.1;
    if (w <= 0 && r.impressions <= 0) continue;
    const ctr = r.impressions > 0 ? r.clicks / r.impressions : 0;
    items.push({ ctr, weight: Math.max(1, w) });
  }
  for (const r of metaRows) {
    const w = r.leads + r.purchases + r.clicks * 0.1;
    if (w <= 0 && r.impressions <= 0) continue;
    const ctr = r.impressions > 0 ? r.clicks / r.impressions : 0;
    items.push({ ctr, weight: Math.max(1, w) });
  }
  if (items.length === 0) return { A: 0, B: 0, C: 0, D: 0 };
  items.sort((a, b) => b.ctr - a.ctr);
  const tw = items.reduce((s, x) => s + x.weight, 0);
  const grades = { A: 0, B: 0, C: 0, D: 0 };
  const n = items.length;
  items.forEach((c, i) => {
    const q = i / n;
    const g: keyof GradePct = q < 0.25 ? "A" : q < 0.5 ? "B" : q < 0.75 ? "C" : "D";
    grades[g] += c.weight;
  });
  return {
    A: (grades.A / tw) * 100,
    B: (grades.B / tw) * 100,
    C: (grades.C / tw) * 100,
    D: (grades.D / tw) * 100,
  };
}

export function computeScaleFactor(filteredSpend: number, totalSpend: number): number {
  if (totalSpend <= 0) return 1;
  if (filteredSpend <= 0) return 0;
  return Math.min(1.5, Math.max(0, filteredSpend / totalSpend));
}

/** Meta numérica de leads para “falta para meta” (maior alvo entre metas relacionadas a captação). */
export function pickLeadGoalTarget(goals: { targetValue: number; name: string; type: string }[]): number | null {
  if (!goals.length) return null;
  const leadish = goals.filter(
    (g) =>
      g.type.toLowerCase().includes("lead") ||
      g.name.toLowerCase().includes("lead") ||
      g.type.toLowerCase().includes("captacao") ||
      g.name.toLowerCase().includes("capta") ||
      g.type.toLowerCase().includes("mql")
  );
  const pool = leadish.length > 0 ? leadish : goals;
  return Math.max(...pool.map((g) => g.targetValue));
}
