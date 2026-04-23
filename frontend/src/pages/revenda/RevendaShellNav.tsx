import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  Puzzle,
  Activity,
  ScrollText,
  HelpCircle,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type IconComp = typeof LayoutDashboard;

type NavDef = {
  to: string;
  end?: boolean;
  label: string;
  hint: string;
  icon: IconComp;
};

const NAV_ITEMS: NavDef[] = [
  { to: "/revenda", end: true, label: "Resumo", hint: "Números da matriz: contas, usuários, integrações e alertas.", icon: LayoutDashboard },
  {
    to: "/revenda/contas",
    label: "Contas",
    hint: "Clientes finais e agências filiais da sua rede — em abas. Clientes são contas finais; agências têm equipe e clientes próprios abaixo.",
    icon: Building2,
  },
  { to: "/revenda/pessoas", label: "Pessoas", hint: "Todos usuários da matriz e contas filhas: convite, papel, bloqueio e reset de senha.", icon: Users },
  { to: "/revenda/planos", label: "Planos", hint: "Ofertas que você vende; definem o padrão de recursos e números.", icon: CreditCard },
  {
    to: "/revenda/modulos",
    label: "Módulos",
    hint: "Chaves de módulos (ligar/desligar) e cotas numéricas; o plano define o padrão e você ajusta por conta em Clientes ou Agências → Editar.",
    icon: Puzzle,
  },
  {
    to: "/revenda/saude",
    label: "Saúde",
    hint: "Indicadores e alertas da rede (integrações, membros, atividade). Liga ao resumo e às listas de empresas.",
    icon: Activity,
  },
  {
    to: "/revenda/auditoria",
    label: "Auditoria",
    hint: "Governança da matriz e linha do tempo nas empresas: quem alterou campanhas vs. o que a automação executou.",
    icon: ScrollText,
  },
];

function NavEntry({ to, end, label, hint, icon: Icon }: NavDef) {
  const { pathname } = useLocation();
  const p = pathname.replace(/\/$/, "") || "/";
  const t = to.replace(/\/$/, "") || "/";
  const active = end ? p === t : p === t || p.startsWith(`${t}/`);

  return (
    <div
      className={cn(
        "flex items-center rounded-lg border border-border/60 bg-background/80 shadow-sm",
        active ? "border-primary/40 bg-primary text-primary-foreground ring-1 ring-primary/25" : "hover:bg-muted/40"
      )}
    >
      <NavLink
        to={to}
        end={end}
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-1.5 text-[13px] font-medium",
          active ? "text-primary-foreground" : "text-muted-foreground"
        )}
      >
        <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
        {label}
      </NavLink>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "mr-0.5 rounded-md p-1",
              active
                ? "text-primary-foreground/80 hover:bg-white/15"
                : "text-muted-foreground/80 hover:bg-muted hover:text-foreground"
            )}
            aria-label={`O que é ${label}`}
          >
            <HelpCircle className="h-3 w-3" strokeWidth={2.25} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[220px] text-left text-xs leading-snug">
          {hint}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function RevendaShellNav() {
  return (
    <nav
      className="flex flex-wrap items-center gap-1.5"
      aria-label="Seções do painel da matriz"
    >
      {NAV_ITEMS.map((item) => (
        <NavEntry key={item.to} {...item} />
      ))}
    </nav>
  );
}
