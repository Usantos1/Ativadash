import { useAuthStore, type MembershipSummary, type User } from "@/stores/auth-store";
import { API_BASE } from "@/lib/api-config";

type RefreshResponse = {
  user: User;
  memberships: MembershipSummary[];
  accessToken: string;
  refreshToken: string;
};

/** Evita múltiplos POST /auth/refresh em paralelo (o backend invalida o refresh antigo a cada rotação). */
let refreshInFlight: Promise<boolean> | null = null;

/**
 * Obtém novos tokens com o refresh token persistido.
 * Preserva `managedOrganizations` (o endpoint de refresh não as devolve).
 */
export async function tryRefreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const { refreshToken, managedOrganizations } = useAuthStore.getState();
      if (!refreshToken) return false;

      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) return false;

      const data = (await res.json()) as RefreshResponse;
      useAuthStore.getState().setAuth(data.user, data.accessToken, data.refreshToken, {
        memberships: data.memberships,
        managedOrganizations,
      });
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}
