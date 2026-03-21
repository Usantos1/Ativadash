import type { Request, Response } from "express";
import {
  login as loginService,
  register as registerService,
  refreshAccessToken,
  getAuthProfile,
} from "../services/auth.service.js";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  refreshTokenSchema,
} from "../validators/auth.validator.js";

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.errors[0]?.message ?? "Dados inválidos",
    });
  }
  try {
    const result = await loginService(parsed.data);
    return res.json(result);
  } catch (e) {
    return res.status(401).json({
      message: e instanceof Error ? e.message : "Erro ao entrar",
    });
  }
}

export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.errors[0]?.message ?? "Dados inválidos",
    });
  }
  try {
    const result = await registerService(parsed.data);
    return res.status(201).json(result);
  } catch (e) {
    return res.status(400).json({
      message: e instanceof Error ? e.message : "Erro ao cadastrar",
    });
  }
}

export async function forgotPassword(req: Request, res: Response) {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.errors[0]?.message ?? "E-mail inválido",
    });
  }
  return res.json({
    message: "Se existir uma conta com esse e-mail, você receberá as instruções.",
  });
}

export async function refresh(req: Request, res: Response) {
  const parsed = refreshTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.errors[0]?.message ?? "Refresh token obrigatório",
    });
  }
  try {
    const result = await refreshAccessToken(parsed.data.refreshToken);
    return res.json(result);
  } catch {
    return res.status(401).json({ message: "Refresh token inválido ou expirado" });
  }
}

export async function me(req: Request, res: Response) {
  const jwtUser = (req as Request & { user: { userId: string; email: string; organizationId: string } }).user;
  const profile = await getAuthProfile(jwtUser.userId, jwtUser.organizationId);
  if (!profile) {
    return res.status(403).json({
      message: "Usuário não está associado a esta empresa ou o vínculo foi removido.",
    });
  }
  return res.json(profile);
}
