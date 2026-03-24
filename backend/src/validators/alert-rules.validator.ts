import { z } from "zod";

export const alertRuleMetricSchema = z.enum(["cpa", "roas", "spend", "ctr"]);
export const alertRuleOperatorSchema = z.enum(["gt", "gte", "lt", "lte"]);
export const alertRuleSeveritySchema = z.enum(["warning", "critical"]);

const hourSchema = z.number().int().min(0).max(23).nullable().optional();

export const createAlertRuleSchema = z.object({
  name: z.string().trim().min(1).max(120),
  metric: alertRuleMetricSchema,
  operator: alertRuleOperatorSchema,
  threshold: z.number().finite(),
  severity: alertRuleSeveritySchema,
  active: z.boolean().optional(),
  muteStartHour: hourSchema,
  muteEndHour: hourSchema,
});

export const patchAlertRuleSchema = createAlertRuleSchema.partial();

export type CreateAlertRuleInput = z.infer<typeof createAlertRuleSchema>;
export type PatchAlertRuleInput = z.infer<typeof patchAlertRuleSchema>;
