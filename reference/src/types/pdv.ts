// ==========================================
// TIPOS PARA SISTEMA PDV (PONTO DE VENDA)
// ==========================================

// ==================== TIPOS BASE ====================

export type SaleStatus = 'draft' | 'open' | 'paid' | 'partial' | 'canceled' | 'refunded' | 'partial_refund';
export type PaymentStatus = 'pending' | 'confirmed' | 'canceled' | 'refunded';
export type PaymentMethod = 'dinheiro' | 'pix' | 'debito' | 'credito' | 'link_pagamento' | 'carteira_digital' | 'fiado';
export type CashSessionStatus = 'open' | 'closed';
export type CashMovementType = 'sangria' | 'suprimento';
export type DocumentType = 'cupom_nao_fiscal' | 'comprovante_pagamento' | 'termo_garantia' | 'nota_fiscal' | 'orcamento';
export type DocumentFormat = 'termica_80mm' | 'a4' | 'pdf';
export type WarrantyStatus = 'ativa' | 'vencida' | 'cancelada';
export type CancelRequestStatus = 'pending' | 'approved' | 'rejected';

// ==================== ORÇAMENTO ====================
export type QuoteStatus = 'pendente' | 'enviado' | 'aprovado' | 'convertido' | 'expirado' | 'cancelado';

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  pendente: 'Pendente',
  enviado: 'Enviado',
  aprovado: 'Aprovado',
  convertido: 'Convertido em Venda',
  expirado: 'Expirado',
  cancelado: 'Cancelado',
};

export const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  pendente: 'bg-gray-100 text-gray-800',
  enviado: 'bg-blue-100 text-blue-800',
  aprovado: 'bg-green-100 text-green-800',
  convertido: 'bg-purple-100 text-purple-800',
  expirado: 'bg-orange-100 text-orange-800',
  cancelado: 'bg-red-100 text-red-800',
};

// ==================== LABELS ====================

export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  draft: 'Rascunho',
  open: 'Aberta',
  paid: 'Paga',
  partial: 'Parcial',
  canceled: 'Cancelada',
  refunded: 'Devolvida',
  partial_refund: 'Dev. Parcial',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  canceled: 'Cancelado',
  refunded: 'Estornado',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  debito: 'Débito',
  credito: 'Crédito',
  link_pagamento: 'Link de Pagamento',
  carteira_digital: 'Carteira Digital',
  fiado: 'Fiado',
};

export const CASH_SESSION_STATUS_LABELS: Record<CashSessionStatus, string> = {
  open: 'Aberto',
  closed: 'Fechado',
};

export const WARRANTY_STATUS_LABELS: Record<WarrantyStatus, string> = {
  ativa: 'Ativa',
  vencida: 'Vencida',
  cancelada: 'Cancelada',
};

// ==================== SALE (VENDA) ====================

export interface Sale {
  id: string;
  numero: number;
  status: SaleStatus;
  
  // Cliente
  cliente_id?: string | null;
  cliente_nome?: string | null;
  cliente_cpf_cnpj?: string | null;
  cliente_telefone?: string | null;
  
  // Vínculo com OS
  ordem_servico_id?: string | null;
  
  // Origem da venda
  sale_origin?: 'PDV' | 'OS' | null;
  technician_id?: string | null; // Obrigatório quando sale_origin = 'OS'
  cashier_user_id?: string | null; // Obrigatório quando sale_origin = 'PDV'
  
  // Valores
  subtotal: number;
  desconto_total: number;
  total: number;
  total_pago: number;
  
  // Vendedor
  vendedor_id?: string | null;
  vendedor_nome?: string | null;
  
  // Observações
  observacoes?: string | null;
  
  // Rascunho
  is_draft: boolean;
  
  // Sessão de caixa
  cash_register_session_id?: string | null;
  
  // Integrações
  financial_integrated?: boolean;
  stock_decremented?: boolean;
  os_faturada?: boolean;
  
  // Timestamps
  created_at: string;
  updated_at?: string | null;
  finalized_at?: string | null;
  canceled_at?: string | null;
  canceled_by?: string | null;
  cancel_reason?: string | null;
  
  // Relacionamentos (opcional, para quando buscar com joins)
  items?: SaleItem[];
  payments?: Payment[];
}

export interface SaleFormData {
  cliente_id?: string;
  cliente_nome?: string;
  cliente_cpf_cnpj?: string;
  cliente_telefone?: string;
  ordem_servico_id?: string;
  vendedor_id?: string;
  observacoes?: string;
  is_draft?: boolean;
  sale_origin?: 'PDV' | 'OS';
  technician_id?: string;
  cashier_user_id?: string;
}

// ==================== SALE ITEM (ITEM DA VENDA) ====================

export interface SaleItem {
  id: string;
  sale_id: string;
  produto_id?: string | null;
  
  // Dados do produto (snapshot)
  produto_nome: string;
  produto_codigo?: string | null;
  produto_codigo_barras?: string | null;
  produto_tipo?: 'produto' | 'servico' | null;
  
  // Quantidade e valores
  quantidade: number;
  valor_unitario: number;
  desconto: number;
  valor_total: number;
  
  // Observação
  observacao?: string | null;
  
  // Garantia
  garantia_dias?: number | null;
  garantia_inicio?: string | null;
  garantia_fim?: string | null;
  
  // Timestamps
  created_at: string;
}

export interface SaleItemFormData {
  produto_id?: string;
  produto_nome: string;
  produto_codigo?: string;
  produto_codigo_barras?: string;
  produto_tipo?: 'produto' | 'servico';
  quantidade: number;
  valor_unitario: number;
  desconto?: number;
  observacao?: string;
  garantia_dias?: number;
}

// ==================== PAYMENT (PAGAMENTO) ====================

export interface Payment {
  id: string;
  sale_id: string;
  
  // Forma de pagamento
  forma_pagamento: PaymentMethod;
  
  // Valores
  valor: number;
  troco: number;
  
  // Parcelamento
  parcelas?: number | null;
  taxa_juros?: number | null;
  valor_parcela?: number | null;
  bandeira?: string | null;
  
  // Status
  status: PaymentStatus;
  
  // Repasse (cartão)
  taxa_cartao?: number | null;
  valor_repasse?: number | null;
  data_repasse?: string | null;
  
  // Link de pagamento
  link_pagamento_url?: string | null;
  link_pagamento_id?: string | null;
  
  // Timestamps
  created_at: string;
  confirmed_at?: string | null;
  canceled_at?: string | null;
  refunded_at?: string | null;
  
  // Auditoria
  confirmed_by?: string | null;
  canceled_by?: string | null;
  refunded_by?: string | null;
  cancel_reason?: string | null;
  refund_reason?: string | null;
}

export interface PaymentFormData {
  forma_pagamento: PaymentMethod;
  valor: number;
  troco?: number;
  parcelas?: number;
  taxa_juros?: number;
  bandeira?: string;
  taxa_cartao?: number;
  valor_repasse?: number | null;
  link_pagamento_url?: string;
}

// ==================== CASH REGISTER SESSION (SESSÃO DE CAIXA) ====================

export interface CashRegisterSession {
  id: string;
  numero: number;
  
  // Operador
  operador_id: string;
  operador_nome: string;
  
  // Valores
  valor_inicial: number;
  valor_final?: number | null;
  valor_esperado?: number | null;
  divergencia?: number | null;
  divergencia_justificativa?: string | null;
  
  // Status
  status: CashSessionStatus;
  
  // Totais por forma de pagamento
  totais_forma_pagamento?: Record<string, number> | null;
  
  // Timestamps
  opened_at: string;
  closed_at?: string | null;
  
  // Fechamento
  closed_by?: string | null;
  assinatura_caixa?: string | null;
}

export interface CashRegisterSessionFormData {
  valor_inicial: number;
  operador_id: string;
}

// ==================== CASH MOVEMENT (MOVIMENTO DE CAIXA) ====================

export interface CashMovement {
  id: string;
  session_id: string;
  tipo: CashMovementType;
  valor: number;
  motivo?: string | null;
  operador_id: string;
  operador_nome: string;
  created_at: string;
}

export interface CashMovementFormData {
  tipo: CashMovementType;
  valor: number;
  motivo?: string;
}

// ==================== WARRANTY (GARANTIA) ====================

export interface Warranty {
  id: string;
  sale_id: string;
  sale_item_id?: string | null;
  ordem_servico_id?: string | null;
  
  // Produto
  produto_id?: string | null;
  produto_nome: string;
  
  // Cliente
  cliente_id?: string | null;
  cliente_nome: string;
  
  // Período
  dias_garantia: number;
  data_inicio: string;
  data_fim: string;
  
  // Regras
  regras?: string | null;
  
  // Status
  status: WarrantyStatus;
  
  // Timestamps
  created_at: string;
  updated_at?: string | null;
}

export interface WarrantyFormData {
  sale_id: string;
  sale_item_id?: string;
  produto_id?: string;
  produto_nome: string;
  cliente_id?: string;
  cliente_nome: string;
  dias_garantia: number;
  regras?: string;
}

// ==================== DOCUMENT (DOCUMENTO) ====================

export interface Document {
  id: string;
  sale_id: string;
  ordem_servico_id?: string | null;
  warranty_id?: string | null;
  
  // Tipo
  tipo: DocumentType;
  formato: DocumentFormat;
  
  // Conteúdo
  conteudo_html?: string | null;
  conteudo_pdf?: Uint8Array | null;
  qr_code_url?: string | null;
  qr_code_data?: string | null;
  
  // Envio
  enviado_whatsapp?: boolean | null;
  whatsapp_enviado_em?: string | null;
  whatsapp_numero?: string | null;
  
  // Timestamps
  created_at: string;
}

// ==================== AUDIT LOG (LOG DE AUDITORIA) ====================

export interface AuditLog {
  id: string;
  user_id: string;
  user_nome: string;
  user_email?: string | null;
  acao: string;
  entidade: string;
  entidade_id?: string | null;
  dados_anteriores?: Record<string, any> | null;
  dados_novos?: Record<string, any> | null;
  descricao?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

// ==================== PERMISSIONS (PERMISSÕES) ====================

export type PermissionAction = 
  | 'desconto_acima_limite'
  | 'cancelar_venda'
  | 'estornar_pagamento'
  | 'editar_venda_fechada'
  | 'abrir_caixa'
  | 'fechar_caixa'
  | 'sangria'
  | 'suprimento'
  | 'visualizar_relatorios'
  | 'gerenciar_estoque';

export interface Permission {
  id: string;
  cargo_id: string;
  acao: PermissionAction;
  limite?: number; // Para desconto, por exemplo
  created_at: string;
}

// ==================== CART ITEM (ITEM DO CARRINHO - CLIENTE) ====================

export interface CartItem {
  produto_id?: string;
  produto_nome: string;
  produto_codigo?: string;
  produto_codigo_barras?: string;
  produto_tipo?: 'produto' | 'servico';
  quantidade: number;
  valor_unitario: number;
  desconto: number; // Valor calculado do desconto em R$
  desconto_percentual?: number; // Percentual de desconto aplicado
  observacao?: string;
  garantia_dias?: number;
  estoque_disponivel?: number; // Quantidade em estoque do produto
}

// ==================== LIMITES DE DESCONTO POR PERFIL ====================
export const LIMITES_DESCONTO_PERFIL: Record<string, number> = {
  admin: 100,       // Admin pode dar até 100% de desconto
  gerente: 30,      // Gerente até 30%
  supervisor: 15,   // Supervisor até 15%
  vendedor: 5,      // Vendedor padrão até 5%
  atendente: 5,     // Atendente até 5%
  member: 5,        // Member padrão até 5%
  default: 5,       // Padrão 5%
};

// ==================== SALE SUMMARY (RESUMO DE VENDA) ====================

export interface SaleSummary {
  subtotal: number;
  desconto_total: number;
  total: number;
  total_pago: number;
  saldo_restante: number;
  quantidade_itens: number;
}

// ==================== CASH SUMMARY (RESUMO DE CAIXA) ====================

export interface CashSummary {
  valor_inicial: number;
  total_vendas: number;
  total_entradas: number;
  total_saidas: number;
  valor_esperado: number;
  valor_final: number;
  divergencia: number;
  totais_por_forma: Record<string, number>;
}

// ==================== REPORT DATA (DADOS DE RELATÓRIO) ====================

export interface SalesReport {
  periodo_inicio: string;
  periodo_fim: string;
  total_vendas: number;
  total_recebido: number;
  quantidade_vendas: number;
  ticket_medio: number;
  vendas_por_vendedor: Array<{
    vendedor_id: string;
    vendedor_nome: string;
    total: number;
    quantidade: number;
  }>;
  vendas_por_forma_pagamento: Array<{
    forma: PaymentMethod;
    total: number;
    quantidade: number;
  }>;
  produtos_mais_vendidos: Array<{
    produto_id: string;
    produto_nome: string;
    quantidade: number;
    total: number;
  }>;
}

// ==================== CANCEL REQUEST (SOLICITAÇÃO DE CANCELAMENTO) ====================

export interface CancelRequest {
  id: string;
  sale_id: string;
  solicitante_id: string;
  solicitante_nome: string;
  solicitante_email?: string | null;
  motivo: string;
  status: CancelRequestStatus;
  aprovado_por?: string | null;
  aprovado_por_nome?: string | null;
  aprovado_em?: string | null;
  motivo_rejeicao?: string | null;
  created_at: string;
  updated_at?: string | null;
  
  // Relacionamentos
  sale?: Sale;
}

export interface CancelRequestFormData {
  motivo: string;
}

export const CANCEL_REQUEST_STATUS_LABELS: Record<CancelRequestStatus, string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
};

// ==================== QUOTE (ORÇAMENTO) ====================

export interface Quote {
  id: string;
  numero: number;
  status: QuoteStatus;
  
  // Cliente
  cliente_id?: string | null;
  cliente_nome?: string | null;
  cliente_cpf_cnpj?: string | null;
  cliente_telefone?: string | null;
  
  // Valores
  subtotal: number;
  desconto_total: number;
  total: number;
  
  // Vendedor
  vendedor_id?: string | null;
  vendedor_nome?: string | null;
  
  // Observações
  observacoes?: string | null;
  
  // Validade
  validade_dias?: number | null;
  data_validade?: string | null;
  
  // Conversão
  sale_id?: string | null;
  converted_at?: string | null;
  
  // Envio
  enviado_whatsapp?: boolean;
  whatsapp_enviado_em?: string | null;
  
  // Timestamps
  created_at: string;
  updated_at?: string | null;
  
  // Relacionamentos
  items?: QuoteItem[];
}

export interface QuoteItem {
  id: string;
  quote_id: string;
  produto_id?: string | null;
  produto_nome: string;
  produto_codigo?: string | null;
  produto_codigo_barras?: string | null;
  produto_tipo?: 'produto' | 'servico' | null;
  quantidade: number;
  valor_unitario: number;
  desconto: number;
  valor_total: number;
  observacao?: string | null;
  created_at: string;
}

export interface QuoteFormData {
  cliente_id?: string;
  cliente_nome?: string;
  cliente_cpf_cnpj?: string;
  cliente_telefone?: string;
  vendedor_id?: string;
  observacoes?: string;
  validade_dias?: number;
}

