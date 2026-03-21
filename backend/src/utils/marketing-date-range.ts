const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
/** Limite prático para APIs de anúncios (evita consultas enormes). */
export const METRICS_MAX_RANGE_DAYS = 731;

export type MetricsDateRange = { start: string; end: string };

export function parseMetricsDateRangeQuery(q: {
  startDate?: string;
  endDate?: string;
  period?: string;
}): MetricsDateRange {
  const s = q.startDate?.trim();
  const e = q.endDate?.trim();
  if (s && e) {
    if (!ISO.test(s) || !ISO.test(e)) {
      throw new Error("Datas inválidas. Use o formato YYYY-MM-DD.");
    }
    if (s > e) {
      throw new Error("A data inicial não pode ser maior que a final.");
    }
    const t0 = Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
    const t1 = Date.UTC(+e.slice(0, 4), +e.slice(5, 7) - 1, +e.slice(8, 10));
    const days = (t1 - t0) / 86400000 + 1;
    if (days > METRICS_MAX_RANGE_DAYS) {
      throw new Error(`Período máximo: ${METRICS_MAX_RANGE_DAYS} dias.`);
    }
    return { start: s, end: e };
  }

  const period = q.period ?? "30d";
  const n = period === "7d" ? 7 : period === "90d" ? 90 : 30;
  const end = new Date();
  const endStr = end.toISOString().slice(0, 10);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (n - 1));
  const startStr = start.toISOString().slice(0, 10);
  return { start: startStr, end: endStr };
}
