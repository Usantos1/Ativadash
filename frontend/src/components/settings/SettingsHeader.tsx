import type { ReactNode } from "react";
import { PageHeaderPremium } from "@/components/premium";

export function SettingsHeader({
  organizationName,
  organizationSlug,
  actions,
}: {
  organizationName?: string;
  organizationSlug?: string;
  actions?: ReactNode;
}) {
  return (
    <PageHeaderPremium
      variant="dense"
      eyebrow="Configurações"
      title="Conta e serviços"
      subtitle="Estado do workspace, quotas, ligações a canais e ajustes de sessão. Editar dados da empresa e metas nas respetivas páginas."
      meta={
        organizationName ? (
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{organizationName}</span>
            {organizationSlug ? (
              <>
                {" · "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-foreground">{organizationSlug}</code>
              </>
            ) : null}
          </span>
        ) : (
          <span className="text-muted-foreground">A carregar…</span>
        )
      }
      actions={actions}
    />
  );
}
