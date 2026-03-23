import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../utils/prisma.js";

export interface JwtPayload {
  userId: string;
  email: string;
  organizationId: string;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token não informado" });
  }
  const token = authHeader.slice(7);
  void (async () => {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      const u = await prisma.user.findFirst({
        where: { id: decoded.userId, deletedAt: null },
        select: { suspendedAt: true },
      });
      if (u?.suspendedAt) {
        return res.status(403).json({ message: "Conta suspensa. Contate o administrador." });
      }
      (req as Request & { user: JwtPayload }).user = decoded;
      next();
    } catch (e) {
      if (
        e &&
        typeof e === "object" &&
        "name" in e &&
        (e.name === "JsonWebTokenError" || e.name === "TokenExpiredError")
      ) {
        return res.status(401).json({ message: "Token inválido ou expirado" });
      }
      next(e as Error);
    }
  })();
}
