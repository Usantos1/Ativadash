import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Layout espelhado do dashboard executivo — evita tela vazia no primeiro paint.
 */
export function DashboardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-8", className)}>
      <section className="space-y-3">
        <Skeleton className="h-5 w-48" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/40 bg-card/50 p-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-3 h-8 w-full max-w-[120px]" />
            </div>
          ))}
        </div>
      </section>

      <Skeleton className="h-14 w-full rounded-xl" />

      <div className="rounded-xl border border-border/40 bg-card/40 p-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-3 h-24 w-full" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="rounded-2xl border border-border/45 bg-card/50 p-5">
          <Skeleton className="h-5 w-36" />
          <div className="mt-6 flex justify-center gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <Skeleton className="h-12 w-12 rounded-full" />
                <Skeleton className="h-3 w-14" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-border/45 bg-card/50 p-5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-4 h-32 w-full" />
        </div>
      </div>

      <section className="rounded-2xl border border-border/45 bg-muted/20 p-5">
        <Skeleton className="h-4 w-48" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </section>

      <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="mt-4 h-[300px] w-full rounded-lg" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-4 h-32 w-full" />
        </div>
        <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="mt-4 h-32 w-full" />
        </div>
      </div>

      <section className="space-y-3">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-10 w-full max-w-md rounded-lg" />
        <div className="space-y-2 rounded-xl border border-border/40 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </section>

      <div className="rounded-2xl border border-border/45 bg-muted/15 p-5">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="mt-3 h-16 w-full" />
      </div>
    </div>
  );
}
