import { Link } from "react-router-dom";
import { AlertCircle, AlertTriangle, Award, Loader2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExecutiveChannelBadge } from "@/lib/channel-executive-badge";
import { Button } from "@/components/ui/button";
import {
  ChannelPerformanceBody,
  ChannelPerformanceBodySkeleton,
} from "./ChannelPerformanceBody";
import type { ChannelPerformanceLayout } from "./build-channel-performance-layout";
import { GoogleAdsMark, MetaMark } from "./PlatformChannelLogos";

export type ChannelSummaryWidgetProps = {
  channel: "meta" | "google";
  accent: "purple" | "green";
  businessGoalMode?: import("@/lib/business-goal-mode").BusinessGoalMode;
  title: string;
  syncAt: Date | null;
  integrationLabel: string;
  integrationTone: "success" | "warning" | "muted" | "danger";
  performanceChip?: string | null;
  /** Badge executivo (metas, volume, comparativo entre redes). */
  executiveBadge?: ExecutiveChannelBadge;
  /**
   * Identificação da conta de anúncio em uso (nome / ID). Quando presente, aparece como
   * subtítulo do card para evidenciar qual conta originou os números. Tipicamente:
   *  - Meta: `{ name: "Minha Empresa", id: "act_1234567890" }`
   *  - Google: `{ name: "Minha Empresa", id: "123-456-7890" }`
   */
  accountInfo?: { name?: string | null; id?: string | null } | null;
  layout?: ChannelPerformanceLayout;
  loading?: boolean;
  errorMessage?: string | null;
  notConnected?: boolean;
  emptyMessage?: string | null;
};

function StatusBadge({
  label,
  tone,
  accent,
}: {
  label: string;
  tone: ChannelSummaryWidgetProps["integrationTone"];
  accent: "purple" | "green";
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center truncate rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        tone === "success" &&
          (accent === "purple"
            ? "bg-blue-500/15 text-blue-900 dark:text-blue-100"
            : "bg-emerald-600/15 text-emerald-950 dark:text-emerald-100"),
        tone === "warning" && "bg-amber-500/15 text-amber-950 dark:text-amber-100",
        tone === "muted" && "bg-muted/60 text-muted-foreground",
        tone === "danger" && "bg-rose-500/15 text-rose-900 dark:text-rose-100"
      )}
    >
      {label}
    </span>
  );
}

function ExecutiveBadgePill({ badge }: { badge: ExecutiveChannelBadge }) {
  if (!badge) return null;
  if (badge === "best") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/35 bg-emerald-500/[0.1] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-100">
        <Award className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
        Melhor desempenho
      </span>
    );
  }
  if (badge === "attention") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/[0.1] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950 dark:text-amber-100">
        <AlertTriangle className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
        Atenção
      </span>
    );
  }
  if (badge === "scale") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-sky-500/35 bg-sky-500/[0.1] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-950 dark:text-sky-100">
        <TrendingUp className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
        Escalar
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/35 bg-rose-500/[0.08] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-900 dark:text-rose-100">
      <AlertTriangle className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
      Baixa eficiência
    </span>
  );
}

export function ChannelSummaryWidget({
  channel,
  accent,
  title,
  syncAt,
  integrationLabel,
  integrationTone,
  performanceChip,
  executiveBadge,
  accountInfo,
  layout,
  loading,
  errorMessage,
  notConnected,
  emptyMessage,
}: ChannelSummaryWidgetProps) {
  const accountName = accountInfo?.name?.trim() || null;
  const accountId = accountInfo?.id?.trim() || null;
  const iconWrap =
    accent === "purple"
      ? "bg-blue-500/[0.14] text-[#1877F2] dark:text-blue-100"
      : "bg-emerald-600/[0.16] text-emerald-900 dark:text-emerald-100";

  const shell =
    accent === "purple"
      ? cn(
          "border-blue-500/45 bg-blue-500/[0.05] dark:bg-blue-950/25",
          "ring-1 ring-blue-500/15"
        )
      : cn(
          "border-emerald-600/45 bg-emerald-500/[0.07] dark:bg-emerald-950/30",
          "ring-1 ring-emerald-600/15"
        );

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col rounded-xl border p-2 sm:p-2.5",
        shell,
        "shadow-[var(--shadow-surface-sm)]"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/25 pb-1.5">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", iconWrap)}>
            {channel === "meta" ? (
              <MetaMark className="h-5 w-5" />
            ) : (
              <GoogleAdsMark className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="text-sm font-bold tracking-tight text-foreground">{title}</h3>
              <StatusBadge label={integrationLabel} tone={integrationTone} accent={accent} />
              <ExecutiveBadgePill badge={executiveBadge ?? null} />
              {performanceChip ? (
                <span className="rounded-md bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {performanceChip}
                </span>
              ) : null}
            </div>
            {accountName || accountId ? (
              <p
                className="truncate text-[11px] leading-tight text-muted-foreground"
                title={[accountName, accountId].filter(Boolean).join(" · ")}
              >
                {accountName ? (
                  <span className="font-medium text-foreground/80">{accountName}</span>
                ) : null}
                {accountName && accountId ? <span className="mx-1 opacity-50">·</span> : null}
                {accountId ? (
                  <span className="font-mono text-[10.5px] tabular-nums opacity-80">{accountId}</span>
                ) : null}
              </p>
            ) : null}
          </div>
        </div>
        <div className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
          {loading ? (
            <span className="inline-flex items-center gap-1 font-medium text-primary">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              Sync…
            </span>
          ) : syncAt ? (
            <span title={syncAt.toLocaleString("pt-BR")}>
              {syncAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          ) : (
            <span>—</span>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 pt-2">
        {errorMessage ? (
          <div
            className="flex gap-2 rounded-lg border border-rose-500/25 bg-rose-500/[0.06] px-2.5 py-2 text-xs text-rose-900 dark:text-rose-100"
            role="alert"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{errorMessage}</span>
          </div>
        ) : notConnected ? (
          <div className="flex flex-col items-center justify-center gap-2 py-5 text-center">
            <p className="text-xs text-muted-foreground">Canal não conectado.</p>
            <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs" asChild>
              <Link to="/marketing/integracoes">Integrações</Link>
            </Button>
          </div>
        ) : loading ? (
          <ChannelPerformanceBodySkeleton />
        ) : emptyMessage ? (
          <p className="py-4 text-center text-xs leading-relaxed text-muted-foreground">{emptyMessage}</p>
        ) : layout ? (
          <ChannelPerformanceBody layout={layout} />
        ) : (
          <p className="py-4 text-center text-xs text-muted-foreground">Sem dados para exibir.</p>
        )}
      </div>
    </div>
  );
}
