import type { AccountObjective } from "@/lib/business-goal-mode";
import type { GoogleAdsCampaignRow, MetaAdsCampaignRow } from "@/lib/integrations-api";

export type OperationalActionKind = "pause_meta" | "pause_google" | "budget_meta" | "duplicate_stub";

export type OperationalActionItem = {
  id: string;
  kind: OperationalActionKind;
  channel: "meta" | "google";
  campaignId: string;
  campaignName: string;
  /** Rótulo curto para o cockpit (sem parágrafo). */
  label: string;
  /** Ritmo médio diário no período (gasto / dias), só em ações de orçamento Meta. */
  estimatedDaily?: number;
};

function med(nums: number[]): number | null {
  const a = nums.filter((n) => Number.isFinite(n) && n > 0).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m]! : (a[m - 1]! + a[m]!) / 2;
}

type CampEff = { id: string; name: string; channel: "meta" | "google"; spend: number; cpa: number | null; roas: number | null };

function collectMeta(rows: MetaAdsCampaignRow[]): CampEff[] {
  return rows
    .map((r) => {
      const spend = r.spend;
      const leadish = r.leads + (r.messagingConversationsStarted ?? 0);
      const cpa = spend > 0 && leadish > 0 ? spend / leadish : null;
      const roas = spend > 0 && (r.purchaseValue ?? 0) > 0 ? (r.purchaseValue ?? 0) / spend : null;
      const id = r.campaignId ?? "";
      return {
        id,
        name: r.campaignName || id,
        channel: "meta" as const,
        spend,
        cpa,
        roas,
      };
    })
    .filter((x) => x.id);
}

function collectGoogle(rows: GoogleAdsCampaignRow[]): CampEff[] {
  return rows
    .map((r) => {
      const spend = r.costMicros / 1_000_000;
      const cpa = spend > 0 && r.conversions > 0 ? spend / r.conversions : null;
      const val = r.conversionsValue ?? 0;
      const roas = spend > 0 && val > 0 ? val / spend : null;
      const id = r.campaignId ?? "";
      return {
        id,
        name: r.campaignName || id,
        channel: "google" as const,
        spend,
        cpa,
        roas,
      };
    })
    .filter((x) => x.id);
}

const MIN_SPEND = 40;

/**
 * Gera até `maxItems` ações operacionais (pausar / orçamento / duplicar em breve).
 */
export function buildOperationalActions(params: {
  goalMode: AccountObjective;
  targetCpa: number | null;
  targetRoas: number | null;
  metaRows: MetaAdsCampaignRow[];
  googleRows: GoogleAdsCampaignRow[];
  ctrLowCampaigns: { channel: "meta" | "google"; id: string; name: string }[];
  maxItems?: number;
  /** Dias do período selecionado (para referência de ritmo diário em orçamento Meta). */
  periodDays?: number;
}): OperationalActionItem[] {
  const { goalMode, targetCpa, targetRoas, metaRows, googleRows, ctrLowCampaigns } = params;
  const maxItems = params.maxItems ?? 8;
  const pd = Math.max(1, params.periodDays ?? 1);
  const out: OperationalActionItem[] = [];
  const usedCamp = new Set<string>();

  const push = (item: OperationalActionItem) => {
    if (out.length >= maxItems) return;
    if (usedCamp.has(item.campaignId)) return;
    usedCamp.add(item.campaignId);
    out.push(item);
  };

  const metaEff = collectMeta(metaRows);
  const googleEff = collectGoogle(googleRows);
  const all = [...metaEff, ...googleEff];

  const medCpa = med(all.map((c) => c.cpa).filter((n): n is number => n != null));
  const medRoas = med(all.map((c) => c.roas).filter((n): n is number => n != null));

  for (const c of all) {
    if (c.spend < MIN_SPEND) continue;
    const net = c.channel === "meta" ? "Meta" : "Google";

    const leadishVol =
      c.channel === "meta"
        ? (metaRows.find((r) => r.campaignId === c.id)?.leads ?? 0) +
          (metaRows.find((r) => r.campaignId === c.id)?.messagingConversationsStarted ?? 0)
        : googleRows.find((r) => r.campaignId === c.id)?.conversions ?? 0;

    if (goalMode === "LEADS" || goalMode === "HYBRID") {
      if (leadishVol === 0) {
        push({
          id: `pause-zero-${c.channel}-${c.id}`,
          kind: c.channel === "meta" ? "pause_meta" : "pause_google",
          channel: c.channel,
          campaignId: c.id,
          campaignName: c.name,
          label: `Pausar · ${net}: gasto sem lead/conv.`,
        });
        continue;
      }
      if (c.cpa != null && targetCpa != null && targetCpa > 0 && c.cpa > targetCpa * 1.35) {
        push({
          id: `pause-meta-${c.channel}-${c.id}`,
          kind: c.channel === "meta" ? "pause_meta" : "pause_google",
          channel: c.channel,
          campaignId: c.id,
          campaignName: c.name,
          label: `Pausar · ${net}: custo acima da meta`,
        });
        continue;
      }
    }

    if (goalMode === "SALES" || goalMode === "HYBRID") {
      if (c.roas != null && targetRoas != null && targetRoas > 0 && c.roas < targetRoas * 0.65) {
        push({
          id: `pause-roas-${c.channel}-${c.id}`,
          kind: c.channel === "meta" ? "pause_meta" : "pause_google",
          channel: c.channel,
          campaignId: c.id,
          campaignName: c.name,
          label: `Pausar · ${net}: ROAS abaixo da meta`,
        });
        continue;
      }
    }
  }

  for (const c of all) {
    if (c.spend < MIN_SPEND || out.length >= maxItems) continue;
    if (usedCamp.has(c.id)) continue;

    const leadishVol =
      c.channel === "meta"
        ? (metaRows.find((r) => r.campaignId === c.id)?.leads ?? 0) +
          (metaRows.find((r) => r.campaignId === c.id)?.messagingConversationsStarted ?? 0)
        : googleRows.find((r) => r.campaignId === c.id)?.conversions ?? 0;

    let scaled = false;
    if ((goalMode === "LEADS" || goalMode === "HYBRID") && c.cpa != null && medCpa != null) {
      if (c.cpa <= medCpa * 0.85 && leadishVol >= 3) {
        if (c.channel === "meta") {
          push({
            id: `budget-cpa-${c.id}`,
            kind: "budget_meta",
            channel: "meta",
            campaignId: c.id,
            campaignName: c.name,
            label: "Orçamento · Meta: CPL abaixo da mediana",
            estimatedDaily: c.spend / pd,
          });
        } else {
          push({
            id: `scale-g-${c.id}`,
            kind: "duplicate_stub",
            channel: "google",
            campaignId: c.id,
            campaignName: c.name,
            label: "Escalar · Google: CPA abaixo da mediana (Google Ads)",
          });
        }
        scaled = true;
      }
    }
    if (
      !scaled &&
      (goalMode === "SALES" || goalMode === "HYBRID") &&
      c.roas != null &&
      medRoas != null &&
      c.roas >= medRoas * 1.12
    ) {
      if (c.channel === "meta") {
        push({
          id: `budget-roas-${c.id}`,
          kind: "budget_meta",
          channel: "meta",
          campaignId: c.id,
          campaignName: c.name,
          label: "Orçamento · Meta: ROAS acima da mediana",
          estimatedDaily: c.spend / pd,
        });
      } else {
        push({
          id: `scale-roas-g-${c.id}`,
          kind: "duplicate_stub",
          channel: "google",
          campaignId: c.id,
          campaignName: c.name,
          label: "Escalar · Google: ROAS acima da mediana (Google Ads)",
        });
      }
    }
  }

  for (const low of ctrLowCampaigns) {
    if (out.length >= maxItems) break;
    push({
      id: `ctr-${low.channel}-${low.id}`,
      kind: "duplicate_stub",
      channel: low.channel,
      campaignId: low.id,
      campaignName: low.name,
      label: `Duplicar teste · ${low.channel === "meta" ? "Meta" : "Google"}: CTR baixo`,
    });
  }

  return out.slice(0, maxItems);
}

/** Extensibilidade futura (metas, regras, automação, WhatsApp) — referência para o produto. */
export const MARKETING_OPERATIONAL_ROADMAP = {
  configurableGoalKeys: ["targetCpaBrl", "maxCpaBrl", "targetRoas"] as const,
  ruleEngine: "planned" as const,
  autoExecute: "planned" as const,
  dailyWhatsAppDigest: "planned" as const,
};

export function findCtrLowCampaigns(
  metaRows: MetaAdsCampaignRow[],
  googleRows: GoogleAdsCampaignRow[],
  ctrThresholdPct = 1.25,
  minImpr = 600
): { channel: "meta" | "google"; id: string; name: string }[] {
  const out: { channel: "meta" | "google"; id: string; name: string }[] = [];
  for (const r of metaRows) {
    const id = r.campaignId;
    if (!id || r.impressions < minImpr) continue;
    const ctr = (r.clicks / r.impressions) * 100;
    if (ctr < ctrThresholdPct && r.spend >= 25) {
      out.push({ channel: "meta", id, name: r.campaignName || id });
    }
  }
  for (const r of googleRows) {
    const id = r.campaignId;
    if (!id || r.impressions < minImpr) continue;
    const ctr = (r.clicks / r.impressions) * 100;
    if (ctr < ctrThresholdPct && r.costMicros / 1_000_000 >= 25) {
      out.push({ channel: "google", id, name: r.campaignName || id });
    }
  }
  return out.slice(0, 4);
}
