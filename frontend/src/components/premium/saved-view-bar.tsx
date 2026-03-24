import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type SavedView = { id: string; label: string };

/** Chips de visões salvas (filtros + colunas). */
export function SavedViewBar({
  views,
  activeId,
  onSelect,
  className,
}: {
  views: SavedView[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  if (views.length === 0) return null;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 rounded-xl border border-border/45 bg-muted/20 p-1.5 shadow-inner",
        className
      )}
      role="tablist"
      aria-label="Visões salvas"
    >
      {views.map((v) => {
        const active = v.id === activeId;
        return (
          <Button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={active}
            variant={active ? "default" : "ghost"}
            size="sm"
            className={cn(
              "h-8 rounded-lg px-3 text-xs font-semibold",
              !active && "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => onSelect?.(v.id)}
          >
            {v.label}
          </Button>
        );
      })}
    </div>
  );
}
