export const CATEGORIAS: Record<string, string> = {
  operacional: 'Operacional',
  financeiro: 'Financeiro',
  comercial: 'Comercial',
  gestao: 'Gestão',
};

export const DIAS_SEMANA = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
];

export type CategoriaSlug = 'operacional' | 'financeiro' | 'comercial' | 'gestao';
