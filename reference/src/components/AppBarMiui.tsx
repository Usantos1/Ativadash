import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useNavigationItems } from '@/hooks/useNavigationItems';
import { useThemeConfig, getDefaultConfigByHost } from '@/contexts/ThemeConfigContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function AppBarMiui() {
  const location = useLocation();
  const navigate = useNavigate();
  const { allItems } = useNavigationItems();
  const { config } = useThemeConfig();
  const [menuOpen, setMenuOpen] = useState(false);
  const logoUrl =
    config.logo || getDefaultConfigByHost().logo || 'https://primecamp.com.br/wp-content/uploads/2025/07/Design-sem-nome-4.png';

  if (allItems.length === 0) {
    return null;
  }

  const primaryPaths = ['/pdv', '/os'];
  const primaryItems = primaryPaths
    .map((path) => allItems.find((item) => item.path === path))
    .filter(Boolean);
  const menuItems = allItems.filter((item) => !primaryItems.some((primary) => primary.path === item.path));
  const groupedItems = menuItems.reduce<Record<string, typeof menuItems>>((acc, item) => {
    const key = item.groupLabel || 'Navegação';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <div className="flex w-full items-center gap-2">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="flex shrink-0 items-center px-1 py-0.5 transition-opacity hover:opacity-90"
      >
        <img
          src={logoUrl}
          alt={config.logoAlt || 'Logo'}
          className="h-12 w-auto object-contain max-w-[170px]"
        />
      </button>

      {primaryItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.path === '/'
            ? location.pathname === '/'
            : location.pathname === item.path || location.pathname.startsWith(item.path + '/');

        return (
          <Button
            key={item.path}
            variant="ghost"
            size="sm"
            onClick={() => navigate(item.path)}
            className={cn(
              'h-11 shrink-0 rounded-full border px-4 text-sm font-medium shadow-sm',
              isActive
                ? 'border-[hsl(var(--sidebar-primary,var(--primary)))] bg-[hsl(var(--sidebar-primary,var(--primary)))] text-white hover:opacity-95'
                : 'border-emerald-200/80 bg-white text-foreground hover:bg-emerald-50/80 dark:border-emerald-900/40 dark:bg-slate-950 dark:hover:bg-emerald-950/20'
            )}
          >
            <Icon className="mr-2 h-4 w-4" />
            <span className="truncate">{item.label}</span>
          </Button>
        );
      })}

      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="relative z-20 h-11 min-w-[118px] shrink-0 rounded-full border border-emerald-200/80 bg-white px-4 text-sm font-medium shadow-sm hover:bg-emerald-50/80 dark:border-emerald-900/40 dark:bg-slate-950 dark:hover:bg-emerald-950/20"
            onPointerDown={(e) => {
              if (e.pointerType === 'mouse') {
                e.preventDefault();
                e.stopPropagation();
                setMenuOpen((prev) => !prev);
              }
            }}
            onClick={(e) => e.stopPropagation()}
          >
            Menu
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={10}
          className="w-[360px] max-h-[72vh] overflow-y-auto rounded-[28px] border border-border/70 bg-background p-3 opacity-100 shadow-[0_18px_50px_rgba(16,24,40,0.18)] scrollbar-thin scrollbar-thumb-emerald-200 scrollbar-track-transparent dark:bg-slate-950 dark:scrollbar-thumb-emerald-900"
        >
          {Object.entries(groupedItems).map(([groupLabel, items], index) => (
            <div key={groupLabel} className="min-w-0">
              {index > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="px-3 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                {groupLabel}
              </DropdownMenuLabel>
              {items.map((item) => {
                const Icon = item.icon;
                const isCurrentPage =
                  item.path === '/'
                    ? location.pathname === '/'
                    : location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                return (
                  <DropdownMenuItem
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={cn(
                      "relative rounded-2xl border-l-2 border-l-transparent px-3 py-3.5 outline-none focus:bg-slate-100 focus:text-foreground dark:focus:bg-slate-900",
                      "data-[highlighted]:border-l-emerald-500 data-[highlighted]:bg-slate-100 data-[highlighted]:text-foreground dark:data-[highlighted]:bg-slate-900",
                      isCurrentPage && "border-l-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20"
                    )}
                  >
                    <div className="mr-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[15px] font-semibold text-slate-900 dark:text-slate-100">{item.label}</span>
                        {isCurrentPage && (
                          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            Página atual
                          </span>
                        )}
                      </div>
                      <span className="line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {item.description || item.groupLabel || 'Acessar módulo'}
                      </span>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        type="button"
        variant="ghost"
        className="h-11 w-11 shrink-0 rounded-full border border-emerald-200/80 bg-white p-0 text-emerald-600 shadow-sm hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-slate-950 dark:hover:bg-emerald-950/20"
        aria-label="Busca rápida"
        title="Busca rápida (Ctrl+K)"
        onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
      >
        <Search className="h-4 w-4" />
      </Button>

      <div className="min-w-0 flex-1" />
    </div>
  );
}
