-- CreateEnum
CREATE TYPE "OrganizationKind" AS ENUM ('MATRIX', 'DIRECT', 'CLIENT_WORKSPACE');

-- CreateEnum
CREATE TYPE "GrantAssetType" AS ENUM (
  'META_AD_ACCOUNT',
  'META_BUSINESS',
  'GOOGLE_ADS_CUSTOMER',
  'GOOGLE_MCC',
  'WEBHOOK_ENDPOINT'
);

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "organizationKind" "OrganizationKind" NOT NULL DEFAULT 'DIRECT';

CREATE INDEX "Organization_organizationKind_idx" ON "Organization"("organizationKind");

-- Backfill organizationKind
UPDATE "Organization" AS o
SET "organizationKind" = 'MATRIX'
FROM (
  SELECT DISTINCT p.id
  FROM "Organization" p
  INNER JOIN "Organization" c ON c."parentOrganizationId" = p.id AND c."deletedAt" IS NULL
  WHERE p."deletedAt" IS NULL
) AS roots_with_children
WHERE o.id = roots_with_children.id;

-- Matriz ainda sem filhos: plano com capacidade de filhos (revenda / multiempresa)
UPDATE "Organization" o
SET "organizationKind" = 'MATRIX'
FROM "Plan" p
WHERE o."planId" = p.id
  AND o."parentOrganizationId" IS NULL
  AND o."deletedAt" IS NULL
  AND (p."maxChildOrganizations" IS NULL OR p."maxChildOrganizations" > 0);

UPDATE "Organization"
SET "organizationKind" = 'CLIENT_WORKSPACE'
WHERE "parentOrganizationId" IS NOT NULL;

-- Remove subscriptions from client workspaces (billing only on paying org)
DELETE FROM "Subscription" s
USING "Organization" o
WHERE s."organizationId" = o.id AND o."organizationKind" = 'CLIENT_WORKSPACE';

-- Migrate membership roles to canonical values
UPDATE "Membership" m
SET "role" = 'agency_owner'
FROM "Organization" o
WHERE m."organizationId" = o.id
  AND o."organizationKind" = 'MATRIX'
  AND m."role" = 'owner';

UPDATE "Membership" m
SET "role" = 'agency_admin'
FROM "Organization" o
WHERE m."organizationId" = o.id
  AND o."organizationKind" = 'MATRIX'
  AND m."role" = 'admin';

UPDATE "Membership" m
SET "role" = 'agency_ops'
FROM "Organization" o
WHERE m."organizationId" = o.id
  AND o."organizationKind" = 'MATRIX'
  AND m."role" = 'member';

UPDATE "Membership" m
SET "role" = 'media_meta_manager'
FROM "Organization" o
WHERE m."organizationId" = o.id
  AND o."organizationKind" = 'MATRIX'
  AND m."role" = 'media_manager';

UPDATE "Membership" m
SET "role" = 'agency_ops'
FROM "Organization" o
WHERE m."organizationId" = o.id
  AND o."organizationKind" = 'MATRIX'
  AND m."role" = 'analyst';

UPDATE "Membership" m
SET "role" = 'workspace_owner'
FROM "Organization" o
WHERE m."organizationId" = o.id
  AND o."organizationKind" IN ('DIRECT', 'CLIENT_WORKSPACE')
  AND m."role" = 'owner';

UPDATE "Membership" m
SET "role" = 'workspace_admin'
FROM "Organization" o
WHERE m."organizationId" = o.id
  AND o."organizationKind" IN ('DIRECT', 'CLIENT_WORKSPACE')
  AND m."role" = 'admin';

UPDATE "Membership" m
SET "role" = 'report_viewer'
FROM "Organization" o
WHERE m."organizationId" = o.id
  AND o."organizationKind" IN ('DIRECT', 'CLIENT_WORKSPACE')
  AND m."role" = 'member';

-- media_manager / analyst → papéis canônicos de workspace
UPDATE "Membership" m
SET "role" = 'media_meta_manager'
FROM "Organization" o
WHERE m."organizationId" = o.id
  AND o."organizationKind" IN ('DIRECT', 'CLIENT_WORKSPACE')
  AND m."role" = 'media_manager';

UPDATE "Membership" m
SET "role" = 'performance_analyst'
FROM "Organization" o
WHERE m."organizationId" = o.id
  AND o."organizationKind" IN ('DIRECT', 'CLIENT_WORKSPACE')
  AND m."role" = 'analyst';

-- CreateTable
CREATE TABLE "MatrixWorkspaceGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matrixOrganizationId" TEXT NOT NULL,
    "workspaceOrganizationId" TEXT NOT NULL,
    "allowedChannels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatrixWorkspaceGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MatrixWorkspaceGrant_userId_workspaceOrganizationId_key" ON "MatrixWorkspaceGrant"("userId", "workspaceOrganizationId");
CREATE INDEX "MatrixWorkspaceGrant_matrixOrganizationId_idx" ON "MatrixWorkspaceGrant"("matrixOrganizationId");
CREATE INDEX "MatrixWorkspaceGrant_workspaceOrganizationId_idx" ON "MatrixWorkspaceGrant"("workspaceOrganizationId");

CREATE TABLE "AssetAccessGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assetType" "GrantAssetType" NOT NULL,
    "externalId" TEXT NOT NULL,
    "label" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetAccessGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssetAccessGrant_userId_organizationId_assetType_externalId_key" ON "AssetAccessGrant"("userId", "organizationId", "assetType", "externalId");
CREATE INDEX "AssetAccessGrant_organizationId_assetType_idx" ON "AssetAccessGrant"("organizationId", "assetType");

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "organizationId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

ALTER TABLE "MatrixWorkspaceGrant" ADD CONSTRAINT "MatrixWorkspaceGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatrixWorkspaceGrant" ADD CONSTRAINT "MatrixWorkspaceGrant_matrixOrganizationId_fkey" FOREIGN KEY ("matrixOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatrixWorkspaceGrant" ADD CONSTRAINT "MatrixWorkspaceGrant_workspaceOrganizationId_fkey" FOREIGN KEY ("workspaceOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssetAccessGrant" ADD CONSTRAINT "AssetAccessGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetAccessGrant" ADD CONSTRAINT "AssetAccessGrant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
