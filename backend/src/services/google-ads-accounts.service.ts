/**
 * Google Ads: OAuth identity, contas acessíveis (ListAccessibleCustomers + metadados),
 * atribuição explícita (default + por cliente comercial) e resolução para queries API.
 */
import { env } from "../config/env.js";
import { prisma } from "../utils/prisma.js";
import {
  isGoogleAdsDeveloperTokenConfigured,
  isGoogleAdsUxPending,
} from "../utils/google-ads-readiness.js";

const GOOGLE_ADS_SLUG = "google-ads";
const API_VERSION = "v20";

const isDevLog = process.env.NODE_ENV !== "production";

export type ParsedGoogleAdsIntegrationConfig = {
  access_token: string;
  refresh_token: string | null;
  expiry_date: number;
  google_user_email?: string;
  google_user_sub?: string;
  default_google_customer_id?: string | null;
  default_login_customer_id?: string | null;
};

export type GoogleAdsOperationalContext =
  | {
      ok: true;
      accessToken: string;
      customerId: string;
      loginCustomerId: string | null;
      integrationId: string;
    }
  | { ok: false; code: string; message: string };

export function parseGoogleAdsConfig(raw: string | null): ParsedGoogleAdsIntegrationConfig | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ParsedGoogleAdsIntegrationConfig;
  } catch {
    return null;
  }
}

export function normalizeGoogleAdsCustomerId(id: string): string {
  return id.replace(/-/g, "");
}

function normCid(id: string): string {
  return normalizeGoogleAdsCustomerId(id);
}

export function buildGoogleAdsHeaders(
  accessToken: string,
  developerToken: string,
  loginCustomerId: string | null | undefined
): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": developerToken,
    "Content-Type": "application/json",
  };
  const login = loginCustomerId?.trim();
  if (login) {
    h["login-customer-id"] = normCid(login);
  }
  return h;
}

async function listAccessibleCustomerIds(
  accessToken: string,
  developerToken: string
): Promise<string[]> {
  const res = await fetch(
    `https://googleads.googleapis.com/${API_VERSION}/customers:listAccessibleCustomers`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": developerToken,
      },
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ListAccessibleCustomers: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { resourceNames?: string[] };
  return (data.resourceNames ?? []).map((r) => r.replace("customers/", "").replace(/-/g, ""));
}

type CustomerMeta = {
  descriptiveName: string | null;
  currencyCode: string | null;
  isManager: boolean;
  status: string | null;
};

async function fetchCustomerMeta(
  accessToken: string,
  developerToken: string,
  customerId: string,
  loginCustomerId?: string | null
): Promise<CustomerMeta | null> {
  const cid = normCid(customerId);
  const query = `
    SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.manager, customer.status
    FROM customer
    LIMIT 1
  `.trim();
  const res = await fetch(
    `https://googleads.googleapis.com/${API_VERSION}/customers/${cid}/googleAds:searchStream`,
    {
      method: "POST",
      headers: buildGoogleAdsHeaders(accessToken, developerToken, loginCustomerId ?? null),
      body: JSON.stringify({ query }),
    }
  );
  if (!res.ok) return null;
  const raw = await res.json();
  const batches = Array.isArray(raw) ? raw : [raw];
  for (const batch of batches) {
    const results = (batch as { results?: unknown[] }).results ?? [];
    const row = results[0] as
      | {
          customer?: {
            id?: string | number;
            descriptiveName?: string;
            currencyCode?: string;
            manager?: boolean;
            status?: string;
          };
        }
      | undefined;
    if (row?.customer) {
      const c = row.customer;
      return {
        descriptiveName: c.descriptiveName ?? null,
        currencyCode: c.currencyCode ?? null,
        isManager: Boolean(c.manager),
        status: c.status ?? null,
      };
    }
  }
  return null;
}

async function refreshAndSaveGoogleAdsToken(
  organizationId: string,
  current: ParsedGoogleAdsIntegrationConfig
): Promise<ParsedGoogleAdsIntegrationConfig> {
  if (!current.refresh_token) throw new Error("Sem refresh token");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: current.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Falha ao renovar token: ${t}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  const next: ParsedGoogleAdsIntegrationConfig = {
    ...current,
    access_token: data.access_token,
    refresh_token: current.refresh_token,
    expiry_date: Date.now() + data.expires_in * 1000,
  };
  await prisma.integration.update({
    where: { organizationId_slug: { organizationId, slug: GOOGLE_ADS_SLUG } },
    data: {
      config: JSON.stringify(next),
      lastSyncAt: new Date(),
    },
  });
  return next;
}

export async function ensureGoogleAdsAccessToken(
  organizationId: string,
  config: ParsedGoogleAdsIntegrationConfig
): Promise<string> {
  const now = Date.now();
  const margin = 5 * 60 * 1000;
  if (config.expiry_date && now >= config.expiry_date - margin) {
    const next = await refreshAndSaveGoogleAdsToken(organizationId, config);
    return next.access_token;
  }
  return config.access_token;
}

/**
 * Persiste contas acessíveis + metadados. Substitui linhas anteriores desta integração.
 */
export async function syncAccessibleGoogleAdsCustomers(
  integrationId: string,
  organizationId: string
): Promise<{ ok: true; count: number } | { ok: false; message: string }> {
  if (isGoogleAdsUxPending()) {
    return { ok: false, message: "Google Ads em modo UX pendente." };
  }
  if (!isGoogleAdsDeveloperTokenConfigured()) {
    return { ok: false, message: "Developer token não configurado." };
  }
  const integration = await prisma.integration.findFirst({
    where: { id: integrationId, organizationId, slug: GOOGLE_ADS_SLUG, status: "connected" },
  });
  if (!integration?.config) {
    return { ok: false, message: "Integração Google Ads não conectada." };
  }
  const parsed = parseGoogleAdsConfig(integration.config);
  if (!parsed) return { ok: false, message: "Config inválida." };

  const developerToken = env.GOOGLE_ADS_DEVELOPER_TOKEN.trim();
  let accessToken: string;
  try {
    accessToken = await ensureGoogleAdsAccessToken(organizationId, parsed);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }

  let ids: string[];
  try {
    ids = await listAccessibleCustomerIds(accessToken, developerToken);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }

  const metaById = new Map<string, CustomerMeta & { managerCustomerId: string | null }>();

  for (const id of ids) {
    const m = await fetchCustomerMeta(accessToken, developerToken, id, null);
    if (m) {
      metaById.set(id, { ...m, managerCustomerId: null });
    }
  }

  for (const id of ids) {
    if (metaById.has(id)) continue;
    for (const mid of ids) {
      const parent = metaById.get(mid);
      if (!parent?.isManager) continue;
      const m = await fetchCustomerMeta(accessToken, developerToken, id, mid);
      if (m) {
        metaById.set(id, { ...m, managerCustomerId: mid });
        break;
      }
    }
  }

  await prisma.googleAdsAccessibleCustomer.deleteMany({ where: { integrationId } });

  const rows = ids.map((customerId) => {
    const m = metaById.get(customerId);
    return {
      integrationId,
      customerId,
      descriptiveName: m?.descriptiveName ?? null,
      currencyCode: m?.currencyCode ?? null,
      isManager: m?.isManager ?? false,
      managerCustomerId: m?.managerCustomerId ?? null,
      status: m?.status ?? null,
    };
  });

  if (rows.length) {
    await prisma.googleAdsAccessibleCustomer.createMany({ data: rows });
  }

  if (isDevLog) {
    console.info(
      `[Google Ads] syncAccessible org=${organizationId} integration=${integrationId} google=${parsed.google_user_email ?? "?"} customers=${rows.length} ids=${ids.join(",")}`
    );
  }

  return { ok: true, count: rows.length };
}

export async function syncGoogleAdsAccessibleForOrganization(
  organizationId: string
): Promise<{ ok: true; count: number } | { ok: false; message: string }> {
  const integration = await prisma.integration.findUnique({
    where: { organizationId_slug: { organizationId, slug: GOOGLE_ADS_SLUG } },
  });
  if (!integration || integration.status !== "connected") {
    return { ok: false, message: "Google Ads não conectado para esta organização." };
  }
  return syncAccessibleGoogleAdsCustomers(integration.id, organizationId);
}

export async function resolveGoogleAdsOperationalContext(
  organizationId: string,
  options?: { clientAccountId?: string | null }
): Promise<GoogleAdsOperationalContext> {
  const integration = await prisma.integration.findUnique({
    where: { organizationId_slug: { organizationId, slug: GOOGLE_ADS_SLUG } },
  });
  if (!integration?.config || integration.status !== "connected") {
    return {
      ok: false,
      code: "NOT_CONNECTED",
      message: "Google Ads não conectado para esta organização.",
    };
  }

  const effectiveClientAccountId =
    options?.clientAccountId !== undefined ? options.clientAccountId : integration.clientAccountId;
  if (isGoogleAdsUxPending()) {
    return { ok: false, code: "api_not_ready", message: "Google Ads em preparação neste ambiente." };
  }
  if (!isGoogleAdsDeveloperTokenConfigured()) {
    return {
      ok: false,
      code: "pending_configuration",
      message: "Developer token não configurado no servidor.",
    };
  }

  const parsed = parseGoogleAdsConfig(integration.config);
  if (!parsed) {
    return { ok: false, code: "NOT_CONNECTED", message: "Config da integração inválida." };
  }

  let accessToken: string;
  try {
    accessToken = await ensureGoogleAdsAccessToken(organizationId, parsed);
  } catch (e) {
    return {
      ok: false,
      code: "TOKEN_REFRESH_FAILED",
      message: e instanceof Error ? e.message : String(e),
    };
  }

  let chosenCustomerId: string | null = null;
  let loginCustomerId: string | null = null;

  if (effectiveClientAccountId) {
    const asn = await prisma.googleAdsCustomerAssignment.findUnique({
      where: {
        integrationId_clientAccountId: {
          integrationId: integration.id,
          clientAccountId: effectiveClientAccountId,
        },
      },
    });
    if (asn) {
      chosenCustomerId = normCid(asn.googleCustomerId);
      loginCustomerId = asn.loginCustomerId ? normCid(asn.loginCustomerId) : null;
    }
  }

  if (!chosenCustomerId && parsed.default_google_customer_id) {
    const cid = normCid(parsed.default_google_customer_id);
    const exists = await prisma.googleAdsAccessibleCustomer.findUnique({
      where: {
        integrationId_customerId: { integrationId: integration.id, customerId: cid },
      },
    });
    if (exists) {
      chosenCustomerId = cid;
      loginCustomerId = parsed.default_login_customer_id
        ? normCid(parsed.default_login_customer_id)
        : exists.managerCustomerId
          ? normCid(exists.managerCustomerId)
          : null;
    }
  }

  if (!chosenCustomerId) {
    return {
      ok: false,
      code: "SELECT_GOOGLE_ADS_CUSTOMER",
      message:
        "Nenhuma conta Google Ads selecionada. Abra Integrações → Google Ads → Ver contas e escolha a conta padrão (e vínculos por cliente, se aplicável).",
    };
  }

  if (isDevLog) {
    console.info(
      `[Google Ads] resolveOperational org=${organizationId} clientAccount=${effectiveClientAccountId ?? "—"} customer=${chosenCustomerId} loginCustomer=${loginCustomerId ?? "—"} integration=${integration.id} google=${parsed.google_user_email ?? "?"}`
    );
  }

  return {
    ok: true,
    accessToken,
    customerId: chosenCustomerId,
    loginCustomerId,
    integrationId: integration.id,
  };
}

async function readConfigForIntegration(
  integrationId: string,
  organizationId: string
): Promise<{ integration: { id: string; config: string }; parsed: ParsedGoogleAdsIntegrationConfig } | null> {
  const integration = await prisma.integration.findFirst({
    where: { id: integrationId, organizationId, slug: GOOGLE_ADS_SLUG, status: "connected" },
  });
  if (!integration?.config) return null;
  const parsed = parseGoogleAdsConfig(integration.config);
  if (!parsed) return null;
  return { integration: { id: integration.id, config: integration.config }, parsed };
}

export async function setDefaultGoogleAdsCustomer(
  integrationId: string,
  organizationId: string,
  customerId: string | null
): Promise<{ ok: true } | { ok: false; message: string }> {
  const row = await readConfigForIntegration(integrationId, organizationId);
  if (!row) return { ok: false, message: "Integração não encontrada." };

  if (customerId) {
    const cid = normCid(customerId);
    const acc = await prisma.googleAdsAccessibleCustomer.findUnique({
      where: { integrationId_customerId: { integrationId, customerId: cid } },
    });
    if (!acc) {
      return { ok: false, message: "Esta conta não está na lista de contas acessíveis desta conexão." };
    }
    const next: ParsedGoogleAdsIntegrationConfig = {
      ...row.parsed,
      default_google_customer_id: cid,
      default_login_customer_id: acc.managerCustomerId ? normCid(acc.managerCustomerId) : null,
    };
    await prisma.integration.update({
      where: { id: integrationId },
      data: { config: JSON.stringify(next), lastSyncAt: new Date() },
    });
  } else {
    const next: ParsedGoogleAdsIntegrationConfig = {
      ...row.parsed,
      default_google_customer_id: null,
      default_login_customer_id: null,
    };
    await prisma.integration.update({
      where: { id: integrationId },
      data: { config: JSON.stringify(next), lastSyncAt: new Date() },
    });
  }

  if (isDevLog) {
    console.info(
      `[Google Ads] setDefault integration=${integrationId} org=${organizationId} customer=${customerId ?? "cleared"}`
    );
  }

  return { ok: true };
}

export async function upsertGoogleAdsClientAssignment(
  integrationId: string,
  organizationId: string,
  clientAccountId: string,
  googleCustomerId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const client = await prisma.clientAccount.findFirst({
    where: { id: clientAccountId, organizationId, deletedAt: null },
  });
  if (!client) {
    return { ok: false, message: "Cliente comercial não encontrado nesta organização." };
  }
  const integ = await prisma.integration.findFirst({
    where: { id: integrationId, organizationId, slug: GOOGLE_ADS_SLUG },
  });
  if (!integ) return { ok: false, message: "Integração Google Ads não encontrada." };

  const cid = normCid(googleCustomerId);
  const acc = await prisma.googleAdsAccessibleCustomer.findUnique({
    where: { integrationId_customerId: { integrationId, customerId: cid } },
  });
  if (!acc) {
    return { ok: false, message: "Conta Google Ads não está acessível por esta conexão." };
  }

  const loginCustomerId = acc.managerCustomerId ? normCid(acc.managerCustomerId) : null;

  await prisma.googleAdsCustomerAssignment.upsert({
    where: {
      integrationId_clientAccountId: { integrationId, clientAccountId },
    },
    create: {
      integrationId,
      organizationId,
      clientAccountId,
      googleCustomerId: cid,
      loginCustomerId,
    },
    update: {
      googleCustomerId: cid,
      loginCustomerId,
    },
  });

  if (isDevLog) {
    console.info(
      `[Google Ads] assignment org=${organizationId} client=${clientAccountId} → customer=${cid} login=${loginCustomerId ?? "—"}`
    );
  }

  return { ok: true };
}

export async function deleteGoogleAdsClientAssignment(
  integrationId: string,
  organizationId: string,
  clientAccountId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const integ = await prisma.integration.findFirst({
    where: { id: integrationId, organizationId, slug: GOOGLE_ADS_SLUG },
  });
  if (!integ) return { ok: false, message: "Integração não encontrada." };
  await prisma.googleAdsCustomerAssignment.deleteMany({
    where: { integrationId, clientAccountId },
  });
  return { ok: true };
}

export type GoogleAdsSetupDto = {
  integrationId: string;
  googleUserEmail: string | null;
  googleUserSub: string | null;
  defaultCustomerId: string | null;
  defaultLoginCustomerId: string | null;
  accessibleCount: number;
  assignmentCount: number;
  customers: Array<{
    customerId: string;
    descriptiveName: string | null;
    currencyCode: string | null;
    isManager: boolean;
    managerCustomerId: string | null;
    status: string | null;
  }>;
  assignments: Array<{
    clientAccountId: string;
    clientName: string;
    googleCustomerId: string;
    loginCustomerId: string | null;
  }>;
};

export async function getGoogleAdsSetup(organizationId: string): Promise<GoogleAdsSetupDto | null> {
  const integration = await prisma.integration.findUnique({
    where: { organizationId_slug: { organizationId, slug: GOOGLE_ADS_SLUG } },
  });
  if (!integration || integration.status !== "connected" || !integration.config) {
    return null;
  }
  const parsed = parseGoogleAdsConfig(integration.config);
  if (!parsed) return null;

  const [customers, assignments, clients] = await Promise.all([
    prisma.googleAdsAccessibleCustomer.findMany({
      where: { integrationId: integration.id },
      orderBy: [{ isManager: "desc" }, { descriptiveName: "asc" }],
    }),
    prisma.googleAdsCustomerAssignment.findMany({
      where: { integrationId: integration.id },
      include: { clientAccount: { select: { name: true } } },
    }),
    prisma.clientAccount.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true, name: true },
    }),
  ]);

  const clientName = new Map(clients.map((c) => [c.id, c.name]));

  return {
    integrationId: integration.id,
    googleUserEmail: parsed.google_user_email ?? null,
    googleUserSub: parsed.google_user_sub ?? null,
    defaultCustomerId: parsed.default_google_customer_id
      ? normCid(parsed.default_google_customer_id)
      : null,
    defaultLoginCustomerId: parsed.default_login_customer_id
      ? normCid(parsed.default_login_customer_id)
      : null,
    accessibleCount: customers.length,
    assignmentCount: assignments.length,
    customers: customers.map((c) => ({
      customerId: c.customerId,
      descriptiveName: c.descriptiveName,
      currencyCode: c.currencyCode,
      isManager: c.isManager,
      managerCustomerId: c.managerCustomerId,
      status: c.status,
    })),
    assignments: assignments.map((a) => ({
      clientAccountId: a.clientAccountId,
      clientName: clientName.get(a.clientAccountId) ?? a.clientAccount.name,
      googleCustomerId: a.googleCustomerId,
      loginCustomerId: a.loginCustomerId,
    })),
  };
}
