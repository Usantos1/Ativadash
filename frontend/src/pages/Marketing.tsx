import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, RefreshCw, Share2, Clock, Eye, MousePointer, DollarSign, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fetchIntegrations,
  fetchGoogleAdsMetrics,
  type GoogleAdsMetricsResponse,
} from "@/lib/integrations-api";

const periods = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
] as const;

function formatCost(micros: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(micros / 1_000_000);
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(n);
}

export function Marketing() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const [hasIntegrations, setHasIntegrations] = useState(false);
  const [metrics, setMetrics] = useState<GoogleAdsMetricsResponse | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchIntegrations()
      .then((list) => {
        if (!cancelled) setHasIntegrations(list.some((i) => i.status === "connected"));
      })
      .catch(() => {
        if (!cancelled) setHasIntegrations(false);
      });
    return () => { cancelled = true; };
  }, []);

  const loadMetrics = useCallback(async () => {
    if (!hasIntegrations) return;
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const data = await fetchGoogleAdsMetrics(period);
      setMetrics(data ?? null);
      if (!data) setMetricsError("Não foi possível carregar os dados. Verifique se o Developer Token do Google Ads está configurado no servidor.");
    } catch {
      setMetricsError("Erro ao buscar métricas.");
    } finally {
      setMetricsLoading(false);
    }
  }, [hasIntegrations, period]);

  useEffect(() => {
    if (hasIntegrations) loadMetrics();
    else setMetrics(null);
  }, [hasIntegrations, period, loadMetrics]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Marketing</h1>
        <p className="text-muted-foreground">
          Análise de resultado · Captação, conversão e receita
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Select value="none" disabled>
            <SelectTrigger className="w-[220px] rounded-lg">
              <SelectValue placeholder="Lançamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum lançamento</SelectItem>
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={(v) => setPeriod(v as "7d" | "30d" | "90d")}>
            <SelectTrigger className="w-[160px] rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periods.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasIntegrations ? (
            <>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Dados do Google Ads
              </span>
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg"
                disabled={metricsLoading}
                onClick={loadMetrics}
              >
                <RefreshCw className={`h-4 w-4 ${metricsLoading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Conecte uma integração para ver dados
            </span>
          )}
          <Button size="sm" className="rounded-lg bg-primary" disabled>
            <Share2 className="h-4 w-4" />
            Compartilhar
          </Button>
        </div>
      </div>

      {!hasIntegrations ? (
        <EmptyState
          icon={BarChart3}
          title="Nenhum dado de marketing ainda"
          description="Conecte o Google Ads (e outras plataformas depois) nas Integrações para começar a ver métricas de captação, conversão e receita aqui."
          actionLabel="Ir para Integrações"
          onAction={() => navigate("/marketing/integracoes")}
          className="min-h-[320px]"
        />
      ) : metricsLoading && !metrics ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-border/80 bg-card">
          <p className="text-muted-foreground">Carregando métricas do Google Ads...</p>
        </div>
      ) : metricsError && !metrics ? (
        <div className="rounded-xl border border-border/80 bg-card p-6">
          <p className="text-sm text-muted-foreground">{metricsError}</p>
          <Button variant="outline" size="sm" className="mt-3 rounded-lg" onClick={loadMetrics}>
            Tentar novamente
          </Button>
        </div>
      ) : metrics?.ok ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="rounded-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Impressões</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-semibold">{formatNumber(metrics.summary.impressions)}</span>
              </CardContent>
            </Card>
            <Card className="rounded-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Cliques</CardTitle>
                <MousePointer className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-semibold">{formatNumber(metrics.summary.clicks)}</span>
              </CardContent>
            </Card>
            <Card className="rounded-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Custo</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-semibold">{formatCost(metrics.summary.costMicros)}</span>
              </CardContent>
            </Card>
            <Card className="rounded-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Conversões</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-semibold">{formatNumber(metrics.summary.conversions)}</span>
              </CardContent>
            </Card>
          </div>
          {metrics.campaigns.length > 0 && (
            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle>Por campanha</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Métricas por campanha no período selecionado
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 font-medium">Campanha</th>
                        <th className="pb-2 font-medium text-right">Impressões</th>
                        <th className="pb-2 font-medium text-right">Cliques</th>
                        <th className="pb-2 font-medium text-right">Custo</th>
                        <th className="pb-2 font-medium text-right">Conversões</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.campaigns.map((row, i) => (
                        <tr key={i} className="border-b border-border/50 last:border-0">
                          <td className="py-2 font-medium">{row.campaignName || "—"}</td>
                          <td className="py-2 text-right">{formatNumber(row.impressions)}</td>
                          <td className="py-2 text-right">{formatNumber(row.clicks)}</td>
                          <td className="py-2 text-right">{formatCost(row.costMicros)}</td>
                          <td className="py-2 text-right">{formatNumber(row.conversions)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border/80 bg-card p-6">
          <p className="text-sm text-muted-foreground">
            Nenhum dado no período. Altere o período ou confira se o Developer Token está configurado.
          </p>
        </div>
      )}
    </div>
  );
}
