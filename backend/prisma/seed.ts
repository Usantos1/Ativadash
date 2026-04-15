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
    campaignWrite: true,
  };

  const starter = await prisma.plan.upsert({
    where: { slug: "starter" },
    create: {
      name: "Essencial",
      slug: "starter",
      planType: "template",
      descriptionInternal: "[Template interno] Base para empresas diretas / freelancers",
      features: starterFeatures,
      maxIntegrations: 3,
      maxDashboards: 10,
      maxUsers: 3,
      maxClientAccounts: 15,
      maxChildOrganizations: 0,
    },
    update: {
      name: "Essencial",
      planType: "template",
      descriptionInternal: "[Template interno] Base para empresas diretas / freelancers",
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
    campaignWrite: true,
  };

  const professional = await prisma.plan.upsert({
    where: { slug: "professional" },
    create: {
      name: "Profissional",
      slug: "professional",
      planType: "template",
      descriptionInternal: "[Template interno] Base para agências médias",
      features: proFeatures,
      maxIntegrations: 10,
      maxDashboards: 40,
      maxUsers: 10,
      maxClientAccounts: 60,
      maxChildOrganizations: 15,
    },
    update: {
      name: "Profissional",
      planType: "template",
      descriptionInternal: "[Template interno] Base para agências médias",
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
    campaignWrite: true,
  };

  await prisma.plan.upsert({
    where: { slug: "agency" },
    create: {
      name: "Agência Plus",
      slug: "agency",
      planType: "template",
      descriptionInternal: "[Template interno] Base para agências de alto volume",
      features: agencyFeatures,
      maxIntegrations: 20,
      maxDashboards: 100,
      maxUsers: 30,
      maxClientAccounts: null,
      maxChildOrganizations: null,
    },
    update: {
      name: "Agência Plus",
      planType: "template",
      descriptionInternal: "[Template interno] Base para agências de alto volume",
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

  // ── Cenário de impersonação (agência + clientes) ──────────────────
  const agencyPlan = await prisma.plan.findUnique({ where: { slug: "agency" } });

  const matrixOrg = await prisma.organization.upsert({
    where: { slug: "matriz-demo" },
    create: {
      name: "Matriz Demo Agência",
      slug: "matriz-demo",
      planId: agencyPlan?.id ?? starter.id,
      organizationKind: "MATRIX",
      resellerPartner: true,
    },
    update: {
      organizationKind: "MATRIX",
      resellerPartner: true,
    },
  });

  const clienteA = await prisma.organization.upsert({
    where: { slug: "cliente-alpha" },
    create: {
      name: "Cliente Alpha LTDA",
      slug: "cliente-alpha",
      planId: starter.id,
      organizationKind: "CLIENT_WORKSPACE",
      parentOrganizationId: matrixOrg.id,
      resellerOrgKind: "CLIENT",
    },
    update: { parentOrganizationId: matrixOrg.id },
  });

  const clienteB = await prisma.organization.upsert({
    where: { slug: "cliente-beta" },
    create: {
      name: "Cliente Beta SA",
      slug: "cliente-beta",
      planId: starter.id,
      organizationKind: "CLIENT_WORKSPACE",
      parentOrganizationId: matrixOrg.id,
      resellerOrgKind: "CLIENT",
    },
    update: { parentOrganizationId: matrixOrg.id },
  });

  const matrizOwner = await prisma.user.upsert({
    where: { email: "agencia@ativadash.com" },
    create: { email: "agencia@ativadash.com", password: hashedPassword, name: "Dono da Agência" },
    update: {},
  });

  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: matrizOwner.id, organizationId: matrixOrg.id } },
    create: { userId: matrizOwner.id, organizationId: matrixOrg.id, role: "agency_owner" },
    update: {},
  });

  // Subscription para orgs novas
  for (const org of [matrixOrg, clienteA, clienteB]) {
    if (!org.planId) continue;
    await prisma.subscription.upsert({
      where: { organizationId: org.id },
      create: { organizationId: org.id, planId: org.planId!, billingMode: "custom", status: "active" },
      update: {},
    });
  }

  console.log("Seed concluído. Planos: starter, professional, agency. Demo: demo@ativadash.com / demo123");
  console.log("Impersonação: agencia@ativadash.com / demo123 → Matriz Demo Agência → Cliente Alpha / Beta");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
