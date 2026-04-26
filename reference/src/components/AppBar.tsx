import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNavigationItems } from '@/hooks/useNavigationItems';

export function AppBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { quickNavItems } = useNavigationItems();
  const currentPath = location.pathname;

  // Se não houver itens, não mostrar
  if (quickNavItems.length === 0) {
    return null;
  }

  return (
    <div className={cn(
      "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      "flex items-center gap-0 px-2 py-1.5 overflow-x-auto overflow-y-hidden max-w-full min-h-0 min-w-0",
      "justify-start md:justify-center",
      "scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent",
      "touch-pan-x overscroll-x-contain"
    )}>
      {quickNavItems.map((item, index) => {
        const Icon = item.icon;
        // Corrigir lógica: só marcar como ativo se for exatamente o path ou começar com o path + '/'
        let isActive = false;
        if (item.path === '/') {
          isActive = currentPath === '/';
        } else {
          isActive = currentPath === item.path || currentPath.startsWith(item.path + '/');
          const moreSpecificMatch = quickNavItems.find(other => 
            other.path !== item.path && 
            other.path.startsWith(item.path) && 
            (currentPath === other.path || currentPath.startsWith(other.path + '/'))
          );
          if (moreSpecificMatch) {
            isActive = false;
          }
        }
        
        return (
          <div key={item.path} className="flex items-center shrink-0">
            {index > 0 && (
              <div className="h-4 w-px bg-border mx-0.5 shrink-0" />
            )}
            <Button
              variant={isActive ? "default" : "ghost"}
              size="sm"
              className={cn(
                "gap-1.5 whitespace-nowrap shrink-0 touch-manipulation",
                "min-h-[44px] px-3 text-xs rounded-xl md:min-h-0 md:h-7 md:px-2 md:rounded-md",
                isActive 
                  ? "bg-[hsl(var(--sidebar-primary,var(--primary)))] text-white hover:opacity-90 shadow-sm" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
              onClick={() => navigate(item.path)}
            >
              <Icon className="h-4 w-4 md:h-3.5 md:w-3.5 shrink-0" />
              <span className="font-medium truncate max-w-[90px] md:max-w-[100px]">{item.label}</span>
              {item.badge && item.badge > 0 && (
                <span className="ml-0.5 px-1 py-0.5 text-[10px] rounded-full bg-sidebar-primary-foreground/20 shrink-0">
                  {item.badge}
                </span>
              )}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
