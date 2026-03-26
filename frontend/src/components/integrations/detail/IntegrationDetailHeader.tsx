import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IntegrationLogo, type IntegrationLogoAccent } from "@/components/integrations/hub/IntegrationLogo";
import { cn } from "@/lib/utils";

type Props = {
  backHref: string;
  backLabel?: string;
  logoSrc: string;
  logoAlt: string;
  logoAccent?: IntegrationLogoAccent;
  title: string;
  subtitle: string;
  badge?: ReactNode;
  actions?: ReactNode;
};

export function IntegrationDetailHeader({
  backHref,
  backLabel = "Integrações",
  logoSrc,
  logoAlt,
  logoAccent = "none",
  title,
  subtitle,
  badge,
  actions,
}: Props) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.05] shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
      <div className="pointer-events-none absolute -right-20 top-0 h-56 w-56 rounded-full bg-primary/[0.08] blur-3xl" aria-hidden />
      <div className="relative p-5 sm:p-8">
        <Button variant="ghost" size="sm" className="mb-4 gap-1.5 px-0 text-muted-foreground hover:text-foreground" asChild>
          <Link to={backHref}>
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
        </Button>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start">
            <IntegrationLogo src={logoSrc} alt={logoAlt} size="lg" accent={logoAccent} className="shadow-md" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
                {badge ?? null}
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">{subtitle}</p>
            </div>
          </div>
          {actions ? (
            <div className={cn("flex flex-shrink-0 flex-wrap gap-2 lg:justify-end")}>{actions}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
