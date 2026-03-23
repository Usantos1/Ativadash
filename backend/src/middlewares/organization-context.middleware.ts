import type { Request, Response, NextFunction } from "express";
import type { JwtPayload } from "./auth.middleware.js";
import { userHasEffectiveAccess } from "../services/tenancy-access.service.js";

/**
 * Garante que o `organizationId` do JWT continua válido (membership + grants / hierarquia).
 * Não substitui checagens de capability nas rotas.
 */
export async function requireJwtOrganizationAccess(req: Request, res: Response, next: NextFunction) {
  const jwtUser = (req as Request & { user: JwtPayload }).user;
  try {
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
