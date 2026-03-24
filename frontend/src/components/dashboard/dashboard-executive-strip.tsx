import { cn } from "@/lib/utils";
import { formatNumber, formatSpend } from "@/lib/metrics-format";
import type { MarketingDashboardSummary } from "@/lib/marketing-dashboard-api";
import type { BusinessGoalMode } from "@/lib/business-goal-mode";
import type { DashboardDiagnostic } from "./dashboard-diagnostic-panel";

export function DashboardExecutiveStrip({
  summary,
  businessGoalMode,
  primaryConversionLabel,
  diagnostics,
  className,
}: {
  summary: MarketingDashboardSummary;
  businessGoalMode: BusinessGoalMode;
  primaryConversionLabel?: string | null;
  diagnostics: DashboardDiagnostic[];
  className?: string;
}) {
  const leadWord = primaryConversionLabel?.trim() || "Leads";
  const s = summary;
  const d = s.derived;

  let resultLine: string;
  if (businessGoalMode === "SALES") {
    if (s.purchases > 0 && d.roas != null && d.roas >= 1) {
      resultLine = `Sim — ${formatNumber(s.purchases)} compras e ROAS ${d.roas.toFixed(2).replace(".", ",")}×.`;
    } else if (s.purchases > 0) {
      resultLine = `Há ${formatNumber(s.purchases)} compras; ROAS ainda abaixo do ideal ou sem receita atribuída.`;
    } else if (s.spend > 50) {
      resultLine = "Investimento no período, mas sem compras atribuídas — investigar funil e pixel.";
    } else {
      resultLine = "Pouco gasto ou sem compras no recorte — amplie período ou verifique integrações.";
    }
  } else if (businessGoalMode === "LEADS") {
    if (s.leads > 0) {
      resultLine = `Sim — ${formatNumber(s.leads)} ${leadWord.toLowerCase()} no período (gasto ${formatSpend(s.spend)}).`;
    } else if (s.spend > 30) {
      resultLine = "Gasto ativo, mas sem leads — revisar criativo, público e evento de conversão.";
    } else {
      resultLine = "Sem leads no período — confira orçamento, aprendizado e período selecionado.";
    }
  } else {
    resultLine =
      s.leads > 0 || s.purchases > 0
        ? `${formatNumber(s.leads)} leads e ${formatNumber(s.purchases)} compras — leia captação e monetização nos blocos abaixo.`
        : "Pouco volume de resultado no período; use o diagnóstico e o funil para achar o estágio crítico.";
  }

  const problemLine =
    diagnostics[0]?.problem ??
    (d.ctrPct != null && s.impressions > 1_000 && d.ctrPct < 1
      ? "CTR muito baixo — pouca atenção no feed."
      : "Nenhum alerta automático forte — acompanhe CPL/ROAS e campanhas.");

  const actionLine =
    diagnostics[0]?.suggestedAction ??
    "Atualize dados, compare com o período anterior e priorize a campanha com melhor custo por resultado.";

  return (
    <section
      className={cn(
        "grid gap-3 rounded-2xl border border-primary/15 bg-primary/[0.04] p-4 sm:grid-cols-3 sm:gap-4 sm:p-5",
        className
      )}
    >
      <div className="rounded-xl border border-border/40 bg-card/80 px-3 py-2.5 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Está dando resultado?</p>
        <p className="mt-1 text-sm font-semibold leading-snug text-foreground">{resultLine}</p>
      </div>
      <div className="rounded-xl border border-border/40 bg-card/80 px-3 py-2.5 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Onde está o problema?</p>
        <p className="mt-1 text-sm font-semibold leading-snug text-foreground">{problemLine}</p>
      </div>
      <div className="rounded-xl border border-border/40 bg-card/80 px-3 py-2.5 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">O que fazer agora?</p>
        <p className="mt-1 text-sm font-semibold leading-snug text-foreground">{actionLine}</p>
      </div>
    </section>
  );
}
