import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** Texto curto abaixo da barra (opcional). */
  label?: string;
};

/** Barra de progresso indeterminada enquanto a API carrega. */
export function IndeterminateLoadingBar({ className, label }: Props) {
  return (
    <div className={cn("w-full space-y-2", className)}>
      <div
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-busy="true"
        aria-valuetext={label ?? "Carregando"}
      >
        <div className="h-full w-[38%] rounded-full bg-primary shadow-sm animate-loading-bar-slide" />
      </div>
      {label ? <p className="text-center text-[11px] text-muted-foreground">{label}</p> : null}
    </div>
  );
}
