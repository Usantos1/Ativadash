/**
 * Utilitários para exportação de dados financeiros
 */

import { currencyFormatters, dateFormatters } from './formatters';

export interface ExportData {
  headers: string[];
  rows: (string | number)[][];
  title: string;
}

/**
 * Exporta dados para CSV
 */
export function exportToCSV(data: ExportData): void {
  const csvContent = [
    data.title,
    '',
    data.headers.join(','),
    ...data.rows.map(row => row.map(cell => {
      if (typeof cell === 'string' && cell.includes(',')) {
        return `"${cell}"`;
      }
      return cell;
    }).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${data.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Exporta dados para Excel (XLSX) usando formato CSV melhorado
 */
export function exportToExcel(data: ExportData): void {
  // Para uma implementação completa, seria necessário usar uma biblioteca como xlsx
  // Por enquanto, exportamos como CSV com extensão .xlsx
  exportToCSV(data);
}

/**
 * Gera HTML para impressão/PDF
 */
export function generatePrintHTML(data: ExportData, additionalInfo?: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${data.title}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 20px;
        }
        h1 {
          text-align: center;
          color: #333;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        th {
          background-color: #f2f2f2;
          font-weight: bold;
        }
        tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        .info {
          margin-top: 20px;
          font-size: 12px;
          color: #666;
        }
        @media print {
          body { margin: 0; }
          @page { margin: 1cm; }
        }
      </style>
    </head>
    <body>
      <h1>${data.title}</h1>
      ${additionalInfo ? `<div class="info">${additionalInfo}</div>` : ''}
      <table>
        <thead>
          <tr>
            ${data.headers.map(h => `<th>${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.rows.map(row => 
            `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`
          ).join('')}
        </tbody>
      </table>
      <div class="info">
        Gerado em: ${new Date().toLocaleString('pt-BR')}
      </div>
    </body>
    </html>
  `;
}

/**
 * Imprime dados
 */
export function printData(data: ExportData, additionalInfo?: string): void {
  const html = generatePrintHTML(data, additionalInfo);
  const printWindow = window.open('', '_blank');
  
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}

/**
 * Exporta DRE para CSV
 */
export function exportDREToCSV(
  receitas: { descricao: string; valor: number }[],
  despesas: { descricao: string; valor: number }[],
  totalReceitas: number,
  totalDespesas: number,
  lucroLiquido: number,
  margemLiquida: number,
  month: string
): void {
  const rows: (string | number)[][] = [
    ['RECEITAS OPERACIONAIS', ''],
    ...receitas.map(r => [r.descricao, r.valor]),
    ['TOTAL RECEITAS', totalReceitas],
    ['', ''],
    ['DESPESAS OPERACIONAIS', ''],
    ...despesas.map(d => [d.descricao, -d.valor]),
    ['TOTAL DESPESAS', -totalDespesas],
    ['', ''],
    ['LUCRO LÍQUIDO', lucroLiquido],
    ['MARGEM LÍQUIDA (%)', margemLiquida],
  ];

  exportToCSV({
    title: `DRE_${month.replace('-', '_')}`,
    headers: ['Descrição', 'Valor (R$)'],
    rows,
  });
}

/**
 * Exporta transações para CSV
 */
export function exportTransactionsToCSV(
  transactions: Array<{
    transaction_date: string;
    type: string;
    description: string;
    amount: number;
    category?: { name: string };
    payment_method?: string;
  }>,
  month: string
): void {
  const rows = transactions.map(t => [
    dateFormatters.short(t.transaction_date),
    t.type === 'entrada' ? 'Entrada' : 'Saída',
    t.description,
    t.category?.name || '-',
    t.payment_method || '-',
    t.amount,
  ]);

  exportToCSV({
    title: `Transacoes_${month.replace('-', '_')}`,
    headers: ['Data', 'Tipo', 'Descrição', 'Categoria', 'Método de Pagamento', 'Valor'],
    rows,
  });
}

