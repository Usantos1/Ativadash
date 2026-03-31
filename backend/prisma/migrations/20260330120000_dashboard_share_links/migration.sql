-- Links públicos somente leitura para compartilhar visão do dashboard ADS
CREATE TABLE "DashboardShareLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "page" VARCHAR(24) NOT NULL,
    "sectionsJson" JSONB NOT NULL,
    "startDate" VARCHAR(10) NOT NULL,
    "endDate" VARCHAR(10) NOT NULL,
    "periodLabel" VARCHAR(120) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DashboardShareLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DashboardShareLink_token_key" ON "DashboardShareLink"("token");
CREATE INDEX "DashboardShareLink_organizationId_createdAt_idx" ON "DashboardShareLink"("organizationId", "createdAt");

ALTER TABLE "DashboardShareLink" ADD CONSTRAINT "DashboardShareLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
