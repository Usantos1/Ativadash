/**
 * Converte horário civil (parede) num fuso IANA para HH:mm em UTC no mesmo dia civil de referência.
 * Usa busca linear nos minutos do dia (suficiente para agendamentos).
 */
export function wallLocalToUtc(
  hourLocal: number,
  minuteLocal: number,
  timeZone: string,
  refUtc = new Date()
): { hourUtc: number; minuteUtc: number } {
  const y = refUtc.getUTCFullYear();
  const mo = refUtc.getUTCMonth();
  const d = refUtc.getUTCDate();
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  for (let u = 0; u < 24 * 60; u++) {
    const dt = new Date(Date.UTC(y, mo, d, Math.floor(u / 60), u % 60, 0));
    const parts = fmt.formatToParts(dt);
    const h = Number(parts.find((p) => p.type === "hour")?.value);
    const m = Number(parts.find((p) => p.type === "minute")?.value);
    if (h === hourLocal && m === minuteLocal) {
      return { hourUtc: dt.getUTCHours(), minuteUtc: dt.getUTCMinutes() };
    }
  }
  return { hourUtc: hourLocal, minuteUtc: minuteLocal };
}

export function utcToWallLocal(
  hourUtc: number,
  minuteUtc: number,
  timeZone: string,
  refUtc = new Date()
): { hourLocal: number; minuteLocal: number } {
  const y = refUtc.getUTCFullYear();
  const mo = refUtc.getUTCMonth();
  const d = refUtc.getUTCDate();
  const dt = new Date(Date.UTC(y, mo, d, hourUtc, minuteUtc, 0));
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(dt);
  return {
    hourLocal: Number(parts.find((p) => p.type === "hour")?.value),
    minuteLocal: Number(parts.find((p) => p.type === "minute")?.value),
  };
}
