import { z } from "zod";

const limitsPartialSchema = z.object({
  maxUsers: z.number().int().min(0).nullable().optional(),
  maxClientAccounts: z.number().int().min(0).nullable().optional(),
  maxIntegrations: z.number().int().min(0).nullable().optional(),
  maxDashboards: z.number().int().min(0).nullable().optional(),
  maxChildOrganizations: z.number().int().min(0).nullable().optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export const resellerGovernancePatchSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    workspaceStatus: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]).optional(),
    workspaceNote: z.string().max(5000).optional().nullable(),
    resellerOrgKind: z.enum(["AGENCY", "CLIENT"]).optional(),
    inheritPlanFromParent: z.boolean().optional(),
    planId: z.string().min(1).optional().nullable(),
    featureOverrides: z.record(z.boolean()).optional().nullable(),
    subscription: z
      .object({
        planId: z.string().min(1).optional(),
        billingMode: z.string().min(1).max(64).optional(),
        status: z.string().min(1).max(64).optional(),
        renewsAt: z.string().optional().nullable(),
        endedAt: z.string().optional().nullable(),
        notes: z.string().max(5000).optional().nullable(),
      })
      .optional(),
    limitsOverride: limitsPartialSchema.optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Envie ao menos um campo para atualizar" });

export const resellerCreateChildSchema = z.object({
  name: z.string().min(2, "Nome muito curto").max(120, "Nome muito longo"),
  /** Omitir = criar sob a matriz; informar para vincular empresa a uma agência */
  parentOrganizationId: z.string().min(1).optional(),
  inheritPlanFromParent: z.boolean().optional(),
  planId: z.string().min(1).optional().nullable(),
  workspaceNote: z.string().max(5000).optional().nullable(),
  resellerOrgKind: z.enum(["AGENCY", "CLIENT"]).optional(),
});

export const resellerUserPatchSchema = z
  .object({
    email: z.string().email().optional(),
    name: z.string().min(1).max(120).optional(),
    suspended: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Envie ao menos um campo" });

export const resellerPasswordResetSchema = z.object({
  newPassword: z.string().min(8).max(128),
  /** Se true (padrão), usuário deve trocar senha no próximo login */
  forcePasswordChange: z.boolean().optional().default(true),
});

export const resellerMembershipRoleSchema = z.object({
  organizationId: z.string().min(1),
  targetUserId: z.string().min(1),
  role: z.string().min(1),
});

export const resellerRemoveMemberSchema = z.object({
  organizationId: z.string().min(1),
  targetUserId: z.string().min(1),
});

export const resellerMoveMembershipSchema = z.object({
  targetUserId: z.string().min(1),
  fromOrganizationId: z.string().min(1),
  toOrganizationId: z.string().min(1),
});

export const resellerEnterChildSchema = z.object({
  organizationId: z.string().min(1),
});

export const resellerAuditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  action: z.string().max(120).optional(),
  entityType: z.string().max(120).optional(),
  actorUserId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const planFeaturesJson = z.record(z.union([z.boolean(), z.string(), z.number()])).optional();

export const resellerPlanCreateSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  maxIntegrations: z.number().int().min(0),
  maxDashboards: z.number().int().min(0),
  maxUsers: z.number().int().min(0).nullable().optional(),
  maxClientAccounts: z.number().int().min(0).nullable().optional(),
  maxChildOrganizations: z.number().int().min(0).nullable().optional(),
  descriptionInternal: z.string().max(4000).nullable().optional(),
  active: z.boolean().optional(),
  planType: z.string().min(1).max(64).optional(),
  features: planFeaturesJson,
});

export const resellerPlanUpdateSchema = resellerPlanCreateSchema.partial();

export const resellerPlanDuplicateSchema = z.object({
  sourcePlanId: z.string().min(1),
  newSlug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  newName: z.string().min(1).max(120),
});

export const resellerCreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  password: z.string().min(8).max(128),
  organizationId: z.string().min(1),
  role: z.enum(["owner", "admin", "member", "media_manager", "analyst"]),
});

export const resellerInvitationSchema = z.object({
  organizationId: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["admin", "member", "media_manager", "analyst"]),
});

export const resellerEcosystemUsersQuerySchema = z.object({
  organizationId: z.string().optional(),
  resellerOrgKind: z.enum(["AGENCY", "CLIENT"]).optional(),
  suspended: z.enum(["true", "false"]).optional(),
  role: z.string().optional(),
  q: z.string().max(200).optional(),
});
