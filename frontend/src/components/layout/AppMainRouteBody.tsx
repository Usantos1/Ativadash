import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Largura útil padrão das rotas dentro do `MainLayout`, alinhada ao Painel ADS (`/marketing`).
 *
 * O padding horizontal (`px-3 sm:px-5 md:px-8`) é aplicado **uma única vez** no `MainLayout`
 * ao redor do `<Outlet />`. Não adicionar `px-*` nem `max-w-*` aqui — evita “faixa” estreita
 * e margens duplicadas em relação ao restante do sistema.
 */
export function AppMainRouteBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("min-w-0 w-full max-w-full", className)}>{children}</div>;
}
