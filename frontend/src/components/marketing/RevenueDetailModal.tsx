import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";

interface Row {
  label: string;
  valor: number;
  percentual: number;
}

interface RevenueDetailModalProps {
  total: number;
  rows: Row[];
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function RevenueDetailModal({ total, rows, trigger, open, onOpenChange }: RevenueDetailModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="text-sm text-primary hover:underline"
          >
            Detalhamento do faturamento
          </button>
        )}
      </DialogTrigger>
      <DialogContent title="Detalhamento do faturamento" className="max-w-md">
        <div className="space-y-0">
          <div className="rounded-md bg-primary/10 px-4 py-3">
            <p className="text-sm font-medium text-muted-foreground">
              Faturamento Total
            </p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatCurrency(total)}
            </p>
          </div>
          <div className="divide-y divide-border">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between py-3"
              >
                <span className="text-sm">{row.label}</span>
                <div className="text-right">
                  <p className="font-medium tabular-nums">
                    {formatCurrency(row.valor)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.percentual.toFixed(1)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
