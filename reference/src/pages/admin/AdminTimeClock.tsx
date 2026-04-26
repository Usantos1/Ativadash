import { ModernLayout } from "@/components/ModernLayout";
import { AdminTimeClockManager } from "@/components/AdminTimeClockManager";

export default function AdminTimeClock() {
  return (
    <ModernLayout
      title="Gestão de Ponto"
      subtitle="Monitore e gerencie registros de ponto dos funcionários"
    >
      <AdminTimeClockManager />
    </ModernLayout>
  );
}