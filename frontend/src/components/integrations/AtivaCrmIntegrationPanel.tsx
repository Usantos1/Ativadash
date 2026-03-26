import { useState, useEffect } from "react";
import { Loader2, MessageCircle, AlertTriangle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  dispatchMarketingSettingsRefresh,
  fetchMarketingSettings,
  saveMarketingSettings,
  sendAtivaCrmTestMessage,
  type UpdateMarketingSettingsPayload,
} from "@/lib/marketing-settings-api";
import { IX } from "@/lib/integrationsCopy";
import { getApiErrorMessage } from "@/lib/api";

const ATIVA_CRM_CONNECTIONS_URL = "https://app.ativacrm.com/connections";

type Props = {
  onNotify: (m: { type: "success" | "error"; text: string }) => void;
};

export function AtivaCrmIntegrationPanel({ onNotify }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [phone, setPhone] = useState("");
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [tokenConfigured, setTokenConfigured] = useState(false);
  /** Mesmo critério que GET /integrations → ativaCrmHub.connected */
  const [hubConnected, setHubConnected] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localOk, setLocalOk] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchMarketingSettings()
      .then((s) => {
        if (cancelled) return;
        setPhone(s.ativaCrmNotifyPhone ?? "");
        setAlertsEnabled(s.ativaCrmAlertsEnabled);
        setTokenConfigured(s.ativaCrmTokenConfigured);
        setHubConnected(s.ativaCrmHubConnected);
        setTokenInput("");
      })
      .catch(() => {
        if (!cancelled) setLocalError(IX.errCarregarCfg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    setLocalOk(null);
    setSaving(true);
    try {
      const payload: UpdateMarketingSettingsPayload = {
        ativaCrmNotifyPhone: phone.trim() === "" ? null : phone.trim(),
        ativaCrmAlertsEnabled: alertsEnabled,
      };
      if (tokenInput.trim() !== "") {
        payload.ativaCrmApiToken = tokenInput.trim();
      }
      const next = await saveMarketingSettings(payload);
      setTokenConfigured(next.ativaCrmTokenConfigured);
      setHubConnected(next.ativaCrmHubConnected);
      setPhone(next.ativaCrmNotifyPhone ?? "");
      setAlertsEnabled(next.ativaCrmAlertsEnabled);
      setTokenInput("");
      setLocalOk(IX.cfgSalvas);
      onNotify({ type: "success", text: IX.ativaCrmCfgSalvas });
      dispatchMarketingSettingsRefresh();
    } catch (err) {
      const msg = getApiErrorMessage(err, "Erro ao salvar.");
      setLocalError(msg);
      onNotify({ type: "error", text: msg });
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!confirm("Remover o token Ativa CRM e desligar alertas por WhatsApp?")) return;
    setLocalError(null);
    setLocalOk(null);
    setRemoving(true);
    try {
      await saveMarketingSettings({
        ativaCrmApiToken: null,
        ativaCrmAlertsEnabled: false,
        ativaCrmNotifyPhone: null,
      });
      setTokenConfigured(false);
      setHubConnected(false);
      setTokenInput("");
      setPhone("");
      setAlertsEnabled(false);
      setLocalOk(IX.integracaoRemovida);
      onNotify({ type: "success", text: "Ativa CRM desconectado." });
      dispatchMarketingSettingsRefresh();
    } catch (err) {
      const msg = getApiErrorMessage(err, "Erro ao remover.");
      setLocalError(msg);
    } finally {
      setRemoving(false);
    }
  }

  async function handleTest() {
    setLocalError(null);
    setLocalOk(null);
    setTesting(true);
    try {
      const r = await sendAtivaCrmTestMessage();
      if (r.ok) {
        setLocalOk(r.message);
        onNotify({ type: "success", text: r.message });
        dispatchMarketingSettingsRefresh();
      } else {
        setLocalError(r.message);
        onNotify({ type: "error", text: r.message });
      }
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
      </div>
    );
  }

  return (
    <Card className="min-w-0 border-border/80 shadow-sm">
      <CardHeader className="space-y-2 pb-2 sm:pb-4">
        <div className="flex items-center gap-2 text-primary">
          <MessageCircle className="h-5 w-5" aria-hidden />
          <CardTitle className="text-lg sm:text-xl">{IX.painelIntegracaoTitle}</CardTitle>
        </div>
        <CardDescription className="max-w-4xl space-y-2 text-sm leading-relaxed">
          <span className="block">Alertas de marketing via Ativa CRM. {IX.painelPeriodoTail}</span>
          {hubConnected ? (
            <span className="block font-semibold text-emerald-700 dark:text-emerald-400">
              Integração ativa: o card em Integrações usa o mesmo status (conectado).
            </span>
          ) : (
            <span className="block text-muted-foreground">
              No hub, aparece como conectado quando há token salvo, WhatsApp preenchido e alertas por WhatsApp
              ativados.
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2 sm:pt-4">
        <form onSubmit={handleSave} className="space-y-6">
          {localError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {localError}
            </div>
          )}
          {localOk && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-200">
              {localOk}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="ativacrm-token">Token Ativa CRM</Label>
            <Input
              id="ativacrm-token"
              type="password"
              autoComplete="off"
              placeholder={tokenConfigured ? IX.tokenPhOpcional : IX.tokenPhCole}
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              className="min-w-0 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              <a
                href={ATIVA_CRM_CONNECTIONS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                app.ativacrm.com/connections
              </a>
              {IX.tokenAfterLink}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ativacrm-phone">WhatsApp (DDD)</Label>
            <Input
              id="ativacrm-phone"
              type="tel"
              inputMode="tel"
              placeholder="Ex.: 11999999999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-11 min-w-0 w-full max-w-lg"
            />
          </div>

          <label className="flex max-w-3xl cursor-pointer items-start gap-3 rounded-xl border border-border/80 bg-muted/20 p-4">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-border"
              checked={alertsEnabled}
              onChange={(e) => setAlertsEnabled(e.target.checked)}
            />
            <span className="text-sm">
              <span className="font-medium text-foreground">{IX.alertasCriticos}</span>
            </span>
          </label>

          <div
            className="flex max-w-3xl gap-3 rounded-xl border border-amber-200/80 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
            role="status"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <p>
              <strong className="font-semibold">Importante:</strong> configure o{" "}
              <strong className="font-medium">{IX.whatsappPadrao}</strong> no Ativa CRM.
            </p>
          </div>

          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button type="submit" disabled={saving} className="h-11 w-full gap-2 sm:w-auto">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {IX.salvarCfg}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full sm:w-auto"
              disabled={testing || !tokenConfigured}
              onClick={handleTest}
            >
              {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Testar
            </Button>
            {tokenConfigured ? (
              <Button
                type="button"
                variant="ghost"
                className="h-11 w-full text-destructive hover:text-destructive sm:w-auto"
                disabled={removing}
                onClick={handleRemove}
              >
                {removing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {IX.removerIntegracao}
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
