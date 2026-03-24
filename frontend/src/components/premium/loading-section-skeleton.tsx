import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type BlockPreset = "kpi" | "chart" | "table" | "text" | "custom";

function Block({ preset, className }: { preset: BlockPreset; className?: string }) {
  switch (preset) {
    case "kpi":
      return (
        <div className={cn("rounded-2xl border border-border/50 bg-card/60 p-4 shadow-sm", className)}>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-9 w-32" />
          <Skeleton className="mt-3 h-3 w-20" />
        </div>
      );
    case "chart":
      return (
        <div className={cn("rounded-2xl border border-border/50 bg-card/60 p-4 shadow-sm", className)}>
          <div className="flex justify-between gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-8 w-24" />
          </div>
          <Skeleton className="mt-6 h-[220px] w-full rounded-xl" />
        </div>
      );
    case "table":
      return (
        <div className={cn("rounded-2xl border border-border/50 bg-card/60 p-4 shadow-sm", className)}>
          <Skeleton className="h-4 w-48" />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        </div>
      );
    case "text":
      return (
        <div className={cn("space-y-2", className)}>
          <Skeleton className="h-4 w-full max-w-md" />
          <Skeleton className="h-4 w-full max-w-lg" />
          <Skeleton className="h-4 w-2/3 max-w-sm" />
        </div>
      );
    default:
      return null;
  }
}

/** Skeleton por bloco — evita página branca; mantém hierarquia visual. */
export function LoadingSectionSkeleton({
  title,
  blocks,
  className,
  children,
}: {
  title?: string;
  blocks: BlockPreset[];
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section className={cn("space-y-4", className)} aria-busy="true" aria-label={title ?? "Carregando conteúdo"}>
      {title ? (
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-40" />
        </div>
      ) : null}
      {children}
      <div className="flex flex-col gap-4">
        {blocks.map((b, i) => (
          <Block key={`${b}-${i}`} preset={b} />
        ))}
      </div>
    </section>
  );
}

/** Faixa única com shimmer (altura configurável). */
export function ShimmerBlock({ className }: { className?: string }) {
  return <Skeleton className={cn("w-full rounded-xl", className)} />;
}
