import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { from } from '@/integrations/db/client';
import { toast } from 'sonner';

export interface JobSurvey {
  id: string;
  title: string;
  description: string;
  position_title: string;
  department: string | null;
  slug: string | null;
  is_active: boolean;
  questions: any[];
  created_at: string;
  created_by: string;
  salary_range?: string | null;
  contract_type?: string | null;
  location?: string | null;
  benefits?: string[] | null;
  requirements?: string[] | null;
  company_logo?: string | null;
  company_name?: string | null;
  work_schedule?: string | null;
  work_modality?: string | null;
  work_days?: string[] | null;
  daily_schedule?: { [key: string]: { start: string; end: string } } | null;
  lunch_break?: string | null;
  weekly_hours?: number | null;
  salary_min?: number | null;
  salary_max?: number | null;
  has_commission?: boolean | null;
  commission_details?: string | null;
  published_at?: string | null;
  expires_at?: string | null;
}

export interface JobApplicationStatus {
  id: string;
  protocol: string;
  survey_id: string;
  name: string;
  email: string;
  status: 'received' | 'reviewing' | 'interview' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  survey?: {
    title: string;
    position_title: string;
  };
}

interface JobSurveysFilters {
  search?: string;
  location?: string;
  modality?: string;
  contract_type?: string;
  salary_min?: number;
  salary_max?: number;
  department?: string;
  is_active?: boolean;
}

interface JobSurveysOptions {
  filters?: JobSurveysFilters;
  page?: number;
  pageSize?: number;
}

const API_URL = (import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.includes('localhost')) 
  ? import.meta.env.VITE_API_URL 
  : 'https://api.ativafix.com/api';

export const useJobSurveys = (options: JobSurveysOptions = {}) => {
  const queryClient = useQueryClient();
  const { filters = {}, page = 1, pageSize = 12 } = options;

  const queryKey = ['job-surveys', filters, page, pageSize];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      // Para portal público, usar endpoint público
      if (filters.is_active === true) {
        const params = new URLSearchParams({
          page: page.toString(),
          pageSize: pageSize.toString()
        });
        
        if (filters.search) params.append('search', filters.search);
        if (filters.location) params.append('location', filters.location);
        if (filters.modality) params.append('modality', filters.modality);
        if (filters.contract_type) params.append('contract_type', filters.contract_type);
        
        const response = await fetch(`${API_URL}/public/vagas?${params.toString()}`);
        const result = await response.json();
        
        if (!response.ok) throw new Error(result.error || 'Erro ao buscar vagas');
        
        const formattedData = (result.data || []).map((item: any) => ({
          ...item,
          work_days: Array.isArray(item.work_days) ? item.work_days as string[] : [],
          daily_schedule: typeof item.daily_schedule === 'object' && item.daily_schedule !== null
            ? item.daily_schedule as { [key: string]: { start: string; end: string } }
            : {},
          benefits: Array.isArray(item.benefits) ? item.benefits as string[] : [],
          requirements: Array.isArray(item.requirements) ? item.requirements as string[] : [],
          questions: Array.isArray(item.questions) ? item.questions : []
        })) as JobSurvey[];

        return {
          data: formattedData,
          total: result.total || 0,
          page: result.page || page,
          pageSize: result.pageSize || pageSize,
          totalPages: result.totalPages || 0
        };
      }
      
      // Para admin, usar query autenticada
      let query = from('job_surveys').select('*');

      if (filters.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
      }

      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        query = query.or(`title.ilike.%${searchTerm}%,position_title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,department.ilike.%${searchTerm}%`);
      }

      if (filters.location) {
        query = query.ilike('location', `%${filters.location}%`);
      }

      if (filters.modality) {
        query = query.eq('work_modality', filters.modality);
      }

      if (filters.contract_type) {
        query = query.eq('contract_type', filters.contract_type);
      }

      if (filters.department) {
        query = query.ilike('department', `%${filters.department}%`);
      }

      if (filters.salary_min) {
        query = query.gte('salary_min', filters.salary_min);
      }

      if (filters.salary_max) {
        query = query.lte('salary_max', filters.salary_max);
      }

      query = query
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      const { data, error, count } = await query.execute();

      if (error) throw error;

      const formattedData = (data || []).map((item: any) => ({
        ...item,
        work_days: Array.isArray(item.work_days) ? item.work_days as string[] : [],
        daily_schedule: typeof item.daily_schedule === 'object' && item.daily_schedule !== null
          ? item.daily_schedule as { [key: string]: { start: string; end: string } }
          : {},
        benefits: Array.isArray(item.benefits) ? item.benefits as string[] : [],
        requirements: Array.isArray(item.requirements) ? item.requirements as string[] : [],
        questions: Array.isArray(item.questions) ? item.questions : []
      })) as JobSurvey[];

      return {
        data: formattedData,
        total: count || data?.length || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || data?.length || 0) / pageSize)
      };
    },
    staleTime: 30000,
    gcTime: 300000,
  });

  return {
    surveys: data?.data || [],
    total: data?.total || 0,
    page: data?.page || 1,
    totalPages: data?.totalPages || 0,
    loading: isLoading,
    error,
    refetch
  };
};

export const useJobSurvey = (slugOrId: string) => {
  return useQuery({
    queryKey: ['job-survey', slugOrId],
    queryFn: async () => {
      // Usar endpoint público para buscar vaga
      const response = await fetch(`${API_URL}/public/vaga/${slugOrId}`);
      const result = await response.json();
      
      if (!response.ok) throw new Error(result.error || 'Vaga não encontrada');
      
      const data = result.data;

      return {
        ...data,
        work_days: Array.isArray(data.work_days) ? data.work_days as string[] : [],
        daily_schedule: typeof data.daily_schedule === 'object' && data.daily_schedule !== null
          ? data.daily_schedule as { [key: string]: { start: string; end: string } }
          : {},
        benefits: Array.isArray(data.benefits) ? data.benefits as string[] : [],
        requirements: Array.isArray(data.requirements) ? data.requirements as string[] : [],
        questions: Array.isArray(data.questions) ? data.questions : []
      } as JobSurvey;
    },
    enabled: !!slugOrId,
    staleTime: 60000,
  });
};

export const useJobApplicationStatus = (protocol: string, email?: string) => {
  return useQuery({
    queryKey: ['job-application-status', protocol, email],
    queryFn: async () => {
      // Buscar por protocolo (primeira parte do UUID)
      if (protocol) {
        // O protocolo é APP-XXXXXXXX onde XXXXXXXX é a primeira parte do UUID
        const uuidStart = protocol.replace('APP-', '').toLowerCase();
        
        // Buscar candidaturas que começam com esse UUID
        const { data: responses, error } = await from('job_responses')
          .select('*')
          .order('created_at', { ascending: false })
          .execute();
        
        if (!error && responses) {
          // Encontrar a resposta que corresponde ao protocolo
          const response = responses.find((r: any) => 
            r.id.toLowerCase().startsWith(uuidStart)
          );
          
          if (response) {
            // Buscar dados da vaga
            const { data: survey } = await from('job_surveys')
              .select('title, position_title')
              .eq('id', response.survey_id)
              .single()
              .execute();
            
            return {
              id: response.id,
              protocol: protocol,
              survey_id: response.survey_id,
              name: response.name,
              email: response.email,
              status: response.status || 'received',
              created_at: response.created_at,
              updated_at: response.updated_at || response.created_at,
              survey: survey
            } as JobApplicationStatus;
          }
        }
      }
      
      // Fallback: buscar por email (se fornecido)
      if (email) {
        const { data, error } = await from('job_responses')
          .select('*')
          .eq('email', email.toLowerCase().trim())
          .order('created_at', { ascending: false })
          .limit(1)
          .execute();

        if (error) throw error;
        
        const response = data?.[0];
        if (response) {
          // Buscar dados da vaga
          const { data: survey } = await from('job_surveys')
            .select('title, position_title')
            .eq('id', response.survey_id)
            .single()
            .execute();
          
          // Gerar protocolo a partir do ID
          const generatedProtocol = protocol || `APP-${response.id.split('-')[0].toUpperCase()}`;
          
          return {
            id: response.id,
            protocol: generatedProtocol,
            survey_id: response.survey_id,
            name: response.name,
            email: response.email,
            status: response.status || 'received',
            created_at: response.created_at,
            updated_at: response.updated_at || response.created_at,
            survey: survey
          } as JobApplicationStatus;
        }
      }
      
      throw new Error('Candidatura não encontrada');
    },
    enabled: !!(protocol || email),
    staleTime: 60000,
  });
};

export const useJobSurveyStats = (surveyId?: string) => {
  return useQuery({
    queryKey: ['job-survey-stats', surveyId],
    queryFn: async () => {
      if (!surveyId) return null;

      const [responsesResult, viewsResult] = await Promise.all([
        from('job_responses')
          .select('id, created_at')
          .eq('survey_id', surveyId)
          .execute()
          .then(r => ({ ...r, count: r.data?.length || 0 })),
        from('job_survey_views')
          .select('id')
          .eq('survey_id', surveyId)
          .execute()
          .then(r => ({ ...r, count: r.data?.length || 0 }))
          .catch(() => ({ data: null, count: 0, error: null })) // Tabela pode não existir
      ]);

      const totalApplications = responsesResult.count || 0;
      const totalViews = viewsResult.count || 0;

      // Calcular aplicações por dia (últimos 30 dias)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: recentApplications } = await from('job_responses')
        .select('created_at')
        .eq('survey_id', surveyId)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .execute();

      const applicationsByDay = (recentApplications || []).reduce((acc, app) => {
        const date = new Date(app.created_at).toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const conversionRate = totalViews > 0 
        ? ((totalApplications / totalViews) * 100).toFixed(2)
        : '0.00';

      return {
        totalApplications,
        totalViews,
        conversionRate: parseFloat(conversionRate),
        applicationsByDay
      };
    },
    enabled: !!surveyId,
    staleTime: 30000,
  });
};

