import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Loader2, Mail, Users2 } from "lucide-react";
import { ScrollRegion } from "@/components/ui/scroll-region";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderPremium, KpiCardPremium, StatusBadge } from "@/components/premium";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchMembers,
  fetchPendingInvitations,
  createInvitation,
  revokeInvitation,
  patchMemberRole,
  removeMember,
  fetchClients,
  type MemberRow,
  type InvitationRow,
} from "@/lib/workspace-api";
import { fetchOrganizationContext, formatPlanCap, type OrganizationContext } from "@/lib/organization-api";
import { useAuthStore } from "@/stores/auth-store";
import { OperationsModuleNav } from "@/components/operations/operations-module-nav";
import { MemberDetailDialog } from "@/components/operations/member-detail-dialog";

const roleLabel: Record<string, string> = {
  owner: "Proprietário",
  member: "Membro",
  admin: "Administrador",
  media_manager: "Gestor de mídia",
  analyst: "Analista",
};

function formatMemberDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

export function TeamPage() {
  const orgName = useAuthStore((s) => s.user?.organization?.name);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InvitationRow[]>([]);
  const [orgCtx, setOrgCtx] = useState<OrganizationContext | null>(null);
  const [clientAccountsCount, setClientAccountsCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "media_manager" | "analyst">("member");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [detailMember, setDetailMember] = useState<MemberRow | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [list, ctx, pend, clients] = await Promise.all([
        fetchMembers(),
        fetchOrganizationContext(),
        fetchPendingInvitations().catch(() => [] as InvitationRow[]),
        fetchClients().catch(() => []),
      ]);
      setRows(list);
      setOrgCtx(ctx);
      setInvites(pend);
      setClientAccountsCount(Array.isArray(clients) ? clients.length : 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const directCount = rows.filter((r) => r.source === "direct").length;
  const pendingCount = invites.length;
  const maxUsersLabel = orgCtx ? formatPlanCap(orgCtx.limits.maxUsers) : "—";
  const planNote =
    orgCtx?.planSource === "parent" ? " Limites herdados da organização matriz." : "";

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteLink(null);
    setActionMsg(null);
    setInviteBusy(true);
    try {
      const out = await createInvitation(inviteEmail.trim(), inviteRole);
      setInviteLink(out.inviteLink);
      setInviteEmail("");
      await load();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : "Erro ao convidar");
    } finally {
      setInviteBusy(false);
    }
  }

  async function handleRevokeInvite(id: string) {
    setActionMsg(null);
    try {
      await revokeInvitation(id);
      await load();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : "Erro");
    }
  }

  async function handleRoleChange(userId: string, role: string) {
    setActionMsg(null);
    try {
      await patchMemberRole(userId, role);
      await load();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : "Erro");
    }
  }

  async function handleRemove(userId: string) {
    if (!window.confirm("Remover este membro desta empresa?")) return;
    setActionMsg(null);
    try {
      await removeMember(userId);
      await load();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : "Erro");
    }
  }

  return (
    <div className="min-w-0 max-w-full space-y-6 pb-12">
      <PageHeaderPremium
        eyebrow="Operação"
        title="Equipe"
        subtitle="Membros da agência, convites e papéis na organização ativa. Acesso por cliente é feito via workspace em Contas."
        meta={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <OperationsModuleNav />
            <Link
              to="/clientes"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary underline-offset-4 hover:underline"
            >
              <Building2 className="h-3.5 w-3.5" />
              Ver contas da agência
            </Link>
          </div>
        }
      />

      {error ? (
        <div className="rounded-xl border border-destructive/35 bg-destructive/[0.08] px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {actionMsg ? (
        <div className="rounded-xl border border-destructive/35 bg-destructive/[0.08] px-4 py-3 text-sm text-destructive">
          {actionMsg}
        </div>
      ) : null}

      {!loading && orgCtx && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCardPremium
            variant="primary"
            label="Membros ativos"
            value={String(rows.length)}
            hideSource
            icon={Users2}
            hint={`Organização: ${orgName ?? "—"}`}
          />
          <KpiCardPremium
            variant="secondary"
            label="Acesso direto"
            value={String(directCount)}
            hideSource
            icon={Users2}
          />
          <KpiCardPremium variant="secondary" label="Convites pendentes" value={String(pendingCount)} hideSource icon={Mail} />
          <KpiCardPremium
            variant="secondary"
            label="Limite do plano"
            value={maxUsersLabel}
            hideSource
            hint={`Usuários diretos + pendentes ≤ ${maxUsersLabel}.${planNote}`}
            icon={Users2}
          />
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card/40 shadow-[var(--shadow-surface-sm)]">
        <div className="border-b border-border/45 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-bold tracking-tight text-foreground">Convidar membro</h2>
          <p className="text-xs text-muted-foreground">Link único · compartilhe pelo canal que preferir.</p>
        </div>
        <form onSubmit={handleInvite} className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-end sm:p-5">
          <div className="min-w-[200px] flex-1 space-y-1.5">
            <Label htmlFor="invite-email" className="text-xs font-semibold">
              E-mail
            </Label>
            <Input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(ev) => setInviteEmail(ev.target.value)}
              placeholder="colega@empresa.com"
              required
              className="h-10 rounded-xl border-border/60"
            />
          </div>
          <div className="w-full space-y-1.5 sm:w-48">
            <Label className="text-xs font-semibold">Papel global</Label>
            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as typeof inviteRole)}>
              <SelectTrigger className="h-10 rounded-xl border-border/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Membro</SelectItem>
                <SelectItem value="analyst">Analista</SelectItem>
                <SelectItem value="media_manager">Gestor de mídia</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={inviteBusy} className="h-10 shrink-0 rounded-xl sm:min-w-[140px]">
            {inviteBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
            Gerar convite
          </Button>
        </form>
        {inviteLink ? (
          <div className="border-t border-border/40 bg-muted/10 px-4 py-3 sm:px-5">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">Link pronto</p>
            <p className="mt-1 break-all font-mono text-xs text-foreground">{inviteLink}</p>
          </div>
        ) : null}
      </div>

      {invites.length > 0 && (
        <div className="rounded-2xl border border-border/50 bg-card/30 px-4 py-3 sm:px-5">
          <p className="text-sm font-bold text-foreground">Aguardando aceite ({pendingCount})</p>
          <ul className="mt-2 space-y-2">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/45 bg-muted/10 px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-semibold">{inv.email}</span>{" "}
                  <span className="text-muted-foreground">({roleLabel[inv.role] ?? inv.role})</span>
                </span>
                <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg" onClick={() => handleRevokeInvite(inv.id)}>
                  Revogar
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-black tracking-tight text-foreground">Membros</h2>
            <p className="text-xs text-muted-foreground">
              Contas comerciais cadastradas nesta org:{" "}
              <strong className="text-foreground">{clientAccountsCount ?? "—"}</strong> · vínculo fino por workspace em{" "}
              <Link to="/clientes" className="font-medium text-primary underline-offset-2 hover:underline">
                Clientes
              </Link>
              .
            </p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum membro listado.</p>
        ) : (
          <ScrollRegion className="scrollbar-thin">
            <ul className="grid gap-3">
              {rows.map((row) => (
                <li
                  key={row.membershipId}
                  className="flex flex-col gap-3 rounded-2xl border border-border/50 bg-card/40 p-4 shadow-[var(--shadow-surface-sm)] sm:flex-row sm:items-center sm:justify-between"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setDetailMember(row)}
                  >
                    <p className="font-bold text-foreground">{row.name}</p>
                    <p className="text-sm text-muted-foreground">{row.email}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusBadge tone={row.source === "agency" ? "alert" : "healthy"} dot>
                        {roleLabel[row.role] ?? row.role}
                      </StatusBadge>
                      <span className="text-xs text-muted-foreground">
                        Clientes (contas na org): <strong className="text-foreground">{clientAccountsCount ?? "—"}</strong>
                      </span>
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button type="button" variant="secondary" size="sm" className="rounded-xl" onClick={() => setDetailMember(row)}>
                      Ver detalhes
                    </Button>
                    {row.source === "direct" && row.userId !== currentUserId && row.role !== "owner" ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Select value={row.role} onValueChange={(v) => handleRoleChange(row.userId, v)}>
                          <SelectTrigger className="h-9 w-[140px] rounded-xl text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Membro</SelectItem>
                            <SelectItem value="analyst">Analista</SelectItem>
                            <SelectItem value="media_manager">Gestor de mídia</SelectItem>
                            <SelectItem value="admin">Administrador</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-9 rounded-xl text-destructive hover:text-destructive"
                          onClick={() => handleRemove(row.userId)}
                        >
                          Remover
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </ScrollRegion>
        )}
      </div>

      <MemberDetailDialog
        open={!!detailMember}
        onOpenChange={(v) => {
          if (!v) setDetailMember(null);
        }}
        member={detailMember}
        linkedClientsCount={clientAccountsCount}
        formatDate={formatMemberDate}
      />
    </div>
  );
}
