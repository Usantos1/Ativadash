import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env.js";

let cachedTransporter: Transporter | null = null;

/**
 * Verifica se as credenciais SMTP mínimas estão presentes.
 * Em dev é normal não estar configurado — o envio cai em log.
 */
export function isMailConfigured(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}

function getTransporter(): Transporter | null {
  if (!isMailConfigured()) return null;
  if (cachedTransporter) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
  return cachedTransporter;
}

function fromHeader(): string {
  const addr = env.SMTP_FROM_EMAIL || env.SMTP_USER;
  if (!addr) return env.SMTP_FROM_NAME;
  if (!env.SMTP_FROM_NAME) return addr;
  return `"${env.SMTP_FROM_NAME}" <${addr}>`;
}

export type SendMailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export type SendMailResult = {
  ok: boolean;
  /** true quando SMTP não está configurado e o e-mail foi apenas logado (modo dev). */
  skipped?: boolean;
  messageId?: string;
  error?: string;
};

/**
 * Envia um e-mail transacional via SMTP. Se SMTP não estiver configurado, registra
 * no console (útil em dev) e devolve `{ ok: true, skipped: true }`.
 */
export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn(
      "[mailer] SMTP_* não configurado — e-mail NÃO foi enviado.\n" +
        `  to=${input.to}\n  subject=${input.subject}`
    );
    return { ok: true, skipped: true };
  }
  try {
    const info = await transporter.sendMail({
      from: fromHeader(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
    });
    return { ok: true, messageId: info.messageId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido ao enviar e-mail";
    console.error("[mailer] falha no envio SMTP:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Verifica conectividade com o servidor SMTP (para health-check / setup).
 * Não envia nenhum e-mail.
 */
export async function verifyMailTransport(): Promise<{ ok: boolean; error?: string }> {
  const transporter = getTransporter();
  if (!transporter) {
    return { ok: false, error: "SMTP não configurado" };
  }
  try {
    await transporter.verify();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha desconhecida" };
  }
}
