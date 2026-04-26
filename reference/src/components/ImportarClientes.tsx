import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { authAPI } from '@/integrations/auth/api-client';
import { toast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

interface ClientePlanilha {
  ID?: number | string;
  'Nome/Fantasia'?: string;
  Nome?: string;
  'CPF/CNPJ'?: string;
  CPF?: string;
  CNPJ?: string;
  'Telefone 1'?: string;
  Telefone?: string;
  'Telefone 2'?: string;
  WhatsApp?: string;
  Whatsapp?: string;
  Celular?: string;
  Logradouro?: string;
  Endereco?: string;
  Endereço?: string;
  'Número'?: string | number;
  Numero?: string | number;
  Complemento?: string;
  Bairro?: string;
  CEP?: string;
  Cidade?: string;
  Estado?: string;
  UF?: string;
}

interface ImportarClientesProps {
  onClose?: () => void;
  onSuccess?: () => void;
}

export function ImportarClientes({ onClose, onSuccess }: ImportarClientesProps) {
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

  const processarPlanilha = async (file: File): Promise<ClientePlanilha[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json<ClientePlanilha>(firstSheet);
          
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
    if (!file) {
      toast({
        title: 'Arquivo não selecionado',
        description: 'Por favor, selecione um arquivo Excel para importar',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setResultado(null);

    try {
      const clientesPlanilha = await processarPlanilha(file);
      
      if (clientesPlanilha.length === 0) {
        toast({
          title: 'Planilha vazia',
          description: 'A planilha não contém dados',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      console.log('[ImportarClientes] Primeiro cliente da planilha:', clientesPlanilha[0]);
      console.log('[ImportarClientes] Chaves:', Object.keys(clientesPlanilha[0] || {}));

      // Mapear para formato da API
      const clientesMapeados = clientesPlanilha.map((cliente, index) => {
        const nome = cliente['Nome/Fantasia'] || cliente.Nome || '';
        const cpfCnpj = cliente['CPF/CNPJ'] || cliente.CPF || cliente.CNPJ || '';
        const telefone1 = cliente['Telefone 1'] || cliente.Telefone || '';
        const telefone2 = cliente['Telefone 2'] || '';
        const whatsapp = cliente.WhatsApp || cliente.Whatsapp || cliente.Celular || '';
        const endereco = cliente.Logradouro || cliente.Endereco || cliente.Endereço || '';
        const numero = cliente['Número'] || cliente.Numero || '';
        const complemento = cliente.Complemento || '';
        const bairro = cliente.Bairro || '';
        const cep = cliente.CEP || '';
        const cidade = cliente.Cidade || '';
        const estado = cliente.Estado || cliente.UF || '';
        const codigoOriginal = cliente.ID || null;

        // Detectar tipo de pessoa pelo tamanho do CPF/CNPJ
        const cpfCnpjLimpo = String(cpfCnpj).replace(/\D/g, '');
        const tipoPessoa = cpfCnpjLimpo.length > 11 ? 'juridica' : 'fisica';

        if (index < 3) {
          console.log(`[ImportarClientes] Cliente ${index}:`, { nome, cpfCnpj, telefone1, whatsapp, cidade });
        }

        return {
          codigo_original: codigoOriginal,
          nome: nome.trim(),
          cpf_cnpj: cpfCnpj ? String(cpfCnpj).trim() : null,
          telefone: telefone1 ? String(telefone1).trim() : null,
          telefone2: telefone2 ? String(telefone2).trim() : null,
          whatsapp: whatsapp ? String(whatsapp).trim() : null,
          endereco: endereco ? String(endereco).trim() : null,
          numero: numero ? String(numero).trim() : null,
          complemento: complemento ? String(complemento).trim() : null,
          bairro: bairro ? String(bairro).trim() : null,
          cep: cep ? String(cep).trim() : null,
          cidade: cidade ? String(cidade).trim() : null,
          estado: estado ? String(estado).trim() : null,
          tipo_pessoa: tipoPessoa,
        };
      });

      // Filtrar clientes sem nome
      const clientesFiltrados = clientesMapeados.filter(c => c.nome && c.nome.trim() !== '');
      
      if (clientesFiltrados.length === 0) {
        toast({
          title: 'Nenhum cliente válido',
          description: 'A planilha não contém clientes com nome válido',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      console.log('[ImportarClientes] Clientes válidos:', clientesFiltrados.length);

      // Verificar autenticação
      const { data: { session } } = await authAPI.getSession();
      if (!session) {
        throw new Error('Usuário não autenticado');
      }

      // Processar em lotes
      const batchSize = 500;
      let totalInseridos = 0;
      let totalAtualizados = 0;
      let totalErros = 0;
      let totalInvalidos = 0;
      const errosDetalhes: string[] = [];
      const totalBatches = Math.ceil(clientesFiltrados.length / batchSize);

      setProgresso({ atual: 0, total: clientesFiltrados.length, lote: 0, totalLotes: totalBatches });

      for (let i = 0; i < clientesFiltrados.length; i += batchSize) {
        const batch = clientesFiltrados.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;

        console.log(`[ImportarClientes] Processando lote ${batchNum}/${totalBatches} (${batch.length} clientes)`);

        const requestBody = {
          clientes: batch,
          opcoes: {
            skipDuplicates,
            updateExisting,
          },
        };

        const API_URL = import.meta.env.VITE_API_URL || 'https://api.ativafix.com/api';
        const response = await fetch(`${API_URL}/functions/import-clientes`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify(requestBody),
        });

        const data = await response.json();
        console.log(`[ImportarClientes] Resposta do lote ${batchNum}:`, data);

        if (data.error) {
          console.error(`[ImportarClientes] Erro no lote ${batchNum}:`, data.error);
          errosDetalhes.push(`Lote ${batchNum}: ${data.error}`);
          totalErros += batch.length;
        } else {
          totalInseridos += data.inseridos || 0;
          totalAtualizados += data.atualizados || 0;
          totalErros += data.erros || 0;
          totalInvalidos += data.invalidos || 0;
          if (data.errosDetalhes) {
            errosDetalhes.push(...data.errosDetalhes.map((e: string) => `Lote ${batchNum}: ${e}`));
          }
        }

        setProgresso({
          atual: Math.min(i + batch.length, clientesFiltrados.length),
          total: clientesFiltrados.length,
          lote: batchNum,
          totalLotes: totalBatches,
        });
      }

      setResultado({
        total: clientesFiltrados.length,
        validos: clientesFiltrados.length,
        invalidos: totalInvalidos,
        inseridos: totalInseridos,
        atualizados: totalAtualizados,
        erros: totalErros,
        errosDetalhes: errosDetalhes.slice(0, 20),
      });

      if (totalInseridos > 0 || totalAtualizados > 0) {
        toast({
          title: 'Importação concluída',
          description: `${totalInseridos} inseridos, ${totalAtualizados} atualizados`,
        });
        onSuccess?.();
      }

    } catch (error: any) {
      console.error('[ImportarClientes] Erro:', error);
      toast({
        title: 'Erro na importação',
        description: error.message || 'Erro ao processar arquivo',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setProgresso(null);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Importar Clientes em Massa
        </CardTitle>
        <CardDescription>
          Importe clientes de uma planilha Excel (.xlsx ou .xls)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload de arquivo */}
        <div className="space-y-2">
          <Label>Arquivo Excel</Label>
          <div className="flex items-center gap-3">
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="flex-1"
            />
            {file && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm">{file.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Opções */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="skipDuplicates"
              checked={skipDuplicates}
              onCheckedChange={(checked) => setSkipDuplicates(checked as boolean)}
            />
            <Label htmlFor="skipDuplicates" className="cursor-pointer">
              Ignorar clientes duplicados (pular se CPF/CNPJ já existir)
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="updateExisting"
              checked={updateExisting}
              onCheckedChange={(checked) => setUpdateExisting(checked as boolean)}
            />
            <Label htmlFor="updateExisting" className="cursor-pointer">
              Atualizar clientes existentes (sobrescrever se CPF/CNPJ já existir)
            </Label>
          </div>
        </div>

        {/* Botão de importar */}
        <Button
          onClick={handleImport}
          disabled={!file || loading}
          className="w-full gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {progresso
                ? `Processando lote ${progresso.lote}/${progresso.totalLotes}...`
                : 'Processando...'}
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Importar Clientes
            </>
          )}
        </Button>

        {/* Resultado */}
        {resultado && (
          <div className={`p-4 rounded-lg ${resultado.erros > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
            <div className="flex items-center gap-2 mb-3">
              {resultado.erros > 0 ? (
                <AlertCircle className="h-5 w-5 text-yellow-600" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              )}
              <span className="font-medium">Resultado da Importação</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Total: <strong>{resultado.total}</strong></div>
              <div>Válidos: <strong className="text-green-600">{resultado.validos}</strong></div>
              <div>Inválidos: <strong className="text-red-600">{resultado.invalidos}</strong></div>
              <div>Inseridos: <strong className="text-blue-600">{resultado.inseridos}</strong></div>
              {resultado.atualizados > 0 && (
                <div>Atualizados: <strong className="text-orange-600">{resultado.atualizados}</strong></div>
              )}
              {resultado.erros > 0 && (
                <div>Erros: <strong className="text-red-600">{resultado.erros}</strong></div>
              )}
            </div>
            {resultado.errosDetalhes?.length > 0 && (
              <div className="mt-3 text-xs text-red-600">
                <div className="font-medium mb-1">Detalhes dos erros:</div>
                <ul className="list-disc list-inside max-h-32 overflow-y-auto">
                  {resultado.errosDetalhes.map((erro: string, i: number) => (
                    <li key={i}>{erro}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Formato esperado */}
        <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
          <div className="font-medium mb-2">Formato da Planilha:</div>
          <ul className="list-disc list-inside space-y-1">
            <li>Colunas esperadas: <strong>ID, Nome/Fantasia, CPF/CNPJ, Telefone 1, Telefone 2, WhatsApp, Logradouro, Número, Complemento, Bairro, CEP, Cidade, Estado</strong></li>
            <li>Coluna obrigatória: <strong>Nome/Fantasia</strong> (ou Nome)</li>
            <li>Colunas alternativas: Endereço (para Logradouro), Celular (para WhatsApp), UF (para Estado)</li>
            <li>O sistema detecta automaticamente se é Pessoa Física ou Jurídica pelo CPF/CNPJ</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

