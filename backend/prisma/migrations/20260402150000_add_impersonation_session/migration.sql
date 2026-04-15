-- CreateTable
CREATE TABLE "ImpersonationSession" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "sourceOrganizationId" TEXT NOT NULL,
    "targetOrganizationId" TEXT NOT NULL,
    "assumedRole" TEXT NOT NULL DEFAULT 'admin',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "reason" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImpersonationSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImpersonationSession_actorUserId_isActive_idx" ON "ImpersonationSession"("actorUserId", "isActive");

-- CreateIndex
CREATE INDEX "ImpersonationSession_targetOrganizationId_idx" ON "ImpersonationSession"("targetOrganizationId");

-- CreateIndex
CREATE INDEX "ImpersonationSession_sourceOrganizationId_idx" ON "ImpersonationSession"("sourceOrganizationId");

-- CreateIndex
CREATE INDEX "ImpersonationSession_isActive_startedAt_idx" ON "ImpersonationSession"("isActive", "startedAt");

-- AddForeignKey
ALTER TABLE "ImpersonationSession" ADD CONSTRAINT "ImpersonationSession_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpersonationSession" ADD CONSTRAINT "ImpersonationSession_sourceOrganizationId_fkey" FOREIGN KEY ("sourceOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpersonationSession" ADD CONSTRAINT "ImpersonationSession_targetOrganizationId_fkey" FOREIGN KEY ("targetOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
