import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { from } from '@/integrations/db/client';
import { currencyFormatters } from '@/utils/formatters';

interface VendaRetroativa {
  data: string;
  dataFormatada: string;
  custo: number;
  venda: number;
  lucro: number;
  valido: boolean;
}

interface ImportarVendasRetroativasProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ImportarVendasRetroativas({ open, onOpenChange, onSuccess }: ImportarVendasRetroativasProps) {
  const { toast } = useToast();
  const [texto, setTexto] = useState('');
  const [vendasParsed, setVendasParsed] = useState<VendaRetroativa[]>([]);
  const [step, setStep] = useState<'input' | 'preview' | 'importing'>('input');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [observacao, setObservacao] = useState('Importação retroativa do sistema anterior');
  const [saleOrigin, setSaleOrigin] = useState<'PDV' | 'OS'>('PDV');

  // Função para parsear valor brasileiro (1.234,56 -> 1234.56)
  const parseValorBR = (valor: string): number => {
    if (!valor) return 0;
    // Remove pontos de milhar e troca vírgula por ponto
    const cleaned = valor.trim().replace(/\./g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  // Função para parsear data brasileira (dd/mm/yyyy -> yyyy-mm-dd)
  const parseDataBR = (data: string): string | null => {
    const match = data.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!match) return null;
    const [, dia, mes, ano] = match;
    return `${ano}-${mes}-${dia}`;
  };

  // Parsear o texto colado
  const handleParsear = () => {
    const linhas = texto.split('\n').filter(l => l.trim());
    const vendas: VendaRetroativa[] = [];

    for (const linha of linhas) {
      // Regex para capturar: DATA CUSTO VENDA LUCRO
      // Formato: dd/mm/yyyy 1.234,56 1.234,56 1.234,56
      const match = linha.match(/(\d{2}\/\d{2}\/\d{4})\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/);
      
      if (match) {
        const [, dataStr, custoStr, vendaStr, lucroStr] = match;
        const dataISO = parseDataBR(dataStr);
        
        if (dataISO) {
          vendas.push({
            data: dataISO,
            dataFormatada: dataStr,
            custo: parseValorBR(custoStr),
            venda: parseValorBR(vendaStr),
            lucro: parseValorBR(lucroStr),
            valido: true,
          });
        }
      }
    }

    if (vendas.length === 0) {
      toast({
        title: 'Nenhuma venda encontrada',
        description: 'Verifique se o formato está correto: DD/MM/YYYY CUSTO VENDA LUCRO',
        variant: 'destructive',
      });
      return;
    }

    // Ordenar por data
    vendas.sort((a, b) => a.data.localeCompare(b.data));
    
    setVendasParsed(vendas);
    setStep('preview');
  };

  // Calcular totais
  const totais = vendasParsed.reduce(
    (acc, v) => ({
      custo: acc.custo + v.custo,
      venda: acc.venda + v.venda,
      lucro: acc.lucro + v.lucro,
    }),
    { custo: 0, venda: 0, lucro: 0 }
  );

  // Importar vendas
  const handleImportar = async () => {
    setIsImporting(true);
    setStep('importing');
    setImportProgress(0);

    try {
      // Buscar último número de venda
      const { data: lastSale } = await from('sales')
        .select('numero')
        .order('numero', { ascending: false })
        .limit(1)
        .single();

      let numeroAtual = (lastSale?.numero || 0) + 1;
      let importados = 0;

      for (const venda of vendasParsed) {
        // Criar venda consolidada do dia
        const { data: newSale, error: saleError } = await from('sales')
          .insert({
            numero: numeroAtual,
            status: 'paid',
            sale_origin: saleOrigin, // Origem selecionada: PDV ou OS
            cliente_nome: saleOrigin === 'PDV' ? 'VENDA CONSOLIDADA' : 'OS CONSOLIDADA',
            subtotal: venda.venda,
            desconto_total: 0,
            total: venda.venda,
            total_pago: venda.venda,
            observacoes: `${observacao}\nOrigem: ${saleOrigin}\nData original: ${venda.dataFormatada}\nCusto: ${currencyFormatters.brl(venda.custo)}\nLucro: ${currencyFormatters.brl(venda.lucro)}`,
            is_draft: false,
            created_at: `${venda.data}T12:00:00Z`,
            finalized_at: `${venda.data}T12:00:00Z`,
          })
          .select()
          .single();

        if (saleError) {
          console.error('Erro ao criar venda:', saleError);
          throw saleError;
        }

        // Criar item genérico
        await from('sale_items').insert({
          sale_id: newSale.id,
          produto_nome: saleOrigin === 'PDV' ? `Vendas do dia ${venda.dataFormatada}` : `OS do dia ${venda.dataFormatada}`,
          produto_tipo: 'produto',
          quantidade: 1,
          valor_unitario: venda.venda,
          desconto: 0,
          valor_total: venda.venda,
          observacao: `Custo: ${currencyFormatters.brl(venda.custo)} | Lucro: ${currencyFormatters.brl(venda.lucro)}`,
        });

        // Criar pagamento genérico (dinheiro)
        await from('payments').insert({
          sale_id: newSale.id,
          forma_pagamento: 'dinheiro',
          valor: venda.venda,
          troco: 0,
          status: 'confirmed',
          confirmed_at: `${venda.data}T12:00:00Z`,
        });

        numeroAtual++;
        importados++;
        setImportProgress(Math.round((importados / vendasParsed.length) * 100));
      }

      toast({
        title: 'Importação concluída!',
        description: `${importados} vendas foram importadas com sucesso.`,
      });

      // Reset e fechar
      setTexto('');
      setVendasParsed([]);
      setStep('input');
      setImportProgress(0);
      onOpenChange(false);
      onSuccess?.();

    } catch (error) {
      console.error('Erro na importação:', error);
      toast({
        title: 'Erro na importação',
        description: 'Ocorreu um erro ao importar as vendas. Verifique o console.',
        variant: 'destructive',
      });
      setStep('preview');
    } finally {
      setIsImporting(false);
    }
  };

  // Reset ao fechar
  const handleClose = (open: boolean) => {
    if (!open && !isImporting) {
      setTexto('');
      setVendasParsed([]);
      setStep('input');
      setImportProgress(0);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Vendas Retroativas
          </DialogTitle>
          <DialogDescription>
            Cole o relatório de vendas agrupado por data para importar vendas de períodos anteriores.
          </DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-4 flex-1 overflow-auto">
            <div className="space-y-2">
              <Label>Origem das Vendas</Label>
              <Select value={saleOrigin} onValueChange={(value: 'PDV' | 'OS') => setSaleOrigin(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PDV">PDV - Ponto de Venda</SelectItem>
                  <SelectItem value="OS">OS - Ordem de Serviço</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Selecione se as vendas são do PDV ou de Ordens de Serviço
              </p>
            </div>

            <div className="space-y-2">
              <Label>Observação da Importação</Label>
              <Input
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex: Importação do sistema anterior"
              />
            </div>

            <div className="space-y-2">
              <Label>Cole o texto do relatório (formato: DATA CUSTO VENDA LUCRO)</Label>
              <Textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={`Exemplo:
01/12/2025 1.158,90 3.112,00 1.953,10
02/12/2025 650,00 1.996,00 1.346,00
03/12/2025 616,90 1.790,50 1.173,60`}
                className="min-h-[300px] font-mono text-sm"
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-800">Formato esperado:</p>
                  <p className="text-blue-700">DD/MM/YYYY [valor custo] [valor venda] [lucro líquido]</p>
                  <p className="text-blue-600 mt-1">Use vírgula como separador decimal (ex: 1.234,56)</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">
                  {vendasParsed.length} vendas encontradas
                </span>
                <span className="text-xs text-muted-foreground">
                  Origem: <strong>{saleOrigin === 'PDV' ? 'Ponto de Venda (PDV)' : 'Ordem de Serviço (OS)'}</strong>
                </span>
              </div>
              <div className="flex gap-4 text-sm">
                <span>Custo: <strong className="text-red-600">{currencyFormatters.brl(totais.custo)}</strong></span>
                <span>Venda: <strong className="text-blue-600">{currencyFormatters.brl(totais.venda)}</strong></span>
                <span>Lucro: <strong className="text-green-600">{currencyFormatters.brl(totais.lucro)}</strong></span>
              </div>
            </div>

            <div className="flex-1 overflow-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[120px]">Data</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="text-right">Venda</TableHead>
                    <TableHead className="text-right">Lucro</TableHead>
                    <TableHead className="w-[60px] text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendasParsed.map((venda, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{venda.dataFormatada}</TableCell>
                      <TableCell className="text-right text-red-600">{currencyFormatters.brl(venda.custo)}</TableCell>
                      <TableCell className="text-right text-blue-600">{currencyFormatters.brl(venda.venda)}</TableCell>
                      <TableCell className="text-right text-green-600">{currencyFormatters.brl(venda.lucro)}</TableCell>
                      <TableCell className="text-center">
                        {venda.valido ? (
                          <Check className="h-4 w-4 text-green-600 mx-auto" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-600 mx-auto" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="flex-1 flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            <div className="text-center">
              <p className="text-lg font-medium">Importando vendas...</p>
              <p className="text-sm text-muted-foreground">{importProgress}% concluído</p>
            </div>
            <div className="w-64 bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${importProgress}%` }}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'input' && (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancelar
              </Button>
              <Button onClick={handleParsear} disabled={!texto.trim()}>
                <FileText className="h-4 w-4 mr-2" />
                Analisar Texto
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('input')}>
                Voltar
              </Button>
              <Button onClick={handleImportar} className="bg-green-600 hover:bg-green-700">
                <Upload className="h-4 w-4 mr-2" />
                Importar {vendasParsed.length} Vendas
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

