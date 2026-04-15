import { useEffect, useRef, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { ptBR } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import { parse, isValid, isBefore, isAfter } from "date-fns";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ALL_PRESET_ITEMS,
  type MarketingPresetId,
  getPresetRange,
  labelForPreset,
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

function formatDateInput(d: Date): string {
  return formatInTimeZone(d, MARKETING_TZ, "dd/MM/yyyy", { locale: ptBR });
}

function parseDateInput(raw: string): Date | null {
  const trimmed = raw.trim();
  const d = parse(trimmed, "dd/MM/yyyy", new Date());
  if (!isValid(d)) return null;
  if (d.getFullYear() < 2000 || d.getFullYear() > 2100) return null;
  return d;
}

export function MarketingDateRangeDialog({
  open,
  onOpenChange,
  initial,
  initialLabel,
  initialPresetId,
  initialCompare: _initialCompare,
  onApply,
}: Props) {
  const [presetId, setPresetId] = useState<MarketingPresetId>(initialPresetId);
  const [range, setRange] = useState<DateRange | undefined>(() => ({
    from: parseYmdToLocalDate(initial.startDate),
    to: parseYmdToLocalDate(initial.endDate),
  }));
  const [fromText, setFromText] = useState("");
  const [toText, setToText] = useState("");
  const endInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setPresetId(initialPresetId);
    const from = parseYmdToLocalDate(initial.startDate);
    const to = parseYmdToLocalDate(initial.endDate);
    setRange({ from, to });
    setFromText(formatDateInput(from));
    setToText(formatDateInput(to));
  }, [open, initial.startDate, initial.endDate, initialPresetId, initialLabel]);

  useEffect(() => {
    if (range?.from) setFromText(formatDateInput(range.from));
    if (range?.to) setToText(formatDateInput(range.to));
  }, [range?.from, range?.to]);

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

  function handleFromBlur() {
    const d = parseDateInput(fromText);
    if (!d) {
      if (range?.from) setFromText(formatDateInput(range.from));
      return;
    }
    setPresetId("custom");
    const to = range?.to;
    if (to && isAfter(d, to)) {
      setRange({ from: d, to: d });
    } else {
      setRange({ from: d, to });
    }
  }

  function handleToBlur() {
    const d = parseDateInput(toText);
    if (!d) {
      if (range?.to) setToText(formatDateInput(range.to));
      return;
    }
    setPresetId("custom");
    const from = range?.from;
    if (from && isBefore(d, from)) {
      setRange({ from: d, to: d });
    } else {
      setRange({ from, to: d });
    }
  }

  function handleFromKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      handleFromBlur();
      endInputRef.current?.focus();
    }
  }

  function handleToKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      handleToBlur();
      handleApply();
    }
  }

  function handleApply() {
    const from = range?.from;
    const to = range?.to ?? range?.from;
    if (!from || !to) return;
    const startDate = formatInTimeZone(from, MARKETING_TZ, "yyyy-MM-dd");
    const endDate = formatInTimeZone(to, MARKETING_TZ, "yyyy-MM-dd");
    const datePart = formatRangeShortPt(startDate, endDate);
    const label =
      presetId === "custom" ? datePart : `${labelForPreset(presetId)} · ${datePart}`;
    onApply({ startDate, endDate, label, presetId, compareEnabled: false });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showClose
        title="Período"
        className="flex max-h-[95dvh] w-[min(100vw-1rem,64rem)] max-w-none flex-col gap-0 overflow-y-auto p-0 sm:max-h-[90vh]"
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col sm:flex-row">
          {/* Presets */}
          <aside className="w-full shrink-0 border-b border-border/60 sm:w-48 sm:border-b-0 sm:border-r">
            <div className="flex gap-1 overflow-x-auto p-2 sm:max-h-[min(65vh,460px)] sm:flex-col sm:overflow-x-visible sm:overflow-y-auto sm:p-3">
              {ALL_PRESET_ITEMS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => applyPreset(id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted sm:w-full",
                    presetId === id && "bg-primary/10 font-medium text-primary"
                  )}
                >
                  <span
                    className={cn(
                      "hidden h-3 w-3 shrink-0 rounded-full border-2 sm:flex",
                      presetId === id ? "border-primary bg-primary" : "border-muted-foreground/30"
                    )}
                  />
                  {label}
                </button>
              ))}
            </div>
          </aside>

          {/* Calendar + inputs */}
          <div className="min-w-0 flex-1 overflow-x-auto p-3 sm:p-4">
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
                months: "flex flex-col gap-4 sm:flex-row sm:flex-nowrap sm:items-start sm:justify-center sm:gap-8",
                month: "w-full shrink-0 space-y-2 sm:w-auto",
                caption: "flex justify-center pt-1 relative items-center mb-2",
                caption_label: "text-sm font-medium",
                nav: "flex items-center gap-1",
                nav_button: "inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/80 bg-background text-sm hover:bg-muted",
                table: "w-full border-collapse",
                head_row: "flex",
                head_cell: "w-9 text-[0.7rem] font-medium text-muted-foreground",
                row: "flex w-full mt-1",
                cell: "relative p-0 text-center text-sm focus-within:relative",
                day: "h-9 w-9 rounded-md p-0 font-normal aria-selected:opacity-100 hover:bg-muted",
                day_range_start: "rounded-l-md bg-primary text-primary-foreground",
                day_range_end: "rounded-r-md bg-primary text-primary-foreground",
                day_selected: "bg-primary text-primary-foreground",
                day_today: "font-semibold text-primary",
                day_outside: "text-muted-foreground/50",
                day_disabled: "text-muted-foreground/30",
                day_range_middle: "rounded-none bg-primary/15",
              }}
            />

            {/* Editable date inputs */}
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground">Início</label>
                <Input
                  value={fromText}
                  onChange={(e) => setFromText(e.target.value)}
                  onBlur={handleFromBlur}
                  onKeyDown={handleFromKeyDown}
                  placeholder="dd/mm/aaaa"
                  className="h-8 w-28 rounded-lg text-xs"
                />
              </div>
              <span className="text-xs text-muted-foreground">até</span>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground">Fim</label>
                <Input
                  ref={endInputRef}
                  value={toText}
                  onChange={(e) => setToText(e.target.value)}
                  onBlur={handleToBlur}
                  onKeyDown={handleToKeyDown}
                  placeholder="dd/mm/aaaa"
                  className="h-8 w-28 rounded-lg text-xs"
                />
              </div>
              <span className="text-[10px] text-muted-foreground/70 ml-auto hidden sm:inline">
                Fuso: São Paulo
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border/60 bg-muted/10 px-4 py-2.5 sm:px-5">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" size="sm" onClick={handleApply} disabled={!range?.from || !range?.to}>
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
