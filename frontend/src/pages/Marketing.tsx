import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, RefreshCw, Share2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { fetchIntegrations } from "@/lib/integrations-api";

const periods = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
];

export function Marketing() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState("30d");
  const [hasIntegrations, setHasIntegrations] = useState(false);

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
          <Select value={period} onValueChange={setPeriod}>
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
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Conecte uma integração para ver dados
          </span>
          <Button variant="outline" size="sm" className="rounded-lg" disabled>
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
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
      ) : (
        <div className="rounded-xl border border-border/80 bg-card p-6">
          <p className="text-sm text-muted-foreground">
            Área de métricas — será preenchida quando houver integrações conectadas.
          </p>
        </div>
      )}
    </div>
  );
}
