import QRCode from 'qrcode';
import { APP_PUBLIC_URL } from '@/utils/appUrl';
import { OrdemServico } from '@/types/assistencia';
import { ChecklistConfigItem } from '@/hooks/useChecklistConfig';
import { dateFormatters, currencyFormatters } from '@/utils/formatters';
import { patternToSvg, POSSUI_SENHA_LABELS } from '@/utils/osPatternLockSvg';

export interface OSTermicaData {
  os: OrdemServico;
  clienteNome: string;
  /** CPF/CNPJ do cliente para impressão */
  clienteCpf?: string | null;
  /** Endereço completo do cliente para impressão */
  clienteEndereco?: string | null;
  marcaNome?: string;
  modeloNome?: string;
  checklistEntrada: ChecklistConfigItem[];
  checklistEntradaMarcados: string[];
  fotoEntradaUrl?: string;
  imagemReferenciaUrl?: string; // URL da imagem de referência do aparelho
  areasDefeito?: string[]; // Array de strings no formato "x-y" (percentuais)
  via: 'cliente' | 'loja';
  /** Se true, não exibe a seção "CHECKLIST DE ENTRADA" na via (usado nas vias cliente e loja). */
  omitirChecklist?: boolean;
  /** Pagamentos/adiantamentos já registrados na OS (financeiro da OS). */
  pagamentosOs?: { tipo: string; forma: string; valor: number }[];
}

function labelFormaPagamentoOs(forma: string) {
  const f = (forma || '').toLowerCase().replace(/\s+/g, '_');
  const map: Record<string, string> = {
    dinheiro: 'Dinheiro',
    pix: 'PIX',
    pix_samup: 'PIX Samup',
    debito: 'Débito',
    credito: 'Crédito',
    credito_parcelado: 'Crédito parcelado',
    link_pagamento: 'Link',
    carteira_digital: 'Carteira',
    fiado: 'Fiado',
  };
  return map[f] || forma.replace(/_/g, ' ') || '—';
}

export async function generateOSTermica(data: OSTermicaData): Promise<string> {
  const { os, clienteNome, clienteCpf, clienteEndereco, marcaNome, modeloNome, checklistEntrada, checklistEntradaMarcados, imagemReferenciaUrl, areasDefeito, via, omitirChecklist, pagamentosOs } = data;

  // Gerar QR Code com URL da OS
  let qrCodeImg = '';
  try {
    const qrCodeUrl = await QRCode.toDataURL(`${APP_PUBLIC_URL}/acompanhar-os/${os.id}`, {
      width: 120,
      margin: 2,
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 1.0,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
    });
    qrCodeImg = `<img src="${qrCodeUrl}" style="width: 80px; height: 80px; margin: 5px auto; display: block; image-rendering: -webkit-optimize-contrast !important; image-rendering: crisp-edges !important; filter: contrast(1.2) brightness(0.95);" alt="QR Code" />`;
  } catch (error) {
    console.error('Erro ao gerar QR Code:', error);
  }

  // Formatar checklist de entrada - APENAS PROBLEMAS ENCONTRADOS (físicos)
  const checklistFisico = checklistEntrada
    .filter(item => item.categoria === 'fisico' && checklistEntradaMarcados.includes(item.item_id))
    .map(item => item.nome)
    .join(', ');

  // Dados formatados (compactos para reduzir comprimento da nota)
  const dataEntrada = dateFormatters.short(os.data_entrada);
  const horaEntrada = os.hora_entrada || '';
  const previsaoData = os.previsao_entrega ? dateFormatters.short(os.previsao_entrega) : '';
  const previsaoHora = (os as any).hora_previsao || '';
  const previsaoEntrega = previsaoData + (previsaoHora ? ` - Hora: ${previsaoHora}` : '') || '-';
  const valorTotal = os.valor_total ? currencyFormatters.brl(os.valor_total) : '-';
  const corAparelho = (os as any).cor ? String((os as any).cor).trim() : '';

  // Imagem de referência com pontos de defeito (se houver)
  let imagemReferenciaHtml = '';
  if (imagemReferenciaUrl) {
    // Gerar pontos de defeito
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

    // Criar SVG com overlay dos defeitos
    const defectMarkers = defectPoints.map((point, index) => {
      // Converter percentuais para coordenadas SVG (assumindo viewBox 0 0 100 100)
      return `<circle cx="${point.x}" cy="${point.y}" r="2" fill="red" stroke="white" stroke-width="0.5" opacity="0.9" />`;
    }).join('');

    imagemReferenciaHtml = `
      <div style="margin: 5px 0; text-align: center;">
        <div style="position: relative; display: inline-block; max-width: 100%;">
          <img id="ref-img-${os.id}" src="${imagemReferenciaUrl}" style="max-width: 100%; max-height: 200px; object-fit: contain; border: 1px solid #000; display: block;" alt="Referência do Aparelho" />
          ${defectMarkers ? `
            <svg style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1;" viewBox="0 0 100 100" preserveAspectRatio="none">
              ${defectMarkers}
            </svg>
          ` : ''}
        </div>
        <p style="font-size: 8px; margin-top: 2px;">Referência do Aparelho${defectPoints.length > 0 ? ` • ${defectPoints.length} defeito${defectPoints.length !== 1 ? 's' : ''} marcado${defectPoints.length !== 1 ? 's' : ''}` : ''}</p>
      </div>
    `;
  }

  // Padrão para impressão: aceitar string ou array (API pode devolver array)
  const padraoParaImpressao = (() => {
    const p = os.padrao_desbloqueio;
    if (typeof p === 'string' && p.trim()) return p;
    if (Array.isArray(p) && p.length >= 2) return p;
    return undefined;
  })();
  const patternSvgHtml = patternToSvg(padraoParaImpressao);

  // Possui senha: seguir exatamente os status do formulário (SIM, SIM - DESLIZAR (DESENHO), NÃO, etc.)
  const valorSenhaNum = os.senha_numerica || os.senha_aparelho || '';
  const ehPadraoDesenho = Boolean((os.padrao_desbloqueio && String(os.padrao_desbloqueio).trim()) || os.possui_senha_tipo === 'deslizar');
  const tipo = (os.possui_senha_tipo || '').toLowerCase();
  // Não mostrar "Senha: Informado" quando for "CLIENTE NÃO QUIS DEIXAR SENHA"
  const mostrarSenhaNum = os.possui_senha && !ehPadraoDesenho && tipo !== 'nao_autorizou';
  const possuiSenhaTexto = !os.possui_senha
    ? POSSUI_SENHA_LABELS.nao
    : (POSSUI_SENHA_LABELS[tipo] ?? (ehPadraoDesenho ? POSSUI_SENHA_LABELS.deslizar : POSSUI_SENHA_LABELS.sim));
  let senhaHtml = `
    <div style="font-size: 10px; margin: 1px 0; padding: 2px; border: 1px solid #000;">
      <span class="bold">Possui senha: ${possuiSenhaTexto}</span>
      ${mostrarSenhaNum ? `<div style="font-size: 9px; margin-top: 2px;">Senha: ${valorSenhaNum || 'Informado'}</div>` : ''}
      ${ehPadraoDesenho && patternSvgHtml ? `<div style="margin-top: 2px;">${patternSvgHtml}</div>` : ''}
    </div>
  `;

  // Orçamento pré-autorizado (não mostrar valor quando "apenas orçamento")
  const apenasOrcamento = (os as any).apenas_orcamento === true;
  let orcamentoHtml = '';
  
  // Converter valores para número (tratando null, undefined, string)
  const valorDesconto = os.orcamento_desconto != null ? Number(os.orcamento_desconto) : 0;
  const valorParcelado = os.orcamento_parcelado != null ? Number(os.orcamento_parcelado) : 0;
  
  // Mostrar se houver valores de orçamento maiores que zero OU se estiver explicitamente autorizado (e não for apenas orçamento)
  const temOrcamento = valorDesconto > 0 || valorParcelado > 0;
  const deveMostrar = !apenasOrcamento && (temOrcamento || os.orcamento_autorizado === true);
  
  if (deveMostrar) {
    const valorPix = valorDesconto > 0 ? currencyFormatters.brl(valorDesconto) : null;
    const valorCartao = valorParcelado > 0 ? currencyFormatters.brl(valorParcelado) : null;
    if (valorPix || valorCartao) {
      orcamentoHtml = `
        <div style="font-size: 9px; margin: 0; padding: 2px; border: 1px solid #000; background: #f0f0f0;">
          <div class="bold">ORÇAMENTO PRÉ-AUTORIZADO</div>
          ${valorPix ? `<div style="padding-left: 4px;">PIX/Dinheiro: ${valorPix}</div>` : ''}
          ${valorCartao ? `<div style="padding-left: 4px;">Cartão (6x): ${valorCartao}</div>` : ''}
        </div>
      `;
    }
  }

  const pagamentosOsHtml =
    pagamentosOs && pagamentosOs.length > 0
      ? `
      <div class="section-title">PAGAMENTOS REGISTRADOS (OS)</div>
      <div style="font-size: 9px; margin: 0; padding: 2px; border: 1px solid #000;">
        ${pagamentosOs
          .map(
            (p) =>
              `<div class="line" style="margin: 2px 0;"><span>${p.tipo} · ${labelFormaPagamentoOs(p.forma)}</span><span>${currencyFormatters.brl(p.valor)}</span></div>`
          )
          .join('')}
      </div>
      <div class="divider-dashed"></div>
    `
      : '';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @page {
          size: 80mm 297mm;
          margin: 0;
          padding: 0;
        }
        @media print {
          @page {
            size: 80mm 297mm;
            margin: 0;
            padding: 0;
          }
          * {
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            -webkit-font-smoothing: none !important;
            text-rendering: optimizeLegibility !important;
            image-rendering: -webkit-optimize-contrast !important;
            image-rendering: crisp-edges !important;
          }
          body {
            font-size: 11px !important;
            padding: 2mm 6mm 2mm 5mm !important;
            min-height: 297mm !important;
            transform: scale(1) !important;
            -webkit-transform: scale(1) !important;
          }
        }
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          color: #000000 !important;
        }
        body {
          width: 80mm;
          max-width: 80mm;
          min-height: 297mm;
          margin: 0;
          padding: 2mm 6mm 2mm 5mm;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 12px;
          color: #000000 !important;
          background: #ffffff;
          line-height: 1.35;
          font-weight: 900;
          -webkit-font-smoothing: none !important;
          text-rendering: optimizeLegibility !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          overflow: hidden;
          letter-spacing: 0.02em;
        }
        .center {
          text-align: center;
        }
        .bold {
          font-weight: 900 !important;
          color: #000000 !important;
        }
        .divider {
          border-top: 2px solid #000000 !important;
          margin: 2px 0;
        }
        .divider-dashed {
          border-top: 1px dashed #000000 !important;
          margin: 2px 0;
        }
        .line {
          display: flex;
          justify-content: space-between;
          margin: 1px 0;
          font-weight: 900 !important;
          font-size: 10px;
        }
        .label {
          font-weight: 900 !important;
          font-size: 9px;
        }
        .value {
          font-size: 9px;
          text-align: right;
        }
        .section-title {
          font-weight: 900 !important;
          font-size: 10px;
          margin: 2px 0 1px;
          text-decoration: underline;
        }
        .destaque-principal {
          font-weight: 900 !important;
          font-size: 13px;
          margin: 2px 0;
          text-decoration: none !important;
          letter-spacing: 0.03em;
        }
        .compact-line {
          font-size: 9px;
          margin: 0;
          line-height: 1.3;
        }
        .checklist-item {
          font-size: 9px;
          margin: 0 0 0 4px;
          padding-left: 4px;
        }
        .checklist-item::before {
          content: "✓ ";
          font-weight: 900;
        }
        img {
          filter: contrast(1.5) brightness(0.9);
          -webkit-filter: contrast(1.5) brightness(0.9);
        }
      </style>
    </head>
    <body>
      <div class="center" style="margin-bottom: 2px;">
        <div class="bold" style="font-size: 13px;">PRIME CAMP</div>
        <div style="font-size: 8px;">ASSISTÊNCIA TÉCNICA</div>
        <div style="font-size: 7px;">CNPJ: 31.833.574/0001-74</div>
        <div style="font-size: 7px;">Tel: (19) 98768-0453</div>
      </div>
      <div class="divider"></div>
      
      <div class="destaque-principal" style="text-align: center;">ORDEM DE SERVIÇO: #${os.numero}</div>
      <div class="compact-line">Data Entrada: ${dataEntrada}${horaEntrada ? ` - Hora: ${horaEntrada}` : ''}</div>
      <div class="compact-line">Previsão de entrega: ${previsaoEntrega}</div>
      <div class="compact-line">Vendedor(a): ${(os as any).vendedor_nome || (os as any).atendente_nome || '-'}</div>
      <div class="divider"></div>
      
      <div class="section-title">DADOS DO CLIENTE</div>
      <div style="font-size: 11px; font-weight: 900; margin: 2px 0; line-height: 1.35;">Cliente: ${clienteNome}</div>
      <div style="font-size: 11px; font-weight: 900; margin: 2px 0; line-height: 1.35;">Contato: ${os.telefone_contato || '-'}</div>
      <div style="font-size: 10px; font-weight: 700; margin: 2px 0; line-height: 1.35;">CPF/CNPJ: ${clienteCpf || '—'}</div>
      <div style="font-size: 9px; font-weight: 700; margin: 2px 0; line-height: 1.3;">Endereço: ${clienteEndereco || '—'}</div>
      <div class="divider-dashed"></div>
      
      <div class="section-title">EQUIPAMENTO</div>
      <div class="compact-line">Aparelho: ${os.tipo_aparelho || '-'} - Marca: ${marcaNome || os.marca_nome || '-'}</div>
      <div class="destaque-principal" style="font-size: 11px;">Modelo: ${modeloNome || os.modelo_nome || '-'}${corAparelho ? ` - Cor: ${corAparelho}` : ''}</div>
      ${os.imei ? `<div class="compact-line">IMEI: ${os.imei}</div>` : ''}
      ${os.numero_serie ? `<div class="compact-line">Série: ${os.numero_serie}</div>` : ''}
      <div class="divider-dashed"></div>
      
      <div class="section-title">PROBLEMA INFORMADO</div>
      <div class="compact-line" style="padding: 1px; border: 1px solid #000;">${os.descricao_problema || '-'}</div>
      <div class="divider-dashed"></div>
      
      ${(os.condicoes_equipamento && String(os.condicoes_equipamento).trim()) ? `
      <div class="section-title">CONDIÇÕES DO EQUIPAMENTO</div>
      <div class="compact-line" style="padding: 1px; border: 1px solid #000;">${os.condicoes_equipamento}</div>
      <div class="divider-dashed"></div>
      ` : ''}
      
      ${senhaHtml}
      <div class="divider-dashed"></div>
      
      ${imagemReferenciaHtml}
      ${imagemReferenciaHtml ? '<div class="divider-dashed"></div>' : ''}
      
      ${omitirChecklist ? '' : `
      <div class="section-title">CHECKLIST DE ENTRADA</div>
      <div class="bold" style="font-size: 9px;">Problemas Encontrados:</div>
      ${checklistFisico ? checklistFisico.split(', ').map(item => `<div class="checklist-item">${item}</div>`).join('') : '<div class="compact-line">Nenhum problema encontrado</div>'}
      ${os.observacoes_checklist ? `<div style="font-size: 9px; margin-top: 2px;"><span class="bold">Observações:</span> ${os.observacoes_checklist}</div>` : ''}
      ${orcamentoHtml ? '' : '<div class="divider-dashed"></div>'}
      `}
      
      ${apenasOrcamento ? '<div class="compact-line">Realizar Orçamento</div>' : ''}
      
      ${orcamentoHtml || ''}
      
      ${pagamentosOsHtml}
      
      ${qrCodeImg}
      <div class="center" style="font-size: 10px; margin-top: 2px; font-weight: 900;">Aponte a câmera para acompanhar o status da OS</div>
      <div class="divider-dashed"></div>
      
      <div class="section-title">CONDIÇÕES DE SERVIÇO</div>
      <div style="text-align: left; font-size: 9px; line-height: 1.3;">
        • Garantia de 90 dias em peças usadas<br/>
        • Não trocamos peças danificadas por mal uso<br/>
        • Guarde este comprovante<br/>
        • Aparelhos não retirados em 30 dias terão despesas de armazenamento de 6% ao mês.<br/>
        • Aparelhos não retirados em 90 dias serão descartados
      </div>
      <div class="divider"></div>
      
      <div class="center" style="font-size: 9px;">
        <div class="bold">${via === 'cliente' ? 'VIA DO CLIENTE' : 'VIA DA LOJA'}</div>
        <div style="font-size: 7px; margin-top: 1px;">${new Date().toLocaleString('pt-BR')}</div>
      </div>
    </body>
    </html>
  `;

  return html;
}

