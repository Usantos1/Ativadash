import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type DataTablePremiumProps = {
  children: ReactNode;
  className?: string;
  /** Classes no container externo (borda, raio, sombra) */
  shellClassName?: string;
  /** Listra muito sutil nas linhas */
  zebra?: boolean;
  /** altura mínima da área rolável */
  minHeight?: string;
  /** Cabeçalho fixo ao rolar (área com scroll) */
  stickyHeader?: boolean;
};

/**
 * Wrapper semântico para tabelas analíticas: borda, hover, zebra opcional.
 * Use thead com classes utilitárias ou o componente exporta constantes recomendadas.
 */
export function DataTablePremium({
  children,
  className,
  shellClassName,
  zebra,
  minHeight,
  stickyHeader,
}: DataTablePremiumProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/70 bg-card shadow-[var(--shadow-surface)]",
        shellClassName,
        minHeight
      )}
    >
      <div className={cn("scrollbar-thin overflow-x-auto", stickyHeader && "max-h-[min(70vh,520px)] overflow-y-auto")}>
        <table
          className={cn(
            "w-full border-collapse text-sm",
            zebra && "[&_tbody_tr:nth-child(even)]:bg-muted/[0.22]",
            "[&_tbody_tr]:border-b [&_tbody_tr]:border-border/45 [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-muted/45 dark:[&_tbody_tr:hover]:bg-muted/25",
            "[&_tbody_tr:last-child]:border-b-0",
            "[&_thead_tr]:border-b [&_thead_tr]:border-border/60",
            stickyHeader &&
              "[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-20 [&_thead_th]:bg-card/95 [&_thead_th]:backdrop-blur-sm [&_thead_th]:shadow-[0_1px_0_hsl(var(--border)/0.5)]",
            "[&_th]:whitespace-nowrap [&_th]:px-3 [&_th]:py-3.5 [&_th]:text-[11px] [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground",
            "[&_td]:px-3 [&_td]:py-2.5",
            className
          )}
        >
          {children}
        </table>
      </div>
    </div>
  );
}
