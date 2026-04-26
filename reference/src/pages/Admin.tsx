import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ModernLayout } from "@/components/ModernLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  Settings, 
  Brain, 
  Clock, 
  Target, 
  TrendingUp, 
  Activity,
  Building2,
  FolderOpen,
  Tag,
  ArrowRight,
  Video,
  FileText,
  Store,
  CreditCard,
  BarChart3
} from "lucide-react";
import { toast } from "sonner";

// ID da empresa principal (Prime Camp LTDA)
const ADMIN_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

export default function Admin() {
  const { user, isAdmin, loading, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate("/login");
        return;
      }
      if (!isAdmin) {
        toast.error("Acesso negado. Apenas administradores podem acessar esta página.");
        navigate("/");
        return;
      }
    }
  }, [user, isAdmin, loading, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  const adminSections = [
    {
      title: "Gestão de Usuários",
      description: "Gerencie usuários, departamentos e permissões",
      icon: Users,
      path: "/admin/users",
      color: "text-blue-600"
    },
    {
      title: "Gestão de Ponto",
      description: "Monitore registros de ponto dos funcionários",
      icon: Clock,
      path: "/admin/timeclock",
      color: "text-indigo-600"
    },
    {
      title: "Gestão de Testes DISC",
      description: "Monitore e gerencie testes DISC dos usuários",
      icon: Brain,
      path: "/admin/disc",
      color: "text-violet-600"
    },
    {
      title: "Formulários de Vagas",
      description: "Gerencie formulários de candidatura e vagas",
      icon: FileText,
      path: "/admin/job-surveys",
      color: "text-blue-600"
    },
    {
      title: "Entrevistas com IA",
      description: "Sistema inteligente de entrevistas online e presenciais",
      icon: Video,
      path: "/admin/interviews",
      color: "text-purple-600"
    },
    {
      title: "Logs do Sistema",
      description: "Visualize e monitore atividades do sistema",
      icon: Activity,
      path: "/admin/logs",
      color: "text-gray-600"
    },
    {
      title: "Minha Empresa",
      description: "Dashboard com métricas e limites do plano",
      icon: BarChart3,
      path: "/minha-empresa",
      color: "text-cyan-600"
    },
    {
      title: "Formas de Pagamento",
      description: "Configure meios de pagamento e taxas",
      icon: CreditCard,
      path: "/admin/configuracoes/pagamentos",
      color: "text-emerald-600"
    },
    {
      title: "Assinatura",
      description: "Gerencie seu plano e pagamentos",
      icon: CreditCard,
      path: "/assinatura",
      color: "text-green-600"
    },
    // Gestão de Revenda - apenas para empresa principal
    ...(user?.company_id === ADMIN_COMPANY_ID ? [{
      title: "Gestão de Revenda",
      description: "Gerencie empresas, assinaturas e pagamentos",
      icon: Store,
      path: "/admin/revenda",
      color: "text-amber-600"
    }] : [])
  ];

  return (
    <ModernLayout
      title="Painel Administrativo"
      subtitle="Central de administração e configurações do sistema"
    >
      <div className="space-y-4 md:space-y-6 px-1 md:px-0 overflow-auto max-h-[calc(100vh-180px)] pb-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
          <Card className="border-2 border-gray-300 border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow bg-blue-50/50 md:bg-transparent">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-2 md:pt-3 px-3 md:px-6">
              <CardTitle className="text-[10px] md:text-sm font-medium text-blue-700 md:text-foreground">Total de Usuários</CardTitle>
              <Users className="h-3 w-3 md:h-4 md:w-4 text-blue-600 md:text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
              <div className="text-base md:text-2xl font-bold text-blue-700 md:text-foreground">-</div>
              <p className="text-[10px] md:text-xs text-muted-foreground mt-1">Usuários registrados</p>
            </CardContent>
          </Card>
          
          <Card className="border-2 border-gray-300 border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow bg-purple-50/50 md:bg-transparent">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-2 md:pt-3 px-3 md:px-6">
              <CardTitle className="text-[10px] md:text-sm font-medium text-purple-700 md:text-foreground">Processos Ativos</CardTitle>
              <Settings className="h-3 w-3 md:h-4 md:w-4 text-purple-600 md:text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
              <div className="text-base md:text-2xl font-bold text-purple-700 md:text-foreground">-</div>
              <p className="text-[10px] md:text-xs text-muted-foreground mt-1">Processos em execução</p>
            </CardContent>
          </Card>
          
          <Card className="border-2 border-gray-300 border-l-4 border-l-red-500 shadow-sm hover:shadow-md transition-shadow bg-red-50/50 md:bg-transparent">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-2 md:pt-3 px-3 md:px-6">
              <CardTitle className="text-[10px] md:text-sm font-medium text-red-700 md:text-foreground">Pendências</CardTitle>
              <Target className="h-3 w-3 md:h-4 md:w-4 text-red-600 md:text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
              <div className="text-base md:text-2xl font-bold text-red-700 md:text-foreground">-</div>
              <p className="text-[10px] md:text-xs text-muted-foreground mt-1">Visão geral</p>
            </CardContent>
          </Card>
          
          <Card className="border-2 border-gray-300 border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-shadow bg-emerald-50/50 md:bg-transparent">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-2 md:pt-3 px-3 md:px-6">
              <CardTitle className="text-[10px] md:text-sm font-medium text-emerald-700 md:text-foreground">Atividade Hoje</CardTitle>
              <Activity className="h-3 w-3 md:h-4 md:w-4 text-emerald-600 md:text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
              <div className="text-base md:text-2xl font-bold text-emerald-700 md:text-foreground">-</div>
              <p className="text-[10px] md:text-xs text-muted-foreground mt-1">Ações realizadas</p>
            </CardContent>
          </Card>
        </div>

        {/* Admin Sections Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
          {adminSections.map((section) => {
            const IconComponent = section.icon;
            return (
              <Card 
                key={section.path} 
                className="border-2 border-gray-300 shadow-sm hover:shadow-md hover:border-gray-400 transition-all duration-200 cursor-pointer active:scale-[0.98] group"
                onClick={() => navigate(section.path)}
              >
                <CardHeader className="pb-3 pt-3 md:pt-6 px-3 md:px-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${section.color.replace('text-', 'from-').replace('-600', '-100')} to-white border-2 border-gray-200`}>
                      <IconComponent className={`h-5 w-5 md:h-6 md:w-6 ${section.color}`} />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                  <CardTitle className="text-sm md:text-lg font-semibold">{section.title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 px-3 md:px-6 pb-3 md:pb-6">
                  <CardDescription className="mb-3 md:mb-4 text-xs md:text-sm line-clamp-2">
                    {section.description}
                  </CardDescription>
                  <Button 
                    variant="outline" 
                    className="w-full h-8 md:h-10 text-xs md:text-sm border-2 border-gray-300 group-hover:bg-gradient-to-r group-hover:from-blue-500 group-hover:to-purple-500 group-hover:text-white group-hover:border-transparent transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(section.path);
                    }}
                  >
                    Acessar
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </ModernLayout>
  );
}

