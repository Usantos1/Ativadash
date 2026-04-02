import { z } from "zod";

const PAGE = z.enum(["painel", "captacao", "conversao", "receita"]);

const SECTIONS = z.object({
  kpis: z.boolean().optional(),
  channels: z.boolean().optional(),
  funnel: z.boolean().optional(),
  chart: z.boolean().optional(),
  table: z.boolean().optional(),
  insights: z.boolean().optional(),
});

const EXPIRATION = z.enum(["never", "7d", "30d", "90d"]);

export const postDashboardShareBodySchema = z.object({
  page: PAGE,
  sections: SECTIONS.optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodLabel: z.string().min(1).max(120),
  expiration: EXPIRATION,
});

export type PostDashboardShareBody = z.infer<typeof postDashboardShareBodySchema>;

export function expirationToDate(exp: PostDashboardShareBody["expiration"]): Date | null {
  if (exp === "never") return null;
  const d = new Date();
  const days = exp === "7d" ? 7 : exp === "30d" ? 30 : 90;
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
