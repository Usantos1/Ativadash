import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Para strings YYYY-MM-DD (sem hora), formata sem conversão de timezone.
 * Evita que "2026-03-04" vire dia 03 no fuso Brasil.
 */
function formatDateOnly(dateStr: string): string | null {
  if (typeof dateStr !== 'string') return null;
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/**
 * Formatadores de data
 */
export const dateFormatters = {
  /**
   * Formato curto: 10/12/2025
   * Para datas só-dia (YYYY-MM-DD) formata sem timezone para evitar dia errado.
   */
  short: (date: string | Date) => {
    if (typeof date === 'string') {
      const dateOnly = formatDateOnly(date);
      if (dateOnly) return dateOnly;
    }
    const d = typeof date === 'string' ? parseISO(date) : date;
    return isValid(d) ? format(d, 'dd/MM/yyyy', { locale: ptBR }) : '-';
  },

  /**
   * Formato longo: 10 de dezembro de 2025
   */
  long: (date: string | Date) => {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return isValid(d) ? format(d, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : '-';
  },

  /**
   * Com hora: 10/12/2025 às 14:30
   */
  withTime: (date: string | Date) => {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return isValid(d) ? format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '-';
  },

  /**
   * Relativo: há 2 horas, ontem, etc.
   */
  relative: (date: string | Date) => {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return isValid(d) ? formatDistanceToNow(d, { addSuffix: true, locale: ptBR }) : '-';
  },

  /**
   * Hora apenas: 14:30
   */
  time: (date: string | Date) => {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return isValid(d) ? format(d, 'HH:mm', { locale: ptBR }) : '-';
  },

  /**
   * Dia da semana: Segunda-feira
   */
  weekday: (date: string | Date) => {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return isValid(d) ? format(d, 'EEEE', { locale: ptBR }) : '-';
  },
};

/**
 * Formatadores de moeda
 */
export const currencyFormatters = {
  /**
   * Formato BRL: R$ 1.234,56
   */
  brl: (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(num);
  },

  /**
   * Formato compacto: R$ 1,2K, R$ 1,5M
   */
  compact: (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return 'R$ 0';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(num);
  },

  /**
   * Sem símbolo: 1.234,56
   */
  number: (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0,00';
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  },
};

/**
 * Formatadores de telefone
 */
export const phoneFormatters = {
  /**
   * Formato celular: (11) 99999-9999
   */
  mobile: (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    if (cleaned.length === 10) {
      return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return phone;
  },

  /**
   * Formato WhatsApp: +55 11 99999-9999
   */
  whatsapp: (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13) {
      return cleaned.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 $2 $3-$4');
    }
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '+55 $1 $2-$3');
    }
    return phone;
  },

  /**
   * Limpar formatação
   */
  clean: (phone: string) => phone.replace(/\D/g, ''),
};

/**
 * Formatadores de texto
 */
export const textFormatters = {
  /**
   * Capitalizar primeira letra
   */
  capitalize: (text: string) => {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  },

  /**
   * Capitalizar todas as palavras
   */
  titleCase: (text: string) => {
    if (!text) return '';
    return text
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  },

  /**
   * Truncar texto
   */
  truncate: (text: string, maxLength: number = 50) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  },

  /**
   * Remover HTML
   */
  stripHtml: (html: string) => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '');
  },

  /**
   * Slug (url-friendly)
   */
  slug: (text: string) => {
    if (!text) return '';
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  },
};

/**
 * Formatadores de CPF/CNPJ
 */
export const documentFormatters = {
  /**
   * CPF: 000.000.000-00
   */
  cpf: (cpf: string) => {
    const cleaned = cpf.replace(/\D/g, '');
    if (cleaned.length !== 11) return cpf;
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  },

  /**
   * CNPJ: 00.000.000/0000-00
   */
  cnpj: (cnpj: string) => {
    const cleaned = cnpj.replace(/\D/g, '');
    if (cleaned.length !== 14) return cnpj;
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  },

  /**
   * CEP: 00000-000
   */
  cep: (cep: string) => {
    const cleaned = cep.replace(/\D/g, '');
    if (cleaned.length !== 8) return cep;
    return cleaned.replace(/(\d{5})(\d{3})/, '$1-$2');
  },
};

/**
 * Formatadores de número
 */
export const numberFormatters = {
  /**
   * Porcentagem: 75%
   */
  percent: (value: number, decimals: number = 0) => {
    return `${value.toFixed(decimals)}%`;
  },

  /**
   * Formato compacto: 1.2K, 1.5M
   */
  compact: (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  },

  /**
   * Com separadores: 1.234.567
   */
  thousands: (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
  },
};

/**
 * Helper para parsear JSON que pode vir como string do banco de dados
 * Retorna array vazio se o valor for inválido
 */
export function parseJsonArray<T = any>(value: T[] | string | null | undefined): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Helper para parsear JSON objeto que pode vir como string do banco de dados
 * Retorna objeto vazio ou default se o valor for inválido
 */
export function parseJsonObject<T = Record<string, any>>(value: T | string | null | undefined, defaultValue: T = {} as T): T {
  if (!value) return defaultValue;
  if (typeof value === 'object' && !Array.isArray(value)) return value as T;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : defaultValue;
    } catch {
      return defaultValue;
    }
  }
  return defaultValue;
}

