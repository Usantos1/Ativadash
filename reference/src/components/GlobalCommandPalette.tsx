import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { useCompanyNavigationData } from '@/hooks/useCompanyNavigationData';
import { useNavigationItems } from '@/hooks/useNavigationItems';

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || target.isContentEditable;
}

export function GlobalCommandPalette() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { menuToUse, useRoleMenu, useSegmentOrRoleList } = useCompanyNavigationData();
  const { allItems, quickNavItems } = useNavigationItems({
    menuToUse,
    useRoleMenu,
    useSegmentOrRoleList,
  });

  const contextualItems = useMemo(() => quickNavItems.filter((item) => item.path !== location.pathname), [quickNavItems, location.pathname]);
  const generalItems = useMemo(() => allItems.filter((item) => item.path !== location.pathname), [allItems, location.pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !isEditableTarget(event.target)) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSelect = (path: string) => {
    setOpen(false);
    if (path !== location.pathname) {
      navigate(path);
    }
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      hideCloseButton
      overlayClassName="bg-white/25 backdrop-blur-sm dark:bg-black/35"
      contentClassName="max-w-[620px] border border-emerald-100/70 bg-white/96 p-0 shadow-[0_18px_60px_rgba(16,24,40,0.18)] backdrop-blur-xl dark:border-emerald-950/30 dark:bg-slate-950/96"
    >
      <div className="border-b bg-white/90 px-4 py-3 dark:bg-slate-950/90">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground">Ir para...</div>
            <div className="text-xs text-muted-foreground">Busca global estilo MIUI para navegar mais rápido</div>
          </div>
          <Badge variant="outline" className="rounded-full font-mono">Atalho Ctrl+K</Badge>
        </div>
      </div>
      <div className="px-4 py-3">
        <CommandInput
          placeholder="Buscar página, módulo ou rota..."
          className="h-10 rounded-full border border-emerald-200/80 px-1"
        />
      </div>
      <CommandList className="max-h-[420px] px-2">
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        {contextualItems.length > 0 && (
          <CommandGroup heading="Nesta área">
            {contextualItems.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={`context-${item.path}`}
                  value={`${item.label} ${item.path} ${item.description || ''}`}
                  onSelect={() => handleSelect(item.path)}
                  className="relative rounded-2xl border-l-2 border-l-transparent px-3 py-3.5 data-[selected=true]:border-l-emerald-500 data-[selected=true]:bg-slate-100 data-[selected=true]:text-foreground dark:data-[selected=true]:bg-slate-900"
                >
                  <Icon className="mr-3 h-4 w-4 text-emerald-600" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{item.label}</span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">{item.description || item.groupLabel || 'Acessar página'}</span>
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {contextualItems.length > 0 && generalItems.length > 0 && <CommandSeparator />}

        <CommandGroup heading="Todo o sistema">
          {generalItems.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.path}
                value={`${item.label} ${item.path} ${item.groupLabel || ''} ${item.description || ''}`}
                onSelect={() => handleSelect(item.path)}
                className="relative rounded-2xl border-l-2 border-l-transparent px-3 py-3.5 data-[selected=true]:border-l-emerald-500 data-[selected=true]:bg-slate-100 data-[selected=true]:text-foreground dark:data-[selected=true]:bg-slate-900"
              >
                <Icon className="mr-3 h-4 w-4 text-muted-foreground" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{item.label}</span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">{item.description || item.groupLabel || 'Acessar módulo'}</span>
                </div>
                <CommandShortcut>{item.section}</CommandShortcut>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
      <div className="border-t px-4 py-2 text-xs text-muted-foreground">
        ↑ ↓ navegar · Enter abrir · Esc fechar
      </div>
    </CommandDialog>
  );
}
