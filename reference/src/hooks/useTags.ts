import { useState, useEffect } from 'react';
import { from } from '@/integrations/db/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Tag {
  id: string;
  name: string;
  color: string;
  icon: string;
  description?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export const useTags = () => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchTags = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .order('name')
        .execute();

      if (error) {
        console.error('Error fetching tags:', error);
        toast.error('Erro ao carregar tags');
        return;
      }

      setTags(data || []);
    } catch (error) {
      console.error('Error in fetchTags:', error);
      toast.error('Erro ao carregar tags');
    } finally {
      setLoading(false);
    }
  };

  const createTag = async (tagData: Omit<Tag, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
    if (!user) return false;

    try {
      const { data, error } = await supabase
        .from('tags')
        .insert([{
          ...tagData,
          created_by: user.id
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating tag:', error);
        toast.error('Erro ao criar tag');
        return false;
      }

      setTags(prev => [data, ...prev]);
      toast.success('Tag criada com sucesso!');
      return true;
    } catch (error) {
      console.error('Error in createTag:', error);
      toast.error('Erro ao criar tag');
      return false;
    }
  };

  const updateTag = async (id: string, updates: Partial<Tag>) => {
    try {
      const { data, error } = await supabase
        .from('tags')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating tag:', error);
        toast.error('Erro ao atualizar tag');
        return false;
      }

      setTags(prev => prev.map(tag => tag.id === id ? data : tag));
      toast.success('Tag atualizada com sucesso!');
      return true;
    } catch (error) {
      console.error('Error in updateTag:', error);
      toast.error('Erro ao atualizar tag');
      return false;
    }
  };

  const deleteTag = async (id: string) => {
    try {
      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting tag:', error);
        toast.error('Erro ao excluir tag');
        return false;
      }

      setTags(prev => prev.filter(tag => tag.id !== id));
      toast.success('Tag excluída com sucesso!');
      return true;
    } catch (error) {
      console.error('Error in deleteTag:', error);
      toast.error('Erro ao excluir tag');
      return false;
    }
  };

  useEffect(() => {
    fetchTags();
  }, []);

  return {
    tags,
    loading,
    createTag,
    updateTag,
    deleteTag,
    refetch: fetchTags
  };
};