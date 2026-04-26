import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type DateFilterType = 'today' | 'week' | 'month' | 'all' | 'custom';

interface DateFilterBarProps {
  dateFilter: DateFilterType;
  onDateFilterChange: (filter: DateFilterType) => void;
  customDateStart?: Date;
  customDateEnd?: Date;
  onCustomDateStartChange?: (date: Date | undefined) => void;
  onCustomDateEndChange?: (date: Date | undefined) => void;
  onDatesChange?: (startDate: string | undefined, endDate: string | undefined) => void;
  className?: string;
}

export function DateFilterBar({
  dateFilter,
  onDateFilterChange,
  customDateStart,
  customDateEnd,
  onCustomDateStartChange,
  onCustomDateEndChange,
  onDatesChange,
  className,
}: DateFilterBarProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);

  const getDateRange = (filter?: DateFilterType) => {
    const f = filter ?? dateFilter;
    const today = new Date();
    let startDate: string | undefined;
    let endDate: string | undefined;

    if (f === 'today') {
      startDate = format(today, 'yyyy-MM-dd');
      endDate = format(today, 'yyyy-MM-dd');
    } else if (f === 'week') {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      startDate = format(weekAgo, 'yyyy-MM-dd');
      endDate = format(today, 'yyyy-MM-dd');
    } else if (f === 'month') {
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 30);
      startDate = format(monthAgo, 'yyyy-MM-dd');
      endDate = format(today, 'yyyy-MM-dd');
    } else if (f === 'custom' && customDateStart && customDateEnd) {
      startDate = format(customDateStart, 'yyyy-MM-dd');
      endDate = format(customDateEnd, 'yyyy-MM-dd');
    } else {
      startDate = undefined;
      endDate = undefined;
    }

    return { startDate, endDate };
  };

  const handleFilterChange = (filter: DateFilterType) => {
    const range = getDateRange(filter);
    onDateFilterChange(filter);
    if (onDatesChange) {
      onDatesChange(range.startDate, range.endDate);
    }
  };

  return (
    <Card className={cn("flex-shrink-0 border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm min-w-0", className)}>
      <CardContent className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Botões de filtro rápido — mobile: toque confortável */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              variant={dateFilter === 'today' ? 'default' : 'outline'}
              size="sm"
              className="min-h-[44px] sm:min-h-0 sm:h-8 rounded-xl sm:rounded-md touch-manipulation text-xs px-3"
              onClick={() => handleFilterChange('today')}
            >
              Hoje
            </Button>
            <Button
              variant={dateFilter === 'week' ? 'default' : 'outline'}
              size="sm"
              className="min-h-[44px] sm:min-h-0 sm:h-8 rounded-xl sm:rounded-md touch-manipulation text-xs px-3"
              onClick={() => handleFilterChange('week')}
            >
              7 dias
            </Button>
            <Button
              variant={dateFilter === 'month' ? 'default' : 'outline'}
              size="sm"
              className="min-h-[44px] sm:min-h-0 sm:h-8 rounded-xl sm:rounded-md touch-manipulation text-xs px-3"
              onClick={() => handleFilterChange('month')}
            >
              30 dias
            </Button>
            <Button
              variant={dateFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              className="min-h-[44px] sm:min-h-0 sm:h-8 rounded-xl sm:rounded-md touch-manipulation text-xs px-3"
              onClick={() => handleFilterChange('all')}
            >
              Todos
            </Button>
          </div>

          {/* Seletor de período personalizado */}
          <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
            <PopoverTrigger asChild>
              <Button
                variant={dateFilter === 'custom' && customDateStart && customDateEnd ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  "min-h-[44px] sm:min-h-0 sm:h-8 rounded-xl sm:rounded-md touch-manipulation text-xs sm:text-xs justify-start text-left font-normal border-2 w-full sm:w-auto",
                  dateFilter === 'custom' && customDateStart && customDateEnd && "bg-primary text-primary-foreground"
                )}
              >
                <CalendarDays className="mr-2 h-3.5 w-3.5 shrink-0" />
                {dateFilter === 'custom' && customDateStart && customDateEnd ? (
                  <span className="truncate">
                    {format(customDateStart, 'dd/MM/yy', { locale: ptBR })} - {format(customDateEnd, 'dd/MM/yy', { locale: ptBR })}
                  </span>
                ) : (
                  'Personalizado'
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="p-3 border-b space-y-2">
                <div className="text-xs text-muted-foreground text-center">
                  ou selecione um período:
                </div>
              </div>
              <div className="p-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Data Início</Label>
                    <Input
                      type="date"
                      value={customDateStart ? format(customDateStart, 'yyyy-MM-dd') : ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          const newStart = e.target.value;
                          onCustomDateStartChange?.(new Date(newStart + 'T00:00:00'));
                          if (customDateEnd) {
                            onDateFilterChange('custom');
                            onDatesChange?.(newStart, format(customDateEnd, 'yyyy-MM-dd'));
                          }
                        }
                      }}
                      className="min-h-[44px] sm:h-8 rounded-lg touch-manipulation text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Data Fim</Label>
                    <Input
                      type="date"
                      value={customDateEnd ? format(customDateEnd, 'yyyy-MM-dd') : ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          const newEnd = e.target.value;
                          onCustomDateEndChange?.(new Date(newEnd + 'T23:59:59'));
                          if (customDateStart) {
                            onDateFilterChange('custom');
                            onDatesChange?.(format(customDateStart, 'yyyy-MM-dd'), newEnd);
                          }
                        }
                      }}
                      className="min-h-[44px] sm:h-8 rounded-lg touch-manipulation text-sm"
                    />
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </CardContent>
    </Card>
  );
}
