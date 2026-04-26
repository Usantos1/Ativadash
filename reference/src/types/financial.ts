/**
 * Tipos do Módulo Financeiro
 */

export type TransactionType = 'entrada' | 'saida';
export type ExpenseType = 'fixa' | 'variavel';
export type BillStatus = 'pendente' | 'pago' | 'atrasado' | 'cancelado';
export type PaymentMethod = 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito' | 'boleto' | 'transferencia' | 'cheque' | 'outro';
export type CashClosingStatus = 'aberto' | 'fechado' | 'conferido';

export interface FinancialCategory {
  id: string;
  name: string;
  type: TransactionType;
  description?: string;
  color: string;
  icon: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface BillToPay {
  id: string;
  description: string;
  amount: number;
  category_id?: string;
  category?: FinancialCategory;
  expense_type: ExpenseType;
  due_date: string;
  payment_date?: string;
  status: BillStatus;
  payment_method?: PaymentMethod;
  supplier?: string;
  notes?: string;
  recurring: boolean;
  recurring_day?: number;
  attachment_url?: string;
  reminder_sent: boolean;
  reminder_sent_at?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  paid_by?: string;
}

export interface CashClosing {
  id: string;
  seller_id: string;
  seller_name: string;
  closing_date: string;
  opening_amount: number;
  cash_sales: number;
  pix_sales: number;
  credit_card_sales: number;
  debit_card_sales: number;
  other_sales: number;
  withdrawals: number;
  supplies: number;
  expected_cash: number;
  actual_cash?: number;
  difference?: number;
  total_sales: number;
  notes?: string;
  status: CashClosingStatus;
  verified_by?: string;
  verified_at?: string;
  created_at: string;
  updated_at: string;
}

export interface FinancialTransaction {
  id: string;
  type: TransactionType;
  category_id?: string;
  category?: FinancialCategory;
  description: string;
  amount: number;
  payment_method?: PaymentMethod;
  transaction_date: string;
  reference_id?: string;
  reference_type?: 'bill' | 'cash_closing' | 'manual';
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface FinancialAlert {
  id: string;
  bill_id: string;
  bill?: BillToPay;
  alert_type: 'vencimento_proximo' | 'vencido' | 'lembrete';
  message: string;
  sent_via: 'whatsapp' | 'email' | 'sistema';
  sent_to?: string;
  sent_at?: string;
  status: 'pendente' | 'enviado' | 'erro';
  error_message?: string;
  created_at: string;
}

// Resumo Financeiro
export interface FinancialSummary {
  period: string;
  total_entradas: number;
  total_saidas: number;
  saldo: number;
  bills_pending: number;
  bills_overdue: number;
  cash_closings_pending: number;
}

// Formulário de conta a pagar
export interface BillToPayFormData {
  description: string;
  amount: number;
  category_id?: string;
  expense_type: ExpenseType;
  due_date: string;
  supplier?: string;
  notes?: string;
  recurring: boolean;
  recurring_day?: number;
}

// Formulário de fechamento de caixa
export interface CashClosingFormData {
  closing_date: string;
  cash_sales: number;
  pix_sales: number;
  credit_card_sales: number;
  debit_card_sales: number;
  other_sales: number;
  withdrawals: number;
  supplies: number;
  actual_cash: number;
  notes?: string;
}

// Labels em português
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
  boleto: 'Boleto',
  transferencia: 'Transferência',
  cheque: 'Cheque',
  outro: 'Outro',
};

export const BILL_STATUS_LABELS: Record<BillStatus, string> = {
  pendente: 'Pendente',
  pago: 'Pago',
  atrasado: 'Atrasado',
  cancelado: 'Cancelado',
};

export const EXPENSE_TYPE_LABELS: Record<ExpenseType, string> = {
  fixa: 'Fixa',
  variavel: 'Variável',
};

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
};

