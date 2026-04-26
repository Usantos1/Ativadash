import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  Boxes,
  Clock,
  DollarSign,
  FileText,
  Home,
  List,
  MessageCircle,
  Package,
  Receipt,
  RefreshCw,
  ShoppingCart,
  Target,
  TrendingUp,
  UserCircle,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';

export type NavigationSectionId = 'operacao' | 'estoque' | 'relatorios' | 'gestao' | 'admin';
export type NavigationVariant = 'default' | 'miui';

export type NavigationItem = {
  label: string;
  path: string;
  description?: string;
  icon: LucideIcon;
  exact?: boolean;
  permission?: string;
  badge?: number;
  section: NavigationSectionId;
  groupLabel?: string;
  contexts?: string[];
  keywords?: string[];
};

export type SegmentMenuEntry = {
  path: string;
  label_menu: string;
  slug?: string;
  icone?: string;
  categoria?: string;
};

export const iconMap: Record<string, LucideIcon> = {
  'layout-dashboard': Home,
  home: Home,
  wrench: Wrench,
  users: UserCircle,
  'user-circle': UserCircle,
  car: Target,
  'file-text': FileText,
  package: Package,
  box: Package,
  'shopping-cart': ShoppingCart,
  receipt: Receipt,
  list: List,
  'refresh-cw': RefreshCw,
  wallet: Wallet,
  'bar-chart-3': BarChart3,
  activity: Activity,
};

const PDV_NAV_ITEMS: NavigationItem[] = [
  { label: 'PDV', description: 'Abrir o caixa e iniciar novas vendas', icon: ShoppingCart, path: '/pdv', section: 'operacao', contexts: ['pdv'] },
  { label: 'Vendas', description: 'Consultar vendas realizadas e detalhes', icon: Receipt, path: '/pdv/vendas', section: 'operacao', contexts: ['pdv'] },
  { label: 'Caixa', description: 'Acompanhar abertura, sangria e fechamento', icon: DollarSign, path: '/pdv/caixa', section: 'operacao', contexts: ['pdv'] },
  { label: 'Clientes', description: 'Consultar e gerenciar cadastro de clientes', icon: Users, path: '/clientes', section: 'operacao', contexts: ['pdv'] },
  { label: 'Produtos', description: 'Visualizar catálogo e gestão de produtos', icon: Package, path: '/produtos', section: 'estoque', contexts: ['pdv'] },
  { label: 'Ordem de Serviço', description: 'Abrir e acompanhar ordens de serviço', icon: Wrench, path: '/os', section: 'operacao', contexts: ['pdv'] },
];

const FINANCEIRO_NAV_ITEMS: NavigationItem[] = [
  { label: 'Dashboard', description: 'Resumo executivo com indicadores financeiros', icon: Home, path: '/financeiro', section: 'relatorios', contexts: ['financeiro'] },
  { label: 'DRE', description: 'Analisar demonstrativo de resultados', icon: FileText, path: '/financeiro/dre', section: 'relatorios', contexts: ['financeiro'] },
  { label: 'Planejamento', description: 'Planejar metas e projeções anuais', icon: Target, path: '/financeiro/planejamento-anual', section: 'relatorios', contexts: ['financeiro'] },
  { label: 'Fluxo de Caixa', description: 'Acompanhar entradas e saídas do período', icon: ArrowLeftRight, path: '/financeiro/fluxo-de-caixa', section: 'relatorios', contexts: ['financeiro'] },
  { label: 'Caixa', description: 'Gerenciar movimentações e sessões de caixa', icon: DollarSign, path: '/financeiro/caixa', section: 'relatorios', contexts: ['financeiro'] },
  { label: 'Contas', description: 'Controlar contas a pagar e a receber', icon: FileText, path: '/financeiro/contas', section: 'relatorios', contexts: ['financeiro'] },
  { label: 'Transações', description: 'Listar transações registradas no sistema', icon: TrendingUp, path: '/financeiro/transacoes', section: 'relatorios', contexts: ['financeiro'] },
];

export const QUICK_NAV_CONFIG: Record<string, NavigationItem[]> = {
  '/financeiro': FINANCEIRO_NAV_ITEMS,
  '/pos-venda': FINANCEIRO_NAV_ITEMS,
  '/pdv': PDV_NAV_ITEMS,
  '/pdv/vendas': PDV_NAV_ITEMS,
  '/pdv/venda': PDV_NAV_ITEMS,
  '/os': PDV_NAV_ITEMS,
  '/clientes': PDV_NAV_ITEMS,
  '/produtos': PDV_NAV_ITEMS,
  '/admin/financeiro': [
    { label: 'Dashboard', description: 'Visão geral do sistema e métricas principais', icon: Home, path: '/', section: 'operacao', contexts: ['global'] },
    { label: 'Financeiro', description: 'Atalhos do módulo financeiro avançado', icon: DollarSign, path: '/admin/financeiro', section: 'relatorios', contexts: ['global'] },
    { label: 'Relatórios', description: 'Acessar relatórios operacionais e gerenciais', icon: BarChart3, path: '/relatorios', section: 'relatorios', contexts: ['global'] },
  ],
  '/': [
    { label: 'Dashboard', description: 'Visão geral do sistema e métricas principais', icon: Home, path: '/', section: 'operacao', contexts: ['global'] },
    { label: 'Relatórios', description: 'Acessar relatórios operacionais e gerenciais', icon: BarChart3, path: '/relatorios', section: 'relatorios', contexts: ['global'] },
  ],
};

export const operacaoItemsBase: NavigationItem[] = [
  { label: 'Dashboard', description: 'Resumo geral com indicadores da operação', path: '/', icon: Home, exact: true, section: 'operacao', groupLabel: 'Operação', contexts: ['global'] },
  { label: 'PDV', description: 'Abrir novas vendas no caixa', path: '/pdv', icon: ShoppingCart, exact: true, permission: 'vendas.create', section: 'operacao', groupLabel: 'Operação', contexts: ['pdv'] },
  { label: 'Vendas', description: 'Consultar histórico e detalhes das vendas', path: '/pdv/vendas', icon: Receipt, exact: true, permission: 'vendas.view', section: 'operacao', groupLabel: 'Operação', contexts: ['pdv'] },
  { label: 'Devoluções', description: 'Gerenciar trocas e devoluções realizadas', path: '/pdv/devolucoes', icon: RefreshCw, permission: 'vendas.manage', section: 'operacao', groupLabel: 'Operação', contexts: ['pdv'] },
  { label: 'Ordem de Serviço', description: 'Criar e acompanhar ordens de serviço', path: '/os', icon: Wrench, permission: 'os.view', section: 'operacao', groupLabel: 'Operação', contexts: ['pdv'] },
  { label: 'Caixa', description: 'Conferir sessões, sangrias e suprimentos', path: '/pdv/caixa', icon: Wallet, exact: true, permission: 'caixa.view', section: 'operacao', groupLabel: 'Operação', contexts: ['pdv'] },
  { label: 'Clientes', description: 'Cadastrar e localizar clientes rapidamente', path: '/clientes', icon: UserCircle, exact: true, permission: 'clientes.view', section: 'operacao', groupLabel: 'Operação', contexts: ['pdv'] },
];

export const estoqueItemsBase: NavigationItem[] = [
  { label: 'Produtos', description: 'Catálogo, preços e cadastro de produtos', path: '/produtos', icon: Package, exact: true, permission: 'produtos.view', section: 'estoque', groupLabel: 'Estoque', contexts: ['pdv'] },
  { label: 'Pedidos', description: 'Pedidos de compra e reposição de itens', path: '/pedidos', icon: List, exact: true, permission: 'produtos.view', section: 'estoque', groupLabel: 'Estoque', contexts: ['pdv'] },
  { label: 'Inventário', description: 'Conferência e ajustes do estoque físico', path: '/inventario', icon: Boxes, exact: true, permission: 'produtos.view', section: 'estoque', groupLabel: 'Estoque', contexts: ['pdv'] },
];

export const relatoriosItemsBase: NavigationItem[] = [
  { label: 'Relatórios', description: 'Indicadores e análises operacionais do negócio', path: '/relatorios', icon: Receipt, permission: 'relatorios.view', exact: false, section: 'relatorios', groupLabel: 'Relatórios', contexts: ['financeiro', 'global'] },
  { label: 'Financeiro', description: 'Visão financeira com DRE, contas e fluxo', path: '/financeiro', icon: BarChart3, permission: 'financeiro.view', exact: false, section: 'relatorios', groupLabel: 'Relatórios', contexts: ['financeiro', 'global'] },
  { label: 'Pós-venda', description: 'Automação e histórico de acompanhamento ao cliente', path: '/pos-venda', icon: MessageCircle, permission: 'pos_venda.view', exact: true, section: 'relatorios', groupLabel: 'Relatórios', contexts: ['financeiro', 'global'] },
  { label: 'Painel de Alertas', description: 'Configurar e acompanhar alertas automáticos', path: '/painel-alertas', icon: Activity, permission: 'alertas.view', exact: false, section: 'relatorios', groupLabel: 'Relatórios', contexts: ['financeiro', 'global'] },
];

export const gestaoItemsBase: NavigationItem[] = [
  { label: 'Recursos Humanos', description: 'Equipe, cargos, aprovações e gestão interna', path: '/rh', icon: Users, permission: 'rh.view', section: 'gestao', groupLabel: 'Gestão', contexts: ['global'] },
  { label: 'Ponto Eletrônico', description: 'Registro de jornada e controle de ponto', path: '/ponto', icon: Clock, permission: 'rh.ponto', section: 'gestao', groupLabel: 'Gestão', contexts: ['global'] },
];

export const adminItemsBase: NavigationItem[] = [
  { label: 'Configurações', description: 'Preferências, parâmetros e ajustes do sistema', path: '/admin/configuracoes', icon: FileText, section: 'admin', groupLabel: 'Administração', contexts: ['global'] },
];

export function toNavigationItem(m: SegmentMenuEntry, useRoleMenu: boolean): NavigationItem {
  return {
    label: m.path === '/inventario' ? 'Inventário' : m.label_menu,
    path: m.path || '/',
    description: `Acessar ${m.path === '/inventario' ? 'Inventário' : m.label_menu}`,
    icon: iconMap[m.icone || ''] || Home,
    exact: true,
    permission: useRoleMenu ? undefined : undefined,
    section: (m.categoria as NavigationSectionId) || 'operacao',
    groupLabel:
      m.categoria === 'estoque'
        ? 'Estoque'
        : m.categoria === 'gestao'
          ? 'Gestão'
          : 'Operação',
    contexts: ['global'],
  };
}

export function dedupeNavigationItems(items: NavigationItem[]): NavigationItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.path)) return false;
    seen.add(item.path);
    return true;
  });
}

export function getQuickNavItemsForPath(pathname: string): NavigationItem[] {
  if (QUICK_NAV_CONFIG[pathname]) {
    return QUICK_NAV_CONFIG[pathname];
  }

  for (const [route, items] of Object.entries(QUICK_NAV_CONFIG)) {
    if (pathname.startsWith(route)) {
      return items;
    }
  }

  return QUICK_NAV_CONFIG['/'] || [];
}
