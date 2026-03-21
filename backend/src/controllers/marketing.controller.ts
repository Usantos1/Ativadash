import type { Request, Response } from "express";
import { fetchGoogleAdsMetrics } from "../services/google-ads-metrics.service.js";
import { fetchMetaAdsMetrics } from "../services/meta-ads-metrics.service.js";
import { parseMetricsDateRangeQuery } from "../utils/marketing-date-range.js";
import {
  evaluateInsightsForOrganization,
  getOrCreateMarketingSettings,
  maybeSendAtivaCrmAlerts,
  sendAtivaCrmTestForOrganization,
  updateMarketingSettings,
} from "../services/marketing-settings.service.js";
import {
  ativaCrmTestMessageSchema,
  evaluateInsightsSchema,
  updateMarketingSettingsSchema,
} from "../validators/marketing-settings.validator.js";

type AuthRequest = Request & { user: { organizationId: string } };

export async function getGoogleAdsMetricsHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  if (!user?.organizationId) {
    return res.status(401).json({ message: "Não autorizado" });
  }
  try {
    const range = parseMetricsDateRangeQuery({
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      period: req.query.period as string | undefined,
    });
    const result = await fetchGoogleAdsMetrics(user.organizationId, range);
    return res.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Período") || msg.includes("Data") || msg.includes("formato")) {
      return res.status(400).json({ ok: false, message: msg });
    }
    console.error(e);
    return res.status(500).json({ ok: false, message: "Erro ao buscar métricas do Google Ads." });
  }
}

export async function getMetaAdsMetricsHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  if (!user?.organizationId) {
    return res.status(401).json({ message: "Não autorizado" });
  }
  try {
    const range = parseMetricsDateRangeQuery({
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      period: req.query.period as string | undefined,
    });
    const result = await fetchMetaAdsMetrics(user.organizationId, range);
    return res.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Período") || msg.includes("Data") || msg.includes("formato")) {
      return res.status(400).json({ ok: false, message: msg });
    }
    console.error(e);
    return res.status(500).json({ ok: false, message: "Erro ao buscar métricas do Meta Ads." });
  }
}

export async function getMarketingSettingsHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  if (!user?.organizationId) {
    return res.status(401).json({ message: "Não autorizado" });
  }
  try {
    const settings = await getOrCreateMarketingSettings(user.organizationId);
    return res.json({ settings });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao carregar configurações." });
  }
}

export async function putMarketingSettingsHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  if (!user?.organizationId) {
    return res.status(401).json({ message: "Não autorizado" });
  }
  const parsed = updateMarketingSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Dados inválidos",
      issues: parsed.error.flatten(),
    });
  }
  try {
    const settings = await updateMarketingSettings(user.organizationId, parsed.data);
    return res.json({ settings });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao salvar configurações." });
  }
}

export async function postMarketingInsightsHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  if (!user?.organizationId) {
    return res.status(401).json({ message: "Não autorizado" });
  }
  const parsed = evaluateInsightsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Dados inválidos",
      issues: parsed.error.flatten(),
    });
  }
  const { period, totalSpendBrl, totalResults, totalAttributedValueBrl } = parsed.data;
  try {
    const result = await evaluateInsightsForOrganization(user.organizationId, {
      period,
      periodLabel: parsed.data.periodLabel,
      totalSpendBrl,
      totalResults,
      totalAttributedValueBrl,
    });
    await maybeSendAtivaCrmAlerts(user.organizationId, result).catch((err) =>
      console.error("[Ativa CRM] maybeSendAtivaCrmAlerts:", err)
    );
    return res.json(result);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao avaliar indicadores." });
  }
}

export async function postAtivaCrmTestHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  if (!user?.organizationId) {
    return res.status(401).json({ message: "Não autorizado" });
  }
  const parsed = ativaCrmTestMessageSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      message: "Dados inválidos",
      issues: parsed.error.flatten(),
    });
  }
  try {
    const out = await sendAtivaCrmTestForOrganization(user.organizationId, parsed.data.message);
    if (!out.ok) {
      return res.status(400).json({ message: out.message });
    }
    return res.json({ ok: true, message: "Mensagem de teste enviada." });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao enviar teste." });
  }
}
