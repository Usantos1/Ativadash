import { useState, useMemo, useEffect } from 'react';
import { ModernLayout } from '@/components/ModernLayout';
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  GraduationCap,
  TrendingUp,
  Brain,
  Target,
  Clock,
  Users,
  ShieldCheck,
  ClipboardCheck,
  FileText,
  HeartPulse,
  BadgeCheck,
  CalendarCheck,
  Briefcase,
  MessageCircle,
  Search,
  UserCog,
  UserPlus
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const RECRUTAMENTO_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

interface RHSection {
  title: string;
  description: string;
  icon: any;
  path: string;
  color: string;
  category: 'recrutamento' | 'desenvolvimento' | 'gestao' | 'avaliacao' | 'compliance';
  badge?: string;
}

export default function RH() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const canAccessRecrutamento = user?.company_id === RECRUTAMENTO_COMPANY_ID;

  const rhSections: RHSection[] = [
    // Recrutamento
    {
      title: 'Recrutamento e Seleção',
      description: 'Formulários de vagas, entrevistas e banco de talentos',
      icon: Briefcase,
      path: '/admin/job-surveys',
      color: 'text-emerald-700',
      category: 'recrutamento',
    },
    {
      title: 'Entrevistas',
      description: 'Agendar e avaliar entrevistas com IA',
      icon: CalendarCheck,
      path: '/admin/interviews',
      color: 'text-indigo-700',
      category: 'recrutamento',
    },
    {
      title: 'Banco de Talentos',
      description: 'Candidatos e currículos',
      icon: UserPlus,
      path: '/admin/talent-bank',
      color: 'text-blue-700',
      category: 'recrutamento',
    },
    
    // Avaliação
    {
      title: 'Teste DISC',
      description: 'Avaliações comportamentais e perfis DISC',
      icon: Brain,
      path: '/teste-disc',
      color: 'text-purple-600',
      category: 'avaliacao',
    },
    {
      title: 'Avaliações DISC (Admin)',
      description: 'Ferramentas administrativas de avaliação e clima',
      icon: FileText,
      path: '/admin/disc',
      color: 'text-orange-600',
      category: 'avaliacao',
    },
    
    // Gestão
    {
      title: 'Colaboradores',
      description: 'Dados dos colaboradores e usuários do sistema',
      icon: Users,
      path: '/admin/users',
      color: 'text-slate-700',
      category: 'gestao',
    },
    {
      title: 'Ponto Eletrônico',
      description: 'Registro de ponto e controle de jornada',
      icon: Clock,
      path: '/ponto',
      color: 'text-indigo-600',
      category: 'gestao',
    },
    {
      title: 'Gestão de Ponto (Admin)',
      description: 'Monitore e gerencie registros de ponto dos funcionários',
      icon: Clock,
      path: '/admin/timeclock',
      color: 'text-indigo-700',
      category: 'gestao',
    },
    // Compliance
    {
      title: 'Compliance / Documentos',
      description: 'Políticas internas, documentos e estrutura organizacional',
      icon: ShieldCheck,
      path: '/admin/estrutura',
      color: 'text-slate-800',
      category: 'compliance',
    },
  ];

  const categories = useMemo(() => {
    const base = [
      { id: 'recrutamento', label: 'Recrutamento', icon: Briefcase, color: 'text-emerald-700' },
      { id: 'desenvolvimento', label: 'Desenvolvimento', icon: GraduationCap, color: 'text-blue-600' },
      { id: 'avaliacao', label: 'Avaliação', icon: Brain, color: 'text-purple-600' },
      { id: 'gestao', label: 'Gestão', icon: UserCog, color: 'text-slate-700' },
      { id: 'compliance', label: 'Compliance', icon: ShieldCheck, color: 'text-slate-800' },
    ] as const;
    if (!canAccessRecrutamento) return base.filter(c => c.id !== 'recrutamento');
    return base;
  }, [canAccessRecrutamento]);

  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');

  useEffect(() => {
    if (!canAccessRecrutamento && selectedCategory === 'recrutamento') setSelectedCategory('all');
  }, [canAccessRecrutamento, selectedCategory]);

  // Filtrar seções (Recrutamento só para empresa 1)
  const filteredSections = useMemo(() => {
    return rhSections.filter(section => {
      if (section.category === 'recrutamento' && !canAccessRecrutamento) return false;
      const matchesSearch = !searchTerm || 
        section.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        section.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || section.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, selectedCategory, canAccessRecrutamento]);

  // Agrupar por categoria
  const groupedSections = useMemo(() => {
    const groups: Record<string, RHSection[]> = {};
    filteredSections.forEach(section => {
      if (!groups[section.category]) {
        groups[section.category] = [];
      }
      groups[section.category].push(section);
    });
    return groups;
  }, [filteredSections]);

  return (
    <ModernLayout title="Recursos Humanos" subtitle="Gestão completa de pessoas e desenvolvimento">
      <div className="space-y-4 md:space-y-6 px-1 md:px-0">
        {/* Busca e Filtros */}
        <Card className="border-2">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Campo de Busca */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar módulo ou funcionalidade..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              {/* Filtros de Categoria */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-4 py-2 rounded-lg border-2 font-semibold text-sm transition-all ${
                    selectedCategory === 'all'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  Todos
                </button>
                {categories.map(category => {
                  const Icon = category.icon;
                  return (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`px-4 py-2 rounded-lg border-2 font-semibold text-sm transition-all flex items-center gap-2 ${
                        selectedCategory === category.id
                          ? `bg-primary text-primary-foreground border-primary`
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {category.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Seções Agrupadas */}
        {selectedCategory === 'all' ? (
          // Exibir agrupado por categoria
          categories.map(category => {
            const sectionsInCategory = groupedSections[category.id] || [];
            if (sectionsInCategory.length === 0) return null;
            
            const CategoryIcon = category.icon;
            
            return (
              <div key={category.id} className="space-y-3">
                <div className="flex items-center gap-2">
                  <CategoryIcon className={`h-5 w-5 ${category.color}`} />
                  <h2 className="text-lg font-bold">{category.label}</h2>
                  <Badge variant="secondary" className="ml-2">
                    {sectionsInCategory.length}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                  {sectionsInCategory.map((section) => {
                    const Icon = section.icon;
                    return (
                      <Card
                        key={section.path}
                        className="border-2 border-gray-300 shadow-sm hover:shadow-lg hover:border-gray-400 transition-all duration-200 cursor-pointer active:scale-[0.98] group"
                        onClick={() => navigate(section.path)}
                      >
                        <CardHeader className="pb-3 pt-4 px-4">
                          <div className="flex items-start gap-3">
                            <div className={`p-2.5 rounded-lg bg-gradient-to-br ${section.color.replace('text-', 'from-').replace('-600', '-100').replace('-700', '-100').replace('-800', '-100')} to-white border-2 border-gray-200 shadow-sm group-hover:scale-110 transition-transform`}>
                              <Icon className={`h-5 w-5 ${section.color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <CardTitle className="text-base font-semibold">{section.title}</CardTitle>
                                {section.badge && (
                                  <Badge variant="outline" className="text-xs">
                                    {section.badge}
                                  </Badge>
                                )}
                              </div>
                              <CardDescription className="text-sm line-clamp-2">{section.description}</CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })
        ) : (
          // Exibir apenas categoria selecionada
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {filteredSections.map((section) => {
              const Icon = section.icon;
              return (
                <Card
                  key={section.path}
                  className="border-2 border-gray-300 shadow-sm hover:shadow-lg hover:border-gray-400 transition-all duration-200 cursor-pointer active:scale-[0.98] group"
                  onClick={() => navigate(section.path)}
                >
                  <CardHeader className="pb-3 pt-4 px-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2.5 rounded-lg bg-gradient-to-br ${section.color.replace('text-', 'from-').replace('-600', '-100').replace('-700', '-100').replace('-800', '-100')} to-white border-2 border-gray-200 shadow-sm group-hover:scale-110 transition-transform`}>
                        <Icon className={`h-5 w-5 ${section.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <CardTitle className="text-base font-semibold">{section.title}</CardTitle>
                          {section.badge && (
                            <Badge variant="outline" className="text-xs">
                              {section.badge}
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="text-sm line-clamp-2">{section.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        )}

        {/* Mensagem quando não há resultados */}
        {filteredSections.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                Nenhum módulo encontrado com os filtros selecionados.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </ModernLayout>
  );
}
