import { useState } from 'react';
import { ModernLayout } from '@/components/ModernLayout';
import { CashRegisterSessionsManager } from '@/components/financeiro/CashRegisterSessionsManager';
import { CaixaGeral } from '@/components/financeiro/CaixaGeral';
import { useAuth } from '@/contexts/AuthContext';
import { getStoredValuesVisible, ValuesVisibilityToggle } from '@/components/dashboard/FinancialCards';

export default function FinanceiroCaixaPage() {
  const { isAdmin } = useAuth();
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all' | 'custom'>(isAdmin ? 'month' : 'today');
  const [customDateStart, setCustomDateStart] = useState<Date | undefined>(undefined);
  const [customDateEnd, setCustomDateEnd] = useState<Date | undefined>(undefined);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [valuesVisible, setValuesVisible] = useState(getStoredValuesVisible);

  return (
    <ModernLayout
      title="Caixa"
      subtitle={isAdmin ? 'Gestão de sessões de caixa' : 'Meu caixa (hoje)'}
      headerActions={<ValuesVisibilityToggle valuesVisible={valuesVisible} setValuesVisible={setValuesVisible} />}
    >
      <div className="flex flex-col gap-4 pb-8 min-w-0 overflow-x-hidden">
        {isAdmin && (
          <CaixaGeral
            dateFilter={dateFilter}
            setDateFilter={setDateFilter}
            customDateStart={customDateStart}
            customDateEnd={customDateEnd}
            setCustomDateStart={setCustomDateStart}
            setCustomDateEnd={setCustomDateEnd}
            showDatePicker={showDatePicker}
            setShowDatePicker={setShowDatePicker}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            valuesVisible={valuesVisible}
            setValuesVisible={setValuesVisible}
          />
        )}
        <CashRegisterSessionsManager
          dateFilter={isAdmin ? dateFilter : 'today'}
          customDateStart={isAdmin ? customDateStart : undefined}
          customDateEnd={isAdmin ? customDateEnd : undefined}
          statusFilter={statusFilter}
          valuesVisible={valuesVisible}
        />
      </div>
    </ModernLayout>
  );
}
