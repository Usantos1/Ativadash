import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText } from 'lucide-react';

// Perguntas do teste DISC (mesmo array usado em useCandidateDiscTest)
const DISC_QUESTIONS = [
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

interface DiscResponsesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  responses: Array<{ questionId: number; selectedType: string }>;
}

const profileColors: Record<string, string> = {
  'D': 'bg-red-50 border-red-300 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400',
  'I': 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400',
  'S': 'bg-green-50 border-green-300 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400',
  'C': 'bg-yellow-50 border-yellow-300 text-yellow-700 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-400'
};

const profileNames: Record<string, string> = {
  'D': 'Dominante',
  'I': 'Influente',
  'S': 'Estável',
  'C': 'Cauteloso'
};

export function DiscResponsesModal({ open, onOpenChange, responses }: DiscResponsesModalProps) {
  // Criar mapa de respostas por questionId para acesso rápido
  const responsesMap = new Map(
    responses.map(r => [r.questionId, r.selectedType])
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Respostas do Teste DISC
          </DialogTitle>
          <DialogDescription>
            Visualize todas as perguntas e respostas do teste
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {DISC_QUESTIONS.map((question, index) => {
            const selectedType = responsesMap.get(question.id);
            const selectedOption = selectedType ? question.options[selectedType as keyof typeof question.options] : null;
            
            return (
              <Card key={question.id}>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <span className="text-muted-foreground">Pergunta {index + 1}:</span>
                    {question.question}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-sm font-semibold mb-2">Opções:</div>
                    {Object.entries(question.options).map(([type, text]) => {
                      const isSelected = selectedType === type;
                      const colorClass = profileColors[type] || '';
                      
                      return (
                        <div
                          key={type}
                          className={`p-3 rounded-lg border-2 transition-all ${
                            isSelected
                              ? `${colorClass} font-semibold`
                              : 'border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/20'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={isSelected ? 'default' : 'outline'}
                                className={isSelected ? colorClass : ''}
                              >
                                {type}
                              </Badge>
                              <span>{text}</span>
                            </div>
                            {isSelected && (
                              <Badge variant="secondary" className="ml-2">
                                Selecionada
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
