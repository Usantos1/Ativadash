import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { BillsManager } from '@/components/financeiro/BillsManager';
import { AccountsReceivableManager } from '@/components/financeiro/AccountsReceivableManager';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function FinanceiroContas() {
  const context = useOutletContext<{ startDate: string; endDate?: string; month?: string; dateFilter?: string }>();
  // Se for "all", não filtrar por data
  const shouldFilter = context.dateFilter !== 'all';
  const [activeTab, setActiveTab] = useState<'pagar' | 'receber'>('pagar');
  
  return (
    <div className="space-y-3">
      {/* Tabs customizadas */}
      <Card>
        <CardContent className="p-2">
          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === 'pagar' ? 'default' : 'ghost'}
              size="sm"
              className={cn(
                'h-8 text-xs md:text-sm',
                activeTab === 'pagar' && 'bg-red-600 hover:bg-red-700 text-white'
              )}
              onClick={() => setActiveTab('pagar')}
            >
              <TrendingDown className="h-3.5 w-3.5 mr-1.5" />
              <span className="hidden sm:inline">Contas a</span> Pagar
            </Button>
            <Button
              variant={activeTab === 'receber' ? 'default' : 'ghost'}
              size="sm"
              className={cn(
                'h-8 text-xs md:text-sm',
                activeTab === 'receber' && 'bg-green-600 hover:bg-green-700 text-white'
              )}
              onClick={() => setActiveTab('receber')}
            >
              <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
              <span className="hidden sm:inline">Contas a</span> Receber
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Conteúdo */}
      {activeTab === 'pagar' && (
        <BillsManager 
          startDate={shouldFilter ? context.startDate : undefined}
          endDate={shouldFilter ? context.endDate : undefined}
        />
      )}
      {activeTab === 'receber' && (
        <AccountsReceivableManager 
          month={shouldFilter ? context.month : undefined}
        />
      )}
    </div>
  );
}
