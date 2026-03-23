import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Pasta `backend/` */
const backendRoot = path.resolve(__dirname, "../..");
/** Raiz do repositório Ativa Dash (mesmo nível que `docker-compose.yml`) */
const repoRoot = path.resolve(__dirname, "../../..");

function loadEnvFile(filePath: string) {
  if (fs.existsSync(filePath)) {
    dotenv.config({ path: filePath, override: true });
  }
}

/**
 * Monta `DATABASE_URL` para o Prisma a partir de `DB_*` (estilo Ativafix / Primecamp).
 * Só roda se `DATABASE_URL` ainda estiver vazia.
 */
export function ensureDatabaseUrlFromParts(): void {
  if (process.env.DATABASE_URL?.trim()) return;

  const h = process.env.DB_HOST?.trim();
  const n = process.env.DB_NAME?.trim();
  const u = process.env.DB_USER?.trim();
  if (process.env.DB_PASSWORD === undefined) return;
  const p = process.env.DB_PASSWORD;
  if (!h || !n || !u) return;

  const port = process.env.DB_PORT?.trim() || "5432";
  const schema = process.env.DB_SCHEMA?.trim() || "public";
  let url = `postgresql://${encodeURIComponent(u)}:${encodeURIComponent(p)}@${h}:${port}/${encodeURIComponent(n)}?schema=${encodeURIComponent(schema)}`;
  if (process.env.DB_SSL?.toLowerCase() === "true") {
    url += "&sslmode=require";
  }
  process.env.DATABASE_URL = url;
}

/**
 * 1) Carrega `.env` na raiz do repo (igual Ativafix: um arquivo único no monorepo).
 * 2) Carrega `backend/.env` por cima (override) para ajustes locais só da API.
 * 3) Aplica `DB_*` → `DATABASE_URL` se necessário.
 */
export function loadAtivadashEnv(): void {
  loadEnvFile(path.join(repoRoot, ".env"));
  loadEnvFile(path.join(backendRoot, ".env"));
  loadEnvFile(path.join(repoRoot, ".env.local"));
  loadEnvFile(path.join(backendRoot, ".env.local"));
  ensureDatabaseUrlFromParts();
}
