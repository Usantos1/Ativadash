import { Info } from "lucide-react";
import { formatSpend } from "@/lib/metrics-format";
import { cn } from "@/lib/utils";
import type { MarketingDashboardPayload } from "@/lib/marketing-dashboard-api";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Transforma o string "14412.27" (vindo do backend como string pra evitar erro de float)
 * no formato BRL "R$ 14.412,27". Entrada inválida cai em "R$ 0,00".
 */
function formatSpendFromString(raw: string | number): string {
  const n = typeof raw === "number" ? raw : parseFloat(raw);
  return formatSpend(Number.isFinite(n) ? n : 0);
}

/**
 * Distribuição de verba entre Meta Ads e Google Ads.
 *
 * Nota: as seções "Temperatura" e "Score (gasto)" foram removidas por serem
 * pouco úteis sem naming padronizado e por gerarem confusão no cliente.
 * O backend ainda as calcula (`distribution.byTemperature` / `byScore`) mas
 * elas deixaram de ser exibidas aqui.
 */
export function DashboardPlatformDiagnostics({
  dash,
  className,
}: {
  dash: Extract<MarketingDashboardPayload, { ok: true }>;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-border/30 bg-card/50 p-4 sm:p-5", className)}>
      <div className="flex items-center gap-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Plataforma × investimento
        </p>
        <Tooltip delayDuration={100}>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground/80 transition hover:text-foreground"
              aria-label="O que significa?"
            >
              <Info className="h-3.5 w-3.5" aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[280px] text-xs leading-relaxed">
            Divisão do investimento do período entre Meta Ads e Google Ads. O valor em BRL é o total gasto em cada
            plataforma; o percentual é a participação dela no investimento total.
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {dash.distribution.byPlatform.map((p) => (
          <div key={p.platform} className="rounded-xl bg-muted/20 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground">{p.platform}</span>
              <span className="text-sm font-bold tabular-nums text-primary">
                {p.spendSharePct.toFixed(1).replace(".", ",")}%
              </span>
            </div>
            <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
              {formatSpendFromString(p.spend)}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary/90 to-primary/45"
                style={{ width: `${Math.min(100, p.spendSharePct)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
