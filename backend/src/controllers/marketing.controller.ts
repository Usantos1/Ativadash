import type { Request, Response } from "express";
import type { JwtPayload } from "../middlewares/auth.middleware.js";
import { fetchGoogleAdsMetrics } from "../services/google-ads-metrics.service.js";
import {
  fetchGoogleAdsAdGroupMetrics,
  fetchGoogleAdsSearchTerms,
  mutateGoogleCampaignStatus,
} from "../services/google-ads-metrics.service.js";
import { fetchMetaAdsMetrics } from "../services/meta-ads-metrics.service.js";
import { fetchMarketingDashboardPayload } from "../services/marketing-dashboard.service.js";
import {
  fetchMetaAdsetMetrics,
  fetchMetaAdLevelMetrics,
  fetchMetaAgeGenderBreakdown,
  updateMetaCampaignStatus,
} from "../services/meta-ads-metrics.service.js";
import { userCanReadMarketing, assertCanMutateAds } from "../services/marketing-permissions.service.js";
import { upsertMetricsSnapshot, getLatestMetricsSnapshot } from "../services/metrics-snapshot.service.js";
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
import {
  metricsSnapshotBodySchema,
  metaCampaignStatusBodySchema,
} from "../validators/marketing-extended.validator.js";

type AuthRequest = Request & { user: JwtPayload };

async function guardRead(userId: string, organizationId: string, res: Response): Promise<boolean> {
  const ok = await userCanReadMarketing(userId, organizationId);
  if (!ok) {
    res.status(403).json({ message: "Sem acesso aos dados de marketing desta empresa." });
    return false;
  }
  return true;
}

export async function getGoogleAdsMetricsHandler(req: Request, res: Response) {
  const { userId, organizationId } = (req as AuthRequest).user;
  if (!(await guardRead(userId, organizationId, res))) return;
  try {
    const range = parseMetricsDateRangeQuery({
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      period: req.query.period as string | undefined,
    });
    const result = await fetchGoogleAdsMetrics(organizationId, range);
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
  const { userId, organizationId } = (req as AuthRequest).user;
  if (!(await guardRead(userId, organizationId, res))) return;
  try {
    const range = parseMetricsDateRangeQuery({
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      period: req.query.period as string | undefined,
    });
    const result = await fetchMetaAdsMetrics(organizationId, range);
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

/** Payload agregado para o dashboard executivo (Meta-first, série diária alinhada ao resumo). */
export async function getMarketingDashboardHandler(req: Request, res: Response) {
  const { userId, organizationId } = (req as AuthRequest).user;
  if (!(await guardRead(userId, organizationId, res))) return;
  try {
    const range = parseMetricsDateRangeQuery({
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      period: req.query.period as string | undefined,
    });
    const result = await fetchMarketingDashboardPayload(organizationId, range);
    return res.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Período") || msg.includes("Data") || msg.includes("formato")) {
      return res.status(400).json({ ok: false, message: msg });
    }
    console.error(e);
    return res.status(500).json({ ok: false, message: "Erro ao montar o dashboard de marketing." });
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

export async function getMetaAdsetsHandler(req: Request, res: Response) {
  const { userId, organizationId } = (req as AuthRequest).user;
  if (!(await guardRead(userId, organizationId, res))) return;
  try {
    const range = parseMetricsDateRangeQuery({
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      period: req.query.period as string | undefined,
    });
    const result = await fetchMetaAdsetMetrics(organizationId, range);
    return res.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(400).json({ ok: false, message: msg });
  }
}

export async function getMetaAdsLevelHandler(req: Request, res: Response) {
  const { userId, organizationId } = (req as AuthRequest).user;
  if (!(await guardRead(userId, organizationId, res))) return;
  try {
    const range = parseMetricsDateRangeQuery({
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      period: req.query.period as string | undefined,
    });
    const result = await fetchMetaAdLevelMetrics(organizationId, range);
    return res.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(400).json({ ok: false, message: msg });
  }
}

export async function getMetaDemographicsHandler(req: Request, res: Response) {
  const { userId, organizationId } = (req as AuthRequest).user;
  if (!(await guardRead(userId, organizationId, res))) return;
  try {
    const range = parseMetricsDateRangeQuery({
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      period: req.query.period as string | undefined,
    });
    const result = await fetchMetaAgeGenderBreakdown(organizationId, range);
    return res.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(400).json({ ok: false, message: msg });
  }
}

export async function postMetaCampaignStatusHandler(req: Request, res: Response) {
  const { userId, organizationId } = (req as AuthRequest).user;
  const { campaignId } = req.params;
  const parsed = metaCampaignStatusBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos" });
  }
  try {
    await assertCanMutateAds(userId, organizationId);
    const out = await updateMetaCampaignStatus(organizationId, campaignId, parsed.data.status);
    if (!out.ok) {
      return res.status(400).json(out);
    }
    return res.json({ ok: true });
  } catch (e) {
    return res.status(403).json({ message: e instanceof Error ? e.message : "Sem permissão" });
  }
}

export async function getGoogleAdGroupsHandler(req: Request, res: Response) {
  const { userId, organizationId } = (req as AuthRequest).user;
  if (!(await guardRead(userId, organizationId, res))) return;
  try {
    const range = parseMetricsDateRangeQuery({
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      period: req.query.period as string | undefined,
    });
    const result = await fetchGoogleAdsAdGroupMetrics(organizationId, range);
    return res.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(400).json({ ok: false, message: msg });
  }
}

export async function getGoogleSearchTermsHandler(req: Request, res: Response) {
  const { userId, organizationId } = (req as AuthRequest).user;
  if (!(await guardRead(userId, organizationId, res))) return;
  try {
    const range = parseMetricsDateRangeQuery({
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      period: req.query.period as string | undefined,
    });
    const result = await fetchGoogleAdsSearchTerms(organizationId, range);
    return res.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(400).json({ ok: false, message: msg });
  }
}

export async function postGoogleCampaignMutateStubHandler(req: Request, res: Response) {
  const { userId, organizationId } = (req as AuthRequest).user;
  try {
    await assertCanMutateAds(userId, organizationId);
  } catch (e) {
    return res.status(403).json({ message: e instanceof Error ? e.message : "Sem permissão" });
  }
  const out = await mutateGoogleCampaignStatus(organizationId, "", true);
  return res.status(501).json(out);
}

export async function postMetricsSnapshotHandler(req: Request, res: Response) {
  const { userId, organizationId } = (req as AuthRequest).user;
  if (!(await guardRead(userId, organizationId, res))) return;
  const parsed = metricsSnapshotBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos" });
  }
  try {
    const row = await upsertMetricsSnapshot(
      organizationId,
      parsed.data.source,
      parsed.data.rangeKey,
      parsed.data.payload
    );
    return res.json({
      id: row.id,
      source: row.source,
      rangeKey: row.rangeKey,
      updatedAt: row.updatedAt.toISOString(),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao gravar snapshot" });
  }
}

export async function getMetricsSnapshotLatestHandler(req: Request, res: Response) {
  const { userId, organizationId } = (req as AuthRequest).user;
  if (!(await guardRead(userId, organizationId, res))) return;
  const source = typeof req.query.source === "string" ? req.query.source : "";
  if (!source) {
    return res.status(400).json({ message: "Parâmetro source obrigatório" });
  }
  const row = await getLatestMetricsSnapshot(organizationId, source);
  if (!row) {
    return res.status(404).json({ message: "Nenhum snapshot" });
  }
  return res.json({
    id: row.id,
    source: row.source,
    rangeKey: row.rangeKey,
    payload: JSON.parse(row.payload) as unknown,
    updatedAt: row.updatedAt.toISOString(),
  });
}
