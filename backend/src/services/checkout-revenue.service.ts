import { prisma } from "../utils/prisma.js";

export type CheckoutCampaignRevenue = {
  campaignId: string;
  channel: string | null;
  revenue: number;
  refunds: number;
  net: number;
  count: number;
};

export type CheckoutRevenueSummary = {
  totalSales: number;
  totalRefunds: number;
  totalNet: number;
  countApproved: number;
  countRefunded: number;
  countTotal: number;
  bySource: Record<string, { sales: number; refunds: number; net: number; count: number }>;
};

export async function getCheckoutRevenueByCampaign(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<CheckoutCampaignRevenue[]> {
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const events = await prisma.checkoutEvent.findMany({
    where: {
      organizationId,
      occurredAt: { gte: start, lte: end },
      mappedCampaignId: { not: null },
    },
    select: {
      mappedCampaignId: true,
      mappedChannel: true,
      amountBrl: true,
      status: true,
    },
  });

  const map = new Map<string, CheckoutCampaignRevenue>();
  for (const ev of events) {
    const key = ev.mappedCampaignId!;
    let entry = map.get(key);
    if (!entry) {
      entry = { campaignId: key, channel: ev.mappedChannel, revenue: 0, refunds: 0, net: 0, count: 0 };
      map.set(key, entry);
    }
    entry.count++;
    if (ev.amountBrl < 0) {
      entry.refunds += Math.abs(ev.amountBrl);
    } else {
      entry.revenue += ev.amountBrl;
    }
    entry.net = entry.revenue - entry.refunds;
  }

  return Array.from(map.values());
}

export async function getCheckoutRevenueSummary(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<CheckoutRevenueSummary> {
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const events = await prisma.checkoutEvent.findMany({
    where: {
      organizationId,
      occurredAt: { gte: start, lte: end },
    },
    select: {
      source: true,
      amountBrl: true,
      status: true,
    },
  });

  const summary: CheckoutRevenueSummary = {
    totalSales: 0,
    totalRefunds: 0,
    totalNet: 0,
    countApproved: 0,
    countRefunded: 0,
    countTotal: events.length,
    bySource: {},
  };

  for (const ev of events) {
    if (!summary.bySource[ev.source]) {
      summary.bySource[ev.source] = { sales: 0, refunds: 0, net: 0, count: 0 };
    }
    const src = summary.bySource[ev.source];
    src.count++;

    if (ev.amountBrl < 0) {
      const abs = Math.abs(ev.amountBrl);
      summary.totalRefunds += abs;
      src.refunds += abs;
      summary.countRefunded++;
    } else {
      summary.totalSales += ev.amountBrl;
      src.sales += ev.amountBrl;
      summary.countApproved++;
    }
  }

  summary.totalNet = summary.totalSales - summary.totalRefunds;
  for (const s of Object.values(summary.bySource)) {
    s.net = s.sales - s.refunds;
  }

  return summary;
}

export async function listCheckoutEvents(
  organizationId: string,
  query: {
    limit?: number;
    offset?: number;
    source?: string;
    eventType?: string;
    startDate?: string;
    endDate?: string;
  }
) {
  const limit = Math.min(Math.max(query.limit ?? 30, 1), 100);
  const offset = Math.max(query.offset ?? 0, 0);

  const where: Record<string, unknown> = { organizationId };
  if (query.source) where.source = query.source;
  if (query.eventType) where.eventType = query.eventType;
  if (query.startDate || query.endDate) {
    const occ: Record<string, Date> = {};
    if (query.startDate) occ.gte = new Date(query.startDate);
    if (query.endDate) {
      const ed = new Date(query.endDate);
      ed.setHours(23, 59, 59, 999);
      occ.lte = ed;
    }
    where.occurredAt = occ;
  }

  const [items, total] = await Promise.all([
    prisma.checkoutEvent.findMany({
      where: where as any,
      orderBy: { occurredAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        source: true,
        externalEventId: true,
        eventType: true,
        status: true,
        transactionId: true,
        productId: true,
        productName: true,
        buyerEmail: true,
        buyerName: true,
        amountBrl: true,
        currency: true,
        utmSource: true,
        utmCampaign: true,
        mappedCampaignId: true,
        mappedChannel: true,
        occurredAt: true,
        createdAt: true,
      },
    }),
    prisma.checkoutEvent.count({ where: where as any }),
  ]);

  return { items, total, limit, offset };
}

export async function listCheckoutProductMappings(organizationId: string) {
  return prisma.checkoutProductMapping.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
}

export async function upsertCheckoutProductMapping(
  organizationId: string,
  data: { source: string; productId: string; productName?: string; campaignId: string; channel: string }
) {
  return prisma.checkoutProductMapping.upsert({
    where: {
      organizationId_source_productId: {
        organizationId,
        source: data.source,
        productId: data.productId,
      },
    },
    update: {
      productName: data.productName ?? undefined,
      campaignId: data.campaignId,
      channel: data.channel,
    },
    create: {
      organizationId,
      source: data.source,
      productId: data.productId,
      productName: data.productName,
      campaignId: data.campaignId,
      channel: data.channel,
    },
  });
}

export async function deleteCheckoutProductMapping(organizationId: string, id: string) {
  const row = await prisma.checkoutProductMapping.findFirst({
    where: { id, organizationId },
  });
  if (!row) throw new Error("Mapeamento não encontrado");
  await prisma.checkoutProductMapping.delete({ where: { id } });
}
