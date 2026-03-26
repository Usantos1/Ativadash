import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MetaAdsSetupDto } from "@/lib/integrations-api";
import { META_PERSONAL_BUSINESS_SENTINEL } from "@/lib/integrations-api";

function normAdId(id: string): string {
  return id.replace(/\D/g, "");
}

function businessLabel(setup: MetaAdsSetupDto, businessId: string): string {
  if (businessId === META_PERSONAL_BUSINESS_SENTINEL) return "Contas do usuário";
  const b = setup.businesses.find((x) => x.id === businessId);
  return b ? `${b.name} (${b.id})` : businessId;
}

type Props = {
  setup: MetaAdsSetupDto;
  busy: boolean;
  lastSyncLabel: string;
  onRemove: (clientAccountId: string) => void;
};

export function MetaAdsLinkedAccountsTable({ setup, busy, lastSyncLabel, onRemove }: Props) {
  const rows = setup.assignments ?? [];
  const defaultNum = setup.defaultAdAccountId ? normAdId(setup.defaultAdAccountId) : null;

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/15 px-6 py-14 text-center">
        <p className="text-sm font-semibold text-foreground">Nenhum vínculo ainda</p>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Escolha o Business Manager, a conta de anúncios e salve o vínculo para um workspace.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40">
              <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Cliente / Workspace
              </th>
              <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Business Manager
              </th>
              <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Conta
              </th>
              <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">ID</th>
              <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
              <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Moeda</th>
              <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Padrão org.</th>
              <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Última sync</th>
              <th className="px-4 py-3.5 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.map((a) => {
              const acc = setup.adAccounts.find((x) => normAdId(x.accountId) === normAdId(a.adAccountId));
              const isDefault = defaultNum !== null && normAdId(a.adAccountId) === defaultNum;
              return (
                <tr key={a.clientAccountId} className="bg-card transition-colors hover:bg-muted/25">
                  <td className="px-4 py-3.5 font-semibold text-foreground">{a.clientName}</td>
                  <td className="max-w-[200px] truncate px-4 py-3.5 text-xs text-muted-foreground" title={a.businessId}>
                    {businessLabel(setup, a.businessId)}
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-3.5" title={acc?.name}>
                    {acc?.name ?? `Conta ${a.adAccountId}`}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">{a.adAccountId}</td>
                  <td className="px-4 py-3.5 text-xs text-muted-foreground">{acc?.accountStatus ?? "—"}</td>
                  <td className="px-4 py-3.5 text-muted-foreground">{acc?.currency ?? "—"}</td>
                  <td className="px-4 py-3.5">
                    {isDefault ? (
                      <span className="inline-flex rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary ring-1 ring-primary/20">
                        Sim
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-muted-foreground">{lastSyncLabel}</td>
                  <td className="px-4 py-3.5 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={busy}
                      onClick={() => onRemove(a.clientAccountId)}
                      aria-label="Remover vínculo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
