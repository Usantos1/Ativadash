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
import { marketingToolbarMetasClassName, marketingToolbarOutlineClassName } from "@/lib/marketing-ui";
import type { BusinessGoalMode } from "@/lib/business-goal-mode";

function goalLabel(mode: BusinessGoalMode): string {
  switch (mode) {
    case "LEADS":
      return "Leads";
    case "SALES":
      return "Vendas";
    default:
      return "Híbrido";
  }
}

function goalColor(mode: BusinessGoalMode): string {
  switch (mode) {
    case "LEADS":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
    case "SALES":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
    default:
      return "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300";
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
    <div className="relative z-20 flex flex-wrap items-center justify-center gap-2 border-b border-border/60 pb-4">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("h-9 gap-2 rounded-full px-4", marketingToolbarOutlineClassName)}
        onClick={() => setPickerOpen(true)}
      >
        <CalendarRange className="h-3.5 w-3.5 shrink-0 text-foreground" aria-hidden />
        <span className="max-w-[240px] truncate font-semibold text-foreground">{dateRangeLabel}</span>
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
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
          goalColor(goalMode)
        )}
        title="Objetivo da conta"
      >
        {goalLabel(goalMode)}
      </span>
      {showRefresh ? (
          <Button
            variant="outline"
            size="sm"
            className={cn("h-9 rounded-full px-4", marketingToolbarOutlineClassName)}
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
              size="sm"
              variant="default"
              className="h-9 rounded-full px-4 font-semibold shadow-md"
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
                className={cn("h-9 rounded-full px-4", marketingToolbarOutlineClassName)}
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
                className={cn("h-9 rounded-full px-4", marketingToolbarOutlineClassName)}
                onClick={onExportXls}
              >
                <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                XLS
              </Button>
            ) : null}
          </>
        ) : null}
      <Button variant="outline" size="sm" className={cn("h-9 rounded-full px-4", marketingToolbarMetasClassName)} asChild>
        <Link to="/ads/metas-alertas">Automação e Metas</Link>
      </Button>
    </div>
  );
}
