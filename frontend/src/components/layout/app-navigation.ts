import type React from "react";
import {
  Bell,
  DollarSign,
  LayoutDashboard,
  Layers,
  Megaphone,
  Plug,
  ScrollText,
  Settings,
  Shield,
  Target,
  TrendingUp,
  Users,
  Users2,
} from "lucide-react";
import { isAgencyBranchExpandedOpsEnabled, type SidebarNavVariant } from "@/lib/navigation-mode";

export type AppNavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  description?: string;
  primary?: boolean;
};

export type AppNavGroup = {
  label: string;
  items: AppNavItem[];
};

const FULL_NAV_GROUPS: AppNavGroup[] = [
  {
    label: "Visão geral",
    items: [
      {
        to: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        description: "Resumo executivo da conta, canais e indicadores principais.",
        primary: true,
      },
    ],
  },
  {
    label: "ADS",
    items: [
      {
        to: "/marketing",
        label: "Painel ADS",
        icon: Megaphone,
        end: true,
        description: "Painel consolidado das campanhas e resultados de mídia.",
        primary: true,
      },
      {
        to: "/marketing/captacao",
        label: "Captação",
        icon: Target,
        description: "Acompanhe investimento e geração de leads por canal.",
      },
      {
        to: "/marketing/conversao",
        label: "Conversão",
        icon: TrendingUp,
        description: "Veja gargalos, eficiência e evolução do funil.",
      },
      {
        to: "/marketing/receita",
        label: "Receita",
        icon: DollarSign,
        description: "Analise retorno, monetização e impacto no faturamento.",
      },
    ],
  },
  {
    label: "Conexões",
    items: [
      {
        to: "/marketing/integracoes",
        label: "Integrações",
        icon: Plug,
        description: "Conecte Meta Ads, Google Ads e outros canais.",
      },
      {
        to: "/ads/metas-alertas",
        label: "Automação e Metas",
        icon: Bell,
        description: "Configure metas, alertas e ações automáticas do dashboard.",
      },
    ],
  },
  {
    label: "Operação",
    items: [
      {
        to: "/clientes",
        label: "Clientes",
        icon: Users,
        description: "Gerencie a base de clientes e organizações operadas.",
      },
      {
        to: "/usuarios",
        label: "Equipe",
        icon: Users2,
        description: "Controle os membros, acessos e papéis do workspace.",
      },
      {
        to: "/atividades",
        label: "Log de Atividades",
        icon: ScrollText,
        description: "Auditoria recente das ações feitas no ambiente.",
      },
    ],
  },
];

export function buildAppNavGroups(
  variant: SidebarNavVariant,
  opts: { showMatrizNav: boolean; platformAdmin?: boolean }
): AppNavGroup[] {
  const contaItems: AppNavItem[] = [];
  if (opts.showMatrizNav) {
    contaItems.push({
      to: "/revenda",
      label: "Revenda",
      icon: Layers,
      description: "Área matriz para operar filiais, planos e auditoria.",
    });
  }
  contaItems.push({
    to: "/configuracoes",
    label: "Configurações",
    icon: Settings,
    description: "Preferências do workspace, integrações e conta.",
  });
  if (opts.platformAdmin) {
    contaItems.push({
      to: "/plataforma",
      label: "Admin Ativa Dash",
      icon: Shield,
      description: "Staff Ativa Dash: empresas raiz, catálogo global de planos e assinaturas do produto.",
    });
  }

  if (variant === "agency_client_portal") {
    return [
      {
        label: "Visão geral",
        items: [FULL_NAV_GROUPS[0]!.items[0]!],
      },
      {
        label: "ADS",
        items: [...FULL_NAV_GROUPS[1]!.items],
      },
      {
        label: "Conta",
        items: [{ ...contaItems[contaItems.length - 1]! }],
      },
    ];
  }

  if (variant === "agency_branch") {
    const conexoes: AppNavGroup = {
      label: "Conexões",
      items: [
        {
          to: "/marketing/integracoes",
          label: "Integrações",
          icon: Plug,
          description: "Conexões dos canais e contas vinculadas ao workspace.",
        },
        {
          to: "/ads/metas-alertas",
          label: "Automação e Metas",
          icon: Bell,
          description: "Acompanhe metas, regras e alertas automáticos.",
        },
      ],
    };

    if (isAgencyBranchExpandedOpsEnabled()) {
      return [
        {
          label: "Visão geral",
          items: [FULL_NAV_GROUPS[0]!.items[0]!],
        },
        {
          label: "ADS",
          items: [...FULL_NAV_GROUPS[1]!.items],
        },
        conexoes,
        {
          label: "Operação",
          items: [
            {
              to: "/clientes",
              label: "Clientes",
              icon: Users,
              description: "Clientes e contas atendidas por esta operação.",
            },
            {
              to: "/usuarios",
              label: "Equipe",
              icon: Users2,
              description: "Membros ativos e permissões da filial.",
            },
          ],
        },
        { label: "Conta", items: contaItems },
      ];
    }

    return [
      {
        label: "Visão geral",
        items: [
          {
            to: "/dashboard",
            label: "Visão geral",
            icon: LayoutDashboard,
            description: "Resumo executivo da operação atual.",
          },
        ],
      },
      {
        label: "Operação",
        items: [
          {
            to: "/clientes",
            label: "Clientes",
            icon: Users,
            description: "Clientes e contas atendidas por esta operação.",
          },
        ],
      },
      conexoes,
      { label: "Conta", items: contaItems },
    ];
  }

  if (variant === "client_workspace") {
    return [
      ...FULL_NAV_GROUPS.filter((g) => g.label !== "Operação"),
      {
        label: "Operação",
        items: [
          {
            to: "/usuarios",
            label: "Equipe",
            icon: Users2,
            description: "Acesso dos usuários internos desta conta.",
          },
        ],
      },
      { label: "Conta", items: contaItems },
    ];
  }

  return [...FULL_NAV_GROUPS, { label: "Conta", items: contaItems }];
}

export function flattenAppNavGroups(groups: AppNavGroup[]) {
  return groups.flatMap((group) =>
    group.items.map((item) => ({
      ...item,
      groupLabel: group.label,
      description: item.description ?? `${group.label} · ${item.label}`,
    }))
  );
}

export function splitPrimaryAppNavItems(groups: AppNavGroup[]) {
  const allItems = flattenAppNavGroups(groups);
  const primaryItems = allItems.filter((item) => item.primary);
  const primaryPaths = new Set(primaryItems.map((item) => item.to));
  const groupedMenuItems = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !primaryPaths.has(item.to)),
    }))
    .filter((group) => group.items.length > 0);
  return { allItems, primaryItems, groupedMenuItems };
}
