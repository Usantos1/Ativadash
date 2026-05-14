import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Briefcase,
  CalendarClock,
  CheckCircle2,
  Clock,
  ExternalLink,
  Mail,
  MessageCircle,
  RefreshCw,
  Search,
  TrendingUp,
  Trash2,
  UserPlus,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuthStore } from "@/stores/auth-store";
import { getApiErrorMessage } from "@/lib/api";
import {
  deleteLead,
  fetchLeads,
  patchLead,
  LEAD_BUDGET_LABEL,
  LEAD_PROFILE_LABEL,
  LEAD_STATUS_LABEL,
  type LeadRow,
  type LeadStats,
  type LeadStatus,
} from "@/lib/leads-api";

const STATUSES: Array<LeadStatus | "ALL"> = ["ALL", "NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"];

const STATUS_FILTER_LABEL: Record<LeadStatus | "ALL", string> = {
  ALL: "Todos",
  ...LEAD_STATUS_LABEL,
};

const STATUS_TONE: Record<LeadStatus, string> = {
  NEW: "bg-violet-500/12 text-violet-600 dark:text-violet-300 border-violet-500/30",
  CONTACTED: "bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/30",
  QUALIFIED: "bg-sky-500/12 text-sky-700 dark:text-sky-300 border-sky-500/30",
  WON: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  LOST: "bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/30",
};

const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

function formatDate(value: string | null | undefined, full = false): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return (full ? dateTimeFmt : dateFmt).format(d);
}

function formatBrl(value: string | number | null | undefined): string {
  if (value == null) return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
}

function whatsappLink(value: string): string {
  const digits = value.replace(/\D+/g, "");
  return `https://wa.me/${digits}`;
}

export function LeadsPage() {
  const platformAdmin = useAuthStore((s) => s.user?.platformAdmin);

  const [items, setItems] = useState<LeadRow[]>([]);
  const [stats, setStats] = useState<LeadStats>({
    NEW: 0, CONTACTED: 0, QUALIFIED: 0, WON: 0, LOST: 0, TOTAL: 0,
  });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<LeadStatus | "ALL">("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null);
  const [editStatus, setEditStatus] = useState<LeadStatus>("NEW");
  const [editNotes, setEditNotes] = useState("");
  const [editLostReason, setEditLostReason] = useState("");
  const [savingLead, setSavingLead] = useState(false);
  const [deletingLead, setDeletingLead] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLeads({
        status: statusFilter,
        search: search.trim() || undefined,
        limit: 100,
      });
      setItems(data.items);
      setStats(data.stats);
      setTotal(data.total);
    } catch (e) {
      setError(getApiErrorMessage(e, "Não foi possível carregar leads"));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    void load();
  }, [load]);

  // Debounce de busca por 350ms
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const openLead = useCallback((lead: LeadRow) => {
    setSelectedLead(lead);
    setEditStatus(lead.status);
    setEditNotes(lead.notes ?? "");
    setEditLostReason(lead.lostReason ?? "");
  }, []);

  const closeLead = useCallback(() => {
    setSelectedLead(null);
    setSavingLead(false);
    setDeletingLead(false);
  }, []);

  const saveLead = useCallback(async () => {
    if (!selectedLead) return;
    setSavingLead(true);
    try {
      const { lead } = await patchLead(selectedLead.id, {
        status: editStatus,
        notes: editNotes.trim() || null,
        lostReason: editStatus === "LOST" ? editLostReason.trim() || null : null,
      });
      setItems((prev) => prev.map((it) => (it.id === lead.id ? lead : it)));
      setSelectedLead(lead);
      // recarrega stats
      void load();
    } catch (e) {
      setError(getApiErrorMessage(e, "Erro ao salvar"));
    } finally {
      setSavingLead(false);
    }
  }, [selectedLead, editStatus, editNotes, editLostReason, load]);

  const removeLead = useCallback(async () => {
    if (!selectedLead) return;
    if (!window.confirm(`Remover lead de ${selectedLead.fullName}? Esta ação não pode ser desfeita.`)) return;
    setDeletingLead(true);
    try {
      await deleteLead(selectedLead.id);
      setItems((prev) => prev.filter((it) => it.id !== selectedLead.id));
      closeLead();
      void load();
    } catch (e) {
      setError(getApiErrorMessage(e, "Erro ao remover"));
      setDeletingLead(false);
    }
  }, [selectedLead, closeLead, load]);

  const summaryCards = useMemo(
    () => [
      { key: "TOTAL", label: "Total", value: stats.TOTAL, icon: TrendingUp, tone: "text-foreground" },
      { key: "NEW", label: "Novos", value: stats.NEW, icon: Clock, tone: "text-violet-600 dark:text-violet-300" },
      { key: "CONTACTED", label: "Contatados", value: stats.CONTACTED, icon: MessageCircle, tone: "text-amber-700 dark:text-amber-300" },
      { key: "QUALIFIED", label: "Qualificados", value: stats.QUALIFIED, icon: Briefcase, tone: "text-sky-700 dark:text-sky-300" },
      { key: "WON", label: "Ganhos", value: stats.WON, icon: CheckCircle2, tone: "text-emerald-700 dark:text-emerald-300" },
      { key: "LOST", label: "Perdidos", value: stats.LOST, icon: XCircle, tone: "text-rose-700 dark:text-rose-300" },
    ],
    [stats]
  );

  if (platformAdmin === false) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Solicitações capturadas pelo formulário público em ativadash.com — qualifique, atribua e mova no funil.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="rounded-lg">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {summaryCards.map(({ key, label, value, icon: Icon, tone }) => (
          <Card key={key} className="rounded-xl border-border/55">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <p className={`text-2xl font-bold ${tone}`}>{value}</p>
              </div>
              <Icon className={`h-5 w-5 shrink-0 ${tone}`} />
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="rounded-2xl border-border/55">
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Funil comercial</CardTitle>
              <CardDescription>{total} {total === 1 ? "lead" : "leads"} {statusFilter === "ALL" ? "no total" : `em ${STATUS_FILTER_LABEL[statusFilter].toLowerCase()}`}</CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Buscar por nome, e-mail, WhatsApp..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="h-9 w-full pl-9 sm:w-72"
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUSES.map((st) => {
              const active = statusFilter === st;
              const count = st === "ALL" ? stats.TOTAL : stats[st as LeadStatus];
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    active
                      ? "border-primary bg-primary/15 text-foreground"
                      : "border-border/60 bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  }`}
                >
                  {STATUS_FILTER_LABEL[st]}
                  <span className={`rounded-full px-1.5 text-[10px] ${active ? "bg-primary/30" : "bg-muted/60"}`}>{count}</span>
                </button>
              );
            })}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="m-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300" role="alert">
              {error}
            </div>
          ) : null}
          {loading && !items.length ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/50" />
              ))}
            </div>
          ) : !items.length ? (
            <EmptyState
              icon={UserPlus}
              title="Nenhum lead aqui"
              description={
                statusFilter !== "ALL" || search
                  ? "Ajuste filtros ou aguarde novas solicitações da landing page."
                  : "Quando alguém preencher o formulário em ativadash.com, aparece aqui."
              }
              className="m-4"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/35 bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Lead</th>
                    <th className="px-4 py-3 font-semibold">Perfil</th>
                    <th className="px-4 py-3 font-semibold">Investimento</th>
                    <th className="px-4 py-3 font-semibold">Origem</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Recebido</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((lead) => (
                    <tr
                      key={lead.id}
                      className="cursor-pointer border-b border-border/30 last:border-b-0 hover:bg-muted/30"
                      onClick={() => openLead(lead)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{lead.fullName}</div>
                        <div className="text-xs text-muted-foreground">
                          {lead.email}
                          {lead.companyName ? ` · ${lead.companyName}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{LEAD_PROFILE_LABEL[lead.profile]}</td>
                      <td className="px-4 py-3 text-muted-foreground">{LEAD_BUDGET_LABEL[lead.monthlyAdsBudget]}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {lead.utmSource ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted/50 px-2 py-0.5 text-xs">
                            {lead.utmSource}
                            {lead.utmCampaign ? ` · ${lead.utmCampaign}` : ""}
                          </span>
                        ) : (
                          <span className="text-xs">Direto</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`border ${STATUS_TONE[lead.status]} px-2 py-0.5 text-[11px] font-semibold`} variant="outline">
                          {LEAD_STATUS_LABEL[lead.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">{formatDate(lead.createdAt, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selectedLead} onOpenChange={(o) => !o && closeLead()}>
        <SheetContent
          title={selectedLead?.fullName ?? "Lead"}
          description="Detalhes e edição do lead"
        >
          {selectedLead ? (
            <div className="space-y-5">
              <section className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <a href={`mailto:${selectedLead.email}`} className="truncate font-medium text-primary hover:underline">
                    {selectedLead.email}
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <a
                    href={whatsappLink(selectedLead.whatsapp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate font-medium text-primary hover:underline"
                  >
                    {selectedLead.whatsapp}
                  </a>
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </div>
                {selectedLead.companyName ? (
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">{selectedLead.companyName}</span>
                    {selectedLead.websiteUrl ? (
                      <>
                        {" · "}
                        <a href={selectedLead.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          {selectedLead.websiteUrl}
                        </a>
                      </>
                    ) : null}
                  </p>
                ) : null}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5" />
                  Recebido em {formatDate(selectedLead.createdAt, true)}
                </div>
              </section>

              <section className="grid grid-cols-2 gap-3 rounded-xl border border-border/40 bg-muted/20 p-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Perfil</p>
                  <p className="font-medium text-foreground">{LEAD_PROFILE_LABEL[selectedLead.profile]}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Investimento mensal</p>
                  <p className="font-medium text-foreground">{LEAD_BUDGET_LABEL[selectedLead.monthlyAdsBudget]}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Faturamento auto-relatado</p>
                  <p className="font-medium text-foreground">{formatBrl(selectedLead.monthlyRevenueBrl)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Contas gerenciadas</p>
                  <p className="font-medium text-foreground">{selectedLead.managedAccountsCount ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Time</p>
                  <p className="font-medium text-foreground">{selectedLead.teamSize ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Canal principal</p>
                  <p className="font-medium text-foreground">{selectedLead.primaryChannel ?? "—"}</p>
                </div>
              </section>

              {selectedLead.goal ? (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Objetivo</h3>
                  <p className="mt-1 whitespace-pre-wrap rounded-xl border border-border/40 bg-muted/20 p-3 text-sm text-foreground">
                    {selectedLead.goal}
                  </p>
                </section>
              ) : null}

              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Workflow</h3>

                <div className="space-y-1.5">
                  <Label htmlFor="lead-status" className="text-xs">Status</Label>
                  <select
                    id="lead-status"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as LeadStatus)}
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {Object.entries(LEAD_STATUS_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="lead-notes" className="text-xs">Notas internas</Label>
                  <textarea
                    id="lead-notes"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={4}
                    placeholder="Resumo da conversa, próximos passos, objeções..."
                    className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                {editStatus === "LOST" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="lead-lost-reason" className="text-xs">Motivo da perda</Label>
                    <textarea
                      id="lead-lost-reason"
                      value={editLostReason}
                      onChange={(e) => setEditLostReason(e.target.value)}
                      rows={2}
                      placeholder="Ex.: preço, tempo, escolheu concorrente"
                      className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button onClick={() => void saveLead()} disabled={savingLead} size="sm" className="rounded-lg">
                    {savingLead ? "Salvando..." : "Salvar"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={closeLead} className="rounded-lg">
                    Fechar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void removeLead()}
                    disabled={deletingLead}
                    className="ml-auto rounded-lg text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    {deletingLead ? "Removendo..." : "Remover"}
                  </Button>
                </div>
              </section>

              {selectedLead.utmSource || selectedLead.utmCampaign || selectedLead.referrer || selectedLead.pageUrl ? (
                <section className="space-y-1 rounded-xl border border-border/40 bg-muted/20 p-3 text-xs text-muted-foreground">
                  <p className="font-semibold uppercase tracking-wide text-muted-foreground">Tracking</p>
                  {selectedLead.utmSource ? <p>utm_source: <span className="text-foreground">{selectedLead.utmSource}</span></p> : null}
                  {selectedLead.utmMedium ? <p>utm_medium: <span className="text-foreground">{selectedLead.utmMedium}</span></p> : null}
                  {selectedLead.utmCampaign ? <p>utm_campaign: <span className="text-foreground">{selectedLead.utmCampaign}</span></p> : null}
                  {selectedLead.utmTerm ? <p>utm_term: <span className="text-foreground">{selectedLead.utmTerm}</span></p> : null}
                  {selectedLead.utmContent ? <p>utm_content: <span className="text-foreground">{selectedLead.utmContent}</span></p> : null}
                  {selectedLead.referrer ? <p className="break-all">referrer: <span className="text-foreground">{selectedLead.referrer}</span></p> : null}
                  {selectedLead.pageUrl ? <p className="break-all">page: <span className="text-foreground">{selectedLead.pageUrl}</span></p> : null}
                  {selectedLead.ipAddress ? <p>IP: <span className="text-foreground">{selectedLead.ipAddress}</span></p> : null}
                </section>
              ) : null}

              <section className="space-y-1 text-xs text-muted-foreground">
                <p className="font-semibold uppercase tracking-wide">Linha do tempo</p>
                <p>Criado: {formatDate(selectedLead.createdAt, true)}</p>
                {selectedLead.contactedAt ? <p>Contatado: {formatDate(selectedLead.contactedAt, true)}</p> : null}
                {selectedLead.qualifiedAt ? <p>Qualificado: {formatDate(selectedLead.qualifiedAt, true)}</p> : null}
                {selectedLead.wonAt ? <p>Ganho: {formatDate(selectedLead.wonAt, true)}</p> : null}
                {selectedLead.lostAt ? <p>Perdido: {formatDate(selectedLead.lostAt, true)}</p> : null}
              </section>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default LeadsPage;
