import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Senha obrigatória"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  /** Nome da empresa (organização) — cada novo usuário é vinculado a uma organização */
  organizationName: z
    .string()
    .min(2, "Nome da empresa deve ter pelo menos 2 caracteres")
    .max(120, "Nome da empresa muito longo")
    .optional(),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("E-mail inválido"),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token obrigatório"),
});

export const switchOrganizationSchema = z.object({
  organizationId: z.string().min(1, "Empresa inválida"),
});

export const registerWithInviteSchema = z.object({
  token: z.string().min(16, "Token inválido"),
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

export const acceptInviteTokenSchema = z.object({
  token: z.string().min(16, "Token inválido"),
});

/** Troca de senha com sessão JWT (sem e-mail). */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Senha atual obrigatória"),
    newPassword: z.string().min(6, "Nova senha: mínimo 6 caracteres"),
    confirmPassword: z.string().min(1, "Confirme a nova senha"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Confirmação diferente da nova senha",
    path: ["confirmPassword"],
  });

/** Confirmação de redefinição de senha (token enviado por e-mail). */
export const resetPasswordSchema = z
  .object({
    token: z.string().min(16, "Token inválido"),
    newPassword: z.string().min(6, "Nova senha: mínimo 6 caracteres"),
    confirmPassword: z.string().min(1, "Confirme a nova senha"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Confirmação diferente da nova senha",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type SwitchOrganizationInput = z.infer<typeof switchOrganizationSchema>;
export type RegisterWithInviteInput = z.infer<typeof registerWithInviteSchema>;
export type AcceptInviteTokenInput = z.infer<typeof acceptInviteTokenSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
