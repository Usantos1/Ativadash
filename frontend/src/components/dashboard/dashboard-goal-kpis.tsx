import { Fragment, type ReactNode } from "react";
import { BarChart3, DollarSign, Eye, MousePointer, ShoppingBag, Target, UserPlus } from "lucide-react";
import { KpiCardPremium } from "@/components/premium/kpi-card-premium";
import { formatNumber, formatPercent, formatSpend } from "@/lib/metrics-format";
import type { MarketingDashboardSummary } from "@/lib/marketing-dashboard-api";
import type { MetaAdsMetricsSummary } from "@/lib/integrations-api";
import type { GoogleAdsMetricsSummary } from "@/lib/integrations-api";

type RelDeltaFn = (
  current: number,
  prev: number,
  compareEnabled: boolean
) => { pct: number } | undefined;

type MetaCtx = {
  summary: MarketingDashboardSummary;
  derived: MarketingDashboardSummary["derived"];
  metaSpend: number;
  cmpMetaSpend: number;
  compareEnabled: boolean;
  relDelta: RelDeltaFn;
  leadLabel: string;
  cmpMeta: MetaAdsMetricsSummary | null;
};

function cmpNum(cmp: MetaAdsMetricsSummary | null, pick: (s: MetaAdsMetricsSummary) => number): number {
  if (!cmp) return 0;
  const v = pick(cmp);
  return Number.isFinite(v) ? v : 0;
}

export function MetaGoalKpiGrid({ order, ctx }: { order: string[]; ctx: MetaCtx }): ReactNode {
  const { summary, derived, metaSpend, cmpMetaSpend, compareEnabled, relDelta, leadLabel, cmpMeta } = ctx;

  const reachDisplay = () => {
    if (summary.reach != null && summary.reach > 0) return formatNumber(summary.reach);
    return "—";
  };
  const reachHint = () => {
    if (summary.reach != null && summary.reach > 0) {
      return summary.reachNote === "sum_daily_per_account"
        ? "Soma aproximada dos alcances diários."
        : "Alcance agregado no período.";
    }
    return summary.reachNote === "unavailable"
      ? "A Meta não retornou alcance para este período."
      : "Sem alcance reportado.";
  };

  const card = (key: string): ReactNode => {
    switch (key) {
      case "spend":
        return (
          <KpiCardPremium
            variant="primary"
            label="Investimento"
            value={formatSpend(metaSpend)}
            icon={DollarSign}
            hideSource
            hint="Gasto Meta (painel) no período selecionado."
            hintAsTooltip
            delta={relDelta(metaSpend, cmpMetaSpend, compareEnabled)}
          />
        );
      case "impressions":
        return (
          <KpiCardPremium
            variant="primary"
            label="Impressões"
            value={formatNumber(summary.impressions)}
            icon={Eye}
            hideSource
            delta={relDelta(summary.impressions, cmpNum(cmpMeta, (c) => c.impressions), compareEnabled && !!cmpMeta)}
          />
        );
      case "reach":
        return (
          <KpiCardPremium
            variant="primary"
            label="Alcance"
            value={reachDisplay()}
            hint={reachHint()}
            hintAsTooltip
            icon={Target}
            hideSource
            delta={relDelta(
              summary.reach ?? 0,
              cmpNum(cmpMeta, (c) => c.reach ?? 0),
              compareEnabled && !!cmpMeta && (summary.reach ?? 0) > 0
            )}
          />
        );
      case "clicks":
        return (
          <KpiCardPremium
            variant="primary"
            label="Cliques"
            value={formatNumber(summary.clicks)}
            icon={MousePointer}
            hideSource
            delta={relDelta(summary.clicks, cmpNum(cmpMeta, (c) => c.clicks), compareEnabled && !!cmpMeta)}
          />
        );
      case "leads":
        return (
          <KpiCardPremium
            variant="primary"
            label={leadLabel}
            value={formatNumber(summary.leads)}
            hint="Eventos de conversão mapeados como lead nas actions da Meta."
            hintAsTooltip
            icon={UserPlus}
            hideSource
            delta={relDelta(summary.leads, cmpNum(cmpMeta, (c) => c.leads), compareEnabled && !!cmpMeta)}
          />
        );
      case "cpl":
        return (
          <KpiCardPremium
            variant="primary"
            label="CPL"
            value={derived?.cplLeads != null ? formatSpend(derived.cplLeads) : "—"}
            hint={derived?.cplLeads == null ? "Sem leads ou sem gasto." : "Custo por lead."}
            hintAsTooltip
            icon={DollarSign}
            hideSource
            deltaInvert
          />
        );
      case "click_to_lead":
        return (
          <KpiCardPremium
            variant="primary"
            label="Clique → lead"
            value={derived?.clickToLeadRate != null ? formatPercent(derived.clickToLeadRate) : "—"}
            hint={
              derived?.clickToLeadRate == null
                ? "Sem cliques ou leads no período."
                : "Leads ÷ cliques (tráfego até o resultado principal)."
            }
            hintAsTooltip
            icon={BarChart3}
            hideSource
          />
        );
      case "ctr":
        return (
          <KpiCardPremium
            variant="primary"
            label="CTR"
            value={derived?.ctrPct != null ? formatPercent(derived.ctrPct) : "—"}
            hint={derived?.ctrPct == null ? "Sem impressões no período." : "Cliques ÷ impressões."}
            hintAsTooltip
            icon={BarChart3}
            hideSource
          />
        );
      case "cpc":
        return (
          <KpiCardPremium
            variant="primary"
            label="CPC"
            value={derived?.cpc != null ? formatSpend(derived.cpc) : "—"}
            hint={derived?.cpc == null ? "Sem cliques ou gasto." : "Gasto ÷ cliques."}
            hintAsTooltip
            icon={Target}
            hideSource
            deltaInvert
          />
        );
      case "purchases":
        return (
          <KpiCardPremium
            variant="primary"
            label="Compras"
            value={formatNumber(summary.purchases)}
            hint="Compras atribuídas pela Meta no período."
            hintAsTooltip
            icon={ShoppingBag}
            hideSource
            delta={relDelta(summary.purchases, cmpNum(cmpMeta, (c) => c.purchases), compareEnabled && !!cmpMeta)}
          />
        );
      case "purchase_value":
        return (
          <KpiCardPremium
            variant="primary"
            label="Valor atribuído"
            value={summary.purchaseValue > 0 ? formatSpend(summary.purchaseValue) : "—"}
            hint="Valor de compra reportado pela Meta."
            hintAsTooltip
            icon={DollarSign}
            hideSource
            delta={relDelta(
              summary.purchaseValue,
              cmpNum(cmpMeta, (c) => c.purchaseValue ?? 0),
              compareEnabled && !!cmpMeta
            )}
          />
        );
      case "roas":
        return (
          <KpiCardPremium
            variant="primary"
            label="ROAS"
            value={
              derived?.roas != null && Number.isFinite(derived.roas)
                ? `${derived.roas.toFixed(2).replace(".", ",")}×`
                : "—"
            }
            hint={derived?.roas == null ? "Sem receita ou gasto para ROAS." : "Receita atribuída ÷ investimento."}
            hintAsTooltip
            icon={BarChart3}
            hideSource
          />
        );
      case "cost_per_purchase":
        return (
          <KpiCardPremium
            variant="primary"
            label="Custo / compra"
            value={derived?.costPerPurchase != null ? formatSpend(derived.costPerPurchase) : "—"}
            hint={derived?.costPerPurchase == null ? "Sem compras ou gasto." : "Investimento ÷ compras."}
            hintAsTooltip
            icon={DollarSign}
            hideSource
            deltaInvert
          />
        );
      case "checkout":
        return (
          <KpiCardPremium
            variant="primary"
            label="Checkout iniciado"
            value={formatNumber(summary.initiateCheckout)}
            hint="Eventos de checkout iniciado no período."
            hintAsTooltip
            icon={ShoppingBag}
            hideSource
          />
        );
      case "lead_to_purchase":
        return (
          <KpiCardPremium
            variant="primary"
            label="Lead → compra"
            value={derived?.leadToPurchaseRate != null ? formatPercent(derived.leadToPurchaseRate) : "—"}
            hint={
              derived?.leadToPurchaseRate == null
                ? "Sem leads ou compras."
                : "Compras ÷ leads (aproximação do fundo do funil)."
            }
            hintAsTooltip
            icon={Target}
            hideSource
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      {order.map((key) => {
        const el = card(key);
        return el ? <Fragment key={key}>{el}</Fragment> : null;
      })}
    </>
  );
}

type GoogleCtx = {
  googleDerived: { spend: number; ctrPct: number | null; cpc: number | null; costPerConv: number | null };
  metrics: GoogleAdsMetricsSummary;
  cmpGoogleSummary: GoogleAdsMetricsSummary | null;
  compareEnabled: boolean;
  relDelta: RelDeltaFn;
};

export function GoogleGoalKpiGrid({ order, ctx }: { order: string[]; ctx: GoogleCtx }): ReactNode {
  const { googleDerived, metrics, cmpGoogleSummary, compareEnabled, relDelta } = ctx;
  const cmp = cmpGoogleSummary;

  const card = (key: string): ReactNode => {
    switch (key) {
      case "spend":
        return (
          <KpiCardPremium
            variant="primary"
            label="Investimento"
            value={formatSpend(googleDerived.spend)}
            icon={DollarSign}
            hideSource
            hint="Custo no período (cost_micros da API Google Ads)."
            hintAsTooltip
            delta={relDelta(googleDerived.spend, (cmp?.costMicros ?? 0) / 1_000_000, compareEnabled && !!cmp)}
          />
        );
      case "impressions":
        return (
          <KpiCardPremium
            variant="primary"
            label="Impressões"
            value={formatNumber(metrics.impressions)}
            icon={Eye}
            hideSource
            delta={relDelta(metrics.impressions, cmp?.impressions ?? 0, compareEnabled && !!cmp)}
          />
        );
      case "clicks":
        return (
          <KpiCardPremium
            variant="primary"
            label="Cliques"
            value={formatNumber(metrics.clicks)}
            icon={MousePointer}
            hideSource
            delta={relDelta(metrics.clicks, cmp?.clicks ?? 0, compareEnabled && !!cmp)}
          />
        );
      case "conversions":
        return (
          <KpiCardPremium
            variant="primary"
            label="Conversões"
            value={formatNumber(metrics.conversions)}
            hint="Conversões reportadas pela API no período."
            hintAsTooltip
            icon={UserPlus}
            hideSource
            delta={relDelta(metrics.conversions, cmp?.conversions ?? 0, compareEnabled && !!cmp)}
          />
        );
      case "conv_value":
        return (
          <KpiCardPremium
            variant="primary"
            label="Valor conv."
            value={formatSpend(metrics.conversionsValue)}
            hint="Valor atribuído às conversões (moeda da conta Google)."
            hintAsTooltip
            icon={Target}
            hideSource
            delta={relDelta(metrics.conversionsValue, cmp?.conversionsValue ?? 0, compareEnabled && !!cmp)}
          />
        );
      case "ctr":
        return (
          <KpiCardPremium
            variant="primary"
            label="CTR"
            value={googleDerived.ctrPct != null ? formatPercent(googleDerived.ctrPct) : "—"}
            hint={googleDerived.ctrPct == null ? "Sem impressões no período." : "Cliques ÷ impressões."}
            hintAsTooltip
            icon={BarChart3}
            hideSource
          />
        );
      case "cpc":
        return (
          <KpiCardPremium
            variant="primary"
            label="CPC"
            value={googleDerived.cpc != null ? formatSpend(googleDerived.cpc) : "—"}
            hint={googleDerived.cpc == null ? "Sem cliques ou gasto." : "Gasto ÷ cliques."}
            hintAsTooltip
            icon={MousePointer}
            hideSource
            deltaInvert
          />
        );
      case "cost_per_conv":
        return (
          <KpiCardPremium
            variant="primary"
            label="Custo / conv."
            value={googleDerived.costPerConv != null ? formatSpend(googleDerived.costPerConv) : "—"}
            hint={googleDerived.costPerConv == null ? "Sem conversões ou gasto." : "Gasto ÷ conversões."}
            hintAsTooltip
            icon={DollarSign}
            hideSource
            deltaInvert
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      {order.map((key) => {
        const el = card(key);
        return el ? <Fragment key={key}>{el}</Fragment> : null;
      })}
    </>
  );
}
