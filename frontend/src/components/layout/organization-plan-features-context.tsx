import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuthStore } from "@/stores/auth-store";
import { fetchOrganizationContext, type EnabledFeatures } from "@/lib/organization-api";

export const ORGANIZATION_PLAN_FEATURES_REFRESH_EVENT = "ativadash:organization-plan-features-refresh";

/** Reexecuta `GET /organization` no provider (menu + guards). */
export function dispatchOrganizationPlanFeaturesRefresh(): void {
  window.dispatchEvent(new Event(ORGANIZATION_PLAN_FEATURES_REFRESH_EVENT));
}

/** Evita pedidos extra quando a matriz/plataforma altera outra empresa. */
export function dispatchOrganizationPlanFeaturesRefreshIfCurrentOrg(
  currentOrganizationId: string | undefined | null,
  affectedOrganizationId: string
): void {
  if (currentOrganizationId && currentOrganizationId === affectedOrganizationId) {
    dispatchOrganizationPlanFeaturesRefresh();
  }
}

type OrganizationPlanFeaturesContextValue = {
  enabledFeatures: EnabledFeatures | null;
  refreshPlanFeatures: () => Promise<void>;
};

const OrganizationPlanFeaturesContext = createContext<OrganizationPlanFeaturesContextValue | null>(
  null
);

/**
 * Um único `GET /organization` por sessão de org ativa — partilhado entre menu e guards.
 * Ouça `ORGANIZATION_PLAN_FEATURES_REFRESH_EVENT` ou use `refreshPlanFeatures` após mudar plano/módulos.
 */
export function OrganizationPlanFeaturesProvider({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const organizationId = useAuthStore((s) => s.user?.organizationId);
  const [enabledFeatures, setEnabledFeatures] = useState<EnabledFeatures | null>(null);

  const refreshPlanFeatures = useCallback(async () => {
    if (!accessToken || !organizationId) {
      setEnabledFeatures(null);
      return;
    }
    try {
      const ctx = await fetchOrganizationContext();
      setEnabledFeatures(ctx.enabledFeatures);
    } catch {
      setEnabledFeatures(null);
    }
  }, [accessToken, organizationId]);

  useEffect(() => {
    void refreshPlanFeatures();
  }, [refreshPlanFeatures]);

  useEffect(() => {
    const onExternalRefresh = () => {
      void refreshPlanFeatures();
    };
    window.addEventListener(ORGANIZATION_PLAN_FEATURES_REFRESH_EVENT, onExternalRefresh);
    return () => window.removeEventListener(ORGANIZATION_PLAN_FEATURES_REFRESH_EVENT, onExternalRefresh);
  }, [refreshPlanFeatures]);

  const value = useMemo(
    () => ({ enabledFeatures, refreshPlanFeatures }),
    [enabledFeatures, refreshPlanFeatures]
  );

  return (
    <OrganizationPlanFeaturesContext.Provider value={value}>
      {children}
    </OrganizationPlanFeaturesContext.Provider>
  );
}

export function useOrganizationPlanFeatures(): EnabledFeatures | null {
  return useContext(OrganizationPlanFeaturesContext)?.enabledFeatures ?? null;
}

export function useRefreshOrganizationPlanFeatures(): () => Promise<void> {
  return useContext(OrganizationPlanFeaturesContext)?.refreshPlanFeatures ?? (async () => {});
}
