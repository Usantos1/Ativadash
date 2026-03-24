import { prisma } from "../utils/prisma.js";
import type { MarketingDashboardPayload } from "./marketing-dashboard.service.js";
import { buildGoalContextFromSettingsRow } from "./business-goal-mode.js";

/**
 * Anexa contexto de objetivo da conta ao payload do dashboard (leitura leve de MarketingSettings).
 */
export async function mergeMarketingGoalIntoDashboardPayload(
  organizationId: string,
  payload: MarketingDashboardPayload
): Promise<MarketingDashboardPayload> {
  if (!payload.ok) return payload;

  const row = await prisma.marketingSettings.upsert({
    where: { organizationId },
    create: { organizationId },
    update: {},
    select: {
      businessGoalMode: true,
      primaryConversionLabel: true,
      showRevenueBlocksInLeadMode: true,
    },
  });

  return { ...payload, goalContext: buildGoalContextFromSettingsRow(row) };
}
