import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatNumber, formatSpend } from "@/lib/metrics-format";
import type { MarketingDashboardSummary } from "@/lib/marketing-dashboard-api";
import type { BusinessGoalMode } from "@/lib/business-goal-mode";
import type { DashboardDiagnostic } from "./dashboard-diagnostic-panel";

function CardShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-gradient-to-b from-card to-muted/[0.12] p-4 shadow-sm ring-1 ring-border/40 sm:p-5",
        className
      )}
    >
      {children}
    </div>
  );
}

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

  let resultHeadline: string;
  let resultSub: string;
  if (businessGoalMode === "SALES") {
    if (s.purchases > 0 && d.roas != null && d.roas >= 1) {
      resultHeadline = `${formatNumber(s.purchases)} compras`;
      resultSub = `ROAS ${d.roas.toFixed(2).replace(".", ",")}× · ${formatSpend(s.spend)} investidos`;
    } else if (s.purchases > 0) {
      resultHeadline = `${formatNumber(s.purchases)} compras`;
      resultSub = "Receita ou ROAS ainda fracos — confira atribuição.";
    } else if (s.spend > 50) {
      resultHeadline = "Sem compras atribuídas";
      resultSub = `${formatSpend(s.spend)} no período — valide pixel e oferta.`;
    } else {
      resultHeadline = "Volume baixo";
      resultSub = "Amplie período ou verifique orçamento.";
    }
  } else if (businessGoalMode === "LEADS") {
    if (s.leads > 0) {
      resultHeadline = `${formatNumber(s.leads)} ${leadWord.toLowerCase()}`;
      resultSub =
        d.cplLeads != null
          ? `CPL ${formatSpend(d.cplLeads)} · ${formatSpend(s.spend)} investidos`
          : `${formatSpend(s.spend)} investidos`;
    } else if (s.spend > 30) {
      resultHeadline = "Sem leads";
      resultSub = "Há gasto — revise criativo, público e conversão.";
    } else {
      resultHeadline = "Sem leads";
      resultSub = "Confira período e aprendizado das campanhas.";
    }
  } else {
    resultHeadline =
      s.leads > 0 || s.purchases > 0
        ? `${formatNumber(s.leads)} leads · ${formatNumber(s.purchases)} compras`
        : "Pouco resultado";
    resultSub =
      s.leads > 0 || s.purchases > 0
        ? "Leia captação e monetização nos blocos abaixo."
        : "Use alertas e funil para achar o estágio crítico.";
  }

  const problemHeadline =
    diagnostics[0]?.problem ??
    (d.ctrPct != null && s.impressions > 1_000 && d.ctrPct < 1
      ? "CTR muito baixo"
      : "Nenhum alerta forte");

  const problemSub =
    diagnostics[0]?.likelyCause ??
    (d.ctrPct != null && s.impressions > 1_000 && d.ctrPct < 1
      ? "Pouca atenção no feed em relação às impressões."
      : "Monitore CPL/ROAS e campanhas com mais gasto.");

  const actionHeadline = diagnostics[0]?.suggestedAction ?? "Realoque orçamento para o melhor custo por resultado.";
  const actionSub = "Compare com o período anterior se estiver ativo.";

  return (
    <section className={cn("grid gap-3 sm:grid-cols-3 sm:gap-4", className)}>
      <CardShell>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Resultado do período</p>
        <p className="mt-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{resultHeadline}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-[13px]">{resultSub}</p>
      </CardShell>
      <CardShell>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Principal problema</p>
        <p className="mt-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{problemHeadline}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-[13px]">{problemSub}</p>
      </CardShell>
      <CardShell>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Ação recomendada</p>
        <p className="mt-2 text-base font-semibold leading-snug text-foreground sm:text-lg">{actionHeadline}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-[13px]">{actionSub}</p>
      </CardShell>
    </section>
  );
}
