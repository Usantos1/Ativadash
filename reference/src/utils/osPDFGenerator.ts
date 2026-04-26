import QRCode from 'qrcode';
import { APP_PUBLIC_URL } from '@/utils/appUrl';
import { OrdemServico } from '@/types/assistencia';
import { ChecklistConfigItem } from '@/hooks/useChecklistConfig';
import { dateFormatters, currencyFormatters } from '@/utils/formatters';
import { STATUS_OS_LABELS, StatusOS } from '@/types/assistencia';
import { patternToSvg, POSSUI_SENHA_LABELS } from '@/utils/osPatternLockSvg';

export interface OSPDFData {
  os: OrdemServico;
  clienteNome: string;
  clienteCpf?: string | null;
  clienteEndereco?: string | null;
  marcaNome?: string;
  modeloNome?: string;
  checklistEntrada: ChecklistConfigItem[];
  checklistEntradaMarcados: string[];
  fotoEntradaUrl?: string;
  imagemReferenciaUrl?: string;
  areasDefeito?: string[];
  via: 'cliente' | 'loja';
  formato: 'a4' | 'pdf';
}

export async function generateOSPDF(data: OSPDFData): Promise<string> {
  const { os, clienteNome, clienteCpf, clienteEndereco, marcaNome, modeloNome, checklistEntrada, checklistEntradaMarcados, imagemReferenciaUrl, areasDefeito } = data;
  const isVeiculo = os.tipo_aparelho === 'veiculo';
  const eqLabel = isVeiculo ? 'VEÍCULO' : 'EQUIPAMENTO';
  const placaOuImei = isVeiculo ? 'Placa' : 'IMEI';
  const condicoesTexto = isVeiculo ? 'Veículos não retirados' : 'Aparelhos não retirados';

  // Gerar QR Code
  let qrCodeImg = '';
  try {
    const qrCodeUrl = await QRCode.toDataURL(`${APP_PUBLIC_URL}/acompanhar-os/${os.id}`, {
      width: 100,
      margin: 1,
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 1.0,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
    });
    qrCodeImg = `<img src="${qrCodeUrl}" style="width: 65px; height: 65px; display: block; margin: 0 auto;" alt="QR Code" />`;
  } catch (error) {
    console.error('Erro ao gerar QR Code:', error);
  }

  // Formatar checklist de entrada - APENAS PROBLEMAS ENCONTRADOS (físicos)
  const checklistFisico = checklistEntrada
    .filter(item => item.categoria === 'fisico' && checklistEntradaMarcados.includes(item.item_id))
    .map(item => item.nome);

  // Dados formatados
  const dataEntrada = dateFormatters.short(os.data_entrada);
  const horaEntrada = os.hora_entrada || '-';
  const previsaoEntrega = os.previsao_entrega ? dateFormatters.short(os.previsao_entrega) : '-';
  const valorTotal = os.valor_total ? currencyFormatters.brl(os.valor_total) : '-';

  // Imagem de referência com defeitos
  let imagemReferenciaHtml = '';
  if (imagemReferenciaUrl) {
    const defectPoints = (areasDefeito || []).map(defect => {
      const parts = defect.split('-');
      if (parts.length >= 2) {
        return {
          x: parseFloat(parts[0]) || 0,
          y: parseFloat(parts[1]) || 0,
        };
      }
      return null;
    }).filter((d): d is { x: number; y: number } => d !== null);

    const defectMarkers = defectPoints.map(point => 
      `<circle cx="${point.x}" cy="${point.y}" r="1.8" fill="red" stroke="white" stroke-width="0.4" opacity="0.9" />`
    ).join('');

    imagemReferenciaHtml = `
      <div style="text-align: center;">
        <div style="font-weight: bold; font-size: 8px; margin-bottom: 1px;">Ref. ${isVeiculo ? 'Veículo' : 'Aparelho'}${defectPoints.length > 0 ? ` • ${defectPoints.length} defeitos` : ''}</div>
        <div style="position: relative; display: inline-block; max-width: 100%;">
          <img src="${imagemReferenciaUrl}" style="max-width: 100%; max-height: 80px; object-fit: contain; border: 1px solid #000; display: block;" alt="Ref" />
          ${defectMarkers ? `
            <svg style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1;" viewBox="0 0 100 100" preserveAspectRatio="none">
              ${defectMarkers}
            </svg>
          ` : ''}
        </div>
      </div>
    `;
  }

  // Senha do aparelho: label + texto e/ou desenho do padrão (igual térmica)
  let senhaHtml = '';
  if (os.possui_senha) {
    const tipo = (os.possui_senha_tipo || '').toLowerCase();
    const label = POSSUI_SENHA_LABELS[tipo] ?? (os.padrao_desbloqueio ? POSSUI_SENHA_LABELS.deslizar : POSSUI_SENHA_LABELS.sim);
    const ehPadraoDesenho = Boolean((os.padrao_desbloqueio && String(os.padrao_desbloqueio).trim()) || tipo === 'deslizar');
    const valorSenha = os.senha_aparelho || os.senha_numerica || '';
    const padraoVal = typeof os.padrao_desbloqueio === 'string' && os.padrao_desbloqueio.trim() ? os.padrao_desbloqueio : (Array.isArray(os.padrao_desbloqueio) && os.padrao_desbloqueio.length >= 2 ? os.padrao_desbloqueio : undefined);
    const patternSvg = patternToSvg(padraoVal, { size: 100 });
    // Não mostrar linha "Senha: ..." quando for "CLIENTE NÃO QUIS DEIXAR SENHA"
    const mostrarLinhaSenha = valorSenha && tipo !== 'nao_autorizou';
    senhaHtml = `
      <div style="font-size: 9px; margin-bottom: 2px;"><strong>Possui senha:</strong> ${label}</div>
      ${mostrarLinhaSenha ? `<div style="font-size: 8px; margin-bottom: 2px;">Senha: ${valorSenha}</div>` : ''}
      ${ehPadraoDesenho && patternSvg ? `<div style="margin-top: 2px;">${patternSvg}</div>` : ''}
    `;
  }

  // Orçamento pré-autorizado
  let orcamentoHtml = '';
  const valorDesconto = os.orcamento_desconto != null ? Number(os.orcamento_desconto) : 0;
  const valorParcelado = os.orcamento_parcelado != null ? Number(os.orcamento_parcelado) : 0;
  const temOrcamento = valorDesconto > 0 || valorParcelado > 0;
  
  if (temOrcamento || os.orcamento_autorizado === true) {
    const valorPix = valorDesconto > 0 ? currencyFormatters.brl(valorDesconto) : null;
    const valorCartao = valorParcelado > 0 ? currencyFormatters.brl(valorParcelado) : null;
    
    if (valorPix || valorCartao) {
      orcamentoHtml = `
        <div style="font-size: 8px; padding: 2px; border: 1px solid #000; background: #f0f0f0;">
          <div style="font-weight: bold; font-size: 9px; margin-bottom: 1px;">ORÇAMENTO PRÉ-AUTORIZADO</div>
          ${valorPix ? `<div>PIX/Dinheiro: <strong>${valorPix}</strong></div>` : ''}
          ${valorCartao ? `<div>Cartão (6x): <strong>${valorCartao}</strong></div>` : ''}
        </div>
      `;
    }
  }

  const telefoneLoja = '(19) 98768-0453';

  // Função para gerar uma via em formato de tabela compacta
  const gerarVia = (viaLabel: string) => `
    <div style="width: 100%; padding: 2mm; box-sizing: border-box; border: 1px solid #000; margin-bottom: 2mm;">
      <!-- Header -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 1.5mm;">
        <tr>
          <td style="text-align: center; border-bottom: 1px solid #000; padding: 2px 0;">
            <div style="font-weight: bold; font-size: 11px;">PRIME CAMP ASSISTÊNCIA TÉCNICA</div>
            <div style="font-size: 8px;">CNPJ: 31.833.574/0001-74 | Tel: ${telefoneLoja}</div>
            <div style="font-weight: bold; font-size: 10px; margin-top: 1px;">ORDEM DE SERVIÇO #${os.numero} - ${viaLabel}</div>
          </td>
        </tr>
      </table>

      <!-- Dados principais em grid -->
      <table style="width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 1.5mm;">
        <tr>
          <td style="padding: 2px 3px; border: 1px solid #000; width: 25%;"><strong>Data:</strong> ${dataEntrada}</td>
          <td style="padding: 2px 3px; border: 1px solid #000; width: 25%;"><strong>Hora:</strong> ${horaEntrada}</td>
          <td style="padding: 2px 3px; border: 1px solid #000; width: 25%;"><strong>Status:</strong> ${STATUS_OS_LABELS[os.status as StatusOS] || os.status || '-'}</td>
          <td style="padding: 2px 3px; border: 1px solid #000; width: 25%;"><strong>Previsão:</strong> ${previsaoEntrega}</td>
        </tr>
        <tr>
          <td colspan="4" style="padding: 2px 3px; border: 1px solid #000; font-size: 9px;"><strong>Vendedor(a):</strong> ${os.vendedor_nome || os.atendente_nome || '-'}</td>
        </tr>
      </table>

      <!-- Cliente e Equipamento lado a lado -->
      <table style="width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 1.5mm;">
        <tr>
          <td style="padding: 2px 3px; border: 1px solid #000; width: 50%; vertical-align: top;">
            <div style="font-weight: bold; font-size: 10px; margin-bottom: 1px;">CLIENTE</div>
            <div style="font-size: 9px;">${clienteNome}</div>
            <div style="font-size: 8px;">Tel: ${os.telefone_contato || '-'}</div>
            <div style="font-size: 8px;">CPF/CNPJ: ${clienteCpf || '—'}</div>
            <div style="font-size: 7px;">End: ${clienteEndereco || '—'}</div>
          </td>
          <td style="padding: 2px 3px; border: 1px solid #000; width: 50%; vertical-align: top;">
            <div style="font-weight: bold; font-size: 10px; margin-bottom: 1px;">${eqLabel}</div>
            <div style="font-size: 9px;">${os.tipo_aparelho || '-'} ${marcaNome || os.marca_nome || ''} ${modeloNome || os.modelo_nome || ''}</div>
            ${os.imei ? `<div style="font-size: 8px;">${placaOuImei}: ${os.imei}</div>` : ''}
            ${os.numero_serie ? `<div style="font-size: 8px;">Série: ${os.numero_serie}</div>` : ''}
            ${os.cor ? `<div style="font-size: 8px;">Cor: <strong>${os.cor}</strong></div>` : ''}
          </td>
        </tr>
      </table>

      <!-- Problema e Senha lado a lado -->
      <table style="width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 1.5mm;">
        <tr>
          <td style="padding: 2px 3px; border: 1px solid #000; width: 70%; vertical-align: top;">
            <div style="font-weight: bold; font-size: 10px; margin-bottom: 1px;">PROBLEMA INFORMADO</div>
            <div style="font-size: 9px;">${os.descricao_problema || '-'}</div>
          </td>
          <td style="padding: 2px 3px; border: 1px solid #000; width: 30%; vertical-align: top;">
            <div style="font-weight: bold; font-size: 10px; margin-bottom: 1px;">SENHA</div>
            ${senhaHtml || '<div style="font-size: 8px; color: #999;">Não informada</div>'}
          </td>
        </tr>
      </table>

      <!-- Checklist - APENAS PROBLEMAS ENCONTRADOS -->
      <table style="width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 1.5mm;">
        <tr>
          <td style="padding: 2px 3px; border: 1px solid #000; width: 50%; vertical-align: top;">
            ${checklistFisico.length > 0 ? `
              <div style="font-weight: bold; font-size: 10px; color: #dc2626; margin-bottom: 1px;">PROBLEMAS ENCONTRADOS</div>
              <div style="font-size: 8px; line-height: 1.2;">
                ${checklistFisico.map(item => `<div>✓ ${item}</div>`).join('')}
              </div>
            ` : '<div style="font-size: 8px; color: #999;">Nenhum problema encontrado</div>'}
          </td>
          <td style="padding: 2px 3px; border: 1px solid #000; width: 50%; vertical-align: top;">
            ${imagemReferenciaHtml ? `
              <div>
                ${imagemReferenciaHtml}
              </div>
            ` : '<div style="font-size: 8px; color: #999;">-</div>'}
          </td>
        </tr>
        ${os.observacoes_checklist ? `
        <tr>
          <td colspan="2" style="padding: 2px 3px; border: 1px solid #000; font-size: 8px;">
            <strong>Observações:</strong> ${os.observacoes_checklist}
          </td>
        </tr>
        ` : ''}
      </table>

      <!-- Informações e Orçamento lado a lado -->
      <table style="width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 1.5mm;">
        <tr>
          <td style="padding: 2px 3px; border: 1px solid #000; width: 50%; vertical-align: top;">
            <div style="font-weight: bold; font-size: 10px; margin-bottom: 1px;">INFORMAÇÕES</div>
            <div style="font-size: 9px;">Previsão: ${previsaoEntrega}</div>
            ${os.valor_total ? `<div style="font-size: 9px; margin-top: 1px;">Valor Total: <strong>${valorTotal}</strong></div>` : ''}
          </td>
          <td style="padding: 2px 3px; border: 1px solid #000; width: 50%; vertical-align: top;">
            ${orcamentoHtml || '<div style="font-size: 8px; color: #999;">Sem orçamento</div>'}
          </td>
        </tr>
      </table>

      <!-- Condições de Serviço e QR Code lado a lado -->
      <table style="width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 1.5mm;">
        <tr>
          <td style="padding: 2px 3px; border: 1px solid #000; width: ${qrCodeImg ? '75%' : '100%'}; vertical-align: top;">
            <div style="font-weight: bold; font-size: 10px; margin-bottom: 1px;">CONDIÇÕES DE SERVIÇO</div>
            <div style="font-size: 8px; line-height: 1.2;">
              <div>1. Garantia de 90 dias em peças usadas.</div>
              <div>2. Não trocamos peças por mal uso.</div>
              <div>3. Apresente este comprovante para retirada.</div>
              <div>4. Informe o número da OS ao ligar.</div>
              <div>5. ${condicoesTexto} em 30 dias terão taxa de 6% ao mês.</div>
              <div>6. ${condicoesTexto} em 90 dias serão descartados.</div>
            </div>
          </td>
          ${qrCodeImg ? `
          <td style="padding: 2px; border: 1px solid #000; width: 25%; text-align: center; vertical-align: middle;">
            ${qrCodeImg}
            <div style="font-size: 8px; margin-top: 2px; font-weight: bold;">Escaneie o QR Code</div>
            <div style="font-size: 7px; margin-top: 1px;">para acompanhar o status da OS online</div>
          </td>
          ` : ''}
        </tr>
      </table>

      <!-- Assinaturas -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 2mm;">
        <tr>
          <td style="padding: 8px 3px; border-top: 1px solid #000; width: 50%; text-align: center; font-size: 8px; vertical-align: bottom;">
            <div style="margin-bottom: 2px; font-weight: bold;">${clienteNome || 'Cliente'}</div>
            <div style="font-size: 7px; color: #666;">Assinatura do Cliente</div>
          </td>
          <td style="padding: 8px 3px; border-top: 1px solid #000; width: 50%; text-align: center; font-size: 8px; vertical-align: bottom;">
            <div style="margin-bottom: 2px; font-weight: bold;">${os.tecnico_nome || 'Técnico'}</div>
            <div style="font-size: 7px; color: #666;">Assinatura do Técnico</div>
          </td>
        </tr>
      </table>
    </div>
  `;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>OS #${os.numero}</title>
      <style>
        @page { 
          size: A4 portrait; 
          margin: 3mm; 
        }
        * { 
          box-sizing: border-box; 
          margin: 0; 
          padding: 0; 
        }
        body { 
          font-family: Arial, Helvetica, sans-serif; 
          color: #000; 
          font-size: 9px; 
          line-height: 1.25; 
          padding: 0;
          margin: 0;
        }
        table {
          border-collapse: collapse;
        }
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
        }
      </style>
    </head>
    <body>
      ${gerarVia('VIA DO CLIENTE')}
      ${gerarVia('VIA DA EMPRESA')}
    </body>
    </html>
  `;

  return html;
}
