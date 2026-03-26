import { z } from "zod";

const periodEnum = z.enum(["7d", "30d", "90d"]);

const businessGoalModeEnum = z.enum(["LEADS", "SALES", "HYBRID"]);

const channelGoalsPatchSchema = z
  .object({
    targetCpaBrl: z.number().positive().nullable().optional(),
    maxCpaBrl: z.number().positive().nullable().optional(),
    targetRoas: z.number().positive().nullable().optional(),
    minSpendForAlertsBrl: z.number().nonnegative().nullable().optional(),
    minResultsForCpa: z.number().int().min(1).max(500).optional(),
  })
  .partial();

const goalsByChannelSchema = z
  .object({
    meta: channelGoalsPatchSchema.nullish(),
    google: channelGoalsPatchSchema.nullish(),
  })
  .partial();

const channelAutomationsPatchSchema = z
  .object({
    pauseIfCplAboveMax: z.boolean().optional(),
    pauseIfCplAboveMaxMinResults: z.number().int().min(1).max(5000).nullable().optional(),
    reduceBudgetIfCplAboveTarget: z.boolean().optional(),
    reduceBudgetPercent: z.number().positive().max(100).nullable().optional(),
    increaseBudgetIfCplBelowTarget: z.boolean().optional(),
    increaseBudgetPercent: z.number().positive().max(100).nullable().optional(),
    flagScaleIfCplGood: z.boolean().optional(),
    flagReviewSpendUpConvDown: z.boolean().optional(),
  })
  .partial();

const automationsByChannelSchema = z
  .object({
    meta: channelAutomationsPatchSchema.nullish(),
    google: channelAutomationsPatchSchema.nullish(),
  })
  .partial();

const channelWhatsappPatchSchema = z
  .object({
    cplAboveMax: z.boolean().optional(),
    cplAboveTarget: z.boolean().optional(),
    roasBelowMin: z.boolean().optional(),
    minSpendNoResults: z.boolean().optional(),
    scaleOpportunity: z.boolean().optional(),
    sharpPerformanceDrop: z.boolean().optional(),
    clearAdjustmentOpportunity: z.boolean().optional(),
    useIntegrationPhone: z.boolean().optional(),
    overridePhone: z.union([z.string().max(32), z.null()]).optional(),
    muteStartHourUtc: z.number().int().min(0).max(23).nullable().optional(),
    muteEndHourUtc: z.number().int().min(0).max(23).nullable().optional(),
  })
  .partial();

const whatsappAlertsByChannelSchema = z
  .object({
    meta: channelWhatsappPatchSchema.nullish(),
    google: channelWhatsappPatchSchema.nullish(),
  })
  .partial();

const whatsappMessageTemplatesSchema = z
  .record(z.string().max(80), z.string().max(2000))
  .refine((o) => Object.keys(o).length <= 40, { message: "No máximo 40 chaves de modelo" });

const whatsappDigestScheduleSchema = z.object({
  enabled: z.boolean().optional(),
  hourUtc: z.number().int().min(0).max(23).optional(),
  minuteUtc: z.number().int().min(0).max(59).optional(),
  extraPhones: z.array(z.string().max(32)).max(5).optional(),
});

export const updateMarketingSettingsSchema = z
  .object({
    businessGoalMode: businessGoalModeEnum.optional(),
    primaryConversionLabel: z.union([z.string().max(120), z.null()]).optional(),
    showRevenueBlocksInLeadMode: z.boolean().optional(),
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
    goalsByChannel: goalsByChannelSchema.optional(),
    automationsByChannel: automationsByChannelSchema.optional(),
    whatsappAlertsByChannel: whatsappAlertsByChannelSchema.optional(),
    whatsappAlertCooldownMinutes: z.number().int().min(5).max(1440).nullable().optional(),
    whatsappMessageTemplates: z.union([whatsappMessageTemplatesSchema, z.null()]).optional(),
    whatsappDigestSchedule: z.union([whatsappDigestScheduleSchema, z.null()]).optional(),
  })
  .refine((d) => {
    const t = d.targetCpaBrl;
    const m = d.maxCpaBrl;
    if (t === undefined || m === undefined || t === null || m === null) return true;
    return t <= m;
  }, { message: "CPA alvo deve ser menor ou igual ao CPA máximo" });

export type UpdateMarketingSettingsInput = z.infer<typeof updateMarketingSettingsSchema>;

const channelTotalsSchema = z.object({
  totalSpendBrl: z.number().nonnegative(),
  totalResults: z.number().int().nonnegative(),
  totalAttributedValueBrl: z.number().nonnegative(),
  totalImpressions: z.number().int().nonnegative().optional(),
  totalClicks: z.number().int().nonnegative().optional(),
});

export const evaluateInsightsSchema = z.object({
  period: periodEnum.optional().default("30d"),
  /** Rótulo exibido nos alertas quando o período é customizado (ex.: intervalo de datas). */
  periodLabel: z.string().max(240).optional(),
  totalSpendBrl: z.number().nonnegative(),
  totalResults: z.number().int().nonnegative(),
  totalAttributedValueBrl: z.number().nonnegative(),
  totalImpressions: z.number().int().nonnegative().optional(),
  totalClicks: z.number().int().nonnegative().optional(),
  /** Quando true, registra ocorrências deduplicadas de regras customizadas (AlertRule). */
  persistOccurrences: z.boolean().optional(),
  /** Totais por canal para metas e alertas separados (Meta / Google). */
  channels: z
    .object({
      meta: channelTotalsSchema.optional(),
      google: channelTotalsSchema.optional(),
    })
    .optional(),
  /**
   * Quando true, dispara envio WhatsApp (Ativa CRM) se houver alertas acionáveis.
   * O padrão é false para não spammar ao abrir o painel (cada GET/POST de avaliação).
   */
  sendWhatsappAlerts: z.boolean().optional().default(false),
});

export type EvaluateInsightsInput = z.infer<typeof evaluateInsightsSchema>;

export const ativaCrmTestMessageSchema = z.object({
  message: z.string().max(2000).optional(),
});

export type AtivaCrmTestMessageInput = z.infer<typeof ativaCrmTestMessageSchema>;
