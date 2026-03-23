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
};

/**
 * Wrapper semântico para tabelas analíticas: borda, hover, zebra opcional.
 * Use thead com classes utilitárias ou o componente exporta constantes recomendadas.
 */
export function DataTablePremium({ children, className, shellClassName, zebra, minHeight }: DataTablePremiumProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/55 bg-card/80 shadow-[var(--shadow-surface)]",
        shellClassName,
        minHeight
      )}
    >
      <div className="scrollbar-thin overflow-x-auto">
        <table
          className={cn(
            "w-full border-collapse text-sm",
            zebra && "[&_tbody_tr:nth-child(even)]:bg-muted/15",
            "[&_tbody_tr]:border-b [&_tbody_tr]:border-border/30 [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-primary/[0.04]",
            "[&_tbody_tr:last-child]:border-b-0",
            "[&_thead_tr]:border-b [&_thead_tr]:border-border/60",
            "[&_th]:whitespace-nowrap [&_th]:px-3 [&_th]:py-3 [&_th]:text-[11px] [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground",
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
