import { useQuery, useQueryClient } from '@tanstack/react-query';
import { from } from '@/integrations/db/client';
import { Marca, Modelo } from '@/types/assistencia';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

// Mapear marca do banco para assistencia.Marca
function mapMarcaFromDB(marcaDB: any): Marca {
  return {
    id: marcaDB.id,
    nome: marcaDB.nome,
    situacao: marcaDB.situacao || 'ativo',
    created_at: marcaDB.created_at || new Date().toISOString(),
  };
}

// Mapear modelo do banco para assistencia.Modelo
function mapModeloFromDB(modeloDB: any): Modelo {
  return {
    id: modeloDB.id,
    marca_id: modeloDB.marca_id,
    nome: modeloDB.nome,
    situacao: modeloDB.situacao || 'ativo',
    created_at: modeloDB.created_at || new Date().toISOString(),
  };
}

export function useMarcasSupabase() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  // Buscar marcas do banco
  const { data: marcasData, isLoading, error } = useQuery({
    queryKey: ['marcas-assistencia'],
    queryFn: async () => {
      console.log('[useMarcas] Buscando marcas...');
      const { data, error } = await from('marcas')
        .select('*')
        .eq('situacao', 'ativo')
        .order('nome', { ascending: true })
        .execute();

      console.log('[useMarcas] Resultado:', { data: data?.length, error });
      if (error) throw error;
      return ((data || []) as any[]).map(mapMarcaFromDB);
    },
  });

  const marcas = marcasData || [];

  // Criar marca - obtém userId internamente
  const createMarca = async (nome: string): Promise<Marca> => {
    const userId = user?.id;
    if (!userId) throw new Error('Usuário não autenticado');

    const { data: novaMarca, error } = await from('marcas')
      .insert({
        nome: nome.trim(),
        situacao: 'ativo',
        created_by: userId,
      })
      .select('*')
      .single();

    if (error) {
      console.error('[createMarca] Erro:', error);
      toast({
        title: 'Erro ao criar marca',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }

    queryClient.invalidateQueries({ queryKey: ['marcas-assistencia'] });
    
    toast({
      title: 'Sucesso',
      description: 'Marca criada com sucesso!',
    });

    return mapMarcaFromDB(novaMarca);
  };

  // Atualizar marca
  const updateMarca = async (id: string, data: Partial<Marca>): Promise<Marca | null> => {
    const { error } = await from('marcas')
      .eq('id', id)
      .update({
        nome: data.nome?.trim(),
        situacao: data.situacao,
      })
      .execute();

    if (error) {
      console.error('[updateMarca] Erro:', error);
      toast({
        title: 'Erro ao atualizar marca',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }

    queryClient.invalidateQueries({ queryKey: ['marcas-assistencia'] });
    queryClient.invalidateQueries({ queryKey: ['modelos-assistencia'] });
    
    toast({
      title: 'Sucesso',
      description: 'Marca atualizada com sucesso!',
    });

    return data as Marca;
  };

  // Deletar marca (soft delete)
  const deleteMarca = async (id: string): Promise<boolean> => {
    const { error } = await from('marcas')
      .eq('id', id)
      .update({ situacao: 'inativo' })
      .execute();

    if (error) {
      console.error('[deleteMarca] Erro:', error);
      toast({
        title: 'Erro ao deletar marca',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }

    queryClient.invalidateQueries({ queryKey: ['marcas-assistencia'] });
    queryClient.invalidateQueries({ queryKey: ['modelos-assistencia'] });
    
    toast({
      title: 'Sucesso',
      description: 'Marca deletada com sucesso!',
    });

    return true;
  };

  // Buscar marca por ID
  const getMarcaById = (id: string): Marca | undefined => {
    return marcas.find(m => m.id === id);
  };

  return {
    marcas,
    isLoading,
    error,
    createMarca,
    updateMarca,
    deleteMarca,
    getMarcaById,
  };
}

export function useModelosSupabase() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  // Buscar modelos do banco
  const { data: modelosData, isLoading, error } = useQuery({
    queryKey: ['modelos-assistencia'],
    queryFn: async () => {
      console.log('[useModelos] Buscando modelos...');
      const { data, error } = await from('modelos')
        .select('*')
        .eq('situacao', 'ativo')
        .order('nome', { ascending: true })
        .execute();

      console.log('[useModelos] Resultado:', { data: data?.length, error });
      if (error) throw error;
      return ((data || []) as any[]).map(mapModeloFromDB);
    },
  });

  const modelos = modelosData || [];

  // Criar modelo - obtém userId internamente
  const createModelo = async (marcaId: string, nome: string): Promise<Modelo> => {
    const userId = user?.id;
    if (!userId) throw new Error('Usuário não autenticado');

    const { data: novoModelo, error } = await from('modelos')
      .insert({
        marca_id: marcaId,
        nome: nome.trim(),
        situacao: 'ativo',
        created_by: userId,
      })
      .select('*')
      .single();

    if (error) {
      console.error('[createModelo] Erro:', error);
      toast({
        title: 'Erro ao criar modelo',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }

    queryClient.invalidateQueries({ queryKey: ['modelos-assistencia'] });
    
    toast({
      title: 'Sucesso',
      description: 'Modelo criado com sucesso!',
    });

    return mapModeloFromDB(novoModelo);
  };

  // Atualizar modelo
  const updateModelo = async (id: string, data: Partial<Modelo>): Promise<Modelo | null> => {
    const { error } = await from('modelos')
      .eq('id', id)
      .update({
        marca_id: data.marca_id,
        nome: data.nome?.trim(),
        situacao: data.situacao,
      })
      .execute();

    if (error) {
      console.error('[updateModelo] Erro:', error);
      toast({
        title: 'Erro ao atualizar modelo',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }

    queryClient.invalidateQueries({ queryKey: ['modelos-assistencia'] });
    
    toast({
      title: 'Sucesso',
      description: 'Modelo atualizado com sucesso!',
    });

    return data as Modelo;
  };

  // Deletar modelo (soft delete)
  const deleteModelo = async (id: string): Promise<boolean> => {
    const { error } = await from('modelos')
      .eq('id', id)
      .update({ situacao: 'inativo' })
      .execute();

    if (error) {
      console.error('[deleteModelo] Erro:', error);
      toast({
        title: 'Erro ao deletar modelo',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }

    queryClient.invalidateQueries({ queryKey: ['modelos-assistencia'] });
    
    toast({
      title: 'Sucesso',
      description: 'Modelo deletado com sucesso!',
    });

    return true;
  };

  // Buscar modelo por ID
  const getModeloById = (id: string): Modelo | undefined => {
    return modelos.find(m => m.id === id);
  };

  // Buscar modelos por marca
  const getModelosByMarca = (marcaId: string): Modelo[] => {
    return modelos.filter(m => m.marca_id === marcaId && m.situacao !== 'inativo');
  };

  return {
    modelos,
    isLoading,
    error,
    createModelo,
    updateModelo,
    deleteModelo,
    getModeloById,
    getModelosByMarca,
  };
}

// Hook combinado para marcas e modelos
export function useMarcasModelosSupabase() {
  const { marcas, getMarcaById, createMarca } = useMarcasSupabase();
  const { modelos, getModeloById, getModelosByMarca, createModelo } = useModelosSupabase();

  return {
    marcas,
    modelos,
    getMarcaById,
    getModeloById,
    getModelosByMarca,
    createMarca,
    createModelo,
  };
}

