import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Payload legível: JSON formatado com bloco colapsável. */
export function JsonViewer({ data, className }: { data: unknown; className?: string }) {
  const [open, setOpen] = useState(false);
  const text = useMemo(() => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }, [data]);

  return (
    <div className={cn("rounded-lg border border-border/50 bg-muted/25", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border/40 px-2 py-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-[11px]"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          Payload bruto
        </Button>
      </div>
      {open ? (
        <pre className="max-h-56 overflow-auto p-2 font-mono text-[10px] leading-relaxed text-foreground">{text}</pre>
      ) : (
        <p className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground line-clamp-2">{text}</p>
      )}
    </div>
  );
}
