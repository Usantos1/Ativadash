import type { Request, Response, NextFunction } from "express";
import { isPlatformAdminEmail } from "../utils/platform-admin.js";
import type { JwtPayload } from "./auth.middleware.js";

export function platformAdminMiddleware(req: Request, res: Response, next: NextFunction) {
  const u = (req as Request & { user: JwtPayload }).user;
  if (!isPlatformAdminEmail(u.email)) {
    return res.status(403).json({
      message: "Acesso restrito à equipe da plataforma (configure PLATFORM_ADMIN_EMAILS).",
    });
  }
  next();
}
