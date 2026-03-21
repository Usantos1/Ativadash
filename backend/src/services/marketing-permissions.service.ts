import { prisma } from "../utils/prisma.js";
import { userHasEffectiveAccess } from "./auth.service.js";

/** Mesmas regras de acesso à organização (direto ou revenda). */
export async function userCanReadMarketing(userId: string, organizationId: string): Promise<boolean> {
  return userHasEffectiveAccess(userId, organizationId);
}

export async function assertCanMutateAds(userId: string, organizationId: string): Promise<void> {
  const direct = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (direct && ["owner", "admin", "media_manager"].includes(direct.role)) return;

  const org = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
  });
  if (org?.parentOrganizationId) {
    const pm = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId: org.parentOrganizationId } },
    });
    if (pm && ["owner", "admin", "media_manager"].includes(pm.role)) return;
  }
  throw new Error("Sem permissão para alterar campanhas nas redes");
}
