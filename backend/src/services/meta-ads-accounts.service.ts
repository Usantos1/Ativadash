/**
 * Setup Meta Ads: Business Managers, contas de anúncios, vínculos por cliente e conta padrão da org.
 */
import { prisma } from "../utils/prisma.js";
import { metaGraphGet, metaGraphGetAllPages, getMetaAppSecret } from "./meta/meta-graph.js";

const META_SLUG = "meta";

/** Quando /me/businesses vem vazio ou sem permissão — contas só de /me/adaccounts */
export const META_PERSONAL_BUSINESS_SENTINEL = "__personal__";

export type ParsedMetaAdsConfig = {
  access_token: string;
  expiry_date?: number;
  default_ad_account_id?: string | null;
  default_business_id?: string | null;
};

export function parseMetaAdsConfig(raw: string | null | undefined): ParsedMetaAdsConfig | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ParsedMetaAdsConfig;
  } catch {
    return null;
  }
}

function normAdId(id: string): string {
  return id.replace(/\D/g, "");
}

export type MetaGraphAdAccount = {
  id: string;
  name: string;
  account_id: string;
  account_status?: number | string;
  currency?: string;
};

export type MetaSetupBusinessRow = { id: string; name: string };

export type MetaSetupAdAccountRow = {
  businessId: string;
  businessName: string;
  graphId: string;
  name: string;
  accountId: string;
  accountStatus: string | null;
  currency: string | null;
};

export type MetaSetupAssignmentRow = {
  clientAccountId: string;
  clientName: string;
  businessId: string;
  adAccountId: string;
};

export type MetaAdsSetupDto = {
  integrationId: string;
  facebookUserName: string | null;
  facebookUserId: string | null;
  defaultAdAccountId: string | null;
  defaultBusinessId: string | null;
  accessibleAdAccountCount: number;
  assignmentCount: number;
  businesses: MetaSetupBusinessRow[];
  adAccounts: MetaSetupAdAccountRow[];
  assignments: MetaSetupAssignmentRow[];
};

async function fetchMeUser(accessToken: string, appSecret: string): Promise<{ id?: string; name?: string }> {
  try {
    return await metaGraphGet<{ id?: string; name?: string }>(
      `/me?fields=id,name`,
      accessToken,
      appSecret
    );
  } catch {
    return {};
  }
}

async function fetchAllAdAccountsFromMe(
  accessToken: string,
  appSecret: string
): Promise<MetaGraphAdAccount[]> {
  const res = await metaGraphGet<{ data: MetaGraphAdAccount[] }>(
    `/me/adaccounts?fields=id,name,account_id,account_status,currency`,
    accessToken,
    appSecret
  );
  return res.data ?? [];
}

/** Catálogo BM + contas (owned + client) para a UI de vínculo */
export async function fetchMetaCatalogFromGraph(
  accessToken: string,
  appSecret: string
): Promise<{ businesses: MetaSetupBusinessRow[]; adAccounts: MetaSetupAdAccountRow[] }> {
  const fields = "id,name,account_id,account_status,currency";
  let businessRows: { id: string; name: string }[] = [];
  try {
    const busRes = await metaGraphGet<{ data: { id: string; name: string }[] }>(
      `/me/businesses?fields=id,name`,
      accessToken,
      appSecret
    );
    businessRows = busRes.data ?? [];
  } catch (e) {
    console.warn("[Meta Ads] /me/businesses:", e instanceof Error ? e.message : e);
  }

  const adAccounts: MetaSetupAdAccountRow[] = [];

  if (businessRows.length === 0) {
    const direct = await fetchAllAdAccountsFromMe(accessToken, appSecret);
    for (const a of direct) {
      const aid = normAdId(a.account_id || a.id);
      if (!aid) continue;
      adAccounts.push({
        businessId: META_PERSONAL_BUSINESS_SENTINEL,
        businessName: "Contas do usuário",
        graphId: a.id.startsWith("act_") ? a.id : `act_${aid}`,
        name: a.name ?? `Conta ${aid}`,
        accountId: aid,
        accountStatus: a.account_status != null ? String(a.account_status) : null,
        currency: a.currency ?? null,
      });
    }
    return {
      businesses: [{ id: META_PERSONAL_BUSINESS_SENTINEL, name: "Contas do usuário" }],
      adAccounts,
    };
  }

  for (const b of businessRows) {
    const owned = await metaGraphGetAllPages<MetaGraphAdAccount>(
      `/${b.id}/owned_ad_accounts?fields=${fields}`,
      accessToken,
      appSecret
    );
    const client = await metaGraphGetAllPages<MetaGraphAdAccount>(
      `/${b.id}/client_ad_accounts?fields=${fields}`,
      accessToken,
      appSecret
    );
    const seen = new Set<string>();
    for (const a of [...owned, ...client]) {
      const aid = normAdId(a.account_id || a.id.replace("act_", ""));
      if (!aid || seen.has(aid)) continue;
      seen.add(aid);
      adAccounts.push({
        businessId: b.id,
        businessName: b.name,
        graphId: a.id?.startsWith("act_") ? a.id : `act_${aid}`,
        name: a.name ?? `Conta ${aid}`,
        accountId: aid,
        accountStatus: a.account_status != null ? String(a.account_status) : null,
        currency: a.currency ?? null,
      });
    }
  }

  return { businesses: businessRows, adAccounts };
}

export async function getMetaAdsSetup(organizationId: string): Promise<MetaAdsSetupDto | null> {
  const integration = await prisma.integration.findUnique({
    where: { organizationId_slug: { organizationId, slug: META_SLUG } },
    include: {
      metaAdsAssignments: { include: { clientAccount: { select: { id: true, name: true } } } },
    },
  });
  if (!integration?.config || integration.status !== "connected") return null;
  const cfg = parseMetaAdsConfig(integration.config);
  if (!cfg?.access_token) return null;
  const appSecret = getMetaAppSecret();
  if (!appSecret) return null;

  const me = await fetchMeUser(cfg.access_token, appSecret);
  const { businesses, adAccounts } = await fetchMetaCatalogFromGraph(cfg.access_token, appSecret);

  const assignments: MetaSetupAssignmentRow[] = integration.metaAdsAssignments.map((a) => ({
    clientAccountId: a.clientAccountId,
    clientName: a.clientAccount.name,
    businessId: a.businessId,
    adAccountId: a.adAccountId,
  }));

  return {
    integrationId: integration.id,
    facebookUserName: me.name ?? null,
    facebookUserId: me.id ?? null,
    defaultAdAccountId: cfg.default_ad_account_id ? normAdId(cfg.default_ad_account_id) : null,
    defaultBusinessId: cfg.default_business_id ?? null,
    accessibleAdAccountCount: adAccounts.length,
    assignmentCount: assignments.length,
    businesses,
    adAccounts,
    assignments,
  };
}

export async function setDefaultMetaAdsAdAccount(
  integrationId: string,
  organizationId: string,
  adAccountId: string | null,
  businessId: string | null
): Promise<{ ok: true } | { ok: false; message: string }> {
  const integ = await prisma.integration.findFirst({
    where: { id: integrationId, organizationId, slug: META_SLUG },
  });
  if (!integ?.config) return { ok: false, message: "Integração Meta não encontrada." };
  const cfg = parseMetaAdsConfig(integ.config);
  if (!cfg?.access_token) return { ok: false, message: "Token Meta inválido." };

  const next = {
    ...cfg,
    default_ad_account_id: adAccountId ? normAdId(adAccountId) : null,
    default_business_id: businessId && businessId !== META_PERSONAL_BUSINESS_SENTINEL ? businessId : null,
  };
  await prisma.integration.update({
    where: { id: integrationId },
    data: { config: JSON.stringify(next), updatedAt: new Date() },
  });
  return { ok: true };
}

export async function upsertMetaAdsClientAssignment(
  integrationId: string,
  organizationId: string,
  clientAccountId: string,
  businessId: string,
  adAccountId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const client = await prisma.clientAccount.findFirst({
    where: { id: clientAccountId, organizationId, deletedAt: null },
  });
  if (!client) return { ok: false, message: "Cliente não encontrado." };
  const integ = await prisma.integration.findFirst({
    where: { id: integrationId, organizationId, slug: META_SLUG },
  });
  if (!integ) return { ok: false, message: "Integração Meta não encontrada." };

  const aid = normAdId(adAccountId);
  if (!aid) return { ok: false, message: "ID da conta de anúncios inválido." };

  await prisma.metaAdsAssignment.upsert({
    where: { integrationId_clientAccountId: { integrationId, clientAccountId } },
    create: {
      integrationId,
      organizationId,
      clientAccountId,
      businessId,
      adAccountId: aid,
    },
    update: { businessId, adAccountId: aid, updatedAt: new Date() },
  });
  return { ok: true };
}

export async function deleteMetaAdsClientAssignment(
  integrationId: string,
  organizationId: string,
  clientAccountId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const row = await prisma.metaAdsAssignment.findFirst({
    where: { integrationId, clientAccountId, organizationId },
  });
  if (!row) return { ok: false, message: "Vínculo não encontrado." };
  await prisma.metaAdsAssignment.delete({ where: { id: row.id } });
  return { ok: true };
}

/**
 * Resolve quais contas Meta usar em métricas / dashboard.
 * `clientAccountId === undefined` e sem vínculos estruturados → todas as contas (legado).
 * `clientAccountId === undefined` com vínculos → visão org (padrão ou união dos vínculos).
 * `clientAccountId === null` → visão org explícita.
 * `clientAccountId` id → só a conta vinculada a esse cliente.
 */
export async function resolveMetaAdAccountsForQuery(
  organizationId: string,
  clientAccountId: string | null | undefined
): Promise<{ accounts: MetaGraphAdAccount[] } | { error: string }> {
  const integration = await prisma.integration.findUnique({
    where: { organizationId_slug: { organizationId, slug: META_SLUG } },
    include: { metaAdsAssignments: true },
  });
  if (!integration?.config || integration.status !== "connected") {
    return { error: "not_connected" };
  }
  const cfg = parseMetaAdsConfig(integration.config);
  if (!cfg?.access_token) return { error: "not_connected" };
  const appSecret = getMetaAppSecret();
  if (!appSecret) return { error: "no_secret" };

  let all: MetaGraphAdAccount[];
  try {
    all = await fetchAllAdAccountsFromMe(cfg.access_token, appSecret);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "graph_error" };
  }

  const assignments = integration.metaAdsAssignments;
  const defaultNumeric = cfg.default_ad_account_id ? normAdId(cfg.default_ad_account_id) : "";
  const hasStructuredBindings = !!(defaultNumeric && defaultNumeric.length) || assignments.length > 0;

  function pickByNumericId(numericId: string): MetaGraphAdAccount[] {
    const id = normAdId(numericId);
    const hit = all.find((a) => normAdId(a.account_id) === id || a.id === `act_${id}`);
    return hit ? [hit] : [];
  }

  if (!hasStructuredBindings) {
    if (clientAccountId === undefined || clientAccountId === null) {
      return { accounts: all };
    }
    const asn = assignments.find((a) => a.clientAccountId === clientAccountId);
    if (!asn) return { accounts: [] };
    return { accounts: pickByNumericId(asn.adAccountId) };
  }

  if (clientAccountId) {
    const asn = assignments.find((a) => a.clientAccountId === clientAccountId);
    if (!asn) return { accounts: [] };
    return { accounts: pickByNumericId(asn.adAccountId) };
  }

  if (defaultNumeric) {
    return { accounts: pickByNumericId(defaultNumeric) };
  }

  const allowed = new Set(assignments.map((a) => normAdId(a.adAccountId)));
  const filtered = all.filter((a) => allowed.has(normAdId(a.account_id)));
  return { accounts: filtered };
}
