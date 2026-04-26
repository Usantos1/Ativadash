import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { from } from '@/integrations/db/client';
import { authAPI } from '@/integrations/auth/api-client';
import { toast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

interface ProdutoPlanilha {
  Codigo?: number;
  'Código Barras'?: string;
  Descricao: string;
  Referencia?: string;
  Grupo?: string;
  'Sub Grupo'?: string;
  'VI Compra'?: number;
  'VI Custo'?: number;
  'VI Venda': number;
  Quantidade?: number;
  'Margem %'?: number;
}

export function ImportarProdutos() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [progresso, setProgresso] = useState<{ atual: number; total: number; lote: number; totalLotes: number } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (
        selectedFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        selectedFile.type === 'application/vnd.ms-excel' ||
        selectedFile.name.endsWith('.xlsx') ||
        selectedFile.name.endsWith('.xls')
      ) {
        setFile(selectedFile);
        setResultado(null);
      } else {
        toast({
          title: 'Arquivo inválido',
          description: 'Por favor, selecione um arquivo Excel (.xlsx ou .xls)',
          variant: 'destructive',
        });
      }
    }
  };

  const processarPlanilha = async (file: File): Promise<ProdutoPlanilha[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // Pegar a primeira planilha
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json<ProdutoPlanilha>(firstSheet);
          
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const handleImport = async () => {
    console.log('[ImportarProdutos] ========== BOTÃO CLICADO ==========');
    console.log('[ImportarProdutos] File:', file?.name);
    console.log('[ImportarProdutos] Loading:', loading);
    
    if (!file) {
      console.error('[ImportarProdutos] ERRO: Arquivo não selecionado');
      toast({
        title: 'Arquivo não selecionado',
        description: 'Por favor, selecione um arquivo Excel para importar',
        variant: 'destructive',
      });
      return;
    }

    console.log('[ImportarProdutos] Iniciando importação...');
    setLoading(true);
    setResultado(null);

    try {
      console.log('[ImportarProdutos] Processando planilha...');
      // Processar planilha
      const produtosPlanilha = await processarPlanilha(file);
      console.log('[ImportarProdutos] Planilha processada:', produtosPlanilha.length, 'linhas');
      
      if (produtosPlanilha.length === 0) {
        toast({
          title: 'Planilha vazia',
          description: 'A planilha não contém dados',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      console.log('[ImportarProdutos] Produtos da planilha:', produtosPlanilha.length);

      // Mapear para formato da API
      console.log('[ImportarProdutos] Iniciando mapeamento de produtos...');
      console.log('[ImportarProdutos] Primeiro produto da planilha (exemplo):', produtosPlanilha[0]);
      console.log('[ImportarProdutos] Chaves do primeiro produto:', Object.keys(produtosPlanilha[0] || {}));
      
      // Função auxiliar para converter string com vírgula para número
      const parseValor = (valor: any): number => {
        if (typeof valor === 'number') return valor;
        if (!valor) return 0;
        const str = String(valor).replace(/\./g, '').replace(',', '.');
        const num = parseFloat(str);
        return isNaN(num) ? 0 : num;
      };

      const produtosMapeados = produtosPlanilha.map((prod, index) => {
        const descricao = prod.Descricao || prod.descricao || prod['Descrição'] || '';
        const viVenda = parseValor(prod['VI Venda'] || prod['Vl Venda'] || prod.vi_venda || 0);
        const viCompra = parseValor(prod['VI Compra'] || prod['Vl Compra'] || prod.vi_compra || 0);
        const viCusto = parseValor(prod['VI Custo'] || prod['Vl Custo'] || prod.vi_custo || 0);
        const quantidade = parseValor(prod.Quantidade || prod.quantidade || 0);
        const margem = parseValor(prod['Margem %'] || prod.margem || 0);
        
        if (index < 3) {
          console.log(`[ImportarProdutos] Produto ${index} - Descricao original:`, descricao);
          console.log(`[ImportarProdutos] Produto ${index} - VI Venda original:`, prod['VI Venda'], '->', viVenda);
        }
        
        // Extrair codigo - verificar se existe (pode ser 0, então usar !== undefined)
        const codigoRaw = prod.Codigo !== undefined ? prod.Codigo : (prod.codigo !== undefined ? prod.codigo : null);
        const codigo = codigoRaw !== null && codigoRaw !== undefined ? Number(codigoRaw) : null;
        
        // Extrair referencia - verificar se existe
        const referenciaRaw = prod.Referencia !== undefined ? prod.Referencia : (prod.referencia !== undefined ? prod.referencia : null);
        const referencia = referenciaRaw !== null && referenciaRaw !== undefined && referenciaRaw !== '' ? String(referenciaRaw) : null;
        
        // Extrair codigo_barras
        const codigoBarrasRaw = prod['Código Barras'] !== undefined ? prod['Código Barras'] : (prod.codigo_barras !== undefined ? prod.codigo_barras : null);
        const codigo_barras = codigoBarrasRaw !== null && codigoBarrasRaw !== undefined && codigoBarrasRaw !== '' ? String(codigoBarrasRaw) : null;
        
        if (index < 3) {
          console.log(`[ImportarProdutos] Produto ${index} - Codigo raw:`, codigoRaw, '-> codigo:', codigo);
          console.log(`[ImportarProdutos] Produto ${index} - Referencia raw:`, referenciaRaw, '-> referencia:', referencia);
        }
        
        const produtoMapeado = {
          codigo: codigo,
          codigo_barras: codigo_barras,
          descricao: descricao,
          referencia: referencia,
          grupo: prod.Grupo || prod.grupo || null,
          sub_grupo: prod['Sub Grupo'] || prod.sub_grupo || null,
          vi_compra: viCompra,
          vi_custo: viCusto,
          vi_venda: viVenda,
          quantidade: Math.round(quantidade),
          margem: margem,
          // Campos diretos se existirem
          nome: descricao,
          valor_dinheiro_pix: viVenda,
          valor_parcelado_6x: viVenda ? viVenda * 1.2 : 0,
        };
        
        if (index < 3) {
          console.log(`[ImportarProdutos] Produto ${index} mapeado:`, produtoMapeado);
        }
        
        return produtoMapeado;
      });
      console.log('[ImportarProdutos] Produtos mapeados (antes do filtro):', produtosMapeados.length);
      
      // Verificar quantos têm descrição vazia
      const semDescricao = produtosMapeados.filter(prod => !prod.descricao || prod.descricao.trim() === '');
      console.log('[ImportarProdutos] Produtos SEM descrição:', semDescricao.length);
      if (semDescricao.length > 0 && semDescricao.length <= 5) {
        console.log('[ImportarProdutos] Exemplos de produtos sem descrição:', semDescricao);
      }
      
      const produtosFiltrados = produtosMapeados.filter(prod => prod.descricao && prod.descricao.trim() !== ''); // Filtrar produtos sem descrição
      console.log('[ImportarProdutos] Produtos após filtro:', produtosFiltrados.length);
      
      const produtosMapeadosFinal = produtosFiltrados;

      if (produtosMapeadosFinal.length === 0) {
        toast({
          title: 'Nenhum produto válido',
          description: 'A planilha não contém produtos com descrição válida',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      console.log('[ImportarProdutos] Produtos válidos após filtro:', produtosMapeadosFinal.length);
      console.log('[ImportarProdutos] Exemplo de produto mapeado:', produtosMapeadosFinal[0]);

      // Chamar Edge Function - processar em lotes de 500 para evitar payload muito grande
      console.log('[ImportarProdutos] Verificando autenticação...');
      const { data: { session }, error: sessionError } = await authAPI.getSession();
      console.log('[ImportarProdutos] Sessão obtida:', !!session, 'Erro:', sessionError);
      if (!session) {
        throw new Error('Usuário não autenticado');
      }

      console.log('[ImportarProdutos] Sessão válida, iniciando importação...');

      const batchSize = 500;
      let totalInseridos = 0;
      let totalAtualizados = 0;
      let totalErros = 0;
      let totalInvalidos = 0;
      const errosDetalhes: string[] = [];
      const totalBatches = Math.ceil(produtosMapeados.length / batchSize);

      console.log(`[ImportarProdutos] Total de lotes a processar: ${totalBatches}`);
      setProgresso({ atual: 0, total: produtosMapeados.length, lote: 0, totalLotes: totalBatches });

      console.log('[ImportarProdutos] Iniciando loop de lotes...');
      for (let i = 0; i < produtosMapeadosFinal.length; i += batchSize) {
        const batch = produtosMapeadosFinal.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;

        console.log(`[ImportarProdutos] Processando lote ${batchNum}/${totalBatches} (${batch.length} produtos)`);
        console.log(`[ImportarProdutos] Primeiro produto do lote:`, batch[0]);
        
        // Atualizar progresso
        setProgresso({ 
          atual: Math.min(i + batch.length, produtosMapeados.length), 
          total: produtosMapeados.length, 
          lote: batchNum, 
          totalLotes: totalBatches 
        });

        try {
          console.log(`[ImportarProdutos] Chamando Edge Function para lote ${batchNum}...`);
          console.log(`[ImportarProdutos] Tamanho do batch: ${batch.length} produtos`);
          console.log(`[ImportarProdutos] Primeiro produto:`, JSON.stringify(batch[0]));
          
          // Serializar o body manualmente para garantir que está correto
          const requestBody = {
            produtos: batch,
            opcoes: {
              skipDuplicates,
              updateExisting,
            },
          };
          
          // Verificar tamanho do JSON
          const jsonString = JSON.stringify(requestBody);
          console.log(`[ImportarProdutos] Tamanho do JSON: ${jsonString.length} caracteres`);
          console.log(`[ImportarProdutos] Tamanho do JSON: ${(jsonString.length / 1024).toFixed(2)} KB`);
          
          // Verificar se o JSON é válido
          try {
            JSON.parse(jsonString);
            console.log(`[ImportarProdutos] JSON válido`);
          } catch (jsonError) {
            console.error(`[ImportarProdutos] ERRO: JSON inválido!`, jsonError);
            throw jsonError;
          }
          
          // 🚫 Supabase Functions removido - usar API direta
      const API_URL = import.meta.env.VITE_API_URL || 'https://api.ativafix.com/api';
      const response = await fetch(`${API_URL}/functions/${'import-produtos'}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Erro na requisição' }));
        throw new Error(error.error || 'Erro na requisição');
      }
      
      const data = await response.json();
      const error = null;
          
          console.log(`[ImportarProdutos] Edge Function respondeu para lote ${batchNum}`);

          console.log(`[ImportarProdutos] Resposta do lote ${batchNum}:`, { data, error });

          if (error) {
            console.error(`[ImportarProdutos] Erro no lote ${batchNum}:`, error);
            errosDetalhes.push(`Lote ${batchNum}: ${error.message || JSON.stringify(error)}`);
            totalErros += batch.length;
            continue;
          }

          if (data && data.success) {
            console.log(`[ImportarProdutos] Lote ${batchNum} processado com sucesso:`, data.resultado);
            totalInseridos += data.resultado?.inseridos || 0;
            totalAtualizados += data.resultado?.atualizados || 0;
            totalErros += data.resultado?.erros || 0;
            totalInvalidos += data.resultado?.invalidos || 0;
            
            if (data.resultado?.erros_detalhes) {
              errosDetalhes.push(...data.resultado.erros_detalhes.map((e: string) => `Lote ${batchNum}: ${e}`));
            }
          } else {
            console.error(`[ImportarProdutos] Lote ${batchNum} falhou:`, data);
            throw new Error(data?.error || 'Erro na importação');
          }
        } catch (error: any) {
          console.error(`[ImportarProdutos] Erro no lote ${batchNum}:`, error);
          errosDetalhes.push(`Lote ${batchNum}: ${error.message || JSON.stringify(error)}`);
          totalErros += batch.length;
        }
      }

      console.log('[ImportarProdutos] Importação concluída:', {
        totalInseridos,
        totalAtualizados,
        totalErros,
        totalInvalidos,
      });
      
      // Produtos já estão salvos no Supabase, não precisa sincronizar localStorage
      
      // Limpar progresso
      setProgresso(null);

      // Resultado final
      setResultado({
        total: produtosPlanilha.length,
        validos: produtosMapeados.length,
        invalidos: totalInvalidos + (produtosPlanilha.length - produtosMapeados.length),
        inseridos: totalInseridos,
        atualizados: totalAtualizados,
        erros: totalErros,
        erros_detalhes: errosDetalhes.length > 0 ? errosDetalhes : undefined,
      });

      toast({
        title: 'Importação concluída!',
        description: `${totalInseridos + totalAtualizados} produtos processados com sucesso`,
        variant: 'default',
      });

    } catch (error: any) {
      console.error('[ImportarProdutos] Erro:', error);
      setProgresso(null);
      toast({
        title: 'Erro na importação',
        description: error.message || 'Erro ao processar a planilha. Verifique o console para mais detalhes.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setProgresso(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Importar Produtos em Massa
        </CardTitle>
        <CardDescription>
          Importe produtos de uma planilha Excel (.xlsx ou .xls)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload */}
        <div className="space-y-2">
          <Label htmlFor="file">Arquivo Excel</Label>
          <div className="flex items-center gap-4">
            <Input
              id="file"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              disabled={loading}
              className="flex-1"
            />
            {file && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                {file.name}
              </div>
            )}
          </div>
        </div>

        {/* Opções */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="skipDuplicates"
              checked={skipDuplicates}
              onCheckedChange={(checked) => setSkipDuplicates(checked === true)}
              disabled={loading || updateExisting}
            />
            <Label htmlFor="skipDuplicates" className="cursor-pointer">
              Ignorar produtos duplicados (pular se já existir)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="updateExisting"
              checked={updateExisting}
              onCheckedChange={(checked) => setUpdateExisting(checked === true)}
              disabled={loading || skipDuplicates}
            />
            <Label htmlFor="updateExisting" className="cursor-pointer">
              Atualizar produtos existentes (sobrescrever se já existir)
            </Label>
          </div>
        </div>

        {/* Botão Importar */}
        <Button
          onClick={(e) => {
            console.log('[ImportarProdutos] ========== BOTÃO CLICADO (onClick) ==========');
            console.log('[ImportarProdutos] Event:', e);
            console.log('[ImportarProdutos] File:', file);
            console.log('[ImportarProdutos] Loading:', loading);
            e.preventDefault();
            e.stopPropagation();
            handleImport();
          }}
          disabled={!file || loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {progresso ? `Importando... Lote ${progresso.lote}/${progresso.totalLotes}` : 'Importando...'}
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Importar Produtos
            </>
          )}
        </Button>

        {/* Barra de Progresso */}
        {progresso && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Processando lote {progresso.lote} de {progresso.totalLotes}</span>
              <span className="text-muted-foreground">{progresso.atual} de {progresso.total} produtos</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5">
              <div 
                className="bg-primary h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${(progresso.atual / progresso.total) * 100}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {Math.round((progresso.atual / progresso.total) * 100)}% concluído
            </p>
          </div>
        )}

        {/* Resultado */}
        {resultado && (
          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              {resultado.erros > 0 ? (
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              )}
              Resultado da Importação
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total:</span>{' '}
                <span className="font-medium">{resultado.total}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Válidos:</span>{' '}
                <span className="font-medium text-green-600">{resultado.validos}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Inválidos:</span>{' '}
                <span className="font-medium text-red-600">{resultado.invalidos}</span>
              </div>
              {resultado.inseridos > 0 && (
                <div>
                  <span className="text-muted-foreground">Inseridos:</span>{' '}
                  <span className="font-medium text-blue-600">{resultado.inseridos}</span>
                </div>
              )}
              {resultado.atualizados > 0 && (
                <div>
                  <span className="text-muted-foreground">Atualizados:</span>{' '}
                  <span className="font-medium text-blue-600">{resultado.atualizados}</span>
              </div>
              )}
              {resultado.erros > 0 && (
                <div>
                  <span className="text-muted-foreground">Erros:</span>{' '}
                  <span className="font-medium text-red-600">{resultado.erros}</span>
                </div>
              )}
            </div>
            {resultado.erros_detalhes && resultado.erros_detalhes.length > 0 && (
              <div className="mt-2 text-xs text-red-600">
                <div className="font-semibold">Detalhes dos erros:</div>
                <ul className="list-disc list-inside mt-1">
                  {resultado.erros_detalhes.map((erro: string, idx: number) => (
                    <li key={idx}>{erro}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Instruções */}
        <div className="rounded-lg bg-muted p-4 text-sm">
          <div className="font-semibold mb-2">Formato da Planilha:</div>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Colunas obrigatórias: <strong>Descrição</strong>, <strong>VI Venda</strong></li>
            <li>Colunas opcionais: Código, Código Barras, Referência, Grupo, Sub Grupo, VI Compra, VI Custo, Quantidade, Margem %</li>
            <li>O sistema tentará extrair marca e modelo da descrição automaticamente</li>
            <li>Valor parcelado 6x será calculado automaticamente (20% de acréscimo sobre o valor de venda)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

