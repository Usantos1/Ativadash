import { useState, type MouseEvent as ReactMouseEvent } from "react";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { IntegrationLogo, type IntegrationLogoAccent } from "./IntegrationLogo";
import { IntegrationStatusBadge, type IntegrationHubVisualStatus } from "./IntegrationStatusBadge";
import type { IntegrationHubItem } from "@/lib/integration-hub-registry";

const INTEREST_KEY = "ativadash:integration-interest-ids";

function readInterestIds(): Set<string> {
  try {
    const raw = localStorage.getItem(INTEREST_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function persistInterestIds(ids: Set<string>) {
  try {
    localStorage.setItem(INTEREST_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

type Props = {
  item: IntegrationHubItem;
  status: IntegrationHubVisualStatus;
  detailHint?: string | null;
};

function logoAccent(id: string): IntegrationLogoAccent {
  const map: Record<string, IntegrationLogoAccent> = {
    "google-ads": "google",
    meta: "meta",
    "tiktok-ads": "tiktok",
    webhook: "slate",
    api: "indigo",
    "ativa-crm": "ativa",
    hotmart: "hotmart",
    kiwify: "kiwify",
    eduzz: "eduzz",
    braip: "braip",
    greenn: "greenn",
  };
  return map[id] ?? "none";
}

const statusBar: Record<IntegrationHubVisualStatus, string> = {
  connected: "from-emerald-500 via-emerald-400/90 to-emerald-300/50",
  disconnected: "from-slate-400 via-slate-300/80 to-transparent",
  soon: "from-amber-500 via-amber-400/90 to-amber-200/40",
  error: "from-red-500 via-red-400/90 to-red-300/40",
};

/** Brilho de fundo sutil por marca */
const brandWash: Record<string, string> = {
  "google-ads": "from-blue-500/[0.07] via-transparent to-transparent",
  meta: "from-[#0866FF]/[0.08] via-transparent to-transparent",
  "tiktok-ads": "from-cyan-500/[0.06] via-transparent to-fuchsia-500/[0.05]",
  webhook: "from-sky-500/[0.06] via-transparent to-indigo-500/[0.05]",
  api: "from-indigo-500/[0.08] via-transparent to-transparent",
  "ativa-crm": "from-[hsl(252,56%,42%)]/10 via-transparent to-transparent",
  hotmart: "from-[#F04E23]/[0.08] via-transparent to-transparent",
  kiwify: "from-green-600/[0.1] via-transparent to-transparent",
  eduzz: "from-slate-900/[0.08] via-transparent to-amber-400/[0.06]",
  braip: "from-sky-400/[0.08] via-transparent to-transparent",
  greenn: "from-green-500/[0.08] via-transparent to-transparent",
};

export function IntegrationCard({ item, status, detailHint }: Props) {
  const navigate = useNavigate();
  const to = `/marketing/integracoes/${item.routeSlug}`;
  const [interested, setInterested] = useState(() => readInterestIds().has(item.id));

  function go() {
    navigate(to);
  }

  function registerInterest(e: ReactMouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    const next = readInterestIds();
    next.add(item.id);
    persistInterestIds(next);
    setInterested(true);
  }

  const cta =
    status === "soon"
      ? "Em breve"
      : status === "connected"
        ? "Configurar"
        : item.available
          ? "Conectar"
          : "Ver detalhes";

  const wash = brandWash[item.id] ?? "from-primary/[0.04] via-transparent to-transparent";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={go}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go();
        }
      }}
      className={cn(
        "group relative flex w-full min-h-[188px] overflow-hidden rounded-2xl border border-border/70 bg-card text-left",
        "shadow-[0_1px_0_rgba(0,0,0,0.05),0_12px_32px_-16px_rgba(0,0,0,0.18)]",
        "transition-all duration-200 hover:-translate-y-1 hover:border-primary/25 hover:shadow-[0_1px_0_rgba(0,0,0,0.04),0_20px_48px_-20px_rgba(0,0,0,0.22)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "cursor-pointer"
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-100",
          wash
        )}
        aria-hidden
      />
      <div
        className={cn(
          "absolute left-0 top-0 h-full w-[3px] bg-gradient-to-b opacity-95 shadow-[2px_0_12px_-2px_rgba(0,0,0,0.15)]",
          statusBar[status]
        )}
        aria-hidden
      />
      <div className="relative flex w-full flex-col gap-5 p-5 sm:min-h-[188px] sm:flex-row sm:items-stretch sm:gap-6 sm:p-6">
        <IntegrationLogo
          src={item.logoSrc}
          alt={item.name}
          size="md"
          accent={logoAccent(item.id)}
          className="sm:self-center sm:scale-105"
        />

        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <h3 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">{item.name}</h3>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {item.categoryLabel}
          </p>
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{item.tagline}</p>
          {detailHint ? (
            <p className="mt-2 truncate text-xs font-semibold text-primary" title={detailHint}>
              {detailHint}
            </p>
          ) : null}
        </div>

        <div
          className="flex shrink-0 flex-col justify-center gap-3 border-t border-border/50 pt-4 sm:w-[168px] sm:border-0 sm:border-l sm:border-border/50 sm:pl-6 sm:pt-0"
          onClick={(e) => e.stopPropagation()}
        >
          <IntegrationStatusBadge status={status} className="w-fit" />
          {status === "soon" ? (
            <div className="flex w-full flex-col gap-2">
              <span
                className={cn(
                  "inline-flex min-h-[36px] w-full items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold",
                  "bg-amber-500/15 text-amber-950 ring-1 ring-amber-500/25 dark:text-amber-100"
                )}
              >
                {cta}
                <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-9 rounded-xl text-xs font-semibold"
                disabled={interested}
                onClick={registerInterest}
              >
                {interested ? "Interesse registrado" : "Tenho interesse"}
              </Button>
              <p className="text-[10px] leading-snug text-muted-foreground">
                Ajuda a priorizar as próximas integrações do seu workspace.
              </p>
            </div>
          ) : (
            <span
              className={cn(
                "inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors",
                "bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90"
              )}
              onClick={(e) => {
                e.stopPropagation();
                go();
              }}
            >
              {cta}
              <ArrowUpRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** @deprecated use IntegrationCard */
export const IntegrationHubCard = IntegrationCard;
