import { useParams, useNavigate } from 'react-router-dom';
import { ModernLayout } from '@/components/ModernLayout';
import { AdminJobSurveysManager } from '@/components/AdminJobSurveysManager';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function JobSurveyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <ModernLayout
      title="Detalhes da Vaga"
      subtitle="Visualize e gerencie candidatos desta vaga"
    >
      <AdminJobSurveysManager surveyId={id} />
    </ModernLayout>
  );
}

