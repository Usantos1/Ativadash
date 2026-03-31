import { z } from "zod";

export const alertRuleMetricSchema = z.enum(["cpa", "roas", "spend", "ctr", "daily_spend"]);
export const alertRuleOperatorSchema = z.enum(["gt", "gte", "lt", "lte", "outside_target"]);
export const alertRuleSeveritySchema = z.enum(["warning", "critical"]);
export const alertRuleAppliesToChannelSchema = z.enum(["meta", "google", "all"]).optional();

const hourSchema = z.number().int().min(0).max(23).nullable().optional();

const routingObjectSchema = z.object({
  jobTitleSlugs: z.array(z.string().min(1)).optional(),
  userIds: z.array(z.string().min(1)).optional(),
  customPhones: z.array(z.string().min(8)).optional(),
});

const hhmmSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Use HH:mm")
  .optional()
  .nullable();

export const alertRuleThresholdRefSchema = z.enum([
  "VAR_CHANNEL_MAX_CPA",
  "VAR_CHANNEL_TARGET_ROAS",
  "VAR_BLENDED_DAILY_BUDGET_MAX",
]);

export const alertRuleEvaluationLevelSchema = z.enum(["campaign", "ad_set", "ad"]);
export const alertRuleCheckFrequencySchema = z.enum(["1h", "3h", "12h", "daily"]);

export const alertRuleActionTypeSchema = z.enum([
  "whatsapp_alert",
  "pause_campaign",
  "pause_entity_whatsapp",
  "reduce_budget_20_whatsapp",
]);

export const createAlertRuleSchema = z.object({
  name: z.string().trim().min(1).max(120),
  metric: alertRuleMetricSchema,
  operator: alertRuleOperatorSchema,
  /** Para outside_target pode ser 0 (ignorado na avaliação). Com thresholdRef, use 0. */
  threshold: z.number().finite(),
  /** Limiar dinâmico a partir das metas globais (por canal). */
  thresholdRef: alertRuleThresholdRefSchema.nullable().optional(),
  severity: alertRuleSeveritySchema,
  active: z.boolean().optional(),
  muteStartHour: hourSchema,
  muteEndHour: hourSchema,
  /** meta | google | all — omissão equivale a all (regra vale para avaliação consolidada e por canal). */
  appliesToChannel: alertRuleAppliesToChannelSchema,
  /** Incluir no WhatsApp quando a regra disparar (dedupe por código ainda se aplica). */
  notifyWhatsapp: z.boolean().optional(),
  actionType: alertRuleActionTypeSchema.optional(),
  evaluationLevel: alertRuleEvaluationLevelSchema.optional().nullable(),
  checkFrequency: alertRuleCheckFrequencySchema.optional().nullable(),
  actionWindowStartLocal: hhmmSchema,
  actionWindowEndLocal: hhmmSchema,
  messageTemplate: z.string().max(8000).optional().nullable(),
  routing: z.union([routingObjectSchema, z.null()]).optional(),
  evaluationTimeLocal: hhmmSchema,
  evaluationTimezone: z.string().trim().max(80).optional().nullable(),
});

export const patchAlertRuleSchema = createAlertRuleSchema.partial();

export type CreateAlertRuleInput = z.infer<typeof createAlertRuleSchema>;
export type PatchAlertRuleInput = z.infer<typeof patchAlertRuleSchema>;
