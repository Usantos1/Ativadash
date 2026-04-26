// ==========================================
// TIPOS PARA SISTEMA DE ASSISTÊNCIA TÉCNICA
// ==========================================

// ==================== TIPOS BASE ====================

export type TipoAparelho = 'celular' | 'tablet' | 'notebook' | 'outro' | 'veiculo';
export type TipoPessoa = 'fisica' | 'juridica';
export type TipoCliente = 'cliente' | 'fornecedor' | 'ambos';
export type TipoProduto = 'PECA' | 'SERVICO' | 'PRODUTO';

export const TIPO_PRODUTO_LABELS: Record<TipoProduto, string> = {
  PECA: 'Peça',
  PRODUTO: 'Produto',
  SERVICO: 'Serviço',
};

export type TipoItemOS = 'peca' | 'servico' | 'mao_de_obra';
export type FormaPagamento = 'dinheiro' | 'pix' | 'credito' | 'debito' | 'boleto' | 'transferencia';

// ==================== STATUS DA OS ====================

export type StatusOS = 
  | 'aberta'
  | 'aguardando_orcamento'
  | 'orcamento_enviado'
  | 'aprovado'
  | 'em_andamento'
  | 'aguardando_peca'
  | 'finalizada'
  | 'aguardando_retirada'
  | 'entregue'
  | 'cancelada';

export const STATUS_OS_LABELS: Record<StatusOS, string> = {
  aberta: 'Aberta',
  aguardando_orcamento: 'Aguardando Orçamento',
  orcamento_enviado: 'Orçamento Enviado',
  aprovado: 'Aprovado',
  em_andamento: 'Em Andamento',
  aguardando_peca: 'Aguardando Peça',
  finalizada: 'Finalizada',
  aguardando_retirada: 'Aguardando Retirada',
  entregue: 'Entregue',
  cancelada: 'Cancelada',
};

export const STATUS_OS_COLORS: Record<StatusOS, string> = {
  aberta: 'bg-blue-500',
  aguardando_orcamento: 'bg-yellow-500',
  orcamento_enviado: 'bg-orange-500',
  aprovado: 'bg-green-500',
  em_andamento: 'bg-purple-500',
  aguardando_peca: 'bg-red-500',
  finalizada: 'bg-emerald-500',
  aguardando_retirada: 'bg-cyan-500',
  entregue: 'bg-gray-500',
  cancelada: 'bg-gray-400',
};

/** Labels para status extras (fora do tipo StatusOS) usados no sistema */
export const EXTRA_STATUS_OS_LABELS: Record<string, string> = {
  entregue_faturada: 'Entregue Faturada',
  entregue_sem_reparo: 'Entregue Sem Reparo',
  manutencao_finalizada: 'Manutenção Finalizada',
  manutenção_finalizada: 'Manutenção Finalizada', // alias para compatibilidade
};

/** Cores para status extras (Manutenção Finalizada = emerald como na config) */
export const EXTRA_STATUS_OS_COLORS: Record<string, string> = {
  entregue_faturada: 'bg-gray-500',
  entregue_sem_reparo: 'bg-gray-600',
  manutencao_finalizada: 'bg-emerald-500',
  manutenção_finalizada: 'bg-emerald-500',
};

/** Retorna o label do status (sempre legível; fallback: formata o código) */
export function getStatusOSLabel(status: string | undefined): string {
  if (!status) return '-';
  const s = status as StatusOS;
  return (
    STATUS_OS_LABELS[s] ??
    EXTRA_STATUS_OS_LABELS[status] ??
    status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  );
}

/** Retorna a cor do badge do status */
export function getStatusOSColor(status: string | undefined): string {
  if (!status) return 'bg-gray-500';
  return (
    STATUS_OS_COLORS[status as StatusOS] ??
    EXTRA_STATUS_OS_COLORS[status] ??
    'bg-gray-500'
  );
}

// ==================== CONFIGURAÇÃO DE STATUS ====================

/** Ação executada ao mudar a OS para este status */
export type AcaoStatusOS = 'nenhuma' | 'fechar_os' | 'cancelar_os';

export interface ConfiguracaoStatus {
  id: string;
  status: StatusOS | string; // Permite status customizados além dos pré-definidos
  label: string;
  cor: string;
  notificar_whatsapp: boolean;
  mensagem_whatsapp?: string;
  ordem: number;
  ativo: boolean;
  /** Ação ao mudar para este status: fechar OS, cancelar OS ou nenhuma */
  acao?: AcaoStatusOS;
}

export const STATUS_OS_PADRAO: ConfiguracaoStatus[] = [
  { id: '1', status: 'aberta', label: 'Aberta', cor: 'bg-blue-500', notificar_whatsapp: false, ordem: 1, ativo: true, acao: 'nenhuma' },
  { id: '2', status: 'aguardando_orcamento', label: 'Aguardando Orçamento', cor: 'bg-yellow-500', notificar_whatsapp: false, ordem: 2, ativo: true, acao: 'nenhuma' },
  { id: '3', status: 'orcamento_enviado', label: 'Orçamento Enviado', cor: 'bg-orange-500', notificar_whatsapp: true, mensagem_whatsapp: 'Olá {cliente}! O orçamento da sua OS #{numero} está pronto.', ordem: 3, ativo: true, acao: 'nenhuma' },
  { id: '4', status: 'aprovado', label: 'Aprovado', cor: 'bg-green-500', notificar_whatsapp: false, ordem: 4, ativo: true, acao: 'nenhuma' },
  { id: '5', status: 'em_andamento', label: 'Em Andamento', cor: 'bg-purple-500', notificar_whatsapp: false, ordem: 5, ativo: true, acao: 'nenhuma' },
  { id: '6', status: 'aguardando_peca', label: 'Aguardando Peça', cor: 'bg-red-500', notificar_whatsapp: true, mensagem_whatsapp: 'Olá {cliente}! Sua OS #{numero} está aguardando peça.', ordem: 6, ativo: true, acao: 'nenhuma' },
  { id: '7', status: 'finalizada', label: 'Finalizada', cor: 'bg-emerald-500', notificar_whatsapp: true, mensagem_whatsapp: 'Olá {cliente}! Seu aparelho da OS #{numero} está pronto!', ordem: 7, ativo: true, acao: 'nenhuma' },
  { id: '8', status: 'aguardando_retirada', label: 'Aguardando Retirada', cor: 'bg-cyan-500', notificar_whatsapp: false, ordem: 8, ativo: true, acao: 'nenhuma' },
  { id: '9', status: 'entregue', label: 'Entregue', cor: 'bg-gray-500', notificar_whatsapp: true, mensagem_whatsapp: 'Obrigado pela preferência!', ordem: 9, ativo: true, acao: 'fechar_os' },
  { id: '10', status: 'cancelada', label: 'Cancelada', cor: 'bg-gray-400', notificar_whatsapp: false, ordem: 10, ativo: true, acao: 'cancelar_os' },
];

// ==================== CHECKLIST ====================

export interface ChecklistItem {
  id: string;
  nome: string;
  categoria: 'fisico' | 'funcional';
}

export const CHECKLIST_ITENS: ChecklistItem[] = [
  // Estado Físico
  { id: 'tela_trincada', nome: 'Tela Trincada', categoria: 'fisico' },
  { id: 'tela_riscada', nome: 'Tela Riscada', categoria: 'fisico' },
  { id: 'tampa_trincada', nome: 'Tampa Traseira Trincada', categoria: 'fisico' },
  { id: 'tampa_riscada', nome: 'Tampa Traseira Riscada', categoria: 'fisico' },
  { id: 'aro_amassado', nome: 'Aro/Lateral Amassado', categoria: 'fisico' },
  { id: 'aro_riscado', nome: 'Aro/Lateral Riscado', categoria: 'fisico' },
  { id: 'botoes_quebrados', nome: 'Botões Quebrados', categoria: 'fisico' },
  { id: 'camera_trincada', nome: 'Lente da Câmera Trincada', categoria: 'fisico' },
  { id: 'entrada_danificada', nome: 'Entrada Carregamento Danificada', categoria: 'fisico' },
  
  // Estado Funcional
  { id: 'touch_ok', nome: 'Touch Funcionando', categoria: 'funcional' },
  { id: 'display_ok', nome: 'Display Funcionando', categoria: 'funcional' },
  { id: 'som_ok', nome: 'Som Funcionando', categoria: 'funcional' },
  { id: 'microfone_ok', nome: 'Microfone Funcionando', categoria: 'funcional' },
  { id: 'camera_traseira_ok', nome: 'Câmera Traseira Funcionando', categoria: 'funcional' },
  { id: 'camera_frontal_ok', nome: 'Câmera Frontal Funcionando', categoria: 'funcional' },
  { id: 'wifi_ok', nome: 'Wi-Fi Funcionando', categoria: 'funcional' },
  { id: 'bluetooth_ok', nome: 'Bluetooth Funcionando', categoria: 'funcional' },
  { id: 'carregamento_ok', nome: 'Carregamento Funcionando', categoria: 'funcional' },
  { id: 'bateria_ok', nome: 'Bateria em Bom Estado', categoria: 'funcional' },
  { id: 'biometria_ok', nome: 'Biometria Funcionando', categoria: 'funcional' },
  { id: 'face_id_ok', nome: 'Face ID Funcionando', categoria: 'funcional' },
  { id: 'sensores_ok', nome: 'Sensores Funcionando', categoria: 'funcional' },
  { id: 'botoes_ok', nome: 'Botões Funcionando', categoria: 'funcional' },
  { id: 'vibracall_ok', nome: 'Vibracall Funcionando', categoria: 'funcional' },
];

/** Checklist de entrada para OFICINA MECÂNICA (veículo) — problemas e itens funcionais */
export const CHECKLIST_ITENS_OFICINA: ChecklistItem[] = [
  // Problemas encontrados (físico)
  { id: 'lataria_amassada', nome: 'Lataria amassada', categoria: 'fisico' },
  { id: 'lataria_riscada', nome: 'Lataria riscada', categoria: 'fisico' },
  { id: 'parachoque_danificado', nome: 'Para-choque danificado', categoria: 'fisico' },
  { id: 'farol_trincado', nome: 'Farol trincado/queimado', categoria: 'fisico' },
  { id: 'luneta_trincada', nome: 'Luneta/vidro trincado', categoria: 'fisico' },
  { id: 'porta_amassada', nome: 'Porta amassada', categoria: 'fisico' },
  { id: 'pneu_desgastado', nome: 'Pneu desgastado', categoria: 'fisico' },
  { id: 'interior_danificado', nome: 'Interior danificado', categoria: 'fisico' },
  // Funcional OK
  { id: 'motor_ok', nome: 'Motor funcionando', categoria: 'funcional' },
  { id: 'freios_ok', nome: 'Freios em ordem', categoria: 'funcional' },
  { id: 'direcao_ok', nome: 'Direção em ordem', categoria: 'funcional' },
  { id: 'eletrica_ok', nome: 'Parte elétrica OK', categoria: 'funcional' },
  { id: 'ar_condicionado_ok', nome: 'Ar-condicionado funcionando', categoria: 'funcional' },
  { id: 'iluminacao_ok', nome: 'Iluminação funcionando', categoria: 'funcional' },
  { id: 'buzina_ok', nome: 'Buzina funcionando', categoria: 'funcional' },
  { id: 'limpador_ok', nome: 'Limpador de parabrisa OK', categoria: 'funcional' },
  { id: 'oleo_ok', nome: 'Nível de óleo OK', categoria: 'funcional' },
  { id: 'refrigerante_ok', nome: 'Nível de refrigerante OK', categoria: 'funcional' },
];

// ==================== CLIENTE ====================

export interface Cliente {
  id: string;
  codigo?: number;
  tipo_pessoa: TipoPessoa;
  tipo_cliente?: TipoCliente;
  situacao?: 'ativo' | 'inativo';
  
  // Dados pessoais
  nome: string;
  nome_fantasia?: string;
  cpf_cnpj?: string;
  rg?: string;
  sexo?: 'M' | 'F' | 'O';
  data_nascimento?: string;
  
  // Endereço
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  uf?: string;
  
  // Contato
  telefone?: string;
  telefone2?: string;
  email?: string;
  whatsapp?: string;
  
  // Outros
  observacoes?: string;
  ativo?: boolean;
  limite_credito?: number;
  
  // Metadata
  created_at: string;
  updated_at?: string;
}

export interface ClienteFormData {
  tipo_pessoa: TipoPessoa;
  nome: string;
  nome_fantasia?: string;
  cpf_cnpj?: string;
  rg?: string;
  sexo?: 'M' | 'F' | 'O';
  data_nascimento?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  telefone?: string;
  telefone2?: string;
  email?: string;
  whatsapp?: string;
}

// ==================== MARCA E MODELO ====================

export interface Marca {
  id: string;
  nome: string;
  situacao?: 'ativo' | 'inativo';
  ativo?: boolean;
  created_at?: string;
}

export interface Modelo {
  id: string;
  marca_id: string;
  nome: string;
  situacao?: 'ativo' | 'inativo';
  ativo?: boolean;
  created_at?: string;
}

// ==================== PRODUTO ====================

export interface Produto {
  id: string;
  
  // Identificação
  codigo?: number;
  nome: string; // descricao no Supabase
  nome_abreviado?: string; // descricao_abreviada no Supabase
  codigo_barras?: string;
  referencia?: string;
  marca?: string;
  modelo?: string;
  grupo?: string;
  sub_grupo?: string;
  
  // Preço (BRL)
  valor_compra?: number; // preco_custo no Supabase
  valor_venda?: number; // preco_venda no Supabase
  valor_parcelado_6x?: number;
  margem_percentual?: number; // margem_lucro no Supabase
  permitir_desconto_percentual?: number;
  
  // Estoque
  quantidade: number; // estoque_atual no Supabase (total; se estoque_grade existe, é a soma dos itens)
  estoque_minimo?: number;
  localizacao?: string;
  unidade?: string; // Unidade, Caixa, Kit, Pcs, etc.
  /** Grade: por cor (tampas) ou com/sem aro (telas). itens = variante -> quantidade */
  estoque_grade?: { tipo: 'cor' | 'aro'; itens: Record<string, number> };

  // Configurações
  situacao?: 'ATIVO' | 'INATIVO';
  tipo?: TipoProduto;
  garantia_dias?: number;
  peso_kg?: number;
  
  // Campos internos (não enviar no payload)
  created_at?: string;
  updated_at?: string;
  
  // Compatibilidade com código antigo (deprecated)
  descricao?: string; // usar nome
  descricao_abreviada?: string; // usar nome_abreviado
  categoria?: string; // usar grupo
  preco_custo?: number; // usar valor_compra
  preco_venda?: number; // usar valor_venda
  margem_lucro?: number; // usar margem_percentual
  estoque_atual?: number; // usar quantidade
  modelo_compativel?: string; // usar modelo
}

export interface ProdutoFormData {
  // Identificação
  codigo?: number;
  nome: string;
  nome_abreviado?: string;
  codigo_barras?: string;
  referencia?: string;
  marca?: string;
  modelo?: string;
  grupo?: string;
  sub_grupo?: string;
  
  // Preço (BRL)
  valor_compra?: number;
  valor_venda?: number;
  valor_parcelado_6x?: number;
  margem_percentual?: number;
  permitir_desconto_percentual?: number;
  
  // Estoque
  quantidade: number;
  estoque_minimo?: number;
  localizacao?: string;
  unidade?: string;
  estoque_grade?: { tipo: 'cor' | 'aro'; itens: Record<string, number> };

  // Configurações
  situacao?: 'ATIVO' | 'INATIVO';
  tipo?: TipoProduto;
  garantia_dias?: number;
  peso_kg?: number;
}

// ==================== CARGO ====================

export type Cargo = 'tecnico' | 'vendedor' | 'atendente' | 'admin';

export const CARGOS_LABELS: Record<Cargo, string> = {
  tecnico: 'Técnico',
  vendedor: 'Vendedor',
  atendente: 'Atendente',
  admin: 'Administrador',
};

// ==================== ORDEM DE SERVIÇO ====================

export interface OrdemServico {
  id: string;
  numero: number;
  situacao: 'aberta' | 'fechada' | 'cancelada';
  status: StatusOS | string; // Permite status customizados
  
  // Datas
  data_entrada: string;
  hora_entrada?: string;
  previsao_entrega?: string;
  hora_previsao?: string;
  data_conclusao?: string;
  data_entrega?: string;
  data_saida?: string;
  
  // Cliente
  cliente_id: string;
  cliente_nome?: string;
  cliente_empresa?: string; // Nome da empresa (se existir)
  telefone_contato: string; // Obrigatório
  
  // Aparelho
  tipo_aparelho: TipoAparelho | string;
  marca_id?: string;
  marca_nome?: string;
  modelo_id?: string;
  modelo_nome?: string;
  imei?: string;
  numero_serie?: string;
  cor?: string;
  senha_aparelho?: string;
  senha_numerica?: string; // Para iPhone
  padrao_desbloqueio?: string; // Padrão de desbloqueio (bolinhas)
  possui_senha: boolean;
  possui_senha_tipo?: string; // Tipo de senha: 'sim', 'nao', 'deslizar', 'nao_sabe', 'nao_autorizou'
  deixou_aparelho: boolean;
  apenas_agendamento: boolean; // Se é apenas agendamento ou deixou aparelho
  
  // Problema
  descricao_problema: string;
  descricao_servico?: string;
  problema_constatado?: string; // Problema constatado na resolução
  laudo_tecnico?: string;
  
  // Resolução
  tecnico_id?: string;
  tecnico_nome?: string;
  servico_executado?: string; // Serviço executado
  
  // Checklist
  checklist_entrada: string[];
  checklist_saida?: string[];
  checklist_saida_aprovado?: boolean; // Se o aparelho foi aprovado no checklist de saída
  observacoes_checklist?: string; // Observações gerais do checklist de entrada
  observacoes_checklist_saida?: string; // Observações do checklist de saída (ressalvas)
  checklist_entrada_realizado_por_id?: string;
  checklist_entrada_realizado_por_nome?: string;
  checklist_entrada_realizado_em?: string;
  checklist_saida_realizado_por_id?: string;
  checklist_saida_realizado_por_nome?: string;
  checklist_saida_realizado_em?: string;
  areas_defeito: string[];
  
  // Condições
  condicoes_equipamento?: string;
  observacoes?: string;
  observacoes_internas?: string; // Informações técnicas internas
  
  // Orçamento pré-autorizado
  orcamento_parcelado?: number; // Valor parcelado (débito/crédito até 6x)
  orcamento_desconto?: number; // Valor com desconto (dinheiro/PIX)
  orcamento_autorizado?: boolean;
  apenas_orcamento?: boolean; // Se true, cupom sai sem valor (apenas orçamento)
  
  // Valores
  subtotal?: number;
  desconto?: number;
  valor_total: number;
  valor_pago?: number;
  
  // Vendedor/Atendente
  vendedor_id?: string;
  vendedor_nome?: string;
  atendente_id?: string;
  atendente_nome?: string;
  
  // Garantia
  garantia_dias?: number;
  
  // Fotos
  fotos_entrada?: string[];
  fotos_saida?: string[];
  fotos_processo?: string[];
  fotos_telegram_entrada?: Array<{
    url?: string;
    thumbnailUrl?: string; // URL do thumbnail (menor resolução)
    postLink?: string; // Link do post no Telegram (quando url não está disponível)
    fileName?: string;
    tipo: 'entrada' | 'processo' | 'saida';
    enviadoEm?: string;
    messageId?: number;
    fileId?: string;
    chatId?: string; // Chat ID para deletar a mensagem
  }>; // Informações das fotos enviadas para Telegram (entrada)
  fotos_telegram_processo?: Array<{
    url?: string;
    thumbnailUrl?: string; // URL do thumbnail (menor resolução)
    postLink?: string; // Link do post no Telegram (quando url não está disponível)
    fileName?: string;
    tipo: 'entrada' | 'processo' | 'saida';
    enviadoEm?: string;
    messageId?: number;
    fileId?: string;
    chatId?: string; // Chat ID para deletar a mensagem
  }>; // Informações das fotos enviadas para Telegram (processo)
  fotos_telegram_saida?: Array<{
    url?: string;
    thumbnailUrl?: string; // URL do thumbnail (menor resolução)
    postLink?: string; // Link do post no Telegram (quando url não está disponível)
    fileName?: string;
    tipo: 'entrada' | 'processo' | 'saida';
    enviadoEm?: string;
    messageId?: number;
    fileId?: string;
    chatId?: string; // Chat ID para deletar a mensagem
  }>; // Informações das fotos enviadas para Telegram (saída)
  telegram_chat_id_entrada?: string; // Chat ID do Telegram para fotos de entrada
  telegram_chat_id_processo?: string; // Chat ID do Telegram para fotos de processo
  telegram_chat_id_saida?: string; // Chat ID do Telegram para fotos de saída
  fotos_drive_folder_id?: string; // ID da pasta no Google Drive (deprecated)
  
  // Metadata
  created_at: string;
  updated_at?: string;
}

export interface OrdemServicoFormData {
  cliente_id: string;
  telefone_contato: string; // Obrigatório
  tipo_aparelho: string;
  marca_id?: string;
  modelo_id?: string;
  imei?: string;
  numero_serie?: string;
  cor?: string;
  operadora?: string;
  senha_aparelho?: string;
  senha_numerica?: string; // Para iPhone
  padrao_desbloqueio?: string; // Padrão de desbloqueio
  possui_senha: boolean;
  possui_senha_tipo?: string; // 'sim', 'nao', 'deslizar', 'nao_sabe', 'nao_autorizou'
  deixou_aparelho: boolean;
  apenas_agendamento: boolean;
  descricao_problema: string;
  condicoes_equipamento?: string;
  previsao_entrega?: string;
  hora_previsao?: string;
  observacoes?: string;
  observacoes_internas?: string;
  checklist_entrada: string[];
  areas_defeito: string[];
  observacoes_checklist?: string;
  checklist_entrada_realizado_por_id?: string;
  checklist_entrada_realizado_por_nome?: string;
  checklist_entrada_realizado_em?: string;
  // Resolução
  problema_constatado?: string;
  tecnico_id?: string;
  servico_executado?: string;
  // Orçamento
  orcamento_parcelado?: number;
  orcamento_desconto?: number;
  orcamento_autorizado?: boolean;
}

// ==================== ITENS DA OS ====================

export interface ItemOS {
  id: string;
  os_id?: string;
  ordem_servico_id?: string;
  produto_id?: string;
  tipo: TipoItemOS;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_minimo?: number;
  desconto: number;
  valor_total: number;
  garantia?: number; // Garantia por item (em dias)
  colaborador_id?: string;
  colaborador_nome?: string;
  /** Fornecedor da peça — apenas controle interno (não sai no cupom de faturamento) */
  fornecedor_id?: string | null;
  fornecedor_nome?: string | null;
  /** Com aro / Sem aro — apenas controle interno (não sai no cupom) */
  com_aro?: 'com_aro' | 'sem_aro' | null;
  /** Cor da grade (quando produto tem grade por cor) — controle e exibição na OS */
  grade_cor?: string | null;
  created_at: string;
}

export interface Fornecedor {
  id: string;
  company_id?: string | null;
  nome: string;
  created_at: string;
  updated_at?: string | null;
}

// ==================== PAGAMENTOS ====================

export interface Pagamento {
  id: string;
  os_id: string;
  tipo: 'adiantamento' | 'pagamento_final';
  forma_pagamento: FormaPagamento;
  valor: number;
  data_pagamento: string;
  observacoes?: string;
  created_at: string;
}

export interface PagamentoOS {
  id: string;
  ordem_servico_id: string;
  valor: number;
  forma_pagamento: FormaPagamento;
  parcelas?: number;
  data_pagamento: string;
  observacao?: string;
  tipo: 'adiantamento' | 'pagamento_final';
  created_at: string;
}

// ==================== ESTATÍSTICAS ====================

export interface EstatisticasOS {
  total: number;
  abertas: number;
  emAndamento: number;
  aguardando: number;
  finalizadas: number;
  entregues: number;
  atrasadas: number;
  valorTotal: number;
  valorPendente: number;
}
