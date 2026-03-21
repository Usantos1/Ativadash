import { prisma } from "./prisma.js";

/** Gera slug URL-safe a partir do nome da empresa. */
export function slugifyOrganizationName(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base.length > 0 ? base : "empresa";
}

/** Garante slug único na tabela Organization. */
export async function uniqueOrganizationSlug(base: string): Promise<string> {
  let slug = base;
  for (let n = 0; n < 10_000; n++) {
    const taken = await prisma.organization.findUnique({ where: { slug } });
    if (!taken) return slug;
    slug = `${base}-${n + 1}`;
  }
  throw new Error("Não foi possível gerar um identificador único para a empresa");
}
