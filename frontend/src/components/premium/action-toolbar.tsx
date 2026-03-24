import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Barra de ações primárias/secundárias alinhada ao grid premium. */
export function ActionToolbar({
  children,
  className,
  sticky,
  dense,
}: {
  children: ReactNode;
  className?: string;
  sticky?: boolean;
  dense?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-card/90 px-3 py-2 shadow-sm backdrop-blur-sm dark:bg-card/80",
        dense && "py-1.5",
        sticky && "sticky top-[calc(3rem+env(safe-area-inset-top,0px))] z-20",
        className
      )}
    >
      {children}
    </div>
  );
}
