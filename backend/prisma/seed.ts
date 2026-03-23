import { loadAtivadashEnv } from "../src/config/dotenv-load.js";
import { PrismaClient } from "@prisma/client";

loadAtivadashEnv();
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const starterFeatures = {
    marketingDashboard: true,
    performanceAlerts: true,
    multiUser: true,
    multiOrganization: false,
    integrations: true,
    webhooks: false,
  };

  const starter = await prisma.plan.upsert({
    where: { slug: "starter" },
    create: {
      name: "Essencial",
      slug: "starter",
      planType: "standard",
      descriptionInternal: "Entrada / freelancer",
      features: starterFeatures,
      maxIntegrations: 3,
      maxDashboards: 10,
      maxUsers: 3,
      maxClientAccounts: 15,
      maxChildOrganizations: 0,
    },
    update: {
      name: "Essencial",
      planType: "standard",
      descriptionInternal: "Entrada / freelancer",
      features: starterFeatures,
      maxIntegrations: 3,
      maxDashboards: 10,
      maxUsers: 3,
      maxClientAccounts: 15,
      maxChildOrganizations: 0,
    },
  });

  const proFeatures = {
    marketingDashboard: true,
    performanceAlerts: true,
    multiUser: true,
    multiOrganization: true,
    integrations: true,
    webhooks: true,
  };

  const professional = await prisma.plan.upsert({
    where: { slug: "professional" },
    create: {
      name: "Profissional",
      slug: "professional",
      planType: "standard",
      descriptionInternal: "Agências médias",
      features: proFeatures,
      maxIntegrations: 10,
      maxDashboards: 40,
      maxUsers: 10,
      maxClientAccounts: 60,
      maxChildOrganizations: 15,
    },
    update: {
      name: "Profissional",
      planType: "standard",
      descriptionInternal: "Agências médias",
      features: proFeatures,
      maxIntegrations: 10,
      maxDashboards: 40,
      maxUsers: 10,
      maxClientAccounts: 60,
      maxChildOrganizations: 15,
    },
  });

  const agencyFeatures = {
    marketingDashboard: true,
    performanceAlerts: true,
    multiUser: true,
    multiOrganization: true,
    integrations: true,
    webhooks: true,
  };

  await prisma.plan.upsert({
    where: { slug: "agency" },
    create: {
      name: "Agência Plus",
      slug: "agency",
      planType: "enterprise",
      descriptionInternal: "Alto volume / revenda",
      features: agencyFeatures,
      maxIntegrations: 20,
      maxDashboards: 100,
      maxUsers: 30,
      maxClientAccounts: null,
      maxChildOrganizations: null,
    },
    update: {
      name: "Agência Plus",
      planType: "enterprise",
      descriptionInternal: "Alto volume / revenda",
      features: agencyFeatures,
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
      planId: starter.id,
      organizationKind: "DIRECT",
    },
    update: {
      planId: starter.id,
      organizationKind: "DIRECT",
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
    update: {
      password: hashedPassword,
      name: "Usuário Demo",
    },
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
      role: "workspace_owner",
    },
    update: {},
  });

  for (const o of await prisma.organization.findMany({
    where: { deletedAt: null, planId: { not: null }, organizationKind: { not: "CLIENT_WORKSPACE" } },
  })) {
    await prisma.subscription.upsert({
      where: { organizationId: o.id },
      create: {
        organizationId: o.id,
        planId: o.planId!,
        billingMode: "custom",
        status: "active",
      },
      update: { planId: o.planId! },
    });
  }

  console.log("Seed concluído. Planos: starter, professional, agency. Demo: demo@ativadash.com / demo123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
