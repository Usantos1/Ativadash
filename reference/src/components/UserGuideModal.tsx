import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, Plus, Edit, Eye, Workflow, FileText, Settings, Users } from 'lucide-react';

export const UserGuideModal = () => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Lightbulb className="h-4 w-4" />
          Guia
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            Guia de Uso - PrimeCamp Processos
          </DialogTitle>
          <DialogDescription>
            Aprenda a usar o sistema de processos internos da PrimeCamp
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="creating">Criando</TabsTrigger>
            <TabsTrigger value="workflow">Fluxos</TabsTrigger>
            <TabsTrigger value="tips">Dicas</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  O que é o Sistema de Processos?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p>O sistema permite documentar, gerenciar e otimizar os processos internos da PrimeCamp.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 border rounded-lg">
                    <h4 className="font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Documentação
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Registre cada etapa dos seus processos
                    </p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Workflow className="h-4 w-4" />
                      Fluxos Visuais
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Construa fluxos visuais dos processos
                    </p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Colaboração
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Defina responsáveis e participantes
                    </p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Badge className="h-4 w-4" />
                      Organização
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Use tags e departamentos para organizar
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="creating" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Como Criar um Processo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">1</div>
                    <div>
                      <h4 className="font-semibold">Informações Básicas</h4>
                      <p className="text-sm text-muted-foreground">
                        Preencha nome (min. 10 caracteres), objetivo (min. 50 caracteres), departamento e responsável
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">2</div>
                    <div>
                      <h4 className="font-semibold">Etapas do Processo</h4>
                      <p className="text-sm text-muted-foreground">
                        Adicione as atividades sequenciais. Use formatação HTML para descrições detalhadas
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">3</div>
                    <div>
                      <h4 className="font-semibold">Métricas e Prioridade</h4>
                      <p className="text-sm text-muted-foreground">
                        Defina como medir o sucesso e a prioridade (Baixa, Média, Alta, Crítica)
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">4</div>
                    <div>
                      <h4 className="font-semibold">Fluxo Visual</h4>
                      <p className="text-sm text-muted-foreground">
                        Use o construtor de fluxo para criar um diagrama visual do processo
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workflow" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Workflow className="h-5 w-5" />
                  Construtor de Fluxo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="bg-green-500 p-1 rounded">
                        <div className="w-3 h-3 bg-white rounded"></div>
                      </div>
                      <span className="font-semibold">Início</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Ponto de partida do processo
                    </p>
                  </div>
                  
                  <div className="p-3 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="bg-blue-500 p-1 rounded">
                        <div className="w-3 h-3 bg-white rounded-full"></div>
                      </div>
                      <span className="font-semibold">Etapa</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Atividade ou tarefa do processo
                    </p>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="bg-yellow-500 p-1 rounded">
                        <div className="w-3 h-3 bg-white transform rotate-45"></div>
                      </div>
                      <span className="font-semibold">Decisão</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Ponto de decisão com múltiplas saídas
                    </p>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="bg-red-500 p-1 rounded">
                        <div className="w-3 h-3 bg-white"></div>
                      </div>
                      <span className="font-semibold">Fim</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Conclusão do processo
                    </p>
                  </div>
                </div>

                <div className="bg-muted p-3 rounded-lg">
                  <h4 className="font-semibold mb-2">Como usar:</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Clique em "Adicionar Bloco" para inserir novos elementos</li>
                    <li>• Conecte os blocos arrastando das bordas</li>
                    <li>• Clique em um bloco para selecioná-lo e editá-lo</li>
                    <li>• Use "Salvar Fluxo" para salvar suas alterações</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tips" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>💡 Dicas e Melhores Práticas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <h4 className="font-semibold text-green-800 dark:text-green-300">✅ Faça</h4>
                    <ul className="text-sm space-y-1 text-green-700 dark:text-green-400">
                      <li>• Use nomes descritivos para os processos</li>
                      <li>• Defina responsáveis específicos para cada etapa</li>
                      <li>• Inclua tempos estimados realistas</li>
                      <li>• Use tags para facilitar a busca</li>
                      <li>• Mantenha os processos atualizados</li>
                    </ul>
                  </div>

                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <h4 className="font-semibold text-red-800 dark:text-red-300">❌ Evite</h4>
                    <ul className="text-sm space-y-1 text-red-700 dark:text-red-400">
                      <li>• Processos muito genéricos ou vagos</li>
                      <li>• Etapas muito longas ou complexas</li>
                      <li>• Não definir responsáveis</li>
                      <li>• Ignorar métricas de sucesso</li>
                      <li>• Deixar processos desatualizados</li>
                    </ul>
                  </div>

                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <h4 className="font-semibold text-blue-800 dark:text-blue-300">💡 Dica Pro</h4>
                    <p className="text-sm text-blue-700 dark:text-blue-400">
                      Use o campo de objetivo em HTML para incluir links, listas formatadas e outras informações ricas que ajudem na compreensão do processo.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};