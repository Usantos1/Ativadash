import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Columns2,
  FileDown,
  Loader2,
  Pause,
  Pencil,
  Play,
  SlidersHorizontal,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollRegion } from "@/components/ui/scroll-region";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DataTablePremium } from "@/components/premium";
import { formatNumber, formatSpend } from "@/lib/metrics-format";
import { cn } from "@/lib/utils";
import type { AccountObjective } from "@/lib/business-goal-mode";
import {
  computeOsSignals,
  medianOf,
  sortOsRows,
  type OsCampaignRow,
  type SmartOperationalLabel,
} from "@/lib/marketing-campaign-os";
import {
  patchMarketingGoogleCampaignStatus,
  patchMarketingMetaCampaignBudget,
  patchMarketingMetaCampaignStatus,
  postMarketingCampaignRollback,
  type MarketingRollbackItem,
} from "@/lib/marketing-contract-api";
import { appendCampaignActionLog } from "@/lib/campaign-local-actions";
import { downloadCsv } from "@/lib/export-csv";
import { CampaignOsDetailSheet } from "@/components/marketing/CampaignOsDetailSheet";
import { upsertManualRevenue } from "@/lib/manual-revenue-api";

const OS_TABLE_COLS_KEY = "ativadash:os-table-cols";

type OsTableColKey =
  | "score"
  | "invest"
  | "impr"
  | "clicks"
  | "ctr"
  | "cpc"
  | "vol"
  | "cpl"
  | "perda"
  | "insight"
  | "roas"
  | "revenue";

const OS_COL_DEFS: { key: OsTableColKey; label: string }[] = [
  { key: "score", label: "Score" },
  { key: "invest", label: "Investimento" },
  { key: "impr", label: "Impressões" },
  { key: "clicks", label: "Cliques" },
  { key: "ctr", label: "CTR" },
  { key: "cpc", label: "CPC" },
  { key: "vol", label: "Leads / conv." },
  { key: "cpl", label: "CPL / CPA" },
  { key: "perda", label: "Perda est." },
  { key: "insight", label: "Insight" },
  { key: "roas", label: "ROAS" },
  { key: "revenue", label: "Receita" },
];

function loadOsColVisibility(): Record<OsTableColKey, boolean> {
  const all = (): Record<OsTableColKey, boolean> => ({
    score: true,
    invest: true,
    impr: true,
    clicks: true,
    ctr: true,
    cpc: true,
    vol: true,
    cpl: true,
    perda: true,
    insight: true,
    roas: true,
    revenue: true,
  });
  try {
    const raw = localStorage.getItem(OS_TABLE_COLS_KEY);
    if (!raw) return all();
    const o = JSON.parse(raw) as Record<string, boolean>;
    const base = all();
    for (const k of Object.keys(base) as OsTableColKey[]) {
      if (typeof o[k] === "boolean") base[k] = o[k];
    }
    return base;
  } catch {
    return all();
  }
}

function saveOsColVisibility(v: Record<OsTableColKey, boolean>) {
  try {
    localStorage.setItem(OS_TABLE_COLS_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

type StatusFilter = "all" | "active" | "paused";
/** all | com gasto ou lead/venda | só com conversão | gasto sem conversão */
type ResultFilter = "all" | "with_activity" | "with_conversion" | "no_conversion";

function isKnownDeliveryStatus(st: OsCampaignRow["effectiveStatus"]): boolean {
  return st === "ACTIVE" || st === "PAUSED" || st === "ARCHIVED";
}

function smartBadgeClass(s: SmartOperationalLabel): string {
  if (s === "escalar") return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 ring-1 ring-emerald-500/30";
  if (s === "pausar") return "bg-rose-500/15 text-rose-800 dark:text-rose-200 ring-1 ring-rose-500/30";
  return "bg-amber-500/20 text-amber-950 dark:text-amber-100 ring-1 ring-amber-500/35";
}

function smartLabelPt(s: SmartOperationalLabel): string {
  if (s === "escalar") return "🟢 Escalar";
  if (s === "pausar") return "🔴 Pausar";
  return "🟡 Ajustar";
}

function formatBrlOs(n: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

type OsConfirmState =
  | {
      kind: "single_meta";
      externalId: string;
      name: string;
      next: "PAUSED" | "ACTIVE";
      undo: MarketingRollbackItem;
      actionLabel: string;
      detail: ReactNode;
    }
  | {
      kind: "single_google";
      externalId: string;
      name: string;
      next: "PAUSED" | "ENABLED";
      undo: MarketingRollbackItem;
      actionLabel: string;
      detail: ReactNode;
    }
  | {
      kind: "bulk_pause";
      targets: OsCampaignRow[];
      detail: ReactNode;
    }
  | {
      kind: "bulk_budget";
      factor: number;
      targets: OsCampaignRow[];
      detail: ReactNode;
    };

export function MarketingCampaignsOsTable({
  rows,
  goalMode,
  targetCplBrl,
  maxCplBrl,
  targetRoas,
  periodDays,
  canMutateCampaigns,
  mutatingAdsKey,
  runMetaStatus,
  runGoogleStatus,
  openBudgetDialog,
  onAfterMutation,
  platform,
  onPlatformChange,
  level,
  onLevelChange,
  hasMeta,
  hasGoogle,
  combinedCampaignMode,
  onManualRevenueChange,
  forceShowRevenue,
}: {
  rows: OsCampaignRow[];
  goalMode: AccountObjective;
  targetCplBrl: number | null;
  maxCplBrl: number | null;
  targetRoas: number | null;
  periodDays: number;
  canMutateCampaigns: boolean;
  mutatingAdsKey: string | null;
  runMetaStatus: (id: string, next: "PAUSED" | "ACTIVE", campaignName?: string) => Promise<boolean>;
  runGoogleStatus: (id: string, next: "PAUSED" | "ENABLED", campaignName?: string) => Promise<boolean>;
  openBudgetDialog: (id: string, name: string, opts?: { estimatedDaily?: number }) => void;
  onAfterMutation: () => void;
  platform?: "meta" | "google";
  onPlatformChange?: (p: "meta" | "google") => void;
  level?: "campaign" | "adset" | "ad";
  onLevelChange?: (l: "campaign" | "adset" | "ad") => void;
  hasMeta?: boolean;
  hasGoogle?: boolean;
  /** Meta + Google na mesma lista — oculta alternância de plataforma/nível. */
  combinedCampaignMode?: boolean;
  /** Callback disparado quando uma receita manual é salva/removida. */
  onManualRevenueChange?: (campaignId?: string, amount?: number) => void;
  /** Forçar exibição das colunas ROAS/Receita mesmo em goalMode LEADS (ex.: página /receita). */
  forceShowRevenue?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("with_activity");
  const [sortKey, setSortKey] = useState<"spend" | "revenue" | "leads" | "cpl" | "ctr">("cpl");
  const [overrideCpl, setOverrideCpl] = useState<number | null>(null);
  const [overrideRoas, setOverrideRoas] = useState<number | null>(null);
  const [ruleCplInput, setRuleCplInput] = useState("");
  const [ruleRoasInput, setRuleRoasInput] = useState("");
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkHint, setBulkHint] = useState<string | null>(null);
  const [colVis, setColVis] = useState<Record<OsTableColKey, boolean>>(loadOsColVisibility);
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollHint, setScrollHint] = useState({ left: false, right: false });
  const [confirm, setConfirm] = useState<OsConfirmState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [undoState, setUndoState] = useState<{ items: MarketingRollbackItem[]; message: string } | null>(null);
  const [detailRow, setDetailRow] = useState<OsCampaignRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const pageSearchRef = useRef<HTMLInputElement>(null);
  const [editingRevId, setEditingRevId] = useState<string | null>(null);
  const [editingRevVal, setEditingRevVal] = useState("");
  const [revSaving, setRevSaving] = useState(false);
  const [revToast, setRevToast] = useState<string | null>(null);
  const revInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const focusSearch = () => {
      const el = pageSearchRef.current;
      if (!el) return;
      el.focus();
      el.select();
    };
    window.addEventListener("ativadash:focus-page-search", focusSearch);
    return () => window.removeEventListener("ativadash:focus-page-search", focusSearch);
  }, []);

  useEffect(() => {
    if (editingRevId && revInputRef.current) {
      revInputRef.current.focus();
      revInputRef.current.select();
    }
  }, [editingRevId]);

  useEffect(() => {
    if (!revToast) return;
    const t = window.setTimeout(() => setRevToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [revToast]);

  const openRevenueEdit = (rowId: string, currentRevenue: number) => {
    setEditingRevId(rowId);
    setEditingRevVal(currentRevenue > 0 ? String(currentRevenue) : "");
  };

  const cancelRevenueEdit = () => {
    setEditingRevId(null);
    setEditingRevVal("");
  };

  const saveManualRevenue = async (row: OsCampaignRow) => {
    const val = parseFloat(editingRevVal.replace(",", "."));
    if (!Number.isFinite(val) || val < 0) {
      cancelRevenueEdit();
      return;
    }
    if (!row.externalId) return;
    setRevSaving(true);
    try {
      await upsertManualRevenue(row.externalId, row.channel, val);
      setRevToast("Receita offline atribuída com sucesso. ROAS recalculado.");
      onManualRevenueChange?.(row.externalId, val);
    } catch {
      setRevToast("Erro ao salvar receita manual.");
    } finally {
      setRevSaving(false);
      setEditingRevId(null);
      setEditingRevVal("");
    }
  };

  useEffect(() => {
    if (!undoState) return;
    const t = window.setTimeout(() => setUndoState(null), 8000);
    return () => window.clearTimeout(t);
  }, [undoState]);

  const updateScrollHint = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setScrollHint({
      left: scrollLeft > 6,
      right: scrollLeft < scrollWidth - clientWidth - 6,
    });
  }, []);

  const toggleCol = (key: OsTableColKey) => {
    setColVis((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveOsColVisibility(next);
      return next;
    });
  };

  const effectiveCpl = overrideCpl ?? targetCplBrl;
  const effectiveRoas = overrideRoas ?? targetRoas;

  const applyRule = useCallback(() => {
    const cpl = parseFloat(ruleCplInput.replace(",", "."));
    const roasV = parseFloat(ruleRoasInput.replace(",", "."));
    if (Number.isFinite(cpl) && cpl > 0) setOverrideCpl(cpl);
    else setOverrideCpl(null);
    if (Number.isFinite(roasV) && roasV > 0) setOverrideRoas(roasV);
    else setOverrideRoas(null);
  }, [ruleCplInput, ruleRoasInput]);

  const needle = search.trim().toLowerCase();

  const cohortMedians = useMemo(() => {
    const cpls: number[] = [];
    const ctrs: number[] = [];
    for (const r of rows) {
      if (r.spend < 15) continue;
      const vol = goalMode === "SALES" ? (r.sales > 0 ? r.sales : r.leads) : r.leads;
      if (vol > 0 && r.spend > 0) cpls.push(r.spend / vol);
      if (r.impressions >= 300) ctrs.push((r.clicks / r.impressions) * 100);
    }
    return { medianCpl: medianOf(cpls), medianCtr: medianOf(ctrs) };
  }, [rows, goalMode]);

  const hasDeliveryStatus = useMemo(
    () => rows.some((r) => isKnownDeliveryStatus(r.effectiveStatus ?? null)),
    [rows]
  );

  useEffect(() => {
    if (!hasDeliveryStatus && statusFilter !== "all") setStatusFilter("all");
  }, [hasDeliveryStatus, statusFilter]);

  const filtered = useMemo(() => {
    let out = rows;
    if (needle) {
      out = out.filter((r) => {
        const n = r.name.toLowerCase();
        const p = (r.parentLabel || "").toLowerCase();
        const ext = (r.externalId || "").toLowerCase();
        const idLocal = r.id.toLowerCase();
        return n.includes(needle) || p.includes(needle) || ext.includes(needle) || idLocal.includes(needle);
      });
    }
    out = out.filter((r) => {
      if (statusFilter === "all") return true;
      if (!hasDeliveryStatus) return true;
      const st = r.effectiveStatus ?? null;
      if (statusFilter === "active") return st === "ACTIVE";
      return st === "PAUSED" || st === "ARCHIVED";
    });
    out = out.filter((r) => {
      const hasConv = r.leads > 0 || r.sales > 0;
      const hasAct = r.spend > 0.02 || hasConv;
      if (resultFilter === "all") return true;
      if (resultFilter === "with_activity") return hasAct;
      if (resultFilter === "with_conversion") return hasConv;
      return r.spend > 0.02 && !hasConv;
    });
    return out;
  }, [rows, needle, statusFilter, resultFilter, hasDeliveryStatus]);

  const sorted = useMemo(
    () => sortOsRows(filtered, goalMode, sortKey),
    [filtered, goalMode, sortKey]
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollHint();
    el.addEventListener("scroll", updateScrollHint, { passive: true });
    const ro = new ResizeObserver(() => updateScrollHint());
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollHint);
      ro.disconnect();
    };
  }, [updateScrollHint, rows.length, filtered.length, sorted.length]);

  const visibleIds = useMemo(() => new Set(sorted.map((r) => r.id)), [sorted]);
  const allSelected = sorted.length > 0 && sorted.every((r) => selected.has(r.id));
  const someSelected = sorted.some((r) => selected.has(r.id));

  useEffect(() => {
    const el = selectAllRef.current;
    if (el) el.indeterminate = someSelected && !allSelected;
  }, [someSelected, allSelected]);

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of visibleIds) next.delete(id);
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of visibleIds) next.add(id);
        return next;
      });
    }
  };

  const selectedRows = useMemo(
    () => sorted.filter((r) => selected.has(r.id)),
    [sorted, selected]
  );

  const requestMetaStatusConfirm = (externalId: string, name: string, next: "PAUSED" | "ACTIVE") => {
    const undo: MarketingRollbackItem =
      next === "PAUSED"
        ? { channel: "meta", externalId, metaStatus: "ACTIVE" }
        : { channel: "meta", externalId, metaStatus: "PAUSED" };
    setConfirm({
      kind: "single_meta",
      externalId,
      name,
      next,
      undo,
      actionLabel: next === "PAUSED" ? "Pausar campanha (Meta)" : "Ativar campanha (Meta)",
      detail:
        next === "PAUSED" ? (
          <p className="text-sm text-muted-foreground">
            A campanha <span className="font-semibold text-foreground">{name}</span> será pausada na Meta Ads. O tráfego
            pode interromper de imediato.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            A campanha <span className="font-semibold text-foreground">{name}</span> será reativada (ACTIVE) na Meta
            Ads.
          </p>
        ),
    });
  };

  const requestGoogleStatusConfirm = (externalId: string, name: string, next: "PAUSED" | "ENABLED") => {
    const undo: MarketingRollbackItem =
      next === "PAUSED"
        ? { channel: "google", externalId, googleStatus: "ENABLED" }
        : { channel: "google", externalId, googleStatus: "PAUSED" };
    setConfirm({
      kind: "single_google",
      externalId,
      name,
      next,
      undo,
      actionLabel: next === "PAUSED" ? "Pausar campanha (Google)" : "Ativar campanha (Google)",
      detail: (
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{name}</span> ·{" "}
          {next === "PAUSED" ? "Status atual na conta: ENABLED → PAUSED." : "Status: PAUSED → ENABLED."}
        </p>
      ),
    });
  };

  const requestBulkPauseConfirm = () => {
    const targets = selectedRows.filter((r) => r.level === "campaign" && r.externalId);
    if (!targets.length) {
      setBulkHint("Selecione campanhas no nível Campanhas para pausar em massa.");
      return;
    }
    setBulkHint(null);
    setConfirm({
      kind: "bulk_pause",
      targets,
      detail: (
        <p className="text-sm text-muted-foreground">
          Pausar <span className="font-semibold text-foreground">{targets.length}</span> campanha(s) selecionadas (Meta
          e Google). Esta ação afeta contas reais de anúncios.
        </p>
      ),
    });
  };

  const requestBulkBudgetConfirm = (factor: number) => {
    const targets = selectedRows.filter((r) => r.channel === "Meta" && r.level === "campaign" && r.externalId);
    if (!targets.length) {
      setBulkHint("Escalar/reduzir em massa: só campanhas Meta neste nível.");
      return;
    }
    const days = Math.max(1, periodDays);
    const lines: ReactNode[] = [];
    for (const r of targets) {
      const pace = r.spend / days;
      const nextB = Math.max(5, Math.round(pace * factor * 100) / 100);
      lines.push(
        <li key={r.id}>
          <span className="font-medium text-foreground">{r.name}</span>: orçamento diário estimado{" "}
          <span className="tabular-nums">{formatBrlOs(pace)}</span> →{" "}
          <span className="tabular-nums font-semibold">{formatBrlOs(nextB)}</span>
        </li>
      );
    }
    setBulkHint(null);
    setConfirm({
      kind: "bulk_budget",
      factor,
      targets,
      detail: (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            Ajuste ~{factor > 1 ? "+" : ""}
            {Math.round((factor - 1) * 100)}% sobre o ritmo de gasto do período ({days} dia(s)).
          </p>
          <ul className="max-h-48 list-inside list-disc space-y-1 overflow-y-auto">{lines}</ul>
        </div>
      ),
    });
  };

  const executeOsConfirm = async () => {
    if (!confirm) return;
    setConfirmBusy(true);
    try {
      if (confirm.kind === "single_meta") {
        const ok = await runMetaStatus(confirm.externalId, confirm.next, confirm.name);
        setConfirm(null);
        if (ok) {
          setUndoState({ items: [confirm.undo], message: "Alteração aplicada na Meta." });
          onAfterMutation();
        }
        return;
      }
      if (confirm.kind === "single_google") {
        const ok = await runGoogleStatus(confirm.externalId, confirm.next, confirm.name);
        setConfirm(null);
        if (ok) {
          setUndoState({ items: [confirm.undo], message: "Alteração aplicada no Google Ads." });
          onAfterMutation();
        }
        return;
      }
      if (confirm.kind === "bulk_pause") {
        setBulkBusy(true);
        setBulkHint(null);
        const undoItems: MarketingRollbackItem[] = [];
        for (const r of confirm.targets) {
          try {
            if (r.channel === "Meta") {
              await patchMarketingMetaCampaignStatus(r.externalId!, "PAUSED");
              undoItems.push({ channel: "meta", externalId: r.externalId!, metaStatus: "ACTIVE" });
              appendCampaignActionLog({
                at: new Date().toISOString(),
                channel: "Meta",
                externalId: r.externalId!,
                campaignName: r.name,
                kind: "pause",
              });
            } else {
              await patchMarketingGoogleCampaignStatus(r.externalId!, "PAUSED");
              undoItems.push({ channel: "google", externalId: r.externalId!, googleStatus: "ENABLED" });
              appendCampaignActionLog({
                at: new Date().toISOString(),
                channel: "Google",
                externalId: r.externalId!,
                campaignName: r.name,
                kind: "pause",
              });
            }
          } catch {
            /* skip */
          }
        }
        setBulkBusy(false);
        setBulkHint(`${undoItems.length} de ${confirm.targets.length} campanha(s) pausadas.`);
        setSelected(new Set());
        setConfirm(null);
        if (undoItems.length) setUndoState({ items: undoItems, message: "Pausas aplicadas." });
        onAfterMutation();
        return;
      }
      if (confirm.kind === "bulk_budget") {
        const days = Math.max(1, periodDays);
        setBulkBusy(true);
        setBulkHint(null);
        const undoItems: MarketingRollbackItem[] = [];
        let ok = 0;
        for (const r of confirm.targets) {
          const pace = r.spend / days;
          const nextB = Math.max(5, Math.round(pace * confirm.factor * 100) / 100);
          try {
            await patchMarketingMetaCampaignBudget(r.externalId!, nextB);
            undoItems.push({ channel: "meta", externalId: r.externalId!, dailyBudget: pace });
            appendCampaignActionLog({
              at: new Date().toISOString(),
              channel: "Meta",
              externalId: r.externalId!,
              campaignName: r.name,
              kind: "budget_set",
              detail: `Novo diário: ${nextB}`,
            });
            ok++;
          } catch {
            /* skip */
          }
        }
        setBulkBusy(false);
        setBulkHint(`${ok} orçamento(s) diário(s) ajustados.`);
        setSelected(new Set());
        setConfirm(null);
        if (undoItems.length) setUndoState({ items: undoItems, message: "Orçamentos Meta atualizados." });
        onAfterMutation();
      }
    } finally {
      setConfirmBusy(false);
    }
  };

  const handleUndo = async () => {
    if (!undoState) return;
    const items = undoState.items;
    setUndoState(null);
    try {
      const res = await postMarketingCampaignRollback(items);
      if (res.ok && !(res.errors?.length)) {
        onAfterMutation();
        setBulkHint("Alterações desfeitas.");
      } else {
        setBulkHint("Não foi possível desfazer todas as alterações.");
      }
    } catch {
      setBulkHint("Erro ao desfazer.");
    }
  };

  // As 4 primeiras colunas (checkbox, status, acao, nome) ficam congeladas
  // a esquerda APENAS a partir de lg (>=1024px). Em mobile/tablet elas somam
  // ~592px e ocupavam a tela toda, escondendo as colunas numericas mesmo
  // ao rolar para a direita. Em telas estreitas a tabela rola completa,
  // como uma planilha tradicional.
  const cbSticky =
    "w-10 min-w-[2.5rem] lg:sticky lg:left-0 lg:z-20 lg:border-r lg:border-border/30 lg:bg-card lg:shadow-[6px_0_16px_-8px_rgba(0,0,0,0.2)]";
  const statusSticky = canMutateCampaigns
    ? "w-36 min-w-[9rem] lg:sticky lg:left-10 lg:z-20 lg:border-r lg:border-border/40 lg:bg-card lg:shadow-[6px_0_16px_-8px_rgba(0,0,0,0.2)]"
    : "w-36 min-w-[9rem] lg:sticky lg:left-0 lg:z-20 lg:border-r lg:border-border/40 lg:bg-card lg:shadow-[6px_0_16px_-8px_rgba(0,0,0,0.2)]";
  const acaoSticky = canMutateCampaigns
    ? "w-[13rem] min-w-[13rem] max-w-[13rem] lg:sticky lg:left-[11.5rem] lg:z-20 lg:border-r lg:border-border/40 lg:bg-card lg:shadow-[6px_0_16px_-8px_rgba(0,0,0,0.2)]"
    : "w-[13rem] min-w-[13rem] max-w-[13rem] lg:sticky lg:left-[9rem] lg:z-20 lg:border-r lg:border-border/40 lg:bg-card lg:shadow-[6px_0_16px_-8px_rgba(0,0,0,0.2)]";
  const nomeSticky = canMutateCampaigns
    ? "min-w-[200px] max-w-[15rem] lg:sticky lg:left-[24.5rem] lg:z-20 lg:border-r lg:border-border/40 lg:bg-card lg:shadow-[6px_0_16px_-8px_rgba(0,0,0,0.2)]"
    : "min-w-[200px] max-w-[15rem] lg:sticky lg:left-[22rem] lg:z-20 lg:border-r lg:border-border/40 lg:bg-card lg:shadow-[6px_0_16px_-8px_rgba(0,0,0,0.2)]";

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-muted/[0.1] p-10 text-center text-sm text-muted-foreground">
        Nenhuma linha neste recorte.
      </div>
    );
  }

  const showOsToolbar =
    !combinedCampaignMode &&
    platform != null &&
    onPlatformChange != null &&
    level != null &&
    onLevelChange != null &&
    hasMeta != null &&
    hasGoogle != null;

  return (
    <TooltipProvider delayDuration={400}>
      <div className="space-y-4">
      <div className="rounded-2xl border border-border/55 bg-card/95 p-4 shadow-[var(--shadow-surface-sm)]">
        {showOsToolbar ? (
          <div className="mb-4 flex flex-col gap-3 border-b border-border/45 pb-4 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
              Controle
            </div>
            <div className="flex flex-wrap gap-1 rounded-lg border border-border/50 bg-background/90 p-1 shadow-inner">
              <Button
                type="button"
                size="sm"
                variant={platform === "meta" ? "default" : "ghost"}
                className="h-8 rounded-md px-3 text-xs font-bold"
                disabled={!hasMeta}
                onClick={() => onPlatformChange!("meta")}
              >
                Meta Ads
              </Button>
              <Button
                type="button"
                size="sm"
                variant={platform === "google" ? "default" : "ghost"}
                className="h-8 rounded-md px-3 text-xs font-bold"
                disabled={!hasGoogle}
                onClick={() => onPlatformChange!("google")}
              >
                Google Ads
              </Button>
            </div>
            <div className="flex flex-wrap gap-1 rounded-lg border border-border/50 bg-background/90 p-1 shadow-inner">
              {(
                [
                  ["campaign", "Campanhas"],
                  ["adset", "Conjuntos"],
                  ["ad", "Anúncios"],
                ] as const
              ).map(([v, lab]) => (
                <Button
                  key={v}
                  type="button"
                  size="sm"
                  variant={level === v ? "default" : "ghost"}
                  className="h-8 rounded-md px-3 text-xs font-bold"
                  onClick={() => onLevelChange!(v)}
                >
                  {lab}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:gap-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:items-end lg:gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                CPL meta (R$)
              </Label>
              <Input
                className="h-9 w-full rounded-lg sm:w-[7rem]"
                inputMode="decimal"
                placeholder={targetCplBrl != null ? String(targetCplBrl) : "—"}
                value={ruleCplInput}
                onChange={(e) => setRuleCplInput(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                ROAS meta (×)
              </Label>
              <Input
                className="h-9 w-full rounded-lg sm:w-[7rem]"
                inputMode="decimal"
                placeholder={targetRoas != null ? String(targetRoas) : "—"}
                value={ruleRoasInput}
                onChange={(e) => setRuleRoasInput(e.target.value)}
              />
            </div>
            <Button type="button" size="sm" variant="secondary" className="h-9 rounded-lg font-semibold" onClick={applyRule}>
              Aplicar regra
            </Button>
          </div>
          <div className="min-w-0 flex-1 space-y-1 lg:min-w-[200px]">
            <Label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Buscar campanha
            </Label>
            <Input
              ref={pageSearchRef}
              id="ativadash-page-search"
              className="h-9 rounded-lg"
              placeholder="Nome, ID ou conjunto…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar na tabela de campanhas"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-border/40 pt-3 lg:flex-row lg:flex-wrap lg:items-start lg:gap-x-6 lg:gap-y-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Status</span>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["all", "Todas"],
                  ["active", "Ativas"],
                  ["paused", "Pausadas"],
                ] as const
              ).map(([id, label]) => (
                <Button
                  key={id}
                  type="button"
                  size="sm"
                  variant={statusFilter === id ? "default" : "outline"}
                  className="h-8 rounded-full px-3 text-xs font-semibold"
                  disabled={id !== "all" && !hasDeliveryStatus}
                  title={
                    id !== "all" && !hasDeliveryStatus
                      ? "Nenhuma linha trouxe status ACTIVE/PAUSED da integração neste recorte (comum na Meta). Use Todas e filtre por métricas."
                      : undefined
                  }
                  onClick={() => setStatusFilter(id)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="hidden self-stretch border-l border-border/40 lg:block" aria-hidden />

          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Resultado</span>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["all", "Todos"],
                  ["with_activity", "Com gasto ou lead"],
                  ["with_conversion", "Só com conversão"],
                  ["no_conversion", "Gasto sem conversão"],
                ] as const
              ).map(([id, label]) => (
                <Button
                  key={id}
                  type="button"
                  size="sm"
                  variant={resultFilter === id ? "default" : "outline"}
                  className="h-8 rounded-full px-3 text-xs font-semibold"
                  onClick={() => setResultFilter(id)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="hidden self-stretch border-l border-border/40 lg:block" aria-hidden />

          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Ordenar por</span>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["spend", "Investimento"],
                  ["cpl", "CPL"],
                  ["leads", goalMode === "SALES" ? "Compras" : "Leads"],
                  ["ctr", "CTR"],
                  ["revenue", "Receita"],
                ] as const
              ).map(([k, lab]) => (
                <Button
                  key={k}
                  type="button"
                  size="sm"
                  variant={sortKey === k ? "default" : "outline"}
                  className="h-8 rounded-full px-3 text-xs font-semibold"
                  onClick={() => setSortKey(k)}
                >
                  {lab}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {!hasDeliveryStatus ? (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Filtros <span className="font-medium text-foreground/80">Ativas</span> e{" "}
            <span className="font-medium text-foreground/80">Pausadas</span> ficam indisponíveis quando a API não
            envia status de entrega neste recorte (ex.: Meta). Use{" "}
            <span className="font-medium text-foreground/80">Todas</span> e decida por CPL, volume e status
            inteligente — ou confira pausas no gerenciador.
          </p>
        ) : null}

        {canMutateCampaigns ? (
          <div className="mt-4 flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/[0.04] p-3 sm:flex-row sm:flex-wrap sm:items-center">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
              <input
                ref={selectAllRef}
                type="checkbox"
                className="h-4 w-4 rounded border-border"
                checked={allSelected}
                onChange={toggleAll}
              />
              Selecionar visíveis ({sorted.length})
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="h-8 rounded-lg text-xs font-semibold"
                disabled={bulkBusy || !someSelected}
                onClick={() => requestBulkPauseConfirm()}
              >
                {bulkBusy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                Pausar selecionadas
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 rounded-lg text-xs font-semibold"
                disabled={bulkBusy || !someSelected}
                onClick={() => requestBulkBudgetConfirm(1.2)}
              >
                Escalar +20%
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 rounded-lg text-xs font-semibold"
                disabled={bulkBusy || !someSelected}
                onClick={() => requestBulkBudgetConfirm(0.8)}
              >
                Reduzir −20%
              </Button>
            </div>
            {bulkHint ? <p className="w-full text-xs text-muted-foreground">{bulkHint}</p> : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-lg text-xs"
          onClick={() => {
            const days = Math.max(1, periodDays);
            downloadCsv(
              `central-controle-${new Date().toISOString().slice(0, 10)}.csv`,
              sorted.map((r) => ({
                canal: r.channel,
                nivel: r.level,
                nome: r.name,
                conjunto_pai: r.parentLabel ?? "",
                id_externo: r.externalId ?? "",
                id_linha: r.id,
                gasto_brl: Math.round(r.spend * 100) / 100,
                impressoes: r.impressions,
                cliques: r.clicks,
                leads: r.leads,
                vendas: r.sales,
                receita_brl: Math.round(r.revenue * 100) / 100,
                ritmo_diario_ref_brl: Math.round((r.spend / days) * 100) / 100,
              }))
            );
          }}
        >
          <FileDown className="mr-1.5 h-3.5 w-3.5" />
          Exportar CSV
        </Button>
        <div className="relative">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-lg text-xs"
            onClick={() => setColMenuOpen((v) => !v)}
          >
            <Columns2 className="mr-1.5 h-3.5 w-3.5" />
            Colunas
          </Button>
          {colMenuOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40 cursor-default bg-transparent"
                aria-label="Fechar menu de colunas"
                onClick={() => setColMenuOpen(false)}
              />
              <div className="absolute right-0 z-50 mt-1 w-56 rounded-xl border border-border/80 bg-popover p-3 shadow-lg">
                <p className="mb-2 text-[10px] font-bold uppercase text-muted-foreground">Métricas visíveis</p>
                <ul className="max-h-56 space-y-1.5 overflow-y-auto">
                  {OS_COL_DEFS.filter(
                    (c) => forceShowRevenue || goalMode !== "LEADS" || (c.key !== "roas" && c.key !== "revenue")
                  ).map((c) => (
                    <li key={c.key}>
                      <label className="flex cursor-pointer items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border-border"
                          checked={colVis[c.key]}
                          onChange={() => toggleCol(c.key)}
                        />
                        {c.label}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="relative min-w-0">
        {scrollHint.left ? (
          <div
            className="pointer-events-none absolute left-0 top-0 z-[25] flex h-full w-10 items-center justify-start bg-gradient-to-r from-card from-40% to-transparent pl-1"
            aria-hidden
          >
            <ChevronLeft className="h-4 w-4 text-muted-foreground/70" />
          </div>
        ) : null}
        {scrollHint.right ? (
          <div
            className="pointer-events-none absolute right-0 top-0 z-[25] flex h-full w-10 items-center justify-end bg-gradient-to-l from-card from-40% to-transparent pr-1"
            aria-hidden
          >
            <ChevronRight className="h-4 w-4 text-muted-foreground/70" />
          </div>
        ) : null}
        <ScrollRegion ref={scrollRef} className="scrollbar-thin">
        <DataTablePremium
          stickyHeader
          zebra
          minHeight="min-h-[280px]"
          shellClassName="border-border/70 bg-card"
          className={cn(
            "min-w-[1180px] text-[13px]",
            "[&_thead_th]:bg-card",
            "[&_tbody_tr]:border-border/50 [&_tbody_tr:hover]:bg-muted/50"
          )}
        >
          <thead>
            <tr>
              {canMutateCampaigns ? (
                <th className={cn(cbSticky, "text-center")}>
                  <span className="sr-only">Selecionar</span>
                </th>
              ) : null}
              <th className={cn(statusSticky, "text-left")}>Status</th>
              <th className={cn(acaoSticky, "text-left")}>Ação sugerida</th>
              <th className={cn(nomeSticky, "text-left")}>Nome</th>
              {colVis.score ? <th className="text-right">Score</th> : null}
              {colVis.invest ? <th className="text-right">Invest.</th> : null}
              {colVis.impr ? <th className="text-right">Impr.</th> : null}
              {colVis.clicks ? <th className="text-right">Cliques</th> : null}
              {colVis.ctr ? <th className="text-right">CTR</th> : null}
              {colVis.cpc ? <th className="text-right">CPC</th> : null}
              {colVis.vol ? (
                <th className="text-right">{goalMode === "SALES" ? "Conv." : "Leads"}</th>
              ) : null}
              {colVis.cpl ? (
                <th className="text-right">{goalMode === "SALES" ? "CPA" : "CPL"}</th>
              ) : null}
              {colVis.perda ? <th className="text-right">Perda est.</th> : null}
              {colVis.insight ? <th className="text-right">Insight</th> : null}
              {forceShowRevenue || goalMode !== "LEADS" ? (
                <>
                  {colVis.roas ? <th className="text-right">ROAS</th> : null}
                  {colVis.revenue ? <th className="text-right">Receita</th> : null}
                </>
              ) : null}
              {canMutateCampaigns ? <th className="text-right">Ações</th> : null}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const sig = computeOsSignals(row, goalMode, {
                targetCpl: effectiveCpl,
                targetRoas: effectiveRoas,
                maxCpl: maxCplBrl,
                medianCpl: cohortMedians.medianCpl,
                medianCtr: cohortMedians.medianCtr,
              });
              const ext = row.externalId;
              const gBusy = ext && mutatingAdsKey?.startsWith(`google:${ext}:`);
              const mBusy = ext && mutatingAdsKey?.startsWith(`meta:${ext}:`);
              const roas = row.spend > 0 && row.revenue > 0 ? row.revenue / row.spend : null;
              const vol =
                goalMode === "SALES" ? (row.sales > 0 ? row.sales : row.leads) : row.leads;
              const cpcRow = row.clicks > 0 && row.spend > 0 ? row.spend / row.clicks : null;

              return (
                <tr key={row.id} className="border-b border-border/40">
                  {canMutateCampaigns ? (
                    <td className={cn(cbSticky, "text-center align-middle")}>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border"
                        checked={selected.has(row.id)}
                        onChange={() => toggleRow(row.id)}
                        aria-label={`Selecionar ${row.name}`}
                      />
                    </td>
                  ) : null}
                  <td className={cn(statusSticky, "align-middle")}>
                    <span
                      className={cn(
                        "inline-flex rounded-lg px-2 py-1 text-[11px] font-bold uppercase tracking-wide",
                        smartBadgeClass(sig.smart)
                      )}
                    >
                      {smartLabelPt(sig.smart)}
                    </span>
                  </td>
                  <td className={cn(acaoSticky, "max-w-[200px] align-middle text-xs font-medium leading-snug text-foreground")}>
                    {sig.suggested}
                  </td>
                  <td className={cn(nomeSticky, "py-2.5 align-middle")}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="min-w-0 w-full cursor-pointer rounded-md text-left outline-none ring-offset-background hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => {
                            setDetailRow(row);
                            setDetailOpen(true);
                          }}
                        >
                          <div className="truncate font-semibold text-foreground">{row.name}</div>
                          {row.parentLabel ? (
                            <div className="truncate text-[11px] text-muted-foreground">{row.parentLabel}</div>
                          ) : null}
                          <div className="text-[10px] font-medium text-muted-foreground">{row.channel}</div>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-sm">
                        <p className="font-semibold leading-snug">{row.name}</p>
                        {row.parentLabel ? (
                          <p className="mt-1 text-muted-foreground">{row.parentLabel}</p>
                        ) : null}
                      </TooltipContent>
                    </Tooltip>
                  </td>
                  {colVis.score ? (
                    <td className="text-right align-middle">
                      <span className="text-sm font-bold tabular-nums text-foreground">{sig.score}</span>
                      <span className="text-[10px] text-muted-foreground">/100</span>
                    </td>
                  ) : null}
                  {colVis.invest ? (
                    <td className="text-right align-middle text-sm font-bold tabular-nums text-foreground">
                      {formatSpend(row.spend)}
                    </td>
                  ) : null}
                  {colVis.impr ? (
                    <td className="text-right align-middle text-sm tabular-nums text-muted-foreground">
                      {formatNumber(row.impressions)}
                    </td>
                  ) : null}
                  {colVis.clicks ? (
                    <td className="text-right align-middle text-sm tabular-nums text-muted-foreground">
                      {formatNumber(row.clicks)}
                    </td>
                  ) : null}
                  {colVis.ctr ? (
                    <td className="text-right align-middle text-sm font-semibold tabular-nums text-foreground">
                      {sig.ctrPct != null ? `${sig.ctrPct.toFixed(2)}%` : "—"}
                    </td>
                  ) : null}
                  {colVis.cpc ? (
                    <td className="text-right align-middle text-sm tabular-nums text-muted-foreground">
                      {cpcRow != null ? formatSpend(cpcRow) : "—"}
                    </td>
                  ) : null}
                  {colVis.vol ? (
                    <td className="text-right align-middle text-sm font-bold tabular-nums text-foreground">
                      {formatNumber(vol)}
                    </td>
                  ) : null}
                  {colVis.cpl ? (
                    <td className="text-right align-middle text-sm font-bold tabular-nums text-primary">
                      {sig.cpl != null ? formatSpend(sig.cpl) : "—"}
                    </td>
                  ) : null}
                  {colVis.perda ? (
                    <td className="text-right align-middle text-xs tabular-nums text-rose-700 dark:text-rose-300">
                      {sig.lossEstimateBrl != null ? formatSpend(sig.lossEstimateBrl) : "—"}
                    </td>
                  ) : null}
                  {colVis.insight ? (
                    <td className="max-w-[180px] align-middle text-[11px] leading-snug text-muted-foreground">
                      {sig.upliftHint ?? "—"}
                    </td>
                  ) : null}
                  {forceShowRevenue || goalMode !== "LEADS" ? (
                    <>
                      {colVis.roas ? (
                        <td className="text-right align-middle text-sm font-bold tabular-nums">
                          {roas != null ? `${roas.toFixed(2)}x` : "—"}
                        </td>
                      ) : null}
                      {colVis.revenue ? (
                        <td className="text-right align-middle text-sm tabular-nums">
                          {editingRevId === row.id ? (
                            <form
                              className="inline-flex items-center gap-1"
                              onSubmit={(e) => {
                                e.preventDefault();
                                void saveManualRevenue(row);
                              }}
                            >
                              <input
                                ref={revInputRef}
                                type="text"
                                inputMode="decimal"
                                className="h-7 w-24 rounded-md border border-primary/40 bg-background px-2 text-right text-sm tabular-nums outline-none ring-1 ring-primary/20 focus:ring-2 focus:ring-primary"
                                value={editingRevVal}
                                onChange={(e) => setEditingRevVal(e.target.value)}
                                disabled={revSaving}
                                onKeyDown={(e) => e.key === "Escape" && cancelRevenueEdit()}
                              />
                              <button
                                type="submit"
                                disabled={revSaving}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                                title="Salvar"
                              >
                                {revSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                              </button>
                              <button
                                type="button"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                                title="Cancelar"
                                onClick={cancelRevenueEdit}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </form>
                          ) : row.level === "campaign" && row.externalId && row.revenue === 0 ? (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-lg border border-dashed border-primary/40 bg-primary/[0.06] px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:border-primary/70 hover:bg-primary/[0.12]"
                              onClick={() => openRevenueEdit(row.id, 0)}
                            >
                              <Pencil className="h-3 w-3" />
                              Adicionar
                            </button>
                          ) : (
                            <span
                              className="group inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors hover:bg-muted/60"
                              role="button"
                              tabIndex={0}
                              onClick={() => row.level === "campaign" && row.externalId && openRevenueEdit(row.id, row.manualRevenue ?? 0)}
                              onKeyDown={(e) => e.key === "Enter" && row.level === "campaign" && row.externalId && openRevenueEdit(row.id, row.manualRevenue ?? 0)}
                            >
                              {row.revenue > 0 ? formatSpend(row.revenue) : "—"}
                              {row.manualRevenue != null && row.manualRevenue > 0 ? (
                                <span className="ml-1 inline-block rounded border border-primary/30 bg-primary/10 px-1 py-px text-[9px] font-bold uppercase text-primary">
                                  Manual
                                </span>
                              ) : null}
                              {row.level === "campaign" && row.externalId ? (
                                <Pencil className="ml-0.5 h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                              ) : null}
                            </span>
                          )}
                        </td>
                      ) : null}
                    </>
                  ) : null}
                  {canMutateCampaigns ? (
                    <td className="text-right align-middle">
                      {row.level !== "campaign" || !ext ? (
                        <span className="text-[10px] text-muted-foreground">Nível campanha</span>
                      ) : row.channel === "Meta" ? (
                        <div className="inline-flex flex-wrap justify-end gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Pausar"
                            disabled={!!mBusy}
                            onClick={(e) => {
                              e.stopPropagation();
                              requestMetaStatusConfirm(ext, row.name, "PAUSED");
                            }}
                          >
                            {mBusy && mutatingAdsKey === `meta:${ext}:PAUSED` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Pause className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Ativar"
                            disabled={!!mBusy}
                            onClick={(e) => {
                              e.stopPropagation();
                              requestMetaStatusConfirm(ext, row.name, "ACTIVE");
                            }}
                          >
                            {mBusy && mutatingAdsKey === `meta:${ext}:ACTIVE` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Orçamento"
                            disabled={!!mBusy}
                            onClick={(e) => {
                              e.stopPropagation();
                              openBudgetDialog(ext, row.name, {
                                estimatedDaily: row.spend / Math.max(1, periodDays),
                              });
                            }}
                          >
                            <Wallet className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="inline-flex justify-end gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={!!gBusy}
                            onClick={(e) => {
                              e.stopPropagation();
                              requestGoogleStatusConfirm(ext, row.name, "PAUSED");
                            }}
                          >
                            {gBusy && mutatingAdsKey === `google:${ext}:PAUSED` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Pause className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={!!gBusy}
                            onClick={(e) => {
                              e.stopPropagation();
                              requestGoogleStatusConfirm(ext, row.name, "ENABLED");
                            }}
                          >
                            {gBusy && mutatingAdsKey === `google:${ext}:ENABLED` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </DataTablePremium>
      </ScrollRegion>
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        <Link to="/marketing/integracoes" className="font-semibold text-primary underline-offset-4 hover:underline">
          Integrações
        </Link>
        {" · "}
        <Link to="/ads/metas-alertas" className="font-semibold text-primary underline-offset-4 hover:underline">
          Automação e Metas
        </Link>
      </p>
      </div>

      <Dialog
        open={confirm != null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <DialogContent
          className="max-w-lg"
          showClose
          description="Revise o impacto antes de confirmar. As alterações são enviadas às APIs Meta e Google Ads."
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {confirm?.kind === "single_meta" || confirm?.kind === "single_google"
                ? confirm.actionLabel
                : confirm?.kind === "bulk_pause"
                  ? `Pausar ${confirm.targets.length} campanha(s)`
                  : confirm?.kind === "bulk_budget"
                    ? confirm.factor > 1
                      ? `Escalar orçamento (+${Math.round((confirm.factor - 1) * 100)}%)`
                      : `Reduzir orçamento (${Math.round((confirm.factor - 1) * 100)}%)`
                    : "Confirmar ação"}
            </DialogTitle>
          </DialogHeader>
          {confirm ? <div className="space-y-3">{confirm.detail}</div> : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="rounded-lg" autoFocus onClick={() => setConfirm(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={confirmBusy}
              variant={
                confirm &&
                (confirm.kind === "bulk_pause" ||
                  (confirm.kind === "single_meta" && confirm.next === "PAUSED") ||
                  (confirm.kind === "single_google" && confirm.next === "PAUSED"))
                  ? "destructive"
                  : "default"
              }
              className={cn(
                "rounded-lg",
                confirm &&
                  ((confirm.kind === "single_meta" && confirm.next === "ACTIVE") ||
                    (confirm.kind === "single_google" && confirm.next === "ENABLED") ||
                    (confirm.kind === "bulk_budget" && confirm.factor > 1)) &&
                  "bg-emerald-600 text-white hover:bg-emerald-700",
                confirm?.kind === "bulk_budget" &&
                  confirm.factor < 1 &&
                  "border border-amber-600/40 bg-amber-500/15 text-amber-950 hover:bg-amber-500/25 dark:text-amber-50"
              )}
              onClick={() => void executeOsConfirm()}
            >
              {confirmBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CampaignOsDetailSheet
        row={detailRow}
        open={detailOpen}
        onOpenChange={(v) => {
          setDetailOpen(v);
          if (!v) setDetailRow(null);
        }}
        periodDays={periodDays}
        onOpenBudget={openBudgetDialog}
      />

      {undoState ? (
        <div className="fixed bottom-6 left-1/2 z-[100] flex max-w-md -translate-x-1/2 items-center gap-3 rounded-xl border border-border/80 bg-popover px-4 py-3 text-sm shadow-lg">
          <span className="text-muted-foreground">{undoState.message}</span>
          <Button type="button" size="sm" variant="secondary" className="rounded-lg" onClick={() => void handleUndo()}>
            Desfazer
          </Button>
        </div>
      ) : null}

      {revToast ? (
        <div className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 animate-[slideUp_0.3s_ease-out] rounded-xl border border-emerald-500/40 bg-emerald-500/[0.12] px-5 py-3 text-sm font-medium text-emerald-900 shadow-lg backdrop-blur-md dark:text-emerald-100">
          {revToast}
        </div>
      ) : null}
    </TooltipProvider>
  );
}
