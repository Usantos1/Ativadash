import { useCallback, useMemo, useState } from "react";
import { Copy, Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  createDashboardShare,
  type DashboardSharePage,
  type DashboardShareSections,
  type ShareExpirationOption,
} from "@/lib/dashboard-share-api";
import { getApiErrorMessage } from "@/lib/api";

const SECTION_DEFS: { key: keyof DashboardShareSections; label: string; hint: string }[] = [
  { key: "kpis", label: "Indicadores (KPIs)", hint: "Resumo numérico do período" },
  { key: "channels", label: "Canais", hint: "Blocos Meta / Google quando existirem no painel" },
  { key: "chart", label: "Gráficos de tendência", hint: "Séries e visualizações principais" },
  { key: "table", label: "Tabela de campanhas (top)", hint: "Até 15 linhas no link público" },
  { key: "insights", label: "Insights e destaques", hint: "Textos e alertas do painel" },
];

const EXPIRATION_OPTIONS: { value: ShareExpirationOption; label: string }[] = [
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "never", label: "Sem expiração" },
];

const PAGE_TITLE: Record<DashboardSharePage, string> = {
  painel: "Painel ADS",
  captacao: "Captação",
  conversao: "Conversão",
  receita: "Receita",
};

export function MarketingShareDialog({
  open,
  onOpenChange,
  page,
  startDate,
  endDate,
  periodLabel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  page: DashboardSharePage;
  startDate: string;
  endDate: string;
  periodLabel: string;
}) {
  const [sections, setSections] = useState<DashboardShareSections>({
    kpis: true,
    channels: true,
    chart: true,
    table: false,
    insights: true,
  });
  const [expiration, setExpiration] = useState<ShareExpirationOption>("30d");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const publicPath = useMemo(() => {
    if (!shareUrl) return "";
    return shareUrl;
  }, [shareUrl]);

  const resetOnClose = useCallback(() => {
    setError(null);
    setShareUrl(null);
    setCopied(false);
  }, []);

  const handleOpenChange = (v: boolean) => {
    if (!v) resetOnClose();
    onOpenChange(v);
  };

  const toggleSection = (key: keyof DashboardShareSections) => {
    setSections((s) => ({ ...s, [key]: !s[key] }));
  };

  const handleGenerate = async () => {
    setBusy(true);
    setError(null);
    setShareUrl(null);
    try {
      const { token } = await createDashboardShare({
        page,
        sections,
        startDate,
        endDate,
        periodLabel,
        expiration,
      });
      const url = `${window.location.origin}/share/d/${encodeURIComponent(token)}`;
      setShareUrl(url);
    } catch (e) {
      setError(getApiErrorMessage(e, "Não foi possível gerar o link."));
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!publicPath) return;
    try {
      await navigator.clipboard.writeText(publicPath);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Não foi possível copiar. Selecione o link manualmente.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showClose title="Compartilhar visualização" className="max-w-lg">
        <p className="text-sm text-muted-foreground">
          Link público somente leitura para <span className="font-medium text-foreground">{PAGE_TITLE[page]}</span>. Período
          fixo no link: <span className="font-medium text-foreground">{periodLabel}</span>.
        </p>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Seções visíveis no link</p>
            <ul className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
              {SECTION_DEFS.map((d) => (
                <li key={d.key}>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-border"
                      checked={sections[d.key]}
                      onChange={() => toggleSection(d.key)}
                    />
                    <span>
                      <span className="text-sm font-medium">{d.label}</span>
                      <span className="block text-xs text-muted-foreground">{d.hint}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Expiração do link</Label>
            <Select value={expiration} onValueChange={(v) => setExpiration(v as ShareExpirationOption)}>
              <SelectTrigger className="h-10 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPIRATION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {publicPath ? (
            <div className="space-y-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3">
              <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">Link gerado</p>
              <div className="break-all rounded-lg bg-background/80 px-2 py-1.5 font-mono text-[11px] text-foreground">
                {publicPath}
              </div>
              <Button type="button" size="sm" variant="secondary" className="w-full rounded-lg" onClick={() => void handleCopy()}>
                {copied ? "Copiado!" : <><Copy className="mr-2 h-3.5 w-3.5" /> Copiar link</>}
              </Button>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" className="rounded-lg" onClick={() => handleOpenChange(false)}>
            Fechar
          </Button>
          {!publicPath ? (
            <Button type="button" className="rounded-lg" disabled={busy} onClick={() => void handleGenerate()}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
              Gerar link
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
