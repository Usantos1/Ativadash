import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { from } from '@/integrations/db/client';
import { apiClient } from '@/integrations/api/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Video, MapPin, Calendar, Brain, FileText, CheckCircle, XCircle, 
  AlertCircle, Clock, User, Search, Plus, ExternalLink, Loader2,
  MessageSquare, Sparkles, Eye, Trash2, RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface Interview {
  id: string;
  job_response_id: string;
  survey_id: string;
  interview_type: 'online' | 'presencial';
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  scheduled_at: string | null;
  completed_at: string | null;
  meet_link: string | null;
  location: string | null;
  interviewer_id: string | null;
  questions: any[];
  transcription: string | null;
  ai_evaluation: any;
  ai_recommendation: 'approved' | 'rejected' | 'manual_review' | null;
  ai_score: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  job_response?: {
    name: string;
    email: string;
    phone: string;
  };
  job_survey?: {
    title: string;
    position_title: string;
  };
}

export const AdminInterviewsManager = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [showTranscriptionDialog, setShowTranscriptionDialog] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'online' | 'presencial'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled'>('all');
  const [showCreateInterviewDialog, setShowCreateInterviewDialog] = useState(false);
  const [selectedJobResponseId, setSelectedJobResponseId] = useState<string | null>(null);
  const [selectedInterviewType, setSelectedInterviewType] = useState<'online' | 'presencial'>('online');
  const [creatingInterviews, setCreatingInterviews] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'candidates' | 'interviews'>('candidates');
  const [deletingInterviewId, setDeletingInterviewId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [interviewToDelete, setInterviewToDelete] = useState<Interview | null>(null);
  const [reEvaluatingInterviewId, setReEvaluatingInterviewId] = useState<string | null>(null);

  // Buscar candidatos avaliados/prontos para entrevista (com análise de IA)
  const { data: evaluatedCandidates = [] } = useQuery({
    queryKey: ['evaluated-candidates-for-interviews'],
    queryFn: async () => {
      // Buscar análises de IA
      const { data: aiAnalyses, error: analysisError } = await from('job_candidate_ai_analysis')
        .select('*')
        .order('created_at', { ascending: false })
        .execute();

      if (analysisError) {
        console.error('Error fetching AI analyses:', analysisError);
        return [];
      }

      if (!aiAnalyses || aiAnalyses.length === 0) {
        return [];
      }

      // Buscar dados relacionados separadamente
      const enrichedAnalyses = await Promise.all((aiAnalyses || []).map(async (analysis) => {
        const { data: jobResponse } = await from('job_responses')
          .select('*')
          .eq('id', analysis.job_response_id)
          .single();

        const { data: jobSurvey } = await from('job_surveys')
          .select('*')
          .eq('id', analysis.survey_id)
          .single();

        return {
          ...analysis,
          job_response: jobResponse ? {
            ...jobResponse,
            job_surveys: jobSurvey
          } : null
        };
      }));

      // Verificar quais candidatos já têm entrevista
      const responseIds = enrichedAnalyses.map(a => a.job_response_id).filter(Boolean);
      if (responseIds.length === 0) {
        return enrichedAnalyses.map(analysis => ({
          ...analysis,
          has_online_interview: false,
          has_presencial_interview: false,
          interviews: []
        }));
      }

      const { data: existingInterviews } = await from('job_interviews')
        .select('job_response_id, interview_type, status')
        .execute();

      const interviewsMap = new Map();
      (existingInterviews || []).forEach(interview => {
        if (!interviewsMap.has(interview.job_response_id)) {
          interviewsMap.set(interview.job_response_id, []);
        }
        interviewsMap.get(interview.job_response_id).push(interview);
      });

      // Adicionar informação de entrevistas existentes
      return enrichedAnalyses
        .filter(analysis => analysis.job_response !== null)
        .map(analysis => ({
          ...analysis,
          has_online_interview: interviewsMap.get(analysis.job_response_id)?.some((i: any) => i.interview_type === 'online' && i.status !== 'cancelled') || false,
          has_presencial_interview: interviewsMap.get(analysis.job_response_id)?.some((i: any) => i.interview_type === 'presencial' && i.status !== 'cancelled') || false,
          interviews: interviewsMap.get(analysis.job_response_id) || []
        }));
    }
  });

  // Buscar todas as candidaturas para criar entrevistas
  const { data: allJobResponses = [] } = useQuery({
    queryKey: ['all-job-responses-for-interviews'],
    queryFn: async () => {
      const { data, error } = await from('job_responses')
        .select('id, name, email, survey_id')
        .order('created_at', { ascending: false })
        .limit(1000)
        .execute();

      if (error) {
        console.error('Error fetching job responses:', error);
        return [];
      }
      return data || [];
    }
  });

  // Buscar entrevistas
  const { data: interviews = [], isLoading } = useQuery({
    queryKey: ['admin-interviews'],
    queryFn: async () => {
      const { data: interviewsData, error } = await from('job_interviews')
        .select('*')
        .order('created_at', { ascending: false })
        .execute();

      if (error) throw error;

      // Buscar dados relacionados
      const enrichedInterviews = await Promise.all((interviewsData || []).map(async (interview: any) => {
        const { data: jobResponse } = await from('job_responses')
          .select('id, name, email, phone')
          .eq('id', interview.job_response_id)
          .maybeSingle();

        const { data: jobSurvey } = await from('job_surveys')
          .select('id, title, position_title')
          .eq('id', interview.survey_id)
          .maybeSingle();

        return {
          ...interview,
          job_response: jobResponse,
          job_survey: jobSurvey
        };
      }));

      return enrichedInterviews as Interview[];
    }
  });

  // Filtrar entrevistas
  const filteredInterviews = interviews.filter(interview => {
    const matchesSearch = !searchTerm || 
      interview.job_response?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      interview.job_survey?.title?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === 'all' || interview.interview_type === typeFilter;
    const matchesStatus = statusFilter === 'all' || interview.status === statusFilter;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  // Gerar perguntas de entrevista
  const handleGenerateQuestions = async (interview: Interview) => {
    setGeneratingQuestions(true);
    try {
      toast({
        title: "Gerando perguntas...",
        description: "A IA está criando perguntas personalizadas para esta entrevista.",
      });

      const { data: aiAnalysis } = await from('job_candidate_ai_analysis')
        .select('*')
        .eq('job_response_id', interview.job_response_id)
        .maybeSingle();

      const { data, error } = await apiClient.invokeFunction('generate-interview-questions', {
        body: {
          job_response_id: interview.job_response_id,
          survey_id: interview.survey_id,
          interview_type: interview.interview_type,
          ai_analysis: aiAnalysis?.analysis_data
        }
      });

      if (error) throw error;

      // Atualizar entrevista com perguntas geradas
      const { error: updateError } = await from('job_interviews')
        .update({
          questions: data.questions || [],
          status: 'scheduled'
        })
        .eq('id', interview.id)
        .execute();

      if (updateError) throw updateError;

      toast({
        title: "Perguntas geradas!",
        description: `${data.questions?.length || 0} perguntas foram criadas pela IA.`,
      });

      queryClient.invalidateQueries({ queryKey: ['admin-interviews'] });
      setShowGenerateDialog(false);
    } catch (error: any) {
      console.error('Erro ao gerar perguntas:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível gerar as perguntas.",
        variant: "destructive",
      });
    } finally {
      setGeneratingQuestions(false);
    }
  };

  // Avaliar transcrição
  const handleEvaluateTranscription = async () => {
    if (!selectedInterview || !transcription.trim()) {
      toast({
        title: "Erro",
        description: "Transcrição não pode estar vazia.",
        variant: "destructive",
      });
      return;
    }

    setEvaluating(true);
    try {
      toast({
        title: "Avaliando transcrição...",
        description: "A IA está analisando a entrevista.",
      });

      const { data, error } = await apiClient.invokeFunction('evaluate-interview-transcription', {
        body: {
          interview_id: selectedInterview.id,
          transcription: transcription.trim(),
          interview_type: selectedInterview.interview_type,
          job_response_id: selectedInterview.job_response_id,
          survey_id: selectedInterview.survey_id
        }
      });

      if (error) throw error;

      toast({
        title: "Avaliação concluída!",
        description: `Recomendação: ${data.evaluation?.recommendation === 'approved' ? 'Aprovado' : data.evaluation?.recommendation === 'rejected' ? 'Reprovado' : 'Revisão Manual'}`,
      });

      queryClient.invalidateQueries({ queryKey: ['admin-interviews'] });
      setShowTranscriptionDialog(false);
      setTranscription('');
      setSelectedInterview(null);
    } catch (error: any) {
      console.error('Erro ao avaliar transcrição:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível avaliar a transcrição.",
        variant: "destructive",
      });
    } finally {
      setEvaluating(false);
    }
  };

  // Re-avaliar transcrição (nova avaliação)
  const handleReEvaluateTranscription = async (interview: Interview) => {
    if (!interview.transcription || !interview.transcription.trim()) {
      toast({
        title: "Erro",
        description: "Esta entrevista não possui transcrição para re-avaliar.",
        variant: "destructive",
      });
      return;
    }

    setReEvaluatingInterviewId(interview.id);
    try {
      toast({
        title: "Re-avaliando transcrição...",
        description: "A IA está analisando novamente a entrevista.",
      });

      const { data, error } = await apiClient.invokeFunction('evaluate-interview-transcription', {
        body: {
          interview_id: interview.id,
          transcription: interview.transcription.trim(),
          interview_type: interview.interview_type,
          job_response_id: interview.job_response_id,
          survey_id: interview.survey_id
        }
      });

      if (error) throw error;

      toast({
        title: "✅ Nova avaliação concluída!",
        description: `Recomendação atualizada: ${data.evaluation?.recommendation === 'approved' ? 'Aprovado' : data.evaluation?.recommendation === 'rejected' ? 'Reprovado' : 'Revisão Manual'}`,
      });

      queryClient.invalidateQueries({ queryKey: ['admin-interviews'] });
    } catch (error: any) {
      toast({
        title: "❌ Erro",
        description: error.message || "Não foi possível re-avaliar a transcrição.",
        variant: "destructive",
      });
    } finally {
      setReEvaluatingInterviewId(null);
    }
  };

  // Excluir entrevista
  const handleDeleteInterview = async () => {
    if (!interviewToDelete) return;

    setDeletingInterviewId(interviewToDelete.id);
    try {
      const { error } = await from('job_interviews')
        .delete()
        .eq('id', interviewToDelete.id)
        .execute();

      if (error) throw error;

      toast({
        title: "✅ Entrevista excluída!",
        description: "A entrevista foi removida com sucesso.",
      });

      queryClient.invalidateQueries({ queryKey: ['admin-interviews'] });
      queryClient.invalidateQueries({ queryKey: ['evaluated-candidates-for-interviews'] });
      setShowDeleteDialog(false);
      setInterviewToDelete(null);
    } catch (error: any) {
      toast({
        title: "❌ Erro",
        description: error.message || "Não foi possível excluir a entrevista.",
        variant: "destructive",
      });
    } finally {
      setDeletingInterviewId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      scheduled: { variant: 'outline' as const, label: 'Agendada', icon: Calendar },
      in_progress: { variant: 'secondary' as const, label: 'Em Andamento', icon: Clock },
      completed: { variant: 'default' as const, label: 'Concluída', icon: CheckCircle },
      cancelled: { variant: 'destructive' as const, label: 'Cancelada', icon: XCircle },
    };
    const config = variants[status] || variants.scheduled;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getRecommendationBadge = (recommendation: string | null) => {
    if (!recommendation) return null;
    
    const variants: Record<string, any> = {
      approved: { variant: 'default' as const, label: 'Aprovado', icon: CheckCircle, className: 'bg-green-500' },
      rejected: { variant: 'destructive' as const, label: 'Reprovado', icon: XCircle },
      manual_review: { variant: 'secondary' as const, label: 'Revisão Manual', icon: AlertCircle },
    };
    const config = variants[recommendation] || variants.manual_review;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className={`flex items-center gap-1 ${config.className || ''}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button
          onClick={() => setShowCreateInterviewDialog(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Nova Entrevista
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'candidates' | 'interviews')} className="space-y-4">
        <TabsList>
          <TabsTrigger value="candidates">Candidatos Avaliados ({evaluatedCandidates.length})</TabsTrigger>
          <TabsTrigger value="interviews">Entrevistas ({filteredInterviews.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="candidates" className="space-y-4">
          {/* Lista de Candidatos Avaliados */}
          <Card>
            <CardHeader>
              <CardTitle>Candidatos Prontos para Entrevista</CardTitle>
              <CardDescription>
                Candidatos com análise de IA completa - Prontos para entrevista
              </CardDescription>
            </CardHeader>
            <CardContent>
              {evaluatedCandidates.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Nenhum candidato avaliado encontrado</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Candidato</TableHead>
                        <TableHead>Vaga</TableHead>
                        <TableHead>Score IA</TableHead>
                        <TableHead>Recomendação</TableHead>
                        <TableHead>Entrevistas</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {evaluatedCandidates
                        .filter((candidate: any) => candidate.job_response !== null)
                        .map((candidate: any) => {
                        const analysis = candidate.analysis_data || {};
                        const jobResponse = candidate.job_response;
                        const jobSurvey = jobResponse?.job_surveys || {};
                        
                        return (
                          <TableRow key={candidate.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{jobResponse?.name || 'N/A'}</div>
                                <div className="text-sm text-muted-foreground">{jobResponse?.email}</div>
                                {jobResponse?.phone && (
                                  <div className="text-xs text-muted-foreground">{jobResponse.phone}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">{jobSurvey.title || 'N/A'}</div>
                              <div className="text-xs text-muted-foreground">{jobSurvey.position_title}</div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-bold">{candidate.analysis_data?.score_geral || 0}</span>
                                <span className="text-xs text-muted-foreground">/100</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {getRecommendationBadge(candidate.analysis_data?.recomendacao)}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {candidate.has_online_interview ? (
                                  <Badge variant="outline" className="w-fit">
                                    <Video className="h-3 w-3 mr-1" />
                                    Online
                                  </Badge>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={async () => {
                                      try {
                                        toast({
                                          title: "Criando entrevista...",
                                          description: "Aguarde um momento.",
                                        });

                                        const { data: newInterview, error } = await from('job_interviews')
                                          .insert({
                                            job_response_id: candidate.job_response_id,
                                            survey_id: candidate.survey_id,
                                            interview_type: 'online',
                                            status: 'scheduled',
                                            questions: []
                                          })
                                          .select()
                                          .single();

                                        if (error) {
                                          // Se já existe, buscar a existente
                                          if (error.code === '23505' || error.message?.includes('duplicate')) { // Unique violation
                                            const { data: existing } = await from('job_interviews')
                                              .select('*')
                                              .eq('job_response_id', candidate.job_response_id)
                                              .eq('interview_type', 'online')
                                              .maybeSingle();

                                            if (existing) {
                                              toast({
                                                title: "Entrevista já existe!",
                                                description: "Esta entrevista online já foi criada anteriormente.",
                                              });
                                              queryClient.invalidateQueries({ queryKey: ['evaluated-candidates-for-interviews'] });
                                              queryClient.invalidateQueries({ queryKey: ['admin-interviews'] });
                                              return;
                                            }
                                          }
                                          throw error;
                                        }

                                        toast({
                                          title: "✅ Entrevista online criada!",
                                          description: "Agora você pode gerar perguntas na aba 'Entrevistas'.",
                                        });

                                        queryClient.invalidateQueries({ queryKey: ['evaluated-candidates-for-interviews'] });
                                        queryClient.invalidateQueries({ queryKey: ['admin-interviews'] });
                                        
                                        // Mudar para aba de entrevistas após criar
                                        setTimeout(() => {
                                          setActiveTab('interviews');
                                        }, 1500);
                                      } catch (error: any) {
                                        console.error('Erro ao criar entrevista:', error);
                                        toast({
                                          title: "❌ Erro",
                                          description: error.message || "Não foi possível criar entrevista.",
                                          variant: "destructive",
                                        });
                                      }
                                    }}
                                    className="w-fit text-xs h-7"
                                  >
                                    <Video className="h-3 w-3 mr-1" />
                                    Criar Online
                                  </Button>
                                )}
                                {candidate.has_presencial_interview ? (
                                  <Badge variant="outline" className="w-fit">
                                    <MapPin className="h-3 w-3 mr-1" />
                                    Presencial
                                  </Badge>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={creatingInterviews.has(`${candidate.job_response_id}-presencial`)}
                                    onClick={async () => {
                                      const key = `${candidate.job_response_id}-presencial`;
                                      setCreatingInterviews(prev => new Set(prev).add(key));
                                      
                                      try {
                                        toast({
                                          title: "Criando entrevista presencial...",
                                          description: "Aguarde um momento.",
                                        });

                                        const { data: newInterview, error } = await from('job_interviews')
                                          .insert({
                                            job_response_id: candidate.job_response_id,
                                            survey_id: candidate.survey_id,
                                            interview_type: 'presencial',
                                            status: 'scheduled',
                                            questions: []
                                          })
                                          .select()
                                          .single();

                                        if (error) {
                                          // Se já existe, buscar a existente
                                          if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
                                            const { data: existing } = await from('job_interviews')
                                              .select('*')
                                              .eq('job_response_id', candidate.job_response_id)
                                              .eq('interview_type', 'presencial')
                                              .maybeSingle();

                                            if (existing) {
                                              toast({
                                                title: "ℹ️ Entrevista já existe!",
                                                description: "Esta entrevista presencial já foi criada anteriormente.",
                                              });
                                              queryClient.invalidateQueries({ queryKey: ['evaluated-candidates-for-interviews'] });
                                              queryClient.invalidateQueries({ queryKey: ['admin-interviews'] });
                                              return;
                                            }
                                          }
                                          throw error;
                                        }

                                        toast({
                                          title: "✅ Entrevista presencial criada com sucesso!",
                                          description: "Agora você pode gerar perguntas na aba 'Entrevistas'.",
                                        });

                                        queryClient.invalidateQueries({ queryKey: ['evaluated-candidates-for-interviews'] });
                                        queryClient.invalidateQueries({ queryKey: ['admin-interviews'] });
                                        
                                        // Mudar para aba de entrevistas após criar
                                        setTimeout(() => {
                                          setActiveTab('interviews');
                                        }, 1500);
                                      } catch (error: any) {
                                        console.error('Erro ao criar entrevista:', error);
                                        toast({
                                          title: "❌ Erro ao criar entrevista",
                                          description: error.message || "Não foi possível criar entrevista. Tente novamente.",
                                          variant: "destructive",
                                        });
                                      } finally {
                                        setCreatingInterviews(prev => {
                                          const newSet = new Set(prev);
                                          newSet.delete(key);
                                          return newSet;
                                        });
                                      }
                                    }}
                                    className="w-fit text-xs h-7"
                                  >
                                    {creatingInterviews.has(`${candidate.job_response_id}-presencial`) ? (
                                      <>
                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                        Criando...
                                      </>
                                    ) : (
                                      <>
                                        <MapPin className="h-3 w-3 mr-1" />
                                        Criar Presencial
                                      </>
                                    )}
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center gap-1 justify-end">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    // Filtrar entrevistas por este candidato na aba de entrevistas
                                    setSearchTerm(jobResponse?.name || '');
                                    // Mudar para aba de entrevistas
                                    setActiveTab('interviews');
                                  }}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  Ver Entrevistas
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    // Abrir análise de IA do candidato
                                    window.location.href = `/admin/job-surveys?survey_id=${candidate.survey_id}&candidate_id=${candidate.job_response_id}`;
                                  }}
                                >
                                  <Brain className="h-4 w-4 mr-1" />
                                  Ver IA
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="interviews" className="space-y-4">
          {/* Filtros */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por candidato ou vaga..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="presencial">Presencial</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="scheduled">Agendada</SelectItem>
                    <SelectItem value="in_progress">Em Andamento</SelectItem>
                    <SelectItem value="completed">Concluída</SelectItem>
                    <SelectItem value="cancelled">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Tabela de Entrevistas */}
          <Card>
            <CardHeader>
              <CardTitle>Entrevistas ({filteredInterviews.length})</CardTitle>
              <CardDescription>
                Gerencie entrevistas online e presenciais com suporte de IA
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                  <p className="text-muted-foreground">Carregando...</p>
                </div>
              ) : filteredInterviews.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Nenhuma entrevista encontrada</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Candidato</TableHead>
                        <TableHead>Vaga</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Recomendação IA</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInterviews.map((interview) => (
                        <TableRow key={interview.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{interview.job_response?.name || 'N/A'}</div>
                              <div className="text-sm text-muted-foreground">{interview.job_response?.email}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{interview.job_survey?.title || 'N/A'}</div>
                            <div className="text-xs text-muted-foreground">{interview.job_survey?.position_title}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="flex items-center gap-1 w-fit">
                              {interview.interview_type === 'online' ? (
                                <>
                                  <Video className="h-3 w-3" />
                                  Online
                                </>
                              ) : (
                                <>
                                  <MapPin className="h-3 w-3" />
                                  Presencial
                                </>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(interview.status)}</TableCell>
                          <TableCell>
                            {interview.scheduled_at ? (
                              <div className="text-sm">
                                {format(new Date(interview.scheduled_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">Não agendada</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {getRecommendationBadge(interview.ai_recommendation)}
                            {interview.ai_score !== null && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Score: {interview.ai_score}/100
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center gap-1 justify-end">
                              {interview.status !== 'completed' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedInterview(interview);
                                    handleGenerateQuestions(interview);
                                  }}
                                  disabled={generatingQuestions}
                                  title={interview.questions.length > 0 ? "Regenerar perguntas da entrevista" : "Gerar perguntas da entrevista"}
                                >
                                  {generatingQuestions ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : interview.questions.length > 0 ? (
                                    <>
                                      <RefreshCw className="h-4 w-4 mr-1" />
                                      Regenerar Perguntas
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="h-4 w-4 mr-1" />
                                      Gerar Perguntas
                                    </>
                                  )}
                                </Button>
                              )}
                              {interview.status === 'completed' && interview.transcription && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedInterview(interview);
                                      setShowTranscriptionDialog(true);
                                    }}
                                  >
                                    <FileText className="h-4 w-4 mr-1" />
                                    Ver Avaliação
                                  </Button>
                                  {interview.ai_evaluation && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleReEvaluateTranscription(interview)}
                                      disabled={reEvaluatingInterviewId === interview.id}
                                    >
                                      {reEvaluatingInterviewId === interview.id ? (
                                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                      ) : (
                                        <RefreshCw className="h-4 w-4 mr-1" />
                                      )}
                                      Nova Avaliação
                                    </Button>
                                  )}
                                </>
                              )}
                              {interview.status !== 'completed' && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => {
                                    window.location.href = `/admin/interviews/evaluate/${interview.id}`;
                                  }}
                                >
                                  <MessageSquare className="h-4 w-4 mr-1" />
                                  Avaliar Entrevista
                                </Button>
                              )}
                              {interview.meet_link && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(interview.meet_link!, '_blank')}
                                >
                                  <ExternalLink className="h-4 w-4 mr-1" />
                                  Meet
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setInterviewToDelete(interview);
                                  setShowDeleteDialog(true);
                                }}
                                disabled={deletingInterviewId === interview.id}
                                className="text-destructive hover:text-destructive"
                              >
                                {deletingInterviewId === interview.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog para avaliar transcrição */}
      <Dialog open={showTranscriptionDialog} onOpenChange={setShowTranscriptionDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              {selectedInterview?.status === 'completed' ? 'Avaliação da Entrevista' : 'Avaliar Transcrição'}
            </DialogTitle>
            <DialogDescription>
              {selectedInterview?.status === 'completed' 
                ? 'Visualize a avaliação da IA para esta entrevista'
                : 'Cole a transcrição da entrevista para avaliação automática pela IA'}
            </DialogDescription>
          </DialogHeader>

          {selectedInterview?.status === 'completed' && selectedInterview.ai_evaluation ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Recomendação</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {getRecommendationBadge(selectedInterview.ai_recommendation)}
                    {selectedInterview.ai_score !== null && (
                      <div className="mt-2 text-2xl font-bold">{selectedInterview.ai_score}/100</div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Justificativa</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{selectedInterview.ai_evaluation.justification}</p>
                  </CardContent>
                </Card>
              </div>

              {selectedInterview.ai_evaluation.strengths_identified && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Pontos Fortes Identificados</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc list-inside space-y-1">
                      {selectedInterview.ai_evaluation.strengths_identified.map((strength: string, idx: number) => (
                        <li key={idx} className="text-sm">{strength}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {selectedInterview.ai_evaluation.concerns_identified && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Pontos de Atenção</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc list-inside space-y-1">
                      {selectedInterview.ai_evaluation.concerns_identified.map((concern: string, idx: number) => (
                        <li key={idx} className="text-sm">{concern}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Transcrição</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs whitespace-pre-wrap bg-muted p-4 rounded">
                    {selectedInterview.transcription}
                  </pre>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="transcription">Transcrição da Entrevista</Label>
                <Textarea
                  id="transcription"
                  placeholder="Cole aqui a transcrição completa da entrevista..."
                  value={transcription}
                  onChange={(e) => setTranscription(e.target.value)}
                  className="min-h-[300px] mt-2"
                />
                <p className="text-sm text-muted-foreground mt-2">
                  A IA irá analisar a transcrição e fornecer uma recomendação automática.
                </p>
              </div>

              {selectedInterview?.questions && selectedInterview.questions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Perguntas da Entrevista</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ol className="list-decimal list-inside space-y-2">
                      {selectedInterview.questions.map((q: any, idx: number) => (
                        <li key={idx} className="text-sm">
                          <strong>{q.question}</strong>
                          {q.notes && <span className="text-muted-foreground"> - {q.notes}</span>}
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <DialogFooter>
            {selectedInterview?.status !== 'completed' && (
              <Button
                onClick={handleEvaluateTranscription}
                disabled={!transcription.trim() || evaluating}
              >
                {evaluating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Avaliando...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4 mr-2" />
                    Avaliar com IA
                  </>
                )}
              </Button>
            )}
            <Button variant="outline" onClick={() => {
              setShowTranscriptionDialog(false);
              setTranscription('');
              setSelectedInterview(null);
            }}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para confirmar exclusão */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir esta entrevista? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          {interviewToDelete && (
            <div className="space-y-2 py-4">
              <div className="text-sm">
                <strong>Candidato:</strong> {interviewToDelete.job_response?.name || 'N/A'}
              </div>
              <div className="text-sm">
                <strong>Vaga:</strong> {interviewToDelete.job_survey?.title || 'N/A'}
              </div>
              <div className="text-sm">
                <strong>Tipo:</strong> {interviewToDelete.interview_type === 'online' ? 'Online' : 'Presencial'}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setInterviewToDelete(null);
              }}
              disabled={deletingInterviewId !== null}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteInterview}
              disabled={deletingInterviewId !== null}
            >
              {deletingInterviewId ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para criar nova entrevista */}
      <Dialog open={showCreateInterviewDialog} onOpenChange={setShowCreateInterviewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Criar Nova Entrevista</DialogTitle>
            <DialogDescription>
              Selecione um candidato e o tipo de entrevista
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="job_response">Candidato</Label>
              <Select 
                value={selectedJobResponseId || ''} 
                onValueChange={(v) => setSelectedJobResponseId(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um candidato" />
                </SelectTrigger>
                <SelectContent>
                  {allJobResponses.length === 0 ? (
                    <SelectItem value="" disabled>Carregando candidatos...</SelectItem>
                  ) : (
                    allJobResponses.map((response: any) => (
                      <SelectItem key={response.id} value={response.id}>
                        {response.name || 'N/A'} - {response.survey_title || 'N/A'}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="interview_type">Tipo de Entrevista</Label>
              <Select 
                value={selectedInterviewType} 
                onValueChange={(v: 'online' | 'presencial') => setSelectedInterviewType(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Online (Videoconferência)</SelectItem>
                  <SelectItem value="presencial">Presencial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateInterviewDialog(false);
                setSelectedJobResponseId(null);
                setSelectedInterviewType('online');
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!selectedJobResponseId) {
                  toast({
                    title: "Erro",
                    description: "Selecione um candidato",
                    variant: "destructive",
                  });
                  return;
                }

                try {
                  // Buscar job_response para pegar survey_id
                  const { data: jobResponse } = await from('job_responses')
                    .select('*')
                    .eq('id', selectedJobResponseId)
                    .single();

                  if (!jobResponse) {
                    throw new Error('Candidato não encontrado');
                  }

                  const { data: newInterview, error } = await from('job_interviews')
                    .insert({
                      job_response_id: selectedJobResponseId,
                      survey_id: jobResponse.survey_id,
                      interview_type: selectedInterviewType,
                      status: 'scheduled',
                      questions: []
                    })
                    .select()
                    .single();

                  if (error) throw error;

                  toast({
                    title: "Entrevista criada!",
                    description: "Agora você pode gerar perguntas e agendar.",
                  });

                  queryClient.invalidateQueries({ queryKey: ['admin-interviews'] });
                  setShowCreateInterviewDialog(false);
                  setSelectedJobResponseId(null);
                  setSelectedInterviewType('online');
                } catch (error: any) {
                  toast({
                    title: "Erro",
                    description: error.message || "Não foi possível criar entrevista.",
                    variant: "destructive",
                  });
                }
              }}
            >
              Criar Entrevista
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

