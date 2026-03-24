import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/** Toolbar padrão de listas: busca + filtros + ações. */
export function EntityTableToolbar({
  searchPlaceholder = "Buscar…",
  searchValue,
  onSearchChange,
  filters,
  actions,
  className,
}: {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  filters?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border/55 bg-gradient-to-b from-card to-muted/[0.12] p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4",
        className
      )}
    >
      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" aria-hidden />
        <Input
          value={searchValue}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-10 rounded-lg border-border/70 bg-background/90 pl-9 shadow-inner"
          aria-label="Buscar na lista"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {filters}
        {actions}
      </div>
    </div>
  );
}
