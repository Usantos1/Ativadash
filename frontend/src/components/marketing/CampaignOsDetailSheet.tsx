import { ExternalLink, LineChart } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { formatNumber, formatSpend } from "@/lib/metrics-format";
import { readCampaignActionLog, type CampaignActionLogEntry } from "@/lib/campaign-local-actions";
import type { OsCampaignRow } from "@/lib/marketing-campaign-os";
import {
  LineChart as ReLineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  ResponsiveContainer,
} from "recharts";

function metaCampaignUrl(externalId: string): string {
  return `https://www.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=${encodeURIComponent(externalId)}`;
}

function googleCampaignUrl(externalId: string): string {
  const id = externalId.replace(/\D/g, "") || externalId;
  return `https://ads.google.com/aw/campaigns?campaignId=${encodeURIComponent(id)}`;
}

function buildApproxDailySeries(row: OsCampaignRow, days: number): { day: string; spend: number }[] {
  const d = Math.max(1, days);
  const per = row.spend / d;
  const out: { day: string; spend: number }[] = [];
  for (let i = 0; i < Math.min(d, 14); i++) {
    out.push({ day: `D${i + 1}`, spend: Math.round(per * 100 * (0.85 + (i % 5) * 0.05)) / 100 });
  }
  return out;
}

function logLabel(e: CampaignActionLogEntry): string {
  const t = new Date(e.at).toLocaleString("pt-BR");
  const act =
    e.kind === "pause"
      ? "Pausou"
      : e.kind === "activate"
        ? "Ativou"
        : e.kind === "budget_set"
          ? "Orçamento"
          : e.kind === "bulk_pause"
            ? "Pausa em massa"
            : "Orçamento em massa";
  return `${t} · ${act}${e.detail ? ` · ${e.detail}` : ""}`;
}

export function CampaignOsDetailSheet(props: {
  row: OsCampaignRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  periodDays: number;
  onOpenBudget?: (externalId: string, name: string, opts?: { estimatedDaily?: number }) => void;
}) {
  const { row, open, onOpenChange, periodDays, onOpenBudget } = props;
  const ext = row?.externalId;
  const history = ext ? readCampaignActionLog(ext) : [];

  const chartData = row ? buildApproxDailySeries(row, periodDays) : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={row ? row.name : "Campanha"}
        description="Detalhes da campanha, atalhos para a plataforma e histórico local de ações."
        className="max-w-md sm:max-w-lg"
      >
        {!row ? null : (
          <div className="space-y-5">
            <div className="text-sm text-muted-foreground">
              <p>
                <span className="font-semibold text-foreground">{row.channel}</span>
                {row.parentLabel ? (
                  <>
                    {" · "}
                    <span>{row.parentLabel}</span>
                  </>
                ) : null}
              </p>
              <p className="mt-1 text-xs">Nível: {row.level}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border border-border/50 bg-muted/20 p-2">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Gasto</p>
                <p className="font-bold tabular-nums">{formatSpend(row.spend)}</p>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/20 p-2">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Cliques</p>
                <p className="font-bold tabular-nums">{formatNumber(row.clicks)}</p>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/20 p-2">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Leads / conv.</p>
                <p className="font-bold tabular-nums">{formatNumber(row.leads + row.sales)}</p>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/20 p-2">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Impr.</p>
                <p className="font-bold tabular-nums">{formatNumber(row.impressions)}</p>
              </div>
            </div>

            {row.level === "campaign" && ext ? (
              <div className="flex flex-col gap-2">
                {row.channel === "Meta" ? (
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2 rounded-lg" asChild>
                    <a href={metaCampaignUrl(ext)} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      Ver no Meta Ads
                    </a>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2 rounded-lg" asChild>
                    <a href={googleCampaignUrl(ext)} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      Ver no Google Ads
                    </a>
                  </Button>
                )}
                {row.channel === "Meta" && onOpenBudget ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full rounded-lg"
                    onClick={() => {
                      const est = row.spend / Math.max(1, periodDays);
                      onOpenBudget(ext, row.name, { estimatedDaily: est });
                      onOpenChange(false);
                    }}
                  >
                    Ajustar orçamento diário (Meta)
                  </Button>
                ) : null}
              </div>
            ) : null}

            <div>
              <p className="mb-2 flex items-center gap-1 text-xs font-bold uppercase text-muted-foreground">
                <LineChart className="h-3.5 w-3.5" />
                Série diária (aprox. pelo período)
              </p>
              <div className="h-40 w-full rounded-lg border border-border/40 bg-background/80 p-1">
                <ResponsiveContainer width="100%" height="100%">
                  <ReLineChart data={chartData}>
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} width={40} />
                    <ReTooltip formatter={(v: number) => formatSpend(v)} />
                    <Line type="monotone" dataKey="spend" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </ReLineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Curva estimada a partir do gasto total no período (sem API por campanha).
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Histórico neste navegador</p>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma ação registada ainda para esta campanha.</p>
              ) : (
                <ul className="max-h-40 space-y-1.5 overflow-y-auto text-xs text-muted-foreground">
                  {history.map((e, i) => (
                    <li key={`${e.at}-${i}`} className="rounded border border-border/40 bg-muted/20 px-2 py-1">
                      {logLabel(e)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
