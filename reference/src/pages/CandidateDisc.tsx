import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useCandidateDiscTest } from '@/hooks/useCandidateDiscTest';
import { DiscTestResults } from '@/components/DiscTestResults';
import { ImprovedDiscTestForm } from '@/components/ImprovedDiscTestForm';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, User, Phone, Calendar, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { from } from '@/integrations/db/client';
import { apiClient } from '@/integrations/api/client';
// Logo correto do Prime Camp
const logoImage = "https://primecamp.com.br/wp-content/uploads/2025/07/Design-sem-nome-4.png";

interface CandidateInfo {
  name: string;
  age: number;
  whatsapp: string;
  email?: string;
}

const CandidateDisc = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(true);
  const [consentLGPD, setConsentLGPD] = useState(false);
  const [loadingCandidateData, setLoadingCandidateData] = useState(false);
  
  // Pega o protocolo da candidatura se foi passado via query parameter
  const jobProtocol = searchParams.get('job_protocol');
  const jobResponseId = searchParams.get('job_response_id');
  const surveyId = searchParams.get('survey_id');

  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo>({
    name: '',
    age: 0,
    whatsapp: '',
    email: ''
  });

  // Buscar dados da candidatura e pré-preencher formulário
  const loadCandidateDataFromJob = async (protocol: string) => {
    try {
      setLoadingCandidateData(true);
      console.log('🔍 Buscando dados da candidatura:', protocol);
      
      // 🚫 SUPABASE REMOVIDO - Usar API PostgreSQL
      const API_URL = import.meta.env.VITE_API_URL || 'https://api.ativafix.com/api';
      
      const response = await fetch(
        `${API_URL}/functions/get-candidate-data?protocol=${encodeURIComponent(protocol)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Erro ao buscar candidatura:', errorData);
        throw new Error(errorData.error || 'Erro ao buscar candidatura');
      }

      const result = await response.json();

      if (!result?.success || !result?.data) {
        console.log('ℹ️ Candidatura não encontrada para protocolo:', protocol);
        toast.info('Dados da candidatura não encontrados. Preencha manualmente.');
        return;
      }

      const jobResponse = result.data;
      console.log('✅ Dados da candidatura encontrados:', jobResponse);

      // Pré-preenche os dados do candidato
      const prefilledData: CandidateInfo = {
        name: jobResponse.name || '',
        age: jobResponse.age || 0,
        whatsapp: jobResponse.whatsapp || jobResponse.phone || '',
        email: jobResponse.email || ''
      };

      setCandidateInfo(prefilledData);
      setConsentLGPD(true); // Já deu consentimento na candidatura
      
      toast.success(`Dados carregados da candidatura ${protocol.substring(0, 8)}...`);
      
      // Se todos os dados obrigatórios estão preenchidos, inicia o teste automaticamente
      if (prefilledData.name && prefilledData.whatsapp && prefilledData.age >= 16) {
        console.log('🚀 Iniciando teste automaticamente com dados pré-preenchidos');
        await startTest(prefilledData);
        setShowForm(false);
      }
      
    } catch (error) {
      console.error('❌ Erro ao carregar dados da candidatura:', error);
      toast.error('Erro ao carregar dados da candidatura. Preencha manualmente.');
    } finally {
      setLoadingCandidateData(false);
    }
  };

  const {
    result,
    isCompleted,
    loading,
    isInProgress,
    candidateInfo: savedCandidateInfo,
    candidateId,
    startTest,
    resetTest
  } = useCandidateDiscTest();

  // Carregar dados da candidatura quando job_response_id estiver presente
  const loadCandidateDataFromJobResponseId = async (responseId: string) => {
    try {
      setLoadingCandidateData(true);
      console.log('🔍 Buscando dados da candidatura pelo ID:', responseId);
      
      const { data: jobResponse, error } = await from('job_responses')
        .select('*')
        .eq('id', responseId)
        .single();

      if (error) {
        console.error('❌ Erro ao buscar candidatura:', error);
        // Se for erro 429, não mostrar toast (evitar spam) e parar tentativas
        if (error.code === 429 || error.message?.includes('429')) {
          console.error('⚠️ Muitas requisições. Aguarde antes de tentar novamente.');
          setLoadingCandidateData(false);
          return;
        }
        toast.error('Erro ao carregar dados da candidatura. Preencha manualmente.');
        setLoadingCandidateData(false);
        return;
      }

      if (!jobResponse) {
        console.log('ℹ️ Candidatura não encontrada para ID:', responseId);
        toast.info('Dados da candidatura não encontrados. Preencha manualmente.');
        setLoadingCandidateData(false);
        return;
      }

      console.log('✅ Dados da candidatura encontrados:', jobResponse);

      // Pré-preenche os dados do candidato
      const prefilledData: CandidateInfo = {
        name: jobResponse.name || '',
        age: jobResponse.age || 0,
        whatsapp: jobResponse.whatsapp || jobResponse.phone || '',
        email: jobResponse.email || ''
      };

      setCandidateInfo(prefilledData);
      setConsentLGPD(true); // Já deu consentimento na candidatura
      
      // Se todos os dados obrigatórios estão preenchidos, inicia o teste automaticamente
      if (prefilledData.name && prefilledData.whatsapp && prefilledData.age >= 16) {
        console.log('🚀 Iniciando teste automaticamente com dados pré-preenchidos');
        // IMPORTANTE: Resetar loading ANTES de iniciar o teste para permitir renderização
        setLoadingCandidateData(false);
        try {
          await startTest(prefilledData);
          console.log('✅ Teste iniciado com sucesso');
          // O hook vai atualizar isInProgress automaticamente
        } catch (startError: any) {
          console.error('❌ Erro ao iniciar teste:', startError);
          toast.error(`Erro ao iniciar teste: ${startError.message || 'Erro desconhecido'}`);
        }
      } else {
        toast.success('Dados carregados! Complete as informações para iniciar.');
        setLoadingCandidateData(false);
      }
      
    } catch (error: any) {
      console.error('❌ Erro ao carregar dados da candidatura:', error);
      toast.error(`Erro ao carregar dados: ${error.message || 'Erro desconhecido'}`);
      setLoadingCandidateData(false);
    }
  };

  // Flag para prevenir múltiplas execuções
  const hasLoadedDataRef = useRef(false);
  const isLoadingRef = useRef(false);

  // Carregar dados da candidatura quando job_protocol ou job_response_id estiver presente
  useEffect(() => {
    // Prevenir múltiplas execuções
    if (hasLoadedDataRef.current || isLoadingRef.current) return;
    if (!jobProtocol && !jobResponseId) return;

    isLoadingRef.current = true;
    hasLoadedDataRef.current = true;

    const loadData = async () => {
      try {
        if (jobProtocol) {
          await loadCandidateDataFromJob(jobProtocol);
        } else if (jobResponseId) {
          await loadCandidateDataFromJobResponseId(jobResponseId);
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        // Reset flag em caso de erro para permitir retry manual
        hasLoadedDataRef.current = false;
      } finally {
        isLoadingRef.current = false;
      }
    };

    loadData();
  }, [jobProtocol, jobResponseId]); // Removido startTest das dependências

  const handleStartTest = async () => {
    if (!candidateInfo.name.trim()) {
      toast.error('Por favor, preencha seu nome');
      return;
    }
    if (!candidateInfo.whatsapp.trim()) {
      toast.error('Por favor, preencha seu WhatsApp');
      return;
    }
    if (candidateInfo.age < 16 || candidateInfo.age > 100) {
      toast.error('Por favor, informe uma idade válida');
      return;
    }
    if (!consentLGPD) {
      toast.error('Você precisa aceitar a Política de Privacidade (LGPD)');
      return;
    }

    try {
      await startTest(candidateInfo);
      // O hook vai atualizar isInProgress automaticamente, não precisa esconder formulário manualmente
    } catch (error: any) {
      console.error('Erro ao iniciar teste:', error);
      toast.error(`Erro ao iniciar teste: ${error.message || 'Erro desconhecido'}`);
    }
  };

  const handleTestComplete = async () => {
    if (!candidateId) {
      toast.error('Erro ao carregar resultado');
      return;
    }

    // Se veio de uma candidatura, fazer análise com IA
    if (jobResponseId && surveyId) {
      try {
        toast.loading('Analisando seu perfil com inteligência artificial...', { id: 'analyzing' });
        
        // Buscar dados completos da candidatura usando API PostgreSQL
        const { data: jobResponse, error: jobResponseError } = await from('job_responses')
          .select('*')
          .eq('id', jobResponseId)
          .single();

        if (jobResponseError) {
          console.error('Erro ao buscar candidatura:', jobResponseError);
          throw jobResponseError;
        }

        const { data: jobSurvey, error: jobSurveyError } = await from('job_surveys')
          .select('*')
          .eq('id', surveyId)
          .single();

        if (jobSurveyError) {
          console.error('Erro ao buscar vaga:', jobSurveyError);
          throw jobSurveyError;
        }

        if (jobResponse && jobSurvey) {
          // Buscar resultado do DISC
          const { data: discResult, error: discError } = await from('candidate_responses')
            .select('*')
            .eq('id', candidateId)
            .single();

          if (discError) {
            console.error('Erro ao buscar resultado DISC:', discError);
            // Continuar mesmo sem resultado DISC
          }

          // Chamar análise com OpenAI (não bloquear se falhar)
          try {
            const { data: analysisData, error: analysisError } = await apiClient.invokeFunction('analyze-candidate', {
              job_response_id: jobResponseId,
              survey_id: surveyId,
              candidate_data: {
                name: jobResponse.name,
                email: jobResponse.email,
                age: jobResponse.age,
                phone: jobResponse.phone,
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
              console.error('Erro na análise:', analysisError);
              // Não bloquear se a análise falhar
            }
          } catch (analysisErr: any) {
            console.error('Erro ao chamar análise:', analysisErr);
            // Não bloquear se a análise falhar
          }

          toast.dismiss('analyzing');
          toast.success('Teste concluído! Redirecionando...');
        } else {
          toast.dismiss('analyzing');
          toast.error('Dados não encontrados');
        }

        // Redirecionar para página de sucesso
        setTimeout(() => {
          const protocol = jobResponse?.id ? `APP-${jobResponse.id.split('-')[0].toUpperCase()}` : 'TEMP';
          navigate(`/vaga/sucesso/${protocol}`);
        }, 1500);
      } catch (error: any) {
        console.error('Erro ao processar análise:', error);
        toast.dismiss('analyzing');
        toast.error('Erro ao processar, mas sua candidatura foi enviada!');
        // Redirecionar mesmo assim
        setTimeout(() => {
          navigate(`/vaga/sucesso/TEMP`);
        }, 1500);
      }
    } else {
      // Se não veio de candidatura, apenas mostrar resultado
      navigate(`/candidato-disc/resultado?session=${candidateId}`);
    }
  };

  // ===== TELA DE LOADING =====
  // Só mostrar loading se estiver carregando E não estiver em progresso
  if (loadingCandidateData && !isInProgress) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6 pb-6">
            <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Carregando seus dados...</h2>
            <p className="text-muted-foreground">Aguarde um momento</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ===== TELA INICIAL =====
  // Mostrar formulário se não estiver em progresso, não estiver completo e não estiver carregando
  if (!isInProgress && !isCompleted && !loadingCandidateData) {
    const startDisabled =
      loading ||
      loadingCandidateData ||
      !candidateInfo.name.trim() ||
      !candidateInfo.whatsapp.trim() ||
      candidateInfo.age < 16 ||
      candidateInfo.age > 100 ||
      !consentLGPD;

    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center p-4 sm:p-4">
        {/* CSS SÓ DESSA PÁGINA: marca e logo */}
        <Helmet>
          <style>{`
            .brand-accent { color: #dc2626; }            /* red-600 */
            .brand-accent-700 { color: #b91c1c; }        /* red-700 */
            .brand-bg { background-color: #dc2626; }
            .brand-bg:hover { background-color: #b91c1c; }

            /* ⬆️ AUMENTO DO LOGO (inicial) */
            .portal-logo { height: 88px; width: auto; object-fit: contain; }
            @media (max-width: 640px){ .portal-logo { height: 68px; } }
          `}</style>
        </Helmet>

        <div className="w-full max-w-2xl">
          <Card className="shadow-2xl border-0 bg-card/95 backdrop-blur-sm">
            <CardHeader className="text-center space-y-5 sm:space-y-6 pb-6 sm:pb-8 px-6 sm:px-6">
              <div className="flex justify-center">
                <img
                  src={logoImage}
                  alt="Prime Camp"
                  className="portal-logo"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="space-y-3">
                <CardTitle className="text-xl sm:text-2xl md:text-3xl font-bold leading-tight brand-accent">
                  Teste DISC - Perfil Comportamental
                </CardTitle>
                <CardDescription className="text-base sm:text-lg text-muted-foreground px-2 leading-relaxed">
                  {jobResponseId 
                    ? "Complete seu perfil comportamental para finalizar sua candidatura" 
                    : jobProtocol 
                    ? `Candidatura ${jobProtocol} - Complete seu perfil comportamental` 
                    : "Descubra seu perfil comportamental em apenas 20 questões"
                  }
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 sm:space-y-8 px-6 sm:px-6">
              {/* Highlights */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 text-sm text-muted-foreground">
                <div className="space-y-3 sm:space-y-3">
                  <h3 className="font-semibold text-foreground text-base sm:text-base">
                    ✨ O que você vai descobrir:
                  </h3>
                  <ul className="space-y-2 text-sm sm:text-sm">
                    <li>• Perfil comportamental dominante</li>
                    <li>• Principais forças e características</li>
                    <li>• Como se relaciona no trabalho</li>
                    <li>• Áreas de desenvolvimento</li>
                  </ul>
                </div>
                <div className="space-y-3 sm:space-y-3">
                  <h3 className="font-semibold text-foreground text-base sm:text-base">
                    ⏱️ Como funciona:
                  </h3>
                  <ul className="space-y-2 text-sm sm:text-sm">
                    <li>• 20 questões objetivas</li>
                    <li>• Aproximadamente 10 minutos</li>
                    <li>• Resultado imediato e detalhado</li>
                    <li>• Baseado no método DISC</li>
                  </ul>
                </div>
              </div>

              {/* Form lead */}
              <Card className="border-dashed bg-muted/30">
                <CardHeader className="pb-5">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5 brand-accent" />
                    <span>Suas Informações</span>
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {jobResponseId 
                      ? "Seus dados foram carregados automaticamente. Verifique e inicie o teste." 
                      : "Preencha seus dados para iniciar o teste"
                    }
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 px-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-4">
                    <div className="space-y-2 sm:col-span-2 md:col-span-1">
                      <Label htmlFor="name" className="flex items-center gap-2 text-sm font-medium">
                        <User className="h-4 w-4" />
                        Nome Completo *
                      </Label>
                      <Input
                        id="name"
                        placeholder="Digite seu nome completo"
                        value={candidateInfo.name}
                        onChange={(e) => setCandidateInfo(prev => ({ ...prev, name: e.target.value }))}
                        className="bg-background h-12 sm:h-10 text-base"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="age" className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4" />
                        Idade *
                      </Label>
                      <Input
                        id="age"
                        type="number"
                        min={16}
                        max={100}
                        placeholder="Sua idade"
                        value={candidateInfo.age || ''}
                        onChange={(e) => setCandidateInfo(prev => ({ ...prev, age: parseInt(e.target.value) || 0 }))}
                        className="bg-background h-11 sm:h-10"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="whatsapp" className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4" />
                        WhatsApp *
                      </Label>
                      <Input
                        id="whatsapp"
                        placeholder="(11) 99999-9999"
                        value={candidateInfo.whatsapp}
                        onChange={(e) => setCandidateInfo(prev => ({ ...prev, whatsapp: e.target.value }))}
                        className="bg-background h-11 sm:h-10"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4" />
                        Email (opcional)
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="seu@email.com"
                        value={candidateInfo.email}
                        onChange={(e) => setCandidateInfo(prev => ({ ...prev, email: e.target.value }))}
                        className="bg-background h-11 sm:h-10"
                      />
                    </div>
                  </div>

                  {/* ✅ LGPD (Checkbox shadcn) */}
                  <div className="flex items-start gap-2 text-sm">
                    <Checkbox
                      id="lgpd"
                      checked={consentLGPD}
                      onCheckedChange={(v) => setConsentLGPD(Boolean(v))}
                      className="mt-1 border-gray-300 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                    />
                    <Label htmlFor="lgpd" className="text-sm text-muted-foreground">
                      Concordo com o uso dos meus dados para fins de recrutamento conforme a{' '}
                      <a
                        href="/politica-de-privacidade"
                        target="_blank"
                        rel="noreferrer"
                        className="underline text-red-600 hover:text-red-700"
                      >
                        Política de Privacidade
                      </a>.
                    </Label>
                  </div>
                </CardContent>
              </Card>

              {/* CTA */}
              <div className="space-y-4">
                <Button
                  onClick={handleStartTest}
                  disabled={startDisabled}
                  className="w-full h-12 text-lg font-semibold brand-bg text-white shadow-lg transition-colors"
                >
                  {loading || loadingCandidateData ? (
                    <>
                      {loadingCandidateData ? 'Carregando dados...' : 'Iniciando...'}
                    </>
                  ) : (
                    <>
                      Iniciar Teste DISC
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  * Campos obrigatórios. Seus dados são tratados com confidencialidade.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ===== TESTE EM ANDAMENTO =====
  if (isInProgress && !isCompleted) {
    // Se não tem savedCandidateInfo mas está em progresso, usar candidateInfo do estado local
    const displayInfo = savedCandidateInfo || candidateInfo;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-3 sm:p-4">
        <div className="w-full max-w-4xl mx-auto">
          <div className="text-center mb-4 sm:mb-6">
            {/* ⬆️ AUMENTO DO LOGO (em andamento) */}
            <img
              src={logoImage}
              alt="Prime Camp"
              className="h-16 sm:h-20 w-auto mx-auto mb-3 sm:mb-4"
              loading="lazy"
              decoding="async"
            />
            {displayInfo && (
              <>
                <h1 className="text-lg sm:text-2xl font-bold">
                  Olá, <span className="brand-accent">{displayInfo.name}</span>!
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground">Continue de onde parou</p>
              </>
            )}
          </div>

          <ImprovedDiscTestForm 
            key={`disc-test-${candidateId || 'new'}`}
            onComplete={handleTestComplete} 
          />
        </div>
      </div>
    );
  }

  // ===== RESULTADO =====
  if (isCompleted && result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6">
            {/* ⬆️ AUMENTO DO LOGO (resultado) */}
            <img
              src={logoImage}
              alt="Prime Camp"
              className="h-16 sm:h-20 w-auto mx-auto mb-4"
              loading="lazy"
              decoding="async"
            />
            <h1 className="text-2xl font-bold">
              Parabéns, <span className="brand-accent">{savedCandidateInfo?.name || candidateInfo?.name || 'Candidato'}</span>!
            </h1>
            <p className="text-muted-foreground">Seu teste DISC foi concluído com sucesso</p>
          </div>

          <DiscTestResults
            result={{
              d_score: result.d,
              i_score: result.i,
              s_score: result.s,
              c_score: result.c,
              dominant_profile: result.dominant,
              percentages: {
                D: result.percentages.d,
                I: result.percentages.i,
                S: result.percentages.s,
                C: result.percentages.c
              }
            }}
            onRestart={resetTest}
          />
        </div>
      </div>
    );
  }

  // ===== FALLBACK: Se nada renderizou, mostrar formulário =====
  // Isso pode acontecer se o teste foi iniciado mas o estado não foi atualizado corretamente
  if (!showForm && !isInProgress && !isCompleted) {
    console.warn('⚠️ Estado inconsistente detectado, mostrando formulário de fallback');
    setShowForm(true);
  }

  // Se ainda não renderizou nada, mostrar formulário
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center p-4 sm:p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-6 pb-6">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Carregando...</h2>
          <p className="text-muted-foreground">Aguarde um momento</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default CandidateDisc;
