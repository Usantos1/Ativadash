import { ModernLayout } from '@/components/ModernLayout';
import { InventarioDialog } from '@/components/assistencia/InventarioDialog';

export default function Inventario() {
  return (
    <ModernLayout title="Inventário" subtitle="Contagem com aprovação para ajuste de estoque">
      <InventarioDialog
        standalone
        filtrosAtuais={{ searchTerm: '', grupo: '', localizacao: '' }}
      />
    </ModernLayout>
  );
}
