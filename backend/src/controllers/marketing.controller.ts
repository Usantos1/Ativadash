import type { Request, Response } from "express";
import { fetchGoogleAdsMetrics } from "../services/google-ads-metrics.service.js";
import { fetchMetaAdsMetrics } from "../services/meta-ads-metrics.service.js";

type AuthRequest = Request & { user: { organizationId: string } };

export async function getGoogleAdsMetricsHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  if (!user?.organizationId) {
    return res.status(401).json({ message: "Não autorizado" });
  }
  const period = req.query.period as string | undefined;
  const periodDays = period === "7d" ? 7 : period === "90d" ? 90 : 30;

  try {
    const result = await fetchGoogleAdsMetrics(user.organizationId, periodDays);
    return res.json(result);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: "Erro ao buscar métricas do Google Ads." });
  }
}

export async function getMetaAdsMetricsHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  if (!user?.organizationId) {
    return res.status(401).json({ message: "Não autorizado" });
  }
  const period = req.query.period as string | undefined;
  const periodDays = period === "7d" ? 7 : period === "90d" ? 90 : 30;

  try {
    const result = await fetchMetaAdsMetrics(user.organizationId, periodDays);
    return res.json(result);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: "Erro ao buscar métricas do Meta Ads." });
  }
}
