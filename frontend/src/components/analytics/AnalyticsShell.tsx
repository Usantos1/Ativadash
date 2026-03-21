import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Container principal para páginas analíticas: largura máxima executiva e padding consistente. */
export function AnalyticsShell({
  children,
  className,
  flush = false,
}: {
  children: ReactNode;
  className?: string;
  /** Sem padding horizontal (raro; o layout global já aplica base) */
  flush?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full min-w-0 max-w-[min(100%,1920px)]",
        !flush && "px-1 sm:px-0",
        className
      )}
    >
      {children}
    </div>
  );
}
