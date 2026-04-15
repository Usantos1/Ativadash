import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/clientes", label: "Clientes", end: true },
  { to: "/projetos", label: "Projetos", end: true },
  { to: "/lancamentos", label: "Lançamentos", end: true },
  { to: "/usuarios", label: "Equipe", end: true },
] as const;

/** Navegação rápida entre telas do módulo operacional (clientes, projetos, lançamentos, equipe). */
export function OperationsModuleNav({ className }: { className?: string }) {
  return (
    <nav className={cn("flex flex-wrap gap-2", className)} aria-label="Módulo operação">
      {LINKS.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          className={({ isActive }) =>
            cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold tracking-tight transition-colors",
              isActive
                ? "border-primary/45 bg-primary/12 text-primary shadow-[var(--shadow-surface-sm)]"
                : "border-border/55 bg-card/50 text-muted-foreground hover:border-border hover:bg-muted/20 hover:text-foreground"
            )
          }
        >
          {l.label}
        </NavLink>
      ))}
    </nav>
  );
}
