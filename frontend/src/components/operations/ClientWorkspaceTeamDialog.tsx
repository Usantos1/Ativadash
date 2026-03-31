import { useCallback, useEffect, useState } from "react";
import { Loader2, Users2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  createWorkspaceMember,
  removeMember,
  type MemberRow,
  type InvitationRow,
} from "@/lib/workspace-api";
import { useAuthStore } from "@/stores/auth-store";
import { MemberDetailDialog } from "@/components/operations/member-detail-dialog";
import { membershipRoleLabelPt } from "@/lib/membership-role-labels";
import type { TeamJobTitleValue } from "@/lib/team-access-ui";

const INVITE_ROLES = ["admin", "member", "media_manager", "analyst"] as const;

type AccessLevelUi = "ADMIN" | "OPERADOR" | "VIEWER";

function legacyInviteRoleToJobAndAccess(role: (typeof INVITE_ROLES)[number]): {
  jobTitle: TeamJobTitleValue;
  accessLevel: AccessLevelUi;
} {
  if (role === "admin") return { jobTitle: "traffic_manager", accessLevel: "ADMIN" };
  if (role === "media_manager") return { jobTitle: "media_manager", accessLevel: "OPERADOR" };
  return { jobTitle: "traffic_manager", accessLevel: "OPERADOR" };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workspaceName: string;
};

function formatMemberDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

export function ClientWorkspaceTeamDialog({ open, onOpenChange, workspaceId, workspaceName }: Props) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<(typeof INVITE_ROLES)[number]>("member");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPassword2, setRegPassword2] = useState("");
  const [regRole, setRegRole] = useState<(typeof INVITE_ROLES)[number]>("member");
  const [regBusy, setRegBusy] = useState(false);
  const [detailMember, setDetailMember] = useState<MemberRow | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [m, inv] = await Promise.all([
        fetchMembers(workspaceId),
        fetchPendingInvitations(workspaceId),
      ]);
      setMembers(m);
      setInvites(inv);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar equipe");
      setMembers([]);
      setInvites([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!open) return;
    setInviteLink(null);
    setInviteEmail("");
    setInviteRole("member");
    setRegName("");
    setRegEmail("");
    setRegPassword("");
    setRegPassword2("");
    setRegRole("member");
    setDetailMember(null);
    void load();
  }, [open, load]);

  async function submitInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteLink(null);
    setError(null);
    if (!inviteEmail.trim()) return;
    setInviteBusy(true);
    try {
      const r = await createInvitation({
        email: inviteEmail.trim(),
        role: inviteRole,
        organizationId: workspaceId,
      });
      setInviteLink(r.inviteLink);
      setInviteEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao convidar");
    } finally {
      setInviteBusy(false);
    }
  }

  async function onRevokeInvite(id: string) {
    setError(null);
    setActionBusy(`inv-${id}`);
    try {
      await revokeInvitation(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao revogar");
    } finally {
      setActionBusy(null);
    }
  }

  async function onChangeRole(userId: string, role: string) {
    setError(null);
    setActionBusy(`role-${userId}`);
    try {
      await patchMemberRole(userId, role, workspaceId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao alterar papel");
    } finally {
      setActionBusy(null);
    }
  }

  async function submitRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (regPassword.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (regPassword !== regPassword2) {
      setError("Confirmação da senha não confere.");
      return;
    }
    setRegBusy(true);
    try {
      const { jobTitle, accessLevel } = legacyInviteRoleToJobAndAccess(regRole);
      await createWorkspaceMember(
        {
          email: regEmail.trim(),
          name: regName.trim(),
          password: regPassword,
          jobTitle,
          accessLevel,
        },
        workspaceId
      );
      setRegName("");
      setRegEmail("");
      setRegPassword("");
      setRegPassword2("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao cadastrar");
    } finally {
      setRegBusy(false);
    }
  }

  async function onRemove(userId: string) {
    setError(null);
    setActionBusy(`rm-${userId}`);
    try {
      await removeMember(userId, workspaceId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao remover");
    } finally {
      setActionBusy(null);
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={`Equipe · ${workspaceName}`}
        showClose
        className="flex max-h-[min(90dvh,720px)] w-[min(100vw-1rem,32rem)] max-w-lg flex-col overflow-hidden"
      >
        <p className="text-xs text-muted-foreground">
          Usuários vinculados a este cliente. Quem entra pela agência aparece como &quot;via agência&quot; — papel da
          própria agência, não editável aqui.
        </p>

        {error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
            {error}
          </p>
        ) : null}

        <form
          onSubmit={submitRegister}
          className="flex flex-col gap-2 rounded-lg border border-border/50 bg-muted/15 p-3"
        >
          <Label className="text-xs font-semibold">Cadastrar com senha</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              placeholder="Nome"
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
              className="h-9 rounded-lg"
              required
            />
            <Input
              type="email"
              placeholder="E-mail"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              className="h-9 rounded-lg"
              required
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Input
              type="password"
              placeholder="Senha (mín. 8)"
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              className="h-9 flex-1 rounded-lg"
              autoComplete="new-password"
              required
              minLength={8}
            />
            <Input
              type="password"
              placeholder="Confirmar"
              value={regPassword2}
              onChange={(e) => setRegPassword2(e.target.value)}
              className="h-9 flex-1 rounded-lg"
              autoComplete="new-password"
              required
              minLength={8}
            />
            <Select value={regRole} onValueChange={(v) => setRegRole(v as (typeof INVITE_ROLES)[number])}>
              <SelectTrigger className="h-9 w-full rounded-lg sm:w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVITE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {membershipRoleLabelPt(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" size="sm" className="h-9 shrink-0" disabled={regBusy}>
              {regBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cadastrar"}
            </Button>
          </div>
        </form>

        <form onSubmit={submitInvite} className="flex flex-col gap-2 rounded-lg border border-border/50 bg-muted/20 p-3">
          <Label className="text-xs font-semibold">Novo convite (e-mail)</Label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Input
              type="email"
              placeholder="email@empresa.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="h-9 flex-1 rounded-lg"
            />
            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as (typeof INVITE_ROLES)[number])}>
              <SelectTrigger className="h-9 w-full rounded-lg sm:w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVITE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {membershipRoleLabelPt(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" size="sm" className="h-9 shrink-0" disabled={inviteBusy || !inviteEmail.trim()}>
              {inviteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Convidar"}
            </Button>
          </div>
          {inviteLink ? (
            <p className="break-all text-[11px] text-muted-foreground">
              Link: <span className="font-mono text-foreground">{inviteLink}</span>
            </p>
          ) : null}
        </form>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando…
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {invites.length > 0 ? (
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    Convites pendentes
                  </p>
                  <ul className="space-y-1.5 text-sm">
                    {invites.map((inv) => (
                      <li
                        key={inv.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/40 px-2 py-1.5"
                      >
                        <span className="truncate">{inv.email}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{membershipRoleLabelPt(inv.role)}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={actionBusy === `inv-${inv.id}`}
                            onClick={() => void onRevokeInvite(inv.id)}
                          >
                            Revogar
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  <Users2 className="h-3.5 w-3.5" aria-hidden />
                  Membros ({members.length})
                </p>
                {members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum membro direto ainda.</p>
                ) : (
                  <ul className="space-y-2">
                    {members.map((m) => {
                      const direct = m.source !== "agency";
                      const busy =
                        actionBusy === `role-${m.userId}` || actionBusy === `rm-${m.userId}`;
                      return (
                        <li
                          key={`${m.userId}-${m.membershipId}`}
                          className="rounded-md border border-border/40 px-2 py-2 text-sm"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="truncate font-medium">{m.name || m.email}</p>
                              <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                              {m.source === "agency" ? (
                                <p className="mt-0.5 text-[10px] text-muted-foreground">Acesso via agência (somente leitura)</p>
                              ) : null}
                              {m.suspended ? (
                                <p className="mt-0.5 text-[10px] font-medium text-destructive">Bloqueado</p>
                              ) : null}
                            </div>
                            {direct ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  Papel: <span className="font-medium text-foreground">{membershipRoleLabelPt(m.role)}</span>
                                </span>
                                {m.role !== "owner" && m.role !== "workspace_owner" ? (
                                  <Select
                                    onValueChange={(v) => void onChangeRole(m.userId, v)}
                                    disabled={busy}
                                  >
                                    <SelectTrigger className="h-8 w-[148px] text-xs">
                                      <SelectValue placeholder="Alterar para…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {INVITE_ROLES.map((r) => (
                                        <SelectItem key={r} value={r}>
                                          {membershipRoleLabelPt(r)}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : null}
                                {currentUserId && m.userId !== currentUserId ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs"
                                    disabled={busy}
                                    onClick={() => setDetailMember(m)}
                                  >
                                    Gerenciar
                                  </Button>
                                ) : null}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-xs text-destructive hover:text-destructive"
                                  disabled={
                                    busy ||
                                    m.userId === currentUserId ||
                                    m.role === "owner" ||
                                    m.role === "workspace_owner" ||
                                    m.role === "agency_owner"
                                  }
                                  onClick={() => void onRemove(m.userId)}
                                >
                                  Remover
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">{membershipRoleLabelPt(m.role)}</span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" className="rounded-lg" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <MemberDetailDialog
      open={!!detailMember}
      onOpenChange={(v) => {
        if (!v) setDetailMember(null);
      }}
      member={detailMember}
      linkedClientsCount={null}
      formatDate={formatMemberDate}
      currentUserId={currentUserId}
      organizationId={workspaceId}
      onMemberUpdated={() => load()}
    />
    </>
  );
}
