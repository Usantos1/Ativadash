import { Link } from "react-router-dom";
import { formatNumber, formatSpend } from "@/lib/metrics-format";
import { cn } from "@/lib/utils";
import type { MarketingDashboardSummary } from "@/lib/marketing-dashboard-api";

export function DashboardAttributionPanel({
  summary,
  revenueMuted,
  derived,
  className,
}: {
  summary: MarketingDashboardSummary;
  revenueMuted: boolean;
  derived: MarketingDashboardSummary["derived"];
  className?: string;
}) {
  const noPurchaseData = summary.purchases === 0 && summary.purchaseValue <= 0;

  return (
    <section
      className={cn(
        "rounded-2xl border border-border/30 bg-card/40 p-4 sm:p-5",
        revenueMuted && "border-dashed border-muted-foreground/20 bg-muted/[0.08]",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">Receita · Meta</h2>
        {revenueMuted ? (
          <Link
            to="/marketing/configuracoes"
            className="text-[10px] font-medium text-primary underline-offset-2 hover:underline"
          >
            Ativar no Metas
          </Link>
        ) : null}
      </div>

      {revenueMuted ? (
        <p className="mt-2 text-[11px] text-muted-foreground">Modo captação — métricas de compra ocultas.</p>
      ) : null}

      {noPurchaseData && !revenueMuted ? (
        <p className="mt-3 text-center text-sm text-muted-foreground">Sem compras atribuídas no período</p>
      ) : !revenueMuted && !noPurchaseData ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-muted/15 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Compras</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{formatNumber(summary.purchases)}</p>
          </div>
          <div className="rounded-xl bg-muted/15 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Valor</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {summary.purchaseValue > 0 ? formatSpend(summary.purchaseValue) : "—"}
            </p>
          </div>
          <div className="rounded-xl bg-muted/15 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">ROAS</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {derived?.roas != null && Number.isFinite(derived.roas)
                ? `${derived.roas.toFixed(2).replace(".", ",")}×`
                : "—"}
            </p>
          </div>
          <div className="rounded-xl bg-muted/15 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Custo / compra</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {derived?.costPerPurchase != null ? formatSpend(derived.costPerPurchase) : "—"}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-border/20 pt-3 text-[11px] tabular-nums text-muted-foreground">
        <span>Conversas {formatNumber(summary.messagingConversations)}</span>
        <span>LPV {formatNumber(summary.landingPageViews)}</span>
      </div>
    </section>
  );
}
