import type { Request, Response } from "express";
import { z } from "zod";
import {
  getGoogleAdsAuthUrl,
  exchangeGoogleAdsCode,
  getMetaAdsAuthUrl,
  exchangeMetaAdsCode,
  listIntegrations,
  disconnectIntegration,
  updateIntegrationClientAccount,
} from "../services/integrations.service.js";
import { env } from "../config/env.js";

const patchIntegrationClientSchema = z.object({
  clientAccountId: z.string().min(1).nullable().optional(),
});

type AuthRequest = Request & { user: { organizationId: string } };

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

  const redirectBase = `${env.FRONTEND_URL}/marketing/integracoes`;

  if (error) {
    return res.redirect(`${redirectBase}?error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return res.redirect(`${redirectBase}?error=missing_code_or_state`);
  }

  try {
    const organizationId = await exchangeGoogleAdsCode(code, state);
    if (!organizationId) {
      return res.redirect(`${redirectBase}?error=invalid_state`);
    }
    return res.redirect(`${redirectBase}?connected=google-ads`);
  } catch (e) {
    console.error(e);
    if (e instanceof Error && e.message.includes("Limite de integrações")) {
      return res.redirect(`${redirectBase}?error=plan_limit_integrations`);
    }
    return res.redirect(`${redirectBase}?error=exchange_failed`);
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

  const redirectBase = `${env.FRONTEND_URL}/marketing/integracoes`;

  if (error) {
    return res.redirect(`${redirectBase}?error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return res.redirect(`${redirectBase}?error=missing_code_or_state`);
  }

  try {
    const organizationId = await exchangeMetaAdsCode(code, state);
    if (!organizationId) {
      return res.redirect(`${redirectBase}?error=invalid_state`);
    }
    return res.redirect(`${redirectBase}?connected=meta-ads`);
  } catch (e) {
    console.error(e);
    if (e instanceof Error && e.message.includes("Limite de integrações")) {
      return res.redirect(`${redirectBase}?error=plan_limit_integrations`);
    }
    return res.redirect(`${redirectBase}?error=exchange_failed`);
  }
}

export async function listHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  if (!user?.organizationId) {
    return res.status(401).json({ message: "Não autorizado" });
  }
  try {
    const list = await listIntegrations(user.organizationId);
    return res.json({ integrations: list });
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
    return res.json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao desvincular" });
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
