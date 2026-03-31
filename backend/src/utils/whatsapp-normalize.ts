/** Mantém só dígitos; vazio → null */
export function normalizeWhatsappDigits(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const d = raw.replace(/\D/g, "");
  return d.length > 0 ? d : null;
}
