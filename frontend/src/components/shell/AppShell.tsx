import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Casca visual global do app autenticado: fundo, gradiente e tipografia base.
 * Complementa `MainLayout` (sidebar + topbar + conteúdo).
 */
export function AppShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-h-dvh bg-background bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,hsl(var(--primary)/0.07),transparent_52%)]",
        className
      )}
    >
      {children}
    </div>
  );
}
