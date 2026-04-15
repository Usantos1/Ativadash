import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Bell, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IntegrationDetailHeader } from "@/components/integrations/detail/IntegrationDetailHeader";
import { IntegrationDetailPageShell } from "@/components/integrations/detail/IntegrationDetailPageShell";
import { IntegrationConfigCard } from "@/components/integrations/detail/IntegrationConfigCard";
import { IntegrationStatusBadge } from "@/components/integrations/hub/IntegrationStatusBadge";
import { hubItemByRouteSlug, INTEGRATION_HUB_SECTIONS } from "@/lib/integration-hub-registry";
import { formatPageTitle, usePageTitle } from "@/hooks/usePageTitle";

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
  } catch {}
}

const EXPECTED_FEATURES: Record<string, string[]> = {
  "tiktok-ads": [
    "Conexão OAuth com TikTok Business Center",
    "Importação automática de campanhas e métricas",
    "CPL, CPA, ROAS e CTR no painel unificado",
    "Regras de automação (pausar, escalar, notificar)",
  ],
  api: [
    "Endpoints REST para leitura de métricas",
    "Webhooks de saída para eventos do motor",
    "Autenticação via API Key por workspace",
    "Documentação interativa (Swagger/OpenAPI)",
  ],
  hotmart: [
    "Webhook de vendas e reembolsos",
    "Receita automática no dashboard e ROAS real",
    "Funil de conversão com dados de checkout",
    "Suporte a co-produção e afiliados",
  ],
  kiwify: [
    "Integração via webhook de transações",
    "Receita e assinaturas no dashboard",
    "ROAS real por campanha de origem",
  ],
  eduzz: [
    "Webhook de vendas e comissões",
    "Receita de infoprodutos no dashboard",
    "Métricas de conversão unificadas",
  ],
  braip: [
    "Webhook de vendas e afiliados",
    "Receita integrada ao funil de conversão",
    "ROAS real por canal de aquisição",
  ],
  greenn: [
    "Webhook de checkout e pagamentos",
    "Receita e transações no dashboard",
    "Funil unificado com dados de venda",
  ],
};

export function IntegrationComingSoonPage() {
  const { slug } = useParams<{ slug: string }>();
  const item = slug ? hubItemByRouteSlug(slug) : undefined;
  const title = item?.name ?? "Integração";
  const logoSrc = item?.logoSrc ?? "/integrations/webhook.svg";
  const tagline = item?.tagline ?? "Integração";
  usePageTitle(formatPageTitle(["Integrações", title]));

  const [interested, setInterested] = useState(() => item ? readInterestIds().has(item.id) : false);
  const features = item ? EXPECTED_FEATURES[item.id] ?? [] : [];

  const availableIntegrations = INTEGRATION_HUB_SECTIONS
    .flatMap((s) => s.items)
    .filter((i) => i.available && i.id !== item?.id)
    .slice(0, 3);

  function registerInterest() {
    if (!item) return;
    const next = readInterestIds();
    next.add(item.id);
    persistInterestIds(next);
    setInterested(true);
  }

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

      <IntegrationConfigCard title="Em desenvolvimento" description="Esta integração está sendo construída e será lançada em breve.">
        <div className="space-y-6">
          {features.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">Funcionalidades esperadas:</p>
              <ul className="space-y-2">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary/60" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-3 rounded-xl border border-primary/15 bg-gradient-to-br from-primary/[0.04] to-transparent p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <p className="font-semibold text-foreground">Quer ser notificado quando lançar?</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Registre seu interesse para priorizarmos o desenvolvimento desta integração no seu workspace.
            </p>
            <Button
              type="button"
              variant={interested ? "outline" : "default"}
              className="w-fit rounded-xl"
              disabled={interested}
              onClick={registerInterest}
            >
              {interested ? (
                <>
                  <Bell className="mr-2 h-4 w-4" />
                  Interesse registrado
                </>
              ) : (
                <>
                  <Bell className="mr-2 h-4 w-4" />
                  Tenho interesse
                </>
              )}
            </Button>
          </div>
        </div>
      </IntegrationConfigCard>

      {availableIntegrations.length > 0 && (
        <IntegrationConfigCard title="Integrações disponíveis" description="Enquanto isso, conecte os canais já disponíveis.">
          <div className="grid gap-3 sm:grid-cols-3">
            {availableIntegrations.map((ai) => (
              <Link
                key={ai.id}
                to={`/marketing/integracoes/${ai.routeSlug}`}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/80 p-4 transition-colors hover:border-primary/30 hover:bg-muted/30"
              >
                <img src={ai.logoSrc} alt={ai.name} className="h-8 w-8 rounded-lg object-contain" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{ai.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{ai.categoryLabel}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </IntegrationConfigCard>
      )}
    </IntegrationDetailPageShell>
  );
}
