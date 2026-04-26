import { useState, useEffect } from 'react';
import { ModernLayout } from '@/components/ModernLayout';
import { getStoredValuesVisible, ValuesVisibilityToggle, MASKED_VALUE } from '@/components/dashboard/FinancialCards';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { CurrencyInput } from '@/components/ui/currency-input';
import { DollarSign, Save, TrendingUp, Target } from 'lucide-react';
import { currencyFormatters } from '@/utils/formatters';
import { usePlanejamentoAnual, useSalvarPlanejamentoAnual } from '@/hooks/useFinanceiro';
import { toast } from 'sonner';

const meses = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function PlanejamentoAnual() {
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState<number>(anoAtual);
  const [valuesVisible, setValuesVisible] = useState(getStoredValuesVisible);
  
  const { data: planejamento, isLoading, isError } = usePlanejamentoAnual(ano);
  const salvarPlanejamento = useSalvarPlanejamentoAnual();
  
  const [receitaPlanejada, setReceitaPlanejada] = useState<number>(0);
  const [despesasPlanejadas, setDespesasPlanejadas] = useState<number>(0);
  const [metaMensal, setMetaMensal] = useState<Record<number, number>>({});
  const [observacoes, setObservacoes] = useState<string>('');
  
  // Carregar dados quando planejamento carregar
  useEffect(() => {
    if (planejamento) {
      setReceitaPlanejada(parseFloat(planejamento.receita_planejada || 0));
      setDespesasPlanejadas(parseFloat(planejamento.despesas_planejadas || 0));
      setObservacoes(planejamento.observacoes || '');
      if (planejamento.meta_mensal) {
        const metas = typeof planejamento.meta_mensal === 'string' 
          ? JSON.parse(planejamento.meta_mensal) 
          : planejamento.meta_mensal;
        setMetaMensal(metas || {});
      }
    } else {
      // Resetar quando não há planejamento
      setReceitaPlanejada(0);
      setDespesasPlanejadas(0);
      setMetaMensal({});
      setObservacoes('');
    }
  }, [planejamento]);
  
  const lucroEsperado = receitaPlanejada - despesasPlanejadas;
  const margemEsperada = receitaPlanejada > 0 ? (lucroEsperado / receitaPlanejada) * 100 : 0;
  
  const totalMetaMensal = Object.values(metaMensal).reduce((sum, val) => sum + (parseFloat(val as any) || 0), 0);
  const diferencaMeta = receitaPlanejada - totalMetaMensal;
  
  const handleSalvar = async () => {
    try {
      await salvarPlanejamento.mutateAsync({
        ano,
        dados: {
          receita_planejada: receitaPlanejada,
          despesas_planejadas: despesasPlanejadas,
          meta_mensal: metaMensal,
          observacoes: observacoes || null,
        },
      });
      toast.success('Planejamento salvo com sucesso!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar planejamento');
    }
  };
  
  const updateMetaMensal = (mes: number, valor: number) => {
    setMetaMensal(prev => ({
      ...prev,
      [mes]: valor,
    }));
  };
  
  useEffect(() => {
    if (isError) {
      toast.info('Planejamento não carregado. Preencha e salve para criar.');
    }
  }, [isError]);

  const fmt = (n: number) => (valuesVisible ? currencyFormatters.brl(n) : MASKED_VALUE);

  if (isLoading) {
    return (
      <ModernLayout
        title="Planejamento Anual"
        subtitle="Planeje suas metas financeiras para o ano"
        headerActions={<ValuesVisibilityToggle valuesVisible={valuesVisible} setValuesVisible={setValuesVisible} />}
      >
        <div className="flex flex-col gap-4">
          <Card className="flex-shrink-0 border-2 border-gray-300 dark:border-gray-600 rounded-xl p-4">
            <div className="flex items-end gap-3">
              <div className="space-y-1 flex-1 max-w-xs">
                <Label className="text-xs font-semibold text-muted-foreground">Ano</Label>
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
              <Skeleton className="h-10 w-40 rounded-lg" />
            </div>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="border-2 border-gray-300 dark:border-gray-600 rounded-xl">
                <CardHeader className="pb-3"><Skeleton className="h-5 w-32" /></CardHeader>
                <CardContent><Skeleton className="h-12 w-full" /></CardContent>
              </Card>
            ))}
          </div>
          <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Metas Mensais</CardTitle>
              <CardDescription>Distribua a receita planejada pelos meses do ano</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="border-b-[3px] border-gray-400">
                  <TableRow>
                    <TableHead className="font-bold">Mês</TableHead>
                    <TableHead className="font-bold text-right">Meta Mensal</TableHead>
                    <TableHead className="font-bold text-right">% do Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meses.map((_, i) => (
                    <TableRow key={i} className="border-b-[2px] border-gray-300">
                      <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-9 w-40 ml-auto" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-6 w-12 ml-auto" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Observações</CardTitle>
              <CardDescription>Anotações e observações sobre o planejamento</CardDescription>
            </CardHeader>
            <CardContent><Skeleton className="min-h-[120px] w-full rounded" /></CardContent>
          </Card>
        </div>
      </ModernLayout>
    );
  }

  return (
    <ModernLayout
      title="Planejamento Anual"
      subtitle="Planeje suas metas financeiras para o ano"
      headerActions={<ValuesVisibilityToggle valuesVisible={valuesVisible} setValuesVisible={setValuesVisible} />}
    >
      <div className="flex flex-col gap-4 pb-8 min-w-0">
        {/* Controles — mobile: toque confortável */}
        <Card className="flex-shrink-0 border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm p-3 sm:p-4 min-w-0">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
            <div className="space-y-1 flex-1 min-w-0">
              <Label className="text-xs font-semibold text-muted-foreground">Ano</Label>
              <Input
                type="number"
                min={2020}
                max={2100}
                value={ano}
                onChange={(e) => setAno(Math.max(2020, Math.min(2100, parseInt(e.target.value) || anoAtual)))}
                className="min-h-[44px] sm:h-10 border-2 border-gray-300 dark:border-gray-600 rounded-xl sm:rounded-lg touch-manipulation"
              />
            </div>
            <Button
              onClick={handleSalvar}
              disabled={salvarPlanejamento.isPending}
              className="min-h-[44px] sm:h-10 rounded-xl sm:rounded-md bg-green-600 hover:bg-green-700 touch-manipulation"
            >
              <Save className="h-4 w-4 mr-2" />
              Salvar Planejamento
            </Button>
          </div>
        </Card>
        
        {/* Resumo — mobile: 2 colunas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 min-w-0">
          <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm min-w-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Target className="h-5 w-5" />
                Receita Planejada
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CurrencyInput
                value={receitaPlanejada}
                onChange={setReceitaPlanejada}
                showCurrency
                className="text-lg sm:text-2xl font-bold border-2 border-gray-300 focus:border-primary min-h-[44px] sm:h-12 rounded-lg touch-manipulation"
                placeholder="0,00"
              />
            </CardContent>
          </Card>
          
          <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm min-w-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <DollarSign className="h-5 w-5 shrink-0" />
                Despesas Planejadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CurrencyInput
                value={despesasPlanejadas}
                onChange={setDespesasPlanejadas}
                showCurrency
                className="text-lg sm:text-2xl font-bold border-2 border-gray-300 focus:border-primary min-h-[44px] sm:h-12 rounded-lg touch-manipulation"
                placeholder="0,00"
              />
            </CardContent>
          </Card>
          
          <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm min-w-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 shrink-0" />
                Lucro Esperado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${lucroEsperado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fmt(lucroEsperado)}
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Target className="h-5 w-5" />
                Margem Esperada
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${margemEsperada >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {margemEsperada.toFixed(1)}%
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Metas Mensais */}
        <Card className="flex-1 overflow-hidden border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Metas Mensais</CardTitle>
            <CardDescription>
              Distribua a receita planejada pelos meses do ano
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-0 scrollbar-thin">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10 border-b-[3px] border-gray-400">
                <TableRow>
                  <TableHead className="font-bold">Mês</TableHead>
                  <TableHead className="font-bold text-right">Meta Mensal</TableHead>
                  <TableHead className="font-bold text-right">% do Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meses.map((mes, index) => {
                  const mesNum = index + 1;
                  const valor = metaMensal[mesNum] || 0;
                  const percentual = receitaPlanejada > 0 ? (valor / receitaPlanejada) * 100 : 0;
                  
                  return (
                    <TableRow key={mesNum} className="border-b-[2px] border-gray-300">
                      <TableCell className="font-semibold">{mes}</TableCell>
                      <TableCell className="text-right">
                        <CurrencyInput
                          value={valor}
                          onChange={(val) => updateMetaMensal(mesNum, val)}
                          showCurrency
                          className="text-right border-[2px] border-gray-300 w-40 ml-auto h-9"
                          placeholder="0,00"
                        />
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {percentual.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="border-t-[3px] border-gray-400 bg-gray-50 font-bold">
                  <TableCell>TOTAL</TableCell>
                  <TableCell className="text-right">{fmt(totalMetaMensal)}</TableCell>
                  <TableCell className="text-right">
                    {receitaPlanejada > 0 ? ((totalMetaMensal / receitaPlanejada) * 100).toFixed(1) : 0}%
                  </TableCell>
                </TableRow>
                {diferencaMeta !== 0 && (
                  <TableRow className={diferencaMeta > 0 ? 'bg-yellow-50' : 'bg-red-50'}>
                    <TableCell colSpan={2} className="font-semibold">
                      {diferencaMeta > 0 ? 'Faltam distribuir:' : 'Excesso distribuído:'}
                    </TableCell>
                    <TableCell className={`text-right font-bold ${diferencaMeta > 0 ? 'text-yellow-700' : 'text-red-700'}`}>
                      {fmt(Math.abs(diferencaMeta))}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        
        {/* Observações */}
        <Card className="border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Observações</CardTitle>
            <CardDescription>Anotações e observações sobre o planejamento</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Adicione observações, estratégias, premissas e outras informações relevantes para o planejamento..."
              className="min-h-[120px] border-2 border-gray-300 dark:border-gray-600"
            />
          </CardContent>
        </Card>
      </div>
    </ModernLayout>
  );
}
