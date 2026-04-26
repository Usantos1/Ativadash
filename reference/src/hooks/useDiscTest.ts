import { useState, useEffect } from 'react';
import { from } from '@/integrations/db/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface DiscQuestion {
  id: number;
  question: string;
  options: {
    text: string;
    type: 'D' | 'I' | 'S' | 'C';
  }[];
}

export interface DiscResponse {
  questionId: number;
  selectedType: 'D' | 'I' | 'S' | 'C';
}

export interface DiscResult {
  d_score: number;
  i_score: number;
  s_score: number;
  c_score: number;
  dominant_profile: string;
  percentages: {
    D: number;
    I: number;
    S: number;
    C: number;
  };
}

const DISC_QUESTIONS: DiscQuestion[] = [
  {
    id: 1,
    question: "Ao enfrentar um problema complexo, você prefere:",
    options: [
      { text: "Tomar uma decisão rápida e agir imediatamente", type: "D" },
      { text: "Discutir com a equipe e buscar consenso", type: "I" },
      { text: "Analisar cuidadosamente antes de decidir", type: "S" },
      { text: "Pesquisar todas as opções possíveis", type: "C" }
    ]
  },
  {
    id: 2,
    question: "Em uma reunião de trabalho, você geralmente:",
    options: [
      { text: "Assume a liderança e dirige a discussão", type: "D" },
      { text: "Motiva os outros e compartilha ideias", type: "I" },
      { text: "Escuta atentamente e oferece apoio", type: "S" },
      { text: "Apresenta fatos e dados precisos", type: "C" }
    ]
  },
  {
    id: 3,
    question: "Quando trabalha em equipe, você:",
    options: [
      { text: "Prefere definir objetivos claros e cobrar resultados", type: "D" },
      { text: "Gosta de criar um ambiente positivo e colaborativo", type: "I" },
      { text: "Oferece apoio constante aos colegas", type: "S" },
      { text: "Foca na qualidade e precisão das tarefas", type: "C" }
    ]
  },
  {
    id: 4,
    question: "Diante de mudanças organizacionais, você:",
    options: [
      { text: "Se adapta rapidamente e busca oportunidades", type: "D" },
      { text: "Vê as possibilidades positivas e motiva outros", type: "I" },
      { text: "Prefere mudanças graduais e planejadas", type: "S" },
      { text: "Analisa os riscos e impactos detalhadamente", type: "C" }
    ]
  },
  {
    id: 5,
    question: "Seu estilo de comunicação é mais:",
    options: [
      { text: "Direto e objetivo", type: "D" },
      { text: "Entusiástico e expressivo", type: "I" },
      { text: "Calmo e compreensivo", type: "S" },
      { text: "Preciso e detalhado", type: "C" }
    ]
  },
  {
    id: 6,
    question: "Ao receber feedback, você:",
    options: [
      { text: "Foca nos resultados e ações necessárias", type: "D" },
      { text: "Aprecia o reconhecimento e interação", type: "I" },
      { text: "Escuta pacientemente e reflete", type: "S" },
      { text: "Analisa a precisão e busca melhorias", type: "C" }
    ]
  },
  {
    id: 7,
    question: "Em situações de pressão, você:",
    options: [
      { text: "Mantém o foco nos objetivos principais", type: "D" },
      { text: "Busca apoio da equipe e mantém otimismo", type: "I" },
      { text: "Procura estabilizar o ambiente", type: "S" },
      { text: "Revisa processos para evitar erros", type: "C" }
    ]
  },
  {
    id: 8,
    question: "Ao planejar um projeto, você prioriza:",
    options: [
      { text: "Definir metas ambiciosas e prazos apertados", type: "D" },
      { text: "Envolver toda a equipe no planejamento", type: "I" },
      { text: "Criar um cronograma realista e viável", type: "S" },
      { text: "Elaborar um plano detalhado e preciso", type: "C" }
    ]
  },
  {
    id: 9,
    question: "Sua abordagem para resolver conflitos é:",
    options: [
      { text: "Confrontar diretamente e resolver rapidamente", type: "D" },
      { text: "Mediar buscando harmonia entre as partes", type: "I" },
      { text: "Escutar todos os lados pacientemente", type: "S" },
      { text: "Analisar fatos para encontrar a solução justa", type: "C" }
    ]
  },
  {
    id: 10,
    question: "Quando toma decisões importantes, você:",
    options: [
      { text: "Decide rapidamente baseado na intuição", type: "D" },
      { text: "Consulta pessoas de confiança", type: "I" },
      { text: "Pondera cuidadosamente os prós e contras", type: "S" },
      { text: "Baseia-se em dados e análises detalhadas", type: "C" }
    ]
  },
  {
    id: 11,
    question: "Em um novo ambiente de trabalho, você:",
    options: [
      { text: "Assume responsabilidades rapidamente", type: "D" },
      { text: "Faz novos contatos e constrói relacionamentos", type: "I" },
      { text: "Observa e se adapta gradualmente", type: "S" },
      { text: "Estuda os processos e procedimentos", type: "C" }
    ]
  },
  {
    id: 12,
    question: "Seu foco principal no trabalho é:",
    options: [
      { text: "Alcançar resultados excepcionais", type: "D" },
      { text: "Construir relacionamentos positivos", type: "I" },
      { text: "Manter estabilidade e qualidade", type: "S" },
      { text: "Garantir precisão e excelência", type: "C" }
    ]
  },
  {
    id: 13,
    question: "Ao liderar uma equipe, você:",
    options: [
      { text: "Define expectativas claras e cobra resultados", type: "D" },
      { text: "Inspira e motiva através do exemplo", type: "I" },
      { text: "Oferece suporte constante e orientação", type: "S" },
      { text: "Estabelece processos claros e padrões", type: "C" }
    ]
  },
  {
    id: 14,
    question: "Diante de críticas, você:",
    options: [
      { text: "Usa como motivação para melhorar", type: "D" },
      { text: "Busca entender a perspectiva do outro", type: "I" },
      { text: "Reflete calmamente sobre os pontos", type: "S" },
      { text: "Analisa objetivamente a validade", type: "C" }
    ]
  },
  {
    id: 15,
    question: "Seu ritmo de trabalho preferido é:",
    options: [
      { text: "Rápido e intenso", type: "D" },
      { text: "Variado com interações sociais", type: "I" },
      { text: "Constante e sustentável", type: "S" },
      { text: "Metódico e cuidadoso", type: "C" }
    ]
  },
  {
    id: 16,
    question: "Ao apresentar ideias, você:",
    options: [
      { text: "É direto e vai ao ponto", type: "D" },
      { text: "É entusiástico e persuasivo", type: "I" },
      { text: "É diplomático e considera todos", type: "S" },
      { text: "É detalhado e bem fundamentado", type: "C" }
    ]
  },
  {
    id: 17,
    question: "Em situações de incerteza, você:",
    options: [
      { text: "Age decisivamente apesar dos riscos", type: "D" },
      { text: "Mantém otimismo e busca oportunidades", type: "I" },
      { text: "Prefere aguardar mais informações", type: "S" },
      { text: "Pesquisa exaustivamente antes de agir", type: "C" }
    ]
  },
  {
    id: 18,
    question: "Sua motivação principal vem de:",
    options: [
      { text: "Conquistar objetivos desafiadores", type: "D" },
      { text: "Reconhecimento e interação social", type: "I" },
      { text: "Estabilidade e harmonia", type: "S" },
      { text: "Qualidade e precisão no trabalho", type: "C" }
    ]
  },
  {
    id: 19,
    question: "Ao receber uma tarefa complexa, você:",
    options: [
      { text: "Ataca o problema de frente", type: "D" },
      { text: "Colabora com outros para encontrar soluções", type: "I" },
      { text: "Planeja cuidadosamente cada etapa", type: "S" },
      { text: "Pesquisa métodos comprovados", type: "C" }
    ]
  },
  {
    id: 20,
    question: "Sua definição de sucesso é:",
    options: [
      { text: "Superar metas e conquistar posições", type: "D" },
      { text: "Impactar positivamente as pessoas", type: "I" },
      { text: "Contribuir consistentemente para a equipe", type: "S" },
      { text: "Entregar trabalho de excelente qualidade", type: "C" }
    ]
  }
];

export const useDiscTest = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<DiscResponse[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [result, setResult] = useState<DiscResult | null>(null);
  const [testId, setTestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Carregar último resultado completado e recuperar progresso salvo
  useEffect(() => {
    const loadExistingResult = async () => {
      if (!user) return;

      try {
        console.log('[DISC] Carregando último resultado completado do usuário:', user.id);
        
        // Buscar último teste completado
        const { data: completedTests, error: completedError } = await from('disc_responses')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_completed', true)
          .order('completion_date', { ascending: false })
          .limit(1)
          .execute();

        if (completedError) {
          console.error('[DISC] Erro ao carregar resultados completados:', completedError);
        } else if (completedTests && completedTests.length > 0) {
          const lastCompleted = completedTests[0];
          console.log('[DISC] Resultado completado encontrado:', lastCompleted);
          
          const loadedResult: DiscResult = {
            d_score: lastCompleted.d_score || 0,
            i_score: lastCompleted.i_score || 0,
            s_score: lastCompleted.s_score || 0,
            c_score: lastCompleted.c_score || 0,
            dominant_profile: lastCompleted.dominant_profile || 'D',
            percentages: {
              D: Math.round(((lastCompleted.d_score || 0) / 20) * 100),
              I: Math.round(((lastCompleted.i_score || 0) / 20) * 100),
              S: Math.round(((lastCompleted.s_score || 0) / 20) * 100),
              C: Math.round(((lastCompleted.c_score || 0) / 20) * 100)
            }
          };
          
          setResult(loadedResult);
          console.log('[DISC] Resultado carregado com sucesso:', loadedResult);
        }
      } catch (error) {
        console.error('[DISC] Erro ao carregar resultado existente:', error);
      }
    };

    // Recuperar progresso salvo do localStorage
    const savedTest = localStorage.getItem('disc-test-progress');
    if (savedTest) {
      try {
        const { responses: savedResponses, currentQuestion, testId: savedTestId } = JSON.parse(savedTest);
        // Só restaurar se todos os dados essenciais estiverem presentes
        if (savedTestId && savedResponses && Array.isArray(savedResponses)) {
          console.log('[DISC] Restaurando progresso do localStorage:', { 
            testId: savedTestId, 
            responses: savedResponses.length,
            currentQuestion 
          });
          setResponses(savedResponses);
          setCurrentQuestionIndex(currentQuestion || 0);
          setTestId(savedTestId);
        } else {
          console.log('[DISC] Dados incompletos no localStorage, limpando...');
          localStorage.removeItem('disc-test-progress');
        }
      } catch (error) {
        console.error('[DISC] Erro ao recuperar progresso do localStorage:', error);
        localStorage.removeItem('disc-test-progress');
      }
    }

    // Carregar resultado existente
    loadExistingResult();
  }, [user]);

  // Salvar progresso automaticamente
  useEffect(() => {
    if (responses.length > 0 && !isCompleted && testId) {
      const progress = {
        responses,
        currentQuestion: currentQuestionIndex,
        testId
      };
      console.log('[DISC] Salvando progresso no localStorage:', progress);
      localStorage.setItem('disc-test-progress', JSON.stringify(progress));
    }
  }, [responses, currentQuestionIndex, testId, isCompleted]);

  const startTest = async () => {
    if (!user) {
      console.error('[DISC] Usuário não autenticado');
      return;
    }

    try {
      setLoading(true);
      console.log(`[DISC] Iniciando novo teste para usuário:`, user.id);
      
      // Limpar dados antigos primeiro
      localStorage.removeItem('disc-test-progress');
      setTestId(null);
      setCurrentQuestionIndex(0);
      setResponses([]);
      setIsCompleted(false);
      setResult(null);
      
      // Buscar teste ativo
      const { data: tests, error: testError } = await from('disc_tests')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .execute();

      if (testError) {
        console.error('[DISC] Erro ao buscar teste ativo:', testError);
        throw testError;
      }

      if (!tests || tests.length === 0) {
        console.error('[DISC] Nenhum teste ativo encontrado');
        toast({
          title: "Erro",
          description: "Nenhum teste DISC ativo encontrado.",
          variant: "destructive"
        });
        return;
      }

      const test = tests[0];
      console.log(`[DISC] Teste ativo encontrado:`, test.id);
      
      // Verificar se já existe resposta incompleta para evitar duplicatas
      const { data: existingIncomplete } = await from('disc_responses')
        .select('id')
        .eq('user_id', user.id)
        .eq('test_id', test.id)
        .eq('is_completed', false)
        .maybeSingle();

      let newResponse;
      if (existingIncomplete) {
        console.log(`[DISC] Reutilizando resposta incompleta existente:`, existingIncomplete.id);
        newResponse = existingIncomplete;
      } else {
        // Criar nova resposta no banco
        const { data: createdResponse, error: responseError } = await from('disc_responses')
          .insert({
            user_id: user.id,
            test_id: test.id,
            responses: [],
            is_completed: false
          })
          .select('*')
          .single();

        if (responseError) {
          console.error('[DISC] Erro ao criar nova resposta:', responseError);
          throw responseError;
        }
        
        newResponse = createdResponse;
      }

      console.log(`[DISC] Resposta preparada com sucesso:`, newResponse?.id);
      
      // Definir testId somente após sucesso na criação
      setTestId(test.id);

      toast({
        title: "Teste iniciado!",
        description: "Responda todas as perguntas para descobrir seu perfil DISC."
      });

    } catch (error) {
      console.error('[DISC] Erro ao iniciar teste:', error);
      toast({
        title: "Erro",
        description: "Não foi possível iniciar o teste. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const answerQuestion = (selectedType: 'D' | 'I' | 'S' | 'C') => {
    console.log(`[DISC] Processando resposta:`, { currentQuestionIndex, selectedType, testId });
    
    const newResponse: DiscResponse = {
      questionId: DISC_QUESTIONS[currentQuestionIndex].id,
      selectedType
    };

    const updatedResponses = [...responses];
    const existingIndex = updatedResponses.findIndex(r => r.questionId === newResponse.questionId);
    
    if (existingIndex >= 0) {
      updatedResponses[existingIndex] = newResponse;
    } else {
      updatedResponses.push(newResponse);
    }

    console.log(`[DISC] Respostas atualizadas:`, { totalResponses: updatedResponses.length, isLastQuestion: currentQuestionIndex === DISC_QUESTIONS.length - 1 });
    setResponses(updatedResponses);

    if (currentQuestionIndex < DISC_QUESTIONS.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      console.log(`[DISC] Última pergunta! Finalizando teste...`);
      completeTest(updatedResponses);
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const calculateResult = (responses: DiscResponse[]): DiscResult => {
    const scores = { D: 0, I: 0, S: 0, C: 0 };
    
    responses.forEach(response => {
      scores[response.selectedType]++;
    });

    const total = responses.length;
    const percentages = {
      D: Math.round((scores.D / total) * 100),
      I: Math.round((scores.I / total) * 100),
      S: Math.round((scores.S / total) * 100),
      C: Math.round((scores.C / total) * 100)
    };

    const dominant = Object.entries(scores).reduce((a, b) => 
      scores[a[0] as keyof typeof scores] > scores[b[0] as keyof typeof scores] ? a : b
    )[0];

    return {
      d_score: scores.D,
      i_score: scores.I,
      s_score: scores.S,
      c_score: scores.C,
      dominant_profile: dominant,
      percentages
    };
  };

  const completeTest = async (finalResponses: DiscResponse[]) => {
    console.log(`[DISC] Iniciando finalização do teste:`, { 
      user: !!user, 
      testId, 
      responsesCount: finalResponses.length 
    });

    if (!user) {
      console.error(`[DISC] Erro: usuário não autenticado`);
      toast({
        title: "Erro",
        description: "Usuário não autenticado.",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      const calculatedResult = calculateResult(finalResponses);
      console.log(`[DISC] Resultado calculado:`, calculatedResult);
      
      // Se não temos testId, criar um fallback buscando teste ativo
      let finalTestId = testId;
      if (!finalTestId) {
        console.log('[DISC] testId ausente, buscando teste ativo como fallback...');
        const { data: tests, error: testError } = await from('disc_tests')
          .select('*')
          .eq('is_active', true)
          .limit(1)
          .execute();
          
        if (testError || !tests || tests.length === 0) {
          throw new Error('Nenhum teste ativo encontrado');
        }
        
        finalTestId = tests[0].id;
        console.log('[DISC] Usando teste ativo como fallback:', finalTestId);
      }
      
      // Buscar registro existente ou criar um novo
      let { data: existingResponse, error: fetchError } = await from('disc_responses')
        .select('*')
        .eq('user_id', user.id)
        .eq('test_id', finalTestId)
        .eq('is_completed', false)
        .maybeSingle();

      if (fetchError) {
        console.error(`[DISC] Erro ao buscar resposta existente:`, fetchError);
        throw fetchError;
      }

      // Se não encontrou registro existente, criar um novo
      if (!existingResponse) {
        console.log('[DISC] Registro não encontrado, criando novo...');
        const { data: newResponse, error: createError } = await from('disc_responses')
          .insert({
            user_id: user.id,
            test_id: finalTestId,
            responses: finalResponses as any,
            d_score: calculatedResult.d_score,
            i_score: calculatedResult.i_score,
            s_score: calculatedResult.s_score,
            c_score: calculatedResult.c_score,
            dominant_profile: calculatedResult.dominant_profile,
            completion_date: new Date().toISOString(),
            is_completed: true
          })
          .select()
          .single();
          
        if (createError) {
          console.error(`[DISC] Erro ao criar novo registro:`, createError);
          throw createError;
        }
        
        console.log(`[DISC] Novo registro criado:`, newResponse?.id);
      } else {
        console.log(`[DISC] Atualizando registro existente:`, existingResponse.id);
        
        // Atualizar o registro existente
        const { error: updateError } = await from('disc_responses')
          .update({
            responses: finalResponses as any,
            d_score: calculatedResult.d_score,
            i_score: calculatedResult.i_score,
            s_score: calculatedResult.s_score,
            c_score: calculatedResult.c_score,
            dominant_profile: calculatedResult.dominant_profile,
            completion_date: new Date().toISOString(),
            is_completed: true
          })
          .eq('id', existingResponse.id)
          .execute();

        if (updateError) {
          console.error(`[DISC] Erro ao atualizar resultado:`, updateError);
          throw updateError;
        }
      }

      console.log(`[DISC] Teste finalizado com sucesso!`);
      
      // Definir resultado e isCompleted de forma síncrona
      setResult(calculatedResult);
      setIsCompleted(true);
      console.log('[DISC] Estado atualizado: isCompleted=true, result=', calculatedResult);
      
      // Limpar progresso salvo
      localStorage.removeItem('disc-test-progress');

      toast({
        title: "Teste concluído!",
        description: "Seu perfil DISC foi calculado com sucesso."
      });

    } catch (error) {
      console.error('[DISC] Erro ao finalizar teste:', error);
      toast({
        title: "Erro",
        description: `Não foi possível salvar o resultado: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetTest = () => {
    setCurrentQuestionIndex(0);
    setResponses([]);
    setIsCompleted(false);
    setResult(null);
    setTestId(null);
    localStorage.removeItem('disc-test-progress');
  };

  const currentQuestion = DISC_QUESTIONS[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / DISC_QUESTIONS.length) * 100;
  const hasInProgressTest = responses.length > 0 && !isCompleted;

  return {
    currentQuestion,
    currentQuestionIndex,
    totalQuestions: DISC_QUESTIONS.length,
    progress,
    responses,
    isCompleted,
    result,
    loading,
    hasInProgressTest,
    startTest,
    answerQuestion,
    goToPreviousQuestion,
    resetTest
  };
};