import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Pause, Play, SlidersHorizontal, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollRegion } from "@/components/ui/scroll-region";
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
} from "@/lib/marketing-contract-api";

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
}: {
  rows: OsCampaignRow[];
  goalMode: AccountObjective;
  targetCplBrl: number | null;
  maxCplBrl: number | null;
  targetRoas: number | null;
  periodDays: number;
  canMutateCampaigns: boolean;
  mutatingAdsKey: string | null;
  runMetaStatus: (id: string, next: "PAUSED" | "ACTIVE") => void;
  runGoogleStatus: (id: string, next: "PAUSED" | "ENABLED") => void;
  openBudgetDialog: (id: string, name: string) => void;
  onAfterMutation: () => void;
  platform?: "meta" | "google";
  onPlatformChange?: (p: "meta" | "google") => void;
  level?: "campaign" | "adset" | "ad";
  onLevelChange?: (l: "campaign" | "adset" | "ad") => void;
  hasMeta?: boolean;
  hasGoogle?: boolean;
  /** Meta + Google na mesma lista — oculta alternância de plataforma/nível. */
  combinedCampaignMode?: boolean;
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
        return n.includes(needle) || p.includes(needle);
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

  const runBulkPauseFixed = async () => {
    const targets = selectedRows.filter((r) => r.level === "campaign" && r.externalId);
    if (!targets.length) {
      setBulkHint("Selecione campanhas no nível Campanhas para pausar em massa.");
      return;
    }
    setBulkBusy(true);
    setBulkHint(null);
    let ok = 0;
    for (const r of targets) {
      try {
        if (r.channel === "Meta") {
          await patchMarketingMetaCampaignStatus(r.externalId!, "PAUSED");
        } else {
          await patchMarketingGoogleCampaignStatus(r.externalId!, "PAUSED");
        }
        ok++;
      } catch {
        /* um erro não bloqueia o restante */
      }
    }
    setBulkBusy(false);
    setBulkHint(`${ok} de ${targets.length} campanha(s) enviadas para pausa.`);
    setSelected(new Set());
    onAfterMutation();
  };

  const runBulkBudgetFactor = async (factor: number) => {
    const targets = selectedRows.filter((r) => r.channel === "Meta" && r.level === "campaign" && r.externalId);
    if (!targets.length) {
      setBulkHint("Escalar/reduzir em massa: só campanhas Meta neste nível.");
      return;
    }
    const days = Math.max(1, periodDays);
    setBulkBusy(true);
    setBulkHint(null);
    let ok = 0;
    for (const r of targets) {
      const pace = r.spend / days;
      const next = Math.max(5, Math.round(pace * factor * 100) / 100);
      try {
        await patchMarketingMetaCampaignBudget(r.externalId!, next);
        ok++;
      } catch {
        /* continue */
      }
    }
    setBulkBusy(false);
    setBulkHint(`${ok} orçamento(s) diário(s) ajustados (~${factor > 1 ? "+" : ""}${Math.round((factor - 1) * 100)}% sobre ritmo do período).`);
    setSelected(new Set());
    onAfterMutation();
  };

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
              className="h-9 rounded-lg"
              placeholder="Buscar campanha…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
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
          {(
            [
              ["all", "Todas"],
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

        {!hasDeliveryStatus ? (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Filtros <span className="font-medium text-foreground/80">Ativas</span> e{" "}
            <span className="font-medium text-foreground/80">Pausadas</span> ficam indisponíveis quando a API não
            envia status de entrega neste recorte (ex.: Meta). Use{" "}
            <span className="font-medium text-foreground/80">Todas</span> e decida por CPL, volume e status
            inteligente — ou confira pausas no gerenciador.
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/40 pt-3">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Ordenar:</span>
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
              className="h-8 rounded-md px-2.5 text-xs font-semibold"
              onClick={() => setSortKey(k)}
            >
              {lab}
            </Button>
          ))}
        </div>

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
                onClick={() => void runBulkPauseFixed()}
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
                onClick={() => void runBulkBudgetFactor(1.2)}
              >
                Escalar +20%
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 rounded-lg text-xs font-semibold"
                disabled={bulkBusy || !someSelected}
                onClick={() => void runBulkBudgetFactor(0.8)}
              >
                Reduzir −20%
              </Button>
            </div>
            {bulkHint ? <p className="w-full text-xs text-muted-foreground">{bulkHint}</p> : null}
          </div>
        ) : null}
      </div>

      <ScrollRegion className="scrollbar-thin">
        <DataTablePremium
          stickyHeader
          zebra
          minHeight="min-h-[280px]"
          shellClassName="border-border/70 bg-card"
          className={cn(
            "min-w-[1180px] text-[13px]",
            "[&_tbody_tr]:border-border/50 [&_tbody_tr:hover]:bg-muted/50"
          )}
        >
          <thead>
            <tr>
              {canMutateCampaigns ? (
                <th className="w-10 text-center">
                  <span className="sr-only">Selecionar</span>
                </th>
              ) : null}
              <th className="text-left">Status</th>
              <th className="text-left">Ação sugerida</th>
              <th className="text-right">Score</th>
              <th className="sticky left-0 z-10 min-w-[200px] bg-card text-left shadow-[4px_0_12px_-8px_rgba(0,0,0,0.12)]">
                Nome
              </th>
              <th className="text-right">Invest.</th>
              <th className="text-right">Impr.</th>
              <th className="text-right">Cliques</th>
              <th className="text-right">CTR</th>
              <th className="text-right">CPC</th>
              <th className="text-right">{goalMode === "SALES" ? "Conv." : "Leads"}</th>
              <th className="text-right">{goalMode === "SALES" ? "CPA" : "CPL"}</th>
              <th className="text-right">Perda est.</th>
              <th className="text-right">Insight</th>
              {goalMode !== "LEADS" ? (
                <>
                  <th className="text-right">ROAS</th>
                  <th className="text-right">Receita</th>
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
                    <td className="text-center align-middle">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border"
                        checked={selected.has(row.id)}
                        onChange={() => toggleRow(row.id)}
                        aria-label={`Selecionar ${row.name}`}
                      />
                    </td>
                  ) : null}
                  <td className="align-middle">
                    <span
                      className={cn(
                        "inline-flex rounded-lg px-2 py-1 text-[11px] font-bold uppercase tracking-wide",
                        smartBadgeClass(sig.smart)
                      )}
                    >
                      {smartLabelPt(sig.smart)}
                    </span>
                  </td>
                  <td className="max-w-[200px] align-middle text-xs font-medium leading-snug text-foreground">
                    {sig.suggested}
                  </td>
                  <td className="text-right align-middle">
                    <span className="text-sm font-bold tabular-nums text-foreground">{sig.score}</span>
                    <span className="text-[10px] text-muted-foreground">/100</span>
                  </td>
                  <td
                    className={cn(
                      "sticky left-0 z-[1] max-w-[240px] bg-card py-2.5 align-middle shadow-[4px_0_12px_-8px_rgba(0,0,0,0.1)]"
                    )}
                  >
                    <div className="truncate font-semibold text-foreground">{row.name}</div>
                    {row.parentLabel ? (
                      <div className="truncate text-[11px] text-muted-foreground">{row.parentLabel}</div>
                    ) : null}
                    <div className="text-[10px] font-medium text-muted-foreground">{row.channel}</div>
                  </td>
                  <td className="text-right align-middle text-sm font-bold tabular-nums text-foreground">
                    {formatSpend(row.spend)}
                  </td>
                  <td className="text-right align-middle text-sm tabular-nums text-muted-foreground">
                    {formatNumber(row.impressions)}
                  </td>
                  <td className="text-right align-middle text-sm tabular-nums text-muted-foreground">
                    {formatNumber(row.clicks)}
                  </td>
                  <td className="text-right align-middle text-sm font-semibold tabular-nums text-foreground">
                    {sig.ctrPct != null ? `${sig.ctrPct.toFixed(2)}%` : "—"}
                  </td>
                  <td className="text-right align-middle text-sm tabular-nums text-muted-foreground">
                    {cpcRow != null ? formatSpend(cpcRow) : "—"}
                  </td>
                  <td className="text-right align-middle text-sm font-bold tabular-nums text-foreground">
                    {formatNumber(vol)}
                  </td>
                  <td className="text-right align-middle text-sm font-bold tabular-nums text-primary">
                    {sig.cpl != null ? formatSpend(sig.cpl) : "—"}
                  </td>
                  <td className="text-right align-middle text-xs tabular-nums text-rose-700 dark:text-rose-300">
                    {sig.lossEstimateBrl != null ? formatSpend(sig.lossEstimateBrl) : "—"}
                  </td>
                  <td className="max-w-[180px] align-middle text-[11px] leading-snug text-muted-foreground">
                    {sig.upliftHint ?? "—"}
                  </td>
                  {goalMode !== "LEADS" ? (
                    <>
                      <td className="text-right align-middle text-sm font-bold tabular-nums">
                        {roas != null ? `${roas.toFixed(2)}x` : "—"}
                      </td>
                      <td className="text-right align-middle text-sm tabular-nums">{formatSpend(row.revenue)}</td>
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
                            onClick={() => void runMetaStatus(ext, "PAUSED")}
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
                            onClick={() => void runMetaStatus(ext, "ACTIVE")}
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
                            onClick={() => openBudgetDialog(ext, row.name)}
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
                            onClick={() => void runGoogleStatus(ext, "PAUSED")}
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
                            onClick={() => void runGoogleStatus(ext, "ENABLED")}
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

      <p className="text-center text-[11px] text-muted-foreground">
        <Link to="/marketing/integracoes" className="font-semibold text-primary underline-offset-4 hover:underline">
          Integrações
        </Link>
        {" · "}
        <Link to="/marketing/configuracoes" className="font-semibold text-primary underline-offset-4 hover:underline">
          Metas
        </Link>
      </p>
    </div>
  );
}
