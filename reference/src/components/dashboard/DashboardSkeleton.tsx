import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ModernLayout } from '@/components/ModernLayout';

/**
 * Skeleton que imita o layout real do Dashboard (Index) para evitar layout shift.
 * Mesmas alturas/larguras/spacing: cards de indicadores, linha de OS, gráfico principal, gráficos secundários.
 */
export function DashboardSkeleton() {
  return (
    <ModernLayout title="Dashboard" subtitle="Carregando...">
      <div className="flex flex-col h-full overflow-hidden min-h-0">
        {/* Header + grid de indicadores (6 cols: 4 financial + 2 alertas) */}
        <div className="flex-shrink-0 px-2 sm:px-3 md:px-0 pb-3 sm:pb-4 border-b border-gray-200 dark:border-gray-700 bg-background">
          <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
            <Skeleton className="h-6 w-48" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-[110px] sm:w-[120px]" />
              <Skeleton className="h-9 w-9" />
              <Skeleton className="h-9 w-9" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="border-2 border-gray-200 dark:border-gray-700 min-w-0 py-1 px-2">
                <CardHeader className="pb-1 pt-2 px-2">
                  <Skeleton className="h-4 w-3/4" />
                </CardHeader>
                <CardContent className="px-2 pb-2 pt-0">
                  <Skeleton className="h-6 w-20 mb-1" />
                  <Skeleton className="h-3 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Conteúdo com scroll */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin px-2 sm:px-3 md:px-0 pt-3 sm:pt-4 min-h-0">
          <div className="space-y-4 sm:space-y-5 md:space-y-6 pb-4 sm:pb-6 max-w-full">
            {/* Linha de status de OS */}
            <div className="w-full min-w-0">
              <Skeleton className="h-6 w-56 mb-2 sm:mb-3" />
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i} className="border-2 border-gray-300 shadow-sm pb-2 pt-2 px-3">
                    <CardHeader className="pb-2 pt-2 px-3">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-6 w-8" />
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>

            {/* Gráfico principal + secundários (TrendCharts) */}
            <div className="space-y-4 w-full min-w-0">
              <Card className="border-2 border-gray-300 dark:border-gray-600 shadow-sm w-full min-w-0 overflow-hidden">
                <CardHeader className="pb-2 sm:pb-3 pt-3 sm:pt-4 md:pt-6 px-3 sm:px-4 md:px-6 border-b-2 border-gray-200 dark:border-gray-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <Skeleton className="h-6 w-44 mb-1" />
                      <Skeleton className="h-4 w-64" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 md:p-6">
                  {/* Gráfico principal - mesma altura do TrendCharts */}
                  <div className="w-full min-h-[200px] sm:min-h-[240px] md:min-h-[260px] mb-4">
                    <Skeleton className="h-full w-full rounded-md" />
                  </div>
                  {/* Gráficos secundários */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="min-h-[160px]">
                      <Skeleton className="h-4 w-24 mb-2" />
                      <Skeleton className="h-[160px] w-full rounded-md" />
                    </div>
                    <div className="min-h-[160px]">
                      <Skeleton className="h-4 w-24 mb-2" />
                      <Skeleton className="h-[160px] w-full rounded-md" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </ModernLayout>
  );
}
