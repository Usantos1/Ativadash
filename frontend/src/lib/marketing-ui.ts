import { cn } from "@/lib/utils";

/** Botões de ação no topo do Painel/Funil (período, atualizar, PDF, enviar) — contraste explícito. */
export const marketingToolbarOutlineClassName =
  "border-border bg-card font-semibold text-foreground shadow-sm hover:bg-muted/80 dark:border-border dark:bg-card dark:hover:bg-muted/60";

/** “Automação e Metas”: visível mas distinto do primário (Compartilhar). */
export const marketingToolbarMetasClassName =
  "border-2 border-primary/40 bg-primary/10 font-bold text-primary shadow-sm hover:bg-primary/20 dark:border-primary/50 dark:bg-primary/15 dark:text-violet-200 dark:hover:bg-primary/25";

export function marketingToolbarDateButtonClassName(periodCustom: boolean) {
  return cn(
    marketingToolbarOutlineClassName,
    periodCustom && "border-amber-500/60 bg-amber-50/90 ring-1 ring-amber-500/30 dark:bg-amber-950/40 dark:ring-amber-500/35"
  );
}
