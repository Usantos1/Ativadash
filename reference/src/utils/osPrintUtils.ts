// ============================================
// UTILITÁRIOS DE IMPRESSÃO DE OS
// ============================================

import { generateOSTermica } from './osTermicaGenerator';
import { printViaIframe, updatePrintStatus } from './printUtils';
import { from } from '@/integrations/db/client';

const CLIENTE_PRINT_FIELDS =
  'id,nome,cpf_cnpj,logradouro,numero,complemento,bairro,cidade,estado,uf,cep';

/**
 * Busca cliente no banco para CPF/endereço na impressão (cache do formulário costuma vazio na 1ª impressão).
 */
export async function resolveClienteForOsPrint(
  clienteId: string | null | undefined,
  hint?: any
): Promise<any | null> {
  if (!clienteId) return hint || null;
  try {
    const res = await from('clientes').select(CLIENTE_PRINT_FIELDS).eq('id', clienteId).limit(1).execute();
    const row = res.data && Array.isArray(res.data) && res.data.length > 0 ? res.data[0] : null;
    if (!row) return hint || null;
    return { ...hint, ...row };
  } catch {
    return hint || null;
  }
}

function buildClienteEnderecoStr(cliente: any): string | null {
  if (!cliente) return null;
  const parts = [
    cliente.logradouro,
    cliente.numero,
    cliente.complemento,
    cliente.bairro,
    [cliente.cidade, cliente.estado || cliente.uf].filter(Boolean).join('/'),
    cliente.cep,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

export async function fetchPagamentosOsForTermica(
  osId: string | null | undefined
): Promise<{ tipo: string; forma: string; valor: number }[]> {
  if (!osId) return [];
  try {
    const payRes = await from('os_pagamentos')
      .select('valor, forma_pagamento, tipo, cancelled_at')
      .eq('ordem_servico_id', osId)
      .execute();
    const rows = (payRes.data || []) as any[];
    return rows
      .filter((p) => !p.cancelled_at)
      .map((p) => ({
        tipo: p.tipo === 'adiantamento' ? 'Adiantamento' : 'Pagamento',
        forma: String(p.forma_pagamento || '').trim() || '—',
        valor: Number(p.valor || 0),
      }));
  } catch {
    return [];
  }
}

/**
 * Imprime OS térmica em 2 vias (cliente + loja) usando iframe (sem abrir nova janela)
 */
export async function printOSTermicaDirect(
  os: any,
  cliente: any,
  marca: any,
  modelo: any,
  checklistEntradaConfig: any[],
  osImageReferenceUrl?: string | null
): Promise<void> {
  try {
    const clienteResolved = await resolveClienteForOsPrint(os?.cliente_id, cliente);

    const pagamentosOs = await fetchPagamentosOsForTermica(os?.id);

    // Buscar primeira foto de entrada
    const fotoEntrada = os.fotos_telegram_entrada?.[0];
    const fotoEntradaUrl = fotoEntrada 
      ? (typeof fotoEntrada === 'string' ? fotoEntrada : (fotoEntrada.url || fotoEntrada.thumbnailUrl))
      : undefined;

    const imagemReferenciaUrl = osImageReferenceUrl || null;
    const areasDefeito = os.areas_defeito || [];
    
    const clienteCpf = clienteResolved?.cpf_cnpj || null;
    const clienteEnderecoStr = buildClienteEnderecoStr(clienteResolved);

    // Parse checklist entrada
    const checklistEntradaMarcados = Array.isArray(os.checklist_entrada) 
      ? os.checklist_entrada 
      : (typeof os.checklist_entrada === 'string' ? JSON.parse(os.checklist_entrada || '[]') : []);

    // Gerar via do cliente (com checklist nas duas vias)
    const nomeCliente = clienteResolved?.nome || os.cliente_nome || 'Cliente';

    const htmlCliente = await generateOSTermica({
      os,
      clienteNome: nomeCliente,
      clienteCpf,
      clienteEndereco: clienteEnderecoStr,
      marcaNome: marca?.nome || os.marca_nome,
      modeloNome: modelo?.nome || os.modelo_nome,
      checklistEntrada: checklistEntradaConfig,
      checklistEntradaMarcados,
      fotoEntradaUrl,
      imagemReferenciaUrl,
      areasDefeito,
      via: 'cliente',
      omitirChecklist: false,
      pagamentosOs,
    });

    // Gerar via da loja (com checklist nas duas vias)
    const htmlLoja = await generateOSTermica({
      os,
      clienteNome: nomeCliente,
      clienteCpf,
      clienteEndereco: clienteEnderecoStr,
      marcaNome: marca?.nome || os.marca_nome,
      modeloNome: modelo?.nome || os.modelo_nome,
      checklistEntrada: checklistEntradaConfig,
      checklistEntradaMarcados,
      fotoEntradaUrl,
      imagemReferenciaUrl,
      areasDefeito,
      via: 'loja',
      omitirChecklist: false,
      pagamentosOs,
    });

    // Imprimir primeira via (cliente)
    console.log('[IMPRESSÃO OS] Iniciando impressão da primeira via (cliente)');
    await printViaIframe(htmlCliente);
    console.log('[IMPRESSÃO OS] Primeira via impressa');

    // Aguardar 3 segundos antes de imprimir segunda via
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Imprimir segunda via (loja)
    console.log('[IMPRESSÃO OS] Iniciando impressão da segunda via (loja)');
    await printViaIframe(htmlLoja);
    console.log('[IMPRESSÃO OS] Segunda via impressa com sucesso');

    // Atualizar campos de impressão no banco (sucesso)
    await updatePrintStatus('ordens_servico', os.id, true);
  } catch (error) {
    console.error('[IMPRESSÃO OS] Erro ao imprimir:', error);
    // Atualizar campos de impressão no banco (erro)
    if (os?.id) {
      await updatePrintStatus('ordens_servico', os.id, false).catch(() => {});
    }
    throw error;
  }
}
