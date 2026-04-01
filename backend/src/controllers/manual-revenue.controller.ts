import type { Request, Response } from "express";
import type { JwtPayload } from "../middlewares/auth.middleware.js";
import {
  upsertManualCampaignRevenue,
  deleteManualCampaignRevenue,
  getManualRevenuesForWorkspace,
} from "../services/manual-campaign-revenue.service.js";

export async function putManualRevenueHandler(req: Request, res: Response) {
  const user = (req as Request & { user: JwtPayload }).user;
  const orgId = user.organizationId;
  if (!orgId) return res.status(400).json({ message: "Organização não selecionada." });

  const { campaignId, channel, revenueAmount } = req.body ?? {};
  if (!campaignId || typeof campaignId !== "string")
    return res.status(400).json({ message: "campaignId obrigatório." });
  if (!channel || !["facebook", "google", "Meta", "Google"].includes(channel))
    return res.status(400).json({ message: "channel deve ser facebook/google/Meta/Google." });
  if (typeof revenueAmount !== "number" || revenueAmount < 0)
    return res.status(400).json({ message: "revenueAmount deve ser número >= 0." });

  const normalizedChannel = channel === "Meta" || channel === "facebook" ? "facebook" : "google";

  if (revenueAmount === 0) {
    await deleteManualCampaignRevenue(orgId, campaignId);
    return res.json({ ok: true, deleted: true });
  }

  const row = await upsertManualCampaignRevenue(orgId, campaignId, normalizedChannel, revenueAmount);
  return res.json({ ok: true, id: row.id, campaignId, manualRevenue: revenueAmount });
}

export async function getManualRevenuesHandler(req: Request, res: Response) {
  const user = (req as Request & { user: JwtPayload }).user;
  const orgId = user.organizationId;
  if (!orgId) return res.status(400).json({ message: "Organização não selecionada." });

  const rows = await getManualRevenuesForWorkspace(orgId);
  return res.json({ ok: true, rows });
}
