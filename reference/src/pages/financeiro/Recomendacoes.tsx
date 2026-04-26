import { useState } from 'react';
import { ModernLayout } from '@/components/ModernLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CheckCircle, XCircle, Package, DollarSign, TrendingUp, Lightbulb } from 'lucide-react';
import { currencyFormatters } from '@/utils/formatters';
import { useRecomendacoes, useAplicarRecomendacao } from '@/hooks/useFinanceiro';
import { toast } from 'sonner';

export default function Recomendacoes() {
  const [tipoFiltro, setTipoFiltro] = useState<string>('all');
  const [statusFiltro, setStatusFiltro] = useState<string>('pendente');
  
  const { data: recomendacoes, isLoading } = useRecomendacoes(
    tipoFiltro !== 'all' ? tipoFiltro : undefined,
    statusFiltro
  );
  const aplicarRecomendacao = useAplicarRecomendacao();
  
  const tipos = [
    { value: 'all', label: 'Todas' },
    { value: 'preco', label: 'Precificação' },
    { value: 'estoque', label: 'Estoque' },
    { value: 'vendedor', label: 'Vendedores' },
    { value: 'promocao', label: 'Promoções' },
  ];
  
  const statusOptions = [
    { value: 'pendente', label: 'Pendentes' },
    { value: 'aceita', label: 'Aceitas' },
    { value: 'aplicada', label: 'Aplicadas' },
    { value: 'rejeitada', label: 'Rejeitadas' },
  ];
  
  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'preco':
        return <DollarSign className="h-4 w-4" />;
      case 'estoque':
        return <Package className="h-4 w-4" />;
      case 'vendedor':
        return <TrendingUp className="h-4 w-4" />;
      case 'promocao':
        return <Lightbulb className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendente':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-700">Pendente</Badge>;
      case 'aceita':
        return <Badge variant="outline" className="border-blue-500 text-blue-700">Aceita</Badge>;
      case 'aplicada':
        return <Badge variant="outline" className="border-green-500 text-green-700">Aplicada</Badge>;
      case 'rejeitada':
        return <Badge variant="outline" className="border-red-500 text-red-700">Rejeitada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  const getPrioridadeBadge = (prioridade: number) => {
    if (prioridade >= 9) {
      return <Badge variant="destructive">Crítica ({prioridade}/10)</Badge>;
    } else if (prioridade >= 7) {
      return <Badge className="bg-orange-500">Alta ({prioridade}/10)</Badge>;
    } else if (prioridade >= 5) {
      return <Badge className="bg-yellow-500">Média ({prioridade}/10)</Badge>;
    } else {
      return <Badge variant="outline">Baixa ({prioridade}/10)</Badge>;
    }
  };
  
  const handleAplicar = async (id: string) => {
    try {
      await aplicarRecomendacao.mutateAsync(id);
      toast.success('Recomendação aplicada com sucesso!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao aplicar recomendação');
    }
  };
  
  if (isLoading) {
    return (
      <ModernLayout title="Recomendações da IA" subtitle="Recomendações inteligentes para otimizar seu negócio">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Carregando recomendações...</p>
        </div>
      </ModernLayout>
    );
  }
  
  const recomendacoesAgrupadas = (recomendacoes || []).reduce((acc: any, rec: any) => {
    if (!acc[rec.tipo]) {
      acc[rec.tipo] = [];
    }
    acc[rec.tipo].push(rec);
    return acc;
  }, {});
  
  return (
    <ModernLayout title="Recomendações da IA" subtitle="Recomendações inteligentes para otimizar seu negócio">
      <div className="flex flex-col h-full overflow-hidden gap-4">
        {/* Filtros */}
        <Card className="flex-shrink-0 border-[3px] border-gray-400 rounded-xl shadow-sm p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Tipo</label>
              <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
                <SelectTrigger className="h-10 rounded-lg border-[3px] border-gray-400">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tipos.map(tipo => (
                    <SelectItem key={tipo.value} value={tipo.value}>{tipo.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Status</label>
              <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                <SelectTrigger className="h-10 rounded-lg border-[3px] border-gray-400">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(status => (
                    <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>
        
        {/* Lista de Recomendações */}
        <div className="flex-1 overflow-y-auto">
          {tipoFiltro === 'all' ? (
            <div className="space-y-4">
              {Object.entries(recomendacoesAgrupadas).map(([tipo, recs]: [string, any]) => (
                <Card key={tipo} className="border-[3px] border-gray-400 rounded-xl shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      {getTipoIcon(tipo)}
                      {tipos.find(t => t.value === tipo)?.label || tipo}
                      <Badge variant="outline" className="ml-auto">
                        {(recs as any[]).length} {(recs as any[]).length === 1 ? 'recomendação' : 'recomendações'}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {(recs as any[]).map((rec: any) => (
                        <div key={rec.id} className="p-4 border-[3px] border-gray-300 rounded-lg">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-bold text-base">{rec.titulo}</h4>
                                {getPrioridadeBadge(rec.prioridade)}
                                {getStatusBadge(rec.status)}
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">{rec.descricao}</p>
                              {rec.acao_sugerida && (
                                <div className="bg-blue-50 p-2 rounded border-[2px] border-blue-200">
                                  <p className="text-xs font-semibold text-blue-900 mb-1">Ação Sugerida:</p>
                                  <p className="text-sm text-blue-800">{rec.acao_sugerida}</p>
                                </div>
                              )}
                              {rec.impacto_estimado && (
                                <p className="text-sm font-semibold text-green-600 mt-2">
                                  Impacto Estimado: {currencyFormatters.brl(rec.impacto_estimado)}
                                </p>
                              )}
                            </div>
                            {rec.status === 'pendente' && (
                              <Button
                                onClick={() => handleAplicar(rec.id)}
                                disabled={aplicarRecomendacao.isPending}
                                className="shrink-0"
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Aplicar
                              </Button>
                            )}
                            {rec.status === 'aplicada' && (
                              <div className="shrink-0 flex items-center gap-2 text-green-600">
                                <CheckCircle className="h-5 w-5" />
                                <span className="text-sm font-semibold">Aplicada</span>
                              </div>
                            )}
                          </div>
                          {rec.created_at && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Criada em: {new Date(rec.created_at).toLocaleDateString('pt-BR')}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-[3px] border-gray-400 rounded-xl shadow-sm">
              <CardContent className="p-6">
                <div className="space-y-3">
                  {(recomendacoes || []).length > 0 ? (
                    (recomendacoes || []).map((rec: any) => (
                      <div key={rec.id} className="p-4 border-[3px] border-gray-300 rounded-lg">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-bold text-base">{rec.titulo}</h4>
                              {getPrioridadeBadge(rec.prioridade)}
                              {getStatusBadge(rec.status)}
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">{rec.descricao}</p>
                            {rec.acao_sugerida && (
                              <div className="bg-blue-50 p-2 rounded border-[2px] border-blue-200">
                                <p className="text-xs font-semibold text-blue-900 mb-1">Ação Sugerida:</p>
                                <p className="text-sm text-blue-800">{rec.acao_sugerida}</p>
                              </div>
                            )}
                            {rec.impacto_estimado && (
                              <p className="text-sm font-semibold text-green-600 mt-2">
                                Impacto Estimado: {currencyFormatters.brl(rec.impacto_estimado)}
                              </p>
                            )}
                          </div>
                          {rec.status === 'pendente' && (
                            <Button
                              onClick={() => handleAplicar(rec.id)}
                              disabled={aplicarRecomendacao.isPending}
                              className="shrink-0"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Aplicar
                            </Button>
                          )}
                          {rec.status === 'aplicada' && (
                            <div className="shrink-0 flex items-center gap-2 text-green-600">
                              <CheckCircle className="h-5 w-5" />
                              <span className="text-sm font-semibold">Aplicada</span>
                            </div>
                          )}
                        </div>
                        {rec.created_at && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Criada em: {new Date(rec.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">Nenhuma recomendação encontrada com os filtros selecionados.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </ModernLayout>
  );
}
