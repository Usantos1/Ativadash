import { ModernLayout } from '@/components/ModernLayout';
import { TimeClockWidget } from '@/components/TimeClockWidget';
import { TimeSheetManager } from '@/components/TimeSheetManager';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';

export default function TimeClock() {
  const isMobile = useIsMobile();
  const { isAdmin } = useAuth();

  return (
    <ModernLayout
      title="Ponto Eletrônico"
      subtitle="Controle de jornada de trabalho e presença"
    >
      <div className="space-y-4 md:space-y-6 px-1 md:px-0">
        {isAdmin ? (
          <Tabs defaultValue="widget" className="w-full">
            <TabsList className="grid w-full grid-cols-2 border-2 border-gray-300 bg-gray-50 h-auto">
              <TabsTrigger 
                value="widget"
                className="text-xs md:text-sm border-r-2 border-gray-300 data-[state=active]:bg-[#00C27F] data-[state=active]:text-white dark:data-[state=active]:bg-[#00C27F] flex items-center justify-center py-2.5 md:py-3 px-2 md:px-4"
              >
                Registrar Ponto
              </TabsTrigger>
              <TabsTrigger 
                value="timesheet"
                className="text-xs md:text-sm data-[state=active]:bg-[#00C27F] data-[state=active]:text-white dark:data-[state=active]:bg-[#00C27F] flex items-center justify-center py-2.5 md:py-3 px-2 md:px-4"
              >
                Espelho de Ponto
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="widget" className="mt-4 md:mt-6">
              <div className="flex justify-center w-full">
                <div className={`${isMobile ? 'w-full' : 'w-full max-w-md'}`}>
                  <TimeClockWidget />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="timesheet" className="mt-4 md:mt-6">
              <TimeSheetManager />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex justify-center w-full">
            <div className={`${isMobile ? 'w-full' : 'w-full max-w-md'}`}>
              <TimeClockWidget />
            </div>
          </div>
        )}
      </div>
    </ModernLayout>
  );
}