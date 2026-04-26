import { useQuery, useQueryClient } from '@tanstack/react-query';
import { from } from '@/integrations/db/client';
import { useToast } from '@/hooks/use-toast';

export interface CandidateEvaluation {
  id: string;
  job_response_id: string;
  evaluator_id: string;
  status: 'pending' | 'analyzing' | 'qualified' | 'interview' | 'approved' | 'rejected';
  rating?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  evaluator?: {
    display_name: string;
  };
}

export const useCandidateEvaluations = (surveyId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: evaluations = [], isLoading } = useQuery({
    queryKey: ['candidate-evaluations', surveyId],
    queryFn: async () => {
      if (!surveyId) return [];
      
      const jobResponseIds = (await from('job_responses')
        .select('id')
        .eq('survey_id', surveyId)
        .execute()
      ).data?.map(r => r.id) || [];

      const { data, error } = await from('job_candidate_evaluations')
        .select('*')
        .in('job_response_id', jobResponseIds)
        .order('updated_at', { ascending: false })
        .execute();

      if (error) throw error;
      return data as CandidateEvaluation[];
    },
    enabled: !!surveyId
  });

  const deleteCandidate = async (candidateId: string) => {
    try {
      // First delete any evaluations
      const { error: evalError } = await from('job_candidate_evaluations')
        .delete()
        .eq('job_response_id', candidateId);

      if (evalError) throw evalError;

      // Then delete the candidate response
      const { error } = await from('job_responses')
        .delete()
        .eq('id', candidateId);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Candidato excluído com sucesso!",
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['job-responses'] });
      queryClient.invalidateQueries({ queryKey: ['candidate-evaluations'] });
      
      return true;
    } catch (error) {
      console.error('Erro ao excluir candidato:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir candidato",
        variant: "destructive",
      });
      return false;
    }
  };

  const getEvaluationByResponseId = (responseId: string) => {
    return evaluations.find(evaluation => evaluation.job_response_id === responseId);
  };

  const refreshEvaluations = () => {
    queryClient.invalidateQueries({ queryKey: ['candidate-evaluations', surveyId] });
  };

  return {
    evaluations,
    isLoading,
    deleteCandidate,
    getEvaluationByResponseId,
    refreshEvaluations
  };
};