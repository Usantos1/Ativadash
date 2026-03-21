import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Bell, Loader2, Save, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalyticsPageHeader } from "@/components/analytics/AnalyticsPageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchMarketingSettings,
  saveMarketingSettings,
  type MarketingSettingsDto,
} from "@/lib/marketing-settings-api";

function dtoToForm(s: MarketingSettingsDto) {
  return {
    targetCpaBrl: s.targetCpaBrl != null ? String(s.targetCpaBrl) : "",
    maxCpaBrl: s.maxCpaBrl != null ? String(s.maxCpaBrl) : "",
    targetRoas: s.targetRoas != null ? String(s.targetRoas) : "",
    minResultsForCpa: String(s.minResultsForCpa),
    minSpendForAlertsBrl: s.minSpendForAlertsBrl != null ? String(s.minSpendForAlertsBrl) : "",
    alertsEnabled: s.alertsEnabled,
    alertCpaAboveMax: s.alertCpaAboveMax,
    alertCpaAboveTarget: s.alertCpaAboveTarget,
    alertRoasBelowTarget: s.alertRoasBelowTarget,
  };
}

function parseOptionalMoney(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) throw new Error("Valor monetário inválido");
  if (n === 0) return null;
  return n;
}

function parseRequiredInt(raw: string, label: string): number {
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n < 1 || n > 500) throw new Error(`${label} deve ser entre 1 e 500`);
  return n;
}

export function MarketingSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const [targetCpaBrl, setTargetCpaBrl] = useState("");
  const [maxCpaBrl, setMaxCpaBrl] = useState("");
  const [targetRoas, setTargetRoas] = useState("");
  const [minResultsForCpa, setMinResultsForCpa] = useState("5");
  const [minSpendForAlertsBrl, setMinSpendForAlertsBrl] = useState("");
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [alertCpaAboveMax, setAlertCpaAboveMax] = useState(true);
  const [alertCpaAboveTarget, setAlertCpaAboveTarget] = useState(true);
  const [alertRoasBelowTarget, setAlertRoasBelowTarget] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchMarketingSettings()
      .then((s) => {
        if (cancelled) return;
        const f = dtoToForm(s);
        setTargetCpaBrl(f.targetCpaBrl);
        setMaxCpaBrl(f.maxCpaBrl);
        setTargetRoas(f.targetRoas);
        setMinResultsForCpa(f.minResultsForCpa);
        setMinSpendForAlertsBrl(f.minSpendForAlertsBrl);
        setAlertsEnabled(f.alertsEnabled);
        setAlertCpaAboveMax(f.alertCpaAboveMax);
        setAlertCpaAboveTarget(f.alertCpaAboveTarget);
        setAlertRoasBelowTarget(f.alertRoasBelowTarget);
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível carregar as configurações.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavedMsg(null);
    setError(null);
    let target: number | null;
    let max: number | null;
    let roas: number | null;
    let minSpend: number | null;
    let minRes: number;
    try {
      target = parseOptionalMoney(targetCpaBrl);
      max = parseOptionalMoney(maxCpaBrl);
      roas = parseOptionalMoney(targetRoas);
      minSpend = parseOptionalMoney(minSpendForAlertsBrl);
      minRes = parseRequiredInt(minResultsForCpa, "Mínimo de resultados");
      if (target != null && max != null && target > max) {
        setError("CPA alvo deve ser menor ou igual ao CPA máximo.");
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verifique os valores informados.");
      return;
    }

    setSaving(true);
    try {
      await saveMarketingSettings({
        targetCpaBrl: target,
        maxCpaBrl: max,
        targetRoas: roas,
        minResultsForCpa: minRes,
        minSpendForAlertsBrl: minSpend,
        alertsEnabled,
        alertCpaAboveMax,
        alertCpaAboveTarget,
        alertRoasBelowTarget,
      });
      setSavedMsg("Configurações salvas.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2 gap-1 text-muted-foreground" asChild>
        <Link to="/marketing">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Marketing
        </Link>
      </Button>
      <AnalyticsPageHeader
        title="Configurações de Marketing"
        subtitle="Metas de performance, sensibilidade dos alertas e critérios mínimos para avaliar CPA e ROAS. Os avisos aparecem no Dashboard e nas telas de Marketing."
        meta={
          <span>
            WhatsApp: configure em{" "}
            <Link to="/marketing/integracoes" className="font-medium text-primary underline-offset-4 hover:underline">
              Integrações → WhatsApp (CRM)
            </Link>
            .
          </span>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {savedMsg && (
          <div className="rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
            {savedMsg}
          </div>
        )}

        <Card className="rounded-xl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Metas de performance</CardTitle>
            </div>
            <CardDescription>
              O CPA é calculado como investimento ÷ resultados (conversões Google + leads + vendas Meta). ROAS =
              valor atribuído ÷ investimento.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="targetCpa">CPA alvo (R$)</Label>
              <Input
                id="targetCpa"
                inputMode="decimal"
                placeholder="Ex.: 45"
                value={targetCpaBrl}
                onChange={(e) => setTargetCpaBrl(e.target.value)}
                className="rounded-lg"
              />
              <p className="text-xs text-muted-foreground">Meta ideal por resultado.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxCpa">CPA máximo (R$)</Label>
              <Input
                id="maxCpa"
                inputMode="decimal"
                placeholder="Ex.: 80"
                value={maxCpaBrl}
                onChange={(e) => setMaxCpaBrl(e.target.value)}
                className="rounded-lg"
              />
              <p className="text-xs text-muted-foreground">Teto crítico — alerta prioritário.</p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="targetRoas">ROAS mínimo desejado (vezes)</Label>
              <Input
                id="targetRoas"
                inputMode="decimal"
                placeholder="Ex.: 3"
                value={targetRoas}
                onChange={(e) => setTargetRoas(e.target.value)}
                className="rounded-lg max-w-xs"
              />
              <p className="text-xs text-muted-foreground">
                Ex.: 3 = cada R$ 1 investido deve gerar R$ 3 em valor atribuído (Google + Meta).
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Alertas e sensibilidade</CardTitle>
            </div>
            <CardDescription>
              Os alertas aparecem no Dashboard e nas páginas de Marketing quando os dados do período estiverem
              disponíveis. Para receber os mesmos avisos no WhatsApp (Ativa CRM), configure em{" "}
              <Link to="/marketing/integracoes" className="font-medium text-primary underline-offset-4 hover:underline">
                Integrações → WhatsApp (CRM)
              </Link>
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/80 bg-muted/20 p-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-border"
                checked={alertsEnabled}
                onChange={(e) => setAlertsEnabled(e.target.checked)}
              />
              <span>
                <span className="font-medium text-foreground">Ativar alertas de performance</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  Desligue para ocultar todos os avisos baseados em metas.
                </span>
              </span>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/80 p-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-border"
                  checked={alertCpaAboveMax}
                  onChange={(e) => setAlertCpaAboveMax(e.target.checked)}
                  disabled={!alertsEnabled}
                />
                <span className="text-sm">
                  <span className="font-medium">CPA acima do máximo</span>
                  <span className="mt-0.5 block text-muted-foreground">Alerta crítico</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/80 p-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-border"
                  checked={alertCpaAboveTarget}
                  onChange={(e) => setAlertCpaAboveTarget(e.target.checked)}
                  disabled={!alertsEnabled}
                />
                <span className="text-sm">
                  <span className="font-medium">CPA acima da meta</span>
                  <span className="mt-0.5 block text-muted-foreground">Alerta de atenção</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/80 p-3 sm:col-span-2">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-border"
                  checked={alertRoasBelowTarget}
                  onChange={(e) => setAlertRoasBelowTarget(e.target.checked)}
                  disabled={!alertsEnabled}
                />
                <span className="text-sm">
                  <span className="font-medium">ROAS abaixo da meta</span>
                  <span className="mt-0.5 block text-muted-foreground">Quando houver valor atribuído e investimento</span>
                </span>
              </label>
            </div>

            <div className="grid gap-4 border-t border-border/60 pt-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="minRes">Mínimo de resultados para avaliar CPA</Label>
                <Input
                  id="minRes"
                  inputMode="numeric"
                  value={minResultsForCpa}
                  onChange={(e) => setMinResultsForCpa(e.target.value)}
                  className="rounded-lg"
                />
                <p className="text-xs text-muted-foreground">Evita alertas com amostra pequena.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="minSpend">Gasto mínimo no período (R$)</Label>
                <Input
                  id="minSpend"
                  inputMode="decimal"
                  placeholder="Opcional"
                  value={minSpendForAlertsBrl}
                  onChange={(e) => setMinSpendForAlertsBrl(e.target.value)}
                  className="rounded-lg"
                />
                <p className="text-xs text-muted-foreground">Só avalia CPA/ROAS se o gasto atingir este valor.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" className="rounded-lg" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando…
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salvar
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
