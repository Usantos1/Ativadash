import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { from } from '@/integrations/db/client';
import { from } from '@/integrations/db/client'; // Mantido para auth.getUser()
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export type Produto = {
  id: string;
  nome: string;
  marca: string;
  modelo: string;
  qualidade: string;
  valor_dinheiro_pix: number;
  valor_parcelado_6x?: number;
  criado_em: string;
  atualizado_em: string;
  criado_por: string;
};

export type CreateProdutoData = Omit<Produto, 'id' | 'criado_em' | 'atualizado_em' | 'criado_por'>;
export type UpdateProdutoData = Partial<CreateProdutoData>;

export function useProducts(limit = 50, search = '') {
  return useInfiniteQuery({
    queryKey: ['produtos', limit, search],
    queryFn: async ({ pageParam = 0 }) => {
      const offset = pageParam * limit;
      
      let query = from('produtos')
        .select('*')
        .order('atualizado_em', { ascending: false });

      // Apply filters
      if (search) {
        query = query.ilike('nome', `%${search}%`);
      }

      // Apply pagination
      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query.execute();

      if (error) {
        throw error;
      }

      const rows = data || [];
      return {
        produtos: rows as Produto[],
        total: rows.length, // Não temos count exato ainda, usar length
        nextPage: rows.length === limit ? pageParam + 1 : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateProdutoData) => {
      const { user } = useAuth();
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data: result, error } = await from('produtos')
        .insert({ 
          ...data,
          criado_por: user.id 
        });

      if (error) {
        throw error;
      }

      return result?.data || result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      toast({
        title: 'Sucesso',
        description: 'Produto criado com sucesso!',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao criar produto',
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateProdutoData }) => {
      if (!id) {
        throw new Error('ID do produto ausente');
      }
      
      const { data: result, error } = await from('produtos')
        .eq('id', id)
        .update(data);

      if (error) {
        throw error;
      }

      return result?.data || result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      toast({
        title: 'Sucesso',
        description: 'Produto atualizado com sucesso!',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao atualizar produto',
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await from('produtos')
        .eq('id', id)
        .delete();

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      toast({
        title: 'Sucesso',
        description: 'Produto excluído com sucesso!',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao excluir produto',
        variant: 'destructive',
      });
    },
  });
}

export function useBulkUpsertProducts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (products: CreateProdutoData[]) => {
      const results = {
        inserted: 0,
        updated: 0,
        errors: [] as string[],
      };

      for (const product of products) {
        try {
          // Check if product exists (case-insensitive name)
          const { data: existingData, error: searchError } = await from('produtos')
            .select('id')
            .ilike('nome', product.nome)
            .single();

          if (searchError && searchError.code !== 'PGRST116') {
            results.errors.push(`Erro ao verificar produto "${product.nome}": ${searchError.message}`);
            continue;
          }

          const existing = existingData?.data || existingData;

          if (existing) {
            // Update existing
            const { error: updateError } = await from('produtos')
              .eq('id', existing.id)
              .update(product);

            if (updateError) {
              results.errors.push(`Erro ao atualizar "${product.nome}": ${updateError.message}`);
            } else {
              results.updated++;
            }
          } else {
            // Insert new
            const { user } = useAuth();
            if (!user) throw new Error('Usuário não autenticado');
            
            const { error: insertError } = await from('produtos')
              .insert({ 
                ...product,
                criado_por: user.id 
              });

            if (insertError) {
              results.errors.push(`Erro ao inserir "${product.nome}": ${insertError.message}`);
            } else {
              results.inserted++;
            }
          }
        } catch (error: any) {
          results.errors.push(`Erro inesperado com "${product.nome}": ${error.message}`);
        }
      }

      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      
      const messages = [];
      if (results.inserted > 0) messages.push(`${results.inserted} inseridos`);
      if (results.updated > 0) messages.push(`${results.updated} atualizados`);
      if (results.errors.length > 0) messages.push(`${results.errors.length} erros`);

      toast({
        title: 'Importação concluída',
        description: messages.join(', '),
        variant: results.errors.length > 0 ? 'destructive' : 'default',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro na importação',
        description: error.message || 'Erro inesperado durante a importação',
        variant: 'destructive',
      });
    },
  });
}