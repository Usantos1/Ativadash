/**
 * Ordem (último ganha): raiz/.env → backend/.env → raiz/.env.local → backend/.env.local
 * Depois monta DATABASE_URL a partir de DB_* se ainda estiver vazia.
 */
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

function loadFile(p) {
  if (fs.existsSync(p)) dotenv.config({ path: p, override: true });
}

export function loadEnvChain(backendRoot, repoRoot) {
  loadFile(path.join(repoRoot, ".env"));
  loadFile(path.join(backendRoot, ".env"));
  loadFile(path.join(repoRoot, ".env.local"));
  loadFile(path.join(backendRoot, ".env.local"));
  ensureDatabaseUrl();
}

function ensureDatabaseUrl() {
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
  if (process.env.DB_SSL?.toLowerCase() === "true") url += "&sslmode=require";
  process.env.DATABASE_URL = url;
}
