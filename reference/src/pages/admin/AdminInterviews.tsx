import { ModernLayout } from "@/components/ModernLayout";
import { AdminInterviewsManager } from "@/pages/AdminInterviews";

export default function AdminInterviews() {
  return (
    <ModernLayout
      title="Gestão de Entrevistas"
      subtitle="Sistema inteligente de entrevistas com IA"
    >
      <AdminInterviewsManager />
    </ModernLayout>
  );
}

