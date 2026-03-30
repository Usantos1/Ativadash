import type { OrganizationKind } from "@prisma/client";
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

/**
 * Pode exibir/usar painel de matriz **neste contexto JWT** (org ativa).
 * Nunca herdar da raiz do ecossistema: filial/workspace cliente deve ser sempre false.
 *
 * Regra: só a própria org, sem pai, não é workspace de cliente, e `resellerPartner` na linha dela.
 */
export async function getRootResellerPartnerFlag(organizationId: string): Promise<boolean> {
  const row: { parentOrganizationId: string | null; resellerPartner: boolean; organizationKind: OrganizationKind } | null =
    await prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: { parentOrganizationId: true, resellerPartner: true, organizationKind: true },
    });
  if (!row) return false;
  if (row.parentOrganizationId !== null) return false;
  if (row.organizationKind === "CLIENT_WORKSPACE") return false;
  return row.resellerPartner === true;
}
