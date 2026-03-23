import type { Request, Response } from "express";
import {
  login as loginService,
  register as registerService,
  refreshAccessToken,
  getAuthProfileExtended,
  switchActiveOrganization,
  updateProfile,
} from "../services/auth.service.js";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  refreshTokenSchema,
  switchOrganizationSchema,
  registerWithInviteSchema,
  acceptInviteTokenSchema,
} from "../validators/auth.validator.js";
import {
  getInvitationPreviewByToken,
  acceptInvitationNewUser,
  acceptInvitationExistingUser,
} from "../services/invitations.service.js";
import { updateProfileSchema } from "../validators/workspace.validator.js";
import { respondIfDatabaseUnavailable } from "../utils/prisma-connection-error.js";

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
    if (respondIfDatabaseUnavailable(res, e, "POST /api/auth/login")) return;
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
    if (respondIfDatabaseUnavailable(res, e, "POST /api/auth/register")) return;
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

type JwtUser = { userId: string; email: string; organizationId: string };

export async function me(req: Request, res: Response) {
  const jwtUser = (req as Request & { user: JwtUser }).user;
  try {
    const profile = await getAuthProfileExtended(jwtUser.userId, jwtUser.organizationId);
    if (!profile) {
      return res.status(403).json({
        message: "Usuário não está associado a esta empresa ou o vínculo foi removido.",
      });
    }
    return res.json(profile);
  } catch (e) {
    if (respondIfDatabaseUnavailable(res, e, "GET /api/auth/me")) return;
    console.error(e);
    return res.status(500).json({ message: "Erro ao carregar perfil" });
  }
}

export async function switchOrganization(req: Request, res: Response) {
  const jwtUser = (req as Request & { user: JwtUser }).user;
  const parsed = switchOrganizationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.errors[0]?.message ?? "Dados inválidos",
    });
  }
  try {
    const result = await switchActiveOrganization(jwtUser.userId, parsed.data.organizationId);
    return res.json(result);
  } catch (e) {
    if (respondIfDatabaseUnavailable(res, e, "POST /api/auth/switch-organization")) return;
    return res.status(403).json({
      message: e instanceof Error ? e.message : "Não foi possível trocar de empresa",
    });
  }
}

export async function patchProfile(req: Request, res: Response) {
  const jwtUser = (req as Request & { user: { userId: string } }).user;
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.errors[0]?.message ?? "Dados inválidos",
    });
  }
  try {
    const user = await updateProfile(jwtUser.userId, parsed.data.name);
    return res.json(user);
  } catch {
    return res.status(500).json({ message: "Erro ao atualizar perfil" });
  }
}

export async function invitePreview(req: Request, res: Response) {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!token) {
    return res.status(400).json({ message: "Token obrigatório" });
  }
  const preview = await getInvitationPreviewByToken(token);
  if (!preview) {
    return res.status(404).json({ message: "Convite inválido ou expirado" });
  }
  return res.json(preview);
}

export async function registerWithInvite(req: Request, res: Response) {
  const parsed = registerWithInviteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.errors[0]?.message ?? "Dados inválidos",
    });
  }
  try {
    const result = await acceptInvitationNewUser(
      parsed.data.token,
      parsed.data.name,
      parsed.data.password
    );
    return res.status(201).json(result);
  } catch (e) {
    if (respondIfDatabaseUnavailable(res, e, "POST /api/auth/register-with-invite")) return;
    return res.status(400).json({
      message: e instanceof Error ? e.message : "Não foi possível concluir o cadastro",
    });
  }
}

export async function acceptInviteLoggedIn(req: Request, res: Response) {
  const jwtUser = (req as Request & { user: { userId: string; email: string } }).user;
  const parsed = acceptInviteTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.errors[0]?.message ?? "Dados inválidos",
    });
  }
  try {
    const result = await acceptInvitationExistingUser(
      parsed.data.token,
      jwtUser.userId,
      jwtUser.email
    );
    return res.json(result);
  } catch (e) {
    if (respondIfDatabaseUnavailable(res, e, "POST /api/auth/accept-invite")) return;
    return res.status(400).json({
      message: e instanceof Error ? e.message : "Não foi possível aceitar o convite",
    });
  }
}
