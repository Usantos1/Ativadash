import { useCallback, useEffect, useState } from "react";
import { Loader2, MailPlus, Pencil, KeyRound, UserPlus, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchResellerEcosystemOrganizations,
  fetchResellerEcosystemUsers,
  patchResellerEcosystemUser,
  postResellerUserPassword,
  postResellerMembershipRole,
  postResellerRemoveMember,
  resellerCreateEcosystemUser,
  resellerCreateInvitation,
  type EcosystemUserRow,
} from "@/lib/revenda-api";

const ROLES = ["owner", "admin", "member", "media_manager", "analyst"] as const;
const INVITE_ROLES = ["admin", "member", "media_manager", "analyst"] as const;

/** Rótulos em português do Brasil (valores da API permanecem em inglês). */
const ROLE_LABEL_PT: Record<(typeof ROLES)[number], string> = {
  owner: "Proprietário",
  admin: "Administrador",
  member: "Membro",
  media_manager: "Gestor de mídia",
  analyst: "Analista",
};

function roleLabelPt(role: string): string {
  return ROLE_LABEL_PT[role as (typeof ROLES)[number]] ?? role;
}

export function RevendaUsersPage() {
  const [users, setUsers] = useState<EcosystemUserRow[]>([]);
  const [orgs, setOrgs] = useState<{ id: string; name: string; isMatrix: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOrgId, setFilterOrgId] = useState<string>("all");
  const [filterOrgKind, setFilterOrgKind] = useState<"all" | "AGENCY" | "CLIENT">("all");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterSuspended, setFilterSuspended] = useState<"all" | "true" | "false">("all");
  const [q, setQ] = useState("");

  const [editRow, setEditRow] = useState<EcosystemUserRow | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editName, setEditName] = useState("");
  const [editSuspended, setEditSuspended] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [pwdRow, setPwdRow] = useState<EcosystemUserRow | null>(null);
  const [pwdNew, setPwdNew] = useState("");
  const [pwdForceChange, setPwdForceChange] = useState(true);
  const [pwdSubmitting, setPwdSubmitting] = useState(false);

  const [roleRow, setRoleRow] = useState<EcosystemUserRow | null>(null);
  const [roleValue, setRoleValue] = useState<string>("member");
  const [roleSubmitting, setRoleSubmitting] = useState(false);

  const [removeRow, setRemoveRow] = useState<EcosystemUserRow | null>(null);
  const [removeSubmitting, setRemoveSubmitting] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createName, setCreateName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createOrgId, setCreateOrgId] = useState("");
  const [createRole, setCreateRole] = useState<(typeof ROLES)[number]>("member");
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteOrgId, setInviteOrgId] = useState("");
  const [inviteRole, setInviteRole] = useState<(typeof INVITE_ROLES)[number]>("member");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);

  const loadOrgs = useCallback(async () => {
    try {
      const r = await fetchResellerEcosystemOrganizations();
      setOrgs(r.organizations.map((o) => ({ id: o.id, name: o.name, isMatrix: o.isMatrix })));
    } catch {
      setOrgs([]);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchResellerEcosystemUsers({
        organizationId: filterOrgId === "all" ? undefined : filterOrgId,
        resellerOrgKind: filterOrgKind === "all" ? undefined : filterOrgKind,
        suspended: filterSuspended === "all" ? undefined : filterSuspended,
        role: filterRole === "all" ? undefined : filterRole,
        q: q.trim() || undefined,
      });
      setUsers(res.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar usuários.");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [filterOrgId, filterOrgKind, filterRole, filterSuspended, q]);

  useEffect(() => {
    void loadOrgs();
  }, [loadOrgs]);

  useEffect(() => {
    const delay = q.trim() ? 320 : 0;
    const t = window.setTimeout(() => void load(), delay);
    return () => window.clearTimeout(t);
  }, [q, filterOrgId, filterOrgKind, filterRole, filterSuspended, load]);

  async function saveUser() {
    if (!editRow) return;
    setEditSubmitting(true);
    setActionError(null);
    try {
      await patchResellerEcosystemUser(editRow.user.id, {
        email: editEmail.trim(),
        name: editName.trim(),
        suspended: editSuspended,
      });
      setEditRow(null);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Falha ao salvar usuário.");
    } finally {
      setEditSubmitting(false);
    }
  }

  async function savePassword() {
    if (!pwdRow || pwdNew.length < 8) return;
    setPwdSubmitting(true);
    setActionError(null);
    try {
      await postResellerUserPassword(pwdRow.user.id, pwdNew, { forcePasswordChange: pwdForceChange });
      setPwdRow(null);
      setPwdNew("");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Falha ao redefinir senha.");
    } finally {
      setPwdSubmitting(false);
    }
  }

  async function saveRole() {
    if (!roleRow) return;
    setRoleSubmitting(true);
    setActionError(null);
    try {
      await postResellerMembershipRole({
        organizationId: roleRow.organization.id,
        targetUserId: roleRow.user.id,
        role: roleValue,
      });
      setRoleRow(null);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Falha ao alterar papel.");
    } finally {
      setRoleSubmitting(false);
    }
  }

  async function confirmRemove() {
    if (!removeRow) return;
    setRemoveSubmitting(true);
    setActionError(null);
    try {
      await postResellerRemoveMember({
        organizationId: removeRow.organization.id,
        targetUserId: removeRow.user.id,
      });
      setRemoveRow(null);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Falha ao remover vínculo.");
    } finally {
      setRemoveSubmitting(false);
    }
  }

  async function submitCreate() {
    if (!createEmail.trim() || !createName.trim() || createPassword.length < 8 || !createOrgId) return;
    setCreateSubmitting(true);
    setActionError(null);
    try {
      await resellerCreateEcosystemUser({
        email: createEmail.trim(),
        name: createName.trim(),
        password: createPassword,
        organizationId: createOrgId,
        role: createRole,
      });
      setCreateOpen(false);
      setCreateEmail("");
      setCreateName("");
      setCreatePassword("");
      setCreateOrgId("");
      setCreateRole("member");
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Falha ao criar usuário.");
    } finally {
      setCreateSubmitting(false);
    }
  }

  async function submitInvite() {
    if (!inviteEmail.trim() || !inviteOrgId) return;
    setInviteSubmitting(true);
    setActionError(null);
    setInviteLink(null);
    try {
      const r = await resellerCreateInvitation({
        organizationId: inviteOrgId,
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setInviteLink(r.inviteLink);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Falha ao criar convite.");
    } finally {
      setInviteSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Usuários do ecossistema</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Membros da matriz e de todas as empresas filhas. Criação com senha, convite por e-mail, edição de conta,
            redefinição de senha e remoção de vínculo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" className="gap-2" onClick={() => setInviteOpen(true)}>
            <MailPlus className="h-4 w-4" />
            Convidar
          </Button>
          <Button type="button" className="gap-2" onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Novo usuário
          </Button>
        </div>
      </div>

      {actionError ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>Empresa, tipo, papel, suspensão e busca.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Select value={filterOrgId} onValueChange={setFilterOrgId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as empresas</SelectItem>
              {orgs.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                  {o.isMatrix ? " (matriz)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterOrgKind} onValueChange={(v) => setFilterOrgKind(v as typeof filterOrgKind)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tipo</SelectItem>
              <SelectItem value="AGENCY">Agência</SelectItem>
              <SelectItem value="CLIENT">Cliente</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Papel</SelectItem>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABEL_PT[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filterSuspended}
            onValueChange={(v) => setFilterSuspended(v as "all" | "true" | "false")}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Suspensão</SelectItem>
              <SelectItem value="false">Ativos</SelectItem>
              <SelectItem value="true">Suspensos</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Buscar…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-xs"
          />
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
            Atualizar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Listagem</CardTitle>
          <CardDescription>{users.length} vínculo(s) (usuário × empresa).</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando…
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-semibold uppercase text-muted-foreground">
                    <th className="py-2 pr-3">Usuário</th>
                    <th className="py-2 pr-3">Empresa</th>
                    <th className="py-2 pr-3">Papel</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((row) => (
                    <tr key={row.membershipId} className="border-b border-border/50">
                      <td className="py-3 pr-3">
                        <p className="font-medium">{row.user.name}</p>
                        <p className="text-xs text-muted-foreground">{row.user.email}</p>
                      </td>
                      <td className="py-3 pr-3">
                        {row.organization.name}
                        {row.organization.isMatrix ? (
                          <span className="ml-1 text-[10px] font-semibold uppercase text-primary">matriz</span>
                        ) : null}
                      </td>
                      <td className="py-3 pr-3 text-sm">{roleLabelPt(row.role)}</td>
                      <td className="py-3 pr-3">
                        {row.user.suspended ? (
                          <span className="text-amber-700 dark:text-amber-400">Suspenso</span>
                        ) : (
                          "Ativo"
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => {
                              setEditRow(row);
                              setEditEmail(row.user.email);
                              setEditName(row.user.name);
                              setEditSuspended(row.user.suspended);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Conta
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => {
                              setPwdRow(row);
                              setPwdNew("");
                              setPwdForceChange(true);
                            }}
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            Senha
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setRoleRow(row);
                              setRoleValue(row.role);
                            }}
                          >
                            Papel
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setRemoveRow(row)}
                          >
                            <UserMinus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md" title="Novo usuário">
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} type="email" />
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={createName} onChange={(e) => setCreateName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Senha inicial (mín. 8)</Label>
              <Input
                type="password"
                autoComplete="new-password"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select value={createOrgId} onValueChange={setCreateOrgId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select value={createRole} onValueChange={(v) => setCreateRole(v as (typeof ROLES)[number])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL_PT[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={
                createSubmitting ||
                !createEmail.trim() ||
                !createName.trim() ||
                createPassword.length < 8 ||
                !createOrgId
              }
              onClick={() => void submitCreate()}
            >
              {createSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md" title="Convidar por e-mail">
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} type="email" />
            </div>
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select value={inviteOrgId} onValueChange={setInviteOrgId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as (typeof INVITE_ROLES)[number])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVITE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL_PT[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {inviteLink ? (
              <p className="break-all rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
                Link gerado: <span className="text-foreground">{inviteLink}</span>
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
              Fechar
            </Button>
            <Button
              type="button"
              disabled={inviteSubmitting || !inviteEmail.trim() || !inviteOrgId}
              onClick={() => void submitInvite()}
            >
              {inviteSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gerar convite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent title="Editar usuário">
          {editRow ? (
            <>
              <div className="space-y-3 py-2">
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} type="email" />
                </div>
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="sus"
                    type="checkbox"
                    checked={editSuspended}
                    onChange={(e) => setEditSuspended(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <Label htmlFor="sus">Suspenso (bloqueia login)</Label>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditRow(null)}>
                  Cancelar
                </Button>
                <Button type="button" disabled={editSubmitting} onClick={() => void saveUser()}>
                  {editSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!pwdRow} onOpenChange={(o) => !o && setPwdRow(null)}>
        <DialogContent title="Redefinir senha">
          {pwdRow ? (
            <>
              <p className="text-sm text-muted-foreground">
                Nova senha para <span className="font-medium text-foreground">{pwdRow.user.email}</span>.
              </p>
              <div className="space-y-2 py-2">
                <Label>Nova senha (mín. 8 caracteres)</Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={pwdNew}
                  onChange={(e) => setPwdNew(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <Label className="cursor-pointer">Forçar troca no próximo login</Label>
                <Switch checked={pwdForceChange} onCheckedChange={setPwdForceChange} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPwdRow(null)}>
                  Cancelar
                </Button>
                <Button type="button" disabled={pwdSubmitting || pwdNew.length < 8} onClick={() => void savePassword()}>
                  {pwdSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!roleRow} onOpenChange={(o) => !o && setRoleRow(null)}>
        <DialogContent title="Papel na empresa">
          {roleRow ? (
            <>
              <p className="text-sm text-muted-foreground">
                {roleRow.organization.name} · {roleRow.user.email}
              </p>
              <div className="space-y-2 py-2">
                <Label>Papel</Label>
                <Select value={roleValue} onValueChange={setRoleValue}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABEL_PT[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRoleRow(null)}>
                  Cancelar
                </Button>
                <Button type="button" disabled={roleSubmitting} onClick={() => void saveRole()}>
                  {roleSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!removeRow} onOpenChange={(o) => !o && setRemoveRow(null)}>
        <DialogContent title="Remover vínculo">
          {removeRow ? (
            <>
              <p className="text-sm text-muted-foreground">
                Remover <span className="font-medium text-foreground">{removeRow.user.email}</span> de{" "}
                <span className="font-medium text-foreground">{removeRow.organization.name}</span>? O usuário continua
                existindo se tiver outros vínculos.
              </p>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRemoveRow(null)}>
                  Cancelar
                </Button>
                <Button type="button" variant="destructive" disabled={removeSubmitting} onClick={() => void confirmRemove()}>
                  {removeSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remover"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
