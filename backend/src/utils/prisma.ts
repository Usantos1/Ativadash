import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

/** Em dev, não logar `error` no console (evita spam de stack em falha de credenciais). Use PRISMA_LOG=verbose para query+error+warn. */
function prismaLogOptions(): Prisma.LogLevel[] | Prisma.LogDefinition[] {
  if (process.env.PRISMA_LOG === "verbose") {
    return ["query", "error", "warn"];
  }
  if (process.env.NODE_ENV === "development") {
    return ["warn"];
  }
  return ["error"];
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: prismaLogOptions(),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
