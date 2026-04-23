import { Info } from "lucide-react";
import { formatPercent, formatSpend } from "@/lib/metrics-format";
import { cn } from "@/lib/utils";
import type { MarketingDashboardPayload } from "@/lib/marketing-dashboard-api";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Transforma o string "14412.27" (vindo do backend como string pra evitar erro de float)
 * no formato BRL "R$ 14.412,27". Entrada inválida cai em "R$ 0,00".
 */
function formatSpendFromString(raw: string | number): string {
  const n = typeof raw === "number" ? raw : parseFloat(raw);
  return formatSpend(Number.isFinite(n) ? n : 0);
}

/** Ícone de info com tooltip — padroniza a dica de cada card do painel de diagnóstico. */
function InfoDot({ text }: { text: string }) {
  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground/80 transition hover:text-foreground"
          aria-label="O que significa?"
        >
          <Info className="h-3.5 w-3.5" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[280px] text-xs leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

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
        <div className="flex items-center gap-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Plataforma × investimento
          </p>
          <InfoDot text="Mostra como o investimento do período foi dividido entre Meta Ads e Google Ads. O valor em BRL é o total gasto em cada plataforma; o percentual é a participação dela no investimento total." />
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {dash.distribution.byPlatform.map((p) => (
            <div key={p.platform} className="rounded-xl bg-muted/20 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{p.platform}</span>
                <span className="text-sm font-bold tabular-nums text-primary">
                  {p.spendSharePct.toFixed(1).replace(".", ",")}%
                </span>
              </div>
              <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                {formatSpendFromString(p.spend)}
              </p>
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
        <div className="flex items-center gap-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Temperatura · score CTR
          </p>
          <InfoDot text="Diagnóstico interno das campanhas da Meta. Temperatura classifica pelo nome (público já engajado vs. prospecção). Score agrupa as campanhas em quartis de CTR (A = melhores, D = piores) e mostra o peso de resultado (leads + compras + 10% dos cliques) de cada quartil." />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-muted/20 p-3">
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Temperatura</p>
              <InfoDot text="Classifica campanhas pelo NOME: 'Quente' se o nome inclui termos como remarketing, retarget, rmkt, checkout, compra, venda, conversão; 'Frio' caso contrário (prospecção/topo de funil). O percentual reflete o share de investimento de cada grupo. Exige naming consistente — se o nome não der pistas, a campanha cai em Frio." />
            </div>
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
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Score (gasto)</p>
              <InfoDot text="Ranqueia campanhas por CTR e divide em quartis: A (25% com melhor CTR), B, C, D (25% com pior CTR). O percentual mostra o 'peso de resultado' de cada grupo, calculado como leads + compras + 10% dos cliques. Muito peso em D sugere que quem gera resultado tem CTR baixo — oportunidade de melhorar criativos." />
            </div>
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
