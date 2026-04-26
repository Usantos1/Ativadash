import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { from } from '@/integrations/db/client';
import { Produto, ProdutoFormData } from '@/types/assistencia';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

// Mapear produto do Supabase para tipo assistencia.Produto (exportado para uso em InventarioDialog etc.)
export function mapSupabaseToAssistencia(supabaseProduto: any): Produto {
  return {
    id: supabaseProduto.id,
    
    // Identificação
    codigo: supabaseProduto.codigo || undefined,
    nome: supabaseProduto.nome || '',
    nome_abreviado: supabaseProduto.nome_abreviado || undefined,
    codigo_barras: supabaseProduto.codigo_barras || undefined,
    referencia: supabaseProduto.referencia || undefined,
    marca: supabaseProduto.marca || undefined,
    modelo: supabaseProduto.modelo || undefined,
    grupo: supabaseProduto.grupo || undefined,
    sub_grupo: supabaseProduto.sub_grupo || undefined,
    
    // Preço (BRL) - Busca em múltiplos campos, prioriza valor > 0
    valor_compra: Number(supabaseProduto.valor_compra > 0 ? supabaseProduto.valor_compra : (supabaseProduto.vi_compra > 0 ? supabaseProduto.vi_compra : (supabaseProduto.vi_custo || 0))),
    valor_venda: Number(supabaseProduto.valor_venda > 0 ? supabaseProduto.valor_venda : (supabaseProduto.valor_dinheiro_pix || 0)),
    valor_parcelado_6x: supabaseProduto.valor_parcelado_6x ? Number(supabaseProduto.valor_parcelado_6x) : undefined,
    margem_percentual: supabaseProduto.margem_percentual ? Number(supabaseProduto.margem_percentual) : undefined,
    permitir_desconto_percentual: supabaseProduto.permitir_desconto_percentual ? Number(supabaseProduto.permitir_desconto_percentual) : undefined,
    
    // Estoque
    quantidade: Number(supabaseProduto.quantidade || 0),
    estoque_minimo: supabaseProduto.estoque_minimo ? Number(supabaseProduto.estoque_minimo) : undefined,
    estoque_grade: supabaseProduto.estoque_grade && typeof supabaseProduto.estoque_grade === 'object'
      ? { tipo: supabaseProduto.estoque_grade.tipo || 'cor', itens: supabaseProduto.estoque_grade.itens || {} }
      : undefined,
    localizacao: supabaseProduto.localizacao || undefined,
    unidade: supabaseProduto.unidade || undefined,
    
    // Configurações
    situacao: (supabaseProduto.situacao || 'ATIVO') as 'ATIVO' | 'INATIVO',
    tipo: (supabaseProduto.tipo || 'PECA') as 'PECA' | 'SERVICO' | 'PRODUTO',
    garantia_dias: supabaseProduto.garantia_dias ? Number(supabaseProduto.garantia_dias) : undefined,
    peso_kg: supabaseProduto.peso_kg ? Number(supabaseProduto.peso_kg) : undefined,
    
    // Campos internos
    created_at: supabaseProduto.created_at || new Date().toISOString(),
    updated_at: supabaseProduto.updated_at || undefined,
    
    // Compatibilidade com código antigo (deprecated)
    descricao: supabaseProduto.nome || '',
    descricao_abreviada: supabaseProduto.nome_abreviado || undefined,
    categoria: supabaseProduto.grupo || undefined,
    preco_custo: Number(supabaseProduto.valor_compra > 0 ? supabaseProduto.valor_compra : (supabaseProduto.vi_compra > 0 ? supabaseProduto.vi_compra : (supabaseProduto.vi_custo || 0))),
    preco_venda: Number(supabaseProduto.valor_venda > 0 ? supabaseProduto.valor_venda : (supabaseProduto.valor_dinheiro_pix || 0)),
    margem_lucro: supabaseProduto.margem_percentual ? Number(supabaseProduto.margem_percentual) : undefined,
    estoque_atual: Number(supabaseProduto.quantidade || 0),
    modelo_compativel: supabaseProduto.modelo || undefined,
  } as Produto;
}

// Mapear produto assistencia.Produto para Supabase (exportado para uso em InventarioDialog etc.)
// Nunca enviar: id, created_at, updated_at, criado_em, atualizado_em, criado_por
export function mapAssistenciaToSupabase(produto: Partial<Produto>): any {
  const payload: any = {};

  // Identificação
  if (produto.nome !== undefined) {
    payload.nome = produto.nome.toUpperCase();
  } else if (produto.descricao !== undefined) {
    payload.nome = produto.descricao.toUpperCase();
  }
  
  if (produto.nome_abreviado !== undefined) {
    payload.nome_abreviado = produto.nome_abreviado;
  } else if (produto.descricao_abreviada !== undefined) {
    payload.nome_abreviado = produto.descricao_abreviada;
  }
  
  if (produto.codigo !== undefined) {
    payload.codigo = produto.codigo;
  }
  
  if (produto.codigo_barras !== undefined) {
    payload.codigo_barras = produto.codigo_barras;
  }
  
  if (produto.referencia !== undefined) {
    payload.referencia = produto.referencia;
  }
  
  if (produto.marca !== undefined) {
    payload.marca = produto.marca;
  }
  
  if (produto.modelo !== undefined) {
    payload.modelo = produto.modelo;
  } else if (produto.modelo_compativel !== undefined) {
    payload.modelo = produto.modelo_compativel;
  }
  
  if (produto.grupo !== undefined) {
    payload.grupo = produto.grupo;
  } else if (produto.categoria !== undefined) {
    payload.grupo = produto.categoria;
  }
  
  if (produto.sub_grupo !== undefined) {
    payload.sub_grupo = produto.sub_grupo;
  }

  // Preço (BRL) - só enviar se tiver valor
  if (produto.valor_compra !== undefined) {
    payload.valor_compra = produto.valor_compra;
  } else if (produto.preco_custo !== undefined) {
    payload.valor_compra = produto.preco_custo;
  }
  
  if (produto.valor_venda !== undefined) {
    payload.valor_venda = produto.valor_venda;
    // Manter compatibilidade com campo antigo
    payload.valor_dinheiro_pix = produto.valor_venda;
  } else if (produto.preco_venda !== undefined) {
    payload.valor_venda = produto.preco_venda;
    payload.valor_dinheiro_pix = produto.preco_venda;
  }
  
  if (produto.valor_parcelado_6x !== undefined) {
    payload.valor_parcelado_6x = produto.valor_parcelado_6x;
  }
  
  if (produto.margem_percentual !== undefined) {
    payload.margem_percentual = produto.margem_percentual;
  } else if (produto.margem_lucro !== undefined) {
    payload.margem_percentual = produto.margem_lucro;
  }
  
  if (produto.permitir_desconto_percentual !== undefined) {
    payload.permitir_desconto_percentual = produto.permitir_desconto_percentual;
  }

  // Estoque - só enviar se tiver valor
  if (produto.quantidade !== undefined) {
    payload.quantidade = produto.quantidade;
  } else if (produto.estoque_atual !== undefined) {
    payload.quantidade = produto.estoque_atual;
  }
  
  if (produto.estoque_minimo !== undefined) {
    payload.estoque_minimo = produto.estoque_minimo;
  }

  if (produto.estoque_grade !== undefined) {
    payload.estoque_grade = produto.estoque_grade;
  }
  
  if (produto.localizacao !== undefined) {
    payload.localizacao = produto.localizacao;
  }
  
  if (produto.unidade !== undefined) {
    payload.unidade = produto.unidade;
  }

  // Configurações
  if (produto.situacao !== undefined) {
    payload.situacao = produto.situacao;
  }
  
  if (produto.tipo !== undefined) {
    payload.tipo = produto.tipo;
  }
  
  if (produto.garantia_dias !== undefined) {
    payload.garantia_dias = produto.garantia_dias;
  }
  
  if (produto.peso_kg !== undefined) {
    payload.peso_kg = produto.peso_kg;
  }

  // Remover campos que não devem ser enviados
  delete payload.id;
  delete payload.created_at;
  delete payload.updated_at;
  delete payload.criado_em;
  delete payload.atualizado_em;
  delete payload.criado_por;

  return payload;
}

export function useProdutosSupabase() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();

  // Buscar produtos do Supabase
  const { data: produtosData, isLoading, error } = useQuery({
    queryKey: ['produtos-assistencia'],
    queryFn: async () => {
      // Buscar todos os produtos sem limite
      // Usar paginação para buscar todos
      let allData: any[] = [];
      let offset = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await from('produtos')
          .select('*')
          .order('nome', { ascending: true })
          .range(offset, offset + pageSize - 1)
          .execute();

        if (error) throw error;
        
        const rows = data || [];
        if (rows.length > 0) {
          allData = [...allData, ...rows];
          offset += pageSize;
          hasMore = rows.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      return allData.map(mapSupabaseToAssistencia);
    },
  });

  const produtos = produtosData || [];

  // Criar produto
  const createProduto = useCallback(async (data: Partial<Produto>): Promise<Produto> => {
    if (!user) throw new Error('Usuário não autenticado');

    const produtoSupabase = mapAssistenciaToSupabase(data);
    
    // Remover campos que não existem na tabela
    delete produtoSupabase.tipo;
    
    const { data: novoProduto, error } = await from('produtos')
      .insert({
        ...produtoSupabase,
        criado_por: user.id,
      });

    if (error) {
      toast({
        title: 'Erro ao criar produto',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }

    const created = mapSupabaseToAssistencia(novoProduto?.data || novoProduto);
    try {
      await from('audit_logs').insert({
        user_id: user.id,
        user_nome: profile?.display_name || user.email || 'Usuário',
        user_email: user.email,
        acao: 'create',
        entidade: 'produto',
        entidade_id: created?.id,
        dados_anteriores: null,
        dados_novos: { nome: created?.nome, codigo: created?.codigo },
        descricao: `Produto criado: ${created?.nome || ''}`,
        user_agent: navigator.userAgent,
      }).execute();
    } catch (e) {
      console.warn('Erro ao registrar log de auditoria (produto):', e);
    }

    queryClient.invalidateQueries({ queryKey: ['produtos-assistencia'] });
    
    toast({
      title: 'Sucesso',
      description: 'Produto criado com sucesso!',
    });

    return created;
  }, [queryClient, user, profile]);

  // Atualizar produto
  const updateProduto = useCallback(async (
    id: string,
    data: Partial<Produto>,
    options?: { skipMovementLog?: boolean }
  ) => {
    // Buscar estado anterior para auditoria e movimentações
    const { data: oldRow, error: oldErr } = await from('produtos')
      .select('id, nome, quantidade, valor_dinheiro_pix, valor_venda, vi_custo, valor_compra')
      .eq('id', id)
      .single();

    if (oldErr && oldErr.code !== 'PGRST116') {
      console.warn('[updateProduto] Erro ao buscar estado anterior:', oldErr);
    }

    const produtoSupabase = mapAssistenciaToSupabase(data);
    
    // Remover campos que não existem na tabela
    delete produtoSupabase.tipo;
    
    const { error } = await from('produtos')
      .eq('id', id)
      .update(produtoSupabase);

    if (error) {
      console.error('[updateProduto] Erro:', error);
      toast({
        title: 'Erro ao atualizar produto',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }

    try {
      await from('audit_logs').insert({
        user_id: user?.id,
        user_nome: profile?.display_name || user?.email || 'Usuário',
        user_email: user?.email,
        acao: 'update',
        entidade: 'produto',
        entidade_id: id,
        dados_anteriores: oldRow || null,
        dados_novos: data,
        descricao: `Produto atualizado: ${(oldRow as any)?.nome || id}`,
        user_agent: navigator.userAgent,
      }).execute();
    } catch (e) {
      console.warn('Erro ao registrar log de auditoria (produto):', e);
    }

    queryClient.invalidateQueries({ queryKey: ['produtos-assistencia'] });
    queryClient.invalidateQueries({ queryKey: ['produto_movimentacoes'] });
    
    // Registrar movimentações internas (estoque/preço/custo)
    if (!options?.skipMovementLog) {
      try {
        if (oldRow) {
          const beforeQtd = Number((oldRow as any)?.quantidade ?? 0);
          const afterQtd = data.quantidade !== undefined ? Number(data.quantidade ?? 0) : beforeQtd;
          const beforeVenda = Number((oldRow as any)?.valor_dinheiro_pix ?? (oldRow as any)?.valor_venda ?? 0);
          const afterVenda = data.valor_venda !== undefined ? Number(data.valor_venda ?? 0) : beforeVenda;
          const beforeCusto = Number((oldRow as any)?.vi_custo ?? (oldRow as any)?.valor_compra ?? 0);
          const afterCusto =
            (data as any).preco_custo !== undefined
              ? Number((data as any).preco_custo ?? 0)
              : (data as any).valor_compra !== undefined
                ? Number((data as any).valor_compra ?? 0)
                : beforeCusto;

          const userNome = profile?.display_name || user?.email || 'Usuário';
          const movements: any[] = [];

          if (afterQtd !== beforeQtd) {
            movements.push({
              produto_id: id,
              tipo: 'ajuste_estoque',
              motivo: 'Edição manual do produto',
              quantidade_antes: beforeQtd,
              quantidade_depois: afterQtd,
              quantidade_delta: afterQtd - beforeQtd,
              user_id: user?.id || null,
              user_nome: userNome,
            });
          }

          if (afterVenda !== beforeVenda) {
            movements.push({
              produto_id: id,
              tipo: 'ajuste_preco_venda',
              motivo: 'Edição manual do produto',
              valor_venda_antes: beforeVenda,
              valor_venda_depois: afterVenda,
              user_id: user?.id || null,
              user_nome: userNome,
            });
          }

          if (afterCusto !== beforeCusto) {
            movements.push({
              produto_id: id,
              tipo: 'ajuste_preco_custo',
              motivo: 'Edição manual do produto',
              valor_custo_antes: beforeCusto,
              valor_custo_depois: afterCusto,
              user_id: user?.id || null,
              user_nome: userNome,
            });
          }

          if (movements.length > 0) {
            const { error: movErr } = await from('produto_movimentacoes')
              .insert(movements)
              .execute();
            if (movErr) {
              console.error('[updateProduto] Falha ao registrar movimentação:', movErr);
            }
          }
        }
      } catch (auditErr) {
        console.error('[updateProduto] Falha ao registrar movimentação interna:', auditErr);
      }
    }
    
    toast({
      title: 'Sucesso',
      description: 'Produto atualizado com sucesso!',
    });
  }, [queryClient, user, profile]);

  // Deletar produto (soft delete - marcar como inativo)
  const deleteProduto = useCallback(async (id: string) => {
    const { data: oldRow } = await from('produtos').select('id, nome').eq('id', id).single().execute();
    const { error } = await from('produtos')
      .eq('id', id)
      .update({ situacao: 'INATIVO' });

    if (error) {
      toast({
        title: 'Erro ao deletar produto',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }

    if (user) {
      try {
        await from('audit_logs').insert({
          user_id: user.id,
          user_nome: profile?.display_name || user.email || 'Usuário',
          user_email: user.email,
          acao: 'delete',
          entidade: 'produto',
          entidade_id: id,
          dados_anteriores: oldRow || null,
          dados_novos: null,
          descricao: `Produto excluído (inativo): ${(oldRow as any)?.nome || id}`,
          user_agent: navigator.userAgent,
        }).execute();
      } catch (e) {
        console.warn('Erro ao registrar log de auditoria (produto):', e);
      }
    }

    queryClient.invalidateQueries({ queryKey: ['produtos-assistencia'] });
    
    toast({
      title: 'Sucesso',
      description: 'Produto deletado com sucesso!',
    });
  }, [queryClient, user, profile]);

  // Grupos (mock - não temos grupos no Supabase ainda)
  const grupos = useMemo(() => [], []);

  // Buscar produtos por query (nome, código, código de barras, referência)
  const searchProdutos = useCallback((query: string): Produto[] => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase().trim();
    console.log('[useProdutosSupabase] Buscando produtos:', {
      query,
      totalProdutos: produtos.length,
      produtosAtivos: produtos.filter(p => p.situacao === 'ATIVO' || !p.situacao).length
    });
    
    const produtosAtivos = produtos.filter(p => !p.situacao || p.situacao === 'ATIVO');
    
    const resultados = produtosAtivos.filter(p => {
      const nomeMatch = p.nome?.toLowerCase().includes(q);
      const codigoMatch = p.codigo?.toString().includes(query);
      const codigoBarrasMatch = p.codigo_barras?.toLowerCase().includes(q);
      const referenciaMatch = p.referencia?.toLowerCase().includes(q);
      
      return nomeMatch || codigoMatch || codigoBarrasMatch || referenciaMatch;
    });
    
    console.log('[useProdutosSupabase] Resultados da busca:', {
      total: resultados.length,
      amostra: resultados.slice(0, 5).map(p => ({
        nome: p.nome,
        quantidade: p.quantidade,
        situacao: p.situacao
      }))
    });
    
    return resultados;
  }, [produtos]);

  // Buscar produto por ID
  const getProdutoById = useCallback((id: string): Produto | undefined => {
    return produtos.find(p => p.id === id);
  }, [produtos]);

  return {
    produtos: produtos.filter(p => p.situacao === 'ATIVO' || !p.situacao), // Filtrar apenas ativos
    grupos,
    isLoading,
    createProduto,
    updateProduto,
    deleteProduto,
    searchProdutos,
    getProdutoById,
  };
}

// Alias para compatibilidade
export const useProdutos = useProdutosSupabase;

