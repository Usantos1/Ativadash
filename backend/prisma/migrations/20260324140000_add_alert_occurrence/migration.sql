-- CreateTable
CREATE TABLE "AlertOccurrence" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "alertRuleId" TEXT NOT NULL,
    "severity" VARCHAR(16) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "metricValue" DECIMAL(14,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlertOccurrence_organizationId_createdAt_idx" ON "AlertOccurrence"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "AlertOccurrence" ADD CONSTRAINT "AlertOccurrence_alertRuleId_fkey" FOREIGN KEY ("alertRuleId") REFERENCES "AlertRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
