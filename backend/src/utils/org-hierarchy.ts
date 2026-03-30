import { prisma } from "./prisma.js";

/** Sobe até a organização raiz (sem pai). */
export async function getOrganizationRootId(organizationId: string): Promise<string | null> {
  let walk: string | null = organizationId;
  for (let i = 0; i < 32 && walk; i++) {
    const row: { id: string; parentOrganizationId: string | null } | null = await prisma.organization.findFirst({
      where: { id: walk, deletedAt: null },
      select: { id: true, parentOrganizationId: true },
    });
    if (!row) return null;
    if (row.parentOrganizationId === null) return row.id;
    walk = row.parentOrganizationId;
  }
  return null;
}

/** Indica se a raiz do ecossistema está habilitada para revenda de planos / agências. */
export async function getRootResellerPartnerFlag(organizationId: string): Promise<boolean> {
  const rootId = await getOrganizationRootId(organizationId);
  if (!rootId) return false;
  const r = await prisma.organization.findFirst({
    where: { id: rootId, deletedAt: null },
    select: { resellerPartner: true },
  });
  return r?.resellerPartner === true;
}
