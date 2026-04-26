import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { from } from '@/integrations/db/client';
import type { CupomConfig } from '@/hooks/useCupomConfig';
import { PAYMENT_METHOD_LABELS } from '@/types/pdv';

// ==================== GERADOR DE CUPOM NÃO FISCAL ====================

export interface CupomData {
  numero: number;
  data: string;
  hora: string;
  empresa?: {
    nome?: string;
    cnpj?: string;
    ie?: string;
    endereco?: string;
    telefone?: string;
    whatsapp?: string;
    logo_url?: string;
  };
  cliente?: {
    nome?: string;
    cpf_cnpj?: string;
    telefone?: string;
    cidade?: string;
  };
  itens: Array<{
    codigo?: string;
    nome: string;
    quantidade: number;
    valor_unitario: number;
    desconto: number;
    valor_total: number;
  }>;
  subtotal: number;
  desconto_total: number;
  total: number;
  pagamentos: Array<{
    forma: string;
    valor: number;
    troco?: number;
    parcelas?: number;
    valor_parcela?: number;
  }>;
  vendedor?: string;
  /** Label para o campo vendedor (ex.: "Registrado por" para pagamento OS) */
  vendedor_label?: string;
  observacoes?: string;
  termos_garantia?: string;
  /** Quando true (cupom de faturamento de OS), exibe termos de garantia de 90 dias e data de vencimento */
  mostrar_termos_garantia_os?: boolean;
  /** Data de vencimento da garantia (DD/MM/AAAA). Se não informada e mostrar_termos_garantia_os, calculada como data da venda + 90 dias */
  data_vencimento_garantia?: string;
  mostrar_logo?: boolean;
  mostrar_qr_code?: boolean;
  mensagem_rodape?: string;
}

export async function generateCupomTermica(data: CupomData, qrCodeData?: string): Promise<string> {
  // Buscar configurações do cupom
  let config: CupomConfig | null = null;
  try {
    const { data: configData } = await from('cupom_config')
      .select('*')
      .limit(1)
      .single();
    config = configData as CupomConfig | null;
  } catch (error) {
    console.warn('Não foi possível carregar configurações do cupom, usando valores padrão');
  }

  // Usar configurações do banco ou valores padrão
  const empresaNome = data.empresa?.nome || config?.empresa_nome || 'Nome da Empresa';
  const empresaCnpj = data.empresa?.cnpj || config?.empresa_cnpj || '';
  const empresaIe = data.empresa?.ie || config?.empresa_ie || '';
  const empresaEndereco = data.empresa?.endereco || config?.empresa_endereco || '';
  const empresaTelefone = data.empresa?.telefone || config?.empresa_telefone || '';
  const empresaWhatsapp = data.empresa?.whatsapp || config?.empresa_whatsapp || '';
  const logoUrl = data.empresa?.logo_url || config?.logo_url || '';
  const mostrarLogo = data.mostrar_logo !== undefined ? data.mostrar_logo : (config?.mostrar_logo ?? true);
  const mostrarQrCode = data.mostrar_qr_code !== undefined ? data.mostrar_qr_code : (config?.mostrar_qr_code ?? true);
  // Cupom de venda de produtos: usar sempre termos e rodapé padronizados (ignorar config antiga)
  const RODAPE_CUPOM_PRODUTOS = `Produto com garantia contra defeito de fabricação, quando aplicável.
Não cobre mau uso, impacto, quedas, quebra ou umidade.
Guarde este comprovante para eventual atendimento.

Agradecemos a preferência!`;
  const ehCupomVendaProdutos = !data.mostrar_termos_garantia_os;
  const termosGarantia = ehCupomVendaProdutos ? '' : (data.termos_garantia || config?.termos_garantia || '');
  const mensagemRodape = ehCupomVendaProdutos ? RODAPE_CUPOM_PRODUTOS : (data.mensagem_rodape || config?.mensagem_rodape || RODAPE_CUPOM_PRODUTOS);

  // Data de vencimento da garantia (90 dias a partir da data da venda) para cupom de OS
  const dataVencimentoGarantia = (() => {
    if (!data.mostrar_termos_garantia_os) return '';
    if (data.data_vencimento_garantia) return data.data_vencimento_garantia;
    const parts = data.data.split('/');
    if (parts.length !== 3) return '';
    const d = parseInt(parts[0], 10), m = parseInt(parts[1], 10) - 1, y = parseInt(parts[2], 10);
    const date = new Date(y, m, d);
    date.setDate(date.getDate() + 90);
    return date.toLocaleDateString('pt-BR');
  })();

  const termosGarantiaOSHtml = data.mostrar_termos_garantia_os ? `
    <div class="divider-dashed" style="margin: 3px 0;"></div>
    <div style="font-size: 10px; line-height: 1.3; font-weight: 900 !important; color: #000000 !important; text-align: left;">
      <div style="font-size: 11px; margin-bottom: 3px;"><strong>TERMOS DE GARANTIA</strong></div>
      <div style="margin-bottom: 3px;">Garantia de 90 dias sobre a peça substituída e o serviço realizado, contados a partir da data de retirada do aparelho.</div>
      <div style="margin-bottom: 3px;">A garantia cobre exclusivamente defeitos relacionados ao serviço executado.</div>
      <div style="margin-bottom: 2px;"><strong>A garantia NÃO cobre:</strong></div>
      <div>• Mau uso</div>
      <div>• Aparelho molhado ou com oxidação</div>
      <div>• Quedas, trincas externas ou internas, ou quebras após a retirada</div>
      <div>• Riscos ou danos físicos</div>
      <div>• Violação ou manutenção por terceiros</div>
      <div style="margin-top: 3px;">Ao retirar o aparelho, o cliente declara estar ciente e de acordo com estes termos.</div>
      ${dataVencimentoGarantia ? `<div style="margin-top: 4px;"><strong>Data de vencimento da garantia: ${dataVencimentoGarantia}</strong></div>` : ''}
    </div>
  ` : '';

  // Gerar QR Code se fornecido e configurado
  let qrCodeImg = '';
  if (qrCodeData && mostrarQrCode) {
    try {
      // Aumentar resolução do QR code para melhor qualidade de impressão
      const qrCodeUrl = await QRCode.toDataURL(qrCodeData, {
        width: 200, // Aumentado para 200px para melhor qualidade/DPI
        margin: 3,
        errorCorrectionLevel: 'H', // Alto nível de correção de erro para melhor leitura
        type: 'image/png',
        quality: 1.0,
        color: {
          dark: '#000000', // Preto absoluto
          light: '#FFFFFF' // Branco absoluto
        },
        rendererOpts: {
          quality: 1.0
        }
      });
      qrCodeImg = `<img src="${qrCodeUrl}" style="width: 80px; height: 80px; margin: 5px auto; display: block; image-rendering: -webkit-optimize-contrast !important; image-rendering: crisp-edges !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; filter: contrast(1.2) brightness(0.95);" alt="QR Code - Segunda Via" />`;
    } catch (error) {
      console.error('Erro ao gerar QR Code:', error);
    }
  }

  // HTML para impressão térmica 80mm - Formato simplificado e legível
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
        }
        @media print {
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
            font-size: 12px !important;
            padding: 2mm 6mm 2mm 5mm !important;
            min-height: 297mm !important;
            transform: scale(1) !important;
            -webkit-transform: scale(1) !important;
            -webkit-font-smoothing: none !important;
            text-rendering: optimizeLegibility !important;
            image-rendering: -webkit-optimize-contrast !important;
            image-rendering: crisp-edges !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          color: #000000 !important;
          -webkit-font-smoothing: none !important;
          text-rendering: optimizeLegibility !important;
          image-rendering: -webkit-optimize-contrast !important;
          image-rendering: crisp-edges !important;
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
          line-height: 1.4;
          font-weight: 900;
          -webkit-font-smoothing: none !important;
          text-rendering: optimizeLegibility !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          overflow: hidden;
          letter-spacing: 0.2px;
          image-rendering: -webkit-optimize-contrast !important;
          image-rendering: crisp-edges !important;
          transform: scale(1) !important;
          -webkit-transform: scale(1) !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          print-color-adjust: exact;
        }
        .center {
          text-align: center;
        }
        .bold {
          font-weight: 900 !important;
          color: #000000 !important;
        }
        .divider {
          border-top: 3px solid #000000 !important;
          margin: 3px 0;
        }
        .divider-dashed {
          border-top: 2px dashed #000000 !important;
          margin: 3px 0;
        }
        .line {
          display: flex;
          justify-content: space-between;
          margin: 1px 0;
          font-weight: 900 !important;
          color: #000000 !important;
        }
        .item-line {
          margin: 2px 0;
        }
        .item-name {
          font-weight: 900 !important;
          margin-bottom: 1px;
          color: #000000 !important;
        }
        .total-line {
          font-weight: 900 !important;
          font-size: 11px;
          color: #000000 !important;
        }
        span {
          font-weight: 900 !important;
          color: #000000 !important;
        }
        strong {
          font-weight: 900 !important;
          color: #000000 !important;
        }
        div {
          color: #000000 !important;
          font-weight: 900 !important;
        }
        p {
          color: #000000 !important;
          font-weight: 900 !important;
        }
        img {
          filter: contrast(1.5) brightness(0.9);
          -webkit-filter: contrast(1.5) brightness(0.9);
        }
      </style>
    </head>
    <body>
      ${mostrarLogo && logoUrl ? `
        <div class="center" style="margin-bottom: 3px;">
          <img src="${logoUrl}" style="max-width: 60mm; max-height: 20mm; object-fit: contain; filter: contrast(2) brightness(0.8) saturate(1.2); -webkit-filter: contrast(2) brightness(0.8) saturate(1.2); image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges;" alt="Logo" />
        </div>
      ` : ''}
      
      <div class="center bold" style="font-size: 12px; margin-bottom: 2px; font-weight: 900 !important; color: #000000 !important;">
        ${empresaNome}
      </div>
      ${empresaCnpj ? `<div class="center" style="font-size: 9px; margin-bottom: 1px; font-weight: 900 !important; color: #000000 !important;">CNPJ: ${empresaCnpj}</div>` : ''}
      ${empresaIe ? `<div class="center" style="font-size: 9px; margin-bottom: 1px; font-weight: 900 !important; color: #000000 !important;">IE: ${empresaIe}</div>` : ''}
      ${empresaEndereco ? `<div class="center" style="font-size: 9px; margin-bottom: 1px; font-weight: 900 !important; color: #000000 !important;">${empresaEndereco}</div>` : ''}
      ${empresaTelefone || empresaWhatsapp ? `
        <div class="center" style="font-size: 9px; margin-bottom: 3px; font-weight: 900 !important; color: #000000 !important;">
          ${empresaTelefone ? `Tel:${empresaTelefone}` : ''}${empresaTelefone && empresaWhatsapp ? ' / ' : ''}${empresaWhatsapp ? `WhatsApp:${empresaWhatsapp}` : ''}
        </div>
      ` : ''}
      
      <div class="divider" style="margin: 3px 0;"></div>
      
      <div class="center bold" style="font-size: 10px; margin: 3px 0; font-weight: 900 !important; color: #000000 !important;">
        PEDIDO N° ${data.numero}
      </div>
      <div class="line" style="font-size: 10px; font-weight: 900 !important; color: #000000 !important;">
        <span style="font-weight: 900 !important; color: #000000 !important;">Operação:</span>
        <span style="font-weight: 900 !important; color: #000000 !important;">VENDA</span>
      </div>
      <div class="line" style="font-size: 10px; font-weight: 900 !important; color: #000000 !important;">
        <span style="font-weight: 900 !important; color: #000000 !important;">${data.data} - ${data.hora.split(':').slice(0, 2).join(':')}</span>
      </div>
      ${data.vendedor ? `
        <div class="line" style="font-size: 10px; font-weight: 900 !important; color: #000000 !important;">
          <span style="font-weight: 900 !important; color: #000000 !important;">${data.vendedor_label || 'VENDEDOR'}:</span>
          <span style="font-weight: 900 !important; color: #000000 !important;">${data.vendedor}</span>
        </div>
      ` : ''}
      
      <div class="line" style="font-size: 10px; margin-top: 2px; font-weight: 900 !important; color: #000000 !important;">
        <span style="font-weight: 900 !important; color: #000000 !important;">CLIENTE:</span>
        <span style="font-weight: 900 !important; color: #000000 !important;">${data.cliente?.nome || 'CONSUMIDOR FINAL'}</span>
      </div>
      ${data.cliente?.cpf_cnpj ? `
        <div class="line" style="font-size: 10px; font-weight: 900 !important; color: #000000 !important;">
          <span style="font-weight: 900 !important; color: #000000 !important;">CPF/CNPJ:</span>
          <span style="font-weight: 900 !important; color: #000000 !important;">${data.cliente.cpf_cnpj}</span>
        </div>
      ` : ''}
      ${data.cliente?.telefone ? `
        <div class="line" style="font-size: 10px; font-weight: 900 !important; color: #000000 !important;">
          <span style="font-weight: 900 !important; color: #000000 !important;">TELEFONE:</span>
          <span style="font-weight: 900 !important; color: #000000 !important;">${data.cliente.telefone}</span>
        </div>
      ` : ''}
      ${data.cliente?.cidade ? `
        <div class="line" style="font-size: 10px; font-weight: 900 !important; color: #000000 !important;">
          <span style="font-weight: 900 !important; color: #000000 !important;">CIDADE:</span>
          <span style="font-weight: 900 !important; color: #000000 !important;">${data.cliente.cidade}</span>
        </div>
      ` : ''}
      
      <div class="divider-dashed" style="margin: 3px 0;"></div>
      
      <div style="font-size: 9px; margin-bottom: 2px; font-weight: 900 !important; color: #000000 !important;">
        <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #000000; padding: 2px 0; gap: 4px;">
          <span style="font-weight: 900 !important; color: #000000 !important; width: 38px; flex-shrink: 0;">Cod</span>
          <span style="font-weight: 900 !important; color: #000000 !important; flex: 1; min-width: 0; text-align: left;">Descrição</span>
          <span style="font-weight: 900 !important; color: #000000 !important; width: 24px; text-align: right; flex-shrink: 0;">Qtd</span>
          <span style="font-weight: 900 !important; color: #000000 !important; width: 48px; text-align: right; flex-shrink: 0;">Vl Item</span>
          <span style="font-weight: 900 !important; color: #000000 !important; width: 52px; text-align: right; flex-shrink: 0;">Vl Total</span>
        </div>
      </div>
      
      ${data.itens.map((item) => {
        const codigoExibir = (item.codigo && String(item.codigo).trim()) ? String(item.codigo).trim() : '-';
        const descricao = (item.nome || '').toUpperCase();
        return `
        <div style="font-size: 9px; margin: 3px 0; font-weight: 900 !important; color: #000000 !important;">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 4px;">
            <span style="font-weight: 900 !important; color: #000000 !important; width: 38px; flex-shrink: 0;">${codigoExibir}</span>
            <span style="font-weight: 900 !important; color: #000000 !important; flex: 1; min-width: 0;"></span>
            <span style="font-weight: 900 !important; color: #000000 !important; width: 24px; text-align: right; flex-shrink: 0;">${item.quantidade}</span>
            <span style="font-weight: 900 !important; color: #000000 !important; width: 48px; text-align: right; flex-shrink: 0;">${formatCurrency(item.valor_unitario)}</span>
            <span style="font-weight: 900 !important; color: #000000 !important; width: 52px; text-align: right; flex-shrink: 0;">${formatCurrency(item.valor_total)}</span>
          </div>
          <div style="word-wrap: break-word; word-break: break-word; margin-top: 1px; font-size: 9px; line-height: 1.25;">${descricao}</div>
        </div>
      `;
      }).join('')}
      
      <div class="divider" style="margin: 3px 0;"></div>
      
      <div style="font-size: 10px; font-weight: 900 !important; color: #000000 !important;">
        <div class="line" style="margin-bottom: 2px;">
          <span>Total:</span>
          <span>${formatCurrency(Number(data.subtotal || 0))}</span>
        </div>
        <div class="line" style="margin-bottom: 2px;">
          <span>Desconto:</span>
          <span>${formatCurrency(data.desconto_total)}</span>
        </div>
        <div class="line" style="font-size: 11px; margin: 4px 0 6px 0;">
          <span>Total a Pagar:</span>
          <span>${formatCurrency(data.total)}</span>
        </div>
        ${data.pagamentos.map(pag => {
          const formaNormalizada = (() => {
            const f = (pag.forma || '').toUpperCase().replace(/\s+/g, ' ').trim();
            if (/^PIX/i.test(f) || f === 'PIX_CELULAR' || f === 'PIX_SAMUP') return 'PIX';
            const label = PAYMENT_METHOD_LABELS[pag.forma as keyof typeof PAYMENT_METHOD_LABELS];
            if (label) return label;
            if (/DINHEIRO/i.test(f)) return 'Dinheiro';
            if (/DEBITO|DÉBITO/i.test(f)) return 'Débito';
            if (/CREDITO|CRÉDITO/i.test(f)) return 'Crédito';
            return f || 'Pagamento';
          })();
          const parcelas = pag.parcelas && pag.parcelas > 1 ? ` (${pag.parcelas}x)` : '';
          // Dinheiro com troco: valor pago = valor recebido (aplicado + troco)
          const valorExibir = (/dinheiro/i.test(pag.forma || '') && Number(pag.troco || 0) > 0)
            ? Number(pag.valor || 0) + Number(pag.troco || 0)
            : Number(pag.valor || 0);
          return `
          <div class="line" style="margin-bottom: 2px;">
            <span>Forma de pagamento: ${formaNormalizada}${parcelas}</span>
            <span>${formatCurrency(valorExibir)}</span>
          </div>`;
        }).join('')}
        <div class="line" style="margin-top: 2px;">
          <span>Valor Pago:</span>
          <span>${formatCurrency(data.pagamentos.reduce((s, p) => {
            const v = (/dinheiro/i.test(p.forma || '') && Number(p.troco || 0) > 0)
              ? Number(p.valor || 0) + Number(p.troco || 0)
              : Number(p.valor || 0);
            return s + v;
          }, 0))}</span>
        </div>
        ${((): string => {
          const trocoTotal = data.pagamentos.reduce((s, p) => s + Number(p.troco || 0), 0);
          if (trocoTotal <= 0) return '';
          return `
          <div class="line" style="margin-top: 2px;">
            <span>Troco:</span>
            <span>${formatCurrency(trocoTotal)}</span>
          </div>`;
        })()}
      </div>
      
      ${termosGarantiaOSHtml}
      
      ${termosGarantia ? `
        <div class="divider-dashed" style="margin: 3px 0;"></div>
        <div style="font-size: 10px; line-height: 1.3; font-weight: 900 !important; color: #000000 !important; text-align: justify;">
          ${termosGarantia}
        </div>
      ` : ''}
      
      <div class="divider" style="margin: 3px 0;"></div>
      
      <div class="center" style="font-size: 9px; margin-top: 4px; font-weight: 900 !important; color: #000000 !important; line-height: 1.35;">
        ${mensagemRodape.split(/\r?\n/).map(linha => linha.trim()).filter(Boolean).map(linha =>
          `<div style="margin-bottom: 3px; font-weight: 900 !important; color: #000000 !important; text-align: center;">${linha}</div>`
        ).join('')}
        ${qrCodeImg ? `
          <div style="margin-top: 6px;">
            ${qrCodeImg}
          </div>
        ` : ''}
        <div style="font-size: 8px; margin-top: 4px; font-weight: 900 !important; color: #000000 !important;">
          Impresso em ${data.data} - ${data.hora.split(':').slice(0, 2).join(':')}
        </div>
      </div>
    </body>
    </html>
  `;
  
  return html;
}

export async function generateCupomPDF(data: CupomData, qrCodeData?: string): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 297] // 80mm width, auto height
  });

  let y = 10;
  const pageWidth = 80;
  const margin = 5;

  // Header
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(data.empresa?.nome || 'PRIME CAMP', pageWidth / 2, y, { align: 'center' });
  y += 5;
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Assistência Técnica', pageWidth / 2, y, { align: 'center' });
  y += 4;
  if (data.empresa?.cnpj) {
    doc.text(`CNPJ: ${data.empresa.cnpj}`, pageWidth / 2, y, { align: 'center' });
    y += 4;
  }
  if (data.empresa?.endereco) {
    const enderecoLines = doc.splitTextToSize(data.empresa.endereco, pageWidth - 2 * margin);
    enderecoLines.forEach((line: string) => {
      doc.text(line, pageWidth / 2, y, { align: 'center' });
      y += 4;
    });
  }
  if (data.empresa?.telefone) {
    doc.text(`Telefone: ${data.empresa.telefone}`, pageWidth / 2, y, { align: 'center' });
    y += 4;
  }
  y += 6;

  // Linha divisória
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // Título
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('CUPOM NÃO FISCAL', pageWidth / 2, y, { align: 'center' });
  y += 5;

  // Informações da venda
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Venda #${data.numero}`, margin, y);
  y += 4;
  doc.text(`Data: ${data.data} ${data.hora}`, margin, y);
  y += 5;

  // Cliente
  if (data.cliente?.nome) {
    doc.text(`Cliente: ${data.cliente.nome}`, margin, y);
    y += 4;
    if (data.cliente.cpf_cnpj) {
      doc.text(`CPF/CNPJ: ${data.cliente.cpf_cnpj}`, margin, y);
      y += 4;
    }
    if (data.cliente.telefone) {
      doc.text(`Tel: ${data.cliente.telefone}`, margin, y);
      y += 4;
    }
    y += 2;
  }

  // Linha divisória
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // Itens
  data.itens.forEach(item => {
    doc.setFont('helvetica', 'bold');
    doc.text(item.nome, margin, y);
    y += 4;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    const itemLine = `${item.quantidade}x ${formatCurrency(item.valor_unitario)}`;
    const itemTotal = formatCurrency(item.valor_total);
    doc.text(itemLine, margin, y);
    doc.text(itemTotal, pageWidth - margin, y, { align: 'right' });
    y += 4;
    
    if (item.desconto > 0) {
      doc.text(`Desc: -${formatCurrency(item.desconto)}`, margin + 5, y);
      y += 3;
    }
    y += 2;
  });

  // Linha divisória
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // Totais
  doc.setFontSize(8);
  doc.text('Subtotal:', margin, y);
  doc.text(formatCurrency(data.subtotal), pageWidth - margin, y, { align: 'right' });
  y += 4;

  if (data.desconto_total > 0) {
    doc.text('Desconto:', margin, y);
    doc.text(`-${formatCurrency(data.desconto_total)}`, pageWidth - margin, y, { align: 'right' });
    y += 4;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('TOTAL:', margin, y);
  doc.text(formatCurrency(data.total), pageWidth - margin, y, { align: 'right' });
  y += 6;

  // Linha divisória
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // Pagamentos
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  data.pagamentos.forEach(pag => {
    // Traduzir forma de pagamento para português
    const formaPagamentoLabel = PAYMENT_METHOD_LABELS[pag.forma as keyof typeof PAYMENT_METHOD_LABELS] || pag.forma.toUpperCase();
    doc.text(`${formaPagamentoLabel}:`, margin, y);
    // Dinheiro com troco: exibir valor recebido (aplicado + troco), não só o aplicado
    const valorRecebido = (/dinheiro/i.test(pag.forma || '') && Number(pag.troco || 0) > 0)
      ? Number(pag.valor || 0) + Number(pag.troco || 0)
      : Number(pag.valor || 0);
    doc.text(formatCurrency(valorRecebido), pageWidth - margin, y, { align: 'right' });
    y += 4;
    
    if (pag.troco) {
      doc.setFontSize(7);
      doc.text(`Troco: ${formatCurrency(pag.troco)}`, margin + 5, y);
      y += 4;
      doc.setFontSize(8);
    }
    y += 2;
  });

  // Observações
  if (data.observacoes) {
    y += 3;
    doc.text(`Obs: ${data.observacoes}`, margin, y);
    y += 5;
  }

  // Vendedor
  if (data.vendedor) {
    doc.text(`Vendedor: ${data.vendedor}`, margin, y);
    y += 5;
  }

  // QR Code
  if (qrCodeData) {
    try {
      // Aumentar resolução do QR code para melhor qualidade no PDF
      const qrCodeUrl = await QRCode.toDataURL(qrCodeData, {
        width: 200, // Alta resolução para melhor qualidade
        margin: 3,
        errorCorrectionLevel: 'H', // Alto nível de correção de erro
        type: 'image/png',
        quality: 1.0,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        rendererOpts: {
          quality: 1.0
        }
      });
      
      // Adicionar QR code com tamanho maior e melhor qualidade
      doc.addImage(qrCodeUrl, 'PNG', (pageWidth - 50) / 2, y, 50, 50, undefined, 'FAST');
      y += 55;
    } catch (error) {
      console.error('Erro ao gerar QR Code:', error);
    }
  }

  // Termos de Garantia (cupom de OS - 90 dias)
  if (data.mostrar_termos_garantia_os) {
    y += 5;
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('TERMOS DE GARANTIA', margin, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    const termosOS = [
      'Garantia de 90 dias sobre a peça substituída e o serviço realizado, contados a partir da data de retirada do aparelho.',
      'A garantia cobre exclusivamente defeitos relacionados ao serviço executado.',
      'A garantia NÃO cobre:',
      '• Mau uso',
      '• Aparelho molhado ou com oxidação',
      '• Quedas, trincas externas ou internas, ou quebras após a retirada',
      '• Riscos ou danos físicos',
      '• Violação ou manutenção por terceiros',
      'Ao retirar o aparelho, o cliente declara estar ciente e de acordo com estes termos.',
    ];
    termosOS.forEach((line: string) => {
      const lines = doc.splitTextToSize(line, pageWidth - 2 * margin);
      lines.forEach((l: string) => {
        doc.text(l, margin, y);
        y += 3;
      });
    });
    const dataVenc = data.data_vencimento_garantia || (() => {
      const parts = data.data.split('/');
      if (parts.length !== 3) return '';
      const d = parseInt(parts[0], 10), m = parseInt(parts[1], 10) - 1, y0 = parseInt(parts[2], 10);
      const date = new Date(y0, m, d);
      date.setDate(date.getDate() + 90);
      return date.toLocaleDateString('pt-BR');
    })();
    if (dataVenc) {
      y += 3;
      doc.setFont('helvetica', 'bold');
      doc.text(`Data de vencimento da garantia: ${dataVenc}`, margin, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
    }
  }

  // Termos de Garantia (customizado)
  if (data.termos_garantia) {
    y += 5;
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text('TERMOS DE GARANTIA:', margin, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    const termosLines = doc.splitTextToSize(data.termos_garantia, pageWidth - 2 * margin);
    termosLines.forEach((line: string) => {
      doc.text(line, margin, y);
      y += 3;
    });
  }

  // Rodapé
  y += 5;
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;
  doc.setFontSize(7);
  doc.text('Obrigado pela preferência!', pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.text('Volte sempre', pageWidth / 2, y, { align: 'center' });

  return doc;
}

// ==================== GERADOR DE COMPROVANTE DE PAGAMENTO ====================

export interface ComprovanteData {
  numero: number;
  data: string;
  hora: string;
  cliente?: {
    nome?: string;
    cpf_cnpj?: string;
  };
  pagamento: {
    forma: string;
    valor: number;
    troco?: number;
    parcelas?: number;
    valor_parcela?: number;
  };
  vendedor?: string;
}

export async function generateComprovantePDF(data: ComprovanteData): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  let y = 20;
  const pageWidth = 210;
  const margin = 20;

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('COMPROVANTE DE PAGAMENTO', pageWidth / 2, y, { align: 'center' });
  y += 10;

  // Informações
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Venda #${data.numero}`, margin, y);
  y += 6;
  doc.text(`Data: ${data.data} ${data.hora}`, margin, y);
  y += 8;

  if (data.cliente?.nome) {
    doc.text(`Cliente: ${data.cliente.nome}`, margin, y);
    y += 6;
    if (data.cliente.cpf_cnpj) {
      doc.text(`CPF/CNPJ: ${data.cliente.cpf_cnpj}`, margin, y);
      y += 6;
    }
  }

  y += 5;
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // Pagamento
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('DADOS DO PAGAMENTO', margin, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Forma de Pagamento: ${data.pagamento.forma}`, margin, y);
  y += 6;
  // Dinheiro com troco: exibir valor recebido (aplicado + troco)
  const valorRecebidoComprovante = (/dinheiro/i.test(data.pagamento.forma || '') && Number(data.pagamento.troco || 0) > 0)
    ? Number(data.pagamento.valor || 0) + Number(data.pagamento.troco || 0)
    : Number(data.pagamento.valor || 0);
  doc.text(`Valor Pago: ${formatCurrency(valorRecebidoComprovante)}`, margin, y);
  y += 6;

  if (data.pagamento.troco) {
    doc.text(`Troco: ${formatCurrency(data.pagamento.troco)}`, margin, y);
    y += 6;
  }

  if (data.pagamento.parcelas && data.pagamento.parcelas > 1) {
    doc.text(`Parcelas: ${data.pagamento.parcelas}x`, margin, y);
    y += 6;
    if (data.pagamento.valor_parcela) {
      doc.text(`Valor da Parcela: ${formatCurrency(data.pagamento.valor_parcela)}`, margin, y);
      y += 6;
    }
  }

  if (data.vendedor) {
    y += 5;
    doc.text(`Vendedor: ${data.vendedor}`, margin, y);
  }

  return doc;
}

// ==================== GERADOR DE TERMO DE GARANTIA ====================

export interface GarantiaData {
  numero: number;
  data: string;
  cliente: {
    nome: string;
    cpf_cnpj?: string;
    telefone?: string;
    endereco?: string;
  };
  produto: {
    nome: string;
    codigo?: string;
  };
  garantia: {
    dias: number;
    data_inicio: string;
    data_fim: string;
    regras?: string;
  };
  vendedor?: string;
}

export async function generateTermoGarantiaPDF(data: GarantiaData): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  let y = 20;
  const pageWidth = 210;
  const margin = 20;

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('TERMO DE GARANTIA', pageWidth / 2, y, { align: 'center' });
  y += 10;

  // Informações
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Venda #${data.numero}`, margin, y);
  y += 6;
  doc.text(`Data: ${data.data}`, margin, y);
  y += 10;

  // Cliente
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DO CLIENTE', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(`Nome: ${data.cliente.nome}`, margin, y);
  y += 6;
  if (data.cliente.cpf_cnpj) {
    doc.text(`CPF/CNPJ: ${data.cliente.cpf_cnpj}`, margin, y);
    y += 6;
  }
  if (data.cliente.telefone) {
    doc.text(`Telefone: ${data.cliente.telefone}`, margin, y);
    y += 6;
  }
  if (data.cliente.endereco) {
    doc.text(`Endereço: ${data.cliente.endereco}`, margin, y);
    y += 6;
  }

  y += 5;
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // Produto
  doc.setFont('helvetica', 'bold');
  doc.text('PRODUTO', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(`Nome: ${data.produto.nome}`, margin, y);
  y += 6;
  if (data.produto.codigo) {
    doc.text(`Código: ${data.produto.codigo}`, margin, y);
    y += 6;
  }

  y += 5;
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // Garantia
  doc.setFont('helvetica', 'bold');
  doc.text('PERÍODO DE GARANTIA', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(`Prazo: ${data.garantia.dias} dias`, margin, y);
  y += 6;
  doc.text(`Data de Início: ${data.garantia.data_inicio}`, margin, y);
  y += 6;
  doc.text(`Data de Término: ${data.garantia.data_fim}`, margin, y);
  y += 10;

  if (data.garantia.regras) {
    doc.setFont('helvetica', 'bold');
    doc.text('CONDIÇÕES DA GARANTIA', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    const regrasLines = doc.splitTextToSize(data.garantia.regras, pageWidth - 2 * margin);
    doc.text(regrasLines, margin, y);
    y += regrasLines.length * 6;
  }

  y += 10;
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // Assinaturas
  doc.setFontSize(9);
  doc.text('Assinatura do Cliente:', margin, y);
  y += 20;
  doc.line(margin, y, pageWidth / 2 - 10, y);
  y += 5;
  doc.text(data.cliente.nome, margin, y);
  
  y -= 25;
  doc.text('Assinatura do Vendedor:', pageWidth / 2 + 10, y);
  y += 20;
  doc.line(pageWidth / 2 + 10, y, pageWidth - margin, y);
  y += 5;
  if (data.vendedor) {
    doc.text(data.vendedor, pageWidth / 2 + 10, y);
  }

  return doc;
}

// ==================== ORÇAMENTO ====================

export interface OrcamentoData {
  numero: number;
  data: string;
  hora: string;
  validade?: string;
  empresa?: {
    nome?: string;
    cnpj?: string;
    endereco?: string;
    telefone?: string;
    whatsapp?: string;
    logo_url?: string;
  };
  cliente?: {
    nome?: string;
    cpf_cnpj?: string;
    telefone?: string;
    email?: string;
  };
  itens: Array<{
    codigo?: string;
    nome: string;
    quantidade: number;
    valor_unitario: number;
    desconto: number;
    valor_total: number;
  }>;
  subtotal: number;
  desconto_total: number;
  total: number;
  vendedor?: string;
  observacoes?: string;
  condicoes_pagamento?: string;
}

export async function generateOrcamentoPDF(data: OrcamentoData): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = margin;

  // Cores
  const primaryColor: [number, number, number] = [37, 99, 235]; // Azul
  const secondaryColor: [number, number, number] = [100, 116, 139]; // Cinza
  const accentColor: [number, number, number] = [16, 185, 129]; // Verde

  // ===== CABEÇALHO =====
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 35, 'F');

  // Título
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('ORÇAMENTO', margin, 18);

  // Número do orçamento
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nº ${data.numero}`, margin, 28);

  // Data e validade (lado direito)
  doc.setFontSize(10);
  doc.text(`Data: ${data.data}`, pageWidth - margin - 50, 18, { align: 'left' });
  if (data.validade) {
    doc.text(`Válido até: ${data.validade}`, pageWidth - margin - 50, 25, { align: 'left' });
  }

  y = 45;

  // ===== DADOS DA EMPRESA =====
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(data.empresa?.nome || 'PRIME CAMP ASSISTÊNCIA TÉCNICA', margin, y);
  
  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...secondaryColor);
  
  if (data.empresa?.cnpj) {
    doc.text(`CNPJ: ${data.empresa.cnpj}`, margin, y);
    y += 4;
  }
  if (data.empresa?.endereco) {
    doc.text(data.empresa.endereco, margin, y);
    y += 4;
  }
  if (data.empresa?.telefone || data.empresa?.whatsapp) {
    const contato = [data.empresa?.telefone, data.empresa?.whatsapp].filter(Boolean).join(' | ');
    doc.text(contato, margin, y);
    y += 4;
  }

  y += 8;

  // ===== DADOS DO CLIENTE =====
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, pageWidth - (margin * 2), 25, 3, 3, 'F');
  
  y += 6;
  doc.setTextColor(...primaryColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENTE', margin + 5, y);
  
  y += 5;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(data.cliente?.nome || 'Cliente não identificado', margin + 5, y);
  
  y += 5;
  doc.setFontSize(9);
  doc.setTextColor(...secondaryColor);
  const clienteInfo = [
    data.cliente?.cpf_cnpj,
    data.cliente?.telefone,
    data.cliente?.email
  ].filter(Boolean).join(' • ');
  if (clienteInfo) {
    doc.text(clienteInfo, margin + 5, y);
  }

  y += 15;

  // ===== TABELA DE ITENS =====
  doc.setFillColor(...primaryColor);
  doc.rect(margin, y, pageWidth - (margin * 2), 8, 'F');
  
  // Cabeçalho da tabela
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('ITEM', margin + 3, y + 5.5);
  doc.text('QTD', margin + 85, y + 5.5);
  doc.text('UNIT.', margin + 105, y + 5.5);
  doc.text('DESC.', margin + 130, y + 5.5);
  doc.text('TOTAL', margin + 155, y + 5.5);

  y += 10;

  // Itens
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  
  data.itens.forEach((item, index) => {
    // Verificar se precisa de nova página
    if (y > pageHeight - 60) {
      doc.addPage();
      y = margin;
    }

    const bgColor = index % 2 === 0 ? [255, 255, 255] : [249, 250, 251];
    doc.setFillColor(...bgColor as [number, number, number]);
    doc.rect(margin, y - 3, pageWidth - (margin * 2), 8, 'F');

    doc.setFontSize(9);
    
    // Nome do produto (com truncate se necessário)
    const nomeMax = 75;
    let nome = item.nome;
    if (doc.getTextWidth(nome) > nomeMax) {
      while (doc.getTextWidth(nome + '...') > nomeMax && nome.length > 0) {
        nome = nome.slice(0, -1);
      }
      nome += '...';
    }
    doc.text(nome, margin + 3, y + 2);
    
    // Quantidade
    doc.text(item.quantidade.toString(), margin + 85, y + 2);
    
    // Valor unitário
    doc.text(formatCurrency(item.valor_unitario), margin + 105, y + 2);
    
    // Desconto
    if (item.desconto > 0) {
      doc.setTextColor(220, 38, 38);
      doc.text(`-${formatCurrency(item.desconto)}`, margin + 130, y + 2);
      doc.setTextColor(0, 0, 0);
    } else {
      doc.text('-', margin + 130, y + 2);
    }
    
    // Total
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(item.valor_total), margin + 155, y + 2);
    doc.setFont('helvetica', 'normal');

    y += 8;
  });

  // Linha divisória
  y += 2;
  doc.setDrawColor(...secondaryColor);
  doc.line(margin, y, pageWidth - margin, y);

  y += 8;

  // ===== TOTAIS =====
  const totaisX = pageWidth - margin - 60;
  
  doc.setFontSize(10);
  doc.setTextColor(...secondaryColor);
  doc.text('Subtotal:', totaisX, y);
  doc.setTextColor(0, 0, 0);
  doc.text(formatCurrency(data.subtotal), totaisX + 35, y);
  
  if (data.desconto_total > 0) {
    y += 6;
    doc.setTextColor(...secondaryColor);
    doc.text('Desconto:', totaisX, y);
    doc.setTextColor(220, 38, 38);
    doc.text(`-${formatCurrency(data.desconto_total)}`, totaisX + 35, y);
  }

  y += 10;
  doc.setFillColor(...accentColor);
  doc.roundedRect(totaisX - 5, y - 5, 70, 12, 2, 2, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', totaisX, y + 3);
  doc.text(formatCurrency(data.total), totaisX + 35, y + 3);

  y += 20;

  // ===== OBSERVAÇÕES =====
  if (data.observacoes) {
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Observações:', margin, y);
    
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...secondaryColor);
    
    const obsLines = doc.splitTextToSize(data.observacoes, pageWidth - (margin * 2));
    doc.text(obsLines, margin, y);
    y += obsLines.length * 4 + 5;
  }

  // ===== CONDIÇÕES DE PAGAMENTO =====
  if (data.condicoes_pagamento) {
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Condições de Pagamento:', margin, y);
    
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...secondaryColor);
    doc.text(data.condicoes_pagamento, margin, y);
    y += 10;
  }

  // ===== RODAPÉ =====
  const footerY = pageHeight - 20;
  
  doc.setDrawColor(...secondaryColor);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
  
  doc.setFontSize(8);
  doc.setTextColor(...secondaryColor);
  doc.text('Este documento é apenas um orçamento e não possui valor fiscal.', margin, footerY);
  doc.text(`Vendedor: ${data.vendedor || 'Não informado'}`, margin, footerY + 4);
  doc.text(`Gerado em ${data.data} às ${data.hora}`, pageWidth - margin, footerY, { align: 'right' });

  return doc;
}

export function generateOrcamentoHTML(data: OrcamentoData): string {
  const itensHTML = data.itens.map((item, i) => `
    <tr style="background: ${i % 2 === 0 ? '#fff' : '#f9fafb'};">
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.nome}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantidade}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.valor_unitario)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; color: ${item.desconto > 0 ? '#dc2626' : '#6b7280'};">
        ${item.desconto > 0 ? `-${formatCurrency(item.desconto)}` : '-'}
      </td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${formatCurrency(item.valor_total)}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Orçamento #${data.numero}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5; }
        .header { background: #2563eb; color: white; padding: 20px; }
        .header h1 { font-size: 28px; margin-bottom: 5px; }
        .content { padding: 20px; }
        .empresa { margin-bottom: 20px; }
        .empresa h2 { font-size: 18px; color: #1f2937; margin-bottom: 5px; }
        .empresa p { font-size: 12px; color: #6b7280; }
        .cliente { background: #f8fafc; border-radius: 8px; padding: 15px; margin-bottom: 20px; }
        .cliente-titulo { font-size: 12px; color: #2563eb; font-weight: 600; margin-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #2563eb; color: white; padding: 10px; font-size: 11px; text-align: left; }
        .totais { text-align: right; margin-bottom: 20px; }
        .totais-linha { margin: 5px 0; font-size: 14px; }
        .total-final { background: #10b981; color: white; padding: 10px 15px; border-radius: 6px; display: inline-block; font-size: 16px; font-weight: bold; }
        .obs { font-size: 12px; color: #6b7280; margin-bottom: 15px; }
        .footer { border-top: 1px solid #e5e7eb; padding-top: 15px; font-size: 10px; color: #9ca3af; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>ORÇAMENTO</h1>
        <p>Nº ${data.numero} • ${data.data}${data.validade ? ` • Válido até ${data.validade}` : ''}</p>
      </div>
      <div class="content">
        <div class="empresa">
          <h2>${data.empresa?.nome || 'PRIME CAMP ASSISTÊNCIA TÉCNICA'}</h2>
          ${data.empresa?.cnpj ? `<p>CNPJ: ${data.empresa.cnpj}</p>` : ''}
          ${data.empresa?.endereco ? `<p>${data.empresa.endereco}</p>` : ''}
          ${data.empresa?.telefone ? `<p>Tel: ${data.empresa.telefone}</p>` : ''}
        </div>
        
        <div class="cliente">
          <div class="cliente-titulo">CLIENTE</div>
          <div style="font-size: 14px; font-weight: 600;">${data.cliente?.nome || 'Cliente não identificado'}</div>
          <div style="font-size: 12px; color: #6b7280;">
            ${[data.cliente?.cpf_cnpj, data.cliente?.telefone, data.cliente?.email].filter(Boolean).join(' • ')}
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th style="text-align: center;">Qtd</th>
              <th style="text-align: right;">Unit.</th>
              <th style="text-align: right;">Desc.</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itensHTML}
          </tbody>
        </table>
        
        <div class="totais">
          <div class="totais-linha">Subtotal: ${formatCurrency(data.subtotal)}</div>
          ${data.desconto_total > 0 ? `<div class="totais-linha" style="color: #dc2626;">Desconto: -${formatCurrency(data.desconto_total)}</div>` : ''}
          <div class="total-final">TOTAL: ${formatCurrency(data.total)}</div>
        </div>
        
        ${data.observacoes ? `<div class="obs"><strong>Observações:</strong> ${data.observacoes}</div>` : ''}
        ${data.condicoes_pagamento ? `<div class="obs"><strong>Condições:</strong> ${data.condicoes_pagamento}</div>` : ''}
        
        <div class="footer">
          <p>Este documento é apenas um orçamento e não possui valor fiscal.</p>
          <p>Vendedor: ${data.vendedor || 'Não informado'} • Gerado em ${data.data} às ${data.hora}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ==================== FUNÇÕES AUXILIARES ====================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

// ==================== IMPRESSÃO TÉRMICA ====================

export function printTermica(html: string) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Por favor, permita pop-ups para imprimir');
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();
  
  // Aguardar carregamento do QR Code se houver
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 500);
}

