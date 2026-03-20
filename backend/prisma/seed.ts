import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const plan = await prisma.plan.upsert({
    where: { slug: "starter" },
    create: {
      name: "Starter",
      slug: "starter",
      maxIntegrations: 3,
      maxDashboards: 5,
      maxUsers: 3,
    },
    update: {},
  });

  const demoOrg = await prisma.organization.upsert({
    where: { slug: "demo-org" },
    create: {
      name: "Organização Demo",
      slug: "demo-org",
      planId: plan.id,
    },
    update: {},
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

  console.log("Seed concluído. Demo: demo@ativadash.com / demo123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
