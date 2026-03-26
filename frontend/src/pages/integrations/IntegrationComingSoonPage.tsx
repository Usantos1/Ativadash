import { useParams } from "react-router-dom";
import { IntegrationDetailHeader } from "@/components/integrations/detail/IntegrationDetailHeader";
import { IntegrationDetailPageShell } from "@/components/integrations/detail/IntegrationDetailPageShell";
import { IntegrationConfigCard } from "@/components/integrations/detail/IntegrationConfigCard";
import { IntegrationStatusBadge } from "@/components/integrations/hub/IntegrationStatusBadge";
import { hubItemByRouteSlug } from "@/lib/integration-hub-registry";

export function IntegrationComingSoonPage() {
  const { slug } = useParams<{ slug: string }>();
  const item = slug ? hubItemByRouteSlug(slug) : undefined;
  const title = item?.name ?? "Integração";
  const logoSrc = item?.logoSrc ?? "/integrations/webhook.svg";
  const tagline = item?.tagline ?? "Integração";

  return (
    <IntegrationDetailPageShell variant="muted" spacing="relaxed">
      <IntegrationDetailHeader
        backHref="/marketing/integracoes"
        logoSrc={logoSrc}
        logoAlt={title}
        logoAccent="none"
        title={title}
        subtitle={tagline}
        badge={<IntegrationStatusBadge status="soon" />}
      />
      <IntegrationConfigCard title="Disponível em breve" description="Estamos finalizando esta integração.">
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Volte ao hub para conectar outros canais ou acompanhe novidades nas próximas versões.
        </p>
      </IntegrationConfigCard>
    </IntegrationDetailPageShell>
  );
}
