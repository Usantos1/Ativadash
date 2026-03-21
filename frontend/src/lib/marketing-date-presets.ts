import {
  startOfDay,
  endOfDay,
  subDays,
  subMonths,
  startOfWeek,
  startOfMonth,
  differenceInCalendarDays,
  format,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime, fromZonedTime, formatInTimeZone } from "date-fns-tz";

export const MARKETING_TZ = "America/Sao_Paulo";

export type MarketingPresetId =
  | "today"
  | "yesterday"
  | "today_yesterday"
  | "last_7d"
  | "last_14d"
  | "last_28d"
  | "last_30d"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "maximum"
  | "custom";

export type WallRange = { from: Date; to: Date };

const WEEK_OPTS = { weekStartsOn: 1 as const };

function rangeWallToUtc(startWall: Date, endWall: Date): WallRange {
  return {
    from: fromZonedTime(startOfDay(startWall), MARKETING_TZ),
    to: fromZonedTime(endOfDay(endWall), MARKETING_TZ),
  };
}

/** Hoje em SP (início do dia civil → fim do dia civil, instantes UTC). */
export function getPresetRange(id: MarketingPresetId): WallRange {
  const nowZ = toZonedTime(new Date(), MARKETING_TZ);
  const todayStart = startOfDay(nowZ);

  switch (id) {
    case "today":
      return rangeWallToUtc(todayStart, todayStart);
    case "yesterday": {
      const y = subDays(todayStart, 1);
      return rangeWallToUtc(y, y);
    }
    case "today_yesterday": {
      const y = subDays(todayStart, 1);
      return rangeWallToUtc(y, todayStart);
    }
    case "last_7d":
      return rangeWallToUtc(subDays(todayStart, 6), todayStart);
    case "last_14d":
      return rangeWallToUtc(subDays(todayStart, 13), todayStart);
    case "last_28d":
      return rangeWallToUtc(subDays(todayStart, 27), todayStart);
    case "last_30d":
      return rangeWallToUtc(subDays(todayStart, 29), todayStart);
    case "this_week": {
      const w0 = startOfWeek(todayStart, WEEK_OPTS);
      return rangeWallToUtc(w0, todayStart);
    }
    case "last_week": {
      const thisStart = startOfWeek(todayStart, WEEK_OPTS);
      const lastEnd = subDays(thisStart, 1);
      const lastStart = startOfWeek(lastEnd, WEEK_OPTS);
      return rangeWallToUtc(lastStart, lastEnd);
    }
    case "this_month": {
      const m0 = startOfMonth(todayStart);
      return rangeWallToUtc(m0, todayStart);
    }
    case "last_month": {
      const thisMonthStart = startOfMonth(todayStart);
      const endLast = subDays(thisMonthStart, 1);
      const startLast = startOfMonth(endLast);
      return rangeWallToUtc(startLast, endLast);
    }
    case "maximum": {
      /** Meta Insights costuma falhar ou estourar tempo com séries diárias de anos inteiros; ~36m é faixa estável. */
      const oldest = startOfDay(subMonths(todayStart, 36));
      return rangeWallToUtc(oldest, todayStart);
    }
    case "custom":
      return rangeWallToUtc(todayStart, todayStart);
    default:
      return rangeWallToUtc(subDays(todayStart, 29), todayStart);
  }
}

export function wallRangeToApi(r: WallRange): { startDate: string; endDate: string } {
  return {
    startDate: formatInTimeZone(r.from, MARKETING_TZ, "yyyy-MM-dd"),
    endDate: formatInTimeZone(r.to, MARKETING_TZ, "yyyy-MM-dd"),
  };
}

export function formatRangeSummaryPt(r: WallRange): string {
  const a = formatInTimeZone(r.from, MARKETING_TZ, "d 'de' MMM", { locale: ptBR });
  const b = formatInTimeZone(r.to, MARKETING_TZ, "d 'de' MMM yyyy", { locale: ptBR });
  return `${a} – ${b}`;
}

export function formatRangeShortPt(fromStr: string, toStr: string): string {
  try {
    const from = parseISO(fromStr);
    const to = parseISO(toStr);
    return `${formatInTimeZone(from, MARKETING_TZ, "d MMM", { locale: ptBR })} – ${formatInTimeZone(to, MARKETING_TZ, "d MMM yy", { locale: ptBR })}`;
  } catch {
    return `${fromStr} – ${toStr}`;
  }
}

const PRESET_LABEL: Record<MarketingPresetId, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  today_yesterday: "Hoje e ontem",
  last_7d: "Últimos 7 dias",
  last_14d: "Últimos 14 dias",
  last_28d: "Últimos 28 dias",
  last_30d: "Últimos 30 dias",
  this_week: "Esta semana",
  last_week: "Semana passada",
  this_month: "Este mês",
  last_month: "Mês passado",
  maximum: "Máximo (~3 anos)",
  custom: "Personalizado",
};

export function labelForPreset(id: MarketingPresetId): string {
  return PRESET_LABEL[id];
}

/** Lista completa para a coluna principal (exceto custom, tratado à parte). */
export const ALL_PRESET_ITEMS: { id: MarketingPresetId; label: string }[] = [
  { id: "today", label: PRESET_LABEL.today },
  { id: "yesterday", label: PRESET_LABEL.yesterday },
  { id: "today_yesterday", label: PRESET_LABEL.today_yesterday },
  { id: "last_7d", label: PRESET_LABEL.last_7d },
  { id: "last_14d", label: PRESET_LABEL.last_14d },
  { id: "last_28d", label: PRESET_LABEL.last_28d },
  { id: "last_30d", label: PRESET_LABEL.last_30d },
  { id: "this_week", label: PRESET_LABEL.this_week },
  { id: "last_week", label: PRESET_LABEL.last_week },
  { id: "this_month", label: PRESET_LABEL.this_month },
  { id: "last_month", label: PRESET_LABEL.last_month },
  { id: "maximum", label: PRESET_LABEL.maximum },
  { id: "custom", label: PRESET_LABEL.custom },
];

const RECENT_KEY = "ativadash-marketing-date-presets-recent";
const RECENT_MAX = 5;

export function loadRecentPresetIds(): MarketingPresetId[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is MarketingPresetId => typeof x === "string");
  } catch {
    return [];
  }
}

export function pushRecentPreset(id: MarketingPresetId): void {
  if (id === "custom") return;
  try {
    const cur = loadRecentPresetIds().filter((x) => x !== id);
    cur.unshift(id);
    localStorage.setItem(RECENT_KEY, JSON.stringify(cur.slice(0, RECENT_MAX)));
  } catch {
    /* ignore */
  }
}

/** Período anterior com o mesmo número de dias civis. */
export function previousPeriodOfEqualLength(startDate: string, endDate: string): { startDate: string; endDate: string } {
  const from = parseISO(startDate);
  const to = parseISO(endDate);
  const len = differenceInCalendarDays(to, from) + 1;
  const prevEnd = subDays(from, 1);
  const prevStart = subDays(prevEnd, len - 1);
  return {
    startDate: format(prevStart, "yyyy-MM-dd"),
    endDate: format(prevEnd, "yyyy-MM-dd"),
  };
}

export function inferInsightPeriod(startDate: string, endDate: string): "7d" | "30d" | "90d" {
  const from = parseISO(startDate);
  const to = parseISO(endDate);
  const len = differenceInCalendarDays(to, from) + 1;
  if (len <= 7) return "7d";
  if (len <= 30) return "30d";
  return "90d";
}

export function defaultLast30ApiRange(): { startDate: string; endDate: string } {
  return wallRangeToApi(getPresetRange("last_30d"));
}
