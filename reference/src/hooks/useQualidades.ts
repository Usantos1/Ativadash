import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { from } from '@/integrations/db/client';
import { authAPI } from '@/integrations/auth/api-client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export type Qualidade = {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type CreateQualidadeData = {
  name: string;
  description?: string;
};

export type UpdateQualidadeData = Partial<CreateQualidadeData>;

// Fetch all qualidades
export function useQualidades() {
  return useQuery({
    queryKey: ['qualidades'],
    queryFn: async () => {
      const { data, error } = await from('product_qualities')
        .select('*')
        .order('name')
        .execute();

      if (error) throw error;
      return data as Qualidade[];
    },
  });
}

// Create qualidade
export function useCreateQualidade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateQualidadeData) => {
      const { data: result, error } = await from('product_qualities')
        .insert([
          {
            name: data.name,
            description: data.description || null,
            created_by: (await authAPI.getUser()).data.user?.id || '',
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qualidades'] });
      toast.success('Qualidade criada com sucesso');
    },
    onError: (error: any) => {
      toast.error(`Erro ao criar qualidade: ${error.message}`);
    },
  });
}

// Update qualidade
export function useUpdateQualidade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateQualidadeData }) => {
      const { data: result, error } = await from('product_qualities')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qualidades'] });
      toast.success('Qualidade atualizada com sucesso');
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar qualidade: ${error.message}`);
    },
  });
}

// Delete qualidade
export function useDeleteQualidade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await from('product_qualities')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qualidades'] });
      toast.success('Qualidade deletada com sucesso');
    },
    onError: (error: any) => {
      toast.error(`Erro ao deletar qualidade: ${error.message}`);
    },
  });
}
