/** Janela de expediente para alertas WhatsApp (HH:mm, relógio de parede no fuso informado). */

const HHMM = /^(\d{1,2}):(\d{2})$/;

export function parseWallMinutes(hhmm: string | null | undefined): number | null {
  if (!hhmm?.trim()) return null;
  const m = HHMM.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mi) || h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

/**
 * Se início ou fim ausente → 24/7.
 * Suporta janela que cruza meia-noite (ex.: 22:00–06:00).
 */
export function isWithinMembershipAlertWindow(
  start: string | null | undefined,
  end: string | null | undefined,
  timezone = "America/Sao_Paulo"
): boolean {
  const sm = parseWallMinutes(start);
  const em = parseWallMinutes(end);
  if (sm == null || em == null) return true;

  const now = new Date();
  let cur = 0;
  try {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(now);
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const mi = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    if (!Number.isFinite(h) || !Number.isFinite(mi)) return true;
    cur = h * 60 + mi;
  } catch {
    return true;
  }

  if (sm <= em) return cur >= sm && cur <= em;
  return cur >= sm || cur <= em;
}
