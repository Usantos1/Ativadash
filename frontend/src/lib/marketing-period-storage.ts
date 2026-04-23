import type { DateFilterApplyPayload } from "@/components/marketing/MarketingDateRangeDialog";
import type { MarketingPresetId } from "@/lib/marketing-date-presets";
import { defaultLast30ApiRange, labelForPreset, wallRangeToApi, getPresetRange, formatRangeShortPt } from "@/lib/marketing-date-presets";

const STORAGE_KEY = "ativadash:period";

export type StoredMarketingPeriod = {
  presetId: MarketingPresetId;
  startDate: string;
  endDate: string;
  label: string;
};

function isPresetId(x: string): x is MarketingPresetId {
  return typeof x === "string" && x.length > 0;
}

/** Restaura período salvo ou null se inválido / vazio. */
export function loadStoredMarketingPeriod(): StoredMarketingPeriod | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<StoredMarketingPeriod>;
    if (!o.startDate || !o.endDate || !o.label || !o.presetId || !isPresetId(o.presetId)) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(o.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(o.endDate)) return null;
    if (o.startDate > o.endDate) return null;
    /**
     * Recomputa o label na leitura usando o formatador atual. Como o label é persistido
     * por até 120 chars, labels antigos (ex.: sem ano no início quando o range cruza anos)
     * continuariam aparecendo mesmo após deploys que mudam a formatação. Regerar aqui
     * garante consistência visual sem exigir que o usuário reaplique o filtro.
     */
    const datePart = formatRangeShortPt(o.startDate, o.endDate);
    const label =
      o.presetId === "custom" ? datePart : `${labelForPreset(o.presetId)} · ${datePart}`;
    return {
      presetId: o.presetId,
      startDate: o.startDate,
      endDate: o.endDate,
      label: label.slice(0, 120),
    };
  } catch {
    return null;
  }
}

/** Persiste após aplicar filtro de datas nas páginas ADS. */
export function persistMarketingPeriod(payload: DateFilterApplyPayload | StoredMarketingPeriod): void {
  try {
    const row: StoredMarketingPeriod = {
      presetId: payload.presetId,
      startDate: payload.startDate,
      endDate: payload.endDate,
      label: payload.label,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(row));
  } catch {
    /* ignore */
  }
}

/** Estado inicial do hook: preferência salva ou últimos 30 dias. */
export function getInitialMarketingPeriodState(): {
  dateRange: { startDate: string; endDate: string };
  dateRangeLabel: string;
  presetId: MarketingPresetId;
} {
  const saved = loadStoredMarketingPeriod();
  if (saved) {
    return {
      dateRange: { startDate: saved.startDate, endDate: saved.endDate },
      dateRangeLabel: saved.label,
      presetId: saved.presetId,
    };
  }
  const dr = defaultLast30ApiRange();
  const datePart = formatRangeShortPt(dr.startDate, dr.endDate);
  return {
    dateRange: dr,
    dateRangeLabel: `${labelForPreset("last_30d")} · ${datePart}`,
    presetId: "last_30d",
  };
}

/** Quando o preset não é custom, revalida datas (ex.: virada de dia) mantendo o preset. */
export function refreshPresetDatesIfNeeded(presetId: MarketingPresetId): {
  startDate: string;
  endDate: string;
  label: string;
} | null {
  if (presetId === "custom") return null;
  const api = wallRangeToApi(getPresetRange(presetId));
  const datePart = formatRangeShortPt(api.startDate, api.endDate);
  return {
    startDate: api.startDate,
    endDate: api.endDate,
    label: `${labelForPreset(presetId)} · ${datePart}`,
  };
}

export function isNonDefaultPeriod(presetId: MarketingPresetId): boolean {
  return presetId !== "last_30d";
}
