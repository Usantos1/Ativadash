import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Building2,
  ChevronRight,
  Copy,
  Loader2,
  Mail,
  MoreHorizontal,
  Search,
  UserPlus,
  Users2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTablePremium, PageHeaderPremium } from "@/components/premium";
import { EmptyState } from "@/components/ui/empty-state";
import {
  fetchMembers,
  fetchPendingInvitations,
  createInvitation,
  revokeInvitation,
  patchMember,
  createWorkspaceMember,
  removeMember,
  fetchClients,
  type MemberRow,
  type InvitationRow,
} from "@/lib/workspace-api";
import { fetchOrganizationContext, formatPlanCap, type OrganizationContext } from "@/lib/organization-api";
import { useAuthStore } from "@/stores/auth-store";
import { OperationsModuleNav } from "@/components/operations/operations-module-nav";
import { MemberDetailDialog } from "@/components/operations/member-detail-dialog";
import { userInitials } from "@/lib/team-role-badge";
import {
  TEAM_ACCESS_LEVEL_OPTIONS,
  TEAM_JOB_TITLE_OPTIONS,
  accessLevelBadgeClass,
  accessLevelFromSystemRole,
  accessLevelLabelPt,
  jobTitleBadgeClass,
  jobTitleLabelPt,
  type TeamJobTitleValue,
} from "@/lib/team-access-ui";
import { cn } from "@/lib/utils";

type AccessLevelUi = "ADMIN" | "OPERADOR" | "VIEWER";

function formatMemberDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

function formatLastActive(iso: string | null | undefined): string {
  if (!iso) return "Nunca";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
  } catch {
    return "—";
  }
}

function canChangeOrRemoveRole(role: string): boolean {
  return role !== "owner" && role !== "workspace_owner" && role !== "agency_owner";
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
  const [addOpen, setAddOpen] = useState(false);
  const [addTab, setAddTab] = useState<"invite" | "register">("invite");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteJobTitle, setInviteJobTitle] = useState<TeamJobTitleValue>("traffic_manager");
  const [inviteAccessLevel, setInviteAccessLevel] = useState<AccessLevelUi>("OPERADOR");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPassword2, setRegPassword2] = useState("");
  const [regJobTitle, setRegJobTitle] = useState<TeamJobTitleValue>("traffic_manager");
  const [regAccessLevel, setRegAccessLevel] = useState<AccessLevelUi>("OPERADOR");
  const [regBusy, setRegBusy] = useState(false);

  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [modalMsg, setModalMsg] = useState<string | null>(null);
  const [detailMember, setDetailMember] = useState<MemberRow | null>(null);

  const [search, setSearch] = useState("");
  const [accessFilter, setAccessFilter] = useState<string>("all");

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

  useEffect(() => {
    if (!addOpen) {
      setModalMsg(null);
      setInviteLink(null);
      setLinkCopied(false);
      setAddTab("invite");
    }
  }, [addOpen]);

  const directCount = rows.filter((r) => r.source === "direct").length;
  const pendingCount = invites.length;
  const maxUsersLabel = orgCtx ? formatPlanCap(orgCtx.limits.maxUsers) : "—";
  const planNote =
    orgCtx?.planSource === "parent" ? "Limites herdados da matriz." : "Limites do plano desta organização.";

  const uniqueAccessLevels = useMemo(() => {
    const s = new Set(rows.map((r) => accessLevelFromSystemRole(r.role)));
    return Array.from(s).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (accessFilter !== "all" && accessLevelFromSystemRole(r.role) !== accessFilter) return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q);
    });
  }, [rows, search, accessFilter]);

  async function copyInviteLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setModalMsg("Não foi possível copiar. Copie manualmente.");
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setModalMsg(null);
    if (regPassword.length < 8) {
      setModalMsg("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (regPassword !== regPassword2) {
      setModalMsg("Confirmação da senha não confere.");
      return;
    }
    setRegBusy(true);
    try {
      await createWorkspaceMember({
        email: regEmail.trim(),
        name: regName.trim(),
        password: regPassword,
        jobTitle: regJobTitle,
        accessLevel: regAccessLevel,
      });
      setRegName("");
      setRegEmail("");
      setRegPassword("");
      setRegPassword2("");
      setAddOpen(false);
      await load();
    } catch (err) {
      setModalMsg(err instanceof Error ? err.message : "Erro ao cadastrar");
    } finally {
      setRegBusy(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteLink(null);
    setModalMsg(null);
    setInviteBusy(true);
    try {
      const out = await createInvitation({
        email: inviteEmail.trim(),
        jobTitle: inviteJobTitle,
        accessLevel: inviteAccessLevel,
      });
      setInviteLink(out.inviteLink);
      setInviteEmail("");
      await load();
    } catch (err) {
      setModalMsg(err instanceof Error ? err.message : "Erro ao convidar");
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

  async function handleAccessLevelChange(userId: string, level: AccessLevelUi) {
    setActionMsg(null);
    try {
      await patchMember(userId, { accessLevel: level });
      await load();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : "Erro");
    }
  }

  async function handleJobTitleChange(userId: string, title: TeamJobTitleValue) {
    setActionMsg(null);
    try {
      await patchMember(userId, { jobTitle: title });
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
    <div className="min-w-0 max-w-full space-y-8 pb-16">
      <PageHeaderPremium
        variant="dense"
        eyebrow="Operação"
        title="Equipe"
        subtitle="Gestão de membros, convites e papéis na organização ativa. Acesso por cliente continua em Contas."
        meta={
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-1">
            <OperationsModuleNav />
            <span className="hidden text-border/80 sm:inline" aria-hidden>
              ·
            </span>
            <Link
              to="/clientes"
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary underline-offset-4 hover:underline"
            >
              <Building2 className="h-3.5 w-3.5 opacity-80" />
              Contas da agência
            </Link>
          </div>
        }
        actions={
          <Button
            type="button"
            className="h-9 gap-2 rounded-lg px-4 shadow-sm"
            onClick={() => {
              setModalMsg(null);
              setAddOpen(true);
            }}
          >
            <UserPlus className="h-4 w-4" />
            Convidar membro
          </Button>
        }
      />

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/[0.06] px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {actionMsg ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/[0.06] px-4 py-3 text-sm text-destructive">
          {actionMsg}
        </div>
      ) : null}

      {!loading && orgCtx ? (
        <div className="flex flex-wrap items-center gap-x-0 gap-y-2 rounded-lg border border-border/35 bg-card/25 px-4 py-3 shadow-[var(--shadow-surface-sm)]">
          <div className="flex min-w-[7.5rem] flex-col gap-0.5 pr-6">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/90">Membros ativos</span>
            <span className="text-sm font-semibold tabular-nums text-foreground">{rows.length}</span>
          </div>
          <Separator orientation="vertical" className="hidden h-8 bg-border/50 sm:block" />
          <div className="flex min-w-[7.5rem] flex-col gap-0.5 px-0 sm:px-6">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/90">Acesso direto</span>
            <span className="text-sm font-semibold tabular-nums text-foreground">{directCount}</span>
          </div>
          <Separator orientation="vertical" className="hidden h-8 bg-border/50 sm:block" />
          <div className="flex min-w-[7.5rem] flex-col gap-0.5 px-0 sm:px-6">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/90">Convites pendentes</span>
            <span className="text-sm font-semibold tabular-nums text-foreground">{pendingCount}</span>
          </div>
          <Separator orientation="vertical" className="hidden h-8 bg-border/50 sm:block" />
          <div className="flex min-w-[9rem] flex-1 flex-col gap-0.5 sm:pl-6">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/90">Limite do plano</span>
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {maxUsersLabel}
              <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">({planNote})</span>
            </span>
          </div>
          {orgName ? (
            <>
              <Separator orientation="vertical" className="hidden h-8 bg-border/50 lg:block" />
              <div className="w-full text-[11px] text-muted-foreground lg:ml-auto lg:w-auto lg:text-right">
                <span className="text-muted-foreground/80">Organização:</span>{" "}
                <span className="font-medium text-foreground">{orgName}</span>
              </div>
            </>
          ) : null}
        </div>
      ) : loading ? (
        <Skeleton className="h-[4.5rem] w-full rounded-lg" />
      ) : null}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent
          showClose={false}
          alignTop
          overlayClassName="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          className="flex w-[min(100vw-1.5rem,600px)] max-w-[600px] flex-col gap-0 overflow-hidden rounded-xl border-border/40 p-0 shadow-2xl sm:max-h-[min(100dvh-2rem,720px)]"
        >
          <DialogDescription className="sr-only">
            Convide por e-mail ou cadastre manualmente com senha, cargo e nível de acesso.
          </DialogDescription>
          <div className="relative border-b border-border/35 bg-muted/20 px-5 py-4 pr-14">
            <DialogTitle className="pr-2 text-base font-semibold tracking-tight text-foreground">
              Adicionar à equipe
            </DialogTitle>
            <p className="mt-1 text-xs text-muted-foreground">Convite por e-mail ou cadastro manual com cargo e nível de acesso.</p>
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-3 top-3 h-8 w-8 shrink-0 rounded-lg"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <Tabs value={addTab} onValueChange={(v) => setAddTab(v as "invite" | "register")} className="w-full">
              <TabsList className="grid h-9 w-full grid-cols-2 rounded-lg bg-muted/60 p-1">
                <TabsTrigger value="invite" className="rounded-md text-xs sm:text-sm">
                  Convite por e-mail
                </TabsTrigger>
                <TabsTrigger value="register" className="rounded-md text-xs sm:text-sm">
                  Cadastro manual
                </TabsTrigger>
              </TabsList>

              {modalMsg ? (
                <p className="mt-4 rounded-lg border border-destructive/25 bg-destructive/[0.06] px-3 py-2 text-xs text-destructive">
                  {modalMsg}
                </p>
              ) : null}

              <TabsContent value="invite" className="mt-5 space-y-4 outline-none">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Gera convite e link único. Defina o cargo na agência e o nível de acesso no sistema.
                </p>
                <form onSubmit={handleInvite} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="modal-invite-email" className="text-xs font-medium">
                      E-mail
                    </Label>
                    <Input
                      id="modal-invite-email"
                      type="email"
                      value={inviteEmail}
                      onChange={(ev) => setInviteEmail(ev.target.value)}
                      placeholder="colega@empresa.com"
                      required
                      className="h-10 rounded-lg border-border/50"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Cargo</Label>
                      <Select value={inviteJobTitle} onValueChange={(v) => setInviteJobTitle(v as TeamJobTitleValue)}>
                        <SelectTrigger className="h-10 rounded-lg border-border/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TEAM_JOB_TITLE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Nível de acesso</Label>
                      <Select
                        value={inviteAccessLevel}
                        onValueChange={(v) => setInviteAccessLevel(v as AccessLevelUi)}
                      >
                        <SelectTrigger className="h-10 rounded-lg border-border/50">
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
                  <Button type="submit" disabled={inviteBusy} className="h-10 w-full rounded-lg">
                    {inviteBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                    Gerar convite e link
                  </Button>
                </form>

                {inviteLink ? (
                  <div className="space-y-2 rounded-lg border border-border/40 bg-muted/20 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Link do convite</p>
                    <p className="break-all font-mono text-[11px] leading-snug text-foreground">{inviteLink}</p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-8 w-full rounded-md text-xs"
                      onClick={() => void copyInviteLink(inviteLink)}
                    >
                      <Copy className="mr-2 h-3.5 w-3.5" />
                      {linkCopied ? "Copiado" : "Copiar link"}
                    </Button>
                  </div>
                ) : null}
              </TabsContent>

              <TabsContent value="register" className="mt-5 space-y-4 outline-none">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Cria o usuário e o vínculo imediatamente. No primeiro login pode ser exigida troca de senha.
                </p>
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="modal-reg-name" className="text-xs font-medium">
                        Nome
                      </Label>
                      <Input
                        id="modal-reg-name"
                        value={regName}
                        onChange={(ev) => setRegName(ev.target.value)}
                        required
                        className="h-10 rounded-lg border-border/50"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="modal-reg-email" className="text-xs font-medium">
                        E-mail
                      </Label>
                      <Input
                        id="modal-reg-email"
                        type="email"
                        value={regEmail}
                        onChange={(ev) => setRegEmail(ev.target.value)}
                        required
                        className="h-10 rounded-lg border-border/50"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="modal-reg-pass" className="text-xs font-medium">
                        Senha
                      </Label>
                      <Input
                        id="modal-reg-pass"
                        type="password"
                        autoComplete="new-password"
                        value={regPassword}
                        onChange={(ev) => setRegPassword(ev.target.value)}
                        required
                        minLength={8}
                        className="h-10 rounded-lg border-border/50"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="modal-reg-pass2" className="text-xs font-medium">
                        Confirmar
                      </Label>
                      <Input
                        id="modal-reg-pass2"
                        type="password"
                        autoComplete="new-password"
                        value={regPassword2}
                        onChange={(ev) => setRegPassword2(ev.target.value)}
                        required
                        minLength={8}
                        className="h-10 rounded-lg border-border/50"
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Cargo</Label>
                      <Select value={regJobTitle} onValueChange={(v) => setRegJobTitle(v as TeamJobTitleValue)}>
                        <SelectTrigger className="h-10 rounded-lg border-border/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TEAM_JOB_TITLE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Nível de acesso</Label>
                      <Select value={regAccessLevel} onValueChange={(v) => setRegAccessLevel(v as AccessLevelUi)}>
                        <SelectTrigger className="h-10 rounded-lg border-border/50">
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
                  <Button type="submit" disabled={regBusy} className="h-10 w-full rounded-lg">
                    {regBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                    Cadastrar usuário
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {invites.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Convites pendentes</h2>
          <div className="overflow-hidden rounded-lg border border-border/35 bg-card/20 shadow-[var(--shadow-surface-sm)]">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border/40 text-left">
                  <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    E-mail
                  </th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Cargo
                  </th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Papel
                  </th>
                  <th className="w-24 px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => (
                  <tr key={inv.id} className="border-b border-border/30 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-foreground">{inv.email}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "inline-flex max-w-[200px] truncate rounded-md border px-2 py-0.5 text-[11px] font-medium",
                          jobTitleBadgeClass(inv.jobTitle)
                        )}
                        title={jobTitleLabelPt(inv.jobTitle)}
                      >
                        {jobTitleLabelPt(inv.jobTitle)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium",
                          accessLevelBadgeClass(accessLevelFromSystemRole(inv.role))
                        )}
                      >
                        {accessLevelLabelPt(accessLevelFromSystemRole(inv.role))}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-md text-xs text-destructive hover:text-destructive"
                        onClick={() => handleRevokeInvite(inv.id)}
                      >
                        Revogar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-foreground">Membros</h2>
            <p className="mt-0.5 max-w-xl text-xs text-muted-foreground">
              {clientAccountsCount != null ? (
                <>
                  <span className="font-medium text-foreground">{clientAccountsCount}</span> contas nesta org · permissões
                  finas por workspace em{" "}
                  <Link to="/clientes" className="font-medium text-primary underline-offset-2 hover:underline">
                    Clientes
                  </Link>
                </>
              ) : (
                "Carregando contexto…"
              )}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:min-w-[200px] sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar nome ou e-mail…"
                className="h-9 rounded-lg border-border/50 pl-9 text-sm"
                aria-label="Buscar membros"
              />
            </div>
            <Select value={accessFilter} onValueChange={setAccessFilter}>
              <SelectTrigger className="h-9 w-full rounded-lg border-border/50 sm:w-[220px]">
                <SelectValue placeholder="Nível de acesso" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os níveis</SelectItem>
                {uniqueAccessLevels.map((lvl) => (
                  <SelectItem key={lvl} value={lvl}>
                    {accessLevelLabelPt(lvl)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        ) : filteredRows.length === 0 ? (
          <EmptyState
            icon={Users2}
            title={rows.length === 0 ? "Nenhum membro" : "Nenhum resultado"}
            description={
              rows.length === 0
                ? "Convide colegas ou cadastre manualmente para começar."
                : "Ajuste a busca ou o filtro de nível de acesso."
            }
            actionLabel={rows.length === 0 ? "Convidar membro" : undefined}
            onAction={rows.length === 0 ? () => setAddOpen(true) : undefined}
          />
        ) : (
          <DataTablePremium
            shellClassName="rounded-lg border-border/35 bg-card/30 shadow-[var(--shadow-surface-sm)]"
            stickyHeader
            minHeight="min-h-[200px]"
          >
            <thead>
              <tr>
                <th scope="col" className="!pl-4">
                  Usuário
                </th>
                <th scope="col">Cargo</th>
                <th scope="col">Papel</th>
                <th scope="col">Última atividade</th>
                <th scope="col" className="w-12 !pr-4 text-right">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const direct = row.source === "direct";
                const showRoleMenu =
                  direct && currentUserId && row.userId !== currentUserId && canChangeOrRemoveRole(row.role);
                const initials = userInitials(row.name, row.email);
                const levelUi = accessLevelFromSystemRole(row.role);

                return (
                  <tr key={row.membershipId}>
                    <td className="!pl-4">
                      <button
                        type="button"
                        className="flex min-w-0 max-w-[280px] items-center gap-3 rounded-md text-left transition-colors hover:bg-muted/30 -m-1 p-1"
                        onClick={() => setDetailMember(row)}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary">
                          {initials}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-foreground">{row.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{row.email}</span>
                          {!direct ? (
                            <span className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] text-amber-800/90 dark:text-amber-200/90">
                              Via agência
                              <ChevronRight className="h-3 w-3 opacity-60" aria-hidden />
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </td>
                    <td>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-flex max-w-[200px] truncate rounded-md border px-2 py-0.5 text-[11px] font-medium",
                            jobTitleBadgeClass(row.jobTitle)
                          )}
                          title={jobTitleLabelPt(row.jobTitle)}
                        >
                          {jobTitleLabelPt(row.jobTitle)}
                        </span>
                        {row.suspended ? (
                          <span className="inline-flex rounded-md border border-destructive/25 bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                            Bloqueado
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <span
                        className={cn(
                          "inline-flex max-w-[200px] truncate rounded-md border px-2 py-0.5 text-[11px] font-medium",
                          accessLevelBadgeClass(levelUi)
                        )}
                        title={accessLevelLabelPt(levelUi)}
                      >
                        {accessLevelLabelPt(levelUi)}
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-col gap-0.5 text-xs">
                        <span className="font-medium text-foreground">{formatLastActive(row.lastLoginAt)}</span>
                        <span className="text-[10px] text-muted-foreground">
                          Entrada {formatMemberDate(row.joinedAt)}
                        </span>
                      </div>
                    </td>
                    <td className="!pr-4 text-right">
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                            aria-label={`Ações para ${row.name}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.Content
                            className="z-50 min-w-[11rem] rounded-lg border border-border/50 bg-popover p-1 shadow-lg"
                            align="end"
                            sideOffset={4}
                          >
                            <DropdownMenu.Item
                              className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none hover:bg-muted"
                              onSelect={() => setDetailMember(row)}
                            >
                              Gerenciar
                            </DropdownMenu.Item>
                            {showRoleMenu ? (
                              <DropdownMenu.Sub>
                                <DropdownMenu.SubTrigger className="flex cursor-default items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none hover:bg-muted data-[state=open]:bg-muted">
                                  Alterar cargo
                                  <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-60" />
                                </DropdownMenu.SubTrigger>
                                <DropdownMenu.Portal>
                                  <DropdownMenu.SubContent
                                    className="z-50 min-w-[12rem] rounded-lg border border-border/50 bg-popover p-1 shadow-lg"
                                    sideOffset={4}
                                  >
                                    {TEAM_JOB_TITLE_OPTIONS.map((o) => (
                                      <DropdownMenu.Item
                                        key={o.value}
                                        className="cursor-pointer rounded-md px-2.5 py-2 text-sm outline-none hover:bg-muted"
                                        disabled={o.value === row.jobTitle}
                                        onSelect={() => {
                                          void handleJobTitleChange(row.userId, o.value);
                                        }}
                                      >
                                        {o.label}
                                      </DropdownMenu.Item>
                                    ))}
                                  </DropdownMenu.SubContent>
                                </DropdownMenu.Portal>
                              </DropdownMenu.Sub>
                            ) : null}
                            {showRoleMenu ? (
                              <DropdownMenu.Sub>
                                <DropdownMenu.SubTrigger className="flex cursor-default items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none hover:bg-muted data-[state=open]:bg-muted">
                                  Alterar nível de acesso
                                  <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-60" />
                                </DropdownMenu.SubTrigger>
                                <DropdownMenu.Portal>
                                  <DropdownMenu.SubContent
                                    className="z-50 min-w-[11rem] rounded-lg border border-border/50 bg-popover p-1 shadow-lg"
                                    sideOffset={4}
                                  >
                                    {TEAM_ACCESS_LEVEL_OPTIONS.map((o) => (
                                      <DropdownMenu.Item
                                        key={o.value}
                                        className="cursor-pointer rounded-md px-2.5 py-2 text-sm outline-none hover:bg-muted"
                                        disabled={o.value === levelUi}
                                        onSelect={() => {
                                          void handleAccessLevelChange(row.userId, o.value);
                                        }}
                                      >
                                        {o.label}
                                      </DropdownMenu.Item>
                                    ))}
                                  </DropdownMenu.SubContent>
                                </DropdownMenu.Portal>
                              </DropdownMenu.Sub>
                            ) : null}
                            {showRoleMenu ? (
                              <DropdownMenu.Item
                                className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm text-destructive outline-none hover:bg-muted"
                                onSelect={() => {
                                  void handleRemove(row.userId);
                                }}
                              >
                                Remover da org
                              </DropdownMenu.Item>
                            ) : null}
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTablePremium>
        )}
      </section>

      <MemberDetailDialog
        open={!!detailMember}
        onOpenChange={(v) => {
          if (!v) setDetailMember(null);
        }}
        member={detailMember}
        linkedClientsCount={clientAccountsCount}
        formatDate={formatMemberDate}
        currentUserId={currentUserId}
        onMemberUpdated={() => load()}
      />
    </div>
  );
}
