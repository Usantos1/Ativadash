import { z } from "zod";

export const patchOrganizationSchema = z.object({
  name: z.string().min(2, "Nome muito curto").max(120, "Nome muito longo"),
});

export const createChildOrganizationSchema = z.object({
  name: z.string().min(2, "Nome muito curto").max(120, "Nome muito longo"),
  inheritPlanFromParent: z.boolean().optional(),
  planId: z.string().min(1).optional().nullable(),
  workspaceNote: z.string().max(5000).optional().nullable(),
  resellerOrgKind: z.enum(["AGENCY", "CLIENT"]).optional(),
});

export const patchChildOrganizationSchema = z
  .object({
    name: z.string().min(2, "Nome muito curto").max(120, "Nome muito longo").optional(),
    workspaceStatus: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]).optional(),
    workspaceNote: z.string().max(5000).optional().nullable(),
    resellerOrgKind: z.enum(["AGENCY", "CLIENT"]).optional(),
    featureOverrides: z.record(z.boolean()).optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Envie ao menos um campo para atualizar" });

export const organizationPlanSettingsSchema = z.object({
  inheritPlanFromParent: z.boolean().optional(),
  planId: z.string().min(1).optional().nullable(),
});

export const assignChildWorkspaceMemberSchema = z.object({
  userId: z.string().min(1, "Usuário obrigatório"),
  clientAccessLevel: z.enum(["ADMIN", "OPERADOR", "VIEWER"]),
});

export const agencyExcludeChildMemberSchema = z.object({
  userId: z.string().min(1, "Usuário obrigatório"),
});
