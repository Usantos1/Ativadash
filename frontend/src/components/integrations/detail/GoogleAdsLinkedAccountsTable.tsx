import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GoogleAdsSetupDto } from "@/lib/integrations-api";
import { cn } from "@/lib/utils";

function normId(id: string): string {
  return id.replace(/\D/g, "");
}

type Props = {
  setup: GoogleAdsSetupDto;
  busy: boolean;
  /** Última sync da integração (mesmo valor para todas as linhas) */
  lastSyncLabel: string;
  onRemove: (clientAccountId: string) => void;
  managerLabel: (id: string) => string;
  accountLabel: (id: string) => string;
};

export function GoogleAdsLinkedAccountsTable({
  setup,
  busy,
  lastSyncLabel,
  onRemove,
  managerLabel,
  accountLabel,
}: Props) {
  const rows = setup.assignments ?? [];
  const defaultId = setup.defaultCustomerId ? normId(setup.defaultCustomerId) : null;

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/15 px-6 py-14 text-center">
        <p className="text-sm font-semibold text-foreground">Nenhum vínculo ainda</p>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Use o formulário acima para associar uma conta de anúncios a um cliente.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40">
              <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Cliente / Workspace
              </th>
              <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Gerenciador
              </th>
              <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Conta Ads
              </th>
              <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Moeda</th>
              <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Padrão</th>
              <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
              <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Última sync
              </th>
              <th className="px-4 py-3.5 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.map((a) => {
              const acc = setup.customers.find((c) => normId(c.customerId) === normId(a.googleCustomerId));
              const mgrId = a.loginCustomerId;
              const isDefault = defaultId !== null && normId(a.googleCustomerId) === defaultId;
              const statusOk = acc?.status ? acc.status.toLowerCase().includes("suspend") === false : true;
              return (
                <tr
                  key={a.clientAccountId}
                  className="bg-card transition-colors hover:bg-muted/25"
                >
                  <td className="px-4 py-3.5 font-semibold text-foreground">{a.clientName}</td>
                  <td className="max-w-[180px] truncate px-4 py-3.5 font-mono text-xs text-muted-foreground" title={mgrId ?? ""}>
                    {mgrId ? managerLabel(mgrId) : "—"}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3.5 font-mono text-xs" title={accountLabel(a.googleCustomerId)}>
                    {accountLabel(a.googleCustomerId)}
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground">{acc?.currencyCode ?? "—"}</td>
                  <td className="px-4 py-3.5">
                    {isDefault ? (
                      <span className="inline-flex rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary ring-1 ring-primary/20">
                        Padrão org.
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                        statusOk
                          ? "bg-emerald-500/12 text-emerald-800 dark:text-emerald-200"
                          : "bg-amber-500/15 text-amber-900 dark:text-amber-200"
                      )}
                    >
                      {acc?.status ?? "OK"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-xs text-muted-foreground">{lastSyncLabel}</td>
                  <td className="px-4 py-3.5 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={busy}
                      onClick={() => onRemove(a.clientAccountId)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Remover</span>
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
