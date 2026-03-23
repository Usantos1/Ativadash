import { Prisma } from "@prisma/client";
import type { Response } from "express";

/** Códigos Prisma ligados a conexão / credenciais / servidor indisponível */
const CONNECTION_LIKE_CODES = new Set([
  "P1000", // Authentication failed
  "P1001", // Can't reach database server
  "P1002", // Connection timeout
  "P1003", // Database does not exist
  "P1010", // User was denied access
  "P1011", // TLS connection error
  "P1017", // Server has closed the connection
]);

export const FRIENDLY_DB_MESSAGE =
  "Não foi possível conectar ao banco de dados local. Verifique o arquivo .env e se o PostgreSQL está em execução.";

function redactDatabaseUrl(url: string): string {
  return url.replace(/(postgresql:\/\/[^:]+:)([^@]+)(@)/i, "$1***$3");
}

function parseDatabaseUrlHint(): string {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) return "  DATABASE_URL: (não definida — copie backend/.env.example para backend/.env)";
  try {
    const u = new URL(raw.replace(/^postgresql:/i, "http:"));
    const db = u.pathname.replace(/^\//, "") || "(sem nome)";
    return `  DATABASE_URL → host: ${u.hostname}  port: ${u.port || "5432"}  database: ${db}  user: ${u.username || "(vazio)"}`;
  } catch {
    return `  DATABASE_URL: (formato inválido) ${redactDatabaseUrl(raw)}`;
  }
}

/**
 * Log detalhado no terminal (servidor). Não enviar isto ao cliente.
 */
export function logDatabaseConnectionFailure(err: unknown, context: string): void {
  const lines: string[] = [`[database] Falha (${context})`];

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    lines.push(`  prisma.code: ${err.code}`, `  message: ${err.message}`);
    if (err.meta && Object.keys(err.meta).length) {
      lines.push(`  meta: ${JSON.stringify(err.meta)}`);
    }
  } else if (err instanceof Prisma.PrismaClientInitializationError) {
    lines.push(`  prisma.init.errorCode: ${err.errorCode}`, `  message: ${redactDatabaseUrl(err.message)}`);
  } else if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    lines.push(`  prisma.unknown: ${redactDatabaseUrl(err.message)}`);
  } else if (err instanceof Error) {
    const errno = err as NodeJS.ErrnoException;
    lines.push(`  name: ${err.name}`, `  message: ${redactDatabaseUrl(err.message)}`);
    if (errno.code) lines.push(`  code: ${errno.code}`);
    if (err.cause instanceof Error) {
      lines.push(`  cause: ${redactDatabaseUrl(err.cause.message)}`);
    }
  } else {
    lines.push(`  detail: ${String(err)}`);
  }

  lines.push(parseDatabaseUrlHint());
  console.error(lines.join("\n"));
}

function isLikelyInfrastructureDbError(err: Error): boolean {
  const errno = (err as NodeJS.ErrnoException).code;
  if (errno === "ECONNREFUSED" || errno === "ETIMEDOUT" || errno === "ENOTFOUND") return true;
  const m = err.message.toLowerCase();
  return (
    m.includes("econnrefused") ||
    m.includes("etimedout") ||
    m.includes("can't reach database") ||
    m.includes("password authentication failed") ||
    m.includes("database") && m.includes("does not exist")
  );
}

/**
 * Se o erro for de infraestrutura do Prisma/Postgres, retorna resposta HTTP segura (sem stack/mensagem bruta).
 */
export function getDatabaseUnavailableResponse(err: unknown): { status: number; message: string } | null {
  if (err instanceof Prisma.PrismaClientInitializationError) {
    return { status: 503, message: FRIENDLY_DB_MESSAGE };
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && CONNECTION_LIKE_CODES.has(err.code)) {
    return { status: 503, message: FRIENDLY_DB_MESSAGE };
  }
  if (err instanceof Error && isLikelyInfrastructureDbError(err)) {
    return { status: 503, message: FRIENDLY_DB_MESSAGE };
  }
  return null;
}

/** Responde 503 com mensagem amigável e registra o motivo real no terminal. */
export function respondIfDatabaseUnavailable(res: Response, err: unknown, context: string): boolean {
  const dbErr = getDatabaseUnavailableResponse(err);
  if (!dbErr) return false;
  logDatabaseConnectionFailure(err, context);
  res.status(dbErr.status).json({ message: dbErr.message });
  return true;
}
