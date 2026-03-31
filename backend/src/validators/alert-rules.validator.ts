import { z } from "zod";

export const alertRuleMetricSchema = z.enum(["cpa", "roas", "spend", "ctr"]);
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

export const createAlertRuleSchema = z.object({
  name: z.string().trim().min(1).max(120),
  metric: alertRuleMetricSchema,
  operator: alertRuleOperatorSchema,
  /** Para outside_target pode ser 0 (ignorado na avaliação). */
  threshold: z.number().finite(),
  severity: alertRuleSeveritySchema,
  active: z.boolean().optional(),
  muteStartHour: hourSchema,
  muteEndHour: hourSchema,
  /** meta | google | all — omissão equivale a all (regra vale para avaliação consolidada e por canal). */
  appliesToChannel: alertRuleAppliesToChannelSchema,
  /** Incluir no WhatsApp quando a regra disparar (dedupe por código ainda se aplica). */
  notifyWhatsapp: z.boolean().optional(),
  actionType: z.enum(["whatsapp_alert", "pause_campaign"]).optional(),
  messageTemplate: z.string().max(8000).optional().nullable(),
  routing: z.union([routingObjectSchema, z.null()]).optional(),
  evaluationTimeLocal: hhmmSchema,
  evaluationTimezone: z.string().trim().max(80).optional().nullable(),
});

export const patchAlertRuleSchema = createAlertRuleSchema.partial();

export type CreateAlertRuleInput = z.infer<typeof createAlertRuleSchema>;
export type PatchAlertRuleInput = z.infer<typeof patchAlertRuleSchema>;
