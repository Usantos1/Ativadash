import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollRegion } from "@/components/ui/scroll-region";
import { cn } from "@/lib/utils";

// TanStack Table column defs from createColumnHelper use specific value types; we accept any for flexibility.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyColumnDef = ColumnDef<any, any>;

interface AnalyticTableProps<T> {
  title: string;
  columns: AnyColumnDef[];
  data: T[];
  className?: string;
}

export function AnalyticTable<T>({
  title,
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
    <Card className={cn("overflow-hidden", className)}>
      {title ? (
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent className="p-0">
        <ScrollRegion className="scrollbar-thin">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-border">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left font-medium text-muted-foreground"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border/50 transition-colors hover:bg-muted/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-2.5">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollRegion>
      </CardContent>
    </Card>
  );
}
