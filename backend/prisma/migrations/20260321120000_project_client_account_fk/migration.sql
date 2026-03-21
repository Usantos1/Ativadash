-- Add FK Project.clientAccountId -> ClientAccount (Prisma relation)
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "ClientAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
