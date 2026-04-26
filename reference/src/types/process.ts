export interface Category {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface MediaFile {
  id: string;
  name: string;
  type: 'image' | 'video' | 'document';
  url: string;
  size: string;
}

export interface FlowNode {
  id: string;
  type: string;
  data: {
    label: string;
    [key: string]: any;
  };
  position: { x: number; y: number };
  [key: string]: any;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  [key: string]: any;
}

export interface Process {
  id: string;
  name: string;
  objective: string;
  department: Department;
  owner: string;
  participants: string[];
  activities: Activity[];
  metrics: string[];
  automations?: string[];
  tags: string[];
  priority: number;
  mediaFiles?: MediaFile[];
  flowNodes?: FlowNode[];
  flowEdges?: FlowEdge[];
  youtubeVideoId?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'draft' | 'active' | 'review' | 'archived';
  categoryId?: string;
  category?: Category;
}

export interface Activity {
  id: string;
  step: number;
  description: string;
  responsible: string;
  estimatedTime: string;
  tools: string[];
  notes?: string;
}

export type Department = 
  | 'comercial'
  | 'tecnico' 
  | 'administrativo'
  | 'marketing'
  | 'pos-venda'
  | 'suporte-online';

export const DEPARTMENTS = {
  comercial: 'Comercial (Atendimento / Vendas)',
  tecnico: 'Técnico (Reparos e Testes)',
  administrativo: 'Administrativo (Financeiro, Compras, Estoque)',
  marketing: 'Marketing',
  'pos-venda': 'Pós-venda',
  'suporte-online': 'Suporte Online (WhatsApp / Redes Sociais)'
} as const;

export const OWNERS = [
  'Mirela',
  'João',
  'Carlos',
  'Ana',
  'Pedro',
  'Lucia'
];

export const COMMON_TAGS = [
  'atendimento',
  'vendas',
  'conserto',
  'whatsapp',
  'triagem',
  'qualidade',
  'ativa-crm',
  'celular',
  'orçamento',
  'entrega'
];