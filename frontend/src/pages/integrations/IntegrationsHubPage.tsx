import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  flattenHubItems,
  INTEGRATION_HUB_SECTIONS,
  type IntegrationHubItem,
  type IntegrationHubStatusFilter,
} from "@/lib/integration-hub-registry";
import { isHubIntegrationConnected, isAtivaCrmHubItem } from "@/lib/integration-hub-status";
import { IntegrationSection } from "@/components/integrations/hub/IntegrationSection";
import { IntegrationCard } from "@/components/integrations/hub/IntegrationCard";
import type { IntegrationHubVisualStatus } from "@/components/integrations/hub/IntegrationStatusBadge";
import { IntegrationEmptyState } from "@/components/integrations/hub/IntegrationEmptyState";
import { IntegrationHubHeader } from "@/components/integrations/hub/IntegrationHubHeader";
import { AppMainRouteBody } from "@/components/layout/AppMainRouteBody";
import {
  fetchIntegrations,
  type AtivaCrmHubFromApi,
  type IntegrationFromApi,
} from "@/lib/integrations-api";
import { cn } from "@/lib/utils";

const EMPTY_ATIVA_CRM_HUB: AtivaCrmHubFromApi = {
  connected: false,
  tokenConfigured: false,
  notifyPhone: null,
  alertsEnabled: false,
};

function integrationRowForItem(list: IntegrationFromApi[], item: IntegrationHubItem): IntegrationFromApi | undefined {
  if (!item.apiSlug) return undefined;
  return list.find((i) => i.slug === item.apiSlug);
}

function itemMatchesQuery(item: IntegrationHubItem, q: string): boolean {
  if (!q) return true;
  const blob = [item.name, item.tagline, item.categoryLabel, item.searchText].filter(Boolean).join(" ").toLowerCase();
  return blob.includes(q);
}

function visualStatus(
  item: IntegrationHubItem,
  row: IntegrationFromApi | undefined,
  ativaCrmHub: AtivaCrmHubFromApi
): IntegrationHubVisualStatus {
  if (!item.available) return "soon";
  if (row?.status === "error") return "error";
  const connected = isHubIntegrationConnected(item, row, ativaCrmHub);
  if (!connected) return "disconnected";
  return "connected";
}

function detailHint(
  item: IntegrationHubItem,
  row: IntegrationFromApi | undefined,
  ativaCrmHub: AtivaCrmHubFromApi
): string | null {
  if (!item.available) return null;
  if (isAtivaCrmHubItem(item) && ativaCrmHub.connected) {
    if (ativaCrmHub.notifyPhone) return `WhatsApp: ${ativaCrmHub.notifyPhone}`;
    return "Configuração ativa";
  }
  if (item.apiSlug === "google-ads" && row?.status === "connected") {
    const email = row.googleUserEmail;
    if (email) return email;
    if ((row.googleAdsAccessibleCount ?? 0) > 0) return `${row.googleAdsAccessibleCount} contas acessíveis`;
  }
  if (item.apiSlug === "meta" && row?.status === "connected" && row.platform) return row.platform;
  return null;
}

function matchesFilter(
  filter: IntegrationHubStatusFilter,
  item: IntegrationHubItem,
  row: IntegrationFromApi | undefined,
  ativaCrmHub: AtivaCrmHubFromApi
): boolean {
  const connected = isHubIntegrationConnected(item, row, ativaCrmHub);
  switch (filter) {
    case "connected":
      return item.available && connected;
    case "available":
      return item.available && !connected;
    case "soon":
      return !item.available;
    default:
      return true;
  }
}

export function IntegrationsHubPage() {
  const location = useLocation();
  const [list, setList] = useState<IntegrationFromApi[]>([]);
  const [ativaCrmHub, setAtivaCrmHub] = useState<AtivaCrmHubFromApi>(EMPTY_ATIVA_CRM_HUB);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<IntegrationHubStatusFilter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchIntegrations();
      setList(res.integrations);
      setAtivaCrmHub(res.ativaCrmHub ?? EMPTY_ATIVA_CRM_HUB);
    } catch {
      setList([]);
      setAtivaCrmHub(EMPTY_ATIVA_CRM_HUB);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, location.key]);

  const allItems = useMemo(() => flattenHubItems(), []);

  const stats = useMemo(() => {
    let connected = 0;
    let available = 0;
    let soon = 0;
    for (const item of allItems) {
      const row = integrationRowForItem(list, item);
      const c = isHubIntegrationConnected(item, row, ativaCrmHub);
      if (!item.available) soon += 1;
      else if (c) connected += 1;
      else available += 1;
    }
    return [
      { label: "Conectadas", value: connected, tone: "emerald" as const },
      { label: "Disponíveis", value: available, tone: "slate" as const },
      { label: "Em breve", value: soon, tone: "amber" as const },
    ];
  }, [list, allItems, ativaCrmHub]);

  const filteredSections = useMemo(() => {
    const q = search.trim().toLowerCase();
    return INTEGRATION_HUB_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!itemMatchesQuery(item, q)) return false;
        const row = integrationRowForItem(list, item);
        return matchesFilter(filter, item, row, ativaCrmHub);
      }),
    })).filter((s) => s.items.length > 0);
  }, [list, search, filter, ativaCrmHub]);

  const totalVisible = filteredSections.reduce((n, s) => n + s.items.length, 0);

  const filterBtn = (id: IntegrationHubStatusFilter, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setFilter(id)}
      className={cn(
        "rounded-full px-3.5 py-2 text-xs font-semibold transition-all",
        filter === id
          ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
          : "bg-background/90 text-muted-foreground ring-1 ring-border/70 hover:bg-muted/70"
      )}
    >
      {label}
    </button>
  );

  const toolbar = (
    <div className="flex w-full flex-col gap-3">
      <div className="relative w-full">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar integração…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-11 rounded-xl border-border/70 bg-background/95 pl-10 shadow-sm"
          aria-label="Buscar integração"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {filterBtn("all", "Todas")}
        {filterBtn("connected", "Conectadas")}
        {filterBtn("available", "Disponíveis")}
        {filterBtn("soon", "Em breve")}
      </div>
    </div>
  );

  return (
    <AppMainRouteBody className="space-y-10 pb-14">
      <IntegrationHubHeader
        title="Integrações"
        subtitle="Conecte mídia paga, automações, checkout e o Ativa CRM em um só lugar."
        toolbar={toolbar}
        stats={stats}
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="min-h-[188px] rounded-2xl" />
          ))}
        </div>
      ) : totalVisible === 0 ? (
        <IntegrationEmptyState query={search} />
      ) : (
        <div className="space-y-16">
          {filteredSections.map((section) => (
            <IntegrationSection
              key={section.title}
              title={section.title}
              description={section.description}
              anchorId={section.category === "checkout" ? "integracoes-checkout" : undefined}
            >
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {section.items.map((item) => {
                  const row = integrationRowForItem(list, item);
                  return (
                    <IntegrationCard
                      key={item.id}
                      item={item}
                      status={visualStatus(item, row, ativaCrmHub)}
                      detailHint={detailHint(item, row, ativaCrmHub)}
                    />
                  );
                })}
              </div>
            </IntegrationSection>
          ))}
        </div>
      )}
    </AppMainRouteBody>
  );
}
