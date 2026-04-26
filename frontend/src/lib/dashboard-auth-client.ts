import { API_BASE } from "@/lib/api";
import { useAuthStore, type MembershipSummary, type User } from "@/stores/auth-store";

/** Contrato da página de login portátil (`LoginPage`). */
export interface AuthClient {
  login: (email: string, password: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
}

export type ResetTokenValidation = {
  valid: true;
  email: string;
  firstName: string | null;
} | {
  valid: false;
  message: string;
};

type LoginResponse = {
  user: User;
  accessToken: string;
  refreshToken: string;
  memberships?: MembershipSummary[] | null;
};

export const dashboardAuthClient: AuthClient = {
  async login(email, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    let json: LoginResponse & { message?: string } = {} as LoginResponse & { message?: string };
    try {
      json = (await res.json()) as LoginResponse & { message?: string };
    } catch {
      /* corpo vazio */
    }
    if (res.status === 429) {
      throw new Error(
        typeof json.message === "string" && json.message
          ? json.message
          : "Muitas tentativas de login. Aguarde alguns minutos."
      );
    }
    if (!res.ok) {
      throw new Error(json.message ?? "Email ou senha incorretos.");
    }
    useAuthStore.getState().setAuth(json.user, json.accessToken, json.refreshToken, {
      memberships: json.memberships ?? null,
      managedOrganizations: null,
    });
  },

  async requestPasswordReset(email: string) {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    let json: { message?: string } = {};
    try {
      json = await res.json();
    } catch {
      /* ignore */
    }
    if (!res.ok) {
      throw new Error(json.message ?? "Erro ao enviar email de redefinição");
    }
  },
};

/** Valida (sem consumir) um token de redefinição de senha. */
export async function validatePasswordResetToken(token: string): Promise<ResetTokenValidation> {
  const url = `${API_BASE}/auth/reset-password/validate?token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { method: "GET" });
  let json: {
    valid?: boolean;
    email?: string;
    firstName?: string | null;
    message?: string;
  } = {};
  try {
    json = (await res.json()) as typeof json;
  } catch {
    /* ignore */
  }
  if (!res.ok || !json.valid) {
    return { valid: false, message: json.message ?? "Token inválido ou expirado" };
  }
  return {
    valid: true,
    email: json.email ?? "",
    firstName: json.firstName ?? null,
  };
}

/** Confirma a redefinição com token + nova senha. */
export async function confirmPasswordReset(input: {
  token: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  let json: { message?: string } = {};
  try {
    json = (await res.json()) as { message?: string };
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    throw new Error(json.message ?? "Erro ao redefinir senha");
  }
}
