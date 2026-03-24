import { formatPercent } from "@/lib/metrics-format";
import { cn } from "@/lib/utils";
import type { MarketingDashboardPayload } from "@/lib/marketing-dashboard-api";

/** Distribuição de verba e score — só números e barras, sem texto consultivo. */
export function DashboardPlatformDiagnostics({
  dash,
  className,
}: {
  dash: Extract<MarketingDashboardPayload, { ok: true }>;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 lg:grid-cols-2", className)}>
      <div className="rounded-2xl border border-border/30 bg-card/50 p-4 sm:p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Plataforma × investimento
        </p>
        <div className="mt-4 flex flex-col gap-3">
          {dash.distribution.byPlatform.map((p) => (
            <div key={p.platform} className="rounded-xl bg-muted/20 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{p.platform}</span>
                <span className="text-sm font-bold tabular-nums text-primary">
                  {p.spendSharePct.toFixed(1).replace(".", ",")}%
                </span>
              </div>
              <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">R$ {p.spend}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary/90 to-primary/45"
                  style={{ width: `${Math.min(100, p.spendSharePct)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border/30 bg-card/50 p-4 sm:p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Temperatura · score CTR
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-muted/20 p-3">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Temperatura</p>
            {!dash.distribution.byTemperature.length ? (
              <p className="mt-2 text-sm text-muted-foreground">—</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {dash.distribution.byTemperature.map((t) => (
                  <li key={t.segment} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{t.segment === "hot" ? "Quente" : "Frio"}</span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {formatPercent(t.spendSharePct)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-xl bg-muted/20 p-3">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Score (gasto)</p>
            <ul className="mt-2 space-y-2 text-sm">
              {(["A", "B", "C", "D"] as const).map((g) => (
                <li key={g} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{g}</span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatPercent(dash.distribution.byScore[g])}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
