import { useState } from 'react';
import { ModernLayout } from '@/components/ModernLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, TrendingUp, TrendingDown, DollarSign, Package, Lightbulb, AlertTriangle } from 'lucide-react';
import { currencyFormatters } from '@/utils/formatters';
import { useSugerirPreco, useAnaliseProdutos } from '@/hooks/useFinanceiro';
import { toast } from 'sonner';

export default function Precificacao() {
  const [produtoSelecionado, setProdutoSelecionado] = useState<string>('');
  const [margemDesejada, setMargemDesejada] = useState<number>(50);
  
  const { data: produtos } = useAnaliseProdutos();
  const sugerirPreco = useSugerirPreco();
  
  const handleSugerir = async () => {
    if (!produtoSelecionado) {
      toast.error('Selecione um produto');
      return;
    }
    
    try {
      await sugerirPreco.mutateAsync({
        produtoId: produtoSelecionado,
        margemDesejada: margemDesejada,
      });
    } catch (error: any) {
      toast.error(error.message || 'Erro ao sugerir preço');
    }
  };
  
  const produtoAtual = produtos?.find(p => p.id === produtoSelecionado);
  const resultado = sugerirPreco.data;
  
  const getSugestaoBadge = (tipo: string) => {
    switch (tipo) {
      case 'aumento':
        return <Badge className="bg-green-500">Aumento Recomendado</Badge>;
      case 'reducao':
        return <Badge className="bg-orange-500">Redução Recomendada</Badge>;
      case 'aviso':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-700">Atenção</Badge>;
      default:
        return <Badge variant="outline">Info</Badge>;
    }
  };
  
  return (
    <ModernLayout title="Precificação Inteligente" subtitle="Sugestões de preços baseadas em IA e análise de dados">
      <div className="flex flex-col h-full overflow-hidden gap-4">
        {/* Controles */}
        <Card className="flex-shrink-0 border-[3px] border-gray-400 rounded-xl shadow-sm p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Produto</Label>
              <Select value={produtoSelecionado} onValueChange={setProdutoSelecionado}>
                <SelectTrigger className="h-10 rounded-lg border-[3px] border-gray-400">
                  <SelectValue placeholder="Selecione um produto" />
                </SelectTrigger>
                <SelectContent>
                  {produtos?.map(produto => (
                    <SelectItem key={produto.id} value={produto.id}>
                      {produto.nome} {produto.codigo && `(${produto.codigo})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Margem Desejada (%)</Label>
              <Input
                type="number"
                min={0}
                max={500}
                value={margemDesejada}
                onChange={(e) => setMargemDesejada(parseFloat(e.target.value) || 50)}
                className="h-10 rounded-lg border-[3px] border-gray-400"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleSugerir}
                disabled={!produtoSelecionado || sugerirPreco.isPending}
                className="w-full h-10 bg-blue-600 hover:bg-blue-700"
              >
                <Lightbulb className="h-4 w-4 mr-2" />
                Sugerir Preço
              </Button>
            </div>
          </div>
        </Card>
        
        {/* Informações do Produto */}
        {produtoAtual && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-[3px] border-gray-400 rounded-xl shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Produto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-semibold">{produtoAtual.nome}</p>
                {produtoAtual.codigo && (
                  <p className="text-xs text-muted-foreground">{produtoAtual.codigo}</p>
                )}
              </CardContent>
            </Card>
            
            <Card className="border-[3px] border-gray-400 rounded-xl shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Preço Atual
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{currencyFormatters.brl(produtoAtual.precoMedioVenda || 0)}</div>
              </CardContent>
            </Card>
            
            <Card className="border-[3px] border-gray-400 rounded-xl shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Margem Atual
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{produtoAtual.margemPercentual.toFixed(1)}%</div>
              </CardContent>
            </Card>
            
            <Card className="border-[3px] border-gray-400 rounded-xl shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Estoque
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{produtoAtual.estoqueAtual}</div>
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* Resultado da Sugestão */}
        {resultado && (
          <Card className="border-[3px] border-gray-400 rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                Sugestão de Precificação
              </CardTitle>
              <CardDescription>Análise baseada em dados históricos e padrões de venda</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Preço Sugerido */}
              <div className="p-4 bg-blue-50 rounded-lg border-[2px] border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-blue-900 mb-1">Preço Sugerido</p>
                    <p className="text-3xl font-bold text-blue-800">
                      {currencyFormatters.brl(resultado.preco_sugerido)}
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      Margem aparente: {resultado.margem_aparente?.toFixed(1)}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-blue-700">vs Preço Atual</p>
                    <p className={`text-lg font-bold ${resultado.preco_sugerido > (resultado.produto?.preco_atual || 0) ? 'text-green-600' : 'text-red-600'}`}>
                      {resultado.preco_sugerido > (resultado.produto?.preco_atual || 0) ? '+' : ''}
                      {currencyFormatters.brl(resultado.preco_sugerido - (resultado.produto?.preco_atual || 0))}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Análise Histórica */}
              {resultado.analise_historica?.preco_medio && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg border-[2px] border-gray-200">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Preço Médio Histórico</p>
                    <p className="text-lg font-bold">{currencyFormatters.brl(resultado.analise_historica.preco_medio)}</p>
                  </div>
                  {resultado.analise_historica.margem_media && (
                    <div className="p-3 bg-gray-50 rounded-lg border-[2px] border-gray-200">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Margem Média Histórica</p>
                      <p className="text-lg font-bold">{resultado.analise_historica.margem_media.toFixed(1)}%</p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Estatísticas */}
              <div className="p-3 bg-gray-50 rounded-lg border-[2px] border-gray-200">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Vendas (últimos 30 dias)</p>
                <p className="text-lg font-bold">{resultado.vendas_ultimos_30_dias} vendas</p>
              </div>
              
              {/* Sugestões */}
              {resultado.sugestoes && resultado.sugestoes.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Recomendações da IA:</p>
                  {resultado.sugestoes.map((sugestao: any, index: number) => (
                    <div key={index} className={`p-3 rounded-lg border-[2px] ${
                      sugestao.tipo === 'aumento' ? 'bg-green-50 border-green-200' :
                      sugestao.tipo === 'reducao' ? 'bg-orange-50 border-orange-200' :
                      'bg-yellow-50 border-yellow-200'
                    }`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {sugestao.tipo === 'aumento' && <TrendingUp className="h-4 w-4 text-green-600" />}
                            {sugestao.tipo === 'reducao' && <TrendingDown className="h-4 w-4 text-orange-600" />}
                            {sugestao.tipo === 'aviso' && <AlertTriangle className="h-4 w-4 text-yellow-600" />}
                            {getSugestaoBadge(sugestao.tipo)}
                          </div>
                          <p className="text-sm">{sugestao.mensagem}</p>
                          {sugestao.preco_alternativo && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Preço alternativo: {currencyFormatters.brl(sugestao.preco_alternativo)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
        
        {!resultado && produtoSelecionado && (
          <Card className="border-[3px] border-gray-400 rounded-xl shadow-sm">
            <CardContent className="p-12 text-center">
              <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Aguardando Análise</h3>
              <p className="text-muted-foreground">
                Clique em "Sugerir Preço" para obter recomendações baseadas em IA
              </p>
            </CardContent>
          </Card>
        )}
        
        {!produtoSelecionado && (
          <Card className="border-[3px] border-gray-400 rounded-xl shadow-sm">
            <CardContent className="p-12 text-center">
              <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Selecione um Produto</h3>
              <p className="text-muted-foreground">
                Escolha um produto acima para obter sugestões de precificação inteligente
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </ModernLayout>
  );
}
