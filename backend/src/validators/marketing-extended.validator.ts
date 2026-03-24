import { z } from "zod";

export const metricsSnapshotBodySchema = z.object({
  source: z.string().min(1).max(120),
  rangeKey: z.string().min(1).max(200),
  payload: z.unknown(),
});

export const metaCampaignStatusBodySchema = z.object({
  status: z.enum(["PAUSED", "ACTIVE"]),
});

export const googleCampaignStatusContractSchema = z.object({
  status: z.enum(["ENABLED", "PAUSED"]),
});

export const metaCampaignBudgetContractSchema = z.object({
  dailyBudget: z.number().positive().optional(),
});
