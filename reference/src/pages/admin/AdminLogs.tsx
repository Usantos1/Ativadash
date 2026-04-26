import { ModernLayout } from "@/components/ModernLayout";
import { AdminLogsManager } from "@/components/AdminLogsManager";

export default function AdminLogs() {
  return (
    <ModernLayout
      title="Logs do Sistema"
      subtitle="Vendas, produtos, OS, cancelamentos, exclusões, caixa, ponto e mais — tudo em um só lugar"
    >
      <AdminLogsManager />
    </ModernLayout>
  );
}