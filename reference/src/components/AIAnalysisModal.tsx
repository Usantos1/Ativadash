import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, AlertCircle, TrendingUp, Target, User, Brain, Zap } from "lucide-react";
import { parseJsonObject } from "@/utils/formatters";

interface AIAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: any;
  candidateName?: string;
}

export const AIAnalysisModal = ({ isOpen, onClose, analysis, candidateName }: AIAnalysisModalProps) => {
  if (!analysis || !analysis.analysis_data) return null;

  // Garantir que analysis_data seja parseado corretamente (pode vir como string do JSONB)
  const data = parseJsonObject(analysis.analysis_data, {});

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'APROVADO':
        return 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800';
      case 'REPROVADO':
        return 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800';
      case 'ANÁLISE_MANUAL':
        return 'bg-yellow-50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800';
      default:
        return 'bg-gray-50 dark:bg-gray-950/20 text-gray-700 dark:text-gray-400';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            Análise por Inteligência Artificial
          </DialogTitle>
          <DialogDescription>
            {candidateName && `Análise completa do candidato ${candidateName}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Score Geral e Recomendação */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5 text-purple-600" />
                  Score Geral
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-bold">{data.score_geral || 0}</span>
                    <span className="text-sm text-muted-foreground">/ 100</span>
                  </div>
                  <Progress value={data.score_geral || 0} className="h-3" />
                </div>
              </CardContent>
            </Card>

            <Card className={`border-2 ${getRecommendationColor(data.recomendacao || '')}`}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  {data.recomendacao === 'APROVADO' && <CheckCircle className="h-5 w-5" />}
                  {data.recomendacao === 'REPROVADO' && <XCircle className="h-5 w-5" />}
                  {data.recomendacao === 'ANÁLISE_MANUAL' && <AlertCircle className="h-5 w-5" />}
                  Recomendação
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold mb-2">
                  {data.recomendacao || 'N/A'}
                </div>
                <p className="text-sm">{data.justificativa || 'Sem justificativa disponível'}</p>
              </CardContent>
            </Card>
          </div>

          {/* Métricas Principais */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Chances de Sucesso
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.chances_sucesso || 0}%</div>
                <Progress value={data.chances_sucesso || 0} className="h-2 mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Comprometimento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.comprometimento || 0}%</div>
                <Progress value={data.comprometimento || 0} className="h-2 mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Área Recomendada
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="outline" className="text-base">
                  {data.area_recomendada || 'Não definida'}
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* Análise Detalhada */}
          <Card>
            <CardHeader>
              <CardTitle>Análise Detalhada</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.perfil_comportamental && (
                <div>
                  <h4 className="font-semibold mb-2">Perfil Comportamental</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {data.perfil_comportamental}
                  </p>
                </div>
              )}

              {data.experiencia && (
                <div>
                  <h4 className="font-semibold mb-2">Experiência e Qualificações</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {data.experiencia}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pontos Fortes e Fracos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.pontos_fortes && data.pontos_fortes.length > 0 && (
              <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2 text-green-700 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    Pontos Fortes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {data.pontos_fortes.map((ponto: string, index: number) => (
                      <li key={index} className="text-sm flex items-start gap-2">
                        <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
                        <span>{ponto}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {data.pontos_fracos && data.pontos_fracos.length > 0 && (
              <Card className="border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2 text-orange-700 dark:text-orange-400">
                    <AlertCircle className="h-4 w-4" />
                    Pontos de Atenção
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {data.pontos_fracos.map((ponto: string, index: number) => (
                      <li key={index} className="text-sm flex items-start gap-2">
                        <span className="text-orange-600 dark:text-orange-400 mt-1">⚠</span>
                        <span>{ponto}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sugestões de Entrevista */}
          {data.sugestoes_entrevista && data.sugestoes_entrevista.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sugestões de Perguntas para Entrevista</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {data.sugestoes_entrevista.map((pergunta: string, index: number) => (
                    <li key={index} className="text-sm flex items-start gap-2 p-2 rounded bg-muted/50">
                      <span className="font-semibold mt-0.5">{index + 1}.</span>
                      <span>{pergunta}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

