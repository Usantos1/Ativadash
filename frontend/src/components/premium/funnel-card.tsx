import { cn } from "@/lib/utils";

export type FunnelStage = { label: string; value: number; hint?: string };

/** Funil compacto legível (valores relativos ao maior estágio). */
export function FunnelCard({
  title,
  description,
  stages,
  className,
}: {
  title: string;
  description?: string;
  stages: FunnelStage[];
  className?: string;
}) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[var(--shadow-surface)] ring-1 ring-black/[0.02] dark:ring-white/[0.03]",
        className
      )}
    >
      <div className="border-b border-border/50 bg-gradient-to-r from-primary/[0.06] via-transparent to-transparent px-5 py-4">
        <h3 className="text-sm font-bold tracking-tight text-foreground">{title}</h3>
        {description ? <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      <div className="space-y-3 p-5">
        {stages.map((s) => {
          const pct = (s.value / max) * 100;
          return (
            <div key={s.label}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="font-semibold text-foreground">{s.label}</span>
                <span className="tabular-nums text-muted-foreground">{s.value.toLocaleString("pt-BR")}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted/80">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary/40 transition-all duration-500"
                  style={{ width: `${Math.max(6, pct)}%` }}
                />
              </div>
              {s.hint ? <p className="mt-1 text-[10px] text-muted-foreground">{s.hint}</p> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
