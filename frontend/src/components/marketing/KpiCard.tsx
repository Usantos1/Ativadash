import { TrendingUp, TrendingDown, Minus, HelpCircle, ExternalLink, Settings } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MarketingKpi } from "@/types";

interface KpiCardProps {
  kpi: MarketingKpi;
  className?: string;
  onView?: (id: string) => void;
  onConfigure?: (id: string) => void;
  onFaturamentoDetail?: () => void;
}

export function KpiCard({ kpi, className, onView, onConfigure, onFaturamentoDetail }: KpiCardProps) {
  const TrendIcon =
    kpi.trend === "up" ? TrendingUp : kpi.trend === "down" ? TrendingDown : Minus;
  const trendColor =
    kpi.trend === "up"
      ? "text-[hsl(var(--success))]"
      : kpi.trend === "down"
        ? "text-destructive"
        : "text-muted-foreground";

  const isFaturamento = kpi.id === "faturamento";
  const showDetail = isFaturamento && onFaturamentoDetail;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          {kpi.label}
        </span>
        <div className="flex items-center gap-1">
          {kpi.trendValue && (
            <span className={cn("flex items-center gap-0.5 text-xs", trendColor)}>
              <TrendIcon className="h-3.5 w-3.5" />
              {kpi.trendValue}
            </span>
          )}
          <button
            type="button"
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Fonte do dado"
            aria-label="Informação"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <p
          className={cn(
            "text-xl font-semibold tabular-nums tracking-tight",
            kpi.highlightPositive && "text-[hsl(var(--success))]"
          )}
        >
          {typeof kpi.value === "number" ? kpi.value.toLocaleString("pt-BR") : kpi.value}
        </p>
        {kpi.subValue && (
          <p className="mt-0.5 text-xs text-muted-foreground">{kpi.subValue}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {showDetail && (
            <button
              type="button"
              onClick={onFaturamentoDetail}
              className="flex items-center gap-1 text-primary hover:underline"
            >
              Visualizar
              <ExternalLink className="h-3 w-3" />
            </button>
          )}
          {kpi.showView && !showDetail && onView && (
            <button
              type="button"
              onClick={() => onView(kpi.id)}
              className="flex items-center gap-1 text-primary hover:underline"
            >
              Visualizar
              <ExternalLink className="h-3 w-3" />
            </button>
          )}
          {kpi.showConfigure && onConfigure && (
            <button
              type="button"
              onClick={() => onConfigure(kpi.id)}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <Settings className="h-3 w-3" />
              Configurar
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
