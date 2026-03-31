import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../utils/prisma.js";
import { assertOrgAdminOrParentAgency } from "./auth.service.js";
import { assertCanAddDirectMemberOrInvitation } from "./plan-limits.service.js";
import { isValidTeamJobTitleSlug, teamAccessLevelToRole } from "../constants/team-job-titles.js";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SALT_ROUNDS = 10;

const ALLOWED_ROLES = new Set([
  "owner",
  "admin",
  "member",
  "media_manager",
  "analyst",
  "agency_admin",
  "agency_ops",
  "workspace_admin",
  "report_viewer",
  "media_meta_manager",
  "media_google_manager",
  "performance_analyst",
]);

export type InvitationRow = {
  id: string;
  email: string;
  role: string;
  jobTitle: string | null;
  expiresAt: string;
  createdAt: string;
};

function resolveInviteRoleAndJobTitle(input: {
  legacyRole?: string;
  accessLevel?: string;
  jobTitle?: string;
}): { role: string; jobTitle: string | null } {
  const jt = input.jobTitle?.trim();
  const jobTitleNorm = jt && isValidTeamJobTitleSlug(jt) ? jt : null;
  if (jobTitleNorm === "client_viewer") {
    return { role: "report_viewer", jobTitle: "client_viewer" };
  }
  if (input.accessLevel?.trim()) {
    const role = teamAccessLevelToRole(input.accessLevel);
    return { role, jobTitle: jobTitleNorm };
  }
  const r = (input.legacyRole ?? "member").trim();
  return { role: r, jobTitle: jobTitleNorm };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function createInvitation(
  organizationId: string,
  actorUserId: string,
  email: string,
  roleOrOpts: string | { legacyRole?: string; accessLevel?: string; jobTitle?: string }
): Promise<{ invitation: InvitationRow; inviteLink: string }> {
  await assertOrgAdminOrParentAgency(actorUserId, organizationId);
  const { role: r, jobTitle: jtStored } =
    typeof roleOrOpts === "string"
      ? resolveInviteRoleAndJobTitle({ legacyRole: roleOrOpts })
      : resolveInviteRoleAndJobTitle(roleOrOpts);
  if (!ALLOWED_ROLES.has(r) || r === "owner" || r === "agency_owner" || r === "workspace_owner") {
    throw new Error("Papel inválido para convite");
  }

  const norm = normalizeEmail(email);
  if (!norm.includes("@")) {
    throw new Error("E-mail inválido");
  }

  const existingUser = await prisma.user.findUnique({ where: { email: norm } });
  if (existingUser) {
    const mem = await prisma.membership.findUnique({
      where: {
        userId_organizationId: { userId: existingUser.id, organizationId },
      },
    });
    if (mem) {
      throw new Error("Este usuário já é membro desta empresa");
    }
  }

  await assertCanAddDirectMemberOrInvitation(organizationId);

  await prisma.invitation.updateMany({
    where: {
      organizationId,
      email: norm,
      acceptedAt: null,
    },
    data: { acceptedAt: new Date() },
  });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  const row = await prisma.invitation.create({
    data: {
      email: norm,
      organizationId,
      role: r,
      jobTitle: jtStored,
      token,
      invitedByUserId: actorUserId,
      expiresAt,
    },
  });

  const { env } = await import("../config/env.js");
  const inviteLink = `${env.FRONTEND_URL}/register?invite=${encodeURIComponent(token)}`;

  return {
    invitation: {
      id: row.id,
      email: row.email,
      role: row.role,
      jobTitle: row.jobTitle ?? null,
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    },
    inviteLink,
  };
}

export async function listPendingInvitations(organizationId: string, actorUserId: string): Promise<InvitationRow[]> {
  await assertOrgAdminOrParentAgency(actorUserId, organizationId);
  const rows = await prisma.invitation.findMany({
    where: {
      organizationId,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    jobTitle: row.jobTitle ?? null,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }));
}

/** Convite ainda não aceito (inclui expirado — pode ser revogado para limpar a lista). */
export async function getPendingInvitationOrganizationId(invitationId: string): Promise<string | null> {
  const row = await prisma.invitation.findFirst({
    where: { id: invitationId, acceptedAt: null },
    select: { organizationId: true },
  });
  return row?.organizationId ?? null;
}

export async function revokeInvitation(
  organizationId: string,
  actorUserId: string,
  invitationId: string
): Promise<boolean> {
  await assertOrgAdminOrParentAgency(actorUserId, organizationId);
  const inv = await prisma.invitation.findFirst({
    where: { id: invitationId, organizationId, acceptedAt: null },
  });
  if (!inv) return false;
  await prisma.invitation.update({
    where: { id: invitationId },
    data: { acceptedAt: new Date() },
  });
  return true;
}

export type InvitePreview = {
  organizationName: string;
  email: string;
  role: string;
};

export async function getInvitationPreviewByToken(token: string): Promise<InvitePreview | null> {
  const inv = await prisma.invitation.findUnique({
    where: { token },
    include: { organization: true },
  });
  if (!inv || inv.acceptedAt || inv.expiresAt < new Date() || inv.organization.deletedAt) {
    return null;
  }
  return {
    organizationName: inv.organization.name,
    email: inv.email,
    role: inv.role,
  };
}

export async function acceptInvitationNewUser(token: string, name: string, password: string) {
  const inv = await prisma.invitation.findUnique({
    where: { token },
    include: { organization: true },
  });
  if (!inv || inv.acceptedAt || inv.expiresAt < new Date() || inv.organization.deletedAt) {
    throw new Error("Convite inválido ou expirado");
  }

  const norm = inv.email;
  const existing = await prisma.user.findUnique({ where: { email: norm } });
  if (existing) {
    throw new Error("Já existe conta com este e-mail. Entre e aceite o convite na área da equipe.");
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      email: norm,
      password: hashedPassword,
      name: name.trim(),
    },
  });

  await prisma.membership.create({
    data: {
      userId: user.id,
      organizationId: inv.organizationId,
      role: inv.role,
      jobTitle: inv.jobTitle ?? null,
    },
  });

  await prisma.invitation.update({
    where: { id: inv.id },
    data: { acceptedAt: new Date() },
  });

  const { finalizeSessionForUser } = await import("./auth.service.js");
  return finalizeSessionForUser(user.id, inv.organizationId);
}

export async function acceptInvitationExistingUser(token: string, userId: string, userEmail: string) {
  const inv = await prisma.invitation.findUnique({
    where: { token },
    include: { organization: true },
  });
  if (!inv || inv.acceptedAt || inv.expiresAt < new Date() || inv.organization.deletedAt) {
    throw new Error("Convite inválido ou expirado");
  }
  if (normalizeEmail(userEmail) !== inv.email) {
    throw new Error("Entre com a conta do e-mail convidado");
  }

  const existingMem = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId: inv.organizationId } },
  });
  if (existingMem) {
    throw new Error("Você já é membro desta empresa");
  }

  await assertCanAddDirectMemberOrInvitation(inv.organizationId);

  await prisma.membership.create({
    data: {
      userId,
      organizationId: inv.organizationId,
      role: inv.role,
      jobTitle: inv.jobTitle ?? null,
    },
  });

  await prisma.invitation.update({
    where: { id: inv.id },
    data: { acceptedAt: new Date() },
  });

  const { finalizeSessionForUser } = await import("./auth.service.js");
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!user) throw new Error("Usuário não encontrado");
  return finalizeSessionForUser(user.id, inv.organizationId);
}
