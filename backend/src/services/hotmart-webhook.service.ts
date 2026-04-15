import { prisma } from "../utils/prisma.js";

type HotmartParsed = {
  externalEventId: string;
  eventType: string;
  status: string;
  transactionId: string;
  productId: string | null;
  productName: string | null;
  offerId: string | null;
  buyerEmail: string | null;
  buyerName: string | null;
  amountBrl: number;
  currency: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  subscriptionId: string | null;
  recurrenceNumber: number | null;
  occurredAt: Date;
};

function str(v: unknown): string | null {
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  return null;
}

function num(v: unknown): number {
  if (typeof v === "number" && !isNaN(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    if (!isNaN(n)) return n;
  }
  return 0;
}

function dig(obj: unknown, ...path: string[]): unknown {
  let cur: unknown = obj;
  for (const p of path) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

const STATUS_MAP: Record<string, string> = {
  approved: "approved",
  complete: "approved",
  refunded: "refunded",
  cancelled: "canceled",
  expired: "expired",
  dispute: "chargedback",
  chargeback: "chargedback",
  blocked: "blocked",
  printed_billet: "pending",
  waiting_payment: "pending",
  overdue: "pending",
  delayed: "pending",
  started: "pending",
  no_funds: "canceled",
};

export function parseHotmartPayload(raw: unknown): HotmartParsed {
  const obj = raw as Record<string, unknown>;
  const event = str(obj.event) ?? "UNKNOWN";
  const data = (obj.data ?? {}) as Record<string, unknown>;
  const purchase = (data.purchase ?? {}) as Record<string, unknown>;
  const buyer = (data.buyer ?? {}) as Record<string, unknown>;
  const product = (data.product ?? {}) as Record<string, unknown>;
  const subscription = (data.subscription ?? {}) as Record<string, unknown>;
  const tracking = (purchase.tracking ?? {}) as Record<string, unknown>;

  const rawStatus = str(purchase.status) ?? str(obj.status) ?? "";
  const status = STATUS_MAP[rawStatus.toLowerCase()] ?? (rawStatus.toLowerCase() || "unknown");

  const amount =
    num(dig(purchase, "full_price", "value")) ||
    num(dig(purchase, "price", "value")) ||
    num(dig(purchase, "original_offer_price", "value")) ||
    0;

  const transactionStr =
    str(purchase.transaction) ??
    str((purchase.order_bump as Record<string, unknown>)?.transaction) ??
    str(data.transaction) ??
    `unknown-${Date.now()}`;

  const occurredAtRaw = str(purchase.order_date) ?? str(purchase.approved_date) ?? str(data.creation_date);
  const occurredAt = occurredAtRaw ? new Date(Number(occurredAtRaw) || occurredAtRaw) : new Date();
  if (isNaN(occurredAt.getTime())) occurredAt.setTime(Date.now());

  return {
    externalEventId: str(obj.id) ?? `${event}:${transactionStr}`,
    eventType: event,
    status,
    transactionId: transactionStr,
    productId: str(product.id?.toString()) ?? str(dig(product, "id") as string),
    productName: str(product.name as string),
    offerId: str(dig(purchase, "offer", "code") as string),
    buyerEmail: str(buyer.email as string),
    buyerName: str(buyer.name as string),
    amountBrl: amount,
    currency: str(dig(purchase, "full_price", "currency_value") as string) ?? "BRL",
    utmSource:
      str(tracking.source as string) ??
      str(tracking.src as string) ??
      str(tracking.utm_source as string),
    utmMedium: str(tracking.utm_medium as string),
    utmCampaign: str(tracking.utm_campaign as string),
    utmContent: str(tracking.utm_content as string),
    utmTerm: str(tracking.utm_term as string),
    subscriptionId: str(dig(subscription, "subscriber", "code") as string),
    recurrenceNumber:
      typeof purchase.recurrence_number === "number" ? purchase.recurrence_number : null,
    occurredAt,
  };
}

export async function processHotmartEvent(
  organizationId: string,
  parsed: HotmartParsed,
  rawPayload: unknown
): Promise<{ id: string; duplicate: boolean }> {
  let mappedCampaignId: string | null = null;
  let mappedChannel: string | null = null;

  if (parsed.utmCampaign) {
    mappedCampaignId = parsed.utmCampaign;
    if (parsed.utmSource) {
      const src = parsed.utmSource.toLowerCase();
      if (src.includes("facebook") || src.includes("fb") || src.includes("instagram") || src.includes("ig") || src.includes("meta")) {
        mappedChannel = "facebook";
      } else if (src.includes("google") || src.includes("gads") || src.includes("gclid")) {
        mappedChannel = "google";
      }
    }
  }

  if (!mappedCampaignId && parsed.productId) {
    const mapping = await prisma.checkoutProductMapping.findUnique({
      where: {
        organizationId_source_productId: {
          organizationId,
          source: "hotmart",
          productId: parsed.productId,
        },
      },
    });
    if (mapping) {
      mappedCampaignId = mapping.campaignId;
      mappedChannel = mapping.channel;
    }
  }

  const isRefund = parsed.eventType === "REFUND" || parsed.status === "refunded" || parsed.status === "chargedback";
  const effectiveAmount = isRefund ? -Math.abs(parsed.amountBrl) : parsed.amountBrl;

  try {
    const row = await prisma.checkoutEvent.upsert({
      where: {
        organizationId_source_externalEventId: {
          organizationId,
          source: "hotmart",
          externalEventId: parsed.externalEventId,
        },
      },
      update: {
        status: parsed.status,
        amountBrl: effectiveAmount,
        mappedCampaignId,
        mappedChannel,
        processedAt: new Date(),
      },
      create: {
        organizationId,
        source: "hotmart",
        externalEventId: parsed.externalEventId,
        eventType: parsed.eventType,
        status: parsed.status,
        transactionId: parsed.transactionId,
        productId: parsed.productId,
        productName: parsed.productName,
        offerId: parsed.offerId,
        buyerEmail: parsed.buyerEmail,
        buyerName: parsed.buyerName,
        amountBrl: effectiveAmount,
        currency: parsed.currency,
        utmSource: parsed.utmSource,
        utmMedium: parsed.utmMedium,
        utmCampaign: parsed.utmCampaign,
        utmContent: parsed.utmContent,
        utmTerm: parsed.utmTerm,
        mappedCampaignId,
        mappedChannel,
        subscriptionId: parsed.subscriptionId,
        recurrenceNumber: parsed.recurrenceNumber,
        rawPayload: rawPayload as any,
        occurredAt: parsed.occurredAt,
      },
    });
    return { id: row.id, duplicate: false };
  } catch (e) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002") {
      const existing = await prisma.checkoutEvent.findFirst({
        where: { organizationId, source: "hotmart", externalEventId: parsed.externalEventId },
        select: { id: true },
      });
      return { id: existing?.id ?? "", duplicate: true };
    }
    throw e;
  }
}
