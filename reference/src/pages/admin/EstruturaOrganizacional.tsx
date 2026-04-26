import { ModernLayout } from '@/components/ModernLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function EstruturaOrganizacional() {
  const navigate = useNavigate();

  const estruturaSections = [
    {
      title: 'Usuários',
      description: 'Gerencie usuários e permissões do sistema',
      icon: Users,
      path: '/admin/users',
      color: 'text-blue-600',
    },
    {
      title: 'Departamentos',
      description: 'Organize a estrutura departamental',
      icon: Building2,
      path: '/admin/departments',
      color: 'text-green-600',
    },
  ];

  return (
    <ModernLayout title="Estrutura Organizacional" subtitle="Configure a organização da empresa">
      <div className="space-y-4 md:space-y-6 px-1 md:px-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 lg:gap-6">
          {estruturaSections.map((section) => {
            const Icon = section.icon;
            return (
              <Card
                key={section.path}
                className="border-2 border-gray-300 shadow-sm hover:shadow-md hover:border-gray-400 transition-all duration-200 cursor-pointer active:scale-[0.98] group"
                onClick={() => navigate(section.path)}
              >
                <CardHeader className="pb-3 pt-3 md:pt-6 px-3 md:px-6">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 md:p-2.5 rounded-lg bg-gradient-to-br ${section.color.replace('text-', 'from-').replace('-600', '-100').replace('-700', '-100')} to-white border-2 border-gray-200 shadow-sm`}>
                      <Icon className={`h-5 w-5 md:h-6 md:w-6 ${section.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm md:text-lg font-semibold mb-1 md:mb-2">{section.title}</CardTitle>
                      <CardDescription className="text-xs md:text-sm line-clamp-2">{section.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </div>
    </ModernLayout>
  );
}

