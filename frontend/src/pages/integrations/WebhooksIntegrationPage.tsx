import { useState } from "react";
import { IntegrationDetailHeader } from "@/components/integrations/detail/IntegrationDetailHeader";
import { IntegrationDetailPageShell } from "@/components/integrations/detail/IntegrationDetailPageShell";
import { WebhooksIntegrationPanel } from "@/components/integrations/WebhooksIntegrationPanel";
import { hubItemByRouteSlug } from "@/lib/integration-hub-registry";
import { formatPageTitle, usePageTitle } from "@/hooks/usePageTitle";
import { cn } from "@/lib/utils";

const webhookHub = hubItemByRouteSlug("webhook");

export function WebhooksIntegrationPage() {
  usePageTitle(formatPageTitle(["Integrações", "Webhooks"]));
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  return (
    <IntegrationDetailPageShell spacing="relaxed">
      <IntegrationDetailHeader
        backHref="/marketing/integracoes"
        logoSrc={webhookHub?.logoSrc ?? "/integrations/webhook.svg"}
        logoAlt={webhookHub?.name ?? "Webhooks"}
        logoAccent="slate"
        title={webhookHub?.name ?? "Webhooks"}
        subtitle={webhookHub?.tagline ?? "Endpoints HTTP assinados e eventos recebidos."}
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

      <WebhooksIntegrationPanel
        onNotify={(m) => setToast({ type: m.type === "success" ? "ok" : "err", text: m.text })}
      />
    </IntegrationDetailPageShell>
  );
}
