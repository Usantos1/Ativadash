import type { BusinessGoalMode } from "@/lib/business-goal-mode";
import type { MarketingDashboardPerfRow } from "@/lib/marketing-dashboard-api";

export type PerfEntityStatus = NonNullable<MarketingDashboardPerfRow["entityStatus"]>;

export type PerfStatusFilter = "all" | "active" | "paused";
export type PerfDeliveryFilter = "all" | "with" | "without";
export type PerfSortKey = "spend" | "conversions" | "efficiency" | "ctr" | "clicks";

export type PerfHighlightFlags = {
  bestCpl: boolean;
  maxSpend: boolean;
  weakCtr: boolean;
  attention: boolean;
};

export type PerfUiStatus =
  | "sem_entrega"
  | "atencao"
  | "ativa"
  | "pausada"
  | "arquivada"
  | "desconhecida";

const SPEND_EPS = 0.005;

export function rowHasDelivery(r: MarketingDashboardPerfRow): boolean {
  return r.impressions > 0 || r.clicks > 0 || r.spend > SPEND_EPS;
}

export function primaryConversions(r: MarketingDashboardPerfRow, mode: BusinessGoalMode): number {
  if (mode === "SALES") return r.purchases;
  if (mode === "LEADS") return r.leads;
  /** Google Ads (mapper) replica a mesma conversão em leads e compras no modo híbrido. */
  if (r.id.startsWith("g:") && r.leads > 0 && r.leads === r.purchases) return r.leads;
  return r.leads + r.purchases;
}

export function cpaOrNull(r: MarketingDashboardPerfRow): number | null {
  return r.purchases > 0 && r.spend > 0 ? r.spend / r.purchases : null;
}

export function buildPerfHighlights(
  rows: MarketingDashboardPerfRow[],
  mode: BusinessGoalMode
): Map<string, PerfHighlightFlags> {
  const map = new Map<string, PerfHighlightFlags>();
  for (const r of rows) {
    map.set(r.id, { bestCpl: false, maxSpend: false, weakCtr: false, attention: false });
  }
  const spendy = rows.filter((r) => r.spend >= 20);
  let minCpl = Infinity;
  let minCplId: string | null = null;
  for (const r of spendy) {
    if (r.cpl != null && r.cpl > 0 && r.cpl < minCpl) {
      minCpl = r.cpl;
      minCplId = r.id;
    }
  }
  if (minCplId) map.get(minCplId)!.bestCpl = true;

  let maxS = 0;
  let maxId: string | null = null;
  for (const r of rows) {
    if (r.spend > maxS) {
      maxS = r.spend;
      maxId = r.id;
    }
  }
  if (maxId && maxS >= 30) map.get(maxId)!.maxSpend = true;

  let minCtr = Infinity;
  let minCtrId: string | null = null;
  for (const r of rows) {
    if (r.impressions >= 400 && r.ctrPct != null && r.ctrPct < minCtr) {
      minCtr = r.ctrPct;
      minCtrId = r.id;
    }
  }
  if (minCtrId != null && minCtr < 0.8) map.get(minCtrId)!.weakCtr = true;

  for (const r of rows) {
    if (!rowHasDelivery(r)) continue;
    const conv = primaryConversions(r, mode);
    const eff =
      mode === "SALES"
        ? cpaOrNull(r)
        : mode === "LEADS"
          ? r.cpl != null && r.cpl > 0
            ? r.cpl
            : null
          : (() => {
              const cpl = r.cpl != null && r.cpl > 0 ? r.cpl : null;
              const cpa = cpaOrNull(r);
              if (cpl != null && cpa != null) return Math.min(cpl, cpa);
              return cpl ?? cpa;
            })();
    const highSpendNoResult = r.spend >= 45 && conv === 0;
    const poorEfficiency =
      eff != null &&
      r.spend >= 25 &&
      ((mode === "SALES" && eff > 120) || (mode !== "SALES" && eff > 80));
    if (highSpendNoResult || poorEfficiency) {
      map.get(r.id)!.attention = true;
    }
  }

  return map;
}

export function resolvePerfUiStatus(
  row: MarketingDashboardPerfRow,
  flags: PerfHighlightFlags
): PerfUiStatus {
  if (!rowHasDelivery(row)) return "sem_entrega";
  if (flags.attention || flags.weakCtr) return "atencao";
  const st = row.entityStatus;
  if (st === "ACTIVE") return "ativa";
  if (st === "PAUSED") return "pausada";
  if (st === "ARCHIVED") return "arquivada";
  return "desconhecida";
}

export function matchesStatusFilter(row: MarketingDashboardPerfRow, f: PerfStatusFilter): boolean {
  if (f === "all") return true;
  const st = row.entityStatus;
  if (f === "active") return st === "ACTIVE";
  return st === "PAUSED" || st === "ARCHIVED";
}

export function matchesDeliveryFilter(row: MarketingDashboardPerfRow, f: PerfDeliveryFilter): boolean {
  if (f === "all") return true;
  const d = rowHasDelivery(row);
  return f === "with" ? d : !d;
}

export function matchesSearch(row: MarketingDashboardPerfRow, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const hay = `${row.name} ${row.parentName ?? ""} ${row.objective ?? ""}`.toLowerCase();
  return hay.includes(s);
}

function efficiencySortValue(
  row: MarketingDashboardPerfRow,
  mode: BusinessGoalMode
): number | null {
  if (mode === "SALES") return cpaOrNull(row);
  if (mode === "LEADS") return row.cpl != null && row.cpl > 0 ? row.cpl : null;
  const cpl = row.cpl != null && row.cpl > 0 ? row.cpl : null;
  const cpa = cpaOrNull(row);
  if (cpl != null && cpa != null) return Math.min(cpl, cpa);
  return cpl ?? cpa ?? null;
}

export function sortPerfRows(
  rows: MarketingDashboardPerfRow[],
  key: PerfSortKey,
  mode: BusinessGoalMode
): MarketingDashboardPerfRow[] {
  const out = [...rows];
  const num = (v: number | null | undefined, fallback: number) =>
    v != null && Number.isFinite(v) ? v : fallback;

  out.sort((a, b) => {
    switch (key) {
      case "spend":
        return b.spend - a.spend;
      case "clicks":
        return b.clicks - a.clicks;
      case "ctr": {
        const ca = num(a.ctrPct, -1);
        const cb = num(b.ctrPct, -1);
        return cb - ca;
      }
      case "conversions": {
        return primaryConversions(b, mode) - primaryConversions(a, mode);
      }
      case "efficiency": {
        const va = efficiencySortValue(a, mode);
        const vb = efficiencySortValue(b, mode);
        if (va == null && vb == null) return b.spend - a.spend;
        if (va == null) return 1;
        if (vb == null) return -1;
        return va - vb;
      }
      default:
        return 0;
    }
  });
  return out;
}

export function applyPerfTablePipeline(
  rows: MarketingDashboardPerfRow[],
  opts: {
    status: PerfStatusFilter;
    delivery: PerfDeliveryFilter;
    search: string;
    sort: PerfSortKey;
    mode: BusinessGoalMode;
  }
): MarketingDashboardPerfRow[] {
  let next = rows.filter((r) => matchesStatusFilter(r, opts.status));
  next = next.filter((r) => matchesDeliveryFilter(r, opts.delivery));
  next = next.filter((r) => matchesSearch(r, opts.search));
  return sortPerfRows(next, opts.sort, opts.mode);
}
