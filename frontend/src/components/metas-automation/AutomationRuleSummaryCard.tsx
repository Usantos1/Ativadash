import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { RuleDraft } from "./rule-draft";
import { formatRuleCardSummary } from "./rule-draft";

export type AutomationRuleSummaryCardProps = {
  rule: RuleDraft;
  canEdit: boolean;
  savingToggle: boolean;
  onToggleActive: (active: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function AutomationRuleSummaryCard({
  rule,
  canEdit,
  savingToggle,
  onToggleActive,
  onEdit,
  onDelete,
}: AutomationRuleSummaryCardProps) {
  const summary = formatRuleCardSummary(rule);

  return (
    <Card
      className={cn(
        "border-border/50 bg-card shadow-sm transition-all",
        rule.active ? "ring-1 ring-primary/20" : "opacity-[0.92]"
      )}
    >
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            className={cn(
              "relative mt-1.5 flex h-2.5 w-2.5 shrink-0 rounded-full",
              rule.active ? "bg-emerald-500" : "bg-muted-foreground/45"
            )}
            title={rule.active ? "Ativa" : "Pausada"}
          >
            {rule.active ? (
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/50" />
            ) : null}
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate font-semibold text-foreground">{rule.name || "Sem nome"}</p>
            <p className="text-xs leading-relaxed text-muted-foreground sm:text-[13px]">{summary}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                rule.appliesToChannel === "meta" ? "bg-blue-500/10 text-blue-700 dark:text-blue-300" :
                rule.appliesToChannel === "google" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" :
                "bg-muted text-muted-foreground"
              )}>
                {rule.appliesToChannel === "meta" ? "Meta Ads" : rule.appliesToChannel === "google" ? "Google Ads" : "Todos"}
              </span>
              <span className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                rule.actionType === "PAUSE_ASSET" ? "bg-red-500/10 text-red-700 dark:text-red-300" :
                rule.actionType === "ACTIVATE_ASSET" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" :
                rule.actionType === "INCREASE_BUDGET_20" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" :
                rule.actionType === "DECREASE_BUDGET_20" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" :
                "bg-muted text-muted-foreground"
              )}>
                {rule.actionType === "NOTIFY_ONLY" ? "Notificar" :
                 rule.actionType === "PAUSE_ASSET" ? "Pausar" :
                 rule.actionType === "ACTIVATE_ASSET" ? "Ativar" :
                 rule.actionType === "INCREASE_BUDGET_20" ? "↑ Orçamento" :
                 rule.actionType === "DECREASE_BUDGET_20" ? "↓ Orçamento" : rule.actionType}
              </span>
              {rule.notifyWhatsapp && (
                <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:text-green-300">
                  WhatsApp
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border/35 pt-3 sm:border-0 sm:pt-0">
          <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-2.5 py-1.5">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground">On</span>
            <Switch
              checked={rule.active}
              disabled={!canEdit || savingToggle}
              onCheckedChange={(v) => onToggleActive(v)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 rounded-lg"
            disabled={!canEdit}
            onClick={onEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
          {canEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
