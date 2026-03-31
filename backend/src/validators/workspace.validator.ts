import { z } from "zod";
import { ASSIGNABLE_MEMBER_ROLES } from "../constants/roles.js";
import { isValidTeamJobTitleSlug } from "../constants/team-job-titles.js";

const assignableRoleSchema = z.enum(ASSIGNABLE_MEMBER_ROLES);
export const createClientSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(200),
});

export const updateClientSchema = z.object({
  name: z.string().min(1).max(200).optional(),
});

export const createProjectSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(200),
  clientAccountId: z.string().optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  clientAccountId: z.string().optional().nullable(),
});

export const createLaunchSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1, "Nome obrigatório").max(200),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

export const updateLaunchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  checklistJson: z.string().max(500_000).optional().nullable(),
});

const teamJobTitleFieldSchema = z
  .string()
  .min(1)
  .refine((s) => isValidTeamJobTitleSlug(s.trim()), { message: "Cargo inválido" });

const teamAccessLevelSchema = z.enum(["ADMIN", "OPERADOR", "VIEWER"]);

export const createInvitationSchema = z.object({
  email: z.string().email("E-mail inválido"),
  role: z.enum(["admin", "member", "media_manager", "analyst"]).optional(),
  jobTitle: teamJobTitleFieldSchema.optional(),
  accessLevel: teamAccessLevelSchema.optional(),
  /** WhatsApp com DDD (opcional) — aplicado ao usuário quando aceitar o convite. */
  whatsappNumber: z.string().max(32).optional().nullable(),
  /** Workspace onde o membro será vinculado (filho na hierarquia). Se omitido, usa a org do JWT. */
  organizationId: z.string().min(1).optional(),
});

/** @deprecated use patchWorkspaceMemberSchema */
export const updateMemberRoleSchema = z.object({
  role: z.enum(["admin", "member", "media_manager", "analyst"]),
});

export const createWorkspaceMemberSchema = z.object({
  email: z.string().email("E-mail inválido"),
  name: z.string().min(1, "Nome obrigatório").max(200),
  password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres").max(128),
  jobTitle: teamJobTitleFieldSchema,
  accessLevel: teamAccessLevelSchema,
  /** WhatsApp com DDD (apenas dígitos ou com máscara — normalizado no servidor). */
  whatsappNumber: z.string().max(32).optional().nullable(),
});

const alertHourSchema = z
  .union([
    z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, "Use HH:mm (ex.: 09:00)"),
    z.literal(""),
    z.null(),
  ])
  .optional();

export const patchWorkspaceMemberSchema = z
  .object({
    role: assignableRoleSchema.optional(),
    email: z.string().email("E-mail inválido").optional(),
    name: z.string().min(1).max(200).optional(),
    suspended: z.boolean().optional(),
    jobTitle: z.union([teamJobTitleFieldSchema, z.literal("")]).optional(),
    accessLevel: teamAccessLevelSchema.optional(),
    whatsappNumber: z.union([z.string().max(32), z.literal("")]).optional().nullable(),
    receiveWhatsappAlerts: z.boolean().optional(),
    alertStartHour: alertHourSchema,
    alertEndHour: alertHourSchema,
  })
  .refine(
    (b) =>
      b.role !== undefined ||
      b.email !== undefined ||
      b.name !== undefined ||
      b.suspended !== undefined ||
      b.jobTitle !== undefined ||
      b.accessLevel !== undefined ||
      b.whatsappNumber !== undefined ||
      b.receiveWhatsappAlerts !== undefined ||
      b.alertStartHour !== undefined ||
      b.alertEndHour !== undefined,
    { message: "Informe pelo menos um campo para atualizar" }
  );

export const resetWorkspaceMemberPasswordSchema = z.object({
  newPassword: z.string().min(8, "Senha deve ter pelo menos 8 caracteres").max(128),
  forcePasswordChange: z.boolean().optional(),
});
export const updateProfileSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(120),
});
