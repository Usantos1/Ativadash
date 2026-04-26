import { useState } from 'react';
import { ModernLayout } from '@/components/ModernLayout';
import { BillsManager } from '@/components/financeiro/BillsManager';
import { AccountsReceivableManager } from '@/components/financeiro/AccountsReceivableManager';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getStoredValuesVisible, ValuesVisibilityToggle } from '@/components/dashboard/FinancialCards';

export default function FinanceiroContasPage() {
  const [activeTab, setActiveTab] = useState<'pagar' | 'receber'>('pagar');
  const [valuesVisible, setValuesVisible] = useState(getStoredValuesVisible);

  return (
    <ModernLayout
      title="Contas"
      subtitle="Contas a pagar e receber"
      headerActions={<ValuesVisibilityToggle valuesVisible={valuesVisible} setValuesVisible={setValuesVisible} />}
    >
      <div className="flex flex-col gap-4 pb-8 min-w-0">
        <div className="space-y-3 flex-1 flex flex-col min-h-0 min-w-0">
          {/* Tabs — mobile: toque confortável */}
          <Card className="flex-shrink-0 rounded-xl overflow-hidden">
            <CardContent className="p-2 sm:p-3">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={activeTab === 'pagar' ? 'default' : 'ghost'}
                  size="sm"
                  className={cn(
                    'min-h-[44px] sm:min-h-0 sm:h-8 rounded-xl sm:rounded-md touch-manipulation text-xs md:text-sm',
                    activeTab === 'pagar' && 'bg-red-600 hover:bg-red-700 text-white'
                  )}
                  onClick={() => setActiveTab('pagar')}
                >
                  <TrendingDown className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                  <span className="truncate">Contas a Pagar</span>
                </Button>
                <Button
                  variant={activeTab === 'receber' ? 'default' : 'ghost'}
                  size="sm"
                  className={cn(
                    'min-h-[44px] sm:min-h-0 sm:h-8 rounded-xl sm:rounded-md touch-manipulation text-xs md:text-sm',
                    activeTab === 'receber' && 'bg-green-600 hover:bg-green-700 text-white'
                  )}
                  onClick={() => setActiveTab('receber')}
                >
                  <TrendingUp className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                  <span className="truncate">Contas a Receber</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Conteúdo — mobile: página rola; sem scroll interno */}
          <div className="flex-1 min-w-0">
            {activeTab === 'pagar' && <BillsManager valuesVisible={valuesVisible} />}
            {activeTab === 'receber' && <AccountsReceivableManager valuesVisible={valuesVisible} />}
          </div>
        </div>
      </div>
    </ModernLayout>
  );
}
