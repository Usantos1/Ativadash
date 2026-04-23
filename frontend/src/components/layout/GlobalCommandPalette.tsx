import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import { canAccessMatrizResellerNav, resolveSidebarNavVariant } from "@/lib/navigation-mode";
import { filterNavGroupsByPlan } from "@/lib/nav-plan-features";
import { useOrganizationPlanFeatures } from "@/components/layout/organization-plan-features-context";
import { buildAppNavGroups, flattenAppNavGroups } from "@/components/layout/app-navigation";

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

function isPathActive(pathname: string, href: string, end?: boolean) {
  if (end) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function GlobalCommandPalette() {
  const navigate = useNavigate();
  const location = useLocation();
  const planFeatures = useOrganizationPlanFeatures();
  const user = useAuthStore((s) => s.user);
  const memberships = useAuthStore((s) => s.memberships);
  const [open, setOpen] = useState(false);

  const showMatrizNav = canAccessMatrizResellerNav(user ?? null, memberships);
  const navVariant = resolveSidebarNavVariant(user ?? null, memberships ?? null);

  const navGroups = useMemo(
    () =>
      filterNavGroupsByPlan(
        buildAppNavGroups(navVariant, { showMatrizNav, platformAdmin: user?.platformAdmin === true }),
        planFeatures,
        { bypassPlanFeatures: user?.platformAdmin === true }
      ),
    [navVariant, planFeatures, showMatrizNav, user?.platformAdmin]
  );

  const allItems = useMemo(() => flattenAppNavGroups(navGroups), [navGroups]);

  const contextualItems = useMemo(
    () =>
      allItems.filter(
        (item) =>
          !isPathActive(location.pathname, item.to, item.end) &&
          (location.pathname.startsWith(item.to) ||
            item.to.startsWith(location.pathname.split("/").slice(0, 2).join("/")) ||
            item.groupLabel === "ADS")
      ),
    [allItems, location.pathname]
  );

  const generalItems = useMemo(
    () => allItems.filter((item) => !isPathActive(location.pathname, item.to, item.end)),
    [allItems, location.pathname]
  );

  useEffect(() => {
    const onToggle = () => {
      if (!isEditableTarget(document.activeElement)) setOpen((prev) => !prev);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("ativadash:toggle-command-palette", onToggle as EventListener);
    window.addEventListener("ativadash:open-command-palette", onOpen as EventListener);
    return () => {
      window.removeEventListener("ativadash:toggle-command-palette", onToggle as EventListener);
      window.removeEventListener("ativadash:open-command-palette", onOpen as EventListener);
    };
  }, []);

  const handleSelect = (path: string) => {
    setOpen(false);
    if (path !== location.pathname) navigate(path);
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
          <Badge variant="outline" className="rounded-full font-mono">
            Atalho Ctrl+K
          </Badge>
        </div>
      </div>
      <div className="px-4 py-3">
        <CommandInput placeholder="Buscar página, módulo ou rota..." className="h-10 rounded-full border border-emerald-200/80 px-1" />
      </div>
      <CommandList className="max-h-[420px] px-2">
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        {contextualItems.length > 0 ? (
          <CommandGroup heading="Nesta área">
            {contextualItems.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={`context-${item.to}`}
                  value={`${item.label} ${item.to} ${item.description || ""}`}
                  onSelect={() => handleSelect(item.to)}
                  className="relative rounded-2xl border-l-2 border-l-transparent px-3 py-3.5 data-[selected=true]:border-l-emerald-500 data-[selected=true]:bg-slate-100 data-[selected=true]:text-foreground dark:data-[selected=true]:bg-slate-900"
                >
                  <Icon className="mr-3 h-4 w-4 text-emerald-600" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{item.label}</span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {item.description || item.groupLabel || "Acessar página"}
                    </span>
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ) : null}

        {contextualItems.length > 0 && generalItems.length > 0 ? <CommandSeparator /> : null}

        <CommandGroup heading="Todo o sistema">
          {generalItems.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.to}
                value={`${item.label} ${item.to} ${item.groupLabel || ""} ${item.description || ""}`}
                onSelect={() => handleSelect(item.to)}
                className="relative rounded-2xl border-l-2 border-l-transparent px-3 py-3.5 data-[selected=true]:border-l-emerald-500 data-[selected=true]:bg-slate-100 data-[selected=true]:text-foreground dark:data-[selected=true]:bg-slate-900"
              >
                <Icon className="mr-3 h-4 w-4 text-muted-foreground" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{item.label}</span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">
                    {item.description || item.groupLabel || "Acessar módulo"}
                  </span>
                </div>
                <CommandShortcut>{item.groupLabel?.toLowerCase()}</CommandShortcut>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
      <div className="border-t px-4 py-2 text-xs text-muted-foreground">↑ ↓ navegar · Enter abrir · Esc fechar</div>
    </CommandDialog>
  );
}
