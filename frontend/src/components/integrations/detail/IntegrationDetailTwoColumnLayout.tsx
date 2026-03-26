import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  /** Coluna principal (formulários, tabelas). */
  main: ReactNode;
  /** Resumo / sidebar (largura estável no desktop). */
  sidebar: ReactNode;
  className?: string;
};

/**
 * Desktop: principal flexível + lateral ~360px. Mobile: resumo primeiro, depois config.
 */
export function IntegrationDetailTwoColumnLayout({ main, sidebar, className }: Props) {
  return (
    <div
      className={cn(
        "grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,360px)] lg:items-start lg:gap-8",
        className
      )}
    >
      <div className="order-2 min-w-0 space-y-6 lg:order-1">{main}</div>
      <div className="order-1 min-w-0 space-y-6 lg:sticky lg:top-6 lg:order-2">{sidebar}</div>
    </div>
  );
}
