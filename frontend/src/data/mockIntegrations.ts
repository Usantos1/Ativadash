export interface IntegrationItem {
  id: string;
  name: string;
  slug: string;
  connected: boolean;
  lastSync?: string;
}

export const mockIntegrations: IntegrationItem[] = [
  { id: "meta", name: "Meta", slug: "meta", connected: true, lastSync: "Hoje às 14:32" },
  { id: "google", name: "Google Ads", slug: "google", connected: true, lastSync: "Hoje às 14:30" },
  { id: "whatsapp", name: "WhatsApp", slug: "whatsapp", connected: false },
  { id: "hotmart", name: "Hotmart", slug: "hotmart", connected: false },
  { id: "kiwify", name: "Kiwify", slug: "kiwify", connected: false },
  { id: "eduzz", name: "Eduzz", slug: "eduzz", connected: false },
  { id: "braip", name: "Braip", slug: "braip", connected: false },
  { id: "monetizze", name: "Monetizze", slug: "monetizze", connected: false },
  { id: "hubla", name: "Hubla", slug: "hubla", connected: false },
  { id: "ticto", name: "Ticto", slug: "ticto", connected: false },
  { id: "guru", name: "Guru", slug: "guru", connected: false },
  { id: "greenn", name: "Greenn", slug: "greenn", connected: false },
  { id: "pagar-me", name: "Pagar.me", slug: "pagar-me", connected: false },
  { id: "webhooks", name: "Webhooks personalizados", slug: "webhooks", connected: false },
];
