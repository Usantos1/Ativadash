import { ModernLayout } from '@/components/ModernLayout';
import { FinancialCategoriesManager } from '@/components/financeiro/FinancialCategoriesManager';

export default function CategoriasFinanceiras() {
  return (
    <ModernLayout
      title="Categorias Financeiras"
      subtitle="Gerencie categorias para contas a pagar e receber"
    >
      <div className="flex flex-col gap-4 pb-8 min-w-0">
        <FinancialCategoriesManager />
      </div>
    </ModernLayout>
  );
}
