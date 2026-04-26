import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, FileText, CheckCircle, AlertCircle, X, Edit } from 'lucide-react';
import { useClientesSupabase } from '@/hooks/useClientesSupabase';
import { useMarcasSupabase, useModelosSupabase } from '@/hooks/useMarcasModelosSupabase';
import { useOrdensServicoSupabase } from '@/hooks/useOrdensServicoSupabase';
import { StatusOS } from '@/types/assistencia';
import { toast } from '@/hooks/use-toast';

interface PDFImportData {
  numero_os?: string;
  data_entrada?: string;
  hora_entrada?: string;
  status?: string;
  previsao_entrega?: string;
  hora_previsao?: string;
  senha?: string;
  cliente_nome?: string;
  cliente_cpf_cnpj?: string;
  telefone_contato?: string;
  telefone?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  tipo_aparelho?: string;
  marca_nome?: string;
  modelo_nome?: string;
  imei?: string;
  numero_serie?: string;
  descricao_problema?: string;
  condicoes_equipamento?: string;
  possui_senha?: string;
  vendedor_nome?: string;
}

interface ImportarOSProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const STATUS_MAP: Record<string, StatusOS> = {
  'AGUARDANDO ORÇAMENTO/CONSERTO': 'aguardando_orcamento',
  'AGUARDANDO ORÇAMENTO': 'aguardando_orcamento',
  'AGUARDANDO CONSERTO': 'aguardando_orcamento',
  'ORÇAMENTO ENVIADO': 'orcamento_enviado',
  'APROVADO': 'aprovado',
  'EM ANDAMENTO': 'em_andamento',
  'AGUARDANDO PEÇA': 'aguardando_peca',
  'FINALIZADA': 'finalizada',
  'PRONTO AGUARDANDO RETIRADA': 'aguardando_retirada',
  'AGUARDANDO RETIRADA': 'aguardando_retirada',
  'ENTREGUE': 'entregue',
  'CANCELADA': 'cancelada',
};

function parsePDFText(texto: string): PDFImportData {
  const dados: PDFImportData = {};
  
  // Extrair número da OS
  const osMatch = texto.match(/OS Nº\s*(\d+)/i);
  if (osMatch) dados.numero_os = osMatch[1];
  
  // Extrair data
  const dataMatch = texto.match(/Data:\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (dataMatch) dados.data_entrada = dataMatch[1];
  
  // Extrair hora (pode ser HH:MM:SS ou HH:MM)
  const horaMatch1 = texto.match(/Data:\s*\d{2}\/\d{2}\/\d{4}\s+Hora:\s*(\d{2}:\d{2}:\d{2})/i);
  const horaMatch2 = texto.match(/Data:\s*\d{2}\/\d{2}\/\d{4}\s+Hora:\s*(\d{2}:\d{2})/i);
  if (horaMatch1) {
    dados.hora_entrada = horaMatch1[1];
  } else if (horaMatch2) {
    dados.hora_entrada = horaMatch2[1] + ':00';
  }
  
  // Extrair nome do cliente (parar antes de Contato: ou Telefone:)
  const clienteMatch = texto.match(/Cliente:\s*([^\n]+)/i);
  if (clienteMatch) {
    let nome = clienteMatch[1].trim();
    // Remover "Contato:" e "Telefone:" e tudo depois deles (incluindo números de telefone)
    nome = nome.replace(/Contato:\s*\([^)]*\)[^\s]*.*$/i, '').replace(/Telefone:\s*\([^)]*\)[^\s]*.*$/i, '').trim();
    // Remover padrões de telefone que possam ter ficado
    nome = nome.replace(/\(?\d{2}\)?\s*\d{4,5}[-.]?\d{4}.*$/i, '').trim();
    // Remover "Contato:" ou "Telefone:" se ainda estiver presente
    nome = nome.replace(/Contato:.*$/i, '').replace(/Telefone:.*$/i, '').trim();
    dados.cliente_nome = nome;
  }
  
  // Extrair CPF/CNPJ
  const cpfMatch = texto.match(/CPF\/CNPJ:\s*([\d.\-\/]+)/i);
  if (cpfMatch) dados.cliente_cpf_cnpj = cpfMatch[1];
  
  // Extrair telefone contato
  const contatoMatch = texto.match(/Contato:\s*\(([^)]+)\)([\d\-]+)/i);
  if (contatoMatch) {
    dados.telefone_contato = `(${contatoMatch[1]})${contatoMatch[2]}`;
  }
  
  // Extrair telefone
  const telefoneMatch = texto.match(/Telefone:\s*\(([^)]*)\)([^\n]*)/i);
  if (telefoneMatch && telefoneMatch[2].trim()) {
    dados.telefone = `(${telefoneMatch[1]})${telefoneMatch[2].trim()}`;
  }
  
  // Extrair endereço (parar antes de "Comp.:" ou "Bairro:")
  const enderecoMatch = texto.match(/Endereço:\s*([^\n]+?)(?:\s+Comp\.:|Bairro:|$)/i);
  if (enderecoMatch) {
    let enderecoCompleto = enderecoMatch[1].trim();
    // Remover "Comp.:" se estiver no final
    enderecoCompleto = enderecoCompleto.replace(/\s+Comp\.:.*$/i, '').trim();
    // Remover apenas "-" ou "- Comp.:"
    enderecoCompleto = enderecoCompleto.replace(/^-\s*Comp\.:?\s*$/i, '').trim();
    if (enderecoCompleto && enderecoCompleto !== '-') {
      // Tentar separar número e complemento
      const numeroMatch = enderecoCompleto.match(/(.+?)\s*-\s*(\d+)/);
      if (numeroMatch) {
        dados.endereco = numeroMatch[1].trim();
        dados.numero = numeroMatch[2];
      } else {
        dados.endereco = enderecoCompleto;
      }
    }
  }
  
  // Extrair complemento
  const compMatch = texto.match(/Comp\.:\s*([^\n]+)/i);
  if (compMatch) dados.complemento = compMatch[1].trim();
  
  // Extrair bairro
  const bairroMatch = texto.match(/Bairro:\s*([^\n]+)/i);
  if (bairroMatch) dados.bairro = bairroMatch[1].trim();
  
  // Extrair cidade
  const cidadeMatch = texto.match(/Cidade:\s*([^\n\/]+)/i);
  if (cidadeMatch) {
    const cidadeCompleta = cidadeMatch[1].trim();
    const estadoMatch = cidadeCompleta.match(/(.+?)\s*\/\s*([A-Z]{2})/);
    if (estadoMatch) {
      dados.cidade = estadoMatch[1].trim();
      dados.estado = estadoMatch[2];
    } else {
      dados.cidade = cidadeCompleta;
    }
  }
  
  // Extrair CEP
  const cepMatch = texto.match(/CEP:\s*([\d\-]+)/i);
  if (cepMatch) dados.cep = cepMatch[1];
  
  // Extrair marca
  const marcaMatch = texto.match(/Marca:\s*([^\n]+)/i);
  if (marcaMatch) dados.marca_nome = marcaMatch[1].trim();
  
  // Extrair modelo (parar antes de "Marca:")
  const modeloMatch = texto.match(/Modelo:\s*([^\n]+?)(?:\s+Marca:|$)/i);
  if (modeloMatch) {
    let modelo = modeloMatch[1].trim();
    // Remover "Marca:" se estiver no final
    modelo = modelo.replace(/\s+Marca:.*$/i, '').trim();
    dados.modelo_nome = modelo;
  }
  
  // Extrair tipo de equipamento
  const equipamentoMatch = texto.match(/Equipamento:\s*([^\n]+)/i);
  if (equipamentoMatch) {
    const tipo = equipamentoMatch[1].trim().toLowerCase();
    dados.tipo_aparelho = tipo.includes('celular') ? 'celular' : tipo;
  }
  
  // Extrair IMEI (parar antes de "Condições" ou outros campos)
  const imeiMatch = texto.match(/IMEI:\s*([^\n]+?)(?:\s+Condições|Série:|$)/i);
  if (imeiMatch && imeiMatch[1].trim()) {
    let imei = imeiMatch[1].trim();
    // Remover textos inválidos
    if (!imei.toLowerCase().includes('condições') && !imei.toLowerCase().includes('serviço')) {
      dados.imei = imei;
    }
  }
  
  // Extrair série (parar antes de "IMEI:" ou outros campos)
  const serieMatch = texto.match(/Série:\s*([^\n]+?)(?:\s+IMEI:|Problema|$)/i);
  if (serieMatch && serieMatch[1].trim()) {
    let serie = serieMatch[1].trim();
    // Remover "IMEI:" se estiver no valor
    serie = serie.replace(/^IMEI:\s*/i, '').trim();
    if (serie && serie !== 'IMEI:') {
      dados.numero_serie = serie;
    }
  }
  
  // Extrair problema
  const problemaMatch = texto.match(/Problema Informado\s*\n([^\n]+)/i);
  if (problemaMatch) dados.descricao_problema = problemaMatch[1].trim();
  
  // Extrair status
  const statusMatch = texto.match(/Status da Ordem\s*:\s*([^\n]+)/i);
  if (statusMatch) dados.status = statusMatch[1].trim();
  
  // Extrair previsão de entrega
  const previsaoMatch = texto.match(/Previsão Entrega:\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (previsaoMatch) dados.previsao_entrega = previsaoMatch[1];
  
  // Extrair hora de previsão
  const horaPrevisaoMatch = texto.match(/Hora:\s*(\d{2}:\d{2})/i);
  if (horaPrevisaoMatch && !dados.hora_entrada) {
    dados.hora_previsao = horaPrevisaoMatch[1];
  }
  
  // Extrair condições do aparelho
  const condicoesMatch = texto.match(/Condições do Aparelho\s*\n([^\n]+)/i);
  if (condicoesMatch) dados.condicoes_equipamento = condicoesMatch[1].trim();
  
  // Extrair possui senha (pode aparecer em diferentes formatos)
  // Procura por "Possui Senha:" seguido de texto na mesma linha ou próxima linha
  const senhaMatch1 = texto.match(/Possui Senha:\s*([^\n]+)/i);
  const senhaMatch2 = texto.match(/Possui Senha\s*:\s*([^\n]+)/i);
  // Procura por "Possui Senha:" seguido de quebra de linha e depois o valor
  const senhaMatch3 = texto.match(/Possui Senha:\s*\n\s*([^\n]+)/i);
  const senhaMatch4 = texto.match(/NÃO SABE, VAI PASSAR DEPOIS/i);
  const senhaMatch5 = texto.match(/VAI PASSAR DEPOIS/i);
  
  if (senhaMatch1) {
    let valor = senhaMatch1[1].trim();
    // Remover "Possui Senha:" se estiver no valor extraído
    valor = valor.replace(/^Possui Senha:\s*/i, '').trim();
    // Se o valor está vazio ou só tem espaços, procurar na próxima linha
    if (!valor || valor.length === 0) {
      const nextLineMatch = texto.match(/Possui Senha:\s*\n\s*([^\n]+)/i);
      if (nextLineMatch) valor = nextLineMatch[1].trim();
    }
    dados.possui_senha = valor || undefined;
  } else if (senhaMatch2) {
    let valor = senhaMatch2[1].trim();
    valor = valor.replace(/^Possui Senha:\s*/i, '').trim();
    dados.possui_senha = valor || undefined;
  } else if (senhaMatch3) {
    dados.possui_senha = senhaMatch3[1].trim();
  } else if (senhaMatch4 || senhaMatch5) {
    dados.possui_senha = 'NÃO SABE, VAI PASSAR DEPOIS';
  }
  
  // Extrair vendedor
  const vendedorMatch = texto.match(/Vendedor:\s*([^\n]+)/i);
  if (vendedorMatch) dados.vendedor_nome = vendedorMatch[1].trim();
  
  // Extrair senha (número)
  const senhaNumMatch = texto.match(/Senha:\s*(\d+)/i);
  if (senhaNumMatch) dados.senha = senhaNumMatch[1];
  
  return dados;
}

function validarDados(dados: PDFImportData): { valido: boolean; erros: string[]; avisos: string[] } {
  const erros: string[] = [];
  const avisos: string[] = [];
  
  if (!dados.cliente_nome) erros.push('Nome do cliente é obrigatório');
  if (!dados.telefone_contato && !dados.telefone) erros.push('Telefone de contato é obrigatório');
  if (!dados.descricao_problema) erros.push('Descrição do problema é obrigatória');
  if (!dados.marca_nome) avisos.push('Marca não encontrada - será criada automaticamente');
  if (!dados.modelo_nome) avisos.push('Modelo não encontrado - será criado automaticamente');
  if (!dados.data_entrada) avisos.push('Data de entrada não encontrada - será usada a data atual');
  
  return {
    valido: erros.length === 0,
    erros,
    avisos,
  };
}

export function ImportarOS({ open, onOpenChange, onSuccess }: ImportarOSProps) {
  const [textoPDF, setTextoPDF] = useState('');
  const [dadosExtraidos, setDadosExtraidos] = useState<PDFImportData | null>(null);
  const [erros, setErros] = useState<string[]>([]);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [step, setStep] = useState<'input' | 'preview'>('input');
  
  const { clientes, createCliente } = useClientesSupabase();
  const { marcas, createMarca } = useMarcasSupabase();
  const { modelos, createModelo } = useModelosSupabase();
  const { createOS } = useOrdensServicoSupabase();
  
  const handleParse = () => {
    if (!textoPDF.trim()) {
      toast({
        title: 'Erro',
        description: 'Por favor, cole o texto do PDF',
        variant: 'destructive',
      });
      return;
    }
    
    const dados = parsePDFText(textoPDF);
    const validacao = validarDados(dados);
    
    setDadosExtraidos(dados);
    setErros(validacao.erros);
    setAvisos(validacao.avisos);
    setStep('preview');
  };
  
  const handleImport = async () => {
    if (!dadosExtraidos) return;
    
    setIsImporting(true);
    
    try {
      // 1. Buscar ou criar cliente
      let clienteId = '';
      const cpfLimpo = dadosExtraidos.cliente_cpf_cnpj?.replace(/\D/g, '');
      const telefoneLimpo = (dadosExtraidos.telefone_contato || dadosExtraidos.telefone)?.replace(/\D/g, '');
      
      // Buscar cliente existente
      const clienteExistente = clientes.find(c => {
        const cpfCliente = c.cpf_cnpj?.replace(/\D/g, '');
        const telCliente = c.telefone?.replace(/\D/g, '') || c.whatsapp?.replace(/\D/g, '');
        return (cpfLimpo && cpfCliente === cpfLimpo) || (telefoneLimpo && telCliente === telefoneLimpo);
      });
      
      if (clienteExistente) {
        clienteId = clienteExistente.id;
      } else {
        // Criar novo cliente
        const novoCliente = await createCliente({
          nome: dadosExtraidos.cliente_nome || '',
          cpf_cnpj: dadosExtraidos.cliente_cpf_cnpj || null,
          telefone: dadosExtraidos.telefone_contato || dadosExtraidos.telefone || null,
          whatsapp: dadosExtraidos.telefone_contato || dadosExtraidos.telefone || null,
          logradouro: dadosExtraidos.endereco || null,
          numero: dadosExtraidos.numero || null,
          complemento: dadosExtraidos.complemento || null,
          bairro: dadosExtraidos.bairro || null,
          cidade: dadosExtraidos.cidade || null,
          estado: dadosExtraidos.estado || null,
          cep: dadosExtraidos.cep || null,
        });
        clienteId = novoCliente.id;
      }
      
      // 2. Buscar ou criar marca
      let marcaId = '';
      const marcaExistente = marcas.find(m => 
        m.nome.toLowerCase() === dadosExtraidos.marca_nome?.toLowerCase()
      );
      
      if (marcaExistente) {
        marcaId = marcaExistente.id;
      } else if (dadosExtraidos.marca_nome) {
        const novaMarca = await createMarca(dadosExtraidos.marca_nome);
        marcaId = novaMarca.id;
      }
      
      // 3. Buscar ou criar modelo
      let modeloId = '';
      if (marcaId && dadosExtraidos.modelo_nome) {
        const modeloExistente = modelos.find(m => 
          m.marca_id === marcaId && 
          m.nome.toLowerCase() === dadosExtraidos.modelo_nome?.toLowerCase()
        );
        
        if (modeloExistente) {
          modeloId = modeloExistente.id;
        } else {
          const novoModelo = await createModelo(marcaId, dadosExtraidos.modelo_nome);
          modeloId = novoModelo.id;
        }
      }
      
      // 4. Mapear status
      const statusMapeado = dadosExtraidos.status 
        ? STATUS_MAP[dadosExtraidos.status.toUpperCase()] || 'aberta'
        : 'aberta';
      
      // 5. Processar data de entrada
      let dataEntrada = new Date().toISOString().split('T')[0];
      if (dadosExtraidos.data_entrada) {
        const [dia, mes, ano] = dadosExtraidos.data_entrada.split('/');
        dataEntrada = `${ano}-${mes}-${dia}`;
      }
      
      // 6. Processar previsão de entrega
      let previsaoEntrega: string | undefined = undefined;
      if (dadosExtraidos.previsao_entrega) {
        const [dia, mes, ano] = dadosExtraidos.previsao_entrega.split('/');
        previsaoEntrega = `${ano}-${mes}-${dia}`;
      }
      
      // 7. Processar possui senha
      const possuiSenhaTexto = dadosExtraidos.possui_senha?.toLowerCase() || '';
      let possuiSenha = false;
      let possuiSenhaTipo: string = 'nao';
      
      if (possuiSenhaTexto.includes('sim') || possuiSenhaTexto.includes('yes')) {
        possuiSenha = true;
        possuiSenhaTipo = 'sim';
      } else if (possuiSenhaTexto.includes('não sabe') || possuiSenhaTexto.includes('nao sabe') || possuiSenhaTexto.includes('vai passar')) {
        possuiSenha = true;
        possuiSenhaTipo = 'nao_sabe';
      } else if (possuiSenhaTexto.includes('não') || possuiSenhaTexto.includes('nao') || possuiSenhaTexto.includes('no')) {
        possuiSenha = false;
        possuiSenhaTipo = 'nao';
      } else if (possuiSenhaTexto.trim()) {
        // Se tem algum texto mas não identificamos, assumir que tem senha mas não sabe
        possuiSenha = true;
        possuiSenhaTipo = 'nao_sabe';
      }
      
      // 8. Criar OS com número exato do PDF
      const numeroOS = dadosExtraidos.numero_os ? parseInt(dadosExtraidos.numero_os) : undefined;
      
      await createOS({
        numero: numeroOS, // Usar número exato da OS do PDF
        status: statusMapeado, // Usar status mapeado do PDF
        cliente_id: clienteId,
        cliente_nome: dadosExtraidos.cliente_nome,
        telefone_contato: dadosExtraidos.telefone_contato || dadosExtraidos.telefone || '',
        tipo_aparelho: dadosExtraidos.tipo_aparelho || 'celular',
        marca_id: marcaId || undefined,
        marca_nome: dadosExtraidos.marca_nome || undefined,
        modelo_id: modeloId || undefined,
        modelo_nome: dadosExtraidos.modelo_nome || undefined,
        imei: dadosExtraidos.imei || undefined,
        numero_serie: dadosExtraidos.numero_serie || undefined,
        possui_senha: possuiSenha,
        possui_senha_tipo: possuiSenhaTipo,
        deixou_aparelho: true,
        apenas_agendamento: false,
        descricao_problema: dadosExtraidos.descricao_problema || '',
        condicoes_equipamento: dadosExtraidos.condicoes_equipamento || undefined,
        data_entrada: dataEntrada,
        hora_entrada: dadosExtraidos.hora_entrada || undefined,
        previsao_entrega: previsaoEntrega,
        hora_previsao: dadosExtraidos.hora_previsao || undefined,
        observacoes: undefined, // Não adicionar observação sobre OS antiga
        vendedor_nome: dadosExtraidos.vendedor_nome || undefined,
        senha_numerica: dadosExtraidos.senha || undefined,
        checklist_entrada: [],
        areas_defeito: [],
      });
      
      toast({
        title: 'Sucesso!',
        description: 'OS importada com sucesso!',
      });
      
      onOpenChange(false);
      setTextoPDF('');
      setDadosExtraidos(null);
      setErros([]);
      setAvisos([]);
      setStep('input');
      
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error('Erro ao importar OS:', error);
      toast({
        title: 'Erro ao importar',
        description: error.message || 'Ocorreu um erro ao importar a OS',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };
  
  const handleClose = () => {
    onOpenChange(false);
    setTextoPDF('');
    setDadosExtraidos(null);
    setErros([]);
    setAvisos([]);
    setStep('input');
  };
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Importar OS do PDF
          </DialogTitle>
          <DialogDescription>
            Cole o texto copiado do PDF abaixo. O sistema irá extrair automaticamente os dados.
          </DialogDescription>
        </DialogHeader>
        
        {step === 'input' && (
          <div className="space-y-4">
            <Textarea
              value={textoPDF}
              onChange={(e) => setTextoPDF(e.target.value)}
              placeholder="Cole aqui o texto completo do PDF da OS..."
              rows={15}
              className="font-mono text-sm"
            />
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={handleParse} disabled={!textoPDF.trim()}>
                Extrair Dados
              </Button>
            </div>
          </div>
        )}
        
        {step === 'preview' && dadosExtraidos && (
          <div className="space-y-4">
            <Alert className="bg-blue-50 border-blue-200">
              <Edit className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>Edite os dados se necessário</strong> antes de importar. Campos em branco serão ignorados.
              </AlertDescription>
            </Alert>

            {erros.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold mb-2">Erros encontrados:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {erros.map((erro, i) => (
                      <li key={i}>{erro}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            
            {avisos.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold mb-2">Avisos:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {avisos.map((aviso, i) => (
                      <li key={i}>{aviso}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Dados da OS */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Dados da OS
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Nº OS Original</Label>
                      <Input
                        value={dadosExtraidos.numero_os || ''}
                        onChange={(e) => setDadosExtraidos({...dadosExtraidos, numero_os: e.target.value})}
                        placeholder="Ex: 1234"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Status</Label>
                      <Input
                        value={dadosExtraidos.status || ''}
                        onChange={(e) => setDadosExtraidos({...dadosExtraidos, status: e.target.value})}
                        placeholder="Ex: ABERTA"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Data Entrada</Label>
                      <Input
                        value={dadosExtraidos.data_entrada || ''}
                        onChange={(e) => setDadosExtraidos({...dadosExtraidos, data_entrada: e.target.value})}
                        placeholder="dd/mm/aaaa"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Hora Entrada</Label>
                      <Input
                        value={dadosExtraidos.hora_entrada || ''}
                        onChange={(e) => setDadosExtraidos({...dadosExtraidos, hora_entrada: e.target.value})}
                        placeholder="HH:MM"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Previsão Entrega</Label>
                      <Input
                        value={dadosExtraidos.previsao_entrega || ''}
                        onChange={(e) => setDadosExtraidos({...dadosExtraidos, previsao_entrega: e.target.value})}
                        placeholder="dd/mm/aaaa"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Hora Previsão</Label>
                      <Input
                        value={dadosExtraidos.hora_previsao || ''}
                        onChange={(e) => setDadosExtraidos({...dadosExtraidos, hora_previsao: e.target.value})}
                        placeholder="HH:MM"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Cliente */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Cliente</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs">Nome do Cliente *</Label>
                    <Input
                      value={dadosExtraidos.cliente_nome || ''}
                      onChange={(e) => setDadosExtraidos({...dadosExtraidos, cliente_nome: e.target.value})}
                      placeholder="Nome completo"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">CPF/CNPJ</Label>
                      <Input
                        value={dadosExtraidos.cliente_cpf_cnpj || ''}
                        onChange={(e) => setDadosExtraidos({...dadosExtraidos, cliente_cpf_cnpj: e.target.value})}
                        placeholder="000.000.000-00"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Telefone *</Label>
                      <Input
                        value={dadosExtraidos.telefone_contato || dadosExtraidos.telefone || ''}
                        onChange={(e) => setDadosExtraidos({...dadosExtraidos, telefone_contato: e.target.value})}
                        placeholder="(19) 99999-9999"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Endereço</Label>
                    <Input
                      value={dadosExtraidos.endereco || ''}
                      onChange={(e) => setDadosExtraidos({...dadosExtraidos, endereco: e.target.value})}
                      placeholder="Rua, número"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Bairro</Label>
                      <Input
                        value={dadosExtraidos.bairro || ''}
                        onChange={(e) => setDadosExtraidos({...dadosExtraidos, bairro: e.target.value})}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Cidade/UF</Label>
                      <Input
                        value={dadosExtraidos.cidade ? `${dadosExtraidos.cidade}/${dadosExtraidos.estado || ''}` : ''}
                        onChange={(e) => {
                          const [cidade, estado] = e.target.value.split('/');
                          setDadosExtraidos({...dadosExtraidos, cidade, estado: estado || ''});
                        }}
                        placeholder="Campinas/SP"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Equipamento */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Equipamento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Marca</Label>
                      <Input
                        value={dadosExtraidos.marca_nome || ''}
                        onChange={(e) => setDadosExtraidos({...dadosExtraidos, marca_nome: e.target.value})}
                        placeholder="Ex: Apple, Samsung"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Modelo</Label>
                      <Input
                        value={dadosExtraidos.modelo_nome || ''}
                        onChange={(e) => setDadosExtraidos({...dadosExtraidos, modelo_nome: e.target.value})}
                        placeholder="Ex: iPhone 12, Galaxy S21"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">IMEI</Label>
                      <Input
                        value={dadosExtraidos.imei || ''}
                        onChange={(e) => setDadosExtraidos({...dadosExtraidos, imei: e.target.value})}
                        placeholder="15 dígitos"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Nº Série</Label>
                      <Input
                        value={dadosExtraidos.numero_serie || ''}
                        onChange={(e) => setDadosExtraidos({...dadosExtraidos, numero_serie: e.target.value})}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Problema e Senha */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Problema e Senha</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs">Descrição do Problema *</Label>
                    <Textarea
                      value={dadosExtraidos.descricao_problema || ''}
                      onChange={(e) => setDadosExtraidos({...dadosExtraidos, descricao_problema: e.target.value})}
                      placeholder="Descreva o problema"
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Condições do Equipamento</Label>
                    <Input
                      value={dadosExtraidos.condicoes_equipamento || ''}
                      onChange={(e) => setDadosExtraidos({...dadosExtraidos, condicoes_equipamento: e.target.value})}
                      placeholder="Ex: Tela trincada, arranhões"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Possui Senha?</Label>
                      <Select
                        value={dadosExtraidos.possui_senha?.toLowerCase().includes('sim') ? 'sim' : 
                               dadosExtraidos.possui_senha?.toLowerCase().includes('não sabe') || dadosExtraidos.possui_senha?.toLowerCase().includes('nao sabe') ? 'nao_sabe' : 
                               'nao'}
                        onValueChange={(v) => setDadosExtraidos({...dadosExtraidos, possui_senha: v === 'sim' ? 'SIM' : v === 'nao_sabe' ? 'NÃO SABE' : 'NÃO'})}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nao">Não</SelectItem>
                          <SelectItem value="sim">Sim</SelectItem>
                          <SelectItem value="nao_sabe">Não sabe / Vai passar depois</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Senha do Aparelho</Label>
                      <Input
                        value={dadosExtraidos.senha || ''}
                        onChange={(e) => setDadosExtraidos({...dadosExtraidos, senha: e.target.value})}
                        placeholder="Ex: 1234"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep('input')} disabled={isImporting}>
                Voltar
              </Button>
              <Button variant="outline" onClick={handleClose} disabled={isImporting}>
                Cancelar
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={!dadosExtraidos.cliente_nome || !dadosExtraidos.descricao_problema || isImporting}
                className="bg-gradient-to-r from-blue-500 to-indigo-500"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Importar OS
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

