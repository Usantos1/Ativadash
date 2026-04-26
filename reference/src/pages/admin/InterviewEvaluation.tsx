import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { from } from '@/integrations/db/client';
import { apiClient } from '@/integrations/api/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Brain, FileText, User, Calendar, Video, MapPin, 
  CheckCircle, XCircle, AlertCircle, Loader2, ArrowLeft,
  Sparkles, MessageSquare, Clipboard, Copy, RefreshCw, Target
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ModernLayout } from '@/components/ModernLayout';

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
  questions: any[];
  transcription: string | null;
  ai_evaluation: any;
  ai_recommendation: string | null;
  ai_score: number | null;
  job_response?: {
    name: string;
    email: string;
    phone?: string;
  };
  job_survey?: {
    title: string;
    position_title?: string;
  };
}

interface CandidateResponse {
  questionId: string;
  question: string;
  answer: string;
  observations?: string;
}

export default function InterviewEvaluation() {
  const { interview_id } = useParams<{ interview_id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [candidateResponses, setCandidateResponses] = useState<CandidateResponse[]>([]);
  const [transcription, setTranscription] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isRegeneratingQuestions, setIsRegeneratingQuestions] = useState(false);

  // Buscar dados da entrevista
  const { data: interview, isLoading } = useQuery({
    queryKey: ['interview', interview_id],
    queryFn: async () => {
      const { data, error } = await from('job_interviews')
        .select('*')
        .eq('id', interview_id)
        .single();

      if (error) throw error;
      
      // Buscar dados relacionados separadamente
      const { data: jobResponse } = await from('job_responses')
        .select('id, name, email, phone')
        .eq('id', data.job_response_id)
        .single();
      
      const { data: jobSurvey } = await from('job_surveys')
        .select('id, title, position_title')
        .eq('id', data.survey_id)
        .single();
      
      return {
        ...data,
        job_response: jobResponse,
        job_survey: jobSurvey
      } as Interview;
    },
    enabled: !!interview_id,
  });

  // Inicializar respostas do candidato
  useEffect(() => {
    if (interview?.questions && interview.questions.length > 0) {
      const initialResponses: CandidateResponse[] = interview.questions.map((q: any, index: number) => ({
        questionId: q.id || `q${index}`,
        question: q.question || q.text || '',
        answer: '',
        observations: ''
      }));
      setCandidateResponses(initialResponses);
    }
  }, [interview]);

  // Copiar pergunta para clipboard
  const copyQuestionToClipboard = (question: string) => {
    navigator.clipboard.writeText(question);
    toast({
      title: "Pergunta copiada!",
      description: "Cole no chat do Meet para fazer a pergunta.",
    });
  };

  // Atualizar resposta do candidato
  const updateResponse = (index: number, field: 'answer' | 'observations', value: string) => {
    setCandidateResponses(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Salvar transcrição e respostas
  const saveProgress = async () => {
    if (!interview_id) return;

    try {
      const fullTranscription = candidateResponses
        .map((r, idx) => {
          const q = interview?.questions[idx];
          return `Pergunta ${idx + 1}: ${q?.question || q?.text || ''}\nResposta: ${r.answer}\n${r.observations ? `Observações: ${r.observations}\n` : ''}`;
        })
        .join('\n\n') + (transcription ? `\n\nTranscrição Completa:\n${transcription}` : '');

      const { error } = await from('job_interviews')
        .update({
          transcription: fullTranscription,
          status: 'in_progress',
          updated_at: new Date().toISOString()
        })
        .eq('id', interview_id);

      if (error) throw error;

      toast({
        title: "Progresso salvo!",
        description: "Suas anotações foram salvas com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message || "Não foi possível salvar o progresso.",
        variant: "destructive",
      });
    }
  };

  // Regenerar perguntas da entrevista
  const handleRegenerateQuestions = async () => {
    if (!interview_id || !interview) return;

    setIsRegeneratingQuestions(true);
    try {
      toast({
        title: "Regenerando perguntas...",
        description: "A IA está criando novas perguntas personalizadas para esta entrevista.",
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

      // Atualizar entrevista com perguntas regeneradas
      const { error: updateError } = await from('job_interviews')
        .update({
          questions: data.questions || []
        })
        .eq('id', interview_id)
        .execute();

      if (updateError) throw updateError;

      toast({
        title: "Perguntas regeneradas!",
        description: `${data.questions?.length || 0} novas perguntas foram criadas pela IA.`,
      });

      queryClient.invalidateQueries({ queryKey: ['interview', interview_id] });
    } catch (error: any) {
      console.error('Erro ao regenerar perguntas:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível regenerar as perguntas.",
        variant: "destructive",
      });
    } finally {
      setIsRegeneratingQuestions(false);
    }
  };

  // Avaliar com IA (incluindo análise de perfil)
  const handleEvaluateWithAI = async () => {
    if (!interview_id || !interview) return;

    // Construir transcrição completa: respostas preenchidas + transcrição manual
    const responsesText = candidateResponses
      .filter(r => r.answer.trim()) // Apenas respostas preenchidas
      .map((r, idx) => {
        const q = interview.questions[idx];
        return `Pergunta ${idx + 1}: ${q?.question || q?.text || ''}\nResposta: ${r.answer}\n${r.observations ? `Observações: ${r.observations}\n` : ''}`;
      })
      .join('\n\n');
    
    // Usar transcrição se disponível, caso contrário usar respostas preenchidas
    const fullTranscription = transcription?.trim() || responsesText;

    if (!fullTranscription.trim()) {
      toast({
        title: "Erro",
        description: "Adicione a transcrição da entrevista ou preencha as respostas antes de avaliar.",
        variant: "destructive",
      });
      return;
    }

    setIsEvaluating(true);
    try {
      toast({
        title: "Avaliando entrevista...",
        description: "A IA está analisando as respostas e identificando o perfil do candidato.",
      });

      const { data, error } = await apiClient.invokeFunction('evaluate-interview-transcription', {
          interview_id: interview.id,
          transcription: fullTranscription.trim(),
          interview_type: interview.interview_type,
          job_response_id: interview.job_response_id,
          survey_id: interview.survey_id,
          include_profile_analysis: true // Flag para análise de perfil
      });

      if (error) throw error;

      // Salvar transcrição completa
      await from('job_interviews')
        .update({
          transcription: fullTranscription.trim(),
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', interview_id);

      toast({
        title: "✅ Avaliação concluída!",
        description: `Perfil identificado: ${data.evaluation?.candidate_profile || 'Análise completa'}. Recomendação: ${data.evaluation?.recommendation === 'approved' ? 'Aprovado' : data.evaluation?.recommendation === 'rejected' ? 'Reprovado' : 'Revisão Manual'}`,
      });

      // Recarregar dados da entrevista para mostrar os resultados
      queryClient.invalidateQueries({ queryKey: ['interview', interview_id] });
      queryClient.invalidateQueries({ queryKey: ['admin-interviews'] });
    } catch (error: any) {
      toast({
        title: "❌ Erro",
        description: error.message || "Não foi possível avaliar a entrevista.",
        variant: "destructive",
      });
    } finally {
      setIsEvaluating(false);
    }
  };

  if (isLoading) {
    return (
      <ModernLayout title="Avaliação de Entrevista" subtitle="Carregando...">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </ModernLayout>
    );
  }

  if (!interview) {
    return (
      <ModernLayout title="Avaliação de Entrevista" subtitle="Entrevista não encontrada">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">A entrevista solicitada não foi encontrada.</p>
            <Button onClick={() => navigate('/admin/interviews')} className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para Entrevistas
            </Button>
          </CardContent>
        </Card>
      </ModernLayout>
    );
  }

  return (
    <ModernLayout 
      title="Avaliação de Entrevista" 
      subtitle={`${interview.job_response?.name || 'Candidato'} - ${interview.job_survey?.title || 'Vaga'}`}
    >
      <div className="space-y-6">
        {/* Botão Voltar */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate('/admin/interviews')}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Entrevistas
          </Button>
        </div>
        {/* Informações da Entrevista */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informações da Entrevista
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Candidato</Label>
                <p className="font-medium">{interview.job_response?.name || 'N/A'}</p>
                <p className="text-sm text-muted-foreground">{interview.job_response?.email}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Vaga</Label>
                <p className="font-medium">{interview.job_survey?.title || 'N/A'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Tipo</Label>
                <Badge variant="outline" className="mt-1">
                  {interview.interview_type === 'online' ? (
                    <>
                      <Video className="h-3 w-3 mr-1" />
                      Online
                    </>
                  ) : (
                    <>
                      <MapPin className="h-3 w-3 mr-1" />
                      Presencial
                    </>
                  )}
                </Badge>
              </div>
              {interview.meet_link && (
                <div>
                  <Label className="text-muted-foreground">Link do Meet</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-1"
                    onClick={() => window.open(interview.meet_link!, '_blank')}
                  >
                    <Video className="h-4 w-4 mr-2" />
                    Abrir Meet
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Perguntas e Respostas */}
        {interview.questions && interview.questions.length > 0 ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Perguntas da Entrevista</h2>
                <p className="text-muted-foreground">
                  {interview.questions.length} perguntas geradas pela IA
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleRegenerateQuestions}
                  disabled={isRegeneratingQuestions}
                  title="Regenerar perguntas da entrevista com IA"
                >
                  {isRegeneratingQuestions ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Regenerando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Regenerar Perguntas
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={saveProgress}>
                  <Clipboard className="h-4 w-4 mr-2" />
                  Salvar Progresso
                </Button>
              </div>
            </div>

            {interview.questions.map((q: any, index: number) => (
              <Card key={q.id || index} className="border-2">
                <CardHeader className="bg-muted/50 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className="text-lg px-3 py-1">
                          Pergunta {index + 1}
                        </Badge>
                        {q.category && (
                          <Badge variant="outline">{q.category}</Badge>
                        )}
                      </div>
                      <CardTitle className="text-xl leading-relaxed mb-3">
                        {q.question || q.text}
                      </CardTitle>
                      {q.notes && (
                        <CardDescription className="text-base mt-2 italic">
                          💡 {q.notes}
                        </CardDescription>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyQuestionToClipboard(q.question || q.text)}
                      className="flex-shrink-0"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <Label htmlFor={`answer-${index}`} className="text-base font-semibold mb-2 block">
                      Resposta do Candidato
                    </Label>
                    <Textarea
                      id={`answer-${index}`}
                      placeholder="Digite a resposta do candidato aqui..."
                      value={candidateResponses[index]?.answer || ''}
                      onChange={(e) => updateResponse(index, 'answer', e.target.value)}
                      className="min-h-[120px] text-base leading-relaxed"
                      onBlur={saveProgress}
                    />
                  </div>
                  <Separator />
                  <div>
                    <Label htmlFor={`observations-${index}`} className="text-base font-semibold mb-2 block">
                      Observações e Impressões
                    </Label>
                    <Textarea
                      id={`observations-${index}`}
                      placeholder="Anote suas impressões sobre a resposta: tom de voz, confiança, clareza, exemplos dados, etc..."
                      value={candidateResponses[index]?.observations || ''}
                      onChange={(e) => updateResponse(index, 'observations', e.target.value)}
                      className="min-h-[100px] text-base"
                      onBlur={saveProgress}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">
                Esta entrevista ainda não possui perguntas. Gere as perguntas primeiro.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Transcrição Completa (Opcional) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Transcrição Completa (Opcional)
            </CardTitle>
            <CardDescription>
              Adicione uma transcrição completa da entrevista, se disponível. Isso ajudará na análise de perfil.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Cole aqui a transcrição completa da entrevista, se disponível..."
              value={transcription}
              onChange={(e) => setTranscription(e.target.value)}
              className="min-h-[200px] text-base"
              onBlur={saveProgress}
            />
          </CardContent>
        </Card>

        {/* Ações */}
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Análise com Inteligência Artificial
            </CardTitle>
            <CardDescription>
              A IA irá analisar todas as respostas, identificar o perfil DISC do candidato, avaliar competências e fornecer uma recomendação.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <p className="font-semibold">O que será analisado:</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Perfil comportamental (DISC) baseado nas respostas</li>
                <li>Competências técnicas e comportamentais</li>
                <li>Alinhamento com a vaga</li>
                <li>Pontos fortes e pontos de atenção</li>
                <li>Recomendação final (Aprovado/Reprovado/Revisão Manual)</li>
              </ul>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleEvaluateWithAI}
                disabled={isEvaluating || (!transcription?.trim() && candidateResponses.every(r => !r.answer.trim()))}
                className="flex-1"
                size="lg"
              >
                {isEvaluating ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Analisando com IA...
                  </>
                ) : (
                  <>
                    <Brain className="h-5 w-5 mr-2" />
                    Avaliar com IA e Identificar Perfil
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/admin/interviews')}
                size="lg"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Voltar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Resultados da Análise com IA */}
        {interview.status === 'completed' && interview.ai_evaluation && (
          <Card className="border-2 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                Resultados da Análise com IA
              </CardTitle>
              <CardDescription>
                Avaliação completa da entrevista realizada pela inteligência artificial
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Score e Recomendação
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {interview.ai_score !== null && (
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold">{interview.ai_score}</span>
                          <span className="text-sm text-muted-foreground">/ 100</span>
                        </div>
                      </div>
                    )}
                    {interview.ai_recommendation && (
                      <div>
                        {interview.ai_recommendation === 'approved' && (
                          <Badge variant="default" className="bg-green-500 flex items-center gap-1 w-fit">
                            <CheckCircle className="h-3 w-3" />
                            Aprovado
                          </Badge>
                        )}
                        {interview.ai_recommendation === 'rejected' && (
                          <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                            <XCircle className="h-3 w-3" />
                            Reprovado
                          </Badge>
                        )}
                        {interview.ai_recommendation === 'manual_review' && (
                          <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                            <AlertCircle className="h-3 w-3" />
                            Revisão Manual
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Justificativa</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {interview.ai_evaluation.justification || interview.ai_evaluation.summary || 'Não disponível'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {interview.ai_evaluation.strengths && interview.ai_evaluation.strengths.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Pontos Fortes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc list-inside space-y-1">
                      {interview.ai_evaluation.strengths.map((strength: string, idx: number) => (
                        <li key={idx} className="text-sm text-muted-foreground">{strength}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {interview.ai_evaluation.weaknesses && interview.ai_evaluation.weaknesses.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Pontos de Atenção</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc list-inside space-y-1">
                      {interview.ai_evaluation.weaknesses.map((weakness: string, idx: number) => (
                        <li key={idx} className="text-sm text-muted-foreground">{weakness}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {interview.ai_evaluation.candidate_profile && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Perfil Comportamental (DISC)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="outline" className="text-base px-3 py-1">
                      {interview.ai_evaluation.candidate_profile}
                    </Badge>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </ModernLayout>
  );
}

