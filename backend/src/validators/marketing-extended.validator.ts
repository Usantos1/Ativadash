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

/** Valor na moeda da conta (ex.: BRL inteiro ou com centavos); o servidor converte para unidade mínima da Meta. */
export const metaCampaignBudgetContractSchema = z.object({
  dailyBudget: z.number().positive(),
});

/** Reaplica estado anterior (desfazer) em lote — mesmas permissões que PATCH individuais. */
export const marketingCampaignRollbackItemSchema = z
  .object({
    channel: z.enum(["meta", "google"]),
    externalId: z.string().min(1).max(256),
    metaStatus: z.enum(["PAUSED", "ACTIVE"]).optional(),
    googleStatus: z.enum(["ENABLED", "PAUSED"]).optional(),
    dailyBudget: z.number().positive().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.channel === "meta") {
      const hasS = val.metaStatus != null;
      const hasB = val.dailyBudget != null;
      if (hasS === hasB) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Item Meta: informe exatamente um de metaStatus ou dailyBudget.",
        });
      }
    } else {
      if (val.googleStatus == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Item Google: informe googleStatus.",
        });
      }
      if (val.metaStatus != null || val.dailyBudget != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Item Google: não use metaStatus nem dailyBudget.",
        });
      }
    }
  });

export const marketingCampaignRollbackBodySchema = z.object({
  items: z.array(marketingCampaignRollbackItemSchema).min(1).max(80),
});
