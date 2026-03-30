import type { ReactNode } from "react";
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Botão (?) com tooltip — use dentro de um `TooltipProvider` (ex.: `RevendaLayout`). */
export function PageHint({
  children,
  className,
  label = "Ajuda",
}: {
  children: ReactNode;
  className?: string;
  /** `aria-label` do botão */
  label?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
            className
          )}
          aria-label={label}
        >
          <HelpCircle className="h-4 w-4" strokeWidth={2} />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="start"
        className="max-w-[min(280px,calc(100vw-2rem))] text-pretty text-left text-xs leading-relaxed"
      >
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
