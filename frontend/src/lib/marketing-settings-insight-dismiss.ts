const STORAGE_KEY = "ativadash:marketing-settings-insight-dismiss:v1";
/** Tempo que a recomendação fica oculta após "Ocultar" */
export const INSIGHT_DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** "Resolvido" some da lista por mais tempo (gestor tratou no painel) */
export const INSIGHT_RESOLVED_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type Stored = {
  orgId: string;
  dismissedAt: Record<string, number>;
  resolvedAt: Record<string, number>;
};

function normalizeRead(raw: string | null): Stored | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<Stored> & { orgId?: string; dismissedAt?: Record<string, number> };
    if (!p || typeof p.orgId !== "string") return null;
    const dismissedAt =
      typeof p.dismissedAt === "object" && p.dismissedAt !== null ? { ...p.dismissedAt } : {};
    const resolvedAt =
      typeof p.resolvedAt === "object" && p.resolvedAt !== null ? { ...p.resolvedAt } : {};
    return { orgId: p.orgId, dismissedAt, resolvedAt };
  } catch {
    return null;
  }
}

function readRaw(): Stored | null {
  try {
    return normalizeRead(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function write(data: Stored) {
  try {
    const now = Date.now();
    const dismissedAt = { ...data.dismissedAt };
    const resolvedAt = { ...data.resolvedAt };
    for (const [k, ts] of Object.entries(dismissedAt)) {
      if (now - ts >= INSIGHT_DISMISS_TTL_MS) delete dismissedAt[k];
    }
    for (const [k, ts] of Object.entries(resolvedAt)) {
      if (now - ts >= INSIGHT_RESOLVED_TTL_MS) delete resolvedAt[k];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, dismissedAt, resolvedAt }));
  } catch {
    /* quota / private mode */
  }
}

/** IDs ainda dentro do TTL para esta organização */
export function getActiveDismissedInsightIds(orgId: string | null | undefined): Set<string> {
  if (!orgId) return new Set();
  const raw = readRaw();
  if (!raw || raw.orgId !== orgId) return new Set();
  const now = Date.now();
  const active = new Set<string>();
  for (const [id, ts] of Object.entries(raw.dismissedAt)) {
    if (typeof ts === "number" && now - ts < INSIGHT_DISMISS_TTL_MS) active.add(id);
  }
  return active;
}

export function getActiveResolvedInsightIds(orgId: string | null | undefined): Set<string> {
  if (!orgId) return new Set();
  const raw = readRaw();
  if (!raw || raw.orgId !== orgId) return new Set();
  const now = Date.now();
  const active = new Set<string>();
  for (const [id, ts] of Object.entries(raw.resolvedAt)) {
    if (typeof ts === "number" && now - ts < INSIGHT_RESOLVED_TTL_MS) active.add(id);
  }
  return active;
}

export function dismissInsightForOrg(orgId: string, insightId: string) {
  const raw = readRaw();
  const base: Stored =
    raw && raw.orgId === orgId
      ? { ...raw, dismissedAt: { ...raw.dismissedAt }, resolvedAt: { ...raw.resolvedAt } }
      : { orgId, dismissedAt: {}, resolvedAt: {} };
  base.dismissedAt[insightId] = Date.now();
  delete base.resolvedAt[insightId];
  write(base);
}

export function resolveInsightForOrg(orgId: string, insightId: string) {
  const raw = readRaw();
  const base: Stored =
    raw && raw.orgId === orgId
      ? { ...raw, dismissedAt: { ...raw.dismissedAt }, resolvedAt: { ...raw.resolvedAt } }
      : { orgId, dismissedAt: {}, resolvedAt: {} };
  base.resolvedAt[insightId] = Date.now();
  delete base.dismissedAt[insightId];
  write(base);
}

export function clearDismissedInsightsForOrg(orgId: string) {
  const raw = readRaw();
  if (raw && raw.orgId === orgId) {
    write({ ...raw, dismissedAt: {} });
  } else {
    write({ orgId, dismissedAt: {}, resolvedAt: {} });
  }
}

export function clearResolvedInsightsForOrg(orgId: string) {
  const raw = readRaw();
  if (raw && raw.orgId === orgId) {
    write({ ...raw, resolvedAt: {} });
  }
}

/** Limpa ocultas e resolvidas (recomendações voltam todas) */
export function clearAllInsightUiStateForOrg(orgId: string) {
  write({ orgId, dismissedAt: {}, resolvedAt: {} });
}
