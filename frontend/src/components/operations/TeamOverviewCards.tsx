import { Mailbox, ShieldCheck, UserCheck, Users, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TeamOverviewCardsProps = {
  membersCount: number;
  directCount: number;
  pendingCount: number;
  planCapLabel: string;
  planNote: string;
};

type Tile = {
  label: string;
  value: string;
  hint?: ReactNode;
  icon: LucideIcon;
  tone: "primary" | "emerald" | "amber" | "neutral";
  pulse?: boolean;
};

const TONE_STYLES: Record<Tile["tone"], { wrap: string; icon: string }> = {
  primary: {
    wrap: "border-primary/25 bg-primary/[0.04] dark:bg-primary/[0.08]",
    icon: "bg-primary/15 text-primary",
  },
  emerald: {
    wrap: "border-emerald-500/30 bg-emerald-500/[0.05] dark:bg-emerald-950/25",
    icon: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  amber: {
    wrap: "border-amber-500/30 bg-amber-500/[0.05] dark:bg-amber-950/20",
    icon: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  neutral: {
    wrap: "border-border/50 bg-muted/20",
    icon: "bg-muted text-muted-foreground",
  },
};

export function TeamOverviewCards({
  membersCount,
  directCount,
  pendingCount,
  planCapLabel,
  planNote,
}: TeamOverviewCardsProps) {
  const tiles: Tile[] = [
    {
      label: "Membros ativos",
      value: membersCount.toString(),
      hint: <span>Total de usuários na organização</span>,
      icon: Users,
      tone: membersCount > 0 ? "primary" : "neutral",
    },
    {
      label: "Acesso direto",
      value: directCount.toString(),
      hint: (
        <span>
          {directCount === membersCount
            ? "Todos são membros diretos"
            : `${membersCount - directCount} via agência`}
        </span>
      ),
      icon: UserCheck,
      tone: directCount > 0 ? "emerald" : "neutral",
    },
    {
      label: "Convites pendentes",
      value: pendingCount.toString(),
      hint: pendingCount === 0 ? <span>Nenhum convite aguardando</span> : <span>Aguardando aceite do destinatário</span>,
      icon: Mailbox,
      tone: pendingCount > 0 ? "amber" : "neutral",
      pulse: pendingCount > 0,
    },
    {
      label: "Limite do plano",
      value: planCapLabel,
      hint: <span className="truncate">{planNote}</span>,
      icon: ShieldCheck,
      tone: "neutral",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        const styles = TONE_STYLES[tile.tone];
        return (
          <div
            key={tile.label}
            className={cn(
              "flex items-start gap-3 rounded-2xl border p-3.5 shadow-[var(--shadow-surface-sm)] transition-colors sm:p-4",
              styles.wrap
            )}
          >
            <div className={cn("relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", styles.icon)}>
              <Icon className="h-4 w-4" aria-hidden />
              {tile.pulse ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
                  <span className="absolute inset-0 animate-ping rounded-full bg-amber-500/60" aria-hidden />
                  <span className="relative h-2 w-2 rounded-full bg-amber-500" aria-hidden />
                </span>
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{tile.label}</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums tracking-tight text-foreground sm:text-2xl">
                {tile.value}
              </p>
              <div className="mt-1 truncate text-[11px] text-muted-foreground">{tile.hint}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
