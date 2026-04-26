import { useState, useEffect } from 'react';
import { from } from '@/integrations/db/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export interface Position {
  id: string;
  name: string;
  description: string | null;
  level: number;
  permissions: any;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export const usePositions = () => {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchPositions = async () => {
    try {
      setLoading(true);
      const { data, error } = await from('positions')
        .select('*')
        .order('level', { ascending: false })
        .execute();

      if (error) {
        console.error('Error fetching positions:', error);
        toast({
          title: "Erro",
          description: "Erro ao carregar cargos",
          variant: "destructive"
        });
        return;
      }

      setPositions(data || []);
    } catch (error) {
      console.error('Error in fetchPositions:', error);
    } finally {
      setLoading(false);
    }
  };

  const createPosition = async (positionData: Omit<Position, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'permissions'>) => {
    if (!user) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data, error } = await from('positions')
        .insert({
          ...positionData,
          created_by: user.id,
          permissions: []
        })
        .select('*')
        .single();

      if (error) {
        console.error('Error creating position:', error);
        toast({
          title: "Erro",
          description: "Erro ao criar cargo",
          variant: "destructive"
        });
        return;
      }

      setPositions(prev => [data, ...prev]);
      toast({
        title: "Sucesso",
        description: "Cargo criado com sucesso"
      });
    } catch (error) {
      console.error('Error in createPosition:', error);
    }
  };

  const updatePosition = async (id: string, updates: Partial<Position>) => {
    try {
      const { data, error } = await from('positions')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        console.error('Error updating position:', error);
        toast({
          title: "Erro",
          description: "Erro ao atualizar cargo",
          variant: "destructive"
        });
        return;
      }

      setPositions(prev => prev.map(position => 
        position.id === id ? { ...position, ...data } : position
      ));
      
      toast({
        title: "Sucesso",
        description: "Cargo atualizado com sucesso"
      });
    } catch (error) {
      console.error('Error in updatePosition:', error);
    }
  };

  const deletePosition = async (id: string) => {
    try {
      const { error } = await from('positions')
        .eq('id', id)
        .delete();

      if (error) {
        console.error('Error deleting position:', error);
        toast({
          title: "Erro",
          description: "Erro ao excluir cargo",
          variant: "destructive"
        });
        return;
      }

      setPositions(prev => prev.filter(position => position.id !== id));
      toast({
        title: "Sucesso",
        description: "Cargo excluído com sucesso"
      });
    } catch (error) {
      console.error('Error in deletePosition:', error);
    }
  };

  useEffect(() => {
    fetchPositions();
  }, []);

  return {
    positions,
    loading,
    createPosition,
    updatePosition,
    deletePosition,
    refetch: fetchPositions
  };
};