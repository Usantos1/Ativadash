const ATIVA_CRM_SEND_URL = "https://api.ativacrm.com/api/messages/send";

export function normalizeAtivaCrmPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  if (d.length < 10) return null;
  if (d.startsWith("55")) return d;
  if (d.length === 11 || d.length === 10) return `55${d}`;
  return d;
}

export async function sendAtivaCrmTextMessage(
  token: string,
  number: string,
  body: string
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  const trimmed = token.trim();
  if (!trimmed) return { ok: false, error: "Token ausente" };

  try {
    const res = await fetch(ATIVA_CRM_SEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${trimmed}`,
      },
      body: JSON.stringify({ number, body }),
    });

    const text = await res.text();
    if (res.ok) {
      return { ok: true };
    }
    let msg = text || res.statusText;
    try {
      const j = JSON.parse(text) as { message?: string; error?: string };
      msg = j.message ?? j.error ?? msg;
    } catch {
      /* ignore */
    }
    return { ok: false, error: msg || "Falha ao enviar", status: res.status };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erro de rede ao contatar Ativa CRM",
    };
  }
}
