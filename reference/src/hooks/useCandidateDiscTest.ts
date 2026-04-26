import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { from } from '@/integrations/db/client';
import { apiClient } from '@/integrations/api/client';
import { toast } from 'sonner';

interface DiscQuestion {
  id: number;
  question: string;
  options: {
    D: string;
    I: string;
    S: string;
    C: string;
  };
}

interface DiscResponse {
  questionId: number;
  selectedType: 'D' | 'I' | 'S' | 'C';
  [key: string]: any; // For JSON compatibility
}

interface DiscResult {
  d: number;
  i: number;
  s: number;
  c: number;
  dominant: string;
  percentages: {
    d: number;
    i: number;
    s: number;
    c: number;
  };
}

interface CandidateInfo {
  name: string;
  age: number;
  whatsapp: string;
  email?: string;
}

type TestState = 'NOT_STARTED' | 'IN_PROGRESS' | 'FINISHED';

interface TestSession {
  id: string;
  state: TestState;
  candidateInfo: CandidateInfo;
  lastAnsweredIndex: number;
  responses: DiscResponse[];
  finishedAt?: string;
  resultId?: string;
}

// Same questions as the original test
const DISC_QUESTIONS: DiscQuestion[] = [
  {
    id: 1,
    question: "Em situações de trabalho em equipe, eu tendo a:",
    options: {
      D: "Assumir a liderança e dirigir as ações",
      I: "Motivar e inspirar os outros membros",
      S: "Colaborar harmoniosamente e apoiar o grupo",
      C: "Analisar detalhadamente e garantir qualidade"
    }
  },
  {
    id: 2,
    question: "Quando enfrento um problema complexo, minha primeira reação é:",
    options: {
      D: "Buscar uma solução rápida e decisiva",
      I: "Discutir com outros para gerar ideias criativas",
      S: "Proceder com cautela e considerar todas as opções",
      C: "Pesquisar e analisar dados antes de agir"
    }
  },
  {
    id: 3,
    question: "No ambiente de trabalho, eu me sinto mais confortável quando:",
    options: {
      D: "Tenho autonomia para tomar decisões importantes",
      I: "Posso interagir e trabalhar com pessoas diversas",
      S: "Existe estabilidade e um ambiente previsível",
      C: "Tenho informações precisas e procedimentos claros"
    }
  },
  {
    id: 4,
    question: "Meu estilo de comunicação é caracterizado por:",
    options: {
      D: "Ser direto, objetivo e assertivo",
      I: "Ser expressivo, entusiasta e persuasivo",
      S: "Ser diplomático, paciente e compreensivo",
      C: "Ser preciso, factual e bem fundamentado"
    }
  },
  {
    id: 5,
    question: "Quando trabalho sob pressão, eu:",
    options: {
      D: "Mantenho o foco e tomo decisões rápidas",
      I: "Procuro apoio e motivação da equipe",
      S: "Me esforço para manter a calma e estabilidade",
      C: "Organizo metodicamente minhas tarefas"
    }
  },
  {
    id: 6,
    question: "Em reuniões, eu normalmente:",
    options: {
      D: "Conduzo discussões e busco resultados",
      I: "Contribuo com ideias e mantenho o ambiente positivo",
      S: "Escuto atentamente e apoio as decisões do grupo",
      C: "Apresento dados e questiono detalhes importantes"
    }
  },
  {
    id: 7,
    question: "Minha abordagem para resolver conflitos é:",
    options: {
      D: "Confrontar diretamente e buscar solução imediata",
      I: "Mediar com otimismo e buscar consenso",
      S: "Evitar confronto e buscar harmonia",
      C: "Analisar fatos e buscar solução lógica"
    }
  },
  {
    id: 8,
    question: "Quando preciso aprender algo novo, eu prefiro:",
    options: {
      D: "Ir direto à prática e aprender fazendo",
      I: "Aprender em grupo e trocar experiências",
      S: "Seguir um processo estruturado e gradual",
      C: "Estudar teoria e fundamentos profundamente"
    }
  },
  {
    id: 9,
    question: "Em projetos, eu tendo a:",
    options: {
      D: "Focar nos resultados e prazos",
      I: "Valorizar a criatividade e inovação",
      S: "Garantir que todos estejam confortáveis e incluídos",
      C: "Assegurar qualidade e precisão nos detalhes"
    }
  },
  {
    id: 10,
    question: "Minha motivação principal no trabalho é:",
    options: {
      D: "Alcançar metas desafiadoras e superar obstáculos",
      I: "Ter reconhecimento e trabalhar com pessoas",
      S: "Contribuir para um ambiente estável e harmonioso",
      C: "Realizar trabalho de alta qualidade e precisão"
    }
  },
  {
    id: 11,
    question: "Quando tomo decisões, eu:",
    options: {
      D: "Decido rapidamente baseado na minha experiência",
      I: "Considero o impacto nas pessoas envolvidas",
      S: "Busco consenso e evito decisões que causem conflito",
      C: "Analiso todas as informações disponíveis primeiro"
    }
  },
  {
    id: 12,
    question: "Em situações de mudança, eu:",
    options: {
      D: "Adapto-me rapidamente e vejo oportunidades",
      I: "Mantenho otimismo e ajudo outros a se adaptarem",
      S: "Prefiro mudanças graduais e bem planejadas",
      C: "Preciso de tempo para analisar e compreender as implicações"
    }
  },
  {
    id: 13,
    question: "Meu estilo de liderança é:",
    options: {
      D: "Autoritário e orientado para resultados",
      I: "Inspirador e orientado para pessoas",
      S: "Participativo e orientado para o grupo",
      C: "Técnico e orientado para processos"
    }
  },
  {
    id: 14,
    question: "Quando enfrento críticas, eu:",
    options: {
      D: "Defendo meu ponto de vista com firmeza",
      I: "Busco compreender e manter relacionamentos",
      S: "Aceito pacificamente para evitar conflitos",
      C: "Analiso objetivamente se há fundamento"
    }
  },
  {
    id: 15,
    question: "No planejamento de tarefas, eu:",
    options: {
      D: "Foco nos objetivos principais e delego detalhes",
      I: "Planejo de forma flexível para permitir criatividade",
      S: "Planejo cuidadosamente para evitar imprevistos",
      C: "Crio planos detalhados com etapas bem definidas"
    }
  },
  {
    id: 16,
    question: "Em networking e relacionamentos profissionais, eu:",
    options: {
      D: "Foco em contatos que podem gerar oportunidades",
      I: "Construo relacionamentos genuínos e amplos",
      S: "Mantenho relacionamentos próximos e duradouros",
      C: "Prefiro relacionamentos baseados em competência técnica"
    }
  },
  {
    id: 17,
    question: "Minha abordagem para dar feedback é:",
    options: {
      D: "Direto e focado em resultados",
      I: "Positivo e encorajador",
      S: "Gentil e construtivo",
      C: "Específico e baseado em fatos"
    }
  },
  {
    id: 18,
    question: "Em apresentações, eu:",
    options: {
      D: "Vou direto ao ponto com confiança",
      I: "Uso entusiasmo para engajar a audiência",
      S: "Preparo-me bem e apresento de forma organizada",
      C: "Incluo dados detalhados e informações precisas"
    }
  },
  {
    id: 19,
    question: "Quando trabalho em equipe, eu:",
    options: {
      D: "Assumo responsabilidades e coordeno ações",
      I: "Contribuo com energia e ideias criativas",
      S: "Apoio os membros e mantenho a união do grupo",
      C: "Garanto que padrões de qualidade sejam mantidos"
    }
  },
  {
    id: 20,
    question: "Minha maior força no ambiente profissional é:",
    options: {
      D: "Capacidade de liderança e tomada de decisão",
      I: "Habilidade de comunicação e influência",
      S: "Cooperação e manutenção da harmonia",
      C: "Atenção aos detalhes e precisão"
    }
  }
];

export const useCandidateDiscTest = () => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<DiscResponse[]>([]);
  const [testState, setTestState] = useState<TestState>('NOT_STARTED');
  const [result, setResult] = useState<DiscResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Refs for anti-race and idempotency
  const currentRequestIdRef = useRef<string | null>(null);
  const finishIdempotencyKeyRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load progress from localStorage
  useEffect(() => {
    const savedData = localStorage.getItem('candidateDiscTest');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.candidateId && parsed.responses && parsed.currentQuestionIndex !== undefined) {
          setCandidateId(parsed.candidateId);
          setResponses(parsed.responses);
          setCurrentQuestionIndex(parsed.currentQuestionIndex);
          setCandidateInfo(parsed.candidateInfo);
          setTestState(parsed.testState || 'IN_PROGRESS');
          console.log('🔄 iPhone: Loaded candidate test progress from localStorage', {
            candidateId: parsed.candidateId,
            responses: parsed.responses.length,
            currentQuestionIndex: parsed.currentQuestionIndex
          });
        }
      } catch (error) {
        console.error('Error loading progress from localStorage:', error);
        localStorage.removeItem('candidateDiscTest');
      }
    }
  }, []);

  // Save progress to localStorage
  useEffect(() => {
    if (candidateId && testState !== 'FINISHED') {
      const dataToSave = {
        candidateId,
        responses,
        currentQuestionIndex,
        candidateInfo,
        testState
      };
      localStorage.setItem('candidateDiscTest', JSON.stringify(dataToSave));
      console.log('💾 Saved candidate test progress to localStorage');
    }
  }, [candidateId, responses, currentQuestionIndex, candidateInfo, testState]);

  const startTest = async (info: CandidateInfo) => {
    setLoading(true);
    try {
      console.log('🚀 Starting DISC test for candidate:', info.name);
      
      // Validate and sanitize candidate name - prevent email being saved as name
      const sanitizedInfo = {
        ...info,
        name: info.name && info.name.includes('@') ? '' : info.name // Clear name if it's an email
      };
      
      // If name is empty after sanitization, prompt user
      if (!sanitizedInfo.name.trim()) {
        toast.error('Nome inválido detectado. Por favor, informe seu nome completo.');
        setTestState('NOT_STARTED');
        setLoading(false);
        return;
      }
      
      // Clear any existing localStorage data to start fresh
      localStorage.removeItem('candidateDiscTest');
      setResponses([]);
      setCurrentQuestionIndex(0);
      setResult(null);
      setCandidateId(null);
      
      // Check if test already exists for this candidate (incomplete)
      const { data: existingTest } = await from('candidate_responses')
        .select('id, is_completed, responses')
        .eq('whatsapp', sanitizedInfo.whatsapp)
        .eq('is_completed', false)
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (existingTest) {
        console.log('📋 Found existing incomplete test, continuing...', existingTest);
        setCandidateId(existingTest.id);
        setCandidateInfo(sanitizedInfo);
        setTestState('IN_PROGRESS');
        
        // Load existing responses if any
        try {
          const existingResponses = typeof existingTest.responses === 'string' 
            ? JSON.parse(existingTest.responses) 
            : existingTest.responses || [];
          
          // Remove duplicates and validate
          const cleanResponses = existingResponses.reduce((acc: DiscResponse[], current: any) => {
            const existingIndex = acc.findIndex(r => r.questionId === current.questionId);
            if (existingIndex >= 0) {
              acc[existingIndex] = current;
            } else {
              acc.push(current);
            }
            return acc;
          }, []);
          
          setResponses(cleanResponses);
          setCurrentQuestionIndex(cleanResponses.length);
          console.log('✅ Loaded existing responses:', cleanResponses.length);
          setTestState('IN_PROGRESS');
        } catch (error) {
          console.error('Error parsing existing responses:', error);
          setResponses([]);
          setCurrentQuestionIndex(0);
          setTestState('IN_PROGRESS');
        }
        
        setLoading(false);
        return;
      }
      
      // Create new test record for candidate
      setTestState('IN_PROGRESS');
      
      const { data, error } = await from('candidate_responses')
        .insert({
          name: sanitizedInfo.name, // Use sanitized name
          age: sanitizedInfo.age,
          whatsapp: sanitizedInfo.whatsapp,
          email: sanitizedInfo.email,
          test_id: crypto.randomUUID(),
          responses: [],
          is_completed: false
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating candidate test:', error);
        throw error;
      }

      console.log('✅ Candidate test created successfully:', data.id);
      setCandidateId(data.id);
      setCandidateInfo(sanitizedInfo); // Use sanitized info
      
    } catch (error) {
      console.error('❌ Error in startTest:', error);
      toast.error('Erro ao iniciar o teste. Tente novamente.');
      setTestState('NOT_STARTED');
    } finally {
      setLoading(false);
    }
  };

  const answerQuestion = async (selectedType: 'D' | 'I' | 'S' | 'C') => {
    // iPhone/Safari specific debugging
    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
    
    console.log(`🍎 iPhone Debug - answerQuestion called`, {
      selectedType,
      currentQuestionIndex,
      isProcessing,
      testState,
      candidateId,
      isIOS,
      isSafari,
      userAgent: userAgent.substring(0, 100),
      localStorage: localStorage.getItem('candidateDiscTest')
    });

    if (isProcessing || testState === 'FINISHED') {
      console.log('[DISC] iPhone: Ignoring answer - already processing or finished', { isProcessing, testState });
      return;
    }

    if (!candidateId) {
      console.error('❌ iPhone: No candidateId available - attempting recovery');
      
      // Try to restore from localStorage first
      const savedData = localStorage.getItem('candidateDiscTest');
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          if (parsed.candidateId) {
            console.log('🔄 iPhone: Found candidateId in localStorage, restoring...');
            setCandidateId(parsed.candidateId);
            setCandidateInfo(parsed.candidateInfo);
            setTestState('IN_PROGRESS');
            setResponses(parsed.responses || []);
            setCurrentQuestionIndex(parsed.currentQuestionIndex || 0);
            
            // Retry the answer with recovered data
            setTimeout(() => {
              console.log('🔄 iPhone: Retrying answer after recovery');
              answerQuestion(selectedType);
            }, 500);
            return;
          }
        } catch (error) {
          console.error('Error restoring from localStorage:', error);
        }
      }
      
      // If no recovery possible, redirect to start
      console.error('❌ iPhone: Cannot recover candidateId, redirecting to start');
      toast.error('Sessão perdida. Redirecionando...');
      setTimeout(() => {
        window.location.href = '/candidato-disc';
      }, 1000);
      return;
    }

    // Abort any ongoing request
    if (abortControllerRef.current) {
      console.log('🍎 iPhone: Aborting previous request');
      abortControllerRef.current.abort();
    }
    
    // Create new request with unique ID
    const requestId = crypto.randomUUID();
    currentRequestIdRef.current = requestId;
    abortControllerRef.current = new AbortController();

    setIsProcessing(true);
    
    try {
      const currentQuestionId = DISC_QUESTIONS[currentQuestionIndex].id;
      
      console.log(`🍎 iPhone: disc.answer.start`, {
        sessionId: candidateId,
        questionId: currentQuestionId,
        selectedType,
        requestId,
        isIOS,
        isSafari
      });

      // iPhone/Safari specific timeout and retry logic  
      const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const timeoutMs = isMobile ? 20000 : 15000; // Longer timeout for mobile
      
      console.log(`📱 Mobile: Calling disc-answer function`, {
        sessionId: candidateId,
        questionId: currentQuestionId,
        selectedType,
        requestId,
        isMobile,
        timeoutMs
      });

      try {
        // Call Supabase edge function for disc-answer with mobile optimizations
        console.log(`📱 Mobile: About to call disc-answer`, {
          sessionId: candidateId,
          questionId: currentQuestionId,
          selectedType,
          idempotencyKey: requestId,
          url: `${import.meta.env.VITE_API_URL || 'https://api.ativafix.com/api'}/functions/disc-answer`
        });

        const response = await apiClient.invokeFunction('disc-answer', {
          sessionId: candidateId,
          questionId: currentQuestionId,
          selectedType,
          idempotencyKey: requestId
        });

        console.log(`📱 Mobile: Raw response from disc-answer`, {
          error: response.error,
          data: response.data,
          requestId,
          hasError: !!response.error,
          hasData: !!response.data
        });

        // Remove any existing response for this question (avoid duplicates)
        const filteredResponses = responses.filter(r => r.questionId !== currentQuestionId);
        
        const newResponse: DiscResponse = {
          questionId: currentQuestionId,
          selectedType
        };

        const updatedResponses = [...filteredResponses, newResponse];
        
        // Update responses state immediately (optimistic update)
        setResponses(updatedResponses);

        if (response.error) {
          console.error(`❌ Mobile: disc-answer error details`, {
            error: response.error,
            message: response.error.message,
            status: response.error.status,
            context: response.error.context
          });
          
          // Even if edge function fails, continue with local state
          // Try to save to database directly as fallback
          try {
            await saveProgressWithRetry(updatedResponses);
            console.log('✅ Saved progress directly to database after edge function error');
          } catch (saveError) {
            console.error('❌ Failed to save progress directly:', saveError);
          }
          
          // Don't throw error, continue with test
          toast.warning('Resposta salva localmente. Continuando...');
        } else {
          const responseData = response.data;
          console.log(`✅ Mobile: disc.answer.success`, { 
            sessionId: candidateId, 
            questionId: currentQuestionId, 
            requestId,
            responseData 
          });
          
          toast.success('Resposta salva!');
        }

        // Update localStorage with mobile-specific error handling
        try {
          updateLocalStorage(updatedResponses, currentQuestionIndex);
          console.log(`📱 Mobile: localStorage updated successfully`);
        } catch (storageError) {
          console.error('📱 Mobile: localStorage update failed', storageError);
          // Continue anyway, localStorage is not critical for function
        }

        // Force state update with mobile optimizations
        // Use functional update to ensure we have the latest state
        setTimeout(() => {
          setCurrentQuestionIndex(prevIndex => {
            console.log(`📱 Mobile: Processing next step`, {
              currentIndex: prevIndex,
              totalQuestions: DISC_QUESTIONS.length
            });

            if (prevIndex < DISC_QUESTIONS.length - 1) {
              const next = prevIndex + 1;
              console.log(`➡️ Mobile: Moving to next question: ${prevIndex} -> ${next}`);
              return next;
            } else {
              console.log('🏁 Mobile: Last question answered, completing test...');
              setTestState('FINISHED');
              // Start completion process with delay for mobile
              setTimeout(() => completeTest(updatedResponses), 200);
              return prevIndex; // Keep current index while completing
            }
          });
        }, isMobile ? 300 : 200); // Longer delay for mobile

      } catch (fetchError) {
        throw fetchError;
      }

    } catch (error: any) {
      // Don't show error if request was aborted
      if (error.name === 'AbortError') {
        console.log('[DISC] Mobile: Request aborted');
        return;
      }
      
      const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      console.error(`❌ Mobile: disc.answer.fail`, { 
        sessionId: candidateId, 
        error: error.message,
        stack: error.stack,
        requestId,
        isMobile
      });
      
      // Mobile-specific error messaging
      toast.error('Erro ao responder pergunta. Tente novamente.');
    } finally {
      if (currentRequestIdRef.current === requestId) {
        console.log(`📱 Mobile: Finishing processing for request ${requestId}`);
        setIsProcessing(false);
      }
    }
  };

  // Helper function to save progress with exponential retry
  const saveProgressWithRetry = async (responses: DiscResponse[], retries = 0): Promise<void> => {
    try {
      const { error } = await from('candidate_responses')
        .update({ 
          responses: JSON.stringify(responses),
          updated_at: new Date().toISOString()
        })
        .eq('id', candidateId)
        .eq('is_completed', false);
        
      if (error) throw error;
      
      console.log('✅ Progress saved successfully');
    } catch (error) {
      console.error(`❌ Error saving progress (attempt ${retries + 1}):`, error);
      
      if (retries < 2) { // Max 2 retries
        const delay = Math.pow(2, retries) * 1000; // Exponential backoff
        console.log(`🔄 Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return saveProgressWithRetry(responses, retries + 1);
      } else {
        throw error;
      }
    }
  };

  // Helper function to update localStorage
  const updateLocalStorage = (responses: DiscResponse[], questionIndex: number) => {
    if (candidateId && candidateInfo) {
      const dataToSave = {
        candidateId,
        responses,
        currentQuestionIndex: questionIndex,
        candidateInfo,
        testState,
        lastSaved: new Date().toISOString()
      };
      localStorage.setItem('candidateDiscTest', JSON.stringify(dataToSave));
    }
  };

  const completeTest = async (finalResponses?: DiscResponse[]) => {
    // Implement idempotency - only complete once
    if (testState === 'FINISHED') {
      console.log('[DISC] Test already completed, ignoring');
      return;
    }

    // Generate idempotency key if not exists
    if (!finishIdempotencyKeyRef.current) {
      finishIdempotencyKeyRef.current = crypto.randomUUID();
    }

    const idempotencyKey = finishIdempotencyKeyRef.current;
    
    console.log(`🚀 disc.finish.start`, { 
      sessionId: candidateId,
      idempotencyKey,
      finalResponses: finalResponses?.length,
      currentResponses: responses.length 
    });
    
    const responsesToUse = finalResponses || responses;
    
    // Remove duplicates by questionId (keep the last response for each question)
    const uniqueResponses = responsesToUse.reduce((acc: DiscResponse[], current) => {
      const existingIndex = acc.findIndex(r => r.questionId === current.questionId);
      if (existingIndex >= 0) {
        acc[existingIndex] = current; // Replace with newer response
      } else {
        acc.push(current);
      }
      return acc;
    }, []);
    
    if (!candidateId) {
      console.error('❌ No candidateId for completion');
      toast.error('Erro: ID do candidato não encontrado');
      return;
    }

    if (uniqueResponses.length !== DISC_QUESTIONS.length) {
      console.error('❌ Incomplete responses:', uniqueResponses.length, 'of', DISC_QUESTIONS.length);
      toast.error(`Teste incompleto. Respondidas: ${uniqueResponses.length}/${DISC_QUESTIONS.length} perguntas.`);
      return;
    }

    setLoading(true);
    setTestState('FINISHED'); // Prevent double completion
    
    try {
      // Call API endpoint for disc-finish
      // Usar invokeFunction para manter consistência, header Idempotency-Key será adicionado pelo backend se necessário
      const finishResponse = await apiClient.invokeFunction('disc-finish', {
        testSessionId: candidateId
      });

      // Handle response from Supabase edge function
      if (finishResponse.error) {
        const errorMessage = finishResponse.error.message || 'Unknown error';
        
        // Check if it's the 409 ALREADY_FINISHED case
        if (errorMessage.includes('ALREADY_FINISHED') || errorMessage.includes('already completed') || errorMessage.includes('409')) {
          console.log(`✅ disc.finish.already_finished`, { sessionId: candidateId, idempotencyKey });
          // Clear localStorage since test is completed
          localStorage.removeItem('candidateDiscTest');
          window.location.href = `/candidato-disc/resultado?session=${candidateId}`;
          return;
        }
        
        throw new Error(`Finish failed: ${errorMessage}`);
      }

      const finishData = finishResponse.data;

      console.log(`✅ disc.finish.success`, { sessionId: candidateId, idempotencyKey });

      // Start polling for completion
      let pollAttempts = 0;
      const maxPollAttempts = 20;
      
      const pollForCompletion = async (): Promise<void> => {
        pollAttempts++;
        console.log(`🔄 disc.poll.status`, { sessionId: candidateId, attempt: pollAttempts });

        try {
          const statusResponse = await apiClient.invokeFunction('disc-session-status', {
            sessionId: candidateId
          });
          
          if (statusResponse.error) {
            throw new Error(statusResponse.error.message);
          }
          
          const statusData = statusResponse.data;

          if (statusData.status === 'FINISHED' && statusData.resultId) {
            console.log(`✅ disc.poll.complete`, { sessionId: candidateId, resultId: statusData.resultId });
            // Immediate redirect - no delay needed
            window.location.href = `/candidato-disc/resultado?session=${candidateId}`;
            return;
          }

          if (pollAttempts < maxPollAttempts) {
            pollIntervalRef.current = setTimeout(pollForCompletion, 300); // Faster polling
          } else {
            throw new Error('Tempo limite de processamento excedido');
          }
        } catch (error) {
          console.error(`❌ disc.poll.fail`, { sessionId: candidateId, attempt: pollAttempts, error });
          if (pollAttempts < maxPollAttempts) {
            pollIntervalRef.current = setTimeout(pollForCompletion, 300); // Faster polling
          } else {
            throw error;
          }
        }
      };

      await pollForCompletion();
      
    } catch (error: any) {
      console.error(`❌ disc.finish.fail`, { 
        sessionId: candidateId, 
        idempotencyKey,
        error: error.message 
      });
      setTestState('IN_PROGRESS'); // Reset state on error
      toast.error('Erro ao finalizar o teste. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setResponses(responses.slice(0, -1));
    }
  };

  const resetTest = () => {
    // Clear all timeouts and refs
    if (pollIntervalRef.current) {
      clearTimeout(pollIntervalRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    localStorage.removeItem('candidateDiscTest');
    setCurrentQuestionIndex(0);
    setResponses([]);
    setTestState('NOT_STARTED');
    setResult(null);
    setCandidateId(null);
    setCandidateInfo(null);
    setIsProcessing(false);
    finishIdempotencyKeyRef.current = null;
    currentRequestIdRef.current = null;
  };

  // Use useMemo to ensure currentQuestion updates when index changes
  const currentQuestion = useMemo(() => {
    const question = DISC_QUESTIONS[currentQuestionIndex];
    console.log(`📚 Getting question at index ${currentQuestionIndex}:`, {
      question: question?.question,
      questionId: question?.id,
      totalQuestions: DISC_QUESTIONS.length
    });
    return question;
  }, [currentQuestionIndex]);
  
  const progress = useMemo(() => {
    return ((responses.length) / DISC_QUESTIONS.length) * 100;
  }, [responses.length]);
  
  const isInProgress = testState === 'IN_PROGRESS';
  const isCompleted = testState === 'FINISHED';

  return {
    currentQuestion,
    currentQuestionIndex,
    totalQuestions: DISC_QUESTIONS.length,
    progress,
    responses,
    result,
    isCompleted,
    isInProgress,
    loading,
    isProcessing,
    testState,
    candidateInfo,
    candidateId,
    startTest,
    answerQuestion,
    completeTest,
    goToPreviousQuestion,
    resetTest
  };
};