import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Plug } from "lucide-react";
import { Input } from "@/components/ui/input";
import { IntegrationCard } from "@/components/integrations/IntegrationCard";
import { EmptyState } from "@/components/ui/empty-state";
import {
  fetchIntegrations,
  getGoogleAdsAuthUrl,
  getMetaAdsAuthUrl,
  disconnectIntegration as disconnectApi,
  type IntegrationFromApi,
} from "@/lib/integrations-api";

export type IntegrationId =
  | "google-ads"
  | "meta"
  | "whatsapp"
  | "hotmart"
  | "kiwify"
  | "eduzz"
  | "braip"
  | "monetizze"
  | "hubla"
  | "ticto"
  | "guru"
  | "greenn"
  | "pagar-me"
  | "webhooks";

interface IntegrationDef {
  id: IntegrationId;
  name: string;
  slug: string;
  logoSrc?: string;
  available: boolean;
}

const INTEGRATION_DEFS: IntegrationDef[] = [
  { id: "google-ads", name: "Google Ads", slug: "google-ads", available: true },
  { id: "meta", name: "Meta Ads", slug: "meta", logoSrc: "/logos/meta.svg", available: true },
  { id: "whatsapp", name: "WhatsApp", slug: "whatsapp", available: false },
  { id: "hotmart", name: "Hotmart", slug: "hotmart", available: false },
  { id: "kiwify", name: "Kiwify", slug: "kiwify", available: false },
  { id: "eduzz", name: "Eduzz", slug: "eduzz", available: false },
  { id: "braip", name: "Braip", slug: "braip", available: false },
  { id: "monetizze", name: "Monetizze", slug: "monetizze", available: false },
  { id: "hubla", name: "Hubla", slug: "hubla", available: false },
  { id: "ticto", name: "Ticto", slug: "ticto", available: false },
  { id: "guru", name: "Guru", slug: "guru", available: false },
  { id: "greenn", name: "Greenn", slug: "greenn", available: false },
  { id: "pagar-me", name: "Pagar.me", slug: "pagar-me", available: false },
  { id: "webhooks", name: "Webhooks personalizados", slug: "webhooks", available: false },
];

function formatLastSync(iso: string | null): string | undefined {
  if (!iso) return undefined;
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    return sameDay ? `Hoje às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : d.toLocaleDateString("pt-BR");
  } catch {
    return undefined;
  }
}

export function Integrations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [list, setList] = useState<IntegrationFromApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchIntegrations();
        if (!cancelled) setList(data);
      } catch {
        if (!cancelled) setList([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected === "google-ads") {
      setMessage({ type: "success", text: "Google Ads conectado com sucesso." });
      setSearchParams((p) => {
        p.delete("connected");
        p.delete("error");
        return p;
      }, { replace: true });
      fetchIntegrations().then(setList);
    } else if (connected === "meta-ads") {
      setMessage({ type: "success", text: "Meta Ads conectado com sucesso." });
      setSearchParams((p) => {
        p.delete("connected");
        p.delete("error");
        return p;
      }, { replace: true });
      fetchIntegrations().then(setList);
    } else if (error) {
      const msg = error === "missing_code_or_state" ? "Autorização incompleta." : error === "invalid_state" ? "Sessão expirada. Tente conectar de novo." : error === "exchange_failed" ? "Falha ao conectar. Tente novamente." : "Erro ao conectar.";
      setMessage({ type: "error", text: msg });
      setSearchParams((p) => {
        p.delete("connected");
        p.delete("error");
        return p;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const connectedBySlug = new Map(list.filter((i) => i.status === "connected").map((i) => [i.slug, i]));

  const handleConnectGoogleAds = async () => {
    setConnecting(true);
    setMessage(null);
    try {
      const url = await getGoogleAdsAuthUrl();
      window.location.href = url;
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Não foi possível iniciar a conexão." });
      setConnecting(false);
    }
  };

  const handleConnectMetaAds = async () => {
    setConnecting(true);
    setMessage(null);
    try {
      const url = await getMetaAdsAuthUrl();
      window.location.href = url;
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Não foi possível iniciar a conexão." });
      setConnecting(false);
    }
  };

  const handleDisconnect = async (id: string) => {
    setMessage(null);
    try {
      await disconnectApi(id);
      setList((prev) => prev.filter((i) => i.id !== id));
      setMessage({ type: "success", text: "Integração desvinculada." });
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Erro ao desvincular." });
    }
  };

  const filtered = INTEGRATION_DEFS.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Integrações da sua Conta
          </h1>
          <p className="text-muted-foreground">
            Conecte plataformas para centralizar dados. Comece pelo Google Ads.
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar integração..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg pl-9"
          />
        </div>
      </div>

      {message && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="rounded-xl border border-border/80 bg-card p-6">
        {loading ? (
          <div className="flex justify-center py-12 text-muted-foreground">Carregando...</div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filtered.map((def) => {
                const connected = connectedBySlug.get(def.slug);
                const connectedId = connected?.id;
                const isConnectingGoogle = def.slug === "google-ads" && connecting;
                const isConnectingMeta = def.slug === "meta" && connecting;
                const connectingState = isConnectingGoogle || isConnectingMeta;
                const onConnect =
                  def.slug === "google-ads" && !connected && !connectingState
                    ? handleConnectGoogleAds
                    : def.slug === "meta" && !connected && !connectingState
                      ? handleConnectMetaAds
                      : undefined;
                return (
                  <IntegrationCard
                    key={def.id}
                    name={def.name}
                    logoSrc={def.logoSrc}
                    connected={!!connected}
                    lastSync={connected ? formatLastSync(connected.lastSyncAt) : undefined}
                    available={def.available}
                    connecting={connectingState}
                    onConnect={onConnect}
                    onDisconnect={connectedId ? () => handleDisconnect(connectedId) : undefined}
                    onConfigure={connectedId ? () => {} : undefined}
                  />
                );
              })}
            </div>
            {filtered.length === 0 && (
              <EmptyState
                icon={Plug}
                title="Nenhuma integração encontrada"
                description={`Nenhum resultado para "${search}".`}
                className="min-h-[200px]"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
