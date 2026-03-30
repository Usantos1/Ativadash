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

export const resellerCreateChildSchema = z
  .object({
    name: z.string().min(2, "Nome muito curto").max(120, "Nome muito longo"),
    /** Omitir = criar sob a matriz; informar para vincular empresa a uma agência */
    parentOrganizationId: z.string().min(1).optional(),
    inheritPlanFromParent: z.boolean().optional(),
    planId: z.string().min(1).optional().nullable(),
    workspaceNote: z.string().max(5000).optional().nullable(),
    resellerOrgKind: z.enum(["AGENCY", "CLIENT"]).optional(),
    /** Cadastro completo de empresa cliente (revenda) */
    legalName: z.string().max(200).optional().nullable(),
    taxId: z.string().max(22).optional(),
    phoneWhatsapp: z.string().max(22).optional(),
    ownerEmail: z.string().max(254).optional(),
    ownerName: z.string().max(120).optional(),
    ownerPassword: z.string().min(8).max(128).optional(),
    addressLine1: z.string().max(200).optional(),
    addressNumber: z.string().max(20).optional(),
    addressDistrict: z.string().max(120).optional(),
    addressCity: z.string().max(120).optional(),
    addressState: z.string().max(2).optional(),
    addressPostalCode: z.string().max(12).optional(),
  })
  .superRefine((data, ctx) => {
    const kind = data.resellerOrgKind ?? "CLIENT";
    if (kind === "AGENCY" && data.parentOrganizationId?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["parentOrganizationId"],
        message: "Agências são criadas na matriz; não informe organização pai.",
      });
    }
    const cnpj = (data.taxId ?? "").replace(/\D/g, "");
    if (cnpj.length > 0 && cnpj.length !== 14) {
      ctx.addIssue({
        code: "custom",
        path: ["taxId"],
        message: "CNPJ deve ter 14 dígitos ou ficar em branco.",
      });
    }

    const phone = (data.phoneWhatsapp ?? "").replace(/\D/g, "");
    if (phone.length < 10 || phone.length > 15) {
      ctx.addIssue({
        code: "custom",
        path: ["phoneWhatsapp"],
        message: "Informe um WhatsApp com DDD (10 a 15 dígitos).",
      });
    }

    const email = (data.ownerEmail ?? "").trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      ctx.addIssue({
        code: "custom",
        path: ["ownerEmail"],
        message: "E-mail do administrador é obrigatório.",
      });
    }

    const oname = (data.ownerName ?? "").trim();
    if (oname.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["ownerName"],
        message: "Nome do responsável é obrigatório.",
      });
    }

    if (!data.ownerPassword || data.ownerPassword.length < 8) {
      ctx.addIssue({
        code: "custom",
        path: ["ownerPassword"],
        message: "Senha inicial com no mínimo 8 caracteres.",
      });
    }

    const uf = (data.addressState ?? "").trim().toUpperCase();
    if (uf.length > 0 && !/^[A-Z]{2}$/.test(uf)) {
      ctx.addIssue({
        code: "custom",
        path: ["addressState"],
        message: "UF com 2 letras (ex.: SP) ou em branco.",
      });
    }

    const cep = (data.addressPostalCode ?? "").replace(/\D/g, "");
    if (cep.length > 0 && cep.length !== 8) {
      ctx.addIssue({
        code: "custom",
        path: ["addressPostalCode"],
        message: "CEP com 8 dígitos ou em branco.",
      });
    }
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
  role: z.enum([
    "owner",
    "admin",
    "member",
    "media_manager",
    "analyst",
    "agency_owner",
    "agency_admin",
    "agency_ops",
    "workspace_owner",
    "workspace_admin",
    "report_viewer",
    "media_meta_manager",
    "media_google_manager",
    "performance_analyst",
  ]),
});

export const resellerInvitationSchema = z.object({
  organizationId: z.string().min(1),
  email: z.string().email(),
  role: z.enum([
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
  ]),
});

export const matrixWorkspaceGrantUpsertSchema = z.object({
  userId: z.string().min(1),
  workspaceOrganizationId: z.string().min(1),
  allowedChannels: z.array(z.string().min(1)).optional(),
});

export const resellerEcosystemUsersQuerySchema = z.object({
  organizationId: z.string().optional(),
  resellerOrgKind: z.enum(["AGENCY", "CLIENT"]).optional(),
  suspended: z.enum(["true", "false"]).optional(),
  role: z.string().optional(),
  q: z.string().max(200).optional(),
});
