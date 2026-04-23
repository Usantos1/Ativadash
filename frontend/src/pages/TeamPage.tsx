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
  Sparkles,
  UserCog,
  UserPlus,
  Users2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import { TeamOverviewCards } from "@/components/operations/TeamOverviewCards";
import { userInitials } from "@/lib/team-role-badge";
import {
  TEAM_ACCESS_LEVEL_OPTIONS,
  TEAM_JOB_TITLE_OPTIONS,
  accessLevelBadgeClass,
  accessLevelFromSystemRole,
  accessLevelLabelPt,
  jobTitleCellBadgeClass,
  jobTitleLabelPt,
  teamModalInputClass,
  teamModalLabelClass,
  teamModalSelectTriggerClass,
  type TeamJobTitleValue,
} from "@/lib/team-access-ui";
import { cn } from "@/lib/utils";
import { formatPageTitle, usePageTitle } from "@/hooks/usePageTitle";

type AccessLevelUi = "ADMIN" | "OPERADOR" | "VIEWER";

function formatMemberDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

function formatLastActive(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
  } catch {
    return null;
  }
}

function canChangeOrRemoveRole(role: string): boolean {
  return role !== "owner" && role !== "workspace_owner" && role !== "agency_owner";
}

export function TeamPage() {
  usePageTitle(formatPageTitle(["Equipe"]));
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
  const [inviteWhatsapp, setInviteWhatsapp] = useState("");
  const [inviteJobTitle, setInviteJobTitle] = useState<TeamJobTitleValue>("traffic_manager");
  const [inviteAccessLevel, setInviteAccessLevel] = useState<AccessLevelUi>("OPERADOR");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPassword2, setRegPassword2] = useState("");
  const [regWhatsapp, setRegWhatsapp] = useState("");
  const [regJobTitle, setRegJobTitle] = useState<TeamJobTitleValue>("traffic_manager");
  const [regAccessLevel, setRegAccessLevel] = useState<AccessLevelUi>("OPERADOR");
  const [regBusy, setRegBusy] = useState(false);

  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [modalMsg, setModalMsg] = useState<string | null>(null);
  const [detailMember, setDetailMember] = useState<MemberRow | null>(null);

  const [search, setSearch] = useState("");
  /** Filtro por cargo (`jobTitle`); `__none__` = sem cargo definido. */
  const [jobFilter, setJobFilter] = useState<string>("all");

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

  const jobFilterOptions = useMemo(() => {
    const hasEmpty = rows.some((r) => !r.jobTitle);
    const slugs = Array.from(
      new Set(rows.map((r) => r.jobTitle).filter((j): j is string => Boolean(j)))
    ).sort();
    return { hasEmpty, slugs };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (jobFilter !== "all") {
        if (jobFilter === "__none__") {
          if (r.jobTitle) return false;
        } else if (r.jobTitle !== jobFilter) {
          return false;
        }
      }
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q);
    });
  }, [rows, search, jobFilter]);

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
        ...(regWhatsapp.trim() ? { whatsappNumber: regWhatsapp.trim() } : {}),
      });
      setRegName("");
      setRegEmail("");
      setRegPassword("");
      setRegPassword2("");
      setRegWhatsapp("");
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
        ...(inviteWhatsapp.trim() ? { whatsappNumber: inviteWhatsapp.trim() } : {}),
      });
      setInviteLink(out.inviteLink);
      setInviteEmail("");
      setInviteWhatsapp("");
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
        eyebrow="Operação"
        title="Equipe"
        subtitle="Gestão de membros, convites e papéis da organização ativa. Permissões por cliente em Contas."
        meta={
          <>
            <span className="inline-flex items-center gap-1.5">
              <UserCog className="h-3.5 w-3.5 opacity-80" />
              {orgName ? (
                <>
                  Organização: <strong className="font-semibold text-foreground">{orgName}</strong>
                </>
              ) : (
                "Organização ativa"
              )}
            </span>
            <Link
              to="/clientes"
              className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline"
            >
              <Building2 className="h-3.5 w-3.5 opacity-80" />
              Contas da agência
            </Link>
            <span className="inline-flex items-center gap-1.5">
              <OperationsModuleNav />
            </span>
          </>
        }
        actions={
          <Button
            type="button"
            className="h-10 gap-2 rounded-xl px-4 shadow-sm"
            onClick={() => {
              setModalMsg(null);
              setAddOpen(true);
            }}
          >
            <UserPlus className="h-4 w-4" />
            Adicionar membro
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

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      ) : orgCtx ? (
        <TeamOverviewCards
          membersCount={rows.length}
          directCount={directCount}
          pendingCount={pendingCount}
          planCapLabel={maxUsersLabel}
          planNote={planNote}
        />
      ) : null}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent
          centered
          showClose={false}
          className="flex max-h-[min(100dvh-2rem,44rem)] w-[min(100vw-1.5rem,600px)] max-w-[600px] flex-col gap-0 overflow-hidden rounded-2xl border-border/60 bg-background p-0 shadow-2xl"
        >
          <DialogDescription className="sr-only">
            Convide por e-mail ou cadastre manualmente com senha, cargo e nível de acesso.
          </DialogDescription>
          <div className="relative border-b border-border/60 bg-gradient-to-br from-primary/[0.06] via-background to-background px-6 py-5 pr-14">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <UserPlus className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">
                  Adicionar à equipe
                </DialogTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Convite por e-mail ou cadastro manual com cargo e nível de acesso.
                </p>
              </div>
            </div>
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-4 top-4 h-9 w-9 shrink-0 rounded-lg hover:bg-muted"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            <Tabs value={addTab} onValueChange={(v) => setAddTab(v as "invite" | "register")} className="w-full">
              <TabsList className="grid h-11 w-full grid-cols-2 gap-1 rounded-xl border border-border/60 bg-muted/40 p-1">
                <TabsTrigger
                  value="invite"
                  className="rounded-lg border-0 text-xs font-semibold text-muted-foreground shadow-none transition-all data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md sm:text-sm"
                >
                  <Mail className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Convite por e-mail
                </TabsTrigger>
                <TabsTrigger
                  value="register"
                  className="rounded-lg border-0 text-xs font-semibold text-muted-foreground shadow-none transition-all data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md sm:text-sm"
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Cadastro manual
                </TabsTrigger>
              </TabsList>

              {modalMsg ? (
                <p className="mt-4 rounded-lg border border-destructive/25 bg-destructive/[0.06] px-3 py-2 text-xs text-destructive">
                  {modalMsg}
                </p>
              ) : null}

              <TabsContent value="invite" className="mt-6 space-y-5 outline-none">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Gera convite e link único. Defina o cargo na agência e o nível de acesso no sistema.
                </p>
                <form onSubmit={handleInvite} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="modal-invite-email" className={teamModalLabelClass}>
                      E-mail
                    </Label>
                    <Input
                      id="modal-invite-email"
                      type="email"
                      value={inviteEmail}
                      onChange={(ev) => setInviteEmail(ev.target.value)}
                      placeholder="colega@empresa.com"
                      required
                      className={teamModalInputClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="modal-invite-wa" className={teamModalLabelClass}>
                      WhatsApp (com DDD)
                    </Label>
                    <Input
                      id="modal-invite-wa"
                      inputMode="tel"
                      autoComplete="tel"
                      value={inviteWhatsapp}
                      onChange={(ev) => setInviteWhatsapp(ev.target.value)}
                      placeholder="Opcional — aplicado quando aceitar o convite"
                      className={teamModalInputClass}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className={teamModalLabelClass}>Cargo</Label>
                      <Select value={inviteJobTitle} onValueChange={(v) => setInviteJobTitle(v as TeamJobTitleValue)}>
                        <SelectTrigger className={teamModalSelectTriggerClass}>
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
                    <div className="space-y-2">
                      <Label className={teamModalLabelClass}>Nível de acesso</Label>
                      <Select
                        value={inviteAccessLevel}
                        onValueChange={(v) => setInviteAccessLevel(v as AccessLevelUi)}
                      >
                        <SelectTrigger className={teamModalSelectTriggerClass}>
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
                    type="submit"
                    disabled={inviteBusy}
                    className="h-11 w-full rounded-xl text-base font-semibold shadow-sm"
                  >
                    {inviteBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                    Gerar convite e link
                  </Button>
                </form>

                {inviteLink ? (
                  <div className="space-y-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4 dark:bg-emerald-950/20">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                      <Sparkles className="h-3 w-3" aria-hidden />
                      Link do convite gerado
                    </p>
                    <p className="break-all font-mono text-[11px] leading-snug text-foreground">{inviteLink}</p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-9 w-full rounded-lg text-xs"
                      onClick={() => void copyInviteLink(inviteLink)}
                    >
                      <Copy className="mr-2 h-3.5 w-3.5" />
                      {linkCopied ? "Copiado" : "Copiar link"}
                    </Button>
                  </div>
                ) : null}
              </TabsContent>

              <TabsContent value="register" className="mt-6 space-y-5 outline-none">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Cria o usuário e o vínculo imediatamente. No primeiro login pode ser exigida troca de senha.
                </p>
                <form onSubmit={handleRegister} className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="modal-reg-name" className={teamModalLabelClass}>
                        Nome
                      </Label>
                      <Input
                        id="modal-reg-name"
                        value={regName}
                        onChange={(ev) => setRegName(ev.target.value)}
                        required
                        className={teamModalInputClass}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="modal-reg-email" className={teamModalLabelClass}>
                        E-mail
                      </Label>
                      <Input
                        id="modal-reg-email"
                        type="email"
                        value={regEmail}
                        onChange={(ev) => setRegEmail(ev.target.value)}
                        required
                        className={teamModalInputClass}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="modal-reg-wa" className={teamModalLabelClass}>
                        WhatsApp (com DDD)
                      </Label>
                      <Input
                        id="modal-reg-wa"
                        inputMode="tel"
                        autoComplete="tel"
                        value={regWhatsapp}
                        onChange={(ev) => setRegWhatsapp(ev.target.value)}
                        placeholder="Opcional"
                        className={teamModalInputClass}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="modal-reg-pass" className={teamModalLabelClass}>
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
                        className={teamModalInputClass}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="modal-reg-pass2" className={teamModalLabelClass}>
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
                        className={teamModalInputClass}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className={teamModalLabelClass}>Cargo</Label>
                      <Select value={regJobTitle} onValueChange={(v) => setRegJobTitle(v as TeamJobTitleValue)}>
                        <SelectTrigger className={teamModalSelectTriggerClass}>
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
                    <div className="space-y-2">
                      <Label className={teamModalLabelClass}>Nível de acesso</Label>
                      <Select value={regAccessLevel} onValueChange={(v) => setRegAccessLevel(v as AccessLevelUi)}>
                        <SelectTrigger className={teamModalSelectTriggerClass}>
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
                    type="submit"
                    disabled={regBusy}
                    className="h-11 w-full rounded-xl text-base font-semibold shadow-sm"
                  >
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
        <section className="space-y-3">
          <header className="flex items-end justify-between gap-3">
            <div className="space-y-0.5">
              <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight text-foreground">
                <Mail className="h-4 w-4 text-amber-500" aria-hidden />
                Convites pendentes
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold tabular-nums text-amber-700 dark:text-amber-300">
                  {invites.length}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">Links ativos aguardando aceite do destinatário.</p>
            </div>
          </header>
          <div className="grid gap-2">
            {invites.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card/60 px-4 py-3 shadow-[var(--shadow-surface-sm)] sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
                    <Mail className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{inv.email}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          "inline-flex max-w-[220px] truncate rounded-md border px-2 py-0.5 text-[11px] font-medium",
                          jobTitleCellBadgeClass(inv.jobTitle)
                        )}
                        title={jobTitleLabelPt(inv.jobTitle)}
                      >
                        {jobTitleLabelPt(inv.jobTitle)}
                      </span>
                      <span
                        className={cn(
                          "inline-flex rounded-md border px-2 py-0.5 text-left text-[11px] font-medium",
                          accessLevelBadgeClass(accessLevelFromSystemRole(inv.role))
                        )}
                      >
                        {accessLevelLabelPt(accessLevelFromSystemRole(inv.role))}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 shrink-0 rounded-lg text-xs text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto"
                  onClick={() => handleRevokeInvite(inv.id)}
                >
                  Revogar convite
                </Button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-col gap-4 rounded-2xl border border-border/50 bg-card/40 px-4 py-3 shadow-[var(--shadow-surface-sm)] sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight text-foreground">
              <Users2 className="h-4 w-4 text-primary" aria-hidden />
              Membros
              <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-bold tabular-nums text-primary">
                {filteredRows.length}
                {filteredRows.length !== rows.length ? (
                  <span className="text-muted-foreground">/{rows.length}</span>
                ) : null}
              </span>
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {clientAccountsCount != null ? (
                <>
                  <span className="font-medium text-foreground">{clientAccountsCount}</span> contas nesta org · permissões
                  por workspace em{" "}
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
            <div className="relative flex-1 sm:min-w-[220px] sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar nome ou e-mail…"
                className="h-9 rounded-lg border-border/60 bg-background pl-9 text-sm"
                aria-label="Buscar membros"
              />
              {search ? (
                <button
                  type="button"
                  aria-label="Limpar busca"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground/70 hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <Select value={jobFilter} onValueChange={setJobFilter}>
              <SelectTrigger className="h-9 w-full rounded-lg border-border/60 bg-background sm:w-[min(100%,220px)]">
                <SelectValue placeholder="Cargo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os cargos</SelectItem>
                {jobFilterOptions.hasEmpty ? (
                  <SelectItem value="__none__">Sem cargo definido</SelectItem>
                ) : null}
                {jobFilterOptions.slugs.map((slug) => (
                  <SelectItem key={slug} value={slug}>
                    {jobTitleLabelPt(slug)}
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
                : "Ajuste a busca ou o filtro de cargo."
            }
            actionLabel={rows.length === 0 ? "Convidar membro" : undefined}
            onAction={rows.length === 0 ? () => setAddOpen(true) : undefined}
          />
        ) : (
          <DataTablePremium
            shellClassName="rounded-2xl border-border/60 bg-card/50 shadow-[var(--shadow-surface-sm)]"
            className="table-fixed [&_thead_th]:font-extrabold [&_thead_th]:tracking-wider [&_thead_th]:text-muted-foreground [&_tbody_tr]:border-b [&_tbody_tr]:border-border/40 [&_tbody_tr:hover]:bg-muted/25"
            stickyHeader
            minHeight="min-h-[220px]"
          >
            <colgroup>
              <col className="w-[30%]" />
              <col className="w-[19%]" />
              <col className="w-[19%]" />
              <col className="w-[26%]" />
              <col className="w-14" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className="!pl-4 text-left">
                  Usuário
                </th>
                <th scope="col" className="text-left">
                  Cargo
                </th>
                <th scope="col" className="text-left">
                  Nível de acesso
                </th>
                <th scope="col" className="text-left">
                  Última atividade
                </th>
                <th scope="col" className="!w-14 !min-w-[3.5rem] !pr-4 text-right">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const direct = row.source === "direct";
                const isSelf = !!currentUserId && row.userId === currentUserId;
                const canEditJobTitle = direct && row.role !== "owner";
                const canEditAccessLevel = direct && canChangeOrRemoveRole(row.role);
                const canRemove = direct && canChangeOrRemoveRole(row.role) && !isSelf;
                const initials = userInitials(row.name, row.email);
                const levelUi = accessLevelFromSystemRole(row.role);
                const lastActiveLabel = formatLastActive(row.lastLoginAt);

                return (
                  <tr key={row.membershipId}>
                    <td className="!pl-4 text-left">
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
                    <td className="text-left">
                      <div className="flex flex-wrap items-start justify-start gap-1.5">
                        <span
                          className={cn(
                            "inline-flex max-w-full truncate rounded-md border px-2 py-0.5 text-left text-[11px] font-medium",
                            jobTitleCellBadgeClass(row.jobTitle)
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
                    <td className="text-left">
                      <span
                        className={cn(
                          "inline-flex max-w-full truncate rounded-md border px-2 py-0.5 text-left text-[11px] font-medium",
                          accessLevelBadgeClass(levelUi)
                        )}
                        title={accessLevelLabelPt(levelUi)}
                      >
                        {accessLevelLabelPt(levelUi)}
                      </span>
                    </td>
                    <td className="text-left">
                      <div className="flex flex-col items-start gap-1.5 text-left text-xs">
                        {lastActiveLabel ? (
                          <span className="font-medium text-foreground">{lastActiveLabel}</span>
                        ) : (
                          <span className="inline-flex w-fit rounded-full border border-neutral-200 bg-neutral-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
                            Sem atividade
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          Entrada {formatMemberDate(row.joinedAt)}
                        </span>
                      </div>
                    </td>
                    <td className="!pr-4 text-right align-middle">
                      <div className="flex justify-end">
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
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
                            {canEditJobTitle ? (
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
                            {canEditAccessLevel ? (
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
                            {canRemove ? (
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
                      </div>
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
