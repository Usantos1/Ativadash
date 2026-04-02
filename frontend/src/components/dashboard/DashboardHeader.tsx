import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarRange, FileDown, FileSpreadsheet, Loader2, RefreshCw, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingDateRangeDialog } from "@/components/marketing/MarketingDateRangeDialog";
import { MarketingShareDialog } from "@/components/marketing/MarketingShareDialog";
import type { DateFilterApplyPayload } from "@/components/marketing/MarketingDateRangeDialog";
import type { MetricsDateRange } from "@/lib/integrations-api";
import type { MarketingPresetId } from "@/lib/marketing-date-presets";
import { cn } from "@/lib/utils";
import type { BusinessGoalMode } from "@/lib/business-goal-mode";

function goalShort(mode: BusinessGoalMode): string {
  switch (mode) {
    case "LEADS":
      return "Leads";
    case "SALES":
      return "Vendas";
    default:
      return "Híbrido";
  }
}

export function DashboardHeader({
  dateRange,
  dateRangeLabel,
  presetId,
  compareEnabled,
  pickerOpen,
  setPickerOpen,
  applyDateFilter,
  goalMode,
  onRefresh,
  refreshDisabled,
  showRefresh,
  hasData,
  onExportPdf,
  onExportXls,
}: {
  dateRange: MetricsDateRange;
  dateRangeLabel: string;
  presetId: MarketingPresetId;
  compareEnabled: boolean;
  pickerOpen: boolean;
  setPickerOpen: (v: boolean) => void;
  applyDateFilter: (p: DateFilterApplyPayload) => void;
  goalMode: BusinessGoalMode;
  onRefresh: () => void;
  refreshDisabled?: boolean;
  showRefresh?: boolean;
  hasData?: boolean;
  onExportPdf?: () => void;
  onExportXls?: () => void;
}) {
  const [shareOpen, setShareOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  return (
    <div className="flex flex-col gap-3 border-b border-border/25 pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-2 rounded-xl border-border/40 bg-background/50"
          onClick={() => setPickerOpen(true)}
        >
          <CalendarRange className="h-3.5 w-3.5 opacity-70" aria-hidden />
          <span className="max-w-[220px] truncate font-medium">{dateRangeLabel}</span>
        </Button>
        <MarketingDateRangeDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          initial={dateRange}
          initialLabel={dateRangeLabel}
          initialPresetId={presetId}
          initialCompare={compareEnabled}
          onApply={applyDateFilter}
        />
        <span
          className="rounded-full border border-border/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
          title="Objetivo da conta"
        >
          {goalShort(goalMode)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {showRefresh ? (
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-xl border-border/40"
            disabled={refreshDisabled}
            onClick={() => onRefresh()}
          >
            <RefreshCw
              className={cn("mr-1.5 h-3.5 w-3.5", refreshDisabled ? "animate-spin" : "")}
              aria-hidden
            />
            Atualizar
          </Button>
        ) : null}
        {hasData ? (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-xl border-border/40"
              onClick={() => setShareOpen(true)}
            >
              <Share2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Compartilhar
            </Button>
            <MarketingShareDialog
              open={shareOpen}
              onOpenChange={setShareOpen}
              page="painel"
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
              periodLabel={dateRangeLabel}
            />
            {onExportPdf ? (
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-xl border-border/40"
                disabled={pdfBusy}
                onClick={() => {
                  setPdfBusy(true);
                  try { onExportPdf(); } finally { setPdfBusy(false); }
                }}
              >
                {pdfBusy
                  ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                  : <FileDown className="mr-1.5 h-3.5 w-3.5" aria-hidden />}
                {pdfBusy ? "Gerando…" : "PDF"}
              </Button>
            ) : null}
            {onExportXls ? (
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-xl border-border/40"
                onClick={onExportXls}
              >
                <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                XLS
              </Button>
            ) : null}
          </>
        ) : null}
        <Button variant="ghost" size="sm" className="h-9 rounded-xl text-muted-foreground" asChild>
          <Link to="/ads/metas-alertas">Automação e Metas</Link>
        </Button>
      </div>
    </div>
  );
}
