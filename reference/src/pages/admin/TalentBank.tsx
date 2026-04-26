import { useState, useMemo } from 'react';
import { ModernLayout } from '@/components/ModernLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { from } from '@/integrations/db/client';
import { apiClient } from '@/integrations/api/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Eye, Brain, Download, Filter, Video, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { CandidateEvaluationModal } from '@/components/CandidateEvaluationModal';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { useErrorHandler } from '@/hooks/useErrorHandler';

interface Candidate {
  id: string;
  name: string;
  email: string;
  phone?: string;
  whatsapp?: string;
  age?: number;
  survey_id: string;
  survey_title?: string;
  survey_position?: string;
  created_at: string;
  responses?: any;
  ai_analysis?: any;
}

export default function TalentBank() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSurvey, setSelectedSurvey] = useState<string>('all');
  const [competenceFilter, setCompetenceFilter] = useState<string>('all');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [selectedEvaluation, setSelectedEvaluation] = useState<any>(null);
  const [showEvaluationModal, setShowEvaluationModal] = useState(false);
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null);

  // Fetch all candidates from all surveys
  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ['talent-bank', selectedSurvey, competenceFilter],
    queryFn: async () => {
      // Primeiro, buscar todos os candidatos
      let query = from('job_responses')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10000); // Limite alto para buscar todos os candidatos

      if (selectedSurvey !== 'all') {
        query = query.eq('survey_id', selectedSurvey);
      }

      const { data: responses, error: responsesError } = await query.execute();

      console.log('[TalentBank] Resposta da query job_responses:', {
        dataLength: responses?.length,
        hasError: !!responsesError,
        error: responsesError,
        firstItem: responses?.[0]
      });

      if (responsesError) {
        console.error('Erro ao carregar candidatos do banco de talentos:', responsesError);
        toast({
          title: 'Erro ao carregar candidatos',
          description: responsesError.message || 'Tente novamente ou verifique as permissões.',
          variant: 'destructive',
        });
        return [];
      }

      if (!responses || responses.length === 0) {
        console.log('[TalentBank] Nenhum candidato encontrado na tabela job_responses');
        return [];
      }

      console.log(`[TalentBank] ${responses.length} candidatos encontrados, processando...`);

      // Buscar informações das vagas separadamente
      const surveyIds = [...new Set(responses.map((r: any) => r.survey_id).filter(Boolean))];
      let surveysMap: Record<string, any> = {};
      
      if (surveyIds.length > 0) {
        const { data: surveys, error: surveysError } = await from('job_surveys')
          .select('id, title, position_title, department')
          .in('id', surveyIds)
          .execute();

        if (!surveysError && surveys) {
          surveysMap = surveys.reduce((acc: any, survey: any) => {
            acc[survey.id] = survey;
            return acc;
          }, {});
        }
      }

      // Fetch AI analysis for each candidate
      const candidateIds = responses.map((c: any) => c.id);
      let aiAnalyses: any[] = [];
      if (candidateIds.length > 0) {
        const { data: analyses, error: aiError } = await from('job_candidate_ai_analysis')
          .select('*')
          .in('job_response_id', candidateIds)
          .execute();

        if (aiError) {
          console.error('Erro ao carregar análises de IA:', aiError);
          // Não mostrar toast para erro de IA, apenas log
        } else {
          aiAnalyses = analyses || [];
        }
      }

      // Mapear candidatos com informações das vagas
      return responses.map((candidate: any) => {
        const survey = surveysMap[candidate.survey_id];
        return {
          ...candidate,
          survey_title: survey?.title || 'Vaga não encontrada',
          survey_position: survey?.position_title || '',
          ai_analysis: aiAnalyses?.find((a: any) => a.job_response_id === candidate.id)
        };
      }) as Candidate[];
    }
  });

  const refetchCandidates = () => {
    queryClient.invalidateQueries({ queryKey: ['talent-bank', selectedSurvey, competenceFilter] });
  };

  const handleOpenEvaluation = async (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    const { data: evaluation } = await from('job_candidate_evaluations')
      .select('*')
      .eq('job_response_id', candidate.id)
      .maybeSingle()
      .execute();
    setSelectedEvaluation(evaluation || null);
    setShowEvaluationModal(true);
  };

  const handleEvaluationSaved = () => {
    setShowEvaluationModal(false);
    setSelectedCandidate(null);
    setSelectedEvaluation(null);
    refetchCandidates();
  };

  const handleAnalyzeWithAI = async (candidate: Candidate) => {
    setAiLoadingId(candidate.id);
    try {
      toast({
        title: "Analisando candidato...",
        description: "A IA está gerando a análise completa.",
      });

      const { data: jobResponse, error: responseError } = await from('job_responses')
        .select('*')
        .eq('id', candidate.id)
        .single()
        .execute();

      const { data: jobSurvey, error: surveyError } = await from('job_surveys')
        .select('*')
        .eq('id', candidate.survey_id)
        .single()
        .execute();

      if (responseError || surveyError || !jobResponse || !jobSurvey) {
        throw responseError || surveyError || new Error("Dados do candidato ou vaga não encontrados.");
      }

      const { data: discResult } = await from('candidate_responses')
        .select('*')
        .eq('whatsapp', jobResponse.whatsapp || jobResponse.phone || '')
        .eq('is_completed', true)
        .order('created_at', { ascending: false })
        .maybeSingle()
        .execute();

      const { error: analysisError } = await apiClient.invokeFunction('analyze-candidate', {
          job_response_id: candidate.id,
          survey_id: candidate.survey_id,
          candidate_data: {
            name: jobResponse.name,
            email: jobResponse.email,
            age: jobResponse.age,
            phone: jobResponse.phone || jobResponse.whatsapp,
            responses: jobResponse.responses,
            disc_profile: discResult ? {
              d_score: discResult.d_score || 0,
              i_score: discResult.i_score || 0,
              s_score: discResult.s_score || 0,
              c_score: discResult.c_score || 0,
              dominant_profile: discResult.dominant_profile || ''
            } : undefined
          },
          job_data: {
            title: jobSurvey.title,
            position_title: jobSurvey.position_title,
            description: jobSurvey.description,
            requirements: jobSurvey.requirements,
            work_modality: jobSurvey.work_modality,
            contract_type: jobSurvey.contract_type
          }
      });

      if (analysisError) {
        throw analysisError;
      }

      toast({
        title: "Análise gerada!",
        description: "A análise de IA foi criada com sucesso.",
      });
      refetchCandidates();
    } catch (error: any) {
      handleError(error, {
        context: 'TalentBank.handleAnalyzeWithAI',
        fallbackMessage: 'Não foi possível gerar a análise.',
      });
    } finally {
      setAiLoadingId(null);
    }
  };

  const handleApproveWithAI = async (candidate: Candidate) => {
    if (!user?.id) {
      toast({
        title: "Acesso negado",
        description: "Faça login para aprovar com IA.",
        variant: "destructive",
      });
      return;
    }

    setAiLoadingId(candidate.id);
    try {
      toast({
        title: "Avaliando e aprovando...",
        description: "A IA está analisando o candidato e aprovando automaticamente.",
      });

      const { data: jobResponse, error: responseError } = await from('job_responses')
        .select('*')
        .eq('id', candidate.id)
        .single()
        .execute();

      const { data: jobSurvey, error: surveyError } = await from('job_surveys')
        .select('*')
        .eq('id', candidate.survey_id)
        .single()
        .execute();

      if (responseError || surveyError || !jobResponse || !jobSurvey) {
        throw responseError || surveyError || new Error("Dados do candidato ou vaga não encontrados.");
      }

      const { data: discResult } = await from('candidate_responses')
        .select('*')
        .eq('whatsapp', jobResponse.whatsapp || jobResponse.phone || '')
        .eq('is_completed', true)
        .order('created_at', { ascending: false })
        .maybeSingle()
        .execute();

      const { data: analysisData, error: analysisError } = await apiClient.invokeFunction('analyze-candidate', {
        job_response_id: candidate.id,
        survey_id: candidate.survey_id,
        candidate_data: {
          name: jobResponse.name,
          email: jobResponse.email,
          age: jobResponse.age,
          phone: jobResponse.phone || jobResponse.whatsapp,
          responses: jobResponse.responses,
          disc_profile: discResult ? {
            d_score: discResult.d_score || 0,
            i_score: discResult.i_score || 0,
            s_score: discResult.s_score || 0,
            c_score: discResult.c_score || 0,
            dominant_profile: discResult.dominant_profile || ''
          } : undefined
        },
        job_data: {
          title: jobSurvey.title,
          position_title: jobSurvey.position_title,
          description: jobSurvey.description,
          requirements: jobSurvey.requirements,
          work_modality: jobSurvey.work_modality,
          contract_type: jobSurvey.contract_type
        }
      });

      if (analysisError) {
        throw analysisError;
      }

      const { data: profile } = await from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()
        .execute();

      if (!profile) {
        throw new Error("Perfil do avaliador não encontrado.");
      }

      const { data: existingEvaluation } = await from('job_candidate_evaluations')
        .select('*')
        .eq('job_response_id', candidate.id)
        .maybeSingle()
        .execute();

      const evaluationData = {
        job_response_id: candidate.id,
        evaluator_id: profile.id,
        status: 'approved' as const,
        rating: analysisData?.score ? Math.min(Math.max(Math.round(analysisData.score), 1), 5) : 5,
        notes: analysisData?.recommendation || 'Aprovado automaticamente pela IA.'
      };

      if (existingEvaluation) {
        const { error } = await from('job_candidate_evaluations')
          .update(evaluationData)
          .eq('id', existingEvaluation.id)
          .execute();
        if (error) throw error;
      } else {
        const { error } = await from('job_candidate_evaluations')
          .insert(evaluationData)
          .execute();
        if (error) throw error;
      }

      toast({
        title: "✅ Candidato aprovado!",
        description: "Status atualizado para Aprovado com análise da IA.",
      });
      refetchCandidates();
    } catch (error: any) {
      console.error('Erro ao aprovar com IA:', error);
      toast({
        title: "Erro ao aprovar",
        description: error?.message || "Não foi possível aprovar com IA.",
        variant: "destructive",
      });
    } finally {
      setAiLoadingId(null);
    }
  };

  const handleCreateInterview = async (candidate: Candidate) => {
    try {
      const { data: newInterview, error: createError } = await from('job_interviews')
        .insert({
          job_response_id: candidate.id,
          survey_id: candidate.survey_id,
          interview_type: 'online',
          status: 'scheduled',
          questions: []
        })
        .select()
        .single()
        .execute();

      if (createError) {
        const { data: existing } = await from('job_interviews')
          .select('*')
          .eq('job_response_id', candidate.id)
          .eq('interview_type', 'online')
          .maybeSingle()
          .execute();

        if (existing) {
          window.location.href = `/admin/interviews?interview_id=${existing.id}`;
          return;
        }

        throw createError;
      }

      window.location.href = `/admin/interviews?interview_id=${newInterview.id}`;
    } catch (error: any) {
      console.error('Erro ao criar entrevista:', error);
      toast({
        title: "Erro ao criar entrevista",
        description: error?.message || "Não foi possível criar a entrevista.",
        variant: "destructive",
      });
    }
  };

  // Fetch all surveys for filter
  const { data: surveys = [] } = useQuery({
    queryKey: ['all-surveys'],
    queryFn: async () => {
      const { data, error } = await from('job_surveys')
        .select('id, title, position_title')
        .order('created_at', { ascending: false })
        .execute();

      if (error) throw error;
      return data || [];
    }
  });

  const filteredCandidates = useMemo(() => {
    return candidates.filter(candidate => {
      const matchesSearch = 
        candidate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        candidate.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        candidate.survey_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        candidate.survey_position?.toLowerCase().includes(searchTerm.toLowerCase());

      if (competenceFilter === 'all') return matchesSearch;
      
      // Filter by competence from AI analysis
      if (candidate.ai_analysis) {
        const analysis = candidate.ai_analysis;
        const competences = [
          analysis.disc_profile,
          analysis.commitment_level,
          analysis.writing_ability,
          analysis.job_fit_score
        ].filter(Boolean);
        
        return matchesSearch && competences.some(c => 
          c?.toLowerCase().includes(competenceFilter.toLowerCase())
        );
      }

      return matchesSearch;
    });
  }, [candidates, searchTerm, competenceFilter]);

  const exportCandidates = () => {
    const headers = ['Nome', 'Email', 'Telefone', 'Idade', 'Vaga', 'Cargo', 'Data'];
    const csvData = filteredCandidates.map(candidate => [
      candidate.name,
      candidate.email,
      candidate.phone || candidate.whatsapp || '',
      candidate.age || '',
      candidate.survey_title || '',
      candidate.survey_position || '',
      format(new Date(candidate.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })
    ]);

    const csv = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `banco-talentos-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();

    toast({
      title: "Sucesso!",
      description: "Candidatos exportados com sucesso!",
    });
  };

  return (
    <ModernLayout
      title="Banco de Talentos"
      subtitle="Visualize todos os candidatos de todas as vagas"
    >
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Banco de Talentos</CardTitle>
              <CardDescription>
                {filteredCandidates.length} candidato(s) encontrado(s)
              </CardDescription>
            </div>
            <Button onClick={exportCandidates} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, email ou vaga..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={selectedSurvey} onValueChange={setSelectedSurvey}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por vaga" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as vagas</SelectItem>
                  {surveys.map((survey: any) => (
                    <SelectItem key={survey.id} value={survey.id}>
                      {survey.title} - {survey.position_title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={competenceFilter} onValueChange={setCompetenceFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por competência" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as competências</SelectItem>
                  <SelectItem value="alto">Alto comprometimento</SelectItem>
                  <SelectItem value="excelente">Excelente escrita</SelectItem>
                  <SelectItem value="alto fit">Alto fit para vaga</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tabela de candidatos */}
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidato</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Vaga</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Avaliação IA</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <LoadingSkeleton type="table" count={5} />
                      </TableCell>
                    </TableRow>
                  ) : filteredCandidates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum candidato encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCandidates.map((candidate) => (
                      <TableRow key={candidate.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{candidate.name}</div>
                            {candidate.age && (
                              <div className="text-sm text-muted-foreground">
                                {candidate.age} anos
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{candidate.email}</div>
                            {(candidate.phone || candidate.whatsapp) && (
                              <div className="text-muted-foreground">
                                {candidate.phone || candidate.whatsapp}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{candidate.survey_title}</div>
                            <div className="text-sm text-muted-foreground">
                              {candidate.survey_position}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(candidate.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {candidate.ai_analysis ? (
                            <div className="space-y-1">
                              {candidate.ai_analysis.disc_profile && (
                                <Badge variant="outline">
                                  DISC: {candidate.ai_analysis.disc_profile}
                                </Badge>
                              )}
                              {candidate.ai_analysis.commitment_level && (
                                <Badge variant="outline">
                                  Comprometimento: {candidate.ai_analysis.commitment_level}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Sem análise</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-2 justify-end flex-wrap">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/admin/job-surveys/${candidate.survey_id}?candidate_id=${candidate.id}`)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Ver
                            </Button>

                            {candidate.ai_analysis ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/admin/job-surveys/${candidate.survey_id}?candidate_id=${candidate.id}&show_ai=true`)}
                              >
                                <Brain className="h-4 w-4 mr-1" />
                                Ver IA
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={aiLoadingId === candidate.id}
                                onClick={() => handleAnalyzeWithAI(candidate)}
                              >
                                <Brain className="h-4 w-4 mr-1" />
                                Analisar IA
                              </Button>
                            )}

                            <Button
                              variant="outline"
                              size="sm"
                              disabled={aiLoadingId === candidate.id}
                              onClick={() => handleApproveWithAI(candidate)}
                              className="hover:bg-emerald-50 hover:border-emerald-300 dark:hover:bg-emerald-900/20"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Aprovar IA
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCreateInterview(candidate)}
                              className="hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-900/20"
                            >
                              <Video className="h-4 w-4 mr-1" />
                              Criar Entrevista
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenEvaluation(candidate)}
                            >
                              Avaliar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <CandidateEvaluationModal
        isOpen={showEvaluationModal}
        onClose={() => {
          setShowEvaluationModal(false);
          setSelectedCandidate(null);
          setSelectedEvaluation(null);
        }}
        candidate={selectedCandidate as any}
        evaluation={selectedEvaluation}
        onEvaluationSaved={handleEvaluationSaved}
      />
    </ModernLayout>
  );
}

