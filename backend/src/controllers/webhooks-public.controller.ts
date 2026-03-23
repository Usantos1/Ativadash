import type { Request, Response } from "express";
import { ingestWebhookPublic } from "../services/webhooks.service.js";

/**
 * Corpo bruto (Buffer) — rota montada com express.raw().
 * Assinatura: header `X-Ativadash-Signature: sha256=<hex>` = HMAC-SHA256(segredo, corpo bruto).
 * Idempotência opcional: `X-Event-Id` ou `X-Idempotency-Key`.
 */
export async function postPublicWebhook(req: Request, res: Response) {
  try {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body ?? ""), "utf8");
    const sig =
      (req.headers["x-ativadash-signature"] as string | undefined) ||
      (req.headers["x-webhook-signature"] as string | undefined);
    const idem =
      (req.headers["x-event-id"] as string | undefined) ||
      (req.headers["x-idempotency-key"] as string | undefined);
    const { publicSlug } = req.params;
    if (!publicSlug) {
      return res.status(400).json({ message: "Slug ausente" });
    }
    const result = await ingestWebhookPublic(publicSlug, raw, sig, idem);
    if (result.ok) {
      return res.status(202).json({ eventId: result.eventId, duplicate: result.duplicate });
    }
    if (result.code === "NOT_FOUND") {
      return res.status(404).json({ message: "Endpoint não encontrado" });
    }
    if (result.code === "INVALID_SIGNATURE") {
      return res.status(401).json({ message: "Assinatura inválida" });
    }
    if (result.code === "FORBIDDEN") {
      return res.status(403).json({ message: "Webhooks não disponíveis para esta empresa" });
    }
    return res.status(400).json({ message: "Requisição inválida" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao processar webhook" });
  }
}
