import { z } from "zod";

export const postAutomationExecutionLogSchema = z.object({
  ruleId: z.string().min(1),
  assetId: z.string().min(1).max(128),
  assetLabel: z.string().trim().max(200).optional().nullable(),
  actionTaken: z.string().trim().min(1).max(80),
  previousValue: z.string().trim().max(512).optional().nullable(),
  newValue: z.string().trim().max(512).optional().nullable(),
});

export type PostAutomationExecutionLogInput = z.infer<typeof postAutomationExecutionLogSchema>;
