import { useNavigate, useLocation } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  Home, Users, TrendingUp, FileText, Target,
  DollarSign, ArrowLeftRight
} from 'lucide-react';

const menuItems = [
  { path: '/financeiro', label: 'Dashboard', icon: Home },
  { path: '/financeiro/dre', label: 'DRE', icon: FileText },
  { path: '/financeiro/planejamento-anual', label: 'Planejamento', icon: Target },
  { path: '/financeiro/fluxo-de-caixa', label: 'Fluxo de Caixa', icon: ArrowLeftRight },
  { path: '/financeiro/caixa', label: 'Caixa', icon: DollarSign },
  { path: '/financeiro/contas', label: 'Contas', icon: FileText },
  { path: '/financeiro/transacoes', label: 'Transações', icon: TrendingUp },
];

export function FinanceiroNavMenu() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Card className="flex-shrink-0 border-[3px] border-gray-400 rounded-xl shadow-sm p-3">
      <div className="flex flex-wrap gap-2 justify-center">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || 
                          (item.path === '/financeiro' && location.pathname === '/financeiro/dashboard');
          return (
            <Button
              key={item.path}
              variant={isActive ? "default" : "outline"}
              size="sm"
              className={cn(
                "h-9 px-3 text-xs font-semibold border-[2px] rounded-lg",
                isActive 
                  ? "bg-primary text-primary-foreground border-primary" 
                  : "border-gray-400 hover:border-gray-600"
              )}
              onClick={() => navigate(item.path)}
            >
              <Icon className="h-3.5 w-3.5 mr-1.5" />
              {item.label}
            </Button>
          );
        })}
      </div>
    </Card>
  );
}
