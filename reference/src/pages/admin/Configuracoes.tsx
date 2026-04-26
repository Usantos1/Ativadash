import { ModernLayout } from '@/components/ModernLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  Wrench,
  Settings,
  Hash,
  CreditCard,
  Plug,
  Activity,
  Users,
  Store,
  Building2,
  FolderOpen,
  FileText,
} from 'lucide-react';
import { DashboardConfigModal } from '@/components/dashboard/DashboardConfigModal';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PermissionGate } from '@/components/PermissionGate';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { useCompanySegment } from '@/hooks/useCompanySegment';
import { toast } from 'sonner';

const ADMIN_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

export default function Configuracoes() {
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();
  const { segmentoSlug } = useCompanySegment();
  const [showDashboardConfig, setShowDashboardConfig] = useState(false);
  const [showOSConfig, setShowOSConfig] = useState(false);
  const [osNumeroInicial, setOsNumeroInicial] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  
  const { settings, loading: settingsLoading, saveSettings } = useSystemSettings();

  // Carregar configuração atual quando abrir o modal
  useEffect(() => {
    if (showOSConfig) {
      setOsNumeroInicial(String(settings.os_numero_inicial || 1));
    }
  }, [showOSConfig, settings.os_numero_inicial]);

  const handleSaveOSConfig = async () => {
    const numero = parseInt(osNumeroInicial);
    if (isNaN(numero) || numero < 1) {
      toast.error('Digite um número válido maior que 0');
      return;
    }

    setIsSaving(true);
    try {
      await saveSettings({ os_numero_inicial: numero });
      toast.success('Configuração salva com sucesso!');
      setShowOSConfig(false);
    } catch (err) {
      toast.error('Erro ao salvar configuração');
    } finally {
      setIsSaving(false);
    }
  };

  const configSections = [
    {
      title: 'Dashboard',
      description: 'Configure widgets, modo apresentação e atualização automática',
      icon: LayoutDashboard,
      color: 'from-blue-500 to-indigo-500',
      hoverColor: 'hover:from-blue-600 hover:to-indigo-600',
      action: () => setShowDashboardConfig(true),
      permission: 'admin.view',
    },
    {
      title: 'Configurar Cupom',
      description: 'Personalize informações e layout dos cupons fiscais',
      icon: Receipt,
      color: 'from-green-500 to-emerald-500',
      hoverColor: 'hover:from-green-600 hover:to-emerald-600',
      path: '/pdv/configuracao-cupom',
      permission: 'vendas.manage',
    },
    ...(segmentoSlug === 'comercio' ? [] : [{
      title: 'Configurar Status OS',
      description: 'Gerencie status de ordens de serviço e checklists',
      icon: Wrench,
      color: 'from-purple-500 to-pink-500',
      hoverColor: 'hover:from-purple-600 hover:to-pink-600',
      path: '/pdv/configuracao-status',
      permission: 'os.config.status',
    }, {
      title: 'Ajustes da OS',
      description: 'Configure número inicial das ordens de serviço',
      icon: Hash,
      color: 'from-orange-500 to-amber-500',
      hoverColor: 'hover:from-orange-600 hover:to-amber-600',
      action: () => setShowOSConfig(true),
      permission: 'admin.view',
    }]),
    {
      title: 'Formas de Pagamento e Taxas',
      description: 'Configure formas de pagamento, taxas e parcelamentos',
      icon: CreditCard,
      color: 'from-teal-500 to-cyan-500',
      hoverColor: 'hover:from-teal-600 hover:to-cyan-600',
      path: '/admin/configuracoes/pagamentos',
      permission: 'admin.view',
    },
    {
      title: 'Usuários e Permissões',
      description: 'Gerencie usuários, perfis e permissões de acesso',
      icon: Users,
      color: 'from-indigo-500 to-violet-500',
      hoverColor: 'hover:from-indigo-600 hover:to-violet-600',
      path: '/admin/users',
      permission: 'admin.users',
    },
    {
      title: 'Integrações',
      description: 'APIs, webhooks e conexões com outros sistemas',
      icon: Plug,
      color: 'from-slate-500 to-zinc-500',
      hoverColor: 'hover:from-slate-600 hover:to-zinc-600',
      path: '/integracoes',
      permission: 'admin.view',
    },
    {
      title: 'Logs do Sistema',
      description: 'Visualize logs de auditoria e atividade',
      icon: Activity,
      color: 'from-rose-500 to-pink-500',
      hoverColor: 'hover:from-rose-600 hover:to-pink-600',
      path: '/admin/logs',
      permission: 'admin.logs',
    },
    // Gestão de Revenda — apenas para admin da empresa principal (empresa 1)
    ...(user?.company_id === ADMIN_COMPANY_ID ? [{
      title: 'Gestão de Revenda',
      description: 'Gerencie revendedores e assinaturas',
      icon: Store,
      color: 'from-amber-500 to-yellow-500',
      hoverColor: 'hover:from-amber-600 hover:to-yellow-600',
      path: '/admin/revenda',
      permission: 'admin.view',
    }] : []),
    {
      title: 'Estrutura Organizacional',
      description: 'Usuários, departamentos, categorias e tags',
      icon: Building2,
      color: 'from-sky-500 to-blue-500',
      hoverColor: 'hover:from-sky-600 hover:to-blue-600',
      path: '/admin/estrutura',
      permission: 'admin.view',
    },
    // Cadastros Base: apenas empresa 1 (reseller) pode ver
    ...(user?.company_id === ADMIN_COMPANY_ID ? [{
      title: 'Cadastros Base',
      description: 'Departamentos, categorias, tags e cadastros gerais',
      icon: FolderOpen,
      color: 'from-violet-500 to-purple-500',
      hoverColor: 'hover:from-violet-600 hover:to-purple-600',
      path: '/admin/cadastros',
      permission: 'admin.view',
    }] : []),
    // Marcas e Modelos (celulares): oculto para Comércio
    ...(segmentoSlug === 'comercio' ? [] : [{
      title: 'Marcas e Modelos',
      description: 'Gerencie marcas e modelos de produtos',
      icon: FileText,
      color: 'from-slate-600 to-gray-600',
      hoverColor: 'hover:from-slate-700 hover:to-gray-700',
      path: '/pdv/marcas-modelos',
      permission: 'produtos.manage',
    }]),
  ];

  return (
    <ModernLayout
      title="Configurações"
      subtitle="Centralize todas as configurações do sistema"
    >
      <div className="space-y-4 md:space-y-6 px-1 md:px-0">
        {/* Header */}
        <Card className="border-2 border-gray-300 shadow-sm">
          <CardHeader className="pb-3 pt-3 md:pt-6 px-3 md:px-6 border-b-2 border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-gray-100 to-white border-2 border-gray-200">
                <Settings className="h-6 w-6 md:h-8 md:w-8 text-gray-600" />
              </div>
              <div>
                <CardTitle className="text-base md:text-xl">Central de Configurações</CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  Gerencie todas as configurações do sistema em um só lugar
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Cards de Configuração */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {configSections.map((section) => {
            const Icon = section.icon;
            const content = (
              <Card
                key={section.title}
                className="border-2 border-gray-300 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                onClick={section.action || (() => navigate(section.path!))}
              >
                <CardHeader className="pb-3 pt-3 md:pt-6 px-3 md:px-6">
                  <div className="flex items-start justify-between mb-2">
                    <div className={`p-2 md:p-3 rounded-lg bg-gradient-to-br ${section.color} ${section.hoverColor} transition-all group-hover:scale-110`}>
                      <Icon className="h-5 w-5 md:h-6 md:w-6 text-white" />
                    </div>
                  </div>
                  <CardTitle className="text-sm md:text-lg mb-1">{section.title}</CardTitle>
                  <CardDescription className="text-xs md:text-sm line-clamp-2">
                    {section.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
                  <Button
                    className={`w-full bg-gradient-to-r ${section.color} ${section.hoverColor} text-white border-0 h-9`}
                    onClick={(e) => {
                      e.stopPropagation();
                      section.action ? section.action() : navigate(section.path!);
                    }}
                  >
                    Configurar
                  </Button>
                </CardContent>
              </Card>
            );

            if (section.permission) {
              return (
                <PermissionGate key={section.title} permission={section.permission}>
                  {content}
                </PermissionGate>
              );
            }

            return content;
          })}
        </div>

        {/* Informações Adicionais */}
        <Card className="border-2 border-gray-300 shadow-sm">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-50 border-2 border-blue-200">
                <Settings className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm md:text-base font-semibold mb-1">Sobre as Configurações</h3>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Todas as configurações são salvas por usuário e aplicadas imediatamente. 
                  Use o modo apresentação para exibir o dashboard em TVs da loja com atualização automática.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Configuração do Dashboard */}
      <DashboardConfigModal
        open={showDashboardConfig}
        onOpenChange={setShowDashboardConfig}
      />

      {/* Modal de Configuração da OS */}
      <Dialog open={showOSConfig} onOpenChange={setShowOSConfig}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5 text-orange-500" />
              Ajustes da Ordem de Serviço
            </DialogTitle>
            <DialogDescription>
              Configure o número inicial das ordens de serviço. 
              Novas OS serão numeradas a partir deste valor (se maior que a última OS criada).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="os-numero">Número Inicial da OS</Label>
              <Input
                id="os-numero"
                type="number"
                min="1"
                value={osNumeroInicial}
                onChange={(e) => setOsNumeroInicial(e.target.value)}
                placeholder="Ex: 7070"
              />
              <p className="text-xs text-muted-foreground">
                Se você tinha 7015 OS no sistema anterior e quer começar a partir de 7070, 
                digite 7070 aqui. O sistema usará sempre o maior entre este valor e a última OS existente + 1.
              </p>
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
              <p className="text-xs text-amber-800">
                <strong>Atenção:</strong> Esta configuração define o número mínimo para novas OS. 
                Se já existirem OS com números maiores, o sistema continuará a sequência normalmente.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOSConfig(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveOSConfig} 
              disabled={isSaving}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {isSaving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModernLayout>
  );
}


