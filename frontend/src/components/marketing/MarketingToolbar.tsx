import { RefreshCw, Share2, Settings, Pencil, Clock, Snowflake, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Project } from "@/types";

export type SegmentFilter = "geral" | "frio" | "quente";

interface MarketingToolbarProps {
  projects: Project[];
  selectedProjectId: string;
  onProjectChange: (id: string) => void;
  periods: { value: string; label: string }[];
  selectedPeriod: string;
  onPeriodChange: (value: string) => void;
  segment?: SegmentFilter;
  onSegmentChange?: (s: SegmentFilter) => void;
  comparePeriod?: string;
  onCompareChange?: (value: string) => void;
  onRefresh?: () => void;
  onShare?: () => void;
  onEdit?: () => void;
  onConfigure?: () => void;
  lastSync?: string;
  statusOk?: boolean;
}

export function MarketingToolbar({
  projects,
  selectedProjectId,
  onProjectChange,
  periods,
  selectedPeriod,
  onPeriodChange,
  segment = "geral",
  onSegmentChange,
  comparePeriod,
  onCompareChange,
  onRefresh,
  onShare,
  onEdit,
  onConfigure,
  lastSync,
  statusOk = true,
}: MarketingToolbarProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedProjectId} onValueChange={onProjectChange}>
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Lançamento" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.launchName ? `Lançamento: ${p.launchName}` : p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {statusOk && (
          <span className="rounded-full bg-[hsl(var(--success))]/15 px-2.5 py-1 text-xs font-medium text-[hsl(var(--success))]">
            Status: OK
          </span>
        )}
        {onSegmentChange && (
          <div className="flex rounded-md border border-input bg-background p-0.5">
            {(
              [
                { value: "geral" as const, label: "Geral", icon: null },
                { value: "frio" as const, label: "Frio", icon: Snowflake },
                { value: "quente" as const, label: "Quente", icon: Flame },
              ] as const
            ).map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => onSegmentChange(s.value)}
                  className={cn(
                    "flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
                    segment === s.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                  {s.label}
                </button>
              );
            })}
          </div>
        )}
        <Select value={selectedPeriod} onValueChange={onPeriodChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            {periods.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {onCompareChange && (
          <Select value={comparePeriod ?? "none"} onValueChange={onCompareChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Comparar com" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem comparação</SelectItem>
              {periods.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {lastSync && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {lastSync}
          </span>
        )}
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        )}
        {onEdit && (
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
        )}
        {onShare && (
          <Button size="sm" onClick={onShare} className="bg-primary hover:bg-primary/90">
            <Share2 className="h-4 w-4" />
            Compartilhar
          </Button>
        )}
        {onConfigure && (
          <Button variant="outline" size="sm" onClick={onConfigure}>
            <Settings className="h-4 w-4" />
            Configurar métricas
          </Button>
        )}
      </div>
    </div>
  );
}
