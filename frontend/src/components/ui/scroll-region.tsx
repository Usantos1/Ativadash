import { forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Área com scroll horizontal suave em telas pequenas (tabelas, gráficos largos).
 * Use dentro de `min-w-0` no flex parent para não estourar a viewport.
 */
export const ScrollRegion = forwardRef<
  HTMLDivElement,
  { children: ReactNode; className?: string }
>(function ScrollRegion({ children, className }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]",
        "scrollbar-thin",
        className
      )}
    >
      {children}
    </div>
  );
});
