import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
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
  fetchResellerEcosystemUsers,
  patchResellerEcosystemUser,
  postResellerUserPassword,
  postResellerMembershipRole,
  type EcosystemUserRow,
} from "@/lib/revenda-api";

const ROLES = ["owner", "admin", "member", "media_manager", "analyst"] as const;

export function RevendaUsersPage() {
  const [users, setUsers] = useState<EcosystemUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterSuspended, setFilterSuspended] = useState<"all" | "true" | "false">("all");
  const [q, setQ] = useState("");

  const [editRow, setEditRow] = useState<EcosystemUserRow | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editName, setEditName] = useState("");
  const [editSuspended, setEditSuspended] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [pwdRow, setPwdRow] = useState<EcosystemUserRow | null>(null);
  const [pwdNew, setPwdNew] = useState("");
  const [pwdSubmitting, setPwdSubmitting] = useState(false);

  const [roleRow, setRoleRow] = useState<EcosystemUserRow | null>(null);
  const [roleValue, setRoleValue] = useState<string>("member");
  const [roleSubmitting, setRoleSubmitting] = useState(false);

  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchResellerEcosystemUsers({
        suspended: filterSuspended === "all" ? undefined : filterSuspended,
        q: q.trim() || undefined,
      });
      setUsers(res.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar usuários.");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [filterSuspended, q]);

  useEffect(() => {
    const delay = q.trim() ? 320 : 0;
    const t = window.setTimeout(() => void load(), delay);
    return () => window.clearTimeout(t);
  }, [q, filterSuspended, load]);

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
      await postResellerUserPassword(pwdRow.user.id, pwdNew);
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Usuários do ecossistema</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Membros da matriz e de todas as empresas filhas. Edição de e-mail, suspensão e redefinição de senha com trilha no
          servidor.
        </p>
      </div>

      {actionError ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>Busca por nome ou e-mail; status de suspensão administrativa.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Input
            placeholder="Buscar…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-xs"
          />
          <Select
            value={filterSuspended}
            onValueChange={(v) => setFilterSuspended(v as "all" | "true" | "false")}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="false">Ativos</SelectItem>
              <SelectItem value="true">Suspensos</SelectItem>
            </SelectContent>
          </Select>
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
              <table className="w-full min-w-[880px] border-collapse text-sm">
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
                      <td className="py-3 pr-3 font-mono text-xs">{row.role}</td>
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
                Nova senha para <span className="font-medium text-foreground">{pwdRow.user.email}</span>. Sessões existentes
                serão encerradas.
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
                        {r}
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
    </div>
  );
}
