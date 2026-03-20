/**
 * Hash e verificação de senha com Web Crypto (PBKDF2) — compatível com Workers.
 */
const ALG = "PBKDF2";
const HASH = "SHA-256";
const ITERATIONS = 100000;
const SALT_LEN = 16;
const KEY_LEN = 32;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const key = await deriveKey(password, salt);
  const combined = new Uint8Array(salt.length + key.length);
  combined.set(salt, 0);
  combined.set(key, salt.length);
  return btoa(String.fromCharCode(...combined));
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const combined = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
    const salt = combined.slice(0, SALT_LEN);
    const keyStored = combined.slice(SALT_LEN, SALT_LEN + KEY_LEN);
    const key = await deriveKey(password, salt);
    if (key.length !== keyStored.length) return false;
    return crypto.subtle.timingSafeEqual(key, keyStored);
  } catch {
    return false;
  }
}

async function deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: ALG },
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: ALG,
      salt,
      iterations: ITERATIONS,
      hash: HASH,
    },
    keyMaterial,
    KEY_LEN * 8
  );
  return new Uint8Array(bits);
}
