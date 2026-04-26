import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../utils/prisma.js";
import { env } from "../config/env.js";
import { sendMail } from "./mailer.service.js";

const SALT_ROUNDS = 10;
/** Quantos minutos um link recém-emitido continua válido. */
const RESET_TTL_MIN = env.PASSWORD_RESET_TTL_MIN;
/**
 * Limite de pedidos por usuário em janela curta (anti-flood). Se já houver N tokens
 * ativos criados nos últimos 15 minutos, novos pedidos são silenciosamente ignorados
 * (a resposta ao endpoint sempre é genérica para não vazar existência de e-mails).
 */
const MAX_ACTIVE_TOKENS_WINDOW = 5;
const ACTIVE_TOKENS_WINDOW_MS = 15 * 60 * 1000;

function sha256(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return c;
    }
  });
}

function buildResetEmail(opts: {
  userName: string | null;
  resetUrl: string;
  ttlMinutes: number;
}): { subject: string; html: string; text: string } {
  const safeName = escapeHtml((opts.userName?.trim().split(/\s+/)[0] ?? "").trim());
  const greeting = safeName ? `Olá, ${safeName}!` : "Olá!";
  const subject = "Redefinição de senha — Ativa Dash";
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
  <body style="margin:0;background:#f1f5f9;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
    <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;box-shadow:0 6px 24px rgba(15,23,42,0.06);overflow:hidden;">
        <tr>
          <td style="padding:28px 32px 8px 32px;">
            <h1 style="margin:0 0 12px 0;font-size:20px;color:#0f172a;">${greeting}</h1>
            <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#334155;">
              Recebemos um pedido para redefinir a senha da sua conta no <strong>Ativa Dash</strong>.
              Para criar uma nova senha, clique no botão abaixo. O link é válido por
              <strong>${opts.ttlMinutes} minutos</strong> e só pode ser usado uma vez.
            </p>
            <p style="margin:24px 0;text-align:center;">
              <a href="${opts.resetUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:9999px;">
                Redefinir minha senha
              </a>
            </p>
            <p style="margin:0 0 12px 0;font-size:12px;color:#64748b;">
              Se o botão não funcionar, copie e cole este endereço no navegador:
            </p>
            <p style="margin:0 0 24px 0;font-size:12px;color:#1e293b;word-break:break-all;">
              <a href="${opts.resetUrl}" style="color:#2563eb;">${opts.resetUrl}</a>
            </p>
            <hr style="border:0;border-top:1px solid #e2e8f0;margin:8px 0 18px 0;" />
            <p style="margin:0 0 6px 0;font-size:12px;color:#64748b;">
              Se você não solicitou essa alteração, pode ignorar este e-mail — sua senha continuará a mesma.
            </p>
          </td>
        </tr>
      </table>
      <p style="margin:18px 0 0 0;font-size:11px;color:#94a3b8;text-align:center;">
        © ${new Date().getFullYear()} Ativa Dash · Esta é uma mensagem automática, não responda.
      </p>
    </div>
  </body>
</html>`;
  const text = [
    greeting,
    "",
    "Recebemos um pedido para redefinir a senha da sua conta no Ativa Dash.",
    `Use o link abaixo (válido por ${opts.ttlMinutes} minutos):`,
    opts.resetUrl,
    "",
    "Se você não solicitou, ignore este e-mail.",
  ].join("\n");
  return { subject, html, text };
}

export type RequestPasswordResetMeta = {
  ip?: string | null;
  userAgent?: string | null;
};

/**
 * Cria token (se o e-mail existir) e dispara o e-mail. Sempre devolve algo neutro:
 * o controller deve usar a mesma resposta independente de o usuário existir,
 * para evitar enumeração de contas.
 */
export async function requestPasswordReset(
  emailRaw: string,
  meta: RequestPasswordResetMeta = {}
): Promise<void> {
  const email = emailRaw.trim().toLowerCase();
  if (!email.includes("@")) return;

  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
  });
  if (!user) return;
  if (user.suspendedAt) return;

  const recentActive = await prisma.passwordResetToken.count({
    where: {
      userId: user.id,
      usedAt: null,
      createdAt: { gt: new Date(Date.now() - ACTIVE_TOKENS_WINDOW_MS) },
      expiresAt: { gt: new Date() },
    },
  });
  if (recentActive >= MAX_ACTIVE_TOKENS_WINDOW) return;

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TTL_MIN * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: {
      tokenHash,
      userId: user.id,
      expiresAt,
      requestedIp: meta.ip ?? null,
      requestedUserAgent: meta.userAgent ?? null,
    },
  });

  const base = env.FRONTEND_URL.replace(/\/+$/, "");
  const resetUrl = `${base}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const { subject, html, text } = buildResetEmail({
    userName: user.name,
    resetUrl,
    ttlMinutes: RESET_TTL_MIN,
  });
  await sendMail({ to: user.email, subject, html, text });
}

export type ResetTokenLookup = {
  email: string;
  /** Primeiro nome (opcional). */
  firstName: string | null;
};

/**
 * Lê um token sem consumi-lo (para a tela de "definir nova senha" mostrar para qual conta é).
 * Retorna null se inválido / expirado / já usado.
 */
export async function lookupPasswordResetToken(rawToken: string): Promise<ResetTokenLookup | null> {
  if (!rawToken || rawToken.length < 16) return null;
  const tokenHash = sha256(rawToken);
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!row) return null;
  if (row.usedAt) return null;
  if (row.expiresAt < new Date()) return null;
  if (!row.user || row.user.deletedAt || row.user.suspendedAt) return null;
  return {
    email: row.user.email,
    firstName: row.user.firstName ?? row.user.name?.split(/\s+/)[0] ?? null,
  };
}

export type ConfirmPasswordResetMeta = {
  ip?: string | null;
  userAgent?: string | null;
};

/**
 * Consome o token, troca a senha e invalida sessões em curso (refresh tokens).
 */
export async function confirmPasswordReset(
  rawToken: string,
  newPassword: string,
  _meta: ConfirmPasswordResetMeta = {}
): Promise<{ userId: string; email: string }> {
  if (!rawToken || rawToken.length < 16) {
    throw new Error("Token inválido ou expirado");
  }
  if (newPassword.length < 6) {
    throw new Error("Nova senha: mínimo 6 caracteres");
  }
  const tokenHash = sha256(rawToken);
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!row || row.usedAt || row.expiresAt < new Date()) {
    throw new Error("Token inválido ou expirado");
  }
  if (!row.user || row.user.deletedAt) {
    throw new Error("Conta indisponível para redefinição");
  }
  if (row.user.suspendedAt) {
    throw new Error("Conta suspensa. Contate o administrador.");
  }

  const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { password: hashed, mustChangePassword: false },
    }),
    prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.updateMany({
      where: { userId: row.userId, usedAt: null, id: { not: row.id } },
      data: { usedAt: new Date() },
    }),
    prisma.refreshToken.deleteMany({ where: { userId: row.userId } }),
  ]);

  return { userId: row.userId, email: row.user.email };
}
