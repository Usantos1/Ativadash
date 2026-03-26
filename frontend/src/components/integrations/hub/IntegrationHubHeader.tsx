import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Stat = { label: string; value: number; tone: "emerald" | "slate" | "amber" };

const toneClass: Record<Stat["tone"], string> = {
  emerald:
    "text-emerald-600 dark:text-emerald-300 drop-shadow-[0_1px_0_rgba(0,0,0,0.08)] dark:drop-shadow-none",
  slate: "text-slate-800 dark:text-slate-100 drop-shadow-[0_1px_0_rgba(0,0,0,0.06)] dark:drop-shadow-none",
  amber:
    "text-amber-700 dark:text-amber-200 drop-shadow-[0_1px_0_rgba(0,0,0,0.06)] dark:drop-shadow-none",
};

type Props = {
  title: string;
  subtitle: string;
  toolbar: ReactNode;
  stats: Stat[];
};

export function IntegrationHubHeader({ title, subtitle, toolbar, stats }: Props) {
  return (
    <header className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.06] shadow-md ring-1 ring-black/[0.04] dark:ring-white/[0.07]">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/[0.09] blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-violet-500/[0.07] blur-3xl" aria-hidden />
      <div className="relative px-5 py-7 sm:px-9 sm:py-9 lg:flex lg:items-start lg:justify-between lg:gap-12">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Marketing</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-[2.5rem]">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">{subtitle}</p>
        </div>
        <div className="mt-7 flex min-w-0 flex-col gap-4 lg:mt-1 lg:w-[min(100%,440px)] lg:shrink-0">{toolbar}</div>
      </div>
      <div className="relative grid grid-cols-3 gap-px border-t border-border/60 bg-border/60">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-gradient-to-b from-muted/50 to-card px-4 py-4 text-center backdrop-blur-[2px] sm:px-8 sm:py-5"
          >
            <p
              className={cn(
                "text-3xl font-extrabold tabular-nums tracking-tight sm:text-4xl",
                toneClass[s.tone]
              )}
            >
              {s.value}
            </p>
            <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground sm:text-[11px]">
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </header>
  );
}
