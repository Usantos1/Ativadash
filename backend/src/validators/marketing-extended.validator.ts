import { z } from "zod";

export const metricsSnapshotBodySchema = z.object({
  source: z.string().min(1).max(120),
  rangeKey: z.string().min(1).max(200),
  payload: z.unknown(),
});

export const metaCampaignStatusBodySchema = z.object({
  status: z.enum(["PAUSED", "ACTIVE"]),
});
