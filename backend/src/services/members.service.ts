import { prisma } from "../utils/prisma.js";
import { assertOrgAdminOrParentAgency } from "./auth.service.js";
import {
  ASSIGNABLE_MEMBER_ROLES,
  isPrimaryOwnerRole,
  isWorkspaceAdminRole,
} from "../constants/roles.js";

const ASSIGNABLE_ROLES = new Set<string>(ASSIGNABLE_MEMBER_ROLES);

export async function updateMemberRole(
  organizationId: string,
  actorUserId: string,
  targetUserId: string,
  role: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  await assertOrgAdminOrParentAgency(actorUserId, organizationId);

  const r = role.trim();
  if (!ASSIGNABLE_ROLES.has(r)) {
    return { ok: false, message: "Papel inválido" };
  }

  const target = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: targetUserId, organizationId } },
  });
  if (!target) {
    return { ok: false, message: "Membro não encontrado nesta empresa" };
  }

  if (target.role === "owner") {
    return { ok: false, message: "Não é possível alterar o proprietário" };
  }

  const isSelf = targetUserId === actorUserId;

  if (isSelf) {
    const currentIsAdmin = isWorkspaceAdminRole(target.role);
    const nextIsAdmin = isWorkspaceAdminRole(r);
    if (currentIsAdmin && !nextIsAdmin) {
      const otherAdmins = await prisma.membership.count({
        where: {
          organizationId,
          NOT: { userId: actorUserId },
          role: { in: ["workspace_owner", "workspace_admin", "owner", "admin"] },
        },
      });
      if (otherAdmins === 0) {
        return {
          ok: false,
          message:
            "Você é o único administrador desta empresa. Promova outro membro a Administrador antes de rebaixar seu próprio nível.",
        };
      }
    }
  }

  await prisma.membership.update({
    where: { id: target.id },
    data: { role: r },
  });
  return { ok: true };
}

export async function removeMember(
  organizationId: string,
  actorUserId: string,
  targetUserId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  await assertOrgAdminOrParentAgency(actorUserId, organizationId);

  const org = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
    select: { parentOrganizationId: true },
  });
  const isChildWorkspace = org?.parentOrganizationId != null;

  if (targetUserId === actorUserId && !isChildWorkspace) {
    return {
      ok: false,
      message: "Remova a si mesmo apenas saindo da empresa (em breve) ou peça a outro admin",
    };
  }

  const target = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: targetUserId, organizationId } },
  });
  if (!target) {
    return { ok: false, message: "Membro não encontrado nesta empresa" };
  }

  if (isPrimaryOwnerRole(target.role)) {
    const owners = await prisma.membership.count({
      where: {
        organizationId,
        role: { in: ["owner", "workspace_owner", "agency_owner"] },
      },
    });
    if (owners <= 1) {
      return { ok: false, message: "Não é possível remover o único proprietário" };
    }
  }

  await prisma.membership.delete({ where: { id: target.id } });
  return { ok: true };
}
