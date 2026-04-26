import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { useDiscTest } from "@/hooks/useDiscTest";

interface DiscTestFormProps {
  onComplete: () => void;
}

export const DiscTestForm = ({ onComplete }: DiscTestFormProps) => {
  const {
    currentQuestion,
    currentQuestionIndex,
    totalQuestions,
    progress,
    loading,
    isCompleted,
    answerQuestion,
    goToPreviousQuestion
  } = useDiscTest();
  
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Monitorar quando o teste é finalizado - removido para centralizar navegação

  // Auto-avanço após selecionar resposta (exceto última pergunta)
  useEffect(() => {
    if (selectedAnswer && !isProcessing && currentQuestionIndex < totalQuestions - 1) {
      setIsProcessing(true);
      
      setTimeout(() => {
        handleAutoAnswer();
      }, 800);
    }
  }, [selectedAnswer, currentQuestionIndex, totalQuestions, isProcessing]);

  // Resetar selectedAnswer quando mudar de pergunta
  useEffect(() => {
    setSelectedAnswer("");
    setIsProcessing(false);
  }, [currentQuestionIndex]);

  const handleAutoAnswer = () => {
    if (!selectedAnswer || loading) return;
    
    const selectedOption = currentQuestion.options.find(opt => opt.text === selectedAnswer);
    if (selectedOption) {
      console.log(`[DISC] Auto-avanço pergunta ${currentQuestionIndex + 1}/${totalQuestions}:`, selectedOption.type);
      answerQuestion(selectedOption.type);
    }
  };

  const handleAnswer = () => {
    if (!selectedAnswer) return;
    
    const selectedOption = currentQuestion.options.find(opt => opt.text === selectedAnswer);
    if (selectedOption) {
      console.log(`[DISC] Respondendo pergunta ${currentQuestionIndex + 1}/${totalQuestions}:`, selectedOption.type);
      
      // If this is the last question, answer and complete immediately
      if (currentQuestionIndex === totalQuestions - 1) {
        answerQuestion(selectedOption.type);
        // Force completion callback after a brief delay
        setTimeout(() => {
          onComplete();
        }, 500);
      } else {
        answerQuestion(selectedOption.type);
      }
      setSelectedAnswer("");
    }
  };

  const getMotivationalMessage = () => {
    const percentage = Math.round(progress);
    if (percentage <= 25) return "Você está indo muito bem!";
    if (percentage <= 50) return "Continue assim, você está no meio do caminho!";
    if (percentage <= 75) return "Quase lá! Mantenha o foco!";
    if (percentage < 100) return "Última pergunta! Você consegue!";
    return "Parabéns! Teste concluído!";
  };

  if (!currentQuestion) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Pergunta Atual */}
      <div className="min-h-[60vh] flex flex-col">
        <Card className="flex-1">
          <CardHeader className="text-center">
            <CardTitle className="text-xl md:text-2xl leading-relaxed px-4">
              {currentQuestion.question}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pb-8">
            <RadioGroup
              value={selectedAnswer}
              onValueChange={setSelectedAnswer}
              className="grid gap-4"
            >
              {currentQuestion.options.map((option, index) => {
                const isSelected = selectedAnswer === option.text;
                const isOptionProcessing = isSelected && isProcessing;
                
                return (
                  <div 
                    key={index} 
                    className={`flex items-center space-x-3 p-4 rounded-lg border transition-colors cursor-pointer ${
                      isSelected 
                        ? "bg-primary/10 border-primary" 
                        : "hover:bg-accent/50"
                    } ${isOptionProcessing ? "opacity-75" : ""}`}
                    onClick={() => !isProcessing && setSelectedAnswer(option.text)}
                  >
                    <RadioGroupItem 
                      value={option.text} 
                      id={`option-${index}`}
                      disabled={isProcessing}
                    />
                    <Label 
                      htmlFor={`option-${index}`} 
                      className="text-base leading-relaxed cursor-pointer flex-1"
                    >
                      {option.text}
                    </Label>
                    {isOptionProcessing && (
                      <div className="ml-2 w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>
                );
              })}
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Footer fixo com progresso e navegação */}
        <Card className="mt-6 bg-background/95 backdrop-blur-sm border-t-2 border-primary/20">
          <CardContent className="pt-6 pb-4">
            {/* Barra de Progresso */}
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Pergunta {currentQuestionIndex + 1} de {totalQuestions}</span>
                <span>{Math.round(progress)}% concluído</span>
              </div>
              <Progress value={progress} className="w-full h-2" />
              <p className="text-center text-sm font-medium text-primary">
                {getMotivationalMessage()}
              </p>
            </div>

            {/* Botões de Navegação */}
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={goToPreviousQuestion}
                disabled={currentQuestionIndex === 0 || isProcessing}
                className="flex items-center gap-2 h-12 px-6"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Anterior</span>
              </Button>

              {/* Mostrar botão de finalizar apenas na última pergunta */}
              {currentQuestionIndex === totalQuestions - 1 && (
                <Button
                  onClick={handleAnswer}
                  disabled={!selectedAnswer || loading || isProcessing}
                  className="flex items-center gap-2 h-12 px-6"
                >
                  <span>Finalizar Teste</span>
                  {isProcessing && (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};