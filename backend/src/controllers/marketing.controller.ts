import type { Request, Response } from "express";
import type { JwtPayload } from "../middlewares/auth.middleware.js";
import { fetchGoogleAdsMetrics } from "../services/google-ads-metrics.service.js";
import {
  fetchGoogleAdsAdGroupMetrics,
  fetchGoogleAdsAdMetrics,
  fetchGoogleAdsSearchTerms,
  mutateGoogleCampaignStatus,
  type GoogleAdsMetricsQueryContext,
} from "../services/google-ads-metrics.service.js";
import { fetchMetaAdsMetrics } from "../services/meta-ads-metrics.service.js";
import {
  getMarketingDashboardCached,
  getDashboardIntegrationStatusCached,
} from "../services/marketing-dashboard-cache.service.js";
import {
  fetchMetaAdsetMetrics,
  fetchMetaAdLevelMetrics,
  fetchMetaAgeGenderBreakdown,
  updateMetaCampaignStatus,
  updateMetaCampaignDailyBudget,
} from "../services/meta-ads-metrics.service.js";
import {
  userCanReadMarketing,
  assertCanMutateAds,
  assertCampaignWriteOnPlan,
} from "../services/marketing-permissions.service.js";
import {
  acknowledgeAlertOccurrence,
  listAlertOccurrences,
  orgPerformanceAlertsEnabled,
} from "../services/alert-rules.service.js";
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
  googleCampaignStatusContractSchema,
  metaCampaignBudgetContractSchema,
} from "../validators/marketing-extended.validator.js";
import type { MarketingDashboardPayload } from "../services/marketing-dashboard.service.js";
import { appendAuditLog } from "../services/audit-log.service.js";
import { mergeMarketingGoalIntoDashboardPayload } from "../services/marketing-dashboard-goal-merge.service.js";

type AuthRequest = Request & { user: JwtPayload };

/** `clientAccountId` na query força o contexto comercial (workspace); vazio ou `null` = visão só organização. */
function googleAdsQueryContextFromReq(req: Request): GoogleAdsMetricsQueryContext | undefined {
  const raw = req.query.clientAccountId;
  if (raw === undefined) return undefined;
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (s === "" || s === "null") return { clientAccountId: null };
  return { clientAccountId: String(s) };
}

/** Mesma semântica que Google/Meta em métricas — usado na chave de cache do dashboard agregado. */
function marketingDashboardClientAccountIdFromReq(req: Request): string | null | undefined {
  return googleAdsQueryContextFromReq(req)?.clientAccountId;
}

/** Corpo JSON para 403 em mutações de mídia (doc contrato: FORBIDDEN_PLAN | FORBIDDEN_ROLE). */
function jsonMutateForbidden(e: unknown): { code: string; message: string } {
  const message = e instanceof Error ? e.message : "Sem permissão";
  if (message.includes("plano") && message.includes("edição de campanhas")) {
    return { code: "FORBIDDEN_PLAN", message };
  }
  if (message.includes("Sem permissão para alterar campanhas")) {
    return { code: "FORBIDDEN_ROLE", message };
  }
  return { code: "FORBIDDEN", message };
}

function buildContractFunnel(payload: Extract<MarketingDashboardPayload, { ok: true }>) {
  const s = payload.summary;
  const steps = [
    { key: "impressions", label: "Impressões", value: s.impressions },
    { key: "clicks", label: "Cliques", value: s.clicks },
    { key: "landing_page_views", label: "Views de página de destino", value: s.landingPageViews },
    { key: "leads", label: "Leads", value: s.leads },
    { key: "purchases", label: "Compras", value: s.purchases },
  ];
  const transitions = steps.slice(0, -1).map((step, i) => {
    const next = steps[i + 1];
    return {
      from: step.key,
      to: next.key,
      rate: step.value > 0 ? next.value / step.value : null,
    };
  });
  return { steps, transitions };
}

async function guardRead(userId: string, organizationId: string, res: Response): Promise<boolean> {
  const ok = await userCanReadMarketing(userId, organizationId);
  if (!ok) {
    res.status(403).json({
      code: "FORBIDDEN_SCOPE",
      message: "Sem acesso aos dados de marketing desta empresa.",
    });
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
    const result = await fetchGoogleAdsMetrics(organizationId, range, googleAdsQueryContextFromReq(req));
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
    const result = await fetchMetaAdsMetrics(organizationId, range, googleAdsQueryContextFromReq(req));
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

function parseDashboardBypassCache(req: Request): boolean {
  const r = req.query.refresh;
  return r === "1" || r === "true";
}

/** Payload agregado (compatível); usa cache em memória + deduplicação. `?refresh=1` ignora cache. */
export async function getMarketingDashboardHandler(req: Request, res: Response) {
  const { userId, organizationId } = (req as AuthRequest).user;
  if (!(await guardRead(userId, organizationId, res))) return;
  try {
    const range = parseMetricsDateRangeQuery({
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      period: req.query.period as string | undefined,
    });
    const result = await getMarketingDashboardCached(organizationId, range, {
      bypassCache: parseDashboardBypassCache(req),
      clientAccountId: marketingDashboardClientAccountIdFromReq(req),
    });
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

export async function getMarketingDashboardSummaryHandler(req: Request, res: Response) {
  const { userId, organizationId } = (req as AuthRequest).user;
  if (!(await guardRead(userId, organizationId, res))) return;
  try {
    const range = parseMetricsDateRangeQuery({
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      period: req.query.period as string | undefined,
    });
    const result = await getMarketingDashboardCached(organizationId, range, {
      bypassCache: parseDashboardBypassCache(req),
      clientAccountId: marketingDashboardClientAccountIdFromReq(req),
    });
    if (!result.ok) return res.json(result);
    const merged = await mergeMarketingGoalIntoDashboardPayload(organizationId, result);
    if (!merged.ok) return res.json(merged);
    return res.json({
      ok: true,
      range: merged.range,
      summary: merged.summary,
      distribution: merged.distribution,
      goalContext: merged.goalContext,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Período") || msg.includes("Data") || msg.includes("formato")) {
      return res.status(400).json({ ok: false, message: msg });
    }
    console.error(e);
    return res.status(500).json({ ok: false, message: "Erro ao carregar resumo do dashboard." });
  }
}

export async function getMarketingDashboardTimeseriesHandler(req: Request, res: Response) {
  const { userId, organizationId } = (req as AuthRequest).user;
  if (!(await guardRead(userId, organizationId, res))) return;
  try {
    const range = parseMetricsDateRangeQuery({
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      period: req.query.period as string | undefined,
    });
    const result = await getMarketingDashboardCached(organizationId, range, {
      bypassCache: parseDashboardBypassCache(req),
      clientAccountId: marketingDashboardClientAccountIdFromReq(req),
    });
    if (!result.ok) return res.json(result);
    return res.json({ ok: true, range: result.range, timeseries: result.timeseries });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Período") || msg.includes("Data") || msg.includes("formato")) {
      return res.status(400).json({ ok: false, message: msg });
    }
    console.error(e);
    return res.status(500).json({ ok: false, message: "Erro ao carregar série do dashboard." });
  }
}

export async function getMarketingDashboardPerformanceHandler(req: Request, res: Response) {
  const { userId, organizationId } = (req as AuthRequest).user;
  if (!(await guardRead(userId, organizationId, res))) return;
  try {
    const range = parseMetricsDateRangeQuery({
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      period: req.query.period as string | undefined,
    });
    const result = await getMarketingDashboardCached(organizationId, range, {
      bypassCache: parseDashboardBypassCache(req),
      clientAccountId: marketingDashboardClientAccountIdFromReq(req),
    });
    if (!result.ok) return res.json(result);
    return res.json({ ok: true, range: result.range, performanceByLevel: result.performanceByLevel });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Período") || msg.includes("Data") || msg.includes("formato")) {
      return res.status(400).json({ ok: false, message: msg });
    }
    console.error(e);
    return res.status(500).json({ ok: false, message: "Erro ao carregar performance do dashboard." });
  }
}

/** Status de integrações (Prisma apenas, cache 30s). */
export async function getMarketingDashboardIntegrationHandler(req: Request, res: Response) {
  const { userId, organizationId } = (req as AuthRequest).user;
  if (!(await guardRead(userId, organizationId, res))) return;
  try {
    const range = parseMetricsDateRangeQuery({
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      period: req.query.period as string | undefined,
    });
    const result = await getDashboardIntegrationStatusCached(organizationId, range, {
      bypassCache: parseDashboardBypassCache(req),
    });
    return res.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Período") || msg.includes("Data") || msg.includes("formato")) {
      return res.status(400).json({ ok: false, message: msg });
    }
    console.error(e);
    return res.status(500).json({ ok: false, message: "Erro ao carregar status das integrações." });
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
  const {
    period,
    totalSpendBrl,
    totalResults,
    totalAttributedValueBrl,
    totalImpressions,
    totalClicks,
    persistOccurrences,
    channels,
    sendWhatsappAlerts,
  } = parsed.data;
  try {
    const result = await evaluateInsightsForOrganization(user.organizationId, {
      period,
      periodLabel: parsed.data.periodLabel,
      totalSpendBrl,
      totalResults,
      totalAttributedValueBrl,
      totalImpressions,
      totalClicks,
      persistOccurrences: persistOccurrences !== false,
      channels,
      spendTodayBrl: parsed.data.spendTodayBrl,
    });
    if (sendWhatsappAlerts === true) {
      await maybeSendAtivaCrmAlerts(user.organizationId, result).catch((err) =>
        console.error("[Ativa CRM] maybeSendAtivaCrmAlerts:", err)
      );
    }
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

async function applyMetaCampaignStatusChange(
  req: Request,
  res: Response,
  userId: string,
  organizationId: string,
  metaCampaignId: string,
  status: "PAUSED" | "ACTIVE"
) {
  try {
    await assertCanMutateAds(userId, organizationId);
    await assertCampaignWriteOnPlan(organizationId);
    const out = await updateMetaCampaignStatus(organizationId, metaCampaignId, status);
    if (!out.ok) {
      return res.status(400).json(out);
    }
    await appendAuditLog({
      actorUserId: userId,
      organizationId,
      action: "media.meta.campaign.status",
      entityType: "MetaCampaign",
      entityId: metaCampaignId,
      metadata: { status },
      ip: req.ip,
      userAgent: req.get("user-agent") ?? undefined,
    }).catch((err) => console.error("[audit] media.meta.campaign.status", err));
    return res.json({ ok: true });
  } catch (e) {
    return res.status(403).json(jsonMutateForbidden(e));
  }
}

export async function postMetaCampaignStatusHandler(req: Request, res: Response) {
  const { userId, organizationId } = (req as AuthRequest).user;
  const { campaignId } = req.params;
  const parsed = metaCampaignStatusBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos" });
  }
  return applyMetaCampaignStatusChange(req, res, userId, organizationId, campaignId, parsed.data.status);
}

/** Contrato: PATCH /marketing/meta/campaigns/:externalId/status */
export async function patchMetaCampaignStatusContractHandler(req: Request, res: Response) {
  const { userId, organizationId } = (req as AuthRequest).user;
  const { externalId } = req.params;
  const parsed = metaCampaignStatusBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos" });
  }
  return applyMetaCampaignStatusChange(req, res, userId, organizationId, externalId, parsed.data.status);
}

/** Contrato: PATCH /marketing/meta/campaigns/:externalId/budget */
export async function patchMetaCampaignBudgetContractHandler(req: Request, res: Response) {
  const { userId, organizationId } = (req as AuthRequest).user;
  const { externalId } = req.params;
  const parsed = metaCampaignBudgetContractSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos" });
  }
  try {
    await assertCanMutateAds(userId, organizationId);
    await assertCampaignWriteOnPlan(organizationId);
  } catch (e) {
    return res.status(403).json(jsonMutateForbidden(e));
  }
  const out = await updateMetaCampaignDailyBudget(organizationId, externalId, parsed.data.dailyBudget);
  if (!out.ok) {
    return res.status(400).json({ ok: false, message: out.message });
  }
  await appendAuditLog({
    actorUserId: userId,
    organizationId,
    action: "media.meta.campaign.budget",
    entityType: "MetaCampaign",
    entityId: externalId,
    metadata: { dailyBudget: parsed.data.dailyBudget },
    ip: req.ip,
    userAgent: req.get("user-agent") ?? undefined,
  }).catch((err) => console.error("[audit] media.meta.campaign.budget", err));
  return res.json({ ok: true });
}

/** Contrato: PATCH /marketing/google/campaigns/:externalId/status */
export async function patchGoogleCampaignStatusContractHandler(req: Request, res: Response) {
  const { userId, organizationId } = (req as AuthRequest).user;
  const { externalId } = req.params;
  const parsed = googleCampaignStatusContractSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos" });
  }
  try {
    await assertCanMutateAds(userId, organizationId);
    await assertCampaignWriteOnPlan(organizationId);
  } catch (e) {
    return res.status(403).json(jsonMutateForbidden(e));
  }
  const enabled = parsed.data.status === "ENABLED";
  const out = await mutateGoogleCampaignStatus(
    organizationId,
    externalId,
    enabled,
    googleAdsQueryContextFromReq(req)
  );
  if (!out.ok) {
    return res.status(400).json({ ok: false, message: out.message });
  }
  await appendAuditLog({
    actorUserId: userId,
    organizationId,
    action: "media.google.campaign.status",
    entityType: "GoogleAdsCampaign",
    entityId: externalId,
    metadata: { status: parsed.data.status },
    ip: req.ip,
    userAgent: req.get("user-agent") ?? undefined,
  }).catch((err) => console.error("[audit] media.google.campaign.status", err));
  return res.json({ ok: true });
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
    const result = await fetchGoogleAdsAdGroupMetrics(organizationId, range, googleAdsQueryContextFromReq(req));
    return res.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(400).json({ ok: false, message: msg });
  }
}

export async function getGoogleAdsAdsHandler(req: Request, res: Response) {
  const { userId, organizationId } = (req as AuthRequest).user;
  if (!(await guardRead(userId, organizationId, res))) return;
  try {
    const range = parseMetricsDateRangeQuery({
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      period: req.query.period as string | undefined,
    });
    const result = await fetchGoogleAdsAdMetrics(organizationId, range, googleAdsQueryContextFromReq(req));
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
    const result = await fetchGoogleAdsSearchTerms(organizationId, range, googleAdsQueryContextFromReq(req));
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
    await assertCampaignWriteOnPlan(organizationId);
  } catch (e) {
    return res.status(403).json(jsonMutateForbidden(e));
  }
  const out = await mutateGoogleCampaignStatus(organizationId, "", true, googleAdsQueryContextFromReq(req));
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

/** Contrato §9: GET /marketing/summary — mesmo cache que /marketing/dashboard/summary */
export async function getMarketingSummaryContractHandler(req: Request, res: Response) {
  const { userId, organizationId } = (req as AuthRequest).user;
  if (!(await guardRead(userId, organizationId, res))) return;
  try {
    const range = parseMetricsDateRangeQuery({
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      period: req.query.period as string | undefined,
    });
    const result = await getMarketingDashboardCached(organizationId, range, {
      bypassCache: parseDashboardBypassCache(req),
      clientAccountId: marketingDashboardClientAccountIdFromReq(req),
    });
    if (!result.ok) return res.json(result);
    const merged = await mergeMarketingGoalIntoDashboardPayload(organizationId, result);
    if (!merged.ok) return res.json(merged);
    return res.json({
      ok: true,
      range: merged.range,
      summary: merged.summary,
      derived: merged.summary.derived,
      compare: null,
      distribution: merged.distribution,
      goalContext: merged.goalContext,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Período") || msg.includes("Data") || msg.includes("formato")) {
      return res.status(400).json({ ok: false, message: msg });
    }
    console.error(e);
    return res.status(500).json({ ok: false, message: "Erro ao carregar resumo de marketing." });
  }
}

/** Contrato §9: GET /marketing/timeseries — pontos = série diária do dashboard */
export async function getMarketingTimeseriesContractHandler(req: Request, res: Response) {
  const { userId, organizationId } = (req as AuthRequest).user;
  if (!(await guardRead(userId, organizationId, res))) return;
  try {
    const range = parseMetricsDateRangeQuery({
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      period: req.query.period as string | undefined,
    });
    const result = await getMarketingDashboardCached(organizationId, range, {
      bypassCache: parseDashboardBypassCache(req),
      clientAccountId: marketingDashboardClientAccountIdFromReq(req),
    });
    if (!result.ok) return res.json(result);
    return res.json({
      ok: true,
      range: result.range,
      points: result.timeseries,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Período") || msg.includes("Data") || msg.includes("formato")) {
      return res.status(400).json({ ok: false, message: msg });
    }
    console.error(e);
    return res.status(500).json({ ok: false, message: "Erro ao carregar série temporal." });
  }
}

/** Contrato §9: GET /marketing/funnel */
export async function getMarketingFunnelContractHandler(req: Request, res: Response) {
  const { userId, organizationId } = (req as AuthRequest).user;
  if (!(await guardRead(userId, organizationId, res))) return;
  try {
    const range = parseMetricsDateRangeQuery({
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      period: req.query.period as string | undefined,
    });
    const result = await getMarketingDashboardCached(organizationId, range, {
      bypassCache: parseDashboardBypassCache(req),
      clientAccountId: marketingDashboardClientAccountIdFromReq(req),
    });
    if (!result.ok) return res.json(result);
    const { steps, transitions } = buildContractFunnel(result);
    return res.json({
      ok: true,
      range: result.range,
      steps,
      transitions,
      distribution: result.distribution,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Período") || msg.includes("Data") || msg.includes("formato")) {
      return res.status(400).json({ ok: false, message: msg });
    }
    console.error(e);
    return res.status(500).json({ ok: false, message: "Erro ao montar funil." });
  }
}

/** Contrato §9: GET /marketing/detail/campaigns — linhas = campanhas Meta do dashboard (paginação) */
export async function getMarketingDetailCampaignsHandler(req: Request, res: Response) {
  const { userId, organizationId } = (req as AuthRequest).user;
  if (!(await guardRead(userId, organizationId, res))) return;
  try {
    const range = parseMetricsDateRangeQuery({
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      period: req.query.period as string | undefined,
    });
    const result = await getMarketingDashboardCached(organizationId, range, {
      bypassCache: parseDashboardBypassCache(req),
      clientAccountId: marketingDashboardClientAccountIdFromReq(req),
    });
    if (!result.ok) return res.json(result);
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? "50"), 10) || 50));
    const channel = typeof req.query.channel === "string" ? req.query.channel.toLowerCase() : "";
    let rows = result.performanceByLevel.campaigns;
    if (channel === "google") {
      rows = [];
    }
    const total = rows.length;
    const start = (page - 1) * pageSize;
    const pageRows = rows.slice(start, start + pageSize);
    return res.json({
      ok: true,
      range: result.range,
      channel: channel || "all",
      source: "meta",
      rows: pageRows,
      page: { index: page, size: pageSize, total },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Período") || msg.includes("Data") || msg.includes("formato")) {
      return res.status(400).json({ ok: false, message: msg });
    }
    console.error(e);
    return res.status(500).json({ ok: false, message: "Erro ao listar campanhas." });
  }
}

/** Histórico de disparos de regras customizadas (AlertOccurrence). */
export async function getMarketingAlertOccurrencesHandler(req: Request, res: Response) {
  const { userId, organizationId } = (req as AuthRequest).user;
  if (!(await guardRead(userId, organizationId, res))) return;
  const raw = parseInt(String(req.query.limit ?? "30"), 10);
  const limit = Number.isFinite(raw) ? raw : 30;
  try {
    const items = await listAlertOccurrences(organizationId, { limit });
    return res.json({ items });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao listar ocorrências de alerta." });
  }
}

/** Marca ocorrência de regra como vista (central de metas / painel). */
export async function patchMarketingAlertOccurrenceAckHandler(req: Request, res: Response) {
  const { userId, organizationId } = (req as AuthRequest).user;
  if (!organizationId) {
    return res.status(401).json({ message: "Não autorizado" });
  }
  const okRead = await userCanReadMarketing(userId, organizationId);
  if (!okRead) {
    return res.status(403).json({ message: "Sem acesso aos dados de marketing desta empresa." });
  }
  const featureOn = await orgPerformanceAlertsEnabled(organizationId);
  if (!featureOn) {
    return res.status(403).json({ message: "Alertas avançados não estão ativos no plano desta empresa." });
  }
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ message: "ID obrigatório." });
  }
  try {
    const result = await acknowledgeAlertOccurrence(organizationId, id);
    if (!result.ok) {
      return res.status(404).json({ message: "Ocorrência não encontrada." });
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao atualizar ocorrência." });
  }
}

/** Contrato §11: GET /marketing/alerts/insight — alertas a partir do resumo do período (sem enviar WhatsApp) */
export async function getMarketingAlertsInsightHandler(req: Request, res: Response) {
  const { userId, organizationId } = (req as AuthRequest).user;
  if (!(await guardRead(userId, organizationId, res))) return;
  try {
    const range = parseMetricsDateRangeQuery({
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      period: req.query.period as string | undefined,
    });
    const result = await getMarketingDashboardCached(organizationId, range, {
      bypassCache: parseDashboardBypassCache(req),
      clientAccountId: marketingDashboardClientAccountIdFromReq(req),
    });
    if (!result.ok) {
      return res.json({
        ok: false,
        message: result.message,
        alerts: [],
        kpis: { cpa: null, roas: null },
        periodLabel: "",
      });
    }
    const s = result.summary;
    const totalResults = s.leads + s.purchases;
    const insight = await evaluateInsightsForOrganization(organizationId, {
      period: `${range.start}_${range.end}`,
      periodLabel: `${range.start} a ${range.end}`,
      totalSpendBrl: s.spend,
      totalResults,
      totalAttributedValueBrl: s.purchaseValue,
      totalImpressions: s.impressions,
      totalClicks: s.clicks,
      persistOccurrences: false,
    });
    return res.json({
      ok: true,
      range: result.range,
      kpis: insight.kpis,
      alerts: insight.alerts,
      periodLabel: insight.periodLabel,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Período") || msg.includes("Data") || msg.includes("formato")) {
      return res.status(400).json({ ok: false, message: msg });
    }
    console.error(e);
    return res.status(500).json({ ok: false, message: "Erro ao avaliar alertas." });
  }
}
