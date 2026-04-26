import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { from } from '@/integrations/db/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export function useQuizzes(trainingId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: quizzes, isLoading } = useQuery({
    queryKey: ['training-quizzes', trainingId],
    queryFn: async () => {
      if (!trainingId) return [];
      
      // Buscar quizzes
      const { data: quizzesData, error: quizzesError } = await from('training_quizzes')
        .select('*')
        .eq('training_id', trainingId)
        .order('order_index', { ascending: true })
        .execute();
      
      if (quizzesError) throw quizzesError;
      
      // Para cada quiz, buscar questões e opções
      const quizzesWithQuestions = await Promise.all((quizzesData || []).map(async (quiz: any) => {
        const { data: questions } = await from('quiz_questions')
          .select('*')
          .eq('quiz_id', quiz.id)
          .order('order_index', { ascending: true })
          .execute();
        
        const questionsWithOptions = await Promise.all((questions || []).map(async (question: any) => {
          const { data: options } = await from('quiz_question_options')
            .select('*')
            .eq('question_id', question.id)
            .order('order_index', { ascending: true })
            .execute();
          
          return {
            ...question,
            quiz_question_options: options || []
          };
        }));
        
        return {
          ...quiz,
          quiz_questions: questionsWithOptions
        };
      }));
      
      return quizzesWithQuestions;
    },
    enabled: !!trainingId
  });

  const createQuiz = useMutation({
    mutationFn: async (quiz: any) => {
      const { data, error } = await from('training_quizzes')
        .insert(quiz)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-quizzes'] });
      toast({ title: 'Quiz criado com sucesso' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao criar quiz', description: error.message, variant: 'destructive' });
    }
  });

  const updateQuiz = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { error } = await from('training_quizzes')
        .update(updates)
        .eq('id', id)
        .execute();
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-quizzes'] });
      toast({ title: 'Quiz atualizado' });
    }
  });

  const deleteQuiz = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await from('training_quizzes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-quizzes'] });
      toast({ title: 'Quiz deletado' });
    }
  });

  const createQuestion = useMutation({
    mutationFn: async ({ quizId, question, options }: any) => {
      // Create question
      const { data: questionData, error: questionError } = await from('quiz_questions')
        .insert({
          quiz_id: quizId,
          question_text: question.question_text,
          question_type: question.question_type || 'multiple_choice',
          order_index: question.order_index || 0,
          points: question.points || 1.0
        })
        .select()
        .single();
      
      if (questionError) throw questionError;

      // Create options if provided
      if (options && options.length > 0) {
        for (const [idx, opt] of options.entries()) {
          await from('quiz_question_options')
            .insert({
              question_id: questionData.id,
              option_text: opt.option_text,
              is_correct: opt.is_correct || false,
              order_index: idx
            });
        }
      }

      return questionData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-quizzes'] });
      toast({ title: 'Questão criada' });
    }
  });

  const updateQuestion = useMutation({
    mutationFn: async ({ id, question, options }: any) => {
      const { error: questionError } = await from('quiz_questions')
        .update({
          question_text: question.question_text,
          question_type: question.question_type,
          points: question.points,
          order_index: question.order_index
        })
        .eq('id', id)
        .execute();
      
      if (questionError) throw questionError;

      // Update options
      if (options) {
        // Delete existing options
        await from('quiz_question_options')
          .delete()
          .eq('question_id', id);

        // Insert new options
        if (options.length > 0) {
          for (const [idx, opt] of options.entries()) {
            await from('quiz_question_options')
              .insert({
                question_id: id,
                option_text: opt.option_text,
                is_correct: opt.is_correct || false,
                order_index: idx
              });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-quizzes'] });
      toast({ title: 'Questão atualizada' });
    }
  });

  const deleteQuestion = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await from('quiz_questions')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-quizzes'] });
      toast({ title: 'Questão deletada' });
    }
  });

  // Get user attempts for a quiz
  const { data: userAttempts } = useQuery({
    queryKey: ['quiz-attempts', trainingId, user?.id],
    queryFn: async () => {
      if (!trainingId || !user) return [];

      const { data: quizzesData } = await from('training_quizzes')
        .select('id')
        .eq('training_id', trainingId)
        .execute();

      if (!quizzesData || quizzesData.length === 0) return [];

      const quizIds = quizzesData.map((q: any) => q.id);

      const { data, error } = await from('quiz_attempts')
        .select('*')
        .eq('user_id', user.id)
        .in('quiz_id', quizIds)
        .order('created_at', { ascending: false })
        .execute();
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!trainingId && !!user
  });

  const submitQuizAttempt = useMutation({
    mutationFn: async ({ quizId, answers, timeSpent }: any) => {
      if (!user) throw new Error('User not authenticated');

      // Get quiz
      const { data: quizData, error: quizError } = await from('training_quizzes')
        .select('*')
        .eq('id', quizId)
        .single();

      if (quizError) throw quizError;

      // Get questions
      const { data: questions } = await from('quiz_questions')
        .select('*')
        .eq('quiz_id', quizId)
        .execute();

      // Get options for each question
      const questionsWithOptions = await Promise.all((questions || []).map(async (q: any) => {
        const { data: options } = await from('quiz_question_options')
          .select('*')
          .eq('question_id', q.id)
          .execute();
        return { ...q, quiz_question_options: options || [] };
      }));

      // Calculate score
      let totalPoints = 0;
      let earnedPoints = 0;
      const attemptAnswers: any[] = [];

      for (const question of questionsWithOptions) {
        totalPoints += question.points || 1.0;
        const userAnswer = answers[question.id];
        let isCorrect = false;
        let pointsEarned = 0;

        if (question.question_type === 'multiple_choice' || question.question_type === 'true_false') {
          const correctOption = question.quiz_question_options?.find((opt: any) => opt.is_correct);
          isCorrect = userAnswer?.selected_option_id === correctOption?.id;
          pointsEarned = isCorrect ? (question.points || 1.0) : 0;
        }

        if (isCorrect) earnedPoints += pointsEarned;

        attemptAnswers.push({
          question_id: question.id,
          selected_option_id: userAnswer?.selected_option_id || null,
          answer_text: userAnswer?.answer_text || null,
          is_correct: isCorrect,
          points_earned: pointsEarned
        });
      }

      const score = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
      const passed = score >= (quizData.passing_score || 70);

      // Create attempt
      const { data: attemptData, error: attemptError } = await from('quiz_attempts')
        .insert({
          quiz_id: quizId,
          user_id: user.id,
          score,
          passed,
          time_spent_seconds: timeSpent,
          completed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (attemptError) throw attemptError;

      // Create attempt answers
      for (const ans of attemptAnswers) {
        await from('quiz_attempt_answers')
          .insert({
            attempt_id: attemptData.id,
            ...ans
          });
      }

      return { attempt: attemptData, score, passed };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-attempts'] });
    }
  });

  return {
    quizzes,
    isLoading,
    createQuiz,
    updateQuiz,
    deleteQuiz,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    userAttempts,
    submitQuizAttempt
  };
}
