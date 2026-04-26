import type { Request, Response } from "express";
import {
  login as loginService,
  register as registerService,
  refreshAccessToken,
  getAuthProfileExtended,
  switchActiveOrganization,
  updateProfile,
  getMeContext,
  changePasswordForUser,
} from "../services/auth.service.js";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  refreshTokenSchema,
  switchOrganizationSchema,
  registerWithInviteSchema,
  acceptInviteTokenSchema,
  changePasswordSchema,
  resetPasswordSchema,
} from "../validators/auth.validator.js";
import {
  getInvitationPreviewByToken,
  acceptInvitationNewUser,
  acceptInvitationExistingUser,
} from "../services/invitations.service.js";
import {
  requestPasswordReset,
  lookupPasswordResetToken,
  confirmPasswordReset,
} from "../services/password-reset.service.js";
import { updateProfileSchema } from "../validators/workspace.validator.js";
import { respondIfDatabaseUnavailable } from "../utils/prisma-connection-error.js";
import { appendAuditLog } from "../services/audit-log.service.js";

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.errors[0]?.message ?? "Dados inválidos",
    });
  }
  try {
    const result = await loginService(parsed.data);
    await appendAuditLog({ actorUserId: result.user.id, organizationId: result.user.organizationId, action: "auth.login", entityType: "UserSession", ip: req.ip, userAgent: req.headers["user-agent"] as string ?? null });
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
  /**
   * Resposta sempre genérica para evitar enumeração de contas.
   * O envio acontece em background do ponto de vista do cliente.
   */
  try {
    await requestPasswordReset(parsed.data.email, {
      ip: req.ip,
      userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
    });
  } catch (e) {
    if (respondIfDatabaseUnavailable(res, e, "POST /api/auth/forgot-password")) return;
    console.error("[auth] requestPasswordReset falhou:", e);
  }
  return res.json({
    message: "Se existir uma conta com esse e-mail, você receberá as instruções em alguns instantes.",
  });
}

/** GET /api/auth/reset-password/validate?token=... — usado pela tela para mostrar para qual conta é. */
export async function validateResetToken(req: Request, res: Response) {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!token) {
    return res.status(400).json({ valid: false, message: "Token obrigatório" });
  }
  try {
    const lookup = await lookupPasswordResetToken(token);
    if (!lookup) {
      return res.status(404).json({ valid: false, message: "Token inválido ou expirado" });
    }
    const masked = lookup.email.replace(/(^.).+(@.+$)/, (_m, a, b) => `${a}***${b}`);
    return res.json({ valid: true, email: masked, firstName: lookup.firstName });
  } catch (e) {
    if (respondIfDatabaseUnavailable(res, e, "GET /api/auth/reset-password/validate")) return;
    return res.status(500).json({ valid: false, message: "Erro ao validar token" });
  }
}

/** POST /api/auth/reset-password — confirma a redefinição com token + nova senha. */
export async function resetPassword(req: Request, res: Response) {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.errors[0]?.message ?? "Dados inválidos",
    });
  }
  try {
    const result = await confirmPasswordReset(parsed.data.token, parsed.data.newPassword, {
      ip: req.ip,
      userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
    });
    await appendAuditLog({
      actorUserId: result.userId,
      action: "auth.password_reset_completed",
      entityType: "User",
      entityId: result.userId,
      ip: req.ip,
      userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
    });
    return res.json({ ok: true });
  } catch (e) {
    if (respondIfDatabaseUnavailable(res, e, "POST /api/auth/reset-password")) return;
    const message = e instanceof Error ? e.message : "Erro ao redefinir senha";
    if (
      message === "Token inválido ou expirado" ||
      message === "Nova senha: mínimo 6 caracteres" ||
      message === "Conta indisponível para redefinição" ||
      message === "Conta suspensa. Contate o administrador."
    ) {
      return res.status(400).json({ message });
    }
    console.error("[auth] confirmPasswordReset falhou:", e);
    return res.status(500).json({ message: "Erro ao redefinir senha" });
  }
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

type JwtUser = {
  userId: string;
  email: string;
  organizationId: string;
  isImpersonating?: boolean;
  impersonationSessionId?: string;
  sourceOrganizationId?: string;
};

export async function me(req: Request, res: Response) {
  const jwtUser = (req as Request & { user: JwtUser }).user;
  try {
    const profile = await getAuthProfileExtended(jwtUser.userId, jwtUser.organizationId);
    if (!profile) {
      return res.status(403).json({
        message: "Usuário não está associado a esta empresa ou o vínculo foi removido.",
      });
    }
    const impersonationFields = jwtUser.isImpersonating
      ? {
          isImpersonating: true as const,
          impersonationSessionId: jwtUser.impersonationSessionId,
          sourceOrganizationId: jwtUser.sourceOrganizationId,
        }
      : {};
    return res.json({ ...profile, ...impersonationFields });
  } catch (e) {
    if (respondIfDatabaseUnavailable(res, e, "GET /api/auth/me")) return;
    console.error(e);
    return res.status(500).json({ message: "Erro ao carregar perfil" });
  }
}

export async function switchOrganization(req: Request, res: Response) {
  const jwtUser = (req as Request & { user: JwtUser }).user;

  if (jwtUser.isImpersonating) {
    return res.status(400).json({
      message: "Não é possível trocar de organização durante impersonação. Saia primeiro.",
      code: "IMPERSONATION_ACTIVE",
    });
  }

  const parsed = switchOrganizationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.errors[0]?.message ?? "Dados inválidos",
    });
  }
  try {
    const result = await switchActiveOrganization(jwtUser.userId, parsed.data.organizationId, {
      previousOrganizationId: jwtUser.organizationId,
      ip: req.ip,
      userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
    });
    return res.json(result);
  } catch (e) {
    if (respondIfDatabaseUnavailable(res, e, "POST /api/auth/switch-organization")) return;
    return res.status(403).json({
      message: e instanceof Error ? e.message : "Não foi possível trocar de empresa",
    });
  }
}

export async function meContext(req: Request, res: Response) {
  const jwtUser = (req as Request & { user: JwtUser }).user;
  try {
    const ctx = await getMeContext(jwtUser.userId, jwtUser.organizationId);
    if (!ctx) {
      return res.status(403).json({ message: "Contexto organizacional inválido para esta sessão." });
    }
    return res.json(ctx);
  } catch (e) {
    if (respondIfDatabaseUnavailable(res, e, "GET /api/auth/me/context")) return;
    console.error(e);
    return res.status(500).json({ message: "Erro ao carregar contexto" });
  }
}

/** Alias canônico da troca de contexto (mesmo comportamento que switch-organization). */
export async function activeOrganization(req: Request, res: Response) {
  return switchOrganization(req, res);
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
    await appendAuditLog({ actorUserId: jwtUser.userId, action: "profile.updated", entityType: "User", entityId: jwtUser.userId, metadata: { name: parsed.data.name } });
    return res.json(user);
  } catch {
    return res.status(500).json({ message: "Erro ao atualizar perfil" });
  }
}

export async function patchPassword(req: Request, res: Response) {
  const jwtUser = (req as Request & { user: { userId: string } }).user;
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? "Dados inválidos";
    return res.status(400).json({ message: msg });
  }
  try {
    await changePasswordForUser(jwtUser.userId, parsed.data.currentPassword, parsed.data.newPassword);
    await appendAuditLog({ actorUserId: jwtUser.userId, action: "auth.password_changed", entityType: "User", entityId: jwtUser.userId });
    return res.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao alterar senha";
    if (message === "Senha atual incorreta") {
      return res.status(400).json({ message });
    }
    if (message === "Usuário não encontrado") {
      return res.status(404).json({ message });
    }
    return res.status(500).json({ message: "Erro ao alterar senha" });
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
