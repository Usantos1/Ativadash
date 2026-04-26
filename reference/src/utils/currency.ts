// Utility functions for currency formatting and conversion

/**
 * Converts numeric value to formatted BRL string
 * @param value - Numeric value in reais (e.g., 1234.56)
 * @returns Formatted BRL string
 */
export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Converts BRL string to numeric value
 * @param brlString - BRL formatted string (e.g., "R$ 1.234,56" or "1234,56")
 * @returns Numeric value in reais
 */
export function brlToNumber(brlString: string): number {
  // Remove currency symbol, spaces, and dots (thousands separator)
  const cleanString = brlString
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  const reais = parseFloat(cleanString);
  return isNaN(reais) ? 0 : reais;
}

/**
 * Mask input for BRL currency - permite digitar números e decimais
 * Aceita valores como: 100, 100.50, 100,50, 1000.99, etc
 * @param value - Input value
 * @returns String limpa com apenas números e um separador decimal
 */
export function maskBRL(value: string): string {
  if (!value) return '';
  
  // Remove tudo exceto números, vírgula e ponto
  let numericValue = value.replace(/[^\d,\.]/g, '');
  
  if (!numericValue) return '';
  
  // Se começar com vírgula ou ponto, adiciona zero antes
  if (numericValue.startsWith(',') || numericValue.startsWith('.')) {
    numericValue = '0' + numericValue;
  }
  
  // Substitui vírgula por ponto para processamento interno
  numericValue = numericValue.replace(',', '.');
  
  // Permite apenas um ponto decimal
  const parts = numericValue.split('.');
  if (parts.length > 2) {
    // Se tem mais de um ponto, mantém apenas o primeiro
    numericValue = parts[0] + '.' + parts.slice(1).join('');
  }
  
  // Garante que após ponto tenha no máximo 2 dígitos
  if (numericValue.includes('.')) {
    const [intPart, decPart] = numericValue.split('.');
    if (decPart && decPart.length > 2) {
      numericValue = intPart + '.' + decPart.substring(0, 2);
    }
  }
  
  // Converte de volta para vírgula para exibição BRL
  return numericValue.replace('.', ',');
}

/**
 * Formata valor BRL apenas para exibição (não durante digitação)
 * @param value - Input value (pode ser número ou string)
 * @returns String formatada
 */
export function formatBRLInput(value: number | string | undefined): string {
  if (!value && value !== 0) return '';
  const num = typeof value === 'string' ? parseBRLInput(value) : value;
  return formatBRL(num);
}

/**
 * Parse BRL input value to numeric for form handling
 * @param value - Form input value
 * @returns Numeric value
 */
export function parseBRLInput(value: string): number {
  if (!value) return 0;
  return brlToNumber(value);
}