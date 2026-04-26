import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, CheckCircle, Loader2 } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useCandidateDiscTest } from "@/hooks/useCandidateDiscTest";
import { toast } from "sonner";

interface ImprovedDiscTestFormProps {
  onComplete: () => void;
}

export const ImprovedDiscTestForm = ({ onComplete }: ImprovedDiscTestFormProps) => {
  const {
    currentQuestion,
    currentQuestionIndex,
    totalQuestions,
    progress,
    loading,
    isCompleted,
    isProcessing,
    answerQuestion,
    goToPreviousQuestion
  } = useCandidateDiscTest();
  
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Define handleManualAnswer BEFORE useEffect that uses it
  const handleManualAnswer = useCallback(async () => {
    if (!selectedAnswer || isProcessing || isSubmitting || !currentQuestion) {
      console.log('📱 Cannot submit answer:', { 
        selectedAnswer, 
        isProcessing, 
        isSubmitting, 
        hasQuestion: !!currentQuestion 
      });
      return;
    }
    
    // Prevent multiple simultaneous calls
    if (isSubmitting) {
      console.log('📱 Already submitting, ignoring...');
      return;
    }
    
    console.log('📱 Starting manual answer submission...', {
      selectedAnswer,
      currentQuestionIndex,
      questionId: currentQuestion.id,
      options: Object.keys(currentQuestion.options)
    });
    
    setIsSubmitting(true);
    
    try {
      // Find the option that matches selected answer
      const selectedOption = Object.entries(currentQuestion.options).find(
        ([key, text]) => text === selectedAnswer
      );
      
      if (!selectedOption) {
        console.error('📱 Could not find selected option', {
          selectedAnswer,
          availableOptions: Object.values(currentQuestion.options)
        });
        toast.error('Erro: opção não encontrada. Tente novamente.');
        setIsSubmitting(false);
        return;
      }
      
      const selectedType = selectedOption[0] as 'D' | 'I' | 'S' | 'C';
      console.log(`📱 Submitting answer for question ${currentQuestionIndex + 1}/${totalQuestions}:`, {
        selectedType,
        questionId: currentQuestion.id,
        selectedAnswer
      });
      
      await answerQuestion(selectedType);
      console.log('📱 Answer submitted successfully');
      
      // Don't clear selectedAnswer immediately - let the question change effect handle it
      // This ensures the answer is visible until the next question loads
      setIsSubmitting(false);
      
    } catch (error: any) {
      console.error('📱 Answer submission failed:', error);
      toast.error(`Erro ao responder pergunta: ${error.message || 'Erro desconhecido'}`);
      setIsSubmitting(false);
    }
  }, [selectedAnswer, isProcessing, isSubmitting, currentQuestion, currentQuestionIndex, totalQuestions, answerQuestion]);

  // Auto-advance when answer is selected - iPhone/Safari optimized
  useEffect(() => {
    // Only trigger if we have a selected answer and we're not already processing
    if (selectedAnswer && !isProcessing && !isSubmitting && currentQuestion && !isSubmitting) {
      const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const delay = isMobile ? 1200 : 800; // Longer delay for mobile
      
      console.log(`📱 Mobile auto-advance starting`, {
        selectedAnswer,
        currentQuestionIndex,
        totalQuestions,
        isProcessing,
        isSubmitting,
        isMobile,
        delay,
        hasQuestion: !!currentQuestion
      });
      
      const timer = setTimeout(() => {
        console.log(`📱 Mobile timer fired - calling handleManualAnswer`, {
          currentQuestionIndex,
          totalQuestions,
          isLast: currentQuestionIndex >= totalQuestions - 1,
          selectedAnswer,
          isProcessing,
          isSubmitting,
          hasHandleManualAnswer: typeof handleManualAnswer === 'function'
        });
        
        // Force answer submission - check conditions again before calling
        if (!isProcessing && !isSubmitting && selectedAnswer && currentQuestion) {
          handleManualAnswer();
        } else {
          console.warn('⚠️ Conditions not met for auto-advance', {
            isProcessing,
            isSubmitting,
            hasSelectedAnswer: !!selectedAnswer,
            hasQuestion: !!currentQuestion
          });
        }
      }, delay);

      return () => {
        console.log(`📱 Mobile timer cleared`);
        clearTimeout(timer);
      };
    }
  }, [selectedAnswer, currentQuestionIndex, totalQuestions, isProcessing, isSubmitting, currentQuestion, handleManualAnswer]);

  // Monitor test completion
  useEffect(() => {
    if (isCompleted) {
      console.log('[DISC] Test completed, calling onComplete');
      onComplete();
    }
  }, [isCompleted, onComplete]);

  // Reset state when question changes - but only if we're not currently submitting
  useEffect(() => {
    // Don't reset if we're in the middle of submitting an answer
    if (isSubmitting || isProcessing) {
      console.log('⏸️ Skipping reset - submission in progress');
      return;
    }
    
    console.log(`🔄 Question changed to index: ${currentQuestionIndex}`, {
      currentQuestion: currentQuestion?.question,
      questionId: currentQuestion?.id
    });
    setSelectedAnswer("");
    setIsSubmitting(false);
  }, [currentQuestionIndex, currentQuestion, isSubmitting, isProcessing]);

  // Selection handler
  const handleSelectionChange = useCallback((value: string) => {
    if (isProcessing || isSubmitting) return;
    setSelectedAnswer(value);
  }, [isProcessing, isSubmitting]);

  const getMotivationalMessage = () => {
    const percentage = Math.round(progress);
    if (percentage <= 25) return "Você está indo muito bem!";
    if (percentage <= 50) return "Continue assim, você está no meio do caminho!";
    if (percentage <= 75) return "Quase lá! Mantenha o foco!";
    if (percentage < 100) return "Última pergunta! Você consegue!";
    return "Parabéns! Teste concluído!";
  };

  if (!currentQuestion) {
    console.warn('⚠️ No current question available', {
      currentQuestionIndex,
      totalQuestions
    });
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardContent className="pt-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Carregando pergunta {currentQuestionIndex + 1} de {totalQuestions}...</p>
            <p className="text-sm text-muted-foreground mt-2">
              Índice: {currentQuestionIndex}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;
  const showSpinner = (isProcessing || isSubmitting) && selectedAnswer;

  // Debug log para verificar se o componente está atualizando
  console.log(`🎨 Rendering question ${currentQuestionIndex + 1}`, {
    question: currentQuestion.question,
    questionId: currentQuestion.id,
    selectedAnswer,
    isProcessing,
    isSubmitting,
    progress: Math.round(progress)
  });

  return (
    <div className="w-full max-w-4xl mx-auto space-y-3 px-3 sm:px-6">
      {/* Header with Progress */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="pt-4 pb-4 sm:pt-6 sm:pb-6">
          <div className="space-y-2 sm:space-y-3">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2 text-sm sm:text-sm">
              <span className="font-medium text-center sm:text-left">Pergunta {currentQuestionIndex + 1} de {totalQuestions}</span>
              <span className="text-primary font-semibold text-center sm:text-right text-sm sm:text-base">{Math.round(progress)}% concluído</span>
            </div>
            <Progress 
              value={progress} 
              className="w-full h-2 sm:h-3 bg-background/60" 
            />
            <p className="text-center text-sm sm:text-sm font-medium text-primary animate-fade-in">
              {getMotivationalMessage()}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Main Question Card */}
      <Card className="shadow-lg">
        <CardHeader className="pb-3 sm:pb-4 px-4 sm:px-6">
          <CardTitle className="text-base sm:text-xl md:text-2xl leading-relaxed px-1 sm:px-2 text-center font-semibold">
            {currentQuestion.question}
          </CardTitle>
          <p className="text-sm sm:text-sm text-muted-foreground text-center mt-2 sm:mt-2">
            Selecione uma opção para {isLastQuestion ? 'finalizar automaticamente' : 'avançar automaticamente'}
          </p>
        </CardHeader>
        
        <CardContent className="space-y-3 sm:space-y-6 px-4 sm:px-6">
          <RadioGroup
            value={selectedAnswer}
            onValueChange={handleSelectionChange}
            className="grid gap-3 sm:gap-4"
            disabled={isProcessing || loading || isSubmitting}
          >
            {Object.entries(currentQuestion.options).map(([key, text], index) => {
              const isSelected = selectedAnswer === text;
              const isOptionProcessing = isSelected && showSpinner;
              
              return (
                <div 
                  key={key} 
                  className={`group flex items-start sm:items-center space-x-3 sm:space-x-4 p-4 sm:p-4 rounded-xl sm:rounded-xl border-2 transition-all duration-300 cursor-pointer select-none touch-manipulation min-h-[56px] ${
                    isSelected 
                      ? 'border-primary bg-primary/10 shadow-md ring-2 ring-primary/20' 
                      : 'border-border hover:border-primary/50 hover:bg-accent/30 active:bg-primary/5'
                   } ${isOptionProcessing ? 'animate-pulse' : ''} ${
                     (isProcessing || isSubmitting) ? 'pointer-events-none opacity-60' : ''
                   }`}
                   onClick={() => !(isProcessing || isSubmitting) && handleSelectionChange(text)}
                   style={{ touchAction: 'manipulation' }}
                >
                  <RadioGroupItem 
                    value={text} 
                    id={`option-${key}`}
                    disabled={isProcessing || loading || isSubmitting}
                    className="mt-1 sm:mt-1 flex-shrink-0 min-w-[20px] min-h-[20px]"
                  />
                  <Label 
                    htmlFor={`option-${key}`} 
                    className="text-sm sm:text-base leading-relaxed cursor-pointer flex-1 group-hover:text-foreground break-words"
                  >
                    {text}
                  </Label>
                  {isOptionProcessing && (
                    <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-primary flex-shrink-0">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-xs font-medium hidden sm:inline">Processando...</span>
                    </div>
                  )}
                  {isSelected && !isOptionProcessing && (
                    <CheckCircle className="h-3 w-3 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </RadioGroup>

          {/* Navigation Footer */}
          <div className="flex justify-between items-center pt-3 sm:pt-6 border-t border-border">
            <Button
              variant="outline"
              onClick={goToPreviousQuestion}
              disabled={currentQuestionIndex === 0 || isProcessing || isSubmitting}
              className="flex items-center gap-1 sm:gap-2 h-10 sm:h-11 px-3 sm:px-6 text-sm sm:text-base min-h-[44px] touch-manipulation"
              style={{ touchAction: 'manipulation' }}
            >
              <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Anterior</span>
              <span className="sm:hidden">Voltar</span>
            </Button>

            <div className="flex-1" />
          </div>

          {/* Auto-advance indicator */}
          {selectedAnswer && (
            <div className="text-center pt-2">
              {showSpinner ? (
                <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-primary animate-fade-in">
                  <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                  <span>Processando resposta...</span>
                </div>
              ) : (
                <div className="text-xs sm:text-sm text-muted-foreground animate-fade-in">
                  ✓ Resposta selecionada - {isLastQuestion ? 'finalizando' : 'avançando'} automaticamente...
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};