import { prisma } from "../utils/prisma.js";

export async function listClients(organizationId: string) {
  return prisma.clientAccount.findMany({
    where: { organizationId, deletedAt: null },
    orderBy: { name: "asc" },
  });
}

export async function createClient(organizationId: string, name: string) {
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
  data: { name?: string; startDate?: Date | null; endDate?: Date | null }
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

export async function listOrganizationMembers(organizationId: string) {
  const rows = await prisma.membership.findMany({
    where: { organizationId },
    include: {
      user: {
        select: { id: true, email: true, name: true, deletedAt: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return rows
    .filter((m) => !m.user.deletedAt)
    .map((m) => ({
      membershipId: m.id,
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      joinedAt: m.createdAt.toISOString(),
    }));
}
