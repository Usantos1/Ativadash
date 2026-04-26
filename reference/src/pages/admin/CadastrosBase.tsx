import { ModernLayout } from '@/components/ModernLayout';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Smartphone,
  Package,
  UserCircle,
  Wrench,
  ShoppingCart,
  ClipboardList,
  CreditCard,
  FileBarChart,
  FileCog,
  Settings,
  LayoutDashboard,
  ShieldCheck,
  Building2,
  Tag,
  Clock,
  BarChart2,
  FileText,
  Activity,
  ListChecks,
  Compass,
  Bell,
  FilePlus,
  CheckSquare,
  Calendar as CalendarIcon,
  FileSignature,
  Users,
  Briefcase,
  Globe2,
  MessageCircle,
  GitBranch,
  FileSearch,
  Layers,
  FileInput,
  FileOutput,
  ClipboardCheck,
  Book
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const ADMIN_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

export default function CadastrosBase() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Cadastros Base: apenas a empresa 1 (reseller) pode acessar
  useEffect(() => {
    if (user?.company_id && user.company_id !== ADMIN_COMPANY_ID) {
      navigate('/admin/configuracoes', { replace: true });
    }
  }, [user?.company_id, navigate]);

  const cadastrosSections = [
    {
      title: 'Marcas e Modelos',
      description: 'Gerencie marcas e modelos de aparelhos',
      icon: Smartphone,
      path: '/pdv/marcas-modelos',
      color: 'text-blue-600',
    },
    {
      title: 'Produtos',
      description: 'Cadastro de produtos e serviços',
      icon: Package,
      path: '/produtos',
      color: 'text-green-600',
    },
    {
      title: 'Clientes',
      description: 'Cadastro de clientes e fornecedores',
      icon: UserCircle,
      path: '/clientes',
      color: 'text-purple-600',
    },
    {
      title: 'Nova OS',
      description: 'Criar nova Ordem de Serviço',
      icon: Wrench,
      path: '/os/nova',
      color: 'text-orange-600',
    },
    {
      title: 'Lista de OS',
      description: 'Consultar ordens de serviço',
      icon: ClipboardList,
      path: '/os',
      color: 'text-amber-600',
    },
    {
      title: 'Nova Venda',
      description: 'Criar nova venda',
      icon: ShoppingCart,
      path: '/pdv/venda/nova',
      color: 'text-pink-600',
    },
    {
      title: 'Lista de Vendas',
      description: 'Consultar vendas',
      icon: ListChecks,
      path: '/pdv/vendas',
      color: 'text-indigo-600',
    },
    {
      title: 'Caixa',
      description: 'Movimentações e fechamento',
      icon: CreditCard,
      path: '/pdv/caixa',
      color: 'text-teal-600',
    },
    {
      title: 'Relatórios PDV',
      description: 'Indicadores e listagens',
      icon: FileBarChart,
      path: '/pdv/relatorios',
      color: 'text-blue-500',
    },
    {
      title: 'Config. Cupom',
      description: 'Dados do cupom fiscal',
      icon: FileCog,
      path: '/pdv/configuracao-cupom',
      color: 'text-gray-700',
    },
    {
      title: 'Config. Status OS',
      description: 'Fluxo e status de OS',
      icon: Settings,
      path: '/pdv/configuracao-status',
      color: 'text-gray-700',
    },
    {
      title: 'Dashboard Assistência',
      description: 'Visão geral da assistência',
      icon: LayoutDashboard,
      path: '/assistencia',
      color: 'text-emerald-600',
    },
    {
      title: 'PDV (Venda rápida)',
      description: 'Atalho para o PDV',
      icon: ShoppingCart,
      path: '/pdv',
      color: 'text-emerald-700',
    },
    {
      title: 'Admin Usuários',
      description: 'Gerenciar usuários e permissões',
      icon: ShieldCheck,
      path: '/admin/users',
      color: 'text-sky-700',
    },
    {
      title: 'Ponto',
      description: 'Registro de ponto',
      icon: Clock,
      path: '/ponto',
      color: 'text-amber-700',
    },
    {
      title: 'Teste DISC',
      description: 'Avaliação DISC',
      icon: Activity,
      path: '/teste-disc',
      color: 'text-red-600',
    },
    {
      title: 'Login / Auth',
      description: 'Página de login / reset',
      icon: ShieldCheck,
      path: '/login',
      color: 'text-slate-700',
    },
    {
      title: 'Dashboard Geral',
      description: 'Home principal',
      icon: LayoutDashboard,
      path: '/',
      color: 'text-emerald-700',
    },
    {
      title: 'Dashboard Gestão',
      description: 'Gestão operacional',
      icon: LayoutDashboard,
      path: '/gestao',
      color: 'text-emerald-700',
    },
    {
      title: 'Pending Approval',
      description: 'Aprovações pendentes',
      icon: ClipboardCheck,
      path: '/pending-approval',
      color: 'text-amber-800',
    },
    {
      title: 'User Logs',
      description: 'Logs de usuário',
      icon: FileText,
      path: '/logs',
      color: 'text-slate-700',
    },
    {
      title: 'Integrações',
      description: 'Integrações do sistema',
      icon: Globe2,
      path: '/integracoes',
      color: 'text-emerald-700',
    },
    {
      title: 'Perfil',
      description: 'Perfil do usuário',
      icon: UserCircle,
      path: '/perfil',
      color: 'text-purple-600',
    },
    // Admin / gestão
    {
      title: 'Admin Home',
      description: 'Painel admin',
      icon: ShieldCheck,
      path: '/admin',
      color: 'text-slate-800',
    },
    {
      title: 'Admin DISC',
      description: 'Configurar DISC',
      icon: Activity,
      path: '/admin/disc',
      color: 'text-orange-600',
    },
    {
      title: 'Admin Financeiro',
      description: 'Módulo financeiro',
      icon: CreditCard,
      path: '/admin/financeiro',
      color: 'text-emerald-700',
    },
    {
      title: 'Job Surveys',
      description: 'Pesquisas de vaga',
      icon: FileText,
      path: '/admin/job-surveys',
      color: 'text-blue-700',
    },
    {
      title: 'Talent Bank',
      description: 'Banco de talentos',
      icon: Users,
      path: '/admin/talent-bank',
      color: 'text-blue-800',
    },
    {
      title: 'Interviews',
      description: 'Entrevistas',
      icon: Briefcase,
      path: '/admin/interviews',
      color: 'text-indigo-800',
    },
    {
      title: 'Estrutura',
      description: 'Estrutura organizacional',
      icon: Layers,
      path: '/admin/estrutura',
      color: 'text-slate-800',
    },
    // RH / People
    {
      title: 'RH',
      description: 'Dashboard RH',
      icon: Users,
      path: '/rh',
      color: 'text-emerald-700',
    },
    {
      title: 'Candidato DISC',
      description: 'Portal DISC externo',
      icon: FileSignature,
      path: '/candidato-disc',
      color: 'text-orange-700',
    },
    {
      title: 'Acompanhar OS (público)',
      description: 'Tracking de OS',
      icon: ClipboardList,
      path: '/acompanhar-os/:id',
      color: 'text-amber-700',
    },
  ];

  // Só empresa 1 (reseller) pode acessar; useEffect redireciona os demais
  if (user && user.company_id !== ADMIN_COMPANY_ID) {
    return null;
  }

  return (
    <ModernLayout title="Cadastros Base" subtitle="Configurações e cadastros fundamentais">
      <div className="flex-1 overflow-auto scrollbar-thin">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cadastrosSections.map((section) => {
          const Icon = section.icon;
          return (
            <Card
              key={section.path}
              className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105"
              onClick={() => navigate(section.path)}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-muted ${section.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-lg">{section.title}</CardTitle>
                </div>
                <CardDescription className="mt-2">{section.description}</CardDescription>
              </CardHeader>
            </Card>
          );
        })}
        </div>
      </div>
    </ModernLayout>
  );
}

