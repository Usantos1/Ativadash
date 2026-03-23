-- CreateEnum
CREATE TYPE "ResellerOrgKind" AS ENUM ('AGENCY', 'CLIENT');

-- AlterTable User
ALTER TABLE "User" ADD COLUMN "suspendedAt" TIMESTAMP(3);

-- AlterTable Organization
ALTER TABLE "Organization" ADD COLUMN "resellerOrgKind" "ResellerOrgKind";
ALTER TABLE "Organization" ADD COLUMN "featureOverrides" JSONB;

-- Filhos existentes: tratar como empresa final
UPDATE "Organization" SET "resellerOrgKind" = 'CLIENT' WHERE "parentOrganizationId" IS NOT NULL;

-- CreateTable
CREATE TABLE "ResellerAuditLog" (
    "id" TEXT NOT NULL,
    "matrixOrgId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResellerAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ResellerAuditLog_matrixOrgId_createdAt_idx" ON "ResellerAuditLog"("matrixOrgId", "createdAt");
