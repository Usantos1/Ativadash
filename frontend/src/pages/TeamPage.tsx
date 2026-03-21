import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollRegion } from "@/components/ui/scroll-region";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchMembers,
  fetchPendingInvitations,
  createInvitation,
  revokeInvitation,
  patchMemberRole,
  removeMember,
  type MemberRow,
  type InvitationRow,
} from "@/lib/workspace-api";
import { fetchOrganizationContext, formatPlanCap, type OrganizationContext } from "@/lib/organization-api";
import { useAuthStore } from "@/stores/auth-store";

const roleLabel: Record<string, string> = {
  owner: "Proprietário",
  member: "Membro",
  admin: "Administrador",
  media_manager: "Gestor de mídia",
  analyst: "Analista",
};

export function TeamPage() {
  const orgName = useAuthStore((s) => s.user?.organization?.name);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InvitationRow[]>([]);
  const [orgCtx, setOrgCtx] = useState<OrganizationContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "media_manager" | "analyst">("member");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [list, ctx, pend] = await Promise.all([
        fetchMembers(),
        fetchOrganizationContext(),
        fetchPendingInvitations().catch(() => [] as InvitationRow[]),
      ]);
      setRows(list);
      setOrgCtx(ctx);
      setInvites(pend);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const directCount = rows.filter((r) => r.source === "direct").length;
  const pendingCount = invites.length;
  const maxUsersLabel = orgCtx ? formatPlanCap(orgCtx.limits.maxUsers) : "—";
  const planNote =
    orgCtx?.planSource === "parent"
      ? " Limites do plano são os da empresa matriz (herdados)."
      : "";

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
    <div className="min-w-0 max-w-full space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Equipe</h1>
        <p className="text-sm text-muted-foreground">
          Pessoas com <strong className="font-medium text-foreground">login</strong> que acessam{" "}
          <strong className="font-medium text-foreground">{orgName ?? "esta empresa"}</strong>.{" "}
          <Link
            to="/configuracoes#como-funciona-conta"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Ver diferenças com Clientes
          </Link>
          .
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {actionMsg && <p className="text-sm text-destructive">{actionMsg}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Convidar por e-mail</CardTitle>
          <CardDescription>
            Gera um link de cadastro. Limite do plano: membros diretos + convites pendentes (máx. {maxUsersLabel}).
            {planNote}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-[200px] flex-1 space-y-1.5">
              <Label htmlFor="invite-email">E-mail</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(ev) => setInviteEmail(ev.target.value)}
                placeholder="colega@empresa.com"
                required
              />
            </div>
            <div className="w-full space-y-1.5 sm:w-44">
              <Label htmlFor="invite-role">Papel</Label>
              <select
                id="invite-role"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={inviteRole}
                onChange={(ev) => setInviteRole(ev.target.value as typeof inviteRole)}
              >
                <option value="member">Membro</option>
                <option value="analyst">Analista</option>
                <option value="media_manager">Gestor de mídia</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <Button type="submit" disabled={inviteBusy}>
              {inviteBusy ? "Enviando…" : "Gerar convite"}
            </Button>
          </form>
          {inviteLink && (
            <p className="mt-3 break-all text-sm text-muted-foreground">
              Link do convidado (encaminhe por WhatsApp/e-mail):{" "}
              <span className="font-mono text-foreground">{inviteLink}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {invites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Convites pendentes</CardTitle>
            <CardDescription>{pendingCount} aguardando aceite</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {invites.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2"
              >
                <div>
                  <span className="font-medium">{inv.email}</span>{" "}
                  <span className="text-muted-foreground">({roleLabel[inv.role] ?? inv.role})</span>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => handleRevokeInvite(inv.id)}>
                  Revogar
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="min-w-0 max-w-full overflow-hidden">
        <CardHeader>
          <CardTitle>Membros com acesso</CardTitle>
          <CardDescription>
            {loading
              ? "Carregando…"
              : orgCtx
                ? `${directCount} / ${maxUsersLabel} usuário(s) diretos nesta empresa + ${pendingCount} convite(s) pendente(s). Lista: ${rows.length} linha(s) (inclui acesso pela agência).`
                : `${rows.length} pessoa(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum membro listado.</p>
          ) : (
            <ScrollRegion className="scrollbar-thin">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Nome</th>
                    <th className="pb-2 pr-4 font-medium">E-mail</th>
                    <th className="pb-2 pr-4 font-medium">Papel</th>
                    <th className="pb-2 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.membershipId} className="border-b border-border/60">
                      <td className="py-3 pr-4 font-medium">{row.name}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{row.email}</td>
                      <td className="py-3 pr-4">
                        <span className="block">{roleLabel[row.role] ?? row.role}</span>
                        {row.source === "agency" && (
                          <span className="text-xs text-muted-foreground">Acesso pela agência (revenda)</span>
                        )}
                      </td>
                      <td className="py-3">
                        {row.source === "direct" &&
                          row.userId !== currentUserId &&
                          row.role !== "owner" && (
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                className="h-8 rounded border border-input bg-background px-2 text-xs"
                                value={row.role}
                                onChange={(ev) => handleRoleChange(row.userId, ev.target.value)}
                              >
                                <option value="member">Membro</option>
                                <option value="analyst">Analista</option>
                                <option value="media_manager">Gestor de mídia</option>
                                <option value="admin">Administrador</option>
                              </select>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 text-destructive hover:text-destructive"
                                onClick={() => handleRemove(row.userId)}
                              >
                                Remover
                              </Button>
                            </div>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollRegion>
          )}
          <p className="mt-4 break-words text-xs text-muted-foreground">
            Já tem conta? Peça um convite e, após entrar, use <strong className="text-foreground">Aceitar convite</strong>{" "}
            em Perfil se receber outro link.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
