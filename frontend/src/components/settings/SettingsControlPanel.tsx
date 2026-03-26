import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

export type SettingsAction = {
  label: string;
  to?: string;
  onClick?: () => void;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive";
};

/**
 * Card de controle do hub: título forte, faixa de conteúdo e até duas ações (primária + secundária).
 */
export function SettingsControlPanel({
  icon: Icon,
  eyebrow,
  title,
  subtitle,
  children,
  primaryAction,
  secondaryAction,
  className,
  contentClassName,
}: {
  icon: LucideIcon;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  primaryAction?: SettingsAction;
  secondaryAction?: SettingsAction;
  className?: string;
  contentClassName?: string;
}) {
  function renderBtn(a: SettingsAction, idx: number) {
    const v = a.variant ?? (idx === 0 ? "default" : "outline");
    const cls = "h-9 shrink-0 rounded-xl text-sm font-semibold";
    if (a.to) {
      return (
        <Button key={a.label} variant={v} className={cls} asChild>
          <Link to={a.to}>{a.label}</Link>
        </Button>
      );
    }
    return (
      <Button key={a.label} variant={v} className={cls} type="button" onClick={a.onClick}>
        {a.label}
      </Button>
    );
  }

  return (
    <Card
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-2xl border-border/55 bg-card/90 shadow-[var(--shadow-surface-sm)] transition-[border-color,box-shadow] hover:border-border hover:shadow-[var(--shadow-surface)]",
        className
      )}
    >
      <CardHeader className="space-y-2 pb-2">
        <div className="flex gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/[0.12] text-primary"
            aria-hidden
          >
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            {eyebrow ? (
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary/85">{eyebrow}</p>
            ) : null}
            <CardTitle className="text-base font-bold tracking-tight text-foreground sm:text-lg">{title}</CardTitle>
            {subtitle ? <p className="mt-1 text-xs leading-snug text-muted-foreground sm:text-sm">{subtitle}</p> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn("flex flex-1 flex-col gap-4 pt-0", contentClassName)}>
        {children ? (
          <div className="min-h-0 flex-1 space-y-3 border-t border-border/40 pt-4">{children}</div>
        ) : null}
        {(primaryAction || secondaryAction) && (
          <div className="mt-auto flex flex-wrap gap-2 border-t border-border/35 pt-4">
            {primaryAction ? renderBtn(primaryAction, 0) : null}
            {secondaryAction ? renderBtn(secondaryAction, 1) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SettingsMetricLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[65%] text-right font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}
