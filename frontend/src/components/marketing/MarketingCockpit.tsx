import { ArrowUpRight, Copy, Pause, Wallet, Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatNumber, formatSpend } from "@/lib/metrics-format";
import { cn } from "@/lib/utils";
import type { AccountHealth } from "@/lib/marketing-strategic-insights";
import type { AccountObjective } from "@/lib/business-goal-mode";
import type { OperationalActionItem, OperationalActionKind } from "@/lib/marketing-operational-actions";

const statusBar = {
  healthy: "border-emerald-500/50 bg-emerald-500/[0.12] shadow-[0_0_0_1px_rgba(16,185,129,0.15)]",
  attention: "border-amber-500/50 bg-amber-500/[0.12] shadow-[0_0_0_1px_rgba(245,158,11,0.15)]",
  critical: "border-rose-500/50 bg-rose-500/[0.12] shadow-[0_0_0_1px_rgba(244,63,94,0.15)]",
} as const;

const dotPulse = {
  healthy: "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.7)]",
  attention: "bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.6)]",
  critical: "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.65)]",
} as const;

export function MarketingCockpitStatus(props: {
  health: AccountHealth;
  goalMode: AccountObjective;
  leads: number;
  cpl: number | null;
  cplTarget: number | null;
  spend: number;
  revenue: number | null;
  roas: number | null;
}) {
  const { health, goalMode, leads, cpl, cplTarget, spend, revenue, roas } = props;
  const cplOk = cpl != null && cplTarget != null && cplTarget > 0 ? cpl <= cplTarget : null;

  const healthTip =
    health === "healthy"
      ? "Conta alinhada às metas e aos sinais do período selecionado."
      : health === "attention"
        ? "Alguns indicadores pedem revisão (CPL, ROAS ou volume)."
        : "Prioridade: métricas fora do esperado; revise campanhas e metas.";

  return (
    <TooltipProvider delayDuration={280}>
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border-2 p-4 sm:p-5",
          statusBar[health]
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={cn(
                "absolute right-4 top-4 h-3 w-3 rounded-full sm:right-5 sm:top-5",
                dotPulse[health],
                "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
              aria-label={healthTip}
            />
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs text-xs">
            {healthTip}
          </TooltipContent>
        </Tooltip>
      <div className="grid gap-4 sm:grid-cols-12 sm:items-center">
        <div className="sm:col-span-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Conta</p>
          <p className="mt-1 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            {health === "healthy" ? "No eixo" : health === "attention" ? "Atenção" : "Crítico"}
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
            {goalMode === "LEADS"
              ? "Captação"
              : goalMode === "SALES"
                ? "Vendas"
                : "Híbrido"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:col-span-9 sm:grid-cols-4">
          {(goalMode === "LEADS" || goalMode === "HYBRID") && (
            <div className="rounded-xl border border-border/50 bg-background/60 px-3 py-2.5 backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Leads</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-foreground">{formatNumber(Math.round(leads))}</p>
            </div>
          )}
          {(goalMode === "LEADS" || goalMode === "HYBRID") && (
            <div
              className={cn(
                "rounded-xl border px-3 py-2.5 backdrop-blur-sm",
                cplOk === true && "border-emerald-500/35 bg-emerald-500/[0.08]",
                cplOk === false && "border-rose-500/35 bg-rose-500/[0.08]",
                cplOk === null && "border-border/50 bg-background/60"
              )}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">CPL</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-foreground">
                {cpl != null ? formatSpend(cpl) : "—"}
              </p>
              {cplTarget != null ? (
                <p className="text-[10px] font-medium tabular-nums text-muted-foreground">
                  meta {formatSpend(cplTarget)}
                </p>
              ) : null}
            </div>
          )}
          {(goalMode === "SALES" || goalMode === "HYBRID") && revenue != null && (
            <div className="rounded-xl border border-border/50 bg-background/60 px-3 py-2.5 backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Receita</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-foreground">{formatSpend(revenue)}</p>
            </div>
          )}
          {(goalMode === "SALES" || goalMode === "HYBRID") && roas != null && (
            <div className="rounded-xl border border-border/50 bg-background/60 px-3 py-2.5 backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">ROAS</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-foreground">{roas.toFixed(2)}x</p>
            </div>
          )}
          <div className="rounded-xl border border-border/50 bg-background/60 px-3 py-2.5 backdrop-blur-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Investimento</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-foreground">{formatSpend(spend)}</p>
          </div>
        </div>
      </div>
      </div>
    </TooltipProvider>
  );
}

export function MarketingChannelPanel(props: {
  name: "Meta" | "Google";
  status: "good" | "mid" | "bad";
  leads: number;
  cpl: number | null;
  spend: number;
  mixPct: number | null;
}) {
  const { name, status, leads, cpl, spend, mixPct } = props;
  const ring =
    status === "good"
      ? "ring-2 ring-emerald-500/40"
      : status === "bad"
        ? "ring-2 ring-rose-500/45"
        : "ring-2 ring-amber-500/35";
  const dotTip =
    status === "good"
      ? "Canal com desempenho favorável face ao outro canal e às metas."
      : status === "bad"
        ? "Canal com sinais fracos no período; compare criativos, ofertas e segmentação."
        : "Canal neutro ou em equilíbrio no período.";
  return (
    <TooltipProvider delayDuration={280}>
      <div
        className={cn(
          "rounded-2xl border border-border/60 bg-card/80 p-4 backdrop-blur-sm",
          ring
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-foreground">{name}</p>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(
                  "h-2 w-2 rounded-full",
                  status === "good" ? "bg-emerald-500" : status === "bad" ? "bg-rose-500" : "bg-amber-500",
                  "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
                aria-label={dotTip}
              />
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs text-xs">
              {dotTip}
            </TooltipContent>
          </Tooltip>
        </div>
      <p className="mt-3 text-3xl font-black tabular-nums text-foreground">{formatNumber(Math.round(leads))}</p>
      <p className="text-[10px] font-semibold uppercase text-muted-foreground">leads / conv.</p>
      <div className="mt-3 flex items-end justify-between gap-2 border-t border-border/40 pt-3">
        <div>
          <p className="text-[10px] font-bold text-muted-foreground">CPL</p>
          <p className="text-lg font-bold tabular-nums">{cpl != null ? formatSpend(cpl) : "—"}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-muted-foreground">Gasto</p>
          <p className="text-lg font-bold tabular-nums">{formatSpend(spend)}</p>
          {mixPct != null ? (
            <p className="text-[10px] font-semibold tabular-nums text-muted-foreground">{mixPct.toFixed(0)}% mix</p>
          ) : null}
        </div>
      </div>
      </div>
    </TooltipProvider>
  );
}

export function MarketingChannelPanelSales(props: {
  name: "Meta" | "Google";
  status: "good" | "mid" | "bad";
  revenue: number;
  roas: number | null;
  spend: number;
  mixPct: number | null;
}) {
  const { name, status, revenue, roas, spend, mixPct } = props;
  const ring =
    status === "good"
      ? "ring-2 ring-emerald-500/40"
      : status === "bad"
        ? "ring-2 ring-rose-500/45"
        : "ring-2 ring-amber-500/35";
  const dotTip =
    status === "good"
      ? "Canal com desempenho favorável face ao outro canal e às metas."
      : status === "bad"
        ? "Canal com sinais fracos no período; compare criativos, ofertas e segmentação."
        : "Canal neutro ou em equilíbrio no período.";
  return (
    <TooltipProvider delayDuration={280}>
      <div className={cn("rounded-2xl border border-border/60 bg-card/80 p-4 backdrop-blur-sm", ring)}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-black uppercase tracking-[0.15em]">{name}</p>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(
                  "h-2 w-2 rounded-full",
                  status === "good" ? "bg-emerald-500" : status === "bad" ? "bg-rose-500" : "bg-amber-500",
                  "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
                aria-label={dotTip}
              />
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs text-xs">
              {dotTip}
            </TooltipContent>
          </Tooltip>
        </div>
      <p className="mt-3 text-2xl font-black tabular-nums sm:text-3xl">{formatSpend(revenue)}</p>
      <p className="text-[10px] font-semibold uppercase text-muted-foreground">receita</p>
      <div className="mt-3 flex items-end justify-between border-t border-border/40 pt-3">
        <div>
          <p className="text-[10px] font-bold text-muted-foreground">ROAS</p>
          <p className="text-lg font-bold tabular-nums">{roas != null ? `${roas.toFixed(2)}x` : "—"}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-muted-foreground">Gasto</p>
          <p className="text-lg font-bold tabular-nums">{formatSpend(spend)}</p>
          {mixPct != null ? (
            <p className="text-[10px] tabular-nums text-muted-foreground">{mixPct.toFixed(0)}% mix</p>
          ) : null}
        </div>
      </div>
      </div>
    </TooltipProvider>
  );
}

export type FunnelStripStep = {
  key: string;
  title: string;
  volume: number;
  ratePct: number | null;
};

export function MarketingFunnelStrip(props: { steps: FunnelStripStep[]; worstKey: string | null }) {
  const { steps, worstKey } = props;
  return (
    <div className="flex flex-wrap gap-2 sm:gap-3">
      {steps.map((s) => {
        const worst = worstKey === s.key;
        return (
          <div
            key={s.key}
            className={cn(
              "min-w-[5.5rem] flex-1 rounded-xl border-2 px-3 py-2.5 sm:min-w-[7rem]",
              worst
                ? "border-rose-500/60 bg-rose-500/[0.14]"
                : "border-border/50 bg-muted/30"
            )}
          >
            <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{s.title}</p>
            <p className="mt-0.5 text-lg font-black tabular-nums">{formatNumber(Math.round(s.volume))}</p>
            <p className="text-xs font-bold tabular-nums text-foreground/90">
              {s.ratePct != null ? `${s.ratePct.toFixed(1)}%` : "—"}
            </p>
            {worst ? (
              <p className="mt-1 text-[9px] font-black uppercase text-rose-600 dark:text-rose-400">Maior perda</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function MarketingActionQueue(props: {
  items: OperationalActionItem[];
  busyKey: string | null;
  canMutate: boolean;
  onPauseMeta: (id: string, name: string) => void;
  onPauseGoogle: (id: string, name: string) => void;
  onBudgetMeta: (id: string, name: string, opts?: { estimatedDaily?: number }) => void;
  onDuplicateStub: () => void;
}) {
  const { items, busyKey, canMutate, onPauseMeta, onPauseGoogle, onBudgetMeta, onDuplicateStub } = props;
  if (!items.length) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-muted/20 px-4 py-6">
        <Zap className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm font-medium text-muted-foreground">Nenhuma ação sugerida neste recorte.</p>
      </div>
    );
  }

  const iconFor = (k: OperationalActionKind) => {
    if (k === "budget_meta") return Wallet;
    if (k === "duplicate_stub") return Copy;
    return Pause;
  };

  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const Icon = iconFor(item.kind);
        const busy = busyKey?.includes(item.campaignId) ?? false;
        return (
          <li
            key={item.id}
            className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card/90 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 items-start gap-2">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight text-foreground">{item.label}</p>
                <p className="truncate text-xs text-muted-foreground">{item.campaignName}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 sm:shrink-0">
              {item.kind === "pause_meta" && canMutate ? (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="h-8 gap-1 rounded-lg text-xs"
                  disabled={busy}
                  onClick={() => onPauseMeta(item.campaignId, item.campaignName)}
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5" />}
                  Pausar
                </Button>
              ) : null}
              {item.kind === "pause_google" && canMutate ? (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="h-8 gap-1 rounded-lg text-xs"
                  disabled={busy}
                  onClick={() => onPauseGoogle(item.campaignId, item.campaignName)}
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5" />}
                  Pausar
                </Button>
              ) : null}
              {item.kind === "budget_meta" && canMutate ? (
                <Button
                  type="button"
                  size="sm"
                  className="h-8 gap-1 rounded-lg bg-emerald-600 text-xs hover:bg-emerald-700"
                  disabled={busy}
                  onClick={() =>
                    onBudgetMeta(item.campaignId, item.campaignName, {
                      estimatedDaily: item.estimatedDaily,
                    })
                  }
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  Orçamento
                </Button>
              ) : null}
              {item.kind === "duplicate_stub" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8 gap-1 rounded-lg text-xs"
                  onClick={onDuplicateStub}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Duplicar
                </Button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function CockpitSectionTitle(props: { children: React.ReactNode; kicker?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-2">
      <div>
        {props.kicker ? (
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">{props.kicker}</p>
        ) : null}
        <h2 className="text-lg font-black tracking-tight text-foreground">{props.children}</h2>
      </div>
    </div>
  );
}

export function MarketingEfficiencyChips(props: {
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
}) {
  const { ctr, cpc, cpm } = props;
  return (
    <div className="flex flex-wrap gap-2">
      <span className="rounded-lg border border-border/60 bg-muted/40 px-3 py-1.5 text-xs font-bold tabular-nums">
        CTR {ctr != null ? `${ctr.toFixed(2)}%` : "—"}
      </span>
      <span className="rounded-lg border border-border/60 bg-muted/40 px-3 py-1.5 text-xs font-bold tabular-nums">
        CPC {cpc != null ? formatSpend(cpc) : "—"}
      </span>
      <span className="rounded-lg border border-border/60 bg-muted/40 px-3 py-1.5 text-xs font-bold tabular-nums">
        CPM {cpm != null ? formatSpend(cpm) : "—"}
      </span>
    </div>
  );
}
