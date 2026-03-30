import { api } from "./api";
import type { OrganizationSummary, User, MembershipSummary } from "@/stores/auth-store";

export type PlanLimits = {
  maxUsers: number | null;
  maxIntegrations: number;
  maxDashboards: number;
  maxClientAccounts: number | null;
  maxChildOrganizations: number | null;
};

export type PlanUsage = {
  directMembers: number;
  pendingInvitations?: number;
  integrations: number;
  dashboards: number;
  clientAccounts: number;
  childOrganizations: number;
  projects: number;
  launches: number;
};

export type EnabledFeatures = {
  marketingDashboard: boolean;
  performanceAlerts: boolean;
  multiUser: boolean;
  multiOrganization: boolean;
  integrations: boolean;
  webhooks: boolean;
  marketing: boolean;
  captacao: boolean;
  conversao: boolean;
  receita: boolean;
  whatsappcrm: boolean;
  revenda: boolean;
  auditoria: boolean;
  relatorios_avancados: boolean;
  dashboards_premium: boolean;
  api: boolean;
  automacoes: boolean;
  /** PATCH status/orçamento em campanhas Meta/Google. */
  campaignWrite: boolean;
};

export type WorkspaceStatus = "ACTIVE" | "PAUSED" | "ARCHIVED";

export type SubscriptionView = {
  billingMode: string;
  status: string;
  startedAt: string;
  renewsAt: string | null;
  endedAt: string | null;
  notes: string | null;
  plan: {
    id: string;
    name: string;
    slug: string;
    planType: string;
    active: boolean;
  };
  billingOrganization: { id: string; name: string } | null;
  inherited: boolean;
};

/** Exibe limite numérico ou "Ilimitado" quando null. */
export function formatPlanCap(n: number | null | undefined): string {
  if (n === null || n === undefined) return "Ilimitado";
  return String(n);
}

/**
 * Cotas na UI de assinatura: `0` pode significar “recurso fora do plano” (ex.: empresas filhas no Essencial).
 */
export function formatPlanLimit(
  n: number | null | undefined,
  opts?: { zeroMeansNotIncluded?: boolean }
): string {
  if (n === null || n === undefined) return "Ilimitado";
  if (opts?.zeroMeansNotIncluded && n === 0) return "Não incluído";
  return String(n);
}

export type OrganizationContext = {
  id: string;
  name: string;
  slug: string;
  featureOverrides?: Record<string, unknown> | null;
  parentOrganization: OrganizationSummary | null;
  plan: { id: string; name: string; slug: string; planType: string; active: boolean } | null;
  planSource?: "own" | "parent";
  limits: PlanLimits;
  limitsHaveOverrides?: boolean;
  usage: PlanUsage;
  subscription: SubscriptionView | null;
  enabledFeatures: EnabledFeatures;
  /** Na raiz do ecossistema: empresa designada para revenda / painel matriz. */
  rootResellerPartner: boolean;
};

export async function fetchOrganizationContext(): Promise<OrganizationContext> {
  return api.get<OrganizationContext>("/organization");
}

export async function patchOrganizationName(name: string): Promise<{ organization: OrganizationSummary }> {
  return api.patch<{ organization: OrganizationSummary }>("/organization", { name });
}

export async function fetchManagedOrganizations(): Promise<OrganizationSummary[]> {
  const res = await api.get<{ organizations: OrganizationSummary[] }>("/organization/children");
  return res.organizations;
}

export async function createManagedOrganization(
  name: string,
  options?: {
    inheritPlanFromParent?: boolean;
    planId?: string | null;
    workspaceNote?: string | null;
    resellerOrgKind?: ResellerOrgKind;
  }
): Promise<{
  organization: OrganizationSummary & {
    inheritPlanFromParent?: boolean;
    planId?: string | null;
    workspaceStatus?: WorkspaceStatus;
    workspaceNote?: string | null;
    resellerOrgKind?: ResellerOrgKind | null;
  };
}> {
  return api.post("/organization/children", {
    name,
    ...(options?.inheritPlanFromParent !== undefined
      ? { inheritPlanFromParent: options.inheritPlanFromParent }
      : {}),
    ...(options?.planId !== undefined ? { planId: options.planId } : {}),
    ...(options?.workspaceNote !== undefined ? { workspaceNote: options.workspaceNote } : {}),
    ...(options?.resellerOrgKind !== undefined ? { resellerOrgKind: options.resellerOrgKind } : {}),
  });
}

export async function fetchChildrenPortfolio(): Promise<{
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    inheritPlanFromParent: boolean;
    connectedIntegrations: number;
    lastIntegrationSyncAt: string | null;
    createdAt: string;
    workspaceStatus?: "ACTIVE" | "PAUSED" | "ARCHIVED";
  }>;
}> {
  return api.get("/organization/children/portfolio");
}

export type ResellerOrgKind = "AGENCY" | "CLIENT";

export type ChildMarketingRollup30d = {
  spend: number;
  leads: number;
  cpl: number | null;
};

export type ChildWorkspaceOperationsRow = {
  id: string;
  name: string;
  slug: string;
  parentOrganizationId: string | null;
  parentOrganization: { id: string; name: string } | null;
  createdAt: string;
  inheritPlanFromParent: boolean;
  workspaceStatus: WorkspaceStatus;
  workspaceNote: string | null;
  resellerOrgKind: ResellerOrgKind | null;
  planId: string | null;
  plan: { id: string; name: string; slug: string } | null;
  featureOverrides: unknown;
  subscription: {
    id: string;
    billingMode: string;
    status: string;
    renewsAt: string | null;
    startedAt: string;
    planId: string;
  } | null;
  limitsOverride: {
    maxUsers: number | null;
    maxIntegrations: number | null;
    maxDashboards: number | null;
    maxClientAccounts: number | null;
    maxChildOrganizations: number | null;
    notes: string | null;
  } | null;
  memberCount: number;
  pendingInvitationsCount: number;
  dashboardCount: number;
  connectedIntegrations: number;
  lastIntegrationSyncAt: string | null;
  lastActivityAt: string | null;
  staleActivity: boolean;
  neverAccessed: boolean;
  needsAttention: boolean;
  metaAdsConnected: boolean;
  googleAdsConnected: boolean;
  marketing30d: ChildMarketingRollup30d | null;
  /** Agregados por workspace filho (API `/organization/children/operations`). */
  clientAccountCount?: number;
  projectCount?: number;
  launchCount?: number;
  activeLaunchCount?: number;
};

export type ChildOperationsAlert = {
  type: string;
  severity: "info" | "warning" | "critical";
  organizationId: string;
  name: string;
  message: string;
};

export type ChildrenOperationsDashboard = {
  parent: {
    plan: OrganizationContext["plan"];
    planSource?: OrganizationContext["planSource"];
    limits: PlanLimits;
    limitsHaveOverrides: boolean;
    usage: PlanUsage;
  };
  organizations: ChildWorkspaceOperationsRow[];
  summary: {
    totalWorkspaces: number;
    activeWorkspaces: number;
    pausedWorkspaces: number;
    archivedWorkspaces: number;
    withoutIntegration: number;
    withoutMembers: number;
    staleActivityCount: number;
    integrationsTotalAcrossChildren: number;
    usersTotalAcrossChildren: number;
    dashboardsTotalAcrossChildren: number;
    childSlotsUsed: number;
    childSlotsCap: number | null;
    childrenWithActiveLaunches?: number;
    totalProjectsAcrossChildren?: number;
    totalLaunchesAcrossChildren?: number;
  };
  alerts: ChildOperationsAlert[];
};

export async function fetchChildrenOperationsDashboard(): Promise<ChildrenOperationsDashboard> {
  return api.get<ChildrenOperationsDashboard>("/organization/children/operations");
}

export async function patchChildWorkspace(
  childId: string,
  body: {
    name?: string;
    workspaceStatus?: WorkspaceStatus;
    workspaceNote?: string | null;
    resellerOrgKind?: ResellerOrgKind;
    featureOverrides?: Record<string, boolean> | null;
  }
): Promise<{
  organization: {
    id: string;
    name: string;
    slug: string;
    inheritPlanFromParent: boolean;
    workspaceStatus: WorkspaceStatus;
    workspaceNote: string | null;
    resellerOrgKind: ResellerOrgKind | null;
    featureOverrides: unknown;
    createdAt: string;
  };
}> {
  return api.patch(`/organization/children/${childId}`, body);
}

export async function patchOrganizationPlanSettings(body: {
  inheritPlanFromParent?: boolean;
  planId?: string | null;
}): Promise<{ organization: { id: string; inheritPlanFromParent: boolean; planId: string | null } }> {
  return api.patch("/organization/plan-settings", body);
}

export type SwitchOrganizationResponse = {
  user: User & { organization: OrganizationSummary };
  memberships: MembershipSummary[];
  managedOrganizations: OrganizationSummary[];
  accessToken: string;
  refreshToken: string;
};

export async function switchWorkspaceOrganization(
  organizationId: string
): Promise<SwitchOrganizationResponse> {
  return api.post<SwitchOrganizationResponse>("/auth/switch-organization", { organizationId });
}

/** Alias canônico — mesmo contrato que `switchWorkspaceOrganization`. */
export async function setActiveOrganization(organizationId: string): Promise<SwitchOrganizationResponse> {
  return api.post<SwitchOrganizationResponse>("/auth/me/active-organization", { organizationId });
}
