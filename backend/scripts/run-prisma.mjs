/**
 * Carrega cadeia de .env e monta DATABASE_URL a partir de DB_* se necessário.
 * Uso: node scripts/run-prisma.mjs <args do prisma...>
 */
import { spawnSync } from "node:child_process";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnvChain } from "./load-env-chain.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(__dirname, "../..");

loadEnvChain(backendRoot, repoRoot);

if (!process.env.DATABASE_URL?.trim()) {
  console.error(
    "[run-prisma] Defina DATABASE_URL (ou DB_*) no .env / .env.local — veja backend/.env.local.example"
  );
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Uso: node scripts/run-prisma.mjs <comando prisma> [opções]");
  process.exit(1);
}

const result = spawnSync("npx", ["prisma", ...args], {
  stdio: "inherit",
  shell: true,
  env: process.env,
  cwd: backendRoot,
});

process.exit(result.status ?? 1);
