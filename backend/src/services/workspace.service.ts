import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma.js";
import { assertCanAddClientAccount, assertCanAddDirectMemberOrInvitation } from "./plan-limits.service.js";
import { assertOrgAdminOrParentAgency } from "./auth.service.js";
import { ASSIGNABLE_MEMBER_ROLES } from "../constants/roles.js";
import {
  isValidTeamJobTitleSlug,
  resolveNewMemberRoleAndJobTitle,
} from "../constants/team-job-titles.js";
import { updateMemberRole } from "./members.service.js";
import { normalizeWhatsappDigits } from "../utils/whatsapp-normalize.js";

const SALT_ROUNDS = 10;

export async function listClients(organizationId: string) {
  return prisma.clientAccount.findMany({
    where: { organizationId, deletedAt: null },
    orderBy: { name: "asc" },
  });
}

export async function createClient(organizationId: string, name: string) {
  await assertCanAddClientAccount(organizationId);
  return prisma.clientAccount.create({
    data: { organizationId, name: name.trim() },
  });
}

export async function updateClient(organizationId: string, id: string, name: string) {
  const row = await prisma.clientAccount.findFirst({
    where: { id, organizationId, deletedAt: null },
  });
  if (!row) return null;
  return prisma.clientAccount.update({
    where: { id },
    data: { name: name.trim() },
  });
}

export async function deleteClient(organizationId: string, id: string) {
  const row = await prisma.clientAccount.findFirst({
    where: { id, organizationId, deletedAt: null },
  });
  if (!row) return false;
  await prisma.clientAccount.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return true;
}

export async function listProjects(organizationId: string, clientAccountId?: string | null) {
  return prisma.project.findMany({
    where: {
      organizationId,
      deletedAt: null,
      ...(clientAccountId ? { clientAccountId } : {}),
    },
    orderBy: { name: "asc" },
    include: {
      clientAccount: { select: { id: true, name: true } },
    },
  });
}

export async function createProject(
  organizationId: string,
  name: string,
  clientAccountId: string | null | undefined
) {
  if (clientAccountId) {
    const client = await prisma.clientAccount.findFirst({
      where: { id: clientAccountId, organizationId, deletedAt: null },
    });
    if (!client) throw new Error("Cliente não encontrado");
  }
  return prisma.project.create({
    data: {
      organizationId,
      name: name.trim(),
      clientAccountId: clientAccountId ?? null,
    },
    include: { clientAccount: { select: { id: true, name: true } } },
  });
}

export async function updateProject(
  organizationId: string,
  id: string,
  data: { name?: string; clientAccountId?: string | null }
) {
  const row = await prisma.project.findFirst({
    where: { id, organizationId, deletedAt: null },
  });
  if (!row) return null;
  if (data.clientAccountId !== undefined && data.clientAccountId !== null) {
    const client = await prisma.clientAccount.findFirst({
      where: { id: data.clientAccountId, organizationId, deletedAt: null },
    });
    if (!client) throw new Error("Cliente não encontrado");
  }
  return prisma.project.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.clientAccountId !== undefined ? { clientAccountId: data.clientAccountId } : {}),
    },
    include: { clientAccount: { select: { id: true, name: true } } },
  });
}

export async function deleteProject(organizationId: string, id: string) {
  const row = await prisma.project.findFirst({
    where: { id, organizationId, deletedAt: null },
  });
  if (!row) return false;
  await prisma.project.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return true;
}

export async function listLaunches(organizationId: string, projectId?: string) {
  if (projectId) {
    const p = await prisma.project.findFirst({
      where: { id: projectId, organizationId, deletedAt: null },
    });
    if (!p) return [];
  }

  return prisma.launch.findMany({
    where: {
      deletedAt: null,
      project: projectId
        ? { id: projectId, organizationId, deletedAt: null }
        : { organizationId, deletedAt: null },
    },
    orderBy: { createdAt: "desc" },
    include: {
      project: { select: { id: true, name: true } },
    },
  });
}

export async function createLaunch(
  organizationId: string,
  projectId: string,
  name: string,
  startDate: Date | null,
  endDate: Date | null
) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId, deletedAt: null },
  });
  if (!project) throw new Error("Projeto não encontrado");
  return prisma.launch.create({
    data: {
      projectId,
      name: name.trim(),
      startDate,
      endDate,
    },
    include: { project: { select: { id: true, name: true } } },
  });
}

export async function updateLaunch(
  organizationId: string,
  id: string,
  data: { name?: string; startDate?: Date | null; endDate?: Date | null; checklistJson?: string | null }
) {
  const row = await prisma.launch.findFirst({
    where: {
      id,
      deletedAt: null,
      project: { organizationId, deletedAt: null },
    },
    include: { project: true },
  });
  if (!row) return null;
  return prisma.launch.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.startDate !== undefined ? { startDate: data.startDate } : {}),
      ...(data.endDate !== undefined ? { endDate: data.endDate } : {}),
      ...(data.checklistJson !== undefined ? { checklistJson: data.checklistJson } : {}),
    },
    include: { project: { select: { id: true, name: true } } },
  });
}

export async function deleteLaunch(organizationId: string, id: string) {
  const row = await prisma.launch.findFirst({
    where: {
      id,
      deletedAt: null,
      project: { organizationId, deletedAt: null },
    },
  });
  if (!row) return false;
  await prisma.launch.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return true;
}

export async function listGoals(organizationId: string) {
  return prisma.goal.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
}

type MemberListItem = {
  membershipId: string;
  userId: string;
  email: string;
  name: string;
  role: string;
  jobTitle: string | null;
  whatsappNumber: string | null;
  joinedAt: string;
  lastLoginAt: string | null;
  suspended: boolean;
  suspendedAt: string | null;
  receiveWhatsappAlerts: boolean;
  alertStartHour: string | null;
  alertEndHour: string | null;
  /** Membro direto vs acesso herdado da agência vs bloqueado neste cliente (exclusão) */
  source: "direct" | "agency" | "agency_excluded";
};

export async function listOrganizationMembers(organizationId: string): Promise<MemberListItem[]> {
  const org = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
    select: { parentOrganizationId: true, agencyMemberExcludedUserIds: true },
  });

  const directRows = await prisma.membership.findMany({
    where: { organizationId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          deletedAt: true,
          suspendedAt: true,
          lastLoginAt: true,
          whatsappNumber: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const direct: MemberListItem[] = directRows
    .filter((m) => !m.user.deletedAt)
    .map((m) => ({
      membershipId: m.id,
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      jobTitle: m.jobTitle ?? null,
      whatsappNumber: m.user.whatsappNumber ?? null,
      joinedAt: m.createdAt.toISOString(),
      lastLoginAt: m.user.lastLoginAt?.toISOString() ?? null,
      suspended: m.user.suspendedAt != null,
      suspendedAt: m.user.suspendedAt?.toISOString() ?? null,
      receiveWhatsappAlerts: m.receiveWhatsappAlerts !== false,
      alertStartHour: m.alertStartHour?.trim() || null,
      alertEndHour: m.alertEndHour?.trim() || null,
      source: "direct" as const,
    }));

  const directUserIds = new Set(direct.map((d) => d.userId));

  if (!org?.parentOrganizationId) {
    return direct;
  }

  const excludedSet = new Set(org.agencyMemberExcludedUserIds ?? []);

  const agencyRows = await prisma.membership.findMany({
    where: {
      organizationId: org.parentOrganizationId,
      role: {
        in: ["owner", "admin", "agency_owner", "agency_admin", "workspace_owner", "workspace_admin"],
      },
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          deletedAt: true,
          suspendedAt: true,
          lastLoginAt: true,
          whatsappNumber: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const agencyCandidates = agencyRows.filter((m) => !m.user.deletedAt && !directUserIds.has(m.userId));

  const mapAgencyRow = (m: (typeof agencyRows)[number], membershipId: string, source: "agency" | "agency_excluded"): MemberListItem => ({
    membershipId,
    userId: m.user.id,
    email: m.user.email,
    name: m.user.name,
    role: m.role,
    jobTitle: m.jobTitle ?? null,
    whatsappNumber: m.user.whatsappNumber ?? null,
    joinedAt: m.createdAt.toISOString(),
    lastLoginAt: m.user.lastLoginAt?.toISOString() ?? null,
    suspended: m.user.suspendedAt != null,
    suspendedAt: m.user.suspendedAt?.toISOString() ?? null,
    receiveWhatsappAlerts: true,
    alertStartHour: null,
    alertEndHour: null,
    source,
  });

  const agency: MemberListItem[] = agencyCandidates
    .filter((m) => !excludedSet.has(m.userId))
    .map((m) => mapAgencyRow(m, `via-agency:${m.id}`, "agency"));

  const agencyExcluded: MemberListItem[] = [];
  for (const uid of excludedSet) {
    if (directUserIds.has(uid)) continue;
    const m = agencyCandidates.find((row) => row.userId === uid);
    if (!m) continue;
    agencyExcluded.push(mapAgencyRow(m, `excluded-agency:${uid}`, "agency_excluded"));
  }

  return [...direct, ...agency, ...agencyExcluded];
}

export async function createWorkspaceDirectMember(
  organizationId: string,
  actorUserId: string,
  data: {
    email: string;
    name: string;
    password: string;
    accessLevel: string;
    jobTitle: string;
    whatsappNumber?: string | null;
  }
): Promise<MemberListItem> {
  await assertOrgAdminOrParentAgency(actorUserId, organizationId);
  await assertCanAddDirectMemberOrInvitation(organizationId);

  const norm = data.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: norm } });
  if (existing) {
    throw new Error("Já existe usuário com este e-mail");
  }

  const { role: r, jobTitle: jt } = resolveNewMemberRoleAndJobTitle(data.accessLevel, data.jobTitle);
  if (!(ASSIGNABLE_MEMBER_ROLES as readonly string[]).includes(r)) {
    throw new Error("Papel inválido");
  }

  const hashed = await bcrypt.hash(data.password, SALT_ROUNDS);
  const wa = normalizeWhatsappDigits(data.whatsappNumber ?? null);
  const user = await prisma.user.create({
    data: {
      email: norm,
      name: data.name.trim(),
      password: hashed,
      mustChangePassword: true,
      ...(wa ? { whatsappNumber: wa } : {}),
    },
  });

  const membership = await prisma.membership.create({
    data: {
      userId: user.id,
      organizationId,
      role: r,
      jobTitle: jt,
    },
  });

  return {
    membershipId: membership.id,
    userId: user.id,
    email: user.email,
    name: user.name,
    role: membership.role,
    jobTitle: membership.jobTitle ?? null,
    whatsappNumber: user.whatsappNumber ?? null,
    joinedAt: membership.createdAt.toISOString(),
    lastLoginAt: null,
    suspended: false,
    suspendedAt: null,
    receiveWhatsappAlerts: membership.receiveWhatsappAlerts !== false,
    alertStartHour: membership.alertStartHour?.trim() || null,
    alertEndHour: membership.alertEndHour?.trim() || null,
    source: "direct",
  };
}

export async function patchWorkspaceMember(
  organizationId: string,
  actorUserId: string,
  targetUserId: string,
  patch: {
    role?: string;
    email?: string;
    name?: string;
    suspended?: boolean;
    jobTitle?: string | null;
    accessLevel?: string;
    whatsappNumber?: string | null;
    receiveWhatsappAlerts?: boolean;
    alertStartHour?: string | null;
    alertEndHour?: string | null;
  }
): Promise<{ ok: true } | { ok: false; message: string }> {
  await assertOrgAdminOrParentAgency(actorUserId, organizationId);

  const targetMembership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: targetUserId, organizationId } },
  });
  if (!targetMembership) {
    return { ok: false, message: "Membro não encontrado nesta empresa" };
  }

  if (patch.suspended === true && targetUserId === actorUserId) {
    return { ok: false, message: "Não é possível suspender a si mesmo" };
  }

  if (patch.jobTitle !== undefined) {
    let nextJt: string | null;
    if (patch.jobTitle === null || patch.jobTitle === "") {
      nextJt = null;
    } else if (isValidTeamJobTitleSlug(patch.jobTitle.trim())) {
      nextJt = patch.jobTitle.trim();
    } else {
      return { ok: false, message: "Cargo inválido" };
    }
    await prisma.membership.update({
      where: { id: targetMembership.id },
      data: { jobTitle: nextJt },
    });
    if (nextJt === "client_viewer") {
      const rr = await updateMemberRole(organizationId, actorUserId, targetUserId, "report_viewer");
      if (!rr.ok) {
        return rr;
      }
    }
  }

  if (patch.email !== undefined || patch.name !== undefined || patch.suspended !== undefined) {
    const user = await prisma.user.findFirst({
      where: { id: targetUserId, deletedAt: null },
    });
    if (!user) {
      return { ok: false, message: "Usuário não encontrado" };
    }

    if (patch.email !== undefined && patch.email.trim().toLowerCase() !== user.email.toLowerCase()) {
      const nextEmail = patch.email.trim().toLowerCase();
      const taken = await prisma.user.findFirst({
        where: { email: nextEmail, NOT: { id: targetUserId } },
      });
      if (taken) {
        return { ok: false, message: "E-mail já em uso" };
      }
    }

    const data: Prisma.UserUpdateInput = {};
    if (patch.email !== undefined) {
      data.email = patch.email.trim().toLowerCase();
    }
    if (patch.name !== undefined) {
      data.name = patch.name.trim();
    }
    if (patch.suspended === true) {
      data.suspendedAt = new Date();
    } else if (patch.suspended === false) {
      data.suspendedAt = null;
    }

    await prisma.user.update({ where: { id: targetUserId }, data });
  }

  if (patch.whatsappNumber !== undefined) {
    const norm = normalizeWhatsappDigits(
      patch.whatsappNumber === null || patch.whatsappNumber === "" ? null : patch.whatsappNumber
    );
    await prisma.user.update({
      where: { id: targetUserId },
      data: { whatsappNumber: norm },
    });
  }

  if (patch.receiveWhatsappAlerts !== undefined) {
    await prisma.membership.update({
      where: { id: targetMembership.id },
      data: { receiveWhatsappAlerts: patch.receiveWhatsappAlerts },
    });
  }
  if (patch.alertStartHour !== undefined || patch.alertEndHour !== undefined) {
    const data: { alertStartHour?: string | null; alertEndHour?: string | null } = {};
    if (patch.alertStartHour !== undefined) {
      const s =
        patch.alertStartHour == null || patch.alertStartHour === ""
          ? ""
          : patch.alertStartHour.trim();
      data.alertStartHour = s === "" ? null : s;
    }
    if (patch.alertEndHour !== undefined) {
      const s =
        patch.alertEndHour == null || patch.alertEndHour === "" ? "" : patch.alertEndHour.trim();
      data.alertEndHour = s === "" ? null : s;
    }
    if (Object.keys(data).length) {
      await prisma.membership.update({
        where: { id: targetMembership.id },
        data,
      });
    }
  }

  if (patch.accessLevel !== undefined) {
    const mem = await prisma.membership.findUnique({
      where: { id: targetMembership.id },
      select: { jobTitle: true },
    });
    const jtSlug = mem?.jobTitle ?? "traffic_manager";
    const { role: mappedRole } = resolveNewMemberRoleAndJobTitle(patch.accessLevel, jtSlug);
    const roleResult = await updateMemberRole(organizationId, actorUserId, targetUserId, mappedRole);
    if (!roleResult.ok) {
      return roleResult;
    }
  } else if (patch.role !== undefined) {
    const roleResult = await updateMemberRole(organizationId, actorUserId, targetUserId, patch.role);
    if (!roleResult.ok) {
      return roleResult;
    }
  }

  return { ok: true };
}

export async function resetWorkspaceMemberPassword(
  organizationId: string,
  actorUserId: string,
  targetUserId: string,
  newPassword: string,
  options?: { forcePasswordChange?: boolean }
): Promise<void> {
  await assertOrgAdminOrParentAgency(actorUserId, organizationId);

  if (targetUserId === actorUserId) {
    throw new Error("Use a página de perfil para alterar sua própria senha");
  }

  const m = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: targetUserId, organizationId } },
  });
  if (!m) {
    throw new Error("Membro não encontrado nesta empresa");
  }

  const forceNext = options?.forcePasswordChange !== false;
  const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: targetUserId },
      data: { password: hashed, mustChangePassword: forceNext },
    }),
    prisma.refreshToken.deleteMany({ where: { userId: targetUserId } }),
  ]);
}
