import { ArrowRight, TrendingDown, TrendingUp, ShieldAlert, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type TemplateTone = "risk" | "gain" | "neutral";

export type AutomationTemplateCardProps = {
  id: string;
  tone: TemplateTone;
  title: string;
  subtitle: string;
  trigger: string;
  action: string;
  canEdit: boolean;
  instances: number;
  onApply: () => void;
};

const TONE_CONFIG: Record<
  TemplateTone,
  { icon: LucideIcon; iconClass: string; wrap: string; chip: string; accentRail: string }
> = {
  risk: {
    icon: ShieldAlert,
    iconClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    wrap: "border-rose-500/25 hover:border-rose-500/45",
    chip: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
    accentRail: "bg-rose-500",
  },
  gain: {
    icon: TrendingUp,
    iconClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    wrap: "border-emerald-500/25 hover:border-emerald-500/45",
    chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    accentRail: "bg-emerald-500",
  },
  neutral: {
    icon: TrendingDown,
    iconClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    wrap: "border-amber-500/25 hover:border-amber-500/45",
    chip: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    accentRail: "bg-amber-500",
  },
};

export function AutomationTemplateCard({
  tone,
  title,
  subtitle,
  trigger,
  action,
  canEdit,
  instances,
  onApply,
}: AutomationTemplateCardProps) {
  const config = TONE_CONFIG[tone];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-surface-sm)] transition-all",
        config.wrap
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", config.accentRail)} aria-hidden />

      <div className="flex flex-1 flex-col gap-3 p-4 pl-5">
        <div className="flex items-start justify-between gap-3">
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", config.iconClass)}>
            <Icon className="h-5 w-5" aria-hidden />
          </div>
          {instances > 0 ? (
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums", config.chip)}>
              {instances}× no cliente
            </span>
          ) : (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              Novo
            </span>
          )}
        </div>

        <div className="space-y-1">
          <h3 className="text-sm font-bold tracking-tight text-foreground">{title}</h3>
          <p className="text-[12px] leading-snug text-muted-foreground">{subtitle}</p>
        </div>

        <dl className="space-y-1.5 rounded-lg border border-border/50 bg-muted/20 p-2.5">
          <div className="flex items-start gap-2 text-[11px]">
            <dt className="w-14 shrink-0 font-semibold uppercase tracking-wide text-muted-foreground">Gatilho</dt>
            <dd className="flex-1 font-medium text-foreground">{trigger}</dd>
          </div>
          <div className="flex items-start gap-2 text-[11px]">
            <dt className="w-14 shrink-0 font-semibold uppercase tracking-wide text-muted-foreground">Ação</dt>
            <dd className="flex-1 font-medium text-foreground">{action}</dd>
          </div>
        </dl>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-auto w-full justify-between rounded-xl"
          disabled={!canEdit}
          onClick={onApply}
        >
          <span>Usar este template</span>
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
