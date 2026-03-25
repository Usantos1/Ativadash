import { useEffect, useMemo, useState, type ReactNode } from "react";
import { formatNumber, formatPercent, formatSpend } from "@/lib/metrics-format";
import { cn } from "@/lib/utils";
import type { MarketingDashboardPerfRow } from "@/lib/marketing-dashboard-api";
import type { BusinessGoalMode } from "@/lib/business-goal-mode";
import { DataTablePremium } from "@/components/premium";
import { EntityTableToolbar } from "@/components/premium/entity-table-toolbar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  applyPerfTablePipeline,
  buildPerfHighlights,
  type PerfDeliveryFilter,
  type PerfHighlightFlags,
  type PerfSortKey,
  type PerfStatusFilter,
  type PerfUiStatus,
  resolvePerfUiStatus,
} from "@/lib/dashboard-performance-table-utils";

const DISPLAY_CAP = 120;

type Level = "campaign" | "adset" | "ad";

function RowChrome({ flags }: { flags: PerfHighlightFlags }) {
  if (!flags.bestCpl && !flags.maxSpend && !flags.weakCtr) return null;
  return (
    <span className="ml-1.5 inline-flex flex-wrap gap-1 align-middle">
      {flags.bestCpl ? (
        <span className="rounded-md border border-emerald-500/25 bg-emerald-500/12 px-1.5 py-0 text-[9px] font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-100">
          CPL
        </span>
      ) : null}
      {flags.maxSpend ? (
        <span className="rounded-md border border-sky-500/25 bg-sky-500/10 px-1.5 py-0 text-[9px] font-bold uppercase tracking-wide text-sky-950 dark:text-sky-100">
          Top $
        </span>
      ) : null}
      {flags.weakCtr ? (
        <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0 text-[9px] font-bold uppercase tracking-wide text-amber-950 dark:text-amber-100">
          CTR
        </span>
      ) : null}
    </span>
  );
}

function StatusPill({ kind }: { kind: PerfUiStatus }) {
  const styles: Record<PerfUiStatus, string> = {
    sem_entrega:
      "border-border/60 bg-muted/50 text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
    atencao: "border-amber-500/40 bg-amber-500/[0.14] text-amber-950 dark:text-amber-50",
    ativa: "border-emerald-500/45 bg-emerald-500/[0.14] text-emerald-950 dark:text-emerald-100",
    pausada: "border-slate-400/40 bg-slate-500/[0.12] text-slate-900 dark:text-slate-100",
    arquivada: "border-border/55 bg-muted/35 text-muted-foreground",
    desconhecida: "border-dashed border-border/70 bg-background/80 text-muted-foreground",
  };
  const labels: Record<PerfUiStatus, string> = {
    sem_entrega: "Sem entrega",
    atencao: "Atenção",
    ativa: "Ativa",
    pausada: "Pausada",
    arquivada: "Arquivada",
    desconhecida: "Estado",
  };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide",
        styles[kind]
      )}
    >
      {labels[kind]}
    </span>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-[140px] flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/90">{label}</span>
      {children}
    </div>
  );
}

export function DashboardPerformanceTable({
  rows,
  labelEmpty,
  nameHeader,
  subNameKey,
  subNameHeader,
  businessGoalMode,
  levelLabel,
  filterResetKey,
}: {
  rows: MarketingDashboardPerfRow[];
  labelEmpty: string;
  nameHeader: string;
  subNameKey?: "campaign" | "adset";
  /** Sobrescreve o rótulo da coluna pai (ex.: campanha · grupo). */
  subNameHeader?: string;
  businessGoalMode: BusinessGoalMode;
  /** Ex.: "Campanhas" — reforça contexto de nível junto à tabela. */
  levelLabel?: string;
  /** Ao mudar (troca de aba / plataforma), filtros voltam ao padrão operacional. */
  filterResetKey?: string;
}) {
  const [statusFilter, setStatusFilter] = useState<PerfStatusFilter>("all");
  const [deliveryFilter, setDeliveryFilter] = useState<PerfDeliveryFilter>("with");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<PerfSortKey>("spend");

  useEffect(() => {
    if (filterResetKey === undefined) return;
    setStatusFilter("all");
    setDeliveryFilter("with");
    setSearch("");
    setSortKey("spend");
  }, [filterResetKey]);

  const filteredSorted = useMemo(
    () =>
      applyPerfTablePipeline(rows, {
        status: statusFilter,
        delivery: deliveryFilter,
        search,
        sort: sortKey,
        mode: businessGoalMode,
      }),
    [rows, statusFilter, deliveryFilter, search, sortKey, businessGoalMode]
  );

  const highlights = useMemo(
    () => buildPerfHighlights(filteredSorted, businessGoalMode),
    [filteredSorted, businessGoalMode]
  );

  const displayRows = useMemo(() => filteredSorted.slice(0, DISPLAY_CAP), [filteredSorted]);

  const subHeader =
    subNameHeader ?? (subNameKey === "campaign" ? "Campanha" : subNameKey === "adset" ? "Conjunto" : null);

  const sortEfficiencyLabel =
    businessGoalMode === "SALES"
      ? "CPA (melhor primeiro)"
      : businessGoalMode === "LEADS"
        ? "CPL (melhor primeiro)"
        : "CPL / CPA";

  const convSortLabel =
    businessGoalMode === "SALES"
      ? "Compras / conv."
      : businessGoalMode === "LEADS"
        ? "Leads / conv."
        : "Resultados";

  const showLpv = rows.some((r) => r.landingPageViews > 0);

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-muted/[0.12] p-10 text-center text-sm text-muted-foreground">
        {labelEmpty}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <EntityTableToolbar
        searchPlaceholder="Buscar por nome…"
        searchValue={search}
        onSearchChange={setSearch}
        filters={
          <>
            {levelLabel ? (
              <div className="flex min-w-[120px] flex-col justify-end gap-1 pb-0.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/90">Nível</span>
                <span className="text-xs font-semibold text-foreground">{levelLabel}</span>
              </div>
            ) : null}
            <FilterField label="Status">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as PerfStatusFilter)}>
                <SelectTrigger className="h-9 rounded-lg border-border/70 bg-background/90 text-xs shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="active">Ativas</SelectItem>
                  <SelectItem value="paused">Pausadas / arquivadas</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Entrega no período">
              <Select value={deliveryFilter} onValueChange={(v) => setDeliveryFilter(v as PerfDeliveryFilter)}>
                <SelectTrigger className="h-9 rounded-lg border-border/70 bg-background/90 text-xs shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="with">Com entrega</SelectItem>
                  <SelectItem value="without">Sem entrega</SelectItem>
                  <SelectItem value="all">Todas</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Ordenar por">
              <Select value={sortKey} onValueChange={(v) => setSortKey(v as PerfSortKey)}>
                <SelectTrigger className="h-9 rounded-lg border-border/70 bg-background/90 text-xs shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spend">Investimento</SelectItem>
                  <SelectItem value="conversions">{convSortLabel}</SelectItem>
                  <SelectItem value="efficiency">{sortEfficiencyLabel}</SelectItem>
                  <SelectItem value="ctr">CTR</SelectItem>
                  <SelectItem value="clicks">Cliques</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
          </>
        }
      />

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Padrão: apenas linhas com impressões, cliques ou investimento no período. Use &quot;Sem entrega&quot; para
        auditar campanhas ociosas.
      </p>

      {!filteredSorted.length ? (
        <div className="rounded-xl border border-border/55 bg-muted/[0.08] px-4 py-10 text-center text-sm text-muted-foreground">
          Nenhuma linha corresponde aos filtros. Ajuste status, entrega ou busca.
        </div>
      ) : (
        <>
          <DataTablePremium
            zebra
            stickyHeader
            minHeight="min-h-[240px]"
            className="tabular-nums text-[13px]"
            shellClassName="border-border/70 bg-card shadow-[var(--shadow-surface)]"
          >
            <thead>
              <tr>
                <th className="text-left">Status</th>
                <th className="text-left">{nameHeader}</th>
                {subNameKey ? <th className="text-left">{subHeader}</th> : null}
                <th className="text-right">Investimento</th>
                <th className="text-right text-muted-foreground">Impr.</th>
                {(businessGoalMode === "LEADS" || businessGoalMode === "HYBRID") && (
                  <>
                    <th className="text-right text-muted-foreground">Cliques</th>
                    <th className="text-right">CTR</th>
                    <th className="text-right text-muted-foreground">CPC</th>
                    <th className="text-right">Leads</th>
                    <th className="text-right">CPL</th>
                    {showLpv ? <th className="text-right text-muted-foreground">LPV</th> : null}
                  </>
                )}
                {(businessGoalMode === "SALES" || businessGoalMode === "HYBRID") && (
                  <>
                    {businessGoalMode === "SALES" ? (
                      <>
                        <th className="text-right text-muted-foreground">Cliques</th>
                        <th className="text-right">CTR</th>
                        <th className="text-right text-muted-foreground">CPC</th>
                      </>
                    ) : null}
                    <th className="text-right">Compras</th>
                    <th className="text-right">Valor</th>
                    <th className="text-right">ROAS</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row) => {
                const f = highlights.get(row.id) ?? {
                  bestCpl: false,
                  maxSpend: false,
                  weakCtr: false,
                  attention: false,
                };
                const ui = resolvePerfUiStatus(row, f);
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      f.bestCpl && "bg-emerald-500/[0.06]",
                      f.maxSpend && !f.bestCpl && "bg-sky-500/[0.05]",
                      (f.attention || f.weakCtr) && !f.bestCpl && !f.maxSpend && "bg-amber-500/[0.04]"
                    )}
                  >
                    <td className="w-[1%] whitespace-nowrap align-middle">
                      <StatusPill kind={ui} />
                    </td>
                    <td className="max-w-[min(280px,40vw)] align-middle">
                      <div className="truncate font-semibold text-foreground">
                        {row.name}
                        <RowChrome flags={f} />
                      </div>
                    </td>
                    {subNameKey ? (
                      <td className="max-w-[200px] truncate align-middle text-sm text-muted-foreground">
                        {row.parentName ?? "—"}
                      </td>
                    ) : null}
                    <td className="text-right align-middle text-sm font-semibold text-foreground">
                      {formatSpend(row.spend)}
                    </td>
                    <td className="text-right align-middle text-sm text-muted-foreground">
                      {formatNumber(row.impressions)}
                    </td>
                    {(businessGoalMode === "LEADS" || businessGoalMode === "HYBRID") && (
                      <>
                        <td className="text-right align-middle text-sm text-muted-foreground">
                          {formatNumber(row.clicks)}
                        </td>
                        <td className="text-right align-middle text-sm font-medium text-foreground">
                          {row.ctrPct != null ? formatPercent(row.ctrPct) : "—"}
                        </td>
                        <td className="text-right align-middle text-sm text-muted-foreground">
                          {row.cpc != null ? formatSpend(row.cpc) : "—"}
                        </td>
                        <td className="text-right align-middle text-sm font-semibold text-foreground">
                          {formatNumber(row.leads)}
                        </td>
                        <td className="text-right align-middle text-sm font-medium text-foreground">
                          {row.cpl != null ? formatSpend(row.cpl) : "—"}
                        </td>
                        {showLpv ? (
                          <td className="text-right align-middle text-sm text-muted-foreground">
                            {formatNumber(row.landingPageViews)}
                          </td>
                        ) : null}
                      </>
                    )}
                    {(businessGoalMode === "SALES" || businessGoalMode === "HYBRID") && (
                      <>
                        {businessGoalMode === "SALES" ? (
                          <>
                            <td className="text-right align-middle text-sm text-muted-foreground">
                              {formatNumber(row.clicks)}
                            </td>
                            <td className="text-right align-middle text-sm font-medium text-foreground">
                              {row.ctrPct != null ? formatPercent(row.ctrPct) : "—"}
                            </td>
                            <td className="text-right align-middle text-sm text-muted-foreground">
                              {row.cpc != null ? formatSpend(row.cpc) : "—"}
                            </td>
                          </>
                        ) : null}
                        <td className="text-right align-middle text-sm font-semibold text-foreground">
                          {formatNumber(row.purchases)}
                        </td>
                        <td className="text-right align-middle text-sm text-muted-foreground">
                          {row.purchaseValue > 0 ? formatSpend(row.purchaseValue) : "—"}
                        </td>
                        <td className="text-right align-middle text-sm font-medium text-foreground">
                          {row.roas != null ? `${row.roas.toFixed(2).replace(".", ",")}×` : "—"}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </DataTablePremium>
          <p className="text-[11px] text-muted-foreground">
            Mostrando {displayRows.length} de {filteredSorted.length} linha(s) com os filtros atuais
            {filteredSorted.length > DISPLAY_CAP ? " (limite de exibição)" : ""}.
          </p>
        </>
      )}
    </div>
  );
}

export type DashboardPerfLevel = Level;
