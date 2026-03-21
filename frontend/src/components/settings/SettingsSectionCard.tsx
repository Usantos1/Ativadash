import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Card de seção do hub de configurações: ícone, título, descrição curta,
 * área de métricas e CTA único.
 */
export function SettingsSectionCard({
  icon: Icon,
  title,
  description,
  children,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: React.ReactNode;
  action: { label: string; to: string };
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "flex h-full flex-col rounded-2xl border-border/55 shadow-[var(--shadow-surface-sm)] transition-[border-color,box-shadow] hover:border-primary/30 hover:shadow-[var(--shadow-surface)]",
        className
      )}
    >
      <CardHeader className="space-y-0 pb-3">
        <div className="flex gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/[0.12] text-primary"
            aria-hidden
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="text-base font-semibold leading-snug tracking-tight">{title}</CardTitle>
            <CardDescription className="text-xs leading-relaxed sm:text-[13px]">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 pt-0">
        {children ? <div className="min-h-[3rem] flex-1 space-y-2 border-t border-border/45 pt-3">{children}</div> : null}
        <div className="mt-auto border-t border-border/35 pt-3">
          <Link
            to={action.to}
            className="inline-flex items-center gap-0.5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            {action.label}
            <ChevronRight className="h-4 w-4 opacity-80" aria-hidden />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export function SettingsStatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="shrink-0 text-right font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}
