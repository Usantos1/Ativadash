import type { Request, Response } from "express";
import { z } from "zod";
import { appendAuditLog } from "../services/audit-log.service.js";
import {
  getGoogleAdsAuthUrl,
  exchangeGoogleAdsCode,
  getMetaAdsAuthUrl,
  exchangeMetaAdsCode,
  listIntegrations,
  disconnectIntegration,
  updateIntegrationClientAccount,
} from "../services/integrations.service.js";
import {
  getGoogleAdsSetup,
  syncGoogleAdsAccessibleForOrganization,
  setDefaultGoogleAdsCustomer,
  upsertGoogleAdsClientAssignment,
  deleteGoogleAdsClientAssignment,
} from "../services/google-ads-accounts.service.js";
import {
  getMetaAdsSetup,
  setDefaultMetaAdsAdAccount,
  upsertMetaAdsClientAssignment,
  deleteMetaAdsClientAssignment,
} from "../services/meta-ads-accounts.service.js";
import {
  getOrCreateMarketingSettings,
  ativaCrmHubFromSettingsDto,
} from "../services/marketing-settings.service.js";
import { env } from "../config/env.js";

const patchIntegrationClientSchema = z.object({
  clientAccountId: z.string().min(1).nullable().optional(),
});

const patchGoogleAdsDefaultSchema = z.object({
  customerId: z.union([z.string().min(1), z.null()]),
});

const putGoogleAdsAssignmentSchema = z.object({
  googleCustomerId: z.string().min(1),
});

const patchMetaAdsDefaultSchema = z.object({
  adAccountId: z.union([z.string().min(1), z.null()]),
  businessId: z.union([z.string().min(1), z.null()]),
});

const putMetaAdsAssignmentSchema = z.object({
  businessId: z.string().min(1),
  adAccountId: z.string().min(1),
});

type AuthRequest = Request & { user: { userId: string; organizationId: string } };

export async function getGoogleAdsAuthUrlHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  if (!user?.organizationId) {
    return res.status(401).json({ message: "Não autorizado" });
  }
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({
      message: "Google Ads não configurado. Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no servidor.",
    });
  }
  try {
    const url = getGoogleAdsAuthUrl(user.organizationId);
    return res.json({ url });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao gerar URL de autorização" });
  }
}

export async function googleAdsCallbackHandler(req: Request, res: Response) {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;
  const error = req.query.error as string | undefined;

  const detail = `${env.FRONTEND_URL}/marketing/integracoes/google-ads`;

  if (error) {
    return res.redirect(`${detail}?error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return res.redirect(`${detail}?error=missing_code_or_state`);
  }

  try {
    const organizationId = await exchangeGoogleAdsCode(code, state);
    if (!organizationId) {
      return res.redirect(`${detail}?error=invalid_state`);
    }
    return res.redirect(`${detail}?connected=google-ads`);
  } catch (e) {
    console.error(e);
    if (e instanceof Error && e.message.includes("Limite de integrações")) {
      return res.redirect(`${detail}?error=plan_limit_integrations`);
    }
    return res.redirect(`${detail}?error=exchange_failed`);
  }
}

export async function getMetaAdsAuthUrlHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  if (!user?.organizationId) {
    return res.status(401).json({ message: "Não autorizado" });
  }
  if (!env.META_APP_ID || !env.META_APP_SECRET) {
    return res.status(503).json({
      message: "Meta Ads não configurado. Defina META_APP_ID e META_APP_SECRET no servidor.",
    });
  }
  try {
    const url = getMetaAdsAuthUrl(user.organizationId);
    return res.json({ url });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao gerar URL de autorização" });
  }
}

export async function metaAdsCallbackHandler(req: Request, res: Response) {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;
  const error = req.query.error as string | undefined;

  const detail = `${env.FRONTEND_URL}/marketing/integracoes/meta-ads`;

  if (error) {
    return res.redirect(`${detail}?error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return res.redirect(`${detail}?error=missing_code_or_state`);
  }

  try {
    const organizationId = await exchangeMetaAdsCode(code, state);
    if (!organizationId) {
      return res.redirect(`${detail}?error=invalid_state`);
    }
    return res.redirect(`${detail}?connected=meta-ads`);
  } catch (e) {
    console.error(e);
    if (e instanceof Error && e.message.includes("Limite de integrações")) {
      return res.redirect(`${detail}?error=plan_limit_integrations`);
    }
    return res.redirect(`${detail}?error=exchange_failed`);
  }
}

export async function listHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  if (!user?.organizationId) {
    return res.status(401).json({ message: "Não autorizado" });
  }
  try {
    const [list, marketingSettings] = await Promise.all([
      listIntegrations(user.organizationId),
      getOrCreateMarketingSettings(user.organizationId),
    ]);
    return res.json({
      integrations: list,
      ativaCrmHub: ativaCrmHubFromSettingsDto(marketingSettings),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao listar integrações" });
  }
}

export async function disconnectHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  const { id } = req.params;
  if (!user?.organizationId) {
    return res.status(401).json({ message: "Não autorizado" });
  }
  if (!id) {
    return res.status(400).json({ message: "ID da integração obrigatório" });
  }
  try {
    const ok = await disconnectIntegration(id, user.organizationId);
    if (!ok) {
      return res.status(404).json({ message: "Integração não encontrada" });
    }
    await appendAuditLog({ actorUserId: user.userId, organizationId: user.organizationId, action: "integration.disconnected", entityType: "Integration", entityId: id });
    return res.json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao desvincular" });
  }
}

export async function getGoogleAdsSetupHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  if (!user?.organizationId) {
    return res.status(401).json({ message: "Não autorizado" });
  }
  try {
    const setup = await getGoogleAdsSetup(user.organizationId);
    if (!setup) {
      return res.status(404).json({ message: "Google Ads não conectado." });
    }
    return res.json(setup);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao carregar contas Google Ads." });
  }
}

export async function postGoogleAdsSyncAccessibleHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  if (!user?.organizationId) {
    return res.status(401).json({ message: "Não autorizado" });
  }
  try {
    const r = await syncGoogleAdsAccessibleForOrganization(user.organizationId);
    if (!r.ok) {
      return res.status(400).json({ message: r.message });
    }
    return res.json({ ok: true, count: r.count });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao sincronizar contas acessíveis." });
  }
}

export async function patchGoogleAdsDefaultCustomerHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  const { integrationId } = req.params;
  if (!user?.organizationId || !integrationId) {
    return res.status(400).json({ message: "Dados inválidos" });
  }
  const parsed = patchGoogleAdsDefaultSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos" });
  }
  try {
    const r = await setDefaultGoogleAdsCustomer(integrationId, user.organizationId, parsed.data.customerId);
    if (!r.ok) {
      return res.status(400).json({ message: r.message });
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao definir conta padrão." });
  }
}

export async function putGoogleAdsClientAssignmentHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  const { integrationId, clientAccountId } = req.params;
  if (!user?.organizationId || !integrationId || !clientAccountId) {
    return res.status(400).json({ message: "Dados inválidos" });
  }
  const parsed = putGoogleAdsAssignmentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos" });
  }
  try {
    const r = await upsertGoogleAdsClientAssignment(
      integrationId,
      user.organizationId,
      clientAccountId,
      parsed.data.googleCustomerId
    );
    if (!r.ok) {
      return res.status(400).json({ message: r.message });
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao vincular conta ao cliente." });
  }
}

export async function deleteGoogleAdsClientAssignmentHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  const { integrationId, clientAccountId } = req.params;
  if (!user?.organizationId || !integrationId || !clientAccountId) {
    return res.status(400).json({ message: "Dados inválidos" });
  }
  try {
    await deleteGoogleAdsClientAssignment(integrationId, user.organizationId, clientAccountId);
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao remover vínculo." });
  }
}

export async function getMetaAdsSetupHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  if (!user?.organizationId) {
    return res.status(401).json({ message: "Não autorizado" });
  }
  try {
    const setup = await getMetaAdsSetup(user.organizationId);
    if (!setup) {
      return res.status(404).json({ message: "Meta Ads não conectado." });
    }
    return res.json(setup);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao carregar contas Meta Ads." });
  }
}

export async function patchMetaAdsDefaultAdAccountHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  const { integrationId } = req.params;
  if (!user?.organizationId || !integrationId) {
    return res.status(400).json({ message: "Dados inválidos" });
  }
  const parsed = patchMetaAdsDefaultSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos" });
  }
  try {
    const r = await setDefaultMetaAdsAdAccount(
      integrationId,
      user.organizationId,
      parsed.data.adAccountId,
      parsed.data.businessId
    );
    if (!r.ok) {
      return res.status(400).json({ message: r.message });
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao definir conta padrão." });
  }
}

export async function putMetaAdsClientAssignmentHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  const { integrationId, clientAccountId } = req.params;
  if (!user?.organizationId || !integrationId || !clientAccountId) {
    return res.status(400).json({ message: "Dados inválidos" });
  }
  const parsed = putMetaAdsAssignmentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos" });
  }
  try {
    const r = await upsertMetaAdsClientAssignment(
      integrationId,
      user.organizationId,
      clientAccountId,
      parsed.data.businessId,
      parsed.data.adAccountId
    );
    if (!r.ok) {
      return res.status(400).json({ message: r.message });
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao vincular conta ao cliente." });
  }
}

export async function deleteMetaAdsClientAssignmentHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  const { integrationId, clientAccountId } = req.params;
  if (!user?.organizationId || !integrationId || !clientAccountId) {
    return res.status(400).json({ message: "Dados inválidos" });
  }
  try {
    const r = await deleteMetaAdsClientAssignment(integrationId, user.organizationId, clientAccountId);
    if (!r.ok) {
      return res.status(404).json({ message: r.message });
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao remover vínculo." });
  }
}

export async function patchIntegrationClientHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  const { id } = req.params;
  if (!user?.organizationId || !id) {
    return res.status(400).json({ message: "Dados inválidos" });
  }
  const parsed = patchIntegrationClientSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos" });
  }
  if (parsed.data.clientAccountId === undefined) {
    return res.status(400).json({ message: "Informe clientAccountId ou null para limpar" });
  }
  try {
    const row = await updateIntegrationClientAccount(
      id,
      user.organizationId,
      parsed.data.clientAccountId
    );
    if (!row) {
      return res.status(404).json({ message: "Integração não encontrada" });
    }
    return res.json({
      id: row.id,
      clientAccountId: row.clientAccountId,
    });
  } catch (e) {
    return res.status(400).json({ message: e instanceof Error ? e.message : "Erro ao atualizar" });
  }
}
