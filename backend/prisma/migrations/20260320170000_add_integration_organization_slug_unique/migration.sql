-- DropIndex: remove non-unique index so we can add a unique constraint (required for upsert)
DROP INDEX IF EXISTS "Integration_organizationId_slug_idx";

-- CreateIndex: compound unique for (organizationId, slug) so Prisma upsert ON CONFLICT works
CREATE UNIQUE INDEX "Integration_organizationId_slug_key" ON "Integration"("organizationId", "slug");
