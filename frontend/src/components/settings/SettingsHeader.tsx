import { Building2 } from "lucide-react";
import { PageHeaderPremium } from "@/components/premium";

export function SettingsHeader({
  organizationName,
  organizationSlug,
}: {
  organizationName?: string;
  organizationSlug?: string;
}) {
  return (
    <PageHeaderPremium
      variant="dense"
      eyebrow="Conta"
      title="Configurações"
      subtitle="Conta, equipe, integrações e metas."
      meta={
        organizationName ? (
          <>
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <Building2 className="h-3.5 w-3.5 text-primary" aria-hidden />
              Ambiente ativo: {organizationName}
            </span>
            {organizationSlug ? (
              <span>
                Slug: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{organizationSlug}</code>
              </span>
            ) : null}
          </>
        ) : (
          <span>Carregando contexto da empresa…</span>
        )
      }
    />
  );
}
