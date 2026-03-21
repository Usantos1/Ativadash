import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const starter = await prisma.plan.upsert({
    where: { slug: "starter" },
    create: {
      name: "Essencial",
      slug: "starter",
      maxIntegrations: 3,
      maxDashboards: 10,
      maxUsers: 3,
      maxClientAccounts: 15,
      maxChildOrganizations: 0,
    },
    update: {
      name: "Essencial",
      maxIntegrations: 3,
      maxDashboards: 10,
      maxUsers: 3,
      maxClientAccounts: 15,
      maxChildOrganizations: 0,
    },
  });

  const professional = await prisma.plan.upsert({
    where: { slug: "professional" },
    create: {
      name: "Profissional",
      slug: "professional",
      maxIntegrations: 10,
      maxDashboards: 40,
      maxUsers: 10,
      maxClientAccounts: 60,
      maxChildOrganizations: 15,
    },
    update: {
      name: "Profissional",
      maxIntegrations: 10,
      maxDashboards: 40,
      maxUsers: 10,
      maxClientAccounts: 60,
      maxChildOrganizations: 15,
    },
  });

  await prisma.plan.upsert({
    where: { slug: "agency" },
    create: {
      name: "Agência Plus",
      slug: "agency",
      maxIntegrations: 20,
      maxDashboards: 100,
      maxUsers: 30,
      maxClientAccounts: null,
      maxChildOrganizations: null,
    },
    update: {
      name: "Agência Plus",
      maxIntegrations: 20,
      maxDashboards: 100,
      maxUsers: 30,
      maxClientAccounts: null,
      maxChildOrganizations: null,
    },
  });

  await prisma.organization.updateMany({
    where: { planId: null },
    data: { planId: starter.id },
  });

  const demoOrg = await prisma.organization.upsert({
    where: { slug: "demo-org" },
    create: {
      name: "Organização Demo",
      slug: "demo-org",
      planId: professional.id,
    },
    update: {
      planId: professional.id,
    },
  });

  const hashedPassword = await bcrypt.hash("demo123", 10);
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@ativadash.com" },
    create: {
      email: "demo@ativadash.com",
      password: hashedPassword,
      name: "Usuário Demo",
    },
    update: {},
  });

  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: demoUser.id,
        organizationId: demoOrg.id,
      },
    },
    create: {
      userId: demoUser.id,
      organizationId: demoOrg.id,
      role: "owner",
    },
    update: {},
  });

  console.log("Seed concluído. Planos: starter, professional, agency. Demo: demo@ativadash.com / demo123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
