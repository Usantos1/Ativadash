import { useState } from "react";
import { AtivaCrmIntegrationPanel } from "@/components/integrations/AtivaCrmIntegrationPanel";
import { IntegrationDetailHeader } from "@/components/integrations/detail/IntegrationDetailHeader";
import { IntegrationDetailPageShell } from "@/components/integrations/detail/IntegrationDetailPageShell";
import { cn } from "@/lib/utils";

export function WhatsAppIntegrationPage() {
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  return (
    <IntegrationDetailPageShell spacing="relaxed">
      <IntegrationDetailHeader
        backHref="/marketing/integracoes"
        logoSrc="/integrations/ativa-crm.png"
        logoAlt="Ativa CRM"
        logoAccent="ativa"
        title="Ativa CRM"
        subtitle="WhatsApp, token e alertas de marketing no ecossistema Ativa."
      />
      {toast ? (
        <div
          role="status"
          className={cn(
            "rounded-xl border px-4 py-3.5 text-sm font-medium shadow-sm",
            toast.type === "ok"
              ? "border-emerald-200/80 bg-emerald-50 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/35 dark:text-emerald-50"
              : "border-destructive/35 bg-destructive/10 text-destructive"
          )}
        >
          {toast.text}
        </div>
      ) : null}
      <AtivaCrmIntegrationPanel
        onNotify={(m) => setToast({ type: m.type === "success" ? "ok" : "err", text: m.text })}
      />
    </IntegrationDetailPageShell>
  );
}
