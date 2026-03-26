import type { ReactNode } from "react";
import { AppMainRouteBody } from "@/components/layout/AppMainRouteBody";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  /** Fundo das páginas de detalhe de integração. */
  variant?: "gradient" | "muted" | "plain";
  /** Espaço vertical entre blocos filhos (header, alertas, grids). */
  spacing?: "default" | "relaxed";
  className?: string;
  contentClassName?: string;
};

/**
 * Shell visual das integrações: fundo + espaçamento vertical.
 * Largura horizontal = mesma do Painel ADS (`AppMainRouteBody` / `MainLayout` apenas).
 */
export function IntegrationDetailPageShell({
  children,
  variant = "gradient",
  spacing = "default",
  className,
  contentClassName,
}: Props) {
  return (
    <div
      className={cn(
        "min-w-0 pb-20",
        variant === "gradient" && "bg-gradient-to-b from-muted/30 via-background to-background",
        variant === "muted" && "bg-gradient-to-b from-muted/25 to-background",
        variant === "plain" && "bg-background",
        className
      )}
    >
      <AppMainRouteBody
        className={cn(
          spacing === "relaxed" ? "space-y-8" : "space-y-6",
          contentClassName
        )}
      >
        {children}
      </AppMainRouteBody>
    </div>
  );
}
