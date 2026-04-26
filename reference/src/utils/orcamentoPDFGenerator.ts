import { dateFormatters, currencyFormatters } from '@/utils/formatters';

export interface QuoteItemPDF {
  produto_nome: string;
  produto_tipo?: string | null;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  observacao?: string | null;
}

export interface QuotePDF {
  numero: number;
  status?: string | null;
  cliente_nome?: string | null;
  cliente_cpf_cnpj?: string | null;
  cliente_telefone?: string | null;
  consumidor_apenas?: boolean | null;
  veiculo_modelo?: string | null;
  veiculo_ano?: string | null;
  veiculo_versao?: string | null;
  data_validade?: string | null;
  condicoes_texto?: string | null;
  garantias_texto?: string | null;
  subtotal: number;
  desconto_total: number;
  total: number;
  created_at?: string | null;
  observacoes?: string | null;
}

export interface OrcamentoPDFOptions {
  companyName: string;
  logoUrl?: string | null;
  formato: 'a4' | 'termica80';
}

const TIPO_LABEL: Record<string, string> = {
  peca: 'Peça',
  mao_de_obra: 'Mão de obra',
  produto: 'Peça',
  servico: 'Mão de obra',
};

export function generateOrcamentoPDF(
  quote: QuotePDF,
  items: QuoteItemPDF[],
  options: OrcamentoPDFOptions
): string {
  const { companyName, logoUrl, formato } = options;
  const isTermica = formato === 'termica80';

  const clienteLabel = quote.consumidor_apenas ? 'Consumidor' : (quote.cliente_nome || 'Cliente');
  const clienteBlock =
    quote.consumidor_apenas
      ? '<div><strong>Cliente:</strong> Consumidor (não identificado)</div>'
      : `
    <div><strong>Cliente:</strong> ${quote.cliente_nome || '—'}</div>
    ${quote.cliente_telefone ? `<div><strong>Telefone:</strong> ${quote.cliente_telefone}</div>` : ''}
    ${quote.cliente_cpf_cnpj ? `<div><strong>CPF/CNPJ:</strong> ${quote.cliente_cpf_cnpj}</div>` : ''}
  `;

  const veiculoParts = [
    quote.veiculo_modelo,
    quote.veiculo_ano ? `Ano ${quote.veiculo_ano}` : '',
    quote.veiculo_versao ? `Versão ${quote.veiculo_versao}` : '',
  ].filter(Boolean);
  const veiculoBlock =
    veiculoParts.length > 0
      ? `<div><strong>Veículo:</strong> ${veiculoParts.join(' • ')}</div>`
      : '';

  const dataEmissao = quote.created_at ? dateFormatters.short(quote.created_at) : dateFormatters.short(new Date().toISOString());
  const dataValidade = quote.data_validade ? dateFormatters.short(quote.data_validade) : '—';

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="Logo" style="max-height: 48px; max-width: 180px; object-fit: contain; display: block;" />`
    : '';

  const tableRows = items.map(
    (item) => `
    <tr>
      <td style="padding: 4px 6px; border: 1px solid #333; font-size: ${isTermica ? 9 : 10}px;">${item.produto_nome}</td>
      <td style="padding: 4px 6px; border: 1px solid #333; font-size: ${isTermica ? 9 : 10}px; text-align: center;">${TIPO_LABEL[item.produto_tipo || ''] || item.produto_tipo || '—'}</td>
      <td style="padding: 4px 6px; border: 1px solid #333; font-size: ${isTermica ? 9 : 10}px; text-align: right;">${item.quantidade}</td>
      <td style="padding: 4px 6px; border: 1px solid #333; font-size: ${isTermica ? 9 : 10}px; text-align: right;">${currencyFormatters.brl(item.valor_unitario)}</td>
      <td style="padding: 4px 6px; border: 1px solid #333; font-size: ${isTermica ? 9 : 10}px; text-align: right;">${currencyFormatters.brl(item.valor_total)}</td>
    </tr>
  `
  ).join('');

  const condicoesHtml = quote.condicoes_texto
    ? `<div style="margin-top: 8px;"><strong>Condições:</strong><div style="font-size: ${isTermica ? 8 : 9}px; white-space: pre-wrap; margin-top: 2px;">${quote.condicoes_texto}</div></div>`
    : '';
  const garantiasHtml = quote.garantias_texto
    ? `<div style="margin-top: 6px;"><strong>Garantias:</strong><div style="font-size: ${isTermica ? 8 : 9}px; white-space: pre-wrap; margin-top: 2px;">${quote.garantias_texto}</div></div>`
    : '';

  const widthStyle = isTermica ? 'width: 80mm; max-width: 80mm;' : '';

  const content = `
    <div style="${widthStyle} margin: 0 auto; padding: 8px; font-family: Arial, sans-serif; color: #000;">
      <div style="text-align: center; margin-bottom: 10px;">
        ${logoHtml}
        <div style="font-weight: bold; font-size: ${isTermica ? 12 : 14}px; margin-top: 4px;">${companyName}</div>
        <div style="font-size: ${isTermica ? 9 : 10}px; margin-top: 2px;">ORÇAMENTO #${quote.numero}</div>
      </div>

      <div style="font-size: ${isTermica ? 9 : 10}px; margin-bottom: 8px;">
        ${clienteBlock}
        ${veiculoBlock}
        <div><strong>Data emissão:</strong> ${dataEmissao}</div>
        <div><strong>Validade:</strong> ${dataValidade}</div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-top: 8px; font-size: ${isTermica ? 8 : 9}px;">
        <thead>
          <tr>
            <th style="padding: 4px 6px; border: 1px solid #333; text-align: left;">Descrição</th>
            <th style="padding: 4px 6px; border: 1px solid #333; text-align: center;">Tipo</th>
            <th style="padding: 4px 6px; border: 1px solid #333; text-align: right;">Qtd</th>
            <th style="padding: 4px 6px; border: 1px solid #333; text-align: right;">Unit.</th>
            <th style="padding: 4px 6px; border: 1px solid #333; text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>

      <div style="margin-top: 8px; font-size: ${isTermica ? 10 : 11}px;">
        ${quote.desconto_total > 0 ? `<div><strong>Subtotal:</strong> ${currencyFormatters.brl(quote.subtotal)}</div><div><strong>Desconto:</strong> ${currencyFormatters.brl(quote.desconto_total)}</div>` : ''}
        <div><strong>Total:</strong> ${currencyFormatters.brl(quote.total)}</div>
      </div>

      ${condicoesHtml}
      ${garantiasHtml}

      ${quote.observacoes ? `<div style="margin-top: 8px; font-size: ${isTermica ? 8 : 9}px;"><strong>Observações:</strong> ${quote.observacoes}</div>` : ''}
    </div>
  `;

  const pageStyle = isTermica
    ? `@page { size: 80mm auto; margin: 4mm; } body { width: 80mm; max-width: 80mm; margin: 0 auto; }`
    : `@page { size: A4; margin: 12mm; }`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Orçamento #${quote.numero}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, Helvetica, sans-serif; color: #000; padding: 8px; }
        table { border-collapse: collapse; }
        ${pageStyle}
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      ${content}
    </body>
    </html>
  `;

  return html;
}
