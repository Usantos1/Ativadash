import type { Request, Response } from "express";
import type { JwtPayload } from "../middlewares/auth.middleware.js";
import {
  startImpersonation,
  stopImpersonation,
  getImpersonationStatus,
} from "../services/impersonation.service.js";
import {
  switchActiveOrganization,
  type ImpersonationTokenContext,
} from "../services/auth.service.js";

type Authed = Request & { user: JwtPayload };

export async function impersonationStart(req: Request, res: Response) {
  const { userId, email, organizationId, isImpersonating } = (req as Authed).user;
  const { targetOrganizationId, reason } = req.body as {
    targetOrganizationId?: string;
    reason?: string;
  };

  if (!targetOrganizationId) {
    return res.status(400).json({ message: "targetOrganizationId é obrigatório" });
  }

  if (isImpersonating) {
    return res.status(400).json({
      message: "Já está em modo impersonação. Saia primeiro antes de entrar em outra empresa.",
      code: "CASCADE_BLOCKED",
    });
  }

  try {
    const result = await startImpersonation({
      actorUserId: userId,
      actorEmail: email,
      sourceOrganizationId: organizationId,
      targetOrganizationId,
      reason,
      ip: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
    });

    const impCtx: ImpersonationTokenContext = {
      isImpersonating: true,
      impersonationSessionId: result.session.id,
      sourceOrganizationId: organizationId,
    };

    const switchResult = await switchActiveOrganization(
      userId,
      targetOrganizationId,
      { previousOrganizationId: organizationId, ip: req.ip, userAgent: req.get("user-agent") },
      impCtx
    );

    return res.status(200).json({
      ...switchResult,
      impersonation: {
        isImpersonating: true,
        impersonationSessionId: result.session.id,
        sourceOrganizationId: organizationId,
        targetOrganizationId,
        targetOrganizationName: result.targetOrganization.name,
        assumedRole: result.session.assumedRole,
        startedAt: result.session.startedAt,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Não foi possível iniciar impersonação";
    return res.status(403).json({ message: msg });
  }
}

export async function impersonationStop(req: Request, res: Response) {
  const { userId, isImpersonating, impersonationSessionId, sourceOrganizationId } = (req as Authed).user;

  if (!isImpersonating || !impersonationSessionId || !sourceOrganizationId) {
    return res.status(400).json({ message: "Nenhuma impersonação ativa nesta sessão." });
  }

  try {
    await stopImpersonation({
      actorUserId: userId,
      impersonationSessionId,
      ip: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
    });

    const switchResult = await switchActiveOrganization(
      userId,
      sourceOrganizationId,
      { previousOrganizationId: (req as Authed).user.organizationId, ip: req.ip, userAgent: req.get("user-agent") }
    );

    return res.status(200).json({
      ...switchResult,
      impersonation: { isImpersonating: false },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Não foi possível encerrar impersonação";
    return res.status(500).json({ message: msg });
  }
}

export async function impersonationMe(req: Request, res: Response) {
  const { userId, isImpersonating, impersonationSessionId } = (req as Authed).user;

  const status = await getImpersonationStatus(
    userId,
    isImpersonating ? impersonationSessionId : undefined
  );

  return res.json(status);
}
