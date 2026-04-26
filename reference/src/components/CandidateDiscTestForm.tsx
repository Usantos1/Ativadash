import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, CheckCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useCandidateDiscTest } from "@/hooks/useCandidateDiscTest";
import { toast } from "sonner";

interface CandidateDiscTestFormProps {
  onComplete: () => void;
}

export const CandidateDiscTestForm = ({ onComplete }: CandidateDiscTestFormProps) => {
  const {
    currentQuestion,
    currentQuestionIndex,
    totalQuestions,
    progress,
    loading,
    isCompleted,
    answerQuestion,
    completeTest,
    goToPreviousQuestion
  } = useCandidateDiscTest();
  
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Auto-advance when answer is selected (except for last question)
  useEffect(() => {
    if (selectedAnswer && !isProcessing && currentQuestionIndex < totalQuestions - 1) {
      const timer = setTimeout(() => {
        handleAutoAnswer();
      }, 800); // Small delay for visual feedback

      return () => clearTimeout(timer);
    }
  }, [selectedAnswer, currentQuestionIndex, totalQuestions, isProcessing]);

  // Monitor when test is completed
  useEffect(() => {
    if (isCompleted) {
      console.log('[DISC] Teste finalizado, chamando onComplete');
      onComplete();
    }
  }, [isCompleted, onComplete]);

  // Reset selected answer when question changes
  useEffect(() => {
    setSelectedAnswer("");
    setIsProcessing(false);
  }, [currentQuestionIndex]);

  const handleAutoAnswer = async () => {
    if (!selectedAnswer || isProcessing) {
      console.log('[DISC] Cannot auto-answer:', { selectedAnswer, isProcessing });
      return;
    }
    
    console.log('[DISC] Starting auto-answer process...');
    setIsProcessing(true);
    
    // Find the option that matches selected answer
    const selectedOption = Object.entries(currentQuestion.options).find(
      ([key, text]) => text === selectedAnswer
    );
    
    if (selectedOption) {
      const selectedType = selectedOption[0] as 'D' | 'I' | 'S' | 'C';
      console.log(`[DISC] Auto-answering question ${currentQuestionIndex + 1}/${totalQuestions}:`, {
        selectedType,
        questionId: currentQuestion.id,
        isLastQuestion: currentQuestionIndex === totalQuestions - 1
      });
      try {
        await answerQuestion(selectedType);
        console.log('[DISC] Auto-answer successful');
      } catch (error) {
        console.error('[DISC] Auto-answer failed:', error);
        setIsProcessing(false); // Reset processing state on error
        return;
      }
    } else {
      console.error('[DISC] Could not find selected option');
    }
    
    // Reset for next question
    setSelectedAnswer("");
    setIsProcessing(false);
  };

  const handleManualAnswer = async () => {
    if (!selectedAnswer || isProcessing) return;
    
    console.log('[DISC] Manual answer initiated', {
      selectedAnswer,
      questionIndex: currentQuestionIndex,
      isLastQuestion: currentQuestionIndex === totalQuestions - 1,
      totalQuestions
    });
    
    setIsProcessing(true);
    
    const selectedOption = Object.entries(currentQuestion.options).find(
      ([key, text]) => text === selectedAnswer
    );
    
    if (selectedOption) {
      const selectedType = selectedOption[0] as 'D' | 'I' | 'S' | 'C';
      console.log(`[DISC] Manual answer question ${currentQuestionIndex + 1}/${totalQuestions}:`, selectedType);
      
      try {
        await answerQuestion(selectedType);
        console.log('[DISC] Manual answer completed successfully');
      } catch (error) {
        console.error('[DISC] Manual answer failed:', error);
        toast.error('Erro ao responder pergunta');
      }
    }
    
    setIsProcessing(false);
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

  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Progress Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Pergunta {currentQuestionIndex + 1} de {totalQuestions}</span>
              <span>{Math.round(progress)}% concluído</span>
            </div>
            <Progress value={progress} className="w-full" />
            <p className="text-center text-sm font-medium text-primary">
              {getMotivationalMessage()}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Current Question */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl leading-relaxed">
            {currentQuestion.question}
          </CardTitle>
          {!isLastQuestion && (
            <p className="text-sm text-muted-foreground">
              Selecione uma opção para avançar automaticamente
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup
            value={selectedAnswer}
            onValueChange={setSelectedAnswer}
            className="grid gap-4"
            disabled={isProcessing || loading}
          >
            {Object.entries(currentQuestion.options).map(([key, text], index) => (
              <div 
                key={key} 
                className={`flex items-center space-x-3 p-4 rounded-lg border transition-all duration-300 ${
                  selectedAnswer === text 
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20' 
                    : 'hover:bg-accent/50 border-border'
                } ${isProcessing && selectedAnswer === text ? 'animate-pulse' : ''}`}
              >
                <RadioGroupItem value={text} id={`option-${key}`} />
                <Label 
                  htmlFor={`option-${key}`} 
                  className="text-base leading-relaxed cursor-pointer flex-1"
                >
                  {text}
                </Label>
                {selectedAnswer === text && isProcessing && (
                  <CheckCircle className="h-5 w-5 text-primary animate-pulse" />
                )}
              </div>
            ))}
          </RadioGroup>

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={goToPreviousQuestion}
              disabled={currentQuestionIndex === 0 || isProcessing}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>

            {/* Only show manual button for last question */}
            {isLastQuestion && (
              <Button
                onClick={handleManualAnswer}
                disabled={!selectedAnswer || loading || isProcessing}
                className="flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent animate-spin rounded-full" />
                    Finalizando...
                  </>
                ) : (
                  "Finalizar Teste"
                )}
              </Button>
            )}
          </div>

          {/* Auto-advance indicator for non-last questions */}
          {!isLastQuestion && selectedAnswer && (
            <div className="text-center text-sm text-muted-foreground">
              {isProcessing ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent animate-spin rounded-full" />
                  Processando resposta...
                </div>
              ) : (
                "Resposta selecionada. Avançando..."
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};