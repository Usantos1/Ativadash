import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Activity, Clock, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { AutomationExecutionLogDto } from "@/lib/alert-rules-api";
import { cn } from "@/lib/utils";
import type { RuleDraft } from "./rule-draft";

export type AutomationOverviewCardsProps = {
  rules: RuleDraft[];
  execLogs: AutomationExecutionLogDto[];
  loading?: boolean;
  performanceAlerts: boolean;
};

type Tile = {
  label: string;
  value: string;
  hint?: ReactNode;
  icon: LucideIcon;
  tone: "primary" | "emerald" | "amber" | "neutral";
};

const TONE_STYLES: Record<Tile["tone"], { wrap: string; icon: string; value: string }> = {
  primary: {
    wrap: "border-primary/25 bg-primary/[0.04] dark:bg-primary/[0.08]",
    icon: "bg-primary/15 text-primary",
    value: "text-foreground",
  },
  emerald: {
    wrap: "border-emerald-500/30 bg-emerald-500/[0.05] dark:bg-emerald-950/25",
    icon: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    value: "text-foreground",
  },
  amber: {
    wrap: "border-amber-500/30 bg-amber-500/[0.05] dark:bg-amber-950/20",
    icon: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    value: "text-foreground",
  },
  neutral: {
    wrap: "border-border/50 bg-muted/20",
    icon: "bg-muted text-muted-foreground",
    value: "text-foreground",
  },
};

export function AutomationOverviewCards({ rules, execLogs, performanceAlerts }: AutomationOverviewCardsProps) {
  const now = Date.now();
  const MS_24H = 24 * 60 * 60 * 1000;

  const activeCount = rules.filter((r) => r.active).length;
  const totalRules = rules.length;
  const pausedCount = totalRules - activeCount;

  const logs24h = execLogs.filter((l) => {
    const t = new Date(l.executedAt).getTime();
    return Number.isFinite(t) && now - t <= MS_24H;
  });
  const uniqueRules24h = new Set(logs24h.map((l) => l.ruleId)).size;

  const lastLog = execLogs[0] ?? null;
  const lastLogDate = lastLog ? new Date(lastLog.executedAt) : null;
  const lastLogRelative =
    lastLogDate && Number.isFinite(lastLogDate.getTime())
      ? formatDistanceToNowStrict(lastLogDate, { addSuffix: true, locale: ptBR })
      : null;

  const frequencyMinutesFromLabel = (label?: string | null): number | null => {
    if (!label) return null;
    if (label === "1h") return 60;
    if (label === "3h") return 180;
    if (label === "12h") return 720;
    if (label === "daily") return 24 * 60;
    return null;
  };
  const resolveRuleFrequency = (r: RuleDraft): number | null => {
    const override = Number(String(r.checkFrequencyMinutesStr ?? "").trim());
    if (Number.isFinite(override) && override > 0) return override;
    return frequencyMinutesFromLabel(r.checkFrequency);
  };
  const activeFrequencies = rules
    .filter((r) => r.active)
    .map(resolveRuleFrequency)
    .filter((m): m is number => m != null);
  const nextCheckMinutes = activeFrequencies.length > 0 ? Math.min(...activeFrequencies) : null;
  const nextCheckLabel = (() => {
    if (nextCheckMinutes == null) return "—";
    if (nextCheckMinutes < 60) return `~${nextCheckMinutes} min`;
    if (nextCheckMinutes < 1440) return `~${Math.round(nextCheckMinutes / 60)} h`;
    return "~1 dia";
  })();

  const tiles: Tile[] = [
    {
      label: "Regras",
      value: performanceAlerts ? (totalRules === 0 ? "0" : `${activeCount}/${totalRules}`) : "—",
      hint: performanceAlerts ? (
        totalRules === 0 ? (
          <span>Nenhuma regra criada</span>
        ) : (
          <span>
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">{activeCount} ativa{activeCount === 1 ? "" : "s"}</span>
            {pausedCount > 0 ? <span className="text-muted-foreground"> · {pausedCount} pausada{pausedCount === 1 ? "" : "s"}</span> : null}
          </span>
        )
      ) : (
        <span>Indisponível no plano</span>
      ),
      icon: ShieldCheck,
      tone: performanceAlerts && activeCount > 0 ? "emerald" : "neutral",
    },
    {
      label: "Execuções · 24h",
      value: logs24h.length.toString(),
      hint: logs24h.length === 0 ? (
        <span>Sem ações registradas</span>
      ) : (
        <span>
          {uniqueRules24h} regra{uniqueRules24h === 1 ? "" : "s"} dispararam
        </span>
      ),
      icon: Activity,
      tone: logs24h.length > 0 ? "primary" : "neutral",
    },
    {
      label: "Última execução",
      value: lastLogRelative ?? "—",
      hint: lastLog ? (
        <span className="truncate" title={lastLog.ruleName}>
          {lastLog.ruleName || "Regra sem nome"}
        </span>
      ) : (
        <span>O motor ainda não agiu</span>
      ),
      icon: Clock,
      tone: lastLog ? "amber" : "neutral",
    },
    {
      label: "Próxima avaliação",
      value: nextCheckLabel,
      hint:
        nextCheckMinutes != null ? (
          <span>Com base nas regras ativas</span>
        ) : (
          <span>Ative uma regra para iniciar</span>
        ),
      icon: Sparkles,
      tone: nextCheckMinutes != null ? "primary" : "neutral",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        const styles = TONE_STYLES[tile.tone];
        return (
          <div
            key={tile.label}
            className={cn(
              "flex items-start gap-3 rounded-2xl border p-3.5 shadow-[var(--shadow-surface-sm)] transition-colors sm:p-4",
              styles.wrap
            )}
          >
            <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", styles.icon)}>
              <Icon className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                {tile.label}
              </p>
              <p className={cn("mt-0.5 text-xl font-bold tabular-nums tracking-tight sm:text-2xl", styles.value)}>
                {tile.value}
              </p>
              <div className="mt-1 truncate text-[11px] text-muted-foreground">{tile.hint}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
