import type { Request, Response } from "express";
import type { JwtPayload } from "../middlewares/auth.middleware.js";
import {
  upsertManualCampaignRevenue,
  deleteManualCampaignRevenue,
  getManualRevenuesForWorkspace,
} from "../services/manual-campaign-revenue.service.js";

/**
 * Aceita `referenceDate` no corpo (ISO yyyy-MM-dd). Se ausente, a entrada é atribuída ao
 * dia atual (UTC) — respeita o padrão "Adicionar receita = dia da entrada" do dashboard.
 * Valor zero com data remove apenas a entrada daquele dia; sem data remove todo o histórico.
 */
export async function putManualRevenueHandler(req: Request, res: Response) {
  const user = (req as Request & { user: JwtPayload }).user;
  const orgId = user.organizationId;
  if (!orgId) return res.status(400).json({ message: "Organização não selecionada." });

  const { campaignId, channel, revenueAmount, referenceDate } = req.body ?? {};
  if (!campaignId || typeof campaignId !== "string")
    return res.status(400).json({ message: "campaignId obrigatório." });
  if (!channel || !["facebook", "google", "Meta", "Google"].includes(channel))
    return res.status(400).json({ message: "channel deve ser facebook/google/Meta/Google." });
  if (typeof revenueAmount !== "number" || revenueAmount < 0)
    return res.status(400).json({ message: "revenueAmount deve ser número >= 0." });

  let day: Date | undefined;
  if (referenceDate != null) {
    if (typeof referenceDate !== "string") {
      return res.status(400).json({ message: "referenceDate deve ser string ISO yyyy-MM-dd." });
    }
    const parsed = new Date(referenceDate);
    if (!Number.isFinite(parsed.getTime())) {
      return res.status(400).json({ message: "referenceDate inválida." });
    }
    day = parsed;
  }

  const normalizedChannel = channel === "Meta" || channel === "facebook" ? "facebook" : "google";

  // Valor zero sem data → remove todo o histórico (comportamento legado).
  if (revenueAmount === 0 && !day) {
    await deleteManualCampaignRevenue(orgId, campaignId);
    return res.json({ ok: true, deleted: true });
  }

  const row = await upsertManualCampaignRevenue(
    orgId,
    campaignId,
    normalizedChannel,
    revenueAmount,
    day
  );
  return res.json({
    ok: true,
    id: row?.id ?? null,
    campaignId,
    manualRevenue: revenueAmount,
    deleted: row == null,
  });
}

/**
 * GET `/marketing/manual-revenue?start=yyyy-MM-dd&end=yyyy-MM-dd` — agrega receitas manuais
 * no intervalo (inclusivo). Sem range retorna tudo (compatibilidade com chamadas antigas).
 */
export async function getManualRevenuesHandler(req: Request, res: Response) {
  const user = (req as Request & { user: JwtPayload }).user;
  const orgId = user.organizationId;
  if (!orgId) return res.status(400).json({ message: "Organização não selecionada." });

  const startRaw = typeof req.query.start === "string" ? req.query.start : undefined;
  const endRaw = typeof req.query.end === "string" ? req.query.end : undefined;
  const range: { start?: Date; end?: Date } = {};
  if (startRaw) {
    const d = new Date(startRaw);
    if (!Number.isFinite(d.getTime())) return res.status(400).json({ message: "start inválido." });
    range.start = d;
  }
  if (endRaw) {
    const d = new Date(endRaw);
    if (!Number.isFinite(d.getTime())) return res.status(400).json({ message: "end inválido." });
    range.end = d;
  }

  const rows = await getManualRevenuesForWorkspace(orgId, range.start || range.end ? range : undefined);
  return res.json({ ok: true, rows });
}
