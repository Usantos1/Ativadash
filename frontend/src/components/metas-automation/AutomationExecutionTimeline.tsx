import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AutomationExecutionLogDto } from "@/lib/alert-rules-api";
import { cn } from "@/lib/utils";

function channelFromRuleId(ruleId: string, map: Map<string, "meta" | "google" | "all">): string {
  const c = map.get(ruleId);
  if (c === "meta") return "Meta Ads";
  if (c === "google") return "Google Ads";
  if (c === "all") return "Todos";
  return "—";
}

function actionBadge(action: string): { label: string; variant: "risk" | "gain" | "neutral" | "info" } {
  const a = action.trim().toUpperCase();
  if (a === "PAUSE_ASSET") return { label: "Pausar", variant: "risk" };
  if (a === "ACTIVATE_ASSET") return { label: "Ativar", variant: "info" };
  if (a === "INCREASE_BUDGET_20") return { label: "Escala %", variant: "gain" };
  if (a === "DECREASE_BUDGET_20") return { label: "Reduz %", variant: "neutral" };
  if (a === "NOTIFY_ONLY") return { label: "Notificar", variant: "info" };
  return { label: action, variant: "neutral" };
}

function narrativeLine(row: AutomationExecutionLogDto): string {
  const name = row.assetLabel?.trim() || row.assetId;
  const rule = row.ruleName || "Regra";
  const act = row.actionTaken.trim().toUpperCase();
  const prev = row.previousValue ?? "—";
  const next = row.newValue ?? "—";
  if (act === "PAUSE_ASSET") return `Campanha/conjunto/anúncio "${name}" pausado. Motivo: condição da regra (${rule}). Estado: ${prev} → ${next}.`;
  if (act === "ACTIVATE_ASSET") return `"${name}" reativado. ${rule}. ${prev} → ${next}.`;
  if (act === "INCREASE_BUDGET_20" || act === "DECREASE_BUDGET_20")
    return `"${name}": orçamento ${prev} → ${next}. (${rule})`;
  if (act === "NOTIFY_ONLY") return `Alerta: ${name}. Métrica ${prev} / limiar ${next}. (${rule})`;
  return `${row.actionTaken} · "${name}" · ${rule}`;
}

export type AutomationExecutionTimelineProps = {
  items: AutomationExecutionLogDto[];
  loading: boolean;
  ruleChannelById: Map<string, "meta" | "google" | "all">;
};

export function AutomationExecutionTimeline({ items, loading, ruleChannelById }: AutomationExecutionTimelineProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="border-dashed border-border/60 bg-muted/10">
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
          <ScrollText className="h-10 w-10 opacity-40" />
          <p>Ainda não há execuções registadas.</p>
          <p className="max-w-md text-xs">
            Quando o motor autónomo executar pausas, ativações ou ajustes de orçamento, cada ação aparece aqui com data,
            canal e motivo.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="hidden overflow-hidden border-border/50 shadow-sm md:block">
        <CardHeader className="border-b border-border/40 bg-muted/20 py-3">
          <CardTitle className="text-sm font-semibold">Histórico de execuções</CardTitle>
          <p className="text-xs text-muted-foreground">Fonte: AutomationExecutionLog (somente leitura).</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/15 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5">Data</th>
                  <th className="px-4 py-2.5">Canal</th>
                  <th className="px-4 py-2.5">Ativo</th>
                  <th className="px-4 py-2.5">Ação</th>
                  <th className="px-4 py-2.5">Antes → Depois</th>
                  <th className="px-4 py-2.5">Regra</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const d = new Date(row.executedAt);
                  const datePart = format(d, "dd/MM/yyyy", { locale: ptBR });
                  const timePart = format(d, "HH:mm", { locale: ptBR });
                  const { label, variant } = actionBadge(row.actionTaken);
                  const ch = channelFromRuleId(row.ruleId, ruleChannelById);
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-b border-border/30 transition-colors hover:bg-muted/25",
                        variant === "risk" && "bg-destructive/[0.04]",
                        variant === "gain" && "bg-emerald-500/[0.04]"
                      )}
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-xs">
                        <span className="font-medium text-foreground">{datePart}</span>
                        <span className="ml-1.5 text-muted-foreground">{timePart}</span>
                      </td>
                      <td className="px-4 py-3 text-xs">{ch}</td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-xs" title={row.assetLabel ?? row.assetId}>
                        {row.assetLabel?.trim() || row.assetId}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                            variant === "risk" && "bg-destructive/15 text-destructive",
                            variant === "gain" && "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
                            variant === "info" && "bg-primary/12 text-primary",
                            variant === "neutral" && "bg-muted text-muted-foreground"
                          )}
                        >
                          {label}
                        </span>
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-3 font-mono text-[11px] text-muted-foreground">
                        {(row.previousValue ?? "—") + " → " + (row.newValue ?? "—")}
                      </td>
                      <td className="max-w-[160px] truncate px-4 py-3 text-xs text-muted-foreground" title={row.ruleName}>
                        {row.ruleName}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3 md:hidden">
        {items.map((row) => {
          const d = new Date(row.executedAt);
          const { label, variant } = actionBadge(row.actionTaken);
          const ch = channelFromRuleId(row.ruleId, ruleChannelById);
          return (
            <div
              key={row.id}
              className={cn(
                "rounded-xl border border-border/50 p-4 shadow-sm",
                variant === "risk" && "border-destructive/30 bg-destructive/[0.04]",
                variant === "gain" && "border-emerald-500/30 bg-emerald-500/[0.04]"
              )}
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">
                  {format(d, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </span>
                <span className="text-[10px] text-muted-foreground">{ch}</span>
              </div>
              <p className="text-sm leading-snug text-foreground">{narrativeLine(row)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase",
                    variant === "risk" && "bg-destructive/15 text-destructive",
                    variant === "gain" && "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
                    variant === "info" && "bg-primary/12 text-primary",
                    variant === "neutral" && "bg-muted text-muted-foreground"
                  )}
                >
                  {label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
