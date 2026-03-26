import type { ReactNode } from "react";
import { Activity, Building2, Link2, RefreshCw, User } from "lucide-react";
import type { IntegrationFromApi, MetaAdsSetupDto } from "@/lib/integrations-api";
import { cn } from "@/lib/utils";

type RowProps = { icon: ReactNode; label: string; value: string; mono?: boolean };

function SummaryRow({ icon, label, value, mono }: RowProps) {
  return (
    <div className="flex gap-3 py-2.5">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={cn("mt-0.5 text-sm font-semibold text-foreground", mono && "font-mono text-xs")}>{value}</p>
      </div>
    </div>
  );
}

type Props = {
  connected: boolean;
  row: IntegrationFromApi | undefined;
  setup: MetaAdsSetupDto | null;
};

export function MetaAdsSummaryPanel({ connected, row, setup }: Props) {
  if (!connected) {
    return (
      <aside className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-center shadow-inner">
        <p className="text-sm font-medium text-muted-foreground">Conecte o Meta Ads para ver o resumo da integração.</p>
      </aside>
    );
  }

  const last = row?.lastSyncAt ? new Date(row.lastSyncAt).toLocaleString("pt-BR") : "—";

  return (
    <aside className="space-y-1 rounded-2xl border border-border/60 bg-card p-5 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.02] dark:ring-white/[0.04] sm:p-6">
      <p className="mb-4 text-xs font-bold uppercase tracking-widest text-primary">Resumo</p>
      <div className="divide-y divide-border/50">
        <SummaryRow icon={<Activity className="h-4 w-4" />} label="Status" value="OAuth ativo" />
        <SummaryRow
          icon={<User className="h-4 w-4" />}
          label="Conta Meta (OAuth)"
          value={setup?.facebookUserName ?? row?.metaFacebookUserName ?? "—"}
        />
        <SummaryRow icon={<RefreshCw className="h-4 w-4" />} label="Última sincronização" value={last} />
        <SummaryRow
          icon={<Building2 className="h-4 w-4" />}
          label="Contas de anúncio disponíveis"
          value={String(setup?.accessibleAdAccountCount ?? 0)}
        />
        <SummaryRow
          icon={<Link2 className="h-4 w-4" />}
          label="Vínculos com clientes"
          value={String(setup?.assignmentCount ?? row?.metaAssignmentCount ?? 0)}
        />
        <SummaryRow
          icon={<Building2 className="h-4 w-4" />}
          label="Padrão da organização"
          value={setup?.defaultAdAccountId ? `act_${setup.defaultAdAccountId}` : "Não definido"}
          mono
        />
      </div>
    </aside>
  );
}
