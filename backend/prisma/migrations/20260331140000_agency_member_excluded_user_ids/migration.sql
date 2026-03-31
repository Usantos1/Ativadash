-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "agencyMemberExcludedUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
