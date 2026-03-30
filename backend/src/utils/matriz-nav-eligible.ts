import { prisma } from "./prisma.js";
import { isPlatformAdminEmail } from "./platform-admin.js";

/**
 * Pode mostrar menu / painel matriz para esta org + utilizador (regra única API + UI).
 */
export async function computeMatrizNavEligible(organizationId: string, userEmail: string): Promise<boolean> {
  if (isPlatformAdminEmail(userEmail)) return true;
  const row = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
    select: { parentOrganizationId: true, organizationKind: true, resellerPartner: true },
  });
  if (!row) return false;
  if (row.parentOrganizationId !== null) return false;
  if (row.organizationKind !== "MATRIX") return false;
  return row.resellerPartner === true;
}
