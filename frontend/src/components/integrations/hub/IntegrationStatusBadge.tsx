import { cn } from "@/lib/utils";

export type IntegrationHubVisualStatus = "connected" | "disconnected" | "soon" | "error";

const styles: Record<IntegrationHubVisualStatus, string> = {
  connected:
    "bg-emerald-500/12 text-emerald-800 ring-1 ring-inset ring-emerald-500/25 dark:text-emerald-200 dark:ring-emerald-400/20",
  disconnected: "bg-slate-500/10 text-slate-600 ring-1 ring-inset ring-slate-500/15 dark:text-slate-400",
  soon: "bg-amber-500/12 text-amber-900 ring-1 ring-inset ring-amber-400/30 dark:text-amber-200 dark:ring-amber-500/25",
  error: "bg-red-500/12 text-red-800 ring-1 ring-inset ring-red-500/25 dark:text-red-200",
};

const labels: Record<IntegrationHubVisualStatus, string> = {
  connected: "Conectado",
  disconnected: "Desconectado",
  soon: "Em breve",
  error: "Erro",
};

type Props = {
  status: IntegrationHubVisualStatus;
  className?: string;
};

export function IntegrationStatusBadge({ status, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
        styles[status],
        className
      )}
    >
      <span
        className={cn(
          "mr-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
          status === "connected" && "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]",
          status === "disconnected" && "bg-slate-400",
          status === "soon" && "bg-amber-500",
          status === "error" && "bg-red-500"
        )}
        aria-hidden
      />
      {labels[status]}
    </span>
  );
}
