import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Ban,
  Building2,
  CheckCircle2,
  ChevronRight,
  Filter,
  Loader2,
  MailPlus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHint } from "@/pages/revenda/PageHint";
import { EcosystemMemberDialog } from "@/pages/revenda/EcosystemMemberDialog";
import { cn } from "@/lib/utils";
import {
  fetchResellerEcosystemOrganizations,
  fetchResellerEcosystemUsers,
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
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState<EcosystemUserRow[]>([]);
  const [orgs, setOrgs] = useState<{ id: string; name: string; isMatrix: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOrgId, setFilterOrgId] = useState<string>("all");
  const [filterOrgKind, setFilterOrgKind] = useState<"all" | "AGENCY" | "CLIENT">("all");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterSuspended, setFilterSuspended] = useState<"all" | "true" | "false">("all");
  const [q, setQ] = useState("");

  const [detailRow, setDetailRow] = useState<EcosystemUserRow | null>(null);

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
    const oid = searchParams.get("organizationId");
    if (!oid?.trim()) return;
    setFilterOrgId(oid.trim());
    setCreateOrgId(oid.trim());
    setInviteOrgId(oid.trim());
  }, [searchParams]);

  useEffect(() => {
    const delay = q.trim() ? 320 : 0;
    const t = window.setTimeout(() => void load(), delay);
    return () => window.clearTimeout(t);
  }, [q, filterOrgId, filterOrgKind, filterRole, filterSuspended, load]);

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

  const totals = useMemo(() => {
    const total = users.length;
    const suspended = users.filter((u) => u.user.suspended).length;
    const active = total - suspended;
    const admins = users.filter((u) => u.role === "owner" || u.role === "admin").length;
    const uniqueUserIds = new Set(users.map((u) => u.user.id));
    const uniqueOrgIds = new Set(users.map((u) => u.organization.id));
    return { total, active, suspended, admins, uniqueUsers: uniqueUserIds.size, uniqueOrgs: uniqueOrgIds.size };
  }, [users]);

  const hasActiveFilter =
    q.trim() !== "" ||
    filterOrgId !== "all" ||
    filterOrgKind !== "all" ||
    filterRole !== "all" ||
    filterSuspended !== "all";

  function clearFilters() {
    setQ("");
    setFilterOrgId("all");
    setFilterOrgKind("all");
    setFilterRole("all");
    setFilterSuspended("all");
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Pessoas da rede</h2>
            <PageHint>
              Todos os usuários da matriz e das contas filhas. Clique em uma linha para gerenciar perfil, papel, senha ou remover o vínculo.
            </PageHint>
          </div>
          <p className="text-xs text-muted-foreground">
            {totals.uniqueUsers} pessoas distintas · {totals.total} vínculos em {totals.uniqueOrgs} empresas
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 rounded-xl"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            Atualizar
          </Button>
          <Button type="button" variant="secondary" className="h-10 gap-2 rounded-xl" onClick={() => setInviteOpen(true)}>
            <MailPlus className="h-4 w-4" />
            Convidar
          </Button>
          <Button type="button" className="h-10 gap-2 rounded-xl shadow-sm" onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Novo usuário
          </Button>
        </div>
      </header>

      {actionError ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <UsersKpi icon={Users} label="Vínculos" value={String(totals.total)} hint={`${totals.uniqueUsers} pessoas distintas`} tone="primary" />
        <UsersKpi icon={CheckCircle2} label="Ativos" value={String(totals.active)} hint="Acessam o produto normalmente" tone={totals.active > 0 ? "emerald" : "neutral"} />
        <UsersKpi icon={Ban} label="Suspensos" value={String(totals.suspended)} hint={totals.suspended > 0 ? "Não conseguem fazer login" : "Nenhum bloqueio ativo"} tone={totals.suspended > 0 ? "amber" : "neutral"} pulse={totals.suspended > 0} />
        <UsersKpi icon={ShieldCheck} label="Administradores" value={String(totals.admins)} hint="Owners e admins da rede" tone="neutral" />
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b border-border/40 bg-muted/20 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Filter className="h-4 w-4 text-muted-foreground" />
            Filtros
            {hasActiveFilter ? (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">Ativos</span>
            ) : null}
          </div>
          {hasActiveFilter ? (
            <Button type="button" variant="ghost" size="sm" className="h-7 rounded-lg px-2 text-xs" onClick={clearFilters}>
              <X className="mr-1 h-3 w-3" />
              Limpar
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative sm:col-span-2 lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou e-mail…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-9 rounded-lg pl-9 pr-8"
            />
            {q ? (
              <button
                type="button"
                onClick={() => setQ("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Limpar busca"
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </div>
          <Select value={filterOrgId} onValueChange={setFilterOrgId}>
            <SelectTrigger className="h-9 rounded-lg">
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
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="h-9 rounded-lg">
              <SelectValue placeholder="Papel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Qualquer papel</SelectItem>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABEL_PT[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterSuspended} onValueChange={(v) => setFilterSuspended(v as "all" | "true" | "false")}>
            <SelectTrigger className="h-9 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="false">Somente ativos</SelectItem>
              <SelectItem value="true">Somente suspensos</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 py-3">
          <CardTitle className="text-sm font-semibold">
            {loading ? "Carregando…" : `${users.length} ${users.length === 1 ? "vínculo" : "vínculos"}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && users.length === 0 ? (
            <div className="divide-y divide-border/40">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : error ? (
            <p className="p-6 text-sm text-destructive">{error}</p>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">Nenhum usuário encontrado</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                {hasActiveFilter
                  ? "Ajuste os filtros ou limpe para ver todos."
                  : "Convide alguém por e-mail ou cadastre um usuário com senha inicial."}
              </p>
              {hasActiveFilter ? (
                <Button type="button" variant="outline" size="sm" className="mt-2 rounded-lg" onClick={clearFilters}>
                  Limpar filtros
                </Button>
              ) : null}
            </div>
          ) : (
            <ul className="divide-y divide-border/40" aria-label="Vínculos">
              {users.map((row) => (
                <li key={row.membershipId}>
                  <button
                    type="button"
                    onClick={() => setDetailRow(row)}
                    className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold uppercase text-primary">
                      {row.user.name.charAt(0) || "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-foreground">{row.user.name}</span>
                        {row.user.suspended ? (
                          <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300">
                            Suspenso
                          </span>
                        ) : null}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{row.user.email}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {row.organization.name}
                          {row.organization.isMatrix ? (
                            <span className="ml-0.5 rounded bg-primary/10 px-1 text-[9px] font-bold uppercase tracking-wider text-primary">matriz</span>
                          ) : null}
                        </span>
                        <span>·</span>
                        <span className="font-medium text-foreground/80">{roleLabelPt(row.role)}</span>
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <EcosystemMemberDialog
        open={!!detailRow}
        onOpenChange={(v) => {
          if (!v) setDetailRow(null);
        }}
        row={detailRow}
        onChanged={() => void load()}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md" title="Novo usuário" description="Cria a pessoa com senha inicial e já a vincula a uma empresa da rede.">
          <div className="grid gap-3 pt-1 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-semibold">E-mail</Label>
              <Input
                type="email"
                placeholder="pessoa@empresa.com"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                className="h-9 rounded-lg"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nome</Label>
              <Input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                className="h-9 rounded-lg"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Senha inicial</Label>
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                className="h-9 rounded-lg"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Empresa</Label>
              <Select value={createOrgId} onValueChange={setCreateOrgId}>
                <SelectTrigger className="h-9 rounded-lg">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                      {o.isMatrix ? " (matriz)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Papel</Label>
              <Select value={createRole} onValueChange={(v) => setCreateRole(v as (typeof ROLES)[number])}>
                <SelectTrigger className="h-9 rounded-lg">
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
            <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              className="rounded-lg"
              disabled={
                createSubmitting ||
                !createEmail.trim() ||
                !createName.trim() ||
                createPassword.length < 8 ||
                !createOrgId
              }
              onClick={() => void submitCreate()}
            >
              {createSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              {createSubmitting ? "Criando…" : "Criar usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md" title="Convidar por e-mail" description="Gere um link único para a pessoa definir a própria senha ao aceitar.">
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">E-mail</Label>
              <Input
                type="email"
                placeholder="pessoa@empresa.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="h-9 rounded-lg"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Empresa</Label>
                <Select value={inviteOrgId} onValueChange={setInviteOrgId}>
                  <SelectTrigger className="h-9 rounded-lg">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {orgs.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                        {o.isMatrix ? " (matriz)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Papel</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as (typeof INVITE_ROLES)[number])}>
                  <SelectTrigger className="h-9 rounded-lg">
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
            </div>
            {inviteLink ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  Link gerado · envie para a pessoa
                </p>
                <p className="mt-1 break-all text-xs font-mono text-foreground">{inviteLink}</p>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => setInviteOpen(false)}>
              Fechar
            </Button>
            <Button
              type="button"
              size="sm"
              className="rounded-lg"
              disabled={inviteSubmitting || !inviteEmail.trim() || !inviteOrgId}
              onClick={() => void submitInvite()}
            >
              {inviteSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MailPlus className="mr-2 h-4 w-4" />}
              {inviteSubmitting ? "Gerando…" : "Gerar convite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

type KpiTone = "neutral" | "amber" | "rose" | "emerald" | "primary";

const USERS_KPI_TONE: Record<KpiTone, { wrap: string; icon: string }> = {
  primary: { wrap: "border-primary/25 bg-primary/[0.04] dark:bg-primary/[0.08]", icon: "bg-primary/15 text-primary" },
  emerald: { wrap: "border-emerald-500/30 bg-emerald-500/[0.05] dark:bg-emerald-950/25", icon: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  amber: { wrap: "border-amber-500/30 bg-amber-500/[0.05] dark:bg-amber-950/20", icon: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  rose: { wrap: "border-rose-500/30 bg-rose-500/[0.05] dark:bg-rose-950/25", icon: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
  neutral: { wrap: "border-border/60 bg-muted/20", icon: "bg-muted text-muted-foreground" },
};

function UsersKpi({
  icon: Icon,
  label,
  value,
  hint,
  tone = "neutral",
  pulse = false,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint?: string;
  tone?: KpiTone;
  pulse?: boolean;
}) {
  const styles = USERS_KPI_TONE[tone];
  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border p-3.5 shadow-[var(--shadow-surface-sm)] sm:p-4", styles.wrap)}>
      <div className={cn("relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", styles.icon)}>
        <Icon className="h-4 w-4" aria-hidden />
        {pulse ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-amber-500/60" aria-hidden />
            <span className="relative h-2 w-2 rounded-full bg-amber-500" aria-hidden />
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-xl font-bold tabular-nums tracking-tight text-foreground sm:text-2xl">{value}</p>
        {hint ? <p className="mt-1 truncate text-[11px] text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}
