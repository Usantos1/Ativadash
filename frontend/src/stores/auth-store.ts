import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Empresa (organização) à qual o usuário está vinculado via Membership */
export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
}

export type MembershipOrganizationKind = "MATRIX" | "DIRECT" | "CLIENT_WORKSPACE";

export interface MembershipSummary {
  organizationId: string;
  role: string;
  /** Cargo na equipe (slug), ex.: traffic_manager */
  jobTitle?: string | null;
  organization: OrganizationSummary;
  /** Tipo de tenant (enviado pelo GET /auth/me). */
  organizationKind?: MembershipOrganizationKind;
  /** Quando não nulo, esta org do vínculo é filha na hierarquia (matriz/agência). */
  parentOrganizationId?: string | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  /** Opcional no backend; se ausente, usa-se a primeira palavra de `name`. */
  firstName?: string | null;
  organizationId: string;
  /** Preenchido no login/cadastro e em GET /auth/me */
  organization?: OrganizationSummary;
  /** Gestão global (PLATFORM_ADMIN_EMAILS no servidor) */
  platformAdmin?: boolean;
  /** Raiz do ecossistema habilitada como parceiro de revenda (admin global define na empresa raiz). */
  rootResellerPartner?: boolean;
  /** Calculado no servidor: pode mostrar menu / painel matriz neste contexto. */
  matrizNavEligible?: boolean;
  /** Tipo de tenant da organização ativa (JWT). */
  organizationKind?: MembershipOrganizationKind;
  /** Se definido, a org ativa é filha na hierarquia (ex.: agência filial). */
  parentOrganizationId?: string | null;
}

/** Resposta de GET /auth/me */
export type AuthMeResponse = User & {
  organization: OrganizationSummary;
  memberships: MembershipSummary[];
  managedOrganizations: OrganizationSummary[];
  platformAdmin?: boolean;
};

type AuthPatch = Partial<{
  memberships: MembershipSummary[] | null;
  managedOrganizations: OrganizationSummary[] | null;
}>;

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** Empresas em que o usuário é membro (troca de contexto) */
  memberships: MembershipSummary[] | null;
  /** Empresas cliente sob a agência atual (revenda) */
  managedOrganizations: OrganizationSummary[] | null;
  setAuth: (user: User, accessToken: string, refreshToken: string, patch?: AuthPatch) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      memberships: null,
      managedOrganizations: null,
      setAuth: (user, accessToken, refreshToken, patch) =>
        set((s) => ({
          user,
          accessToken,
          refreshToken,
          memberships: patch?.memberships !== undefined ? patch.memberships : s.memberships,
          managedOrganizations:
            patch?.managedOrganizations !== undefined ? patch.managedOrganizations : s.managedOrganizations,
        })),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          memberships: null,
          managedOrganizations: null,
        }),
      isAuthenticated: () => !!get().accessToken,
    }),
    { name: "ativa-dash-auth" }
  )
);
