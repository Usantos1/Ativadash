import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Building2, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuthStore, type OrganizationSummary } from "@/stores/auth-store";
import { switchWorkspaceOrganization } from "@/lib/organization-api";
import { cn } from "@/lib/utils";

function collectOptions(
  currentId: string,
  memberships: { organizationId: string; organization: OrganizationSummary; role: string }[] | null,
  managed: OrganizationSummary[] | null
): { id: string; label: string; subtitle?: string }[] {
  const map = new Map<string, { id: string; label: string; subtitle?: string }>();
  for (const m of memberships ?? []) {
    map.set(m.organizationId, {
      id: m.organizationId,
      label: m.organization.name,
      subtitle: m.organizationId === currentId ? "Membro · " + m.role : m.role,
    });
  }
  for (const o of managed ?? []) {
    if (!map.has(o.id)) {
      map.set(o.id, {
        id: o.id,
        label: o.name,
        subtitle: "Organização filha · revenda",
      });
    }
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

export function OrganizationSwitcher() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const memberships = useAuthStore((s) => s.memberships);
  const managed = useAuthStore((s) => s.managedOrganizations);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [loading, setLoading] = useState(false);

  if (!user?.organizationId) return null;

  const currentOrgId = user.organizationId;
  const options = collectOptions(currentOrgId, memberships, managed);
  if (options.length <= 1) return null;

  async function onSelect(organizationId: string) {
    if (organizationId === currentOrgId || loading) return;
    setLoading(true);
    try {
      const res = await switchWorkspaceOrganization(organizationId);
      setAuth(
        {
          ...res.user,
          organization: res.user.organization,
        },
        res.accessToken,
        res.refreshToken,
        {
          memberships: res.memberships,
          managedOrganizations: res.managedOrganizations ?? [],
        }
      );
      navigate("/dashboard", { replace: true });
    } catch {
      /* api.ts pode redirecionar 401 */
    } finally {
      setLoading(false);
    }
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex h-10 min-w-0 max-w-full gap-1.5 rounded-lg border-border/80 px-2 font-normal sm:h-9 sm:max-w-[min(100%,240px)]"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate text-sm">{user.organization?.name ?? "Empresa"}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 max-h-[min(70dvh,24rem)] min-w-[min(calc(100vw-2rem),280px)] overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-md"
          sideOffset={6}
          align="start"
          collisionPadding={12}
        >
          <div className="border-b border-border/60 px-2 py-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Trocar empresa
            </div>
            <p className="mt-1 text-[10px] leading-snug text-muted-foreground normal-case">
              Cada item é um ambiente com dados e integrações próprios — diferente do menu Clientes (cadastro comercial).
            </p>
          </div>
          {options.map((opt) => (
            <DropdownMenu.Item
              key={opt.id}
              className={cn(
                "flex cursor-pointer flex-col gap-0.5 rounded px-2 py-2 outline-none focus:bg-accent focus:text-accent-foreground",
                opt.id === currentOrgId && "bg-muted/60"
              )}
              onSelect={() => onSelect(opt.id)}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                {opt.id === currentOrgId ? (
                  <Check className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <span className="w-3.5" />
                )}
                {opt.label}
              </span>
              {opt.subtitle && (
                <span className="pl-5 text-[11px] text-muted-foreground">{opt.subtitle}</span>
              )}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
