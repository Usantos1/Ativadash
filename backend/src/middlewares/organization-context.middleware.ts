import type { Request, Response, NextFunction } from "express";
import type { JwtPayload } from "./auth.middleware.js";
import { userHasEffectiveAccess } from "../services/tenancy-access.service.js";
import { prisma } from "../utils/prisma.js";

/**
 * Garante que o `organizationId` do JWT continua válido (membership + grants / hierarquia).
 * Se o JWT indica impersonação, valida a sessão no banco.
 */
export async function requireJwtOrganizationAccess(req: Request, res: Response, next: NextFunction) {
  const jwtUser = (req as Request & { user: JwtPayload }).user;
  try {
    if (jwtUser.isImpersonating && jwtUser.impersonationSessionId) {
      const sess = await prisma.impersonationSession.findFirst({
        where: { id: jwtUser.impersonationSessionId, isActive: true, actorUserId: jwtUser.userId },
      });
      if (!sess || sess.targetOrganizationId !== jwtUser.organizationId) {
        return res.status(403).json({
          message: "Sessão de impersonação inválida ou encerrada. Saia e tente novamente.",
          code: "IMPERSONATION_EXPIRED",
        });
      }
      return next();
    }

    const ok = await userHasEffectiveAccess(jwtUser.userId, jwtUser.organizationId);
    if (!ok) {
      return res.status(403).json({
        message: "Sem acesso ao contexto organizacional desta sessão. Troque de empresa ou entre novamente.",
      });
    }
    next();
  } catch (e) {
    next(e as Error);
  }
}
