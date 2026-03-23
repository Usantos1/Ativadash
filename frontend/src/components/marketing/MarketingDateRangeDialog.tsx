import { useEffect, useMemo, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { ptBR } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ALL_PRESET_ITEMS,
  type MarketingPresetId,
  getPresetRange,
  labelForPreset,
  loadRecentPresetIds,
  formatRangeShortPt,
  MARKETING_TZ,
} from "@/lib/marketing-date-presets";

export type DateFilterApplyPayload = {
  startDate: string;
  endDate: string;
  label: string;
  presetId: MarketingPresetId;
  compareEnabled: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: { startDate: string; endDate: string };
  initialLabel: string;
  initialPresetId: MarketingPresetId;
  initialCompare: boolean;
  onApply: (p: DateFilterApplyPayload) => void;
};

function parseYmdToLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function MarketingDateRangeDialog({
  open,
  onOpenChange,
  initial,
  initialLabel,
  initialPresetId,
  initialCompare,
  onApply,
}: Props) {
  const [presetId, setPresetId] = useState<MarketingPresetId>(initialPresetId);
  const [range, setRange] = useState<DateRange | undefined>(() => ({
    from: parseYmdToLocalDate(initial.startDate),
    to: parseYmdToLocalDate(initial.endDate),
  }));
  const [compare, setCompare] = useState(initialCompare);

  useEffect(() => {
    if (!open) return;
    setPresetId(initialPresetId);
    setRange({
      from: parseYmdToLocalDate(initial.startDate),
      to: parseYmdToLocalDate(initial.endDate),
    });
    setCompare(initialCompare);
  }, [open, initial.startDate, initial.endDate, initialPresetId, initialCompare, initialLabel]);

  const recentIds = useMemo(() => loadRecentPresetIds(), [open]);

  function applyPreset(id: MarketingPresetId) {
    setPresetId(id);
    if (id === "custom") return;
    const w = getPresetRange(id);
    setRange({ from: w.from, to: w.to });
  }

  function handleCalendarSelect(next: DateRange | undefined) {
    setPresetId("custom");
    setRange(next);
  }

  function handleApply() {
    const from = range?.from;
    const to = range?.to ?? range?.from;
    if (!from || !to) return;
    const startDate = formatInTimeZone(from, MARKETING_TZ, "yyyy-MM-dd");
    const endDate = formatInTimeZone(to, MARKETING_TZ, "yyyy-MM-dd");
    const label =
      presetId === "custom" ? formatRangeShortPt(startDate, endDate) : labelForPreset(presetId);
    onApply({
      startDate,
      endDate,
      label,
      presetId,
      compareEnabled: compare,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showClose
        title="Período"
        className="flex max-h-[95dvh] w-[min(100vw-1rem,80rem)] max-w-none flex-col gap-0 overflow-y-auto overflow-x-visible p-0 sm:max-h-[90vh]"
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
          <aside className="w-full shrink-0 border-b border-border/80 lg:w-[min(100%,240px)] lg:max-w-[240px] lg:border-b-0 lg:border-r">
            <div className="max-h-[40vh] overflow-y-auto p-3 lg:max-h-[min(70vh,520px)]">
              {recentIds.length > 0 && (
                <>
                  <p className="mb-2 px-2 text-xs font-medium text-muted-foreground">Usados recentemente</p>
                  <ul className="mb-3 space-y-0.5">
                    {recentIds.map((id) => (
                      <li key={`r-${id}`}>
                        <button
                          type="button"
                          onClick={() => applyPreset(id)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                            presetId === id && "bg-primary/10 font-medium text-primary"
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-3.5 w-3.5 shrink-0 rounded-full border-2",
                              presetId === id ? "border-primary bg-primary" : "border-muted-foreground/40"
                            )}
                          />
                          {labelForPreset(id)}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="mb-2 border-t border-border/60" />
                </>
              )}
              <ul className="space-y-0.5">
                {ALL_PRESET_ITEMS.map(({ id, label }) => (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => applyPreset(id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                        presetId === id && "bg-primary/10 font-medium text-primary"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-3.5 w-3.5 shrink-0 rounded-full border-2",
                          presetId === id ? "border-primary bg-primary" : "border-muted-foreground/40"
                        )}
                      />
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <div className="min-w-0 flex-1 overflow-x-visible overflow-y-visible p-3 sm:p-4 lg:min-w-[min(100%,42rem)]">
            <DayPicker
              mode="range"
              selected={range}
              onSelect={handleCalendarSelect}
              numberOfMonths={2}
              locale={ptBR}
              weekStartsOn={1}
              defaultMonth={range?.from}
              className="marketing-day-picker w-full max-w-full"
              classNames={{
                months:
                  "flex flex-col gap-6 sm:flex-row sm:flex-nowrap sm:items-start sm:justify-center sm:gap-10",
                month: "w-full shrink-0 space-y-2 sm:w-auto",
                caption: "flex justify-center pt-1 relative items-center mb-2",
                caption_label: "text-sm font-medium",
                nav: "flex items-center gap-1",
                nav_button: cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/80 bg-background text-sm"
                ),
                table: "w-full border-collapse",
                head_row: "flex",
                head_cell: "w-9 text-[0.7rem] font-medium text-muted-foreground",
                row: "flex w-full mt-1",
                cell: "relative p-0 text-center text-sm focus-within:relative",
                day: cn(
                  "h-9 w-9 rounded-md p-0 font-normal aria-selected:opacity-100",
                  "hover:bg-muted"
                ),
                day_range_start: "rounded-l-md bg-primary text-primary-foreground",
                day_range_end: "rounded-r-md bg-primary text-primary-foreground",
                day_selected: "bg-primary text-primary-foreground",
                day_today: "font-semibold text-primary",
                day_outside: "text-muted-foreground/50",
                day_disabled: "text-muted-foreground/30",
                day_range_middle: "rounded-none bg-primary/15",
              }}
            />

            <div className="mt-4 space-y-3 border-t border-border/80 pt-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border"
                  checked={compare}
                  onChange={(e) => setCompare(e.target.checked)}
                />
                <span className="font-medium">Comparar</span>
                <span className="text-muted-foreground">com o período anterior de mesmo tamanho</span>
              </label>

              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-md border border-border/80 bg-muted/40 px-2 py-1 font-medium">
                  {presetId === "custom" ? "Personalizado" : labelForPreset(presetId)}
                </span>
                {range?.from && range?.to && (
                  <>
                    <input
                      readOnly
                      className="h-9 min-w-[7.5rem] flex-1 rounded-md border border-border/80 bg-background px-2 text-xs sm:max-w-[9rem]"
                      value={formatInTimeZone(range.from, MARKETING_TZ, "d 'de' MMM", { locale: ptBR })}
                    />
                    <input
                      readOnly
                      className="h-9 min-w-[7.5rem] flex-1 rounded-md border border-border/80 bg-background px-2 text-xs sm:max-w-[9rem]"
                      value={formatInTimeZone(range.to, MARKETING_TZ, "d 'de' MMM", { locale: ptBR })}
                    />
                  </>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Fuso horário das datas: <strong className="font-medium text-foreground">Horário de São Paulo</strong> (
                {MARKETING_TZ})
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border/80 bg-muted/20 px-4 py-3 sm:px-6">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleApply} disabled={!range?.from || !range?.to}>
            Atualizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
