import { z } from "zod";

const periodEnum = z.enum(["7d", "30d", "90d"]);

export const updateMarketingSettingsSchema = z
  .object({
    targetCpaBrl: z.number().positive().nullable().optional(),
    maxCpaBrl: z.number().positive().nullable().optional(),
    targetRoas: z.number().positive().nullable().optional(),
    minResultsForCpa: z.number().int().min(1).max(500).optional(),
    minSpendForAlertsBrl: z.number().nonnegative().nullable().optional(),
    alertsEnabled: z.boolean().optional(),
    alertCpaAboveMax: z.boolean().optional(),
    alertCpaAboveTarget: z.boolean().optional(),
    alertRoasBelowTarget: z.boolean().optional(),
    /** undefined = não alterar; string vazia = remover token; valor = gravar */
    ativaCrmApiToken: z.union([z.string().max(4000), z.null()]).optional(),
    ativaCrmNotifyPhone: z.union([z.string().max(32), z.null()]).optional(),
    ativaCrmAlertsEnabled: z.boolean().optional(),
  })
  .refine((d) => {
    const t = d.targetCpaBrl;
    const m = d.maxCpaBrl;
    if (t === undefined || m === undefined || t === null || m === null) return true;
    return t <= m;
  }, { message: "CPA alvo deve ser menor ou igual ao CPA máximo" });

export type UpdateMarketingSettingsInput = z.infer<typeof updateMarketingSettingsSchema>;

export const evaluateInsightsSchema = z.object({
  period: periodEnum.optional().default("30d"),
  totalSpendBrl: z.number().nonnegative(),
  totalResults: z.number().int().nonnegative(),
  totalAttributedValueBrl: z.number().nonnegative(),
});

export type EvaluateInsightsInput = z.infer<typeof evaluateInsightsSchema>;

export const ativaCrmTestMessageSchema = z.object({
  message: z.string().max(2000).optional(),
});

export type AtivaCrmTestMessageInput = z.infer<typeof ativaCrmTestMessageSchema>;
