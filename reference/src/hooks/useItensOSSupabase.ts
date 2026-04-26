import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { from } from '@/integrations/db/client';
import { useAuth } from '@/contexts/AuthContext';
import { ItemOS } from '@/types/assistencia';

export function useItensOSSupabase(osId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Validar se osId é um UUID válido (formato básico)
  const isValidUUID = (id: string | undefined | null): boolean => {
    if (!id || id === 'temp' || id === 'undefined' || id === 'null') return false;
    // Formato básico de UUID: 8-4-4-4-12 caracteres hexadecimais
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  };

  const validOsId = isValidUUID(osId) ? osId : undefined;

  // Buscar itens da OS (staleTime reduz refetch em massa e ajuda a evitar 429)
  const { data: itens = [], isLoading } = useQuery({
    queryKey: ['os_items', validOsId],
    queryFn: async () => {
      if (!validOsId) return [];
      
      const { data, error } = await from('os_items')
        .select('*')
        .eq('ordem_servico_id', validOsId)
        .order('created_at', { ascending: true })
        .execute();
      
      if (error) throw error;
      return (data || []) as ItemOS[];
    },
    enabled: !!validOsId,
    staleTime: 60 * 1000, // 1 minuto
    refetchOnWindowFocus: false,
  });

  // Calcular total
  const total = itens.reduce((acc, i) => acc + Number(i.valor_total || 0), 0);

  // Adicionar item
  const addItem = useMutation({
    mutationFn: async (data: Omit<ItemOS, 'id' | 'ordem_servico_id' | 'created_at'>): Promise<ItemOS> => {
      console.log('[useItensOS] addItem chamado com osId:', osId);
      console.log('[useItensOS] data:', data);
      
      if (!osId || osId === 'temp' || osId === 'undefined' || !isValidUUID(osId)) {
        console.error('[useItensOS] ERRO: osId inválido:', osId);
        throw new Error('OS deve ser criada antes de adicionar itens');
      }

      const novoItem: any = {
        ordem_servico_id: osId,
        produto_id: data.produto_id || null,
        tipo: data.tipo,
        descricao: data.descricao,
        quantidade: data.quantidade,
        valor_unitario: data.valor_unitario,
        valor_minimo: data.valor_minimo || 0,
        desconto: data.desconto || 0,
        valor_total: data.valor_total,
        garantia: data.garantia || 0,
        colaborador_id: data.colaborador_id || null,
        colaborador_nome: data.colaborador_nome || null,
        fornecedor_id: data.fornecedor_id || null,
        fornecedor_nome: data.fornecedor_nome || null,
        com_aro: (data as any).com_aro || null,
        grade_cor: (data as any).grade_cor || null,
        created_by: user?.id || null,
      };

      console.log('[useItensOS] Inserindo item:', novoItem);

      let result = await from('os_items').insert(novoItem).select().single();
      let { data: inserted, error } = result;

      // API retorna { error: "mensagem" }; hook usa error.message ou error.error
      const errorMsg = (error && (typeof (error as any).error === 'string' ? (error as any).error : (error as any).message)) || '';
      const isColumnMissing = String(errorMsg).includes('does not exist');

      // Se falhar por coluna inexistente (migration não rodada), tenta sem campos opcionais
      if (error && isColumnMissing) {
        console.warn('[useItensOS] Coluna(s) inexistente(s). Execute as migrations (fornecedor, com_aro, grade_cor). Tentando inserir sem esses campos.');
        const fallback: any = {
          ordem_servico_id: osId,
          produto_id: data.produto_id || null,
          tipo: data.tipo,
          descricao: data.descricao,
          quantidade: data.quantidade,
          valor_unitario: data.valor_unitario,
          valor_minimo: data.valor_minimo || 0,
          desconto: data.desconto || 0,
          valor_total: data.valor_total,
          garantia: data.garantia || 0,
          colaborador_id: data.colaborador_id || null,
          colaborador_nome: data.colaborador_nome || null,
          created_by: user?.id || null,
        };
        result = await from('os_items').insert(fallback).select().single();
        inserted = result.data;
        error = result.error;
      }

      console.log('[useItensOS] Resultado insert:', { inserted, error });

      if (error) {
        console.error('[useItensOS] ERRO no insert:', error);
        const msg = (error as any).error || (error as any).message || 'Erro ao adicionar item';
        throw new Error(typeof msg === 'string' ? msg : 'Erro ao adicionar item');
      }
      
      if (!inserted) {
        console.error('[useItensOS] ERRO: Insert retornou null');
        throw new Error('Erro ao adicionar item - dados não retornados');
      }
      
      return inserted as ItemOS;
    },
    onSuccess: (data) => {
      console.log('[useItensOS] Item adicionado com sucesso:', data);
      queryClient.invalidateQueries({ queryKey: ['os_items', osId] });
      queryClient.invalidateQueries({ queryKey: ['os_items_all'] });
    },
    onError: (error: any) => {
      console.error('[useItensOS] Erro na mutation addItem:', error);
    },
  });

  // UUID vazio no PostgreSQL gera 500; normalizar para null
  const uuidKeys = ['produto_id', 'colaborador_id', 'fornecedor_id'];
  const asUuid = (v: unknown): string | null => {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v !== 'string') return v as string;
    const s = v.trim();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ? s : null;
  };

  // Só enviar colunas que existem na base (fornecedor_* pode não existir se a migração 005 não foi aplicada)
  const allowedUpdateKeys = [
    'tipo', 'produto_id', 'descricao', 'quantidade', 'valor_unitario', 'valor_minimo',
    'desconto', 'valor_total', 'garantia', 'colaborador_id', 'colaborador_nome', 'com_aro', 'grade_cor'
  ];

  // Atualizar item (remove undefined, garante números e UUID válidos, evita colunas inexistentes)
  const updateItem = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ItemOS> }): Promise<ItemOS> => {
      const numericKeys = ['quantidade', 'valor_unitario', 'valor_minimo', 'desconto', 'valor_total', 'garantia'];
      const payload: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        if (value === undefined) continue;
        if (!allowedUpdateKeys.includes(key)) continue;
        if (numericKeys.includes(key)) {
          const n = Number(value);
          payload[key] = Number.isFinite(n) ? n : 0;
        } else if (uuidKeys.includes(key)) {
          payload[key] = asUuid(value);
        } else {
          payload[key] = value;
        }
      }
      const { data: updated, error } = await from('os_items')
        .eq('id', id)
        .update(payload)
        .select()
        .single();

      if (error) throw error;
      return updated as ItemOS;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['os_items', osId] });
      queryClient.invalidateQueries({ queryKey: ['os_items_all'] });
    },
  });

  // Mapeia com_aro do item para a chave da grade no produto (Com Aro / Sem Aro)
  const comAroToGradeKey = (v: string | null): string | null => {
    if (!v) return null;
    const k = String(v).toLowerCase();
    if (k === 'com_aro') return 'Com Aro';
    if (k === 'sem_aro') return 'Sem Aro';
    return v;
  };

  // Encontra a chave da grade por cor no produto (case-insensitive), para devolução bater com o cadastro
  const findGradeCorKey = (itens: Record<string, number>, itemCor: string): string | null => {
    if (!itemCor || !itens || typeof itens !== 'object') return null;
    const busca = String(itemCor).trim().toLowerCase();
    if (!busca) return null;
    const key = Object.keys(itens).find((k) => k.trim().toLowerCase() === busca);
    return key ?? null;
  };

  // Remover item: primeiro deletar da OS (para não bloquear em falha de estoque); depois devolver estoque na grade correta
  const removeItem = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { data: item, error: fetchError } = await from('os_items')
        .select('id, produto_id, quantidade, tipo, ordem_servico_id, com_aro, grade_cor')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;
      if (!item) throw new Error('Item não encontrado');

      const itemAny = item as any;

      // 1) Deletar o item da OS primeiro — assim a remoção nunca falha por causa da devolução de estoque
      const { error: deleteError } = await from('os_items')
        .eq('id', id)
        .delete();

      if (deleteError) throw deleteError;

      // 2) Se tinha produto_id, devolver ao estoque na grade correta (best-effort; falha não bloqueia)
      if (item.produto_id) {
        try {
          const { data: produto, error: produtoError } = await from('produtos')
            .select('id, quantidade, estoque_grade')
            .eq('id', item.produto_id)
            .single();

          if (produtoError || !produto) {
            console.warn('Devolução estoque: produto não encontrado ou erro ao buscar:', produtoError);
            return;
          }

          const quantidadeDevolver = Number(item.quantidade || 0);
          const prodAny = produto as any;
          const grade = prodAny?.estoque_grade && typeof prodAny.estoque_grade === 'object'
            ? { tipo: String(prodAny.estoque_grade.tipo || 'aro'), itens: prodAny.estoque_grade.itens || {} }
            : null;

          let payload: { quantidade: number; estoque_grade?: { tipo: string; itens: Record<string, number> } };

          if (grade?.itens && Object.keys(grade.itens).length > 0 && quantidadeDevolver > 0) {
            let gradeKey: string | null = null;
            if (grade.tipo === 'aro' && itemAny?.com_aro) {
              gradeKey = comAroToGradeKey(itemAny.com_aro);
            }
            if (grade.tipo === 'cor' && itemAny?.grade_cor) {
              gradeKey = findGradeCorKey(grade.itens, itemAny.grade_cor);
            }
            if (gradeKey != null && grade.itens[gradeKey] != null) {
              const valorAtual = Number(grade.itens[gradeKey]) || 0;
              const novoValor = valorAtual + quantidadeDevolver;
              const newItens: Record<string, number> = {};
              for (const k of Object.keys(grade.itens)) {
                newItens[k] = k === gradeKey ? novoValor : (Number(grade.itens[k]) || 0);
              }
              const newTotal = Object.values(newItens).reduce((a, b) => a + b, 0);
              payload = { quantidade: newTotal, estoque_grade: { tipo: grade.tipo, itens: newItens } };
            } else {
              const quantidadeAtual = Number(produto.quantidade || 0);
              payload = { quantidade: quantidadeAtual + quantidadeDevolver };
            }
          } else {
            const quantidadeAtual = Number(produto.quantidade || 0);
            payload = { quantidade: quantidadeAtual + quantidadeDevolver };
          }

          const updateResult = await from('produtos')
            .update(payload)
            .eq('id', item.produto_id)
            .execute();

          if ((updateResult as any)?.error) {
            console.warn('Devolução estoque: falha ao atualizar produto (grade/quantidade):', (updateResult as any).error);
            return;
          }

          const quantidadeAntes = Number(produto.quantidade || 0);
          const quantidadeDepois = payload.quantidade;

          let osNumero = 0;
          try {
            const { data: os } = await from('ordens_servico')
              .select('numero')
              .eq('id', item.ordem_servico_id)
              .single();
            osNumero = os?.numero || 0;
          } catch (e) {
            console.warn('Erro ao buscar número da OS:', e);
          }

          const userNome = user?.user_metadata?.name || user?.email || 'Sistema';
          await from('produto_movimentacoes')
            .insert({
              produto_id: item.produto_id,
              tipo: 'devolucao_os',
              motivo: `Item removido da OS #${osNumero || '?'}`,
              quantidade_antes: quantidadeAntes,
              quantidade_depois: quantidadeDepois,
              quantidade_delta: quantidadeDevolver,
              user_id: user?.id || null,
              user_nome: userNome,
            })
            .execute();

          console.log(`✅ Estoque devolvido (grade): produto ${item.produto_id}, ${quantidadeAntes} → ${quantidadeDepois} (+${quantidadeDevolver})`);
        } catch (estoqueError) {
          console.error('Erro ao devolver estoque (item já removido da OS):', estoqueError);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['os_items', osId] });
      queryClient.invalidateQueries({ queryKey: ['os_items_all'] });
      queryClient.invalidateQueries({ queryKey: ['produto_movimentacoes'] });
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.invalidateQueries({ queryKey: ['produtos-paginated'] });
    },
  });

  return {
    itens,
    total,
    isLoading,
    addItem: addItem.mutateAsync,
    updateItem: (id: string, data: Partial<ItemOS>) => updateItem.mutateAsync({ id, data }),
    removeItem: removeItem.mutateAsync,
    isAddingItem: addItem.isPending,
    isUpdatingItem: updateItem.isPending,
    isRemovingItem: removeItem.isPending,
  };
}
