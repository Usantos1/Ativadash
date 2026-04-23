import { prisma } from "../utils/prisma.js";

export type ManualRevenueRow = {
  campaignId: string;
  channel: string;
  manualRevenue: number;
};

/**
 * Normaliza para o início do dia em UTC — alinhamento com outras métricas do dashboard
 * que operam em granularidade diária (insights Meta/Google vêm por data-breakdown).
 */
function toDateOnlyUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Cria ou atualiza a entrada de receita manual para (workspace, campanha, canal, data).
 * Se o valor for zero, remove a entrada do dia — evita linha órfã com 0 que poluiria relatórios.
 * Ver também {@link deleteManualCampaignRevenue} para apagar todo o histórico de uma campanha.
 */
export async function upsertManualCampaignRevenue(
  workspaceId: string,
  campaignId: string,
  channel: string,
  manualRevenue: number,
  referenceDate?: Date
) {
  const day = toDateOnlyUtc(referenceDate ?? new Date());

  if (manualRevenue <= 0) {
    await prisma.manualCampaignRevenue.deleteMany({
      where: { workspaceId, campaignId, channel, referenceDate: day },
    });
    return null;
  }

  return prisma.manualCampaignRevenue.upsert({
    where: {
      workspaceId_campaignId_channel_referenceDate: {
        workspaceId,
        campaignId,
        channel,
        referenceDate: day,
      },
    },
    update: { manualRevenue },
    create: { workspaceId, campaignId, channel, manualRevenue, referenceDate: day },
  });
}

/** Remove todo o histórico de receita manual de uma campanha (usado quando a campanha é excluída). */
export async function deleteManualCampaignRevenue(workspaceId: string, campaignId: string) {
  return prisma.manualCampaignRevenue.deleteMany({
    where: { workspaceId, campaignId },
  });
}

/**
 * Retorna receitas manuais agregadas por (campanha, canal) dentro do intervalo `[start, end]`
 * (inclusivo nos dois extremos). Se não houver range, retorna todas as entradas (uso legado).
 */
export async function getManualRevenuesForWorkspace(
  workspaceId: string,
  range?: { start?: Date; end?: Date }
): Promise<ManualRevenueRow[]> {
  const where: { workspaceId: string; referenceDate?: { gte?: Date; lte?: Date } } = {
    workspaceId,
  };
  if (range?.start || range?.end) {
    where.referenceDate = {};
    if (range.start) where.referenceDate.gte = toDateOnlyUtc(range.start);
    if (range.end) where.referenceDate.lte = toDateOnlyUtc(range.end);
  }

  const rows = await prisma.manualCampaignRevenue.findMany({
    where,
    select: { campaignId: true, channel: true, manualRevenue: true },
  });

  const grouped = new Map<string, ManualRevenueRow>();
  for (const r of rows) {
    const key = `${r.campaignId}::${r.channel}`;
    const current = grouped.get(key);
    if (current) {
      current.manualRevenue += r.manualRevenue;
    } else {
      grouped.set(key, {
        campaignId: r.campaignId,
        channel: r.channel,
        manualRevenue: r.manualRevenue,
      });
    }
  }
  return Array.from(grouped.values());
}

/** Mapa campaignId → receita total no período. Usado por dashboards que somam Meta + Google. */
export async function getManualRevenueMap(
  workspaceId: string,
  range?: { start?: Date; end?: Date }
): Promise<Map<string, number>> {
  const rows = await getManualRevenuesForWorkspace(workspaceId, range);
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.campaignId, (map.get(r.campaignId) ?? 0) + r.manualRevenue);
  }
  return map;
}
