import { useState, useEffect } from 'react';
import { ModernLayout } from "@/components/ModernLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Brain, Play, History, Info, Trophy } from "lucide-react";
import { useDiscTest } from "@/hooks/useDiscTest";
import { DiscTestForm } from "@/components/DiscTestForm";
import { EnhancedDiscTestResults } from "@/components/EnhancedDiscTestResults";
import { DiscTestHistory } from "@/components/DiscTestHistory";
import { useToast } from "@/hooks/use-toast";

export default function DiscTest() {
  const [activeTab, setActiveTab] = useState("intro");
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const { toast } = useToast();
const {
    isCompleted,
    result,
    hasInProgressTest,
    currentQuestionIndex,
    startTest,
    resetTest
  } = useDiscTest();

  // Auto-navegação para resultado quando teste completa
  useEffect(() => {
    console.log('[DISC] Verificando estados para navegação:', { 
      isCompleted, 
      hasResult: !!result, 
      activeTab
    });
    
    // Navegar automaticamente quando teste é completado
    if (isCompleted && result && activeTab === "test") {
      console.log('[DISC] Teste completado, navegando para resultado automaticamente');
      setTimeout(() => {
        setActiveTab("result");
        toast({
          title: "Teste concluído! 🎉",
          description: "Seu perfil DISC foi calculado com sucesso."
        });
      }, 1000); // Delay de 1 segundo para mostrar feedback visual
    }
  }, [isCompleted, result, activeTab, toast]);

  const handleStartTest = () => {
    if (hasInProgressTest) {
      setShowResumeDialog(true);
    } else {
      setActiveTab("test");
      startTest();
    }
  };

  const handleResumeTest = () => {
    setShowResumeDialog(false);
    setActiveTab("test");
  };

  const handleNewTest = () => {
    setShowResumeDialog(false);
    resetTest();
    setActiveTab("test");
    startTest();
  };

  const handleTestComplete = () => {
    console.log('[DISC] handleTestComplete chamado');
    // A navegação automática será feita pelo useEffect
  };

  const handleRestart = () => {
    resetTest();
    setActiveTab("intro");
  };

  return (
    <ModernLayout 
      title="Teste DISC - PrimeCamp"
      subtitle="Descubra seu perfil comportamental através de perguntas objetivas"
    >
      <div className="space-y-4 md:space-y-6 px-1 md:px-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 border-2 border-gray-300 bg-gray-50 gap-0 overflow-hidden h-auto">
            <TabsTrigger 
              value="intro" 
              className="flex items-center justify-center gap-1 md:gap-2 text-[9px] md:text-sm px-2 md:px-3 py-2.5 md:py-2.5 border-r-2 border-gray-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-violet-500 data-[state=active]:text-white whitespace-nowrap text-center h-full"
            >
              <Info className="h-2.5 w-2.5 md:h-4 md:w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Introdução</span>
              <span className="sm:hidden">Intro</span>
            </TabsTrigger>
            <TabsTrigger 
              value="test" 
              disabled={!hasInProgressTest && activeTab !== "test"} 
              className="flex items-center justify-center gap-1 md:gap-2 text-[9px] md:text-sm px-2 md:px-3 py-2.5 md:py-2.5 border-r-2 border-gray-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-violet-500 data-[state=active]:text-white md:border-r-2 whitespace-nowrap text-center h-full"
            >
              <Brain className="h-2.5 w-2.5 md:h-4 md:w-4 flex-shrink-0" />
              <span>Teste</span>
            </TabsTrigger>
            <TabsTrigger 
              value="result" 
              disabled={!result} 
              className="flex items-center justify-center gap-1 md:gap-2 text-[9px] md:text-sm px-2 md:px-3 py-2.5 md:py-2.5 border-r-2 border-gray-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-violet-500 data-[state=active]:text-white md:border-r-2 whitespace-nowrap text-center h-full"
            >
              <Trophy className="h-2.5 w-2.5 md:h-4 md:w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Resultado</span>
              <span className="sm:hidden">Result</span>
            </TabsTrigger>
            <TabsTrigger 
              value="history" 
              className="flex items-center justify-center gap-1 md:gap-2 text-[9px] md:text-sm px-2 md:px-3 py-2.5 md:py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-violet-500 data-[state=active]:text-white whitespace-nowrap text-center h-full"
            >
              <History className="h-2.5 w-2.5 md:h-4 md:w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Histórico</span>
              <span className="sm:hidden">Hist</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="intro" className="mt-4 md:mt-6 space-y-4 md:space-y-6">
            {/* Introdução ao Teste DISC */}
            <Card className="border-2 border-gray-300 shadow-sm">
              <CardHeader className="text-center pb-3 pt-3 md:pt-6 px-3 md:px-6">
                <div className="flex flex-col md:flex-row items-center justify-center gap-3 mb-4">
                  <div className="p-3 rounded-full bg-gradient-to-br from-purple-100 to-white border-2 border-gray-200">
                    <Brain className="h-6 w-6 md:h-8 md:w-8 text-purple-600" />
                  </div>
                  <CardTitle className="text-lg md:text-2xl">Avaliação de Perfil DISC</CardTitle>
                </div>
                <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
                  O teste DISC é uma ferramenta de avaliação comportamental que identifica como você se comporta em diferentes situações profissionais e pessoais.
                </p>
              </CardHeader>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {/* O que você vai descobrir */}
              <Card className="border-2 border-gray-300 shadow-sm">
                <CardHeader className="pb-3 pt-3 md:pt-6 px-3 md:px-6 border-b-2 border-gray-200">
                  <CardTitle className="text-base md:text-lg">O que você vai descobrir</CardTitle>
                </CardHeader>
                <CardContent className="p-3 md:p-6 space-y-3 md:space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-red-100 border-2 border-red-300 flex items-center justify-center text-xs md:text-sm font-bold text-red-600">D</div>
                      <div>
                        <h4 className="font-semibold text-sm md:text-base">Dominância</h4>
                        <p className="text-xs md:text-sm text-muted-foreground">Como você enfrenta problemas e desafios</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-blue-100 border-2 border-blue-300 flex items-center justify-center text-xs md:text-sm font-bold text-blue-600">I</div>
                      <div>
                        <h4 className="font-semibold text-sm md:text-base">Influência</h4>
                        <p className="text-xs md:text-sm text-muted-foreground">Como você influencia e se relaciona com pessoas</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-green-100 border-2 border-green-300 flex items-center justify-center text-xs md:text-sm font-bold text-green-600">S</div>
                      <div>
                        <h4 className="font-semibold text-sm md:text-base">Estabilidade</h4>
                        <p className="text-xs md:text-sm text-muted-foreground">Como você responde ao ritmo e mudanças</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-yellow-100 border-2 border-yellow-300 flex items-center justify-center text-xs md:text-sm font-bold text-yellow-600">C</div>
                      <div>
                        <h4 className="font-semibold text-sm md:text-base">Conformidade</h4>
                        <p className="text-xs md:text-sm text-muted-foreground">Como você segue regras e procedimentos</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Como funciona */}
              <Card className="border-2 border-gray-300 shadow-sm">
                <CardHeader className="pb-3 pt-3 md:pt-6 px-3 md:px-6 border-b-2 border-gray-200">
                  <CardTitle className="text-base md:text-lg">Como funciona</CardTitle>
                </CardHeader>
                <CardContent className="p-3 md:p-6 space-y-3 md:space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-100 to-white border-2 border-purple-300 flex items-center justify-center text-xs md:text-sm font-bold text-purple-600">1</div>
                      <p className="text-xs md:text-sm">Responda 20 perguntas objetivas</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-100 to-white border-2 border-purple-300 flex items-center justify-center text-xs md:text-sm font-bold text-purple-600">2</div>
                      <p className="text-xs md:text-sm">Escolha a opção que mais se identifica com você</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-100 to-white border-2 border-purple-300 flex items-center justify-center text-xs md:text-sm font-bold text-purple-600">3</div>
                      <p className="text-xs md:text-sm">Receba seu perfil detalhado com gráficos</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-100 to-white border-2 border-purple-300 flex items-center justify-center text-xs md:text-sm font-bold text-purple-600">4</div>
                      <p className="text-xs md:text-sm">Exporte seu resultado em PDF</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Informações importantes */}
            <Card className="border-2 border-purple-300 bg-purple-50/50 shadow-sm">
              <CardContent className="p-3 md:p-6 pt-3 md:pt-6">
                <div className="space-y-2">
                  <h3 className="font-semibold text-purple-700 text-sm md:text-base">Informações importantes:</h3>
                  <ul className="text-xs md:text-sm text-muted-foreground space-y-1">
                    <li>• O teste leva aproximadamente 10-15 minutos para ser concluído</li>
                    <li>• Responda com base em seu comportamento natural, não no que acredita ser esperado</li>
                    <li>• Não existem respostas certas ou erradas</li>
                    <li>• Seu progresso é salvo automaticamente</li>
                    <li>• Você pode pausar e retomar o teste a qualquer momento</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Botão para iniciar */}
            <div className="text-center">
              <Button 
                size="lg" 
                onClick={handleStartTest}
                className="text-sm md:text-lg px-6 md:px-8 py-2 md:py-3 bg-gradient-to-r from-purple-500 to-violet-500 hover:from-purple-600 hover:to-violet-600 text-white border-0 shadow-md"
              >
                <Play className="h-4 w-4 md:h-5 md:w-5 mr-2" />
                {hasInProgressTest ? "Continuar Teste" : "Iniciar Teste DISC"}
              </Button>
              {hasInProgressTest && (
                <p className="text-xs md:text-sm text-muted-foreground mt-2">
                  Você tem um teste em progresso
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="test">
            {isCompleted && result ? (
              <EnhancedDiscTestResults 
                result={result} 
                onRestart={handleRestart}
              />
            ) : (
              <DiscTestForm onComplete={handleTestComplete} />
            )}
          </TabsContent>

          <TabsContent value="result">
            {result && (
              <EnhancedDiscTestResults 
                result={result} 
                onRestart={handleRestart}
              />
            )}
          </TabsContent>

          <TabsContent value="history">
            <DiscTestHistory />
          </TabsContent>
        </Tabs>

        {/* Dialog para retomar teste */}
        <AlertDialog open={showResumeDialog} onOpenChange={setShowResumeDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Teste em Progresso</AlertDialogTitle>
              <AlertDialogDescription>
                Você tem um teste DISC em progresso. Deseja continuar de onde parou ou iniciar um novo teste?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleNewTest}>
                Novo Teste
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleResumeTest}>
                Continuar Teste
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ModernLayout>
  );
}