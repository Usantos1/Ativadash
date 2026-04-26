import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { from } from '@/integrations/db/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export function useLessonProgress(trainingId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: progress } = useQuery({
    queryKey: ['lesson-progress', trainingId, user?.id],
    queryFn: async () => {
      if (!user || !trainingId) return [];

      const { data, error } = await from('lesson_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('training_id', trainingId)
        .execute();
      
      if (error) throw error;
      return data;
    },
    enabled: !!trainingId && !!user
  });

  const updateProgress = useMutation({
    mutationFn: async ({ 
      lessonId, 
      trainingId,
      progress: progressValue, 
      lastWatchedSeconds,
      completed
    }: {
      lessonId: string;
      trainingId: string;
      progress: number;
      lastWatchedSeconds: number;
      completed: boolean;
    }) => {
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await from('lesson_progress')
        .upsert({ 
          user_id: user.id,
          lesson_id: lessonId,
          training_id: trainingId,
          progress: progressValue,
          last_watched_seconds: lastWatchedSeconds,
          completed,
          completed_at: completed ? new Date().toISOString() : null
        }, {
          onConflict: 'user_id,lesson_id'
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-progress'] });
      queryClient.invalidateQueries({ queryKey: ['my-training-assignments'] });
    }
  });

  const getLessonProgress = (lessonId: string) => {
    return progress?.find(p => p.lesson_id === lessonId);
  };

  const getTrainingProgress = () => {
    if (!progress || progress.length === 0) return 0;
    const completed = progress.filter(p => p.completed).length;
    return (completed / progress.length) * 100;
  };

  return {
    progress,
    updateProgress,
    getLessonProgress,
    getTrainingProgress
  };
}
