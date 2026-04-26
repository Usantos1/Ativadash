// ==================== UTILITÁRIOS PARA WHATSAPP ====================

export interface WhatsAppMessage {
  number: string;
  message: string;
  fileUrl?: string;
}

/**
 * Abre o WhatsApp Web/App com uma mensagem pré-formatada
 */
export function openWhatsApp(number: string, message: string) {
  // Remove caracteres não numéricos
  const cleanNumber = number.replace(/\D/g, '');
  
  // Formata a mensagem para URL
  const encodedMessage = encodeURIComponent(message);
  
  // Abre WhatsApp Web ou App
  const url = `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
  window.open(url, '_blank');
}

/**
 * Formata mensagem de comprovante de venda
 */
export function formatVendaMessage(data: {
  numero: number;
  data: string;
  total: number;
  cliente?: string;
  itens: Array<{ nome: string; quantidade: number; valor_total: number }>;
  pagamentos: Array<{ forma: string; valor: number }>;
}): string {
  let message = `*COMPROVANTE DE VENDA*\n\n`;
  message += `*Venda #${data.numero}*\n`;
  message += `Data: ${data.data}\n\n`;
  
  if (data.cliente) {
    message += `*Cliente:* ${data.cliente}\n\n`;
  }
  
  message += `*ITENS:*\n`;
  data.itens.forEach(item => {
    message += `• ${item.nome}\n`;
    message += `  ${item.quantidade}x ${formatCurrency(item.valor_total)}\n`;
  });
  
  message += `\n*PAGAMENTOS:*\n`;
  data.pagamentos.forEach(pag => {
    message += `• ${pag.forma}: ${formatCurrency(pag.valor)}\n`;
  });
  
  message += `\n*TOTAL: ${formatCurrency(data.total)}*\n\n`;
  message += `Obrigado pela preferência! 🛍️`;
  
  return message;
}

/**
 * Formata mensagem de termo de garantia
 */
export function formatGarantiaMessage(data: {
  numero: number;
  produto: string;
  dias: number;
  data_fim: string;
  cliente: string;
}): string {
  let message = `*TERMO DE GARANTIA*\n\n`;
  message += `*Venda #${data.numero}*\n\n`;
  message += `*Cliente:* ${data.cliente}\n`;
  message += `*Produto:* ${data.produto}\n`;
  message += `*Garantia:* ${data.dias} dias\n`;
  message += `*Válido até:* ${data.data_fim}\n\n`;
  message += `Guarde este comprovante para validação da garantia.`;
  
  return message;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

