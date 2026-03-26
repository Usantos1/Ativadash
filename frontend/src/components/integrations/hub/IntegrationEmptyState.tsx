import { Plug, SearchX } from "lucide-react";

type Props = {
  query: string;
};

export function IntegrationEmptyState({ query }: Props) {
  const hasQuery = query.trim().length > 0;
  const Icon = hasQuery ? SearchX : Plug;
  return (
    <div className="relative overflow-hidden rounded-3xl border border-dashed border-border/80 bg-gradient-to-br from-muted/30 via-card to-primary/[0.03] px-6 py-20 text-center shadow-inner">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
      <div className="relative mx-auto flex max-w-md flex-col items-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-background shadow-md ring-1 ring-border/60">
          <Icon className="h-8 w-8 text-muted-foreground" aria-hidden />
        </div>
        <p className="text-lg font-semibold text-foreground">Nenhuma integração aqui</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {hasQuery
            ? `Nada corresponde a “${query.trim()}”. Limpe a busca ou troque o filtro.`
            : "Ajuste o filtro ou volte a “Todas” para ver o catálogo completo."}
        </p>
      </div>
    </div>
  );
}
