import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Building2, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore, type OrganizationSummary } from "@/stores/auth-store";
import { switchWorkspaceOrganization } from "@/lib/organization-api";
import { executiveGreetingLine } from "@/lib/display-name";
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
        subtitle: "Filial da matriz · operar como esta empresa",
      });
    }
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

const shellBase = cn(
  "flex h-9 max-w-full min-w-0 items-center gap-2 rounded-lg border border-border/50 bg-background/80 px-1.5 py-1 pr-2 shadow-sm"
);

const shellInteractive = cn(
  shellBase,
  "transition-[box-shadow,border-color,background-color] hover:border-border hover:shadow-md hover:ring-black/[0.06] dark:hover:ring-white/[0.07]"
);

function OrgFace({
  name,
  subtitleLine,
  loading,
  showChevron,
}: {
  name: string;
  subtitleLine: string;
  loading: boolean;
  showChevron: boolean;
}) {
  return (
    <>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/[0.08] text-primary dark:bg-primary/12">
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <Building2 className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
        )}
      </span>
      <span className="min-w-0 flex-1 text-left leading-tight">
        <span className="block truncate text-[13px] font-semibold tracking-tight text-foreground">{name}</span>
        <span className="mt-0.5 block truncate text-[11px] font-normal text-muted-foreground">{subtitleLine}</span>
      </span>
      {showChevron ? (
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
      ) : null}
    </>
  );
}

export function OrganizationSwitcher(props?: {
  /** Quando definido (ex.: rota Marketing), substitui nome+subtítulo padrão e evita redundância com o AppBar. */
  contextFace?: { primary: string; secondary: string };
}) {
  const { contextFace } = props ?? {};
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const memberships = useAuthStore((s) => s.memberships);
  const managed = useAuthStore((s) => s.managedOrganizations);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [loading, setLoading] = useState(false);

  if (!user?.organizationId) return null;

  const isImpersonating = user.isImpersonating === true;
  const currentOrgId = user.organizationId;
  const options = collectOptions(currentOrgId, memberships, managed);
  const displayName = user.organization?.name ?? "Empresa";
  const canSwitch = !isImpersonating && options.length > 1;
  const facePrimary = contextFace?.primary ?? displayName;
  const faceSecondary = isImpersonating
    ? "Acesso como administrador"
    : (contextFace?.secondary ?? executiveGreetingLine(user));

  async function onSelect(organizationId: string) {
    if (organizationId === currentOrgId || loading || isImpersonating) return;
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

  if (!canSwitch) {
    return (
      <div
        className={cn(shellBase, "cursor-default")}
        title={displayName}
        role="status"
        aria-label={`Organização ativa: ${displayName}`}
      >
        <OrgFace name={facePrimary} subtitleLine={faceSecondary} loading={false} showChevron={false} />
      </div>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cn(
            shellInteractive,
            "w-full max-w-[min(100%,280px)] text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          )}
          disabled={loading}
          aria-label="Trocar organização"
        >
          <OrgFace name={facePrimary} subtitleLine={faceSecondary} loading={loading} showChevron={!loading} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 max-h-[min(70dvh,24rem)] min-w-[min(calc(100vw-2rem),300px)] overflow-y-auto rounded-xl border border-border/80 bg-popover p-1 shadow-[var(--shadow-surface)]"
          sideOffset={8}
          align="start"
          collisionPadding={12}
        >
          <div className="border-b border-border/60 px-2.5 py-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Trocar workspace</div>
            <p className="mt-1 text-[10px] leading-snug text-muted-foreground normal-case">
              Cada opção é um ambiente com dados e integrações próprios — distinto do cadastro comercial em Clientes.
            </p>
          </div>
          {options.map((opt) => (
            <DropdownMenu.Item
              key={opt.id}
              className={cn(
                "flex cursor-pointer flex-col gap-0.5 rounded-lg px-2 py-2 outline-none focus:bg-accent focus:text-accent-foreground",
                opt.id === currentOrgId && "bg-muted/50"
              )}
              onSelect={() => onSelect(opt.id)}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                {opt.id === currentOrgId ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                ) : (
                  <span className="w-3.5 shrink-0" aria-hidden />
                )}
                <span className="truncate">{opt.label}</span>
              </span>
              {opt.subtitle ? (
                <span className="pl-5 text-[11px] text-muted-foreground">{opt.subtitle}</span>
              ) : null}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
