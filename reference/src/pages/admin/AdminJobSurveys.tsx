import { ModernLayout } from "@/components/ModernLayout";
import { AdminJobSurveysManager } from "@/components/AdminJobSurveysManager";

export default function AdminJobSurveys() {
  return (
    <ModernLayout
      title="Formulários de Vaga"
      subtitle="Gerencie formulários de candidatura para vagas de emprego"
    >
      <AdminJobSurveysManager />
    </ModernLayout>
  );
}