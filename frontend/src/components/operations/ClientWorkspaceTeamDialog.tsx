import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RotateCcw, Trash2, Users2 } from "lucide-react";
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
import { fetchMembers, removeMember, type MemberRow } from "@/lib/workspace-api";
import {
  assignChildWorkspaceMember,
  excludeAgencyMemberFromChild,
  restoreAgencyMemberOnChild,
} from "@/lib/organization-api";
import { useAuthStore } from "@/stores/auth-store";
import {
  TEAM_ACCESS_LEVEL_OPTIONS,
  accessLevelFromSystemRole,
  accessLevelLabelPt,
  jobTitleLabelPt,
} from "@/lib/team-access-ui";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workspaceName: string;
  /** Só administradores da agência podem vincular/remover acessos diretos no cliente. */
  canManageAccess: boolean;
};

function isProtectedOwnerRole(role: string): boolean {
  return role === "owner" || role === "workspace_owner" || role === "agency_owner";
}

export function ClientWorkspaceTeamDialog({
  open,
  onOpenChange,
  workspaceId,
  workspaceName,
  canManageAccess,
}: Props) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [agencyMembers, setAgencyMembers] = useState<MemberRow[]>([]);
  const [childMembers, setChildMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agencySearch, setAgencySearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [clientAccessLevel, setClientAccessLevel] = useState<"ADMIN" | "OPERADOR" | "VIEWER">("OPERADOR");
  const [assignBusy, setAssignBusy] = useState(false);
  const [removeBusy, setRemoveBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [agency, child] = await Promise.all([fetchMembers(), fetchMembers(workspaceId)]);
      setAgencyMembers(agency);
      setChildMembers(child);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar equipe");
      setAgencyMembers([]);
      setChildMembers([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  const membersWithAccess = useMemo(
    () => childMembers.filter((m) => m.source !== "agency_excluded"),
    [childMembers]
  );
  const membersBlockedOnClient = useMemo(
    () => childMembers.filter((m) => m.source === "agency_excluded"),
    [childMembers]
  );

  useEffect(() => {
    if (!open) return;
    setAgencySearch("");
    setSelectedUserId("");
    setClientAccessLevel("OPERADOR");
    void load();
  }, [open, load]);

  const filteredAgencyOptions = useMemo(() => {
    const q = agencySearch.trim().toLowerCase();
    const list = !q
      ? agencyMembers
      : agencyMembers.filter(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            m.email.toLowerCase().includes(q) ||
            (m.jobTitle ?? "").toLowerCase().includes(q)
        );
    return [...list].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, "pt-BR"));
  }, [agencyMembers, agencySearch]);

  async function onAssign() {
    if (!selectedUserId) return;
    setError(null);
    setAssignBusy(true);
    try {
      await assignChildWorkspaceMember(workspaceId, {
        userId: selectedUserId,
        clientAccessLevel,
      });
      setSelectedUserId("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao vincular usuário");
    } finally {
      setAssignBusy(false);
    }
  }

  async function onRevokeAccess(userId: string) {
    const isSelf = Boolean(currentUserId && userId === currentUserId);
    const msg = isSelf
      ? "Você perderá o acesso direto a este cliente e continuará na agência. Confirma?"
      : "Tem certeza que deseja remover o acesso deste usuário a este cliente?";
    const ok = window.confirm(msg);
    if (!ok) return;

    setError(null);
    setRemoveBusy(userId);
    try {
      await removeMember(userId, workspaceId);
      setChildMembers((prev) => prev.filter((m) => m.userId !== userId));
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao remover acesso");
      await load();
    } finally {
      setRemoveBusy(null);
    }
  }

  async function onExcludeAgencyAccess(userId: string) {
    const ok = window.confirm(
      "Este usuário deixará de enxergar este cliente pelo acesso herdado da agência. Ele continua na equipe da agência. Confirma?"
    );
    if (!ok) return;
    setError(null);
    setRemoveBusy(userId);
    try {
      await excludeAgencyMemberFromChild(workspaceId, userId);
      setChildMembers((prev) => prev.filter((m) => m.userId !== userId));
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao remover acesso herdado");
      await load();
    } finally {
      setRemoveBusy(null);
    }
  }

  async function onRestoreAgencyAccess(userId: string) {
    const ok = window.confirm("Restaurar o acesso herdado da agência a este cliente para este usuário?");
    if (!ok) return;
    setError(null);
    setRemoveBusy(userId);
    try {
      await restoreAgencyMemberOnChild(workspaceId, userId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao restaurar acesso");
      await load();
    } finally {
      setRemoveBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={`Gerenciar acessos · ${workspaceName}`}
        showClose
        className="flex max-h-[min(90dvh,720px)] w-[min(100vw-1rem,32rem)] max-w-lg flex-col overflow-hidden"
      >
        <p className="text-xs text-muted-foreground">
          Vincule pessoas da agência com acesso direto ao cliente. Quem enxerga só pelo papel na agência
          aparece como &quot;Acesso via agência&quot; — use <strong className="text-foreground">Remover</strong>{" "}
          para bloquear esse acesso (a pessoa continua na agência). Vínculo direto usa a mesma ação e revoga a
          membership no cliente.
        </p>

        {error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
            {error}
          </p>
        ) : null}

        {canManageAccess ? (
          <div className="space-y-3 rounded-lg border border-border/50 bg-muted/15 p-3">
            <Label className="text-xs font-semibold">Vincular membro da agência</Label>
            <Input
              placeholder="Buscar por nome, e-mail ou cargo…"
              value={agencySearch}
              onChange={(e) => setAgencySearch(e.target.value)}
              className="h-9 rounded-lg"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">Membro</Label>
                <Select value={selectedUserId || undefined} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="h-9 rounded-lg">
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[240px]">
                    {filteredAgencyOptions.length === 0 ? (
                      <div className="px-2 py-2 text-xs text-muted-foreground">Nenhum resultado.</div>
                    ) : (
                      filteredAgencyOptions.map((m) => (
                        <SelectItem key={m.userId} value={m.userId}>
                          {(m.name || m.email) + " · " + jobTitleLabelPt(m.jobTitle)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">Papel neste cliente</Label>
                <Select
                  value={clientAccessLevel}
                  onValueChange={(v) => setClientAccessLevel(v as "ADMIN" | "OPERADOR" | "VIEWER")}
                >
                  <SelectTrigger className="h-9 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEAM_ACCESS_LEVEL_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              type="button"
              className="w-full rounded-lg sm:w-auto"
              disabled={assignBusy || !selectedUserId}
              onClick={() => void onAssign()}
            >
              {assignBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Vincular usuário
            </Button>
          </div>
        ) : (
          <p className="rounded-lg border border-border/40 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
            Apenas administradores da agência podem vincular ou revogar acessos. Você pode ver quem tem
            entrada neste cliente abaixo.
          </p>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando…
            </div>
          ) : (
            <div className="space-y-2 py-2">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                <Users2 className="h-3.5 w-3.5" aria-hidden />
                Quem tem acesso ({membersWithAccess.length})
              </p>
              {childMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ninguém listado ainda.</p>
              ) : (
                <>
                  <ul className="space-y-2">
                    {membersWithAccess.map((m) => {
                      const isAgencyInherited = m.source === "agency";
                      const isDirectOrLegacy = m.source === "direct" || m.source == null;
                      const level = accessLevelFromSystemRole(m.role);
                      const busyRm = removeBusy === m.userId;
                      const canRevokeDirect =
                        canManageAccess && isDirectOrLegacy && !isProtectedOwnerRole(m.role);
                      const canExcludeAgency =
                        canManageAccess && isAgencyInherited && !isProtectedOwnerRole(m.role);
                      return (
                        <li
                          key={`${m.userId}-${m.membershipId}`}
                          className="rounded-lg border border-border/40 px-3 py-2.5 text-sm"
                        >
                          <div className="flex flex-row items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{m.name || m.email}</p>
                              <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                              <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                                <span>
                                  Cargo:{" "}
                                  <span className="font-medium text-foreground">{jobTitleLabelPt(m.jobTitle)}</span>
                                </span>
                                <span>
                                  Papel:{" "}
                                  <span className="font-medium text-foreground">
                                    {accessLevelLabelPt(level)}
                                  </span>
                                </span>
                              </div>
                              {isAgencyInherited ? (
                                <p className="mt-1 text-[10px] text-muted-foreground">Acesso via agência</p>
                              ) : null}
                              {m.suspended ? (
                                <p className="mt-0.5 text-[10px] font-medium text-destructive">Conta bloqueada</p>
                              ) : null}
                            </div>
                            {canRevokeDirect ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 shrink-0 gap-1 rounded-md px-2 text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
                                disabled={busyRm}
                                onClick={() => void onRevokeAccess(m.userId)}
                                aria-busy={busyRm}
                              >
                                {busyRm ? (
                                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                )}
                                Remover
                              </Button>
                            ) : canExcludeAgency ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 shrink-0 gap-1 rounded-md px-2 text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
                                disabled={busyRm}
                                onClick={() => void onExcludeAgencyAccess(m.userId)}
                                aria-busy={busyRm}
                              >
                                {busyRm ? (
                                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                )}
                                Remover
                              </Button>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {membersBlockedOnClient.length > 0 ? (
                    <div className="mt-4 space-y-2 border-t border-border/40 pt-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        Bloqueados neste cliente ({membersBlockedOnClient.length})
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Não enxergam este cliente pelo acesso da agência. Podem voltar com Restaurar.
                      </p>
                      <ul className="space-y-2">
                        {membersBlockedOnClient.map((m) => {
                          const level = accessLevelFromSystemRole(m.role);
                          const busyRm = removeBusy === m.userId;
                          return (
                            <li
                              key={`${m.userId}-${m.membershipId}`}
                              className="rounded-lg border border-dashed border-border/50 bg-muted/10 px-3 py-2.5 text-sm"
                            >
                              <div className="flex flex-row items-start gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-medium">{m.name || m.email}</p>
                                  <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                                    <span>
                                      Papel (agência):{" "}
                                      <span className="font-medium text-foreground">
                                        {accessLevelLabelPt(level)}
                                      </span>
                                    </span>
                                  </div>
                                  <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-500">
                                    Acesso herdado bloqueado neste cliente
                                  </p>
                                </div>
                                {canManageAccess ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 shrink-0 gap-1 rounded-md px-2 text-xs font-medium text-primary"
                                    disabled={busyRm}
                                    onClick={() => void onRestoreAgencyAccess(m.userId)}
                                  >
                                    {busyRm ? (
                                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                                    ) : (
                                      <RotateCcw className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                    )}
                                    Restaurar
                                  </Button>
                                ) : null}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                </>
              )}
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
  );
}
