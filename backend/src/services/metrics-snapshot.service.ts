import { prisma } from "../utils/prisma.js";

export async function upsertMetricsSnapshot(
  organizationId: string,
  source: string,
  rangeKey: string,
  payload: unknown
) {
  const json = JSON.stringify(payload);
  return prisma.metricsSnapshot.upsert({
    where: {
      organizationId_source_rangeKey: {
        organizationId,
        source,
        rangeKey,
      },
    },
    create: { organizationId, source, rangeKey, payload: json },
    update: { payload: json },
  });
}

export async function getLatestMetricsSnapshot(organizationId: string, source: string) {
  return prisma.metricsSnapshot.findFirst({
    where: { organizationId, source },
    orderBy: { updatedAt: "desc" },
  });
}
