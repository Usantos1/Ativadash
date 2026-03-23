-- AlterTable
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ResellerAuditLog_matrixOrgId_action_createdAt_idx" ON "ResellerAuditLog"("matrixOrgId", "action", "createdAt");
