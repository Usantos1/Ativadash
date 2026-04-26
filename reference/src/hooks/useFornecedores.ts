import { useQuery, useQueryClient } from '@tanstack/react-query';
import { from } from '@/integrations/db/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Fornecedor } from '@/types/assistencia';

export function useFornecedores() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: fornecedores = [], isLoading } = useQuery({
    queryKey: ['fornecedores'],
    queryFn: async () => {
      const { data, error } = await from('fornecedores')
        .select('*')
        .order('nome', { ascending: true })
        .execute();
      if (error) throw error;
      return (data || []) as Fornecedor[];
    },
  });

  const createFornecedor = async (nome: string): Promise<Fornecedor> => {
    const { data: novo, error } = await from('fornecedores')
      .insert({ nome: nome.trim() })
      .select('*')
      .single();
    if (error) {
      toast({ title: 'Erro ao criar fornecedor', description: error.message, variant: 'destructive' });
      throw error;
    }
    queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
    toast({ title: 'Fornecedor cadastrado', description: `${nome.trim()} adicionado.` });
    return novo as Fornecedor;
  };

  const updateFornecedor = async (id: string, nome: string): Promise<Fornecedor> => {
    const nomeTrim = nome.trim();
    if (!nomeTrim) {
      toast({ title: 'Nome inválido', description: 'Informe o nome do fornecedor.', variant: 'destructive' });
      throw new Error('Nome obrigatório');
    }
    const { data: atualizado, error } = await from('fornecedores')
      .update({ nome: nomeTrim })
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      toast({ title: 'Erro ao editar fornecedor', description: error.message, variant: 'destructive' });
      throw error;
    }
    queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
    toast({ title: 'Fornecedor atualizado', description: 'Nome alterado com sucesso.' });
    return atualizado as Fornecedor;
  };

  const deleteFornecedor = async (id: string): Promise<void> => {
    // A desvinculação dos itens de OS é feita no servidor antes do DELETE (evita 500 no update/os_items)
    const { error } = await from('fornecedores').delete().eq('id', id).execute();
    if (error) {
      toast({ title: 'Erro ao excluir fornecedor', description: error.message, variant: 'destructive' });
      throw error;
    }
    queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
    toast({ title: 'Fornecedor excluído', description: 'Fornecedor removido do cadastro.' });
  };

  return { fornecedores, isLoading, createFornecedor, updateFornecedor, deleteFornecedor };
}
