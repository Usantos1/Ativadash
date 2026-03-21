import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { ScrollRegion } from "@/components/ui/scroll-region";
import { DataTablePremium } from "@/components/premium/data-table-premium";
import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyColumnDef = ColumnDef<any, any>;

interface AnalyticTableProps<T> {
  title: string;
  description?: string;
  columns: AnyColumnDef[];
  data: T[];
  className?: string;
}

export function AnalyticTable<T>({
  title,
  description,
  columns,
  data,
  className,
}: AnalyticTableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border/55 bg-card shadow-[var(--shadow-surface)] ring-1 ring-black/[0.02] dark:ring-white/[0.03]",
        className
      )}
    >
      {title ? (
        <div className="border-b border-border/50 bg-gradient-to-r from-muted/35 via-transparent to-transparent px-5 py-4">
          <h3 className="text-sm font-bold tracking-tight text-foreground">{title}</h3>
          {description ? (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
      ) : null}
      <div className="p-0">
        <ScrollRegion className="scrollbar-thin">
          <DataTablePremium zebra className="min-w-[520px] text-[13px]">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="text-left">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </DataTablePremium>
        </ScrollRegion>
      </div>
    </div>
  );
}
