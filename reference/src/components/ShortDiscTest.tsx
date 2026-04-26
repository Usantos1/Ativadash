import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Brain } from 'lucide-react';

// DISC curto - 7 perguntas essenciais para identificar o perfil
const SHORT_DISC_QUESTIONS = [
  {
    id: 'short-1',
    question: "Em situações de trabalho em equipe, eu tendo a:",
    options: {
      D: "Assumir a liderança e dirigir as ações",
      I: "Motivar e inspirar os outros membros",
      S: "Colaborar harmoniosamente e apoiar o grupo",
      C: "Analisar detalhadamente e garantir qualidade"
    }
  },
  {
    id: 'short-2',
    question: "Quando enfrento um problema complexo, minha primeira reação é:",
    options: {
      D: "Buscar uma solução rápida e decisiva",
      I: "Discutir com outros para gerar ideias criativas",
      S: "Proceder com cautela e considerar todas as opções",
      C: "Pesquisar e analisar dados antes de agir"
    }
  },
  {
    id: 'short-3',
    question: "Meu estilo de comunicação é caracterizado por:",
    options: {
      D: "Ser direto, objetivo e assertivo",
      I: "Ser expressivo, entusiasta e persuasivo",
      S: "Ser diplomático, paciente e compreensivo",
      C: "Ser preciso, factual e bem fundamentado"
    }
  },
  {
    id: 'short-4',
    question: "Quando trabalho sob pressão, eu:",
    options: {
      D: "Mantenho o foco e tomo decisões rápidas",
      I: "Procuro apoio e motivação da equipe",
      S: "Me esforço para manter a calma e estabilidade",
      C: "Organizo metodicamente minhas tarefas"
    }
  },
  {
    id: 'short-5',
    question: "No ambiente de trabalho, eu me sinto mais confortável quando:",
    options: {
      D: "Tenho autonomia para tomar decisões importantes",
      I: "Posso interagir e trabalhar com pessoas diversas",
      S: "Existe estabilidade e um ambiente previsível",
      C: "Tenho informações precisas e procedimentos claros"
    }
  },
  {
    id: 'short-6',
    question: "Ao receber feedback, eu geralmente:",
    options: {
      D: "Aceito rapidamente e implemento mudanças imediatas",
      I: "Discuto e busco entender o contexto completo",
      S: "Reflito cuidadosamente antes de responder",
      C: "Analiso detalhadamente e documento as mudanças"
    }
  },
  {
    id: 'short-7',
    question: "Minha abordagem para novos projetos é:",
    options: {
      D: "Ação imediata, começo rapidamente",
      I: "Busco envolver a equipe e criar entusiasmo",
      S: "Planejo cuidadosamente antes de começar",
      C: "Analiso todos os detalhes e requisitos primeiro"
    }
  }
];

interface ShortDiscTestProps {
  onComplete: (results: {
    d: number;
    i: number;
    s: number;
    c: number;
    dominant: string;
    responses: Record<string, 'D' | 'I' | 'S' | 'C'>;
  }) => void;
  initialResponses?: Record<string, 'D' | 'I' | 'S' | 'C'>;
}

export const ShortDiscTest = ({ onComplete, initialResponses = {} }: ShortDiscTestProps) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, 'D' | 'I' | 'S' | 'C'>>(initialResponses);

  const currentQuestion = SHORT_DISC_QUESTIONS[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / SHORT_DISC_QUESTIONS.length) * 100;
  const selectedAnswer = responses[currentQuestion.id];

  const handleAnswer = (value: 'D' | 'I' | 'S' | 'C') => {
    const newResponses = {
      ...responses,
      [currentQuestion.id]: value
    };
    setResponses(newResponses);

    // Avançar automaticamente após 500ms
    setTimeout(() => {
      if (currentQuestionIndex < SHORT_DISC_QUESTIONS.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      } else {
        // Calcular resultados
        calculateResults(newResponses);
      }
    }, 500);
  };

  const calculateResults = (finalResponses: Record<string, 'D' | 'I' | 'S' | 'C'>) => {
    let d = 0, i = 0, s = 0, c = 0;

    Object.values(finalResponses).forEach(answer => {
      switch (answer) {
        case 'D': d++; break;
        case 'I': i++; break;
        case 'S': s++; break;
        case 'C': c++; break;
      }
    });

    const scores = { d, i, s, c };
    const maxScore = Math.max(d, i, s, c);
    let dominant = 'D';
    
    if (i === maxScore) dominant = 'I';
    else if (s === maxScore) dominant = 'S';
    else if (c === maxScore) dominant = 'C';

    onComplete({
      d,
      i,
      s,
      c,
      dominant,
      responses: finalResponses
    });
  };

  const goToPrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
      <CardHeader>
        <div className="flex items-center gap-2 mb-2">
          <Brain className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Teste de Perfil Comportamental (DISC)</CardTitle>
        </div>
        <CardDescription>
          Responda 7 perguntas rápidas para identificarmos seu perfil comportamental
        </CardDescription>
        <div className="mt-4">
          <div className="flex justify-between text-sm mb-2">
            <span>Pergunta {currentQuestionIndex + 1} de {SHORT_DISC_QUESTIONS.length}</span>
            <span className="text-primary font-semibold">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-base font-semibold mb-4 block">
            {currentQuestion.question}
          </Label>
          <RadioGroup
            value={selectedAnswer}
            onValueChange={(value) => handleAnswer(value as 'D' | 'I' | 'S' | 'C')}
            className="space-y-3"
          >
            {Object.entries(currentQuestion.options).map(([key, text]) => (
              <div
                key={key}
                className={`flex items-start space-x-3 p-3 rounded-lg border-2 transition-all cursor-pointer ${
                  selectedAnswer === key
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => handleAnswer(key as 'D' | 'I' | 'S' | 'C')}
              >
                <RadioGroupItem value={key} id={`option-${key}`} className="mt-1" />
                <Label
                  htmlFor={`option-${key}`}
                  className="flex-1 cursor-pointer text-sm leading-relaxed"
                >
                  {text}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {currentQuestionIndex > 0 && (
          <div className="flex justify-start pt-2">
            <button
              onClick={goToPrevious}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Voltar
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

