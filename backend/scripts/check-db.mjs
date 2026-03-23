/**
 * Testa conexão Prisma → Postgres (útil no Windows antes de npm run dev).
 * Uso: node scripts/check-db.mjs
 */
import path from "path";
import { fileURLToPath } from "url";
import { loadEnvChain } from "./load-env-chain.mjs";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(__dirname, "../..");

loadEnvChain(backendRoot, repoRoot);

if (!process.env.DATABASE_URL?.trim()) {
  console.error("❌ DATABASE_URL vazia. Copie backend/.env.local.example → backend/.env.local e ajuste.");
  process.exit(1);
}

const rawUrl = process.env.DATABASE_URL;
if (/COLOQUE_SUA_SENHA|placeholder|changeme/i.test(rawUrl)) {
  console.error(
    "❌ A DATABASE_URL ainda tem texto de exemplo. Edite backend/.env.local e coloque a senha REAL do usuário postgres."
  );
  process.exit(1);
}

const masked = rawUrl.replace(/(postgresql:\/\/[^:]+:)([^@]+)(@)/i, "$1***$3");
console.log("Tentando:", masked);

const prisma = new PrismaClient();
try {
  await prisma.$queryRaw`SELECT 1`;
  console.log("✅ Postgres OK — pode rodar npm run dev e npm run prisma:migrate");
} catch (e) {
  console.error("❌ Falha:", e.message);
  console.error("\n→ Postgres nativo no Windows: crie backend/.env.local com usuário postgres e senha real.");
  console.error("→ Ou rode: psql -U postgres -f scripts/setup-local-postgres.sql");
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
