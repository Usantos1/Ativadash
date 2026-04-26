import { ModernLayout } from "@/components/ModernLayout";
import { AdminDiscManager } from "@/components/AdminDiscManager";

export default function AdminDisc() {
  return (
    <ModernLayout
      title="Gestão de Testes DISC"
      subtitle="Monitore e gerencie testes DISC dos usuários"
    >
      <div className="h-[calc(100vh-80px)] md:h-[calc(100vh-120px)] overflow-auto scrollbar-thin">
        <AdminDiscManager />
      </div>
    </ModernLayout>
  );
}