/**
 * Catálogo único do hub de integrações (rotas, categorias, disponibilidade).
 * Rotas: /marketing/integracoes/:routeSlug
 */
export type IntegrationHubCategory = "media" | "automation" | "checkout";

export type IntegrationHubStatusFilter = "all" | "connected" | "available" | "soon";

export type IntegrationHubItem = {
  id: string;
  name: string;
  routeSlug: string;
  category: IntegrationHubCategory;
  /** Rótulo curto exibido no card (categoria) */
  categoryLabel: string;
  /** Slug na API quando conectado (google-ads, meta) */
  apiSlug?: string;
  available: boolean;
  logoSrc: string;
  tagline: string;
  /** Texto extra para busca (ex.: whatsapp) */
  searchText?: string;
};

export type IntegrationHubSectionDef = {
  title: string;
  description?: string;
  category: IntegrationHubCategory;
  items: IntegrationHubItem[];
};

export const INTEGRATION_HUB_SECTIONS: IntegrationHubSectionDef[] = [
  {
    title: "Mídia e anúncios",
    description: "Google, Meta e TikTok — campanhas e contas.",
    category: "media",
    items: [
      {
        id: "google-ads",
        name: "Google Ads",
        routeSlug: "google-ads",
        category: "media",
        categoryLabel: "Mídia paga",
        apiSlug: "google-ads",
        available: true,
        logoSrc: "/integrations/google-ads.svg",
        tagline: "Campanhas, contas e métricas da rede de pesquisa e display.",
      },
      {
        id: "meta",
        name: "Meta Ads",
        routeSlug: "meta-ads",
        category: "media",
        categoryLabel: "Mídia paga",
        apiSlug: "meta",
        available: true,
        logoSrc: "/integrations/meta.svg",
        tagline: "Facebook e Instagram — Business Manager e contas de anúncio.",
      },
      {
        id: "tiktok-ads",
        name: "TikTok Ads",
        routeSlug: "tiktok-ads",
        category: "media",
        categoryLabel: "Mídia paga",
        available: false,
        logoSrc: "/integrations/tiktok-ads.svg",
        tagline: "Anúncios no TikTok e métricas de campanha.",
      },
    ],
  },
  {
    title: "Automação e integrações",
    description: "Webhooks, API e atendimento no Ativa CRM.",
    category: "automation",
    items: [
      {
        id: "webhook",
        name: "Webhooks",
        routeSlug: "webhook",
        category: "automation",
        categoryLabel: "Automação",
        available: true,
        logoSrc: "/integrations/webhook.svg",
        tagline: "Receba eventos HTTP e integre com fluxos externos.",
      },
      {
        id: "api",
        name: "API",
        routeSlug: "api",
        category: "automation",
        categoryLabel: "Automação",
        available: false,
        logoSrc: "/integrations/api.png",
        tagline: "Integração via requisições externas e endpoints REST.",
      },
      {
        id: "ativa-crm",
        name: "Ativa CRM",
        routeSlug: "ativa-crm",
        category: "automation",
        categoryLabel: "CRM",
        available: true,
        logoSrc: "/integrations/ativa-crm.png",
        tagline: "WhatsApp, inbox e relacionamento com leads e clientes.",
        searchText: "whatsapp mensagem chat",
      },
    ],
  },
  {
    title: "Pagamentos e checkout",
    description: "Checkout e plataformas de venda — disponível em breve.",
    category: "checkout",
    items: [
      {
        id: "hotmart",
        name: "Hotmart",
        routeSlug: "hotmart",
        category: "checkout",
        categoryLabel: "Checkout",
        available: false,
        logoSrc: "/integrations/hotmart.svg",
        tagline: "Vendas, afiliados e eventos de checkout.",
      },
      {
        id: "kiwify",
        name: "Kiwify",
        routeSlug: "kiwify",
        category: "checkout",
        categoryLabel: "Checkout",
        available: false,
        logoSrc: "/integrations/kiwify.png",
        tagline: "Produtos digitais e assinaturas.",
      },
      {
        id: "eduzz",
        name: "Eduzz",
        routeSlug: "eduzz",
        category: "checkout",
        categoryLabel: "Checkout",
        available: false,
        logoSrc: "/integrations/eduzz.png",
        tagline: "Infoprodutos e monetização.",
      },
      {
        id: "braip",
        name: "Braip",
        routeSlug: "braip",
        category: "checkout",
        categoryLabel: "Checkout",
        available: false,
        logoSrc: "/integrations/braip.png",
        tagline: "Vendas, co-produção e afiliados.",
      },
      {
        id: "greenn",
        name: "Greenn",
        routeSlug: "greenn",
        category: "checkout",
        categoryLabel: "Checkout",
        available: false,
        logoSrc: "/integrations/greenn.png",
        tagline: "Marketplace e checkout de produtos.",
      },
    ],
  },
];

export function flattenHubItems(): IntegrationHubItem[] {
  return INTEGRATION_HUB_SECTIONS.flatMap((s) => s.items);
}

export function hubItemByRouteSlug(slug: string): IntegrationHubItem | undefined {
  return flattenHubItems().find((i) => i.routeSlug === slug);
}
