import { Prisma } from "@prisma/client";

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

const FRIENDLY_DB_MESSAGE =
  "Não foi possível conectar ao banco de dados local. Verifique o arquivo .env e se o PostgreSQL está em execução.";

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
  return null;
}
