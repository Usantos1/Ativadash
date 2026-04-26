import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { from } from '@/integrations/db/client';
import { useCompanySegment } from '@/hooks/useCompanySegment';
import { CHECKLIST_ITENS_OFICINA } from '@/types/assistencia';

export interface ChecklistConfigItem {
  id: string;
  tipo: 'entrada' | 'saida';
  item_id: string;
  nome: string;
  categoria: 'fisico' | 'funcional';
  ordem: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export function useChecklistConfig(tipo?: 'entrada' | 'saida') {
  const queryClient = useQueryClient();
  const { segmentoSlug } = useCompanySegment();
  const isOficina = segmentoSlug === 'oficina_mecanica';

  // Buscar todos os itens de checklist
  const { data: itemsFromApi = [], isLoading } = useQuery({
    queryKey: ['checklist_config', tipo],
    queryFn: async () => {
      let query = from('os_checklist_config')
        .select('*')
        .order('ordem', { ascending: true });

      if (tipo) {
        query = query.eq('tipo', tipo);
      }

      const { data, error } = await query.execute();

      if (error) throw error;
      return (data || []) as ChecklistConfigItem[];
    },
  });

  // Criar item
  const createItem = useMutation({
    mutationFn: async (item: Omit<ChecklistConfigItem, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await from('os_checklist_config')
        .insert(item)
        .select('*')
        .single();

      if (error) throw error;
      return data as ChecklistConfigItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist_config'] });
    },
  });

  // Atualizar item
  const updateItem = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ChecklistConfigItem> & { id: string }) => {
      const { data, error } = await from('os_checklist_config')
        .eq('id', id)
        .update(updates)
        .select('*')
        .single();

      if (error) throw error;
      return data as ChecklistConfigItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist_config'] });
    },
  });

  // Deletar item
  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await from('os_checklist_config')
        .eq('id', id)
        .delete();

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist_config'] });
    },
  });

  // Oficina: quando não há itens no banco, usar checklist de veículo
  const items: ChecklistConfigItem[] = isOficina && itemsFromApi.length === 0
    ? CHECKLIST_ITENS_OFICINA.map((it, idx) => ({
        id: `oficina_${it.id}`,
        tipo: 'entrada' as const,
        item_id: it.id,
        nome: it.nome,
        categoria: it.categoria,
        ordem: idx,
        ativo: true,
        created_at: '',
        updated_at: '',
      }))
    : itemsFromApi;

  // Filtrar por tipo e categoria (all vs ativos)
  const itemsEntradaAll = items.filter(i => i.tipo === 'entrada');
  const itemsSaidaAll = items.filter(i => i.tipo === 'saida');
  const itemsEntrada = itemsEntradaAll.filter(i => i.ativo);
  const itemsSaida = itemsSaidaAll.filter(i => i.ativo);
  const itemsFisico = items.filter(i => i.categoria === 'fisico');
  const itemsFuncional = items.filter(i => i.categoria === 'funcional');

  return {
    items,
    itemsEntrada,
    itemsSaida,
    itemsEntradaAll,
    itemsSaidaAll,
    itemsFisico,
    itemsFuncional,
    isLoading,
    createItem,
    updateItem,
    deleteItem,
  };
}

