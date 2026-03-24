import { cn } from "@/lib/utils";

export type MarketingScoreGrades = {
  A: number;
  B: number;
  C: number;
  D: number;
};

const ROWS: {
  key: keyof MarketingScoreGrades;
  label: string;
  title: string;
  barClass: string;
  labelClass: string;
}[] = [
  { key: "A", label: "A", title: "Ótimo", barClass: "bg-emerald-500", labelClass: "text-emerald-700 dark:text-emerald-400" },
  { key: "B", label: "B", title: "Bom", barClass: "bg-lime-500", labelClass: "text-lime-800 dark:text-lime-400" },
  { key: "C", label: "C", title: "Atenção", barClass: "bg-amber-500", labelClass: "text-amber-800 dark:text-amber-400" },
  { key: "D", label: "D", title: "Crítico", barClass: "bg-red-500", labelClass: "text-red-700 dark:text-red-400" },
];

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

/** Faixas A–D como barras horizontais (0–100%). */
export function MarketingScoreBars({ grades }: { grades: MarketingScoreGrades }) {
  return (
    <div className="space-y-3 rounded-xl border border-border/50 bg-card/60 p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Score de campanhas</p>
      <p className="text-xs text-muted-foreground">
        Participação do investimento filtrado por faixa de CTR (ponderado).
      </p>
      <div className="mt-2 space-y-2.5">
        {ROWS.map((row) => {
          const pct = clampPct(grades[row.key]);
          return (
            <div key={row.key} className="flex min-w-0 items-center gap-3">
              <div className={cn("w-24 shrink-0 text-xs font-semibold", row.labelClass)}>
                <span className="tabular-nums">{row.label}</span>{" "}
                <span className="font-medium text-muted-foreground">{row.title}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/80">
                  <div
                    className={cn("h-full rounded-full transition-[width] duration-300", row.barClass)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-foreground">
                {pct.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
