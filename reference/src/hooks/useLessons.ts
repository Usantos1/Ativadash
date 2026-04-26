import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { from } from '@/integrations/db/client';
import { useToast } from '@/hooks/use-toast';

export function useLessons(moduleId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: lessons, isLoading } = useQuery({
    queryKey: ['training-lessons', moduleId],
    queryFn: async () => {
      if (!moduleId) return [];
      
      const { data, error } = await from('training_lessons')
        .select('*')
        .eq('module_id', moduleId)
        .order('order_index', { ascending: true })
        .execute();
      
      if (error) throw error;
      return data;
    },
    enabled: !!moduleId
  });

  const createLesson = useMutation({
    mutationFn: async (lesson: any) => {
      const { data, error } = await from('training_lessons')
        .insert(lesson)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-lessons'] });
      queryClient.invalidateQueries({ queryKey: ['training-modules'] });
      toast({ title: 'Aula criada com sucesso' });
    },
    onError: () => {
      toast({ title: 'Erro ao criar aula', variant: 'destructive' });
    }
  });

  const updateLesson = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { error } = await from('training_lessons')
        .update(updates)
        .eq('id', id)
        .execute();
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-lessons'] });
      queryClient.invalidateQueries({ queryKey: ['training-modules'] });
      toast({ title: 'Aula atualizada' });
    }
  });

  const deleteLesson = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await from('training_lessons')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-lessons'] });
      queryClient.invalidateQueries({ queryKey: ['training-modules'] });
      toast({ title: 'Aula deletada' });
    }
  });

  const reorderLessons = useMutation({
    mutationFn: async (lessons: { id: string; order_index: number }[]) => {
      const updates = lessons.map(l => 
        from('training_lessons').update({ order_index: l.order_index }).eq('id', l.id).execute()
      );
      
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-lessons'] });
      queryClient.invalidateQueries({ queryKey: ['training-modules'] });
    }
  });

  return {
    lessons,
    isLoading,
    createLesson,
    updateLesson,
    deleteLesson,
    reorderLessons
  };
}
