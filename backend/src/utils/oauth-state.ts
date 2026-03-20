import crypto from "node:crypto";

const stateStore = new Map<string, string>();
const STATE_TTL_MS = 10 * 60 * 1000; // 10 min
const stateExpiry = new Map<string, number>();

export function createState(organizationId: string): string {
  const state = crypto.randomBytes(24).toString("base64url");
  stateStore.set(state, organizationId);
  stateExpiry.set(state, Date.now() + STATE_TTL_MS);
  return state;
}

export function consumeState(state: string): string | null {
  const orgId = stateStore.get(state);
  if (!orgId) return null;
  const expiry = stateExpiry.get(state);
  if (expiry && Date.now() > expiry) {
    stateStore.delete(state);
    stateExpiry.delete(state);
    return null;
  }
  stateStore.delete(state);
  stateExpiry.delete(state);
  return orgId;
}
