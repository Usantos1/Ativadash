import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { from } from '@/integrations/db/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// =====================================================
// TIPOS
// =====================================================

export interface AdsCampaign {
  id: string;
  nome: string;
  plataforma: 'meta' | 'google' | 'tiktok' | 'outros';
  tipo: 'trafego' | 'conversao' | 'leads' | 'vendas' | 'brand';
  status: 'ativa' | 'pausada' | 'encerrada';
  data_inicio: string;
  data_fim?: string;
  orcamento_diario?: number;
  orcamento_total?: number;
  objetivo?: string;
  url_destino?: string;
  publico_alvo?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface AdsMetrics {
  id: string;
  campaign_id: string;
  data: string;
  valor_investido: number;
  impressoes: number;
  alcance: number;
  cliques: number;
  cliques_link: number;
  visualizacoes_pagina: number;
  curtidas: number;
  comentarios: number;
  compartilhamentos: number;
  salvos: number;
  leads_gerados: number;
  formularios_preenchidos: number;
  mensagens_whatsapp: number;
  ligacoes: number;
  vendas_atribuidas: number;
  valor_vendas_atribuidas: number;
  cpm: number;
  cpc: number;
  cpl: number;
  ctr: number;
  taxa_conversao: number;
  roas: number;
  observacoes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  campaign_id?: string;
  fonte: 'meta_ads' | 'google_ads' | 'organico' | 'indicacao' | 'site' | 'whatsapp' | 'outros';
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  nome: string;
  email?: string;
  telefone?: string;
  whatsapp?: string;
  cidade?: string;
  estado?: string;
  status: 'novo' | 'contatado' | 'qualificado' | 'negociacao' | 'convertido' | 'perdido';
  temperatura: 'frio' | 'morno' | 'quente';
  interesse?: string;
  orcamento_estimado?: number;
  prazo_compra?: 'imediato' | '30_dias' | '60_dias' | '90_dias' | 'indefinido';
  responsavel_id?: string;
  responsavel_nome?: string;
  convertido: boolean;
  data_conversao?: string;
  valor_conversao?: number;
  sale_id?: string;
  os_id?: string;
  total_interacoes: number;
  ultima_interacao?: string;
  proxima_acao?: string;
  data_proxima_acao?: string;
  observacoes?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface LeadInteraction {
  id: string;
  lead_id: string;
  tipo: 'ligacao' | 'whatsapp' | 'email' | 'visita' | 'reuniao' | 'proposta' | 'follow_up';
  direcao: 'inbound' | 'outbound';
  resultado?: 'positivo' | 'negativo' | 'neutro' | 'nao_atendeu' | 'agendado';
  descricao?: string;
  duracao_minutos?: number;
  realizado_por_id?: string;
  realizado_por_nome?: string;
  created_at: string;
}

export interface MarketingGoal {
  id: string;
  periodo: string;
  meta_investimento?: number;
  meta_impressoes?: number;
  meta_cliques?: number;
  meta_alcance?: number;
  meta_leads?: number;
  meta_leads_qualificados?: number;
  meta_conversoes?: number;
  meta_valor_vendas?: number;
  meta_cpl?: number;
  meta_cpc?: number;
  meta_roas?: number;
  observacoes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// =====================================================
// HOOK: useAdsCampaigns
// =====================================================

export function useAdsCampaigns() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const { data: campaigns = [], isLoading, error, refetch } = useQuery({
    queryKey: ['ads-campaigns'],
    queryFn: async () => {
      const { data, error } = await from('ads_campaigns')
        .select('*')
        .order('created_at', { ascending: false })
        .execute();
      if (error) throw error;
      return data as AdsCampaign[];
    },
  });

  const createCampaign = useMutation({
    mutationFn: async (campaign: Omit<AdsCampaign, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await from('ads_campaigns')
        .insert({
          ...campaign,
          created_by: user?.id,
        })
        .select('*')
        .single()
        .execute();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ads-campaigns'] });
      toast({ title: 'Campanha criada com sucesso!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao criar campanha', description: error.message, variant: 'destructive' });
    },
  });

  const updateCampaign = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AdsCampaign> & { id: string }) => {
      const { data, error } = await from('ads_campaigns')
        .eq('id', id)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .select('*')
        .single()
        .execute();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ads-campaigns'] });
      toast({ title: 'Campanha atualizada!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao atualizar campanha', description: error.message, variant: 'destructive' });
    },
  });

  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await from('ads_campaigns')
        .eq('id', id)
        .delete()
        .execute();
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ads-campaigns'] });
      toast({ title: 'Campanha excluída!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao excluir campanha', description: error.message, variant: 'destructive' });
    },
  });

  return {
    campaigns,
    isLoading,
    error,
    refetch,
    createCampaign: createCampaign.mutateAsync,
    updateCampaign: updateCampaign.mutateAsync,
    deleteCampaign: deleteCampaign.mutateAsync,
    isCreating: createCampaign.isPending,
    isUpdating: updateCampaign.isPending,
    isDeleting: deleteCampaign.isPending,
  };
}

// =====================================================
// HOOK: useAdsMetrics
// =====================================================

export function useAdsMetrics(filters?: { campaignId?: string; startDate?: string; endDate?: string }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: metrics = [], isLoading, error, refetch } = useQuery({
    queryKey: ['ads-metrics', filters],
    queryFn: async () => {
      let query = from('ads_metrics').select('*');
      
      if (filters?.campaignId) {
        query = query.eq('campaign_id', filters.campaignId);
      }
      if (filters?.startDate) {
        query = query.gte('data', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('data', filters.endDate);
      }
      
      const { data, error } = await query.order('data', { ascending: false }).execute();
      if (error) throw error;
      return data as AdsMetrics[];
    },
  });

  const createMetrics = useMutation({
    mutationFn: async (metricsData: Omit<AdsMetrics, 'id' | 'created_at' | 'updated_at' | 'cpm' | 'cpc' | 'cpl' | 'ctr' | 'taxa_conversao' | 'roas'>) => {
      const { data, error } = await from('ads_metrics')
        .insert({
          ...metricsData,
          created_by: user?.id,
        })
        .select('*')
        .single()
        .execute();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ads-metrics'] });
      toast({ title: 'Métricas registradas!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao registrar métricas', description: error.message, variant: 'destructive' });
    },
  });

  const updateMetrics = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AdsMetrics> & { id: string }) => {
      const { data, error } = await from('ads_metrics')
        .eq('id', id)
        .update(updates)
        .select('*')
        .single()
        .execute();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ads-metrics'] });
      toast({ title: 'Métricas atualizadas!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao atualizar métricas', description: error.message, variant: 'destructive' });
    },
  });

  // Calcular totais agregados
  const totals = useMemo(() => {
    return {
      valor_investido: metrics.reduce((sum, m) => sum + Number(m.valor_investido || 0), 0),
      impressoes: metrics.reduce((sum, m) => sum + Number(m.impressoes || 0), 0),
      alcance: metrics.reduce((sum, m) => sum + Number(m.alcance || 0), 0),
      cliques: metrics.reduce((sum, m) => sum + Number(m.cliques || 0), 0),
      leads_gerados: metrics.reduce((sum, m) => sum + Number(m.leads_gerados || 0), 0),
      vendas_atribuidas: metrics.reduce((sum, m) => sum + Number(m.vendas_atribuidas || 0), 0),
      valor_vendas_atribuidas: metrics.reduce((sum, m) => sum + Number(m.valor_vendas_atribuidas || 0), 0),
    };
  }, [metrics]);

  // Métricas calculadas
  const calculatedMetrics = useMemo(() => {
    const { valor_investido, impressoes, cliques, leads_gerados, valor_vendas_atribuidas } = totals;
    return {
      cpm: impressoes > 0 ? (valor_investido / impressoes) * 1000 : 0,
      cpc: cliques > 0 ? valor_investido / cliques : 0,
      cpl: leads_gerados > 0 ? valor_investido / leads_gerados : 0,
      ctr: impressoes > 0 ? (cliques / impressoes) * 100 : 0,
      taxa_conversao: cliques > 0 ? (leads_gerados / cliques) * 100 : 0,
      roas: valor_investido > 0 ? valor_vendas_atribuidas / valor_investido : 0,
    };
  }, [totals]);

  return {
    metrics,
    totals,
    calculatedMetrics,
    isLoading,
    error,
    refetch,
    createMetrics: createMetrics.mutateAsync,
    updateMetrics: updateMetrics.mutateAsync,
    isCreating: createMetrics.isPending,
    isUpdating: updateMetrics.isPending,
  };
}

// =====================================================
// HOOK: useLeads
// =====================================================

export function useLeads(filters?: { 
  status?: string; 
  fonte?: string; 
  responsavel_id?: string; 
  campaignId?: string;
  startDate?: string;
  endDate?: string;
}) {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const { data: leads = [], isLoading, error, refetch } = useQuery({
    queryKey: ['leads', filters],
    queryFn: async () => {
      let query = from('leads').select('*');
      
      if (filters?.status && filters.status !== 'todos') {
        query = query.eq('status', filters.status);
      }
      if (filters?.fonte && filters.fonte !== 'todos') {
        query = query.eq('fonte', filters.fonte);
      }
      if (filters?.responsavel_id) {
        query = query.eq('responsavel_id', filters.responsavel_id);
      }
      if (filters?.campaignId) {
        query = query.eq('campaign_id', filters.campaignId);
      }
      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false }).execute();
      if (error) throw error;
      return data as Lead[];
    },
  });

  const createLead = useMutation({
    mutationFn: async (lead: Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'total_interacoes' | 'ultima_interacao'>) => {
      const { data, error } = await from('leads')
        .insert(lead)
        .select('*')
        .single()
        .execute();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'Lead criado com sucesso!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao criar lead', description: error.message, variant: 'destructive' });
    },
  });

  const updateLead = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Lead> & { id: string }) => {
      const { data, error } = await from('leads')
        .eq('id', id)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .select('*')
        .single()
        .execute();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'Lead atualizado!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao atualizar lead', description: error.message, variant: 'destructive' });
    },
  });

  const deleteLead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await from('leads')
        .eq('id', id)
        .delete()
        .execute();
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'Lead excluído!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao excluir lead', description: error.message, variant: 'destructive' });
    },
  });

  const convertLead = useMutation({
    mutationFn: async ({ id, valor_conversao, sale_id, os_id }: { id: string; valor_conversao: number; sale_id?: string; os_id?: string }) => {
      const { data, error } = await from('leads')
        .eq('id', id)
        .update({
          status: 'convertido',
          convertido: true,
          data_conversao: new Date().toISOString(),
          valor_conversao,
          sale_id,
          os_id,
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single()
        .execute();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'Lead convertido com sucesso!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao converter lead', description: error.message, variant: 'destructive' });
    },
  });

  // Estatísticas
  const stats = useMemo(() => {
    const byStatus = {
      novo: leads.filter(l => l.status === 'novo').length,
      contatado: leads.filter(l => l.status === 'contatado').length,
      qualificado: leads.filter(l => l.status === 'qualificado').length,
      negociacao: leads.filter(l => l.status === 'negociacao').length,
      convertido: leads.filter(l => l.status === 'convertido').length,
      perdido: leads.filter(l => l.status === 'perdido').length,
    };
    
    const byTemperatura = {
      frio: leads.filter(l => l.temperatura === 'frio').length,
      morno: leads.filter(l => l.temperatura === 'morno').length,
      quente: leads.filter(l => l.temperatura === 'quente').length,
    };
    
    const byFonte = leads.reduce((acc, l) => {
      acc[l.fonte] = (acc[l.fonte] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const totalConversao = leads.filter(l => l.convertido).reduce((sum, l) => sum + (l.valor_conversao || 0), 0);
    const taxaConversao = leads.length > 0 ? (byStatus.convertido / leads.length) * 100 : 0;
    
    return { byStatus, byTemperatura, byFonte, totalConversao, taxaConversao, total: leads.length };
  }, [leads]);

  return {
    leads,
    stats,
    isLoading,
    error,
    refetch,
    createLead: createLead.mutateAsync,
    updateLead: updateLead.mutateAsync,
    deleteLead: deleteLead.mutateAsync,
    convertLead: convertLead.mutateAsync,
    isCreating: createLead.isPending,
    isUpdating: updateLead.isPending,
    isDeleting: deleteLead.isPending,
  };
}

// =====================================================
// HOOK: useLeadInteractions
// =====================================================

export function useLeadInteractions(leadId: string) {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const { data: interactions = [], isLoading, error, refetch } = useQuery({
    queryKey: ['lead-interactions', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      const { data, error } = await from('lead_interactions')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .execute();
      if (error) throw error;
      return data as LeadInteraction[];
    },
    enabled: !!leadId,
  });

  const createInteraction = useMutation({
    mutationFn: async (interaction: Omit<LeadInteraction, 'id' | 'created_at'>) => {
      const { data, error } = await from('lead_interactions')
        .insert({
          ...interaction,
          realizado_por_id: user?.id,
          realizado_por_nome: profile?.display_name || profile?.full_name || user?.email,
        })
        .select('*')
        .single()
        .execute();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-interactions', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'Interação registrada!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao registrar interação', description: error.message, variant: 'destructive' });
    },
  });

  return {
    interactions,
    isLoading,
    error,
    refetch,
    createInteraction: createInteraction.mutateAsync,
    isCreating: createInteraction.isPending,
  };
}

// =====================================================
// HOOK: useMarketingGoals
// =====================================================

export function useMarketingGoals(periodo?: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: goals = [], isLoading, error, refetch } = useQuery({
    queryKey: ['marketing-goals', periodo],
    queryFn: async () => {
      let query = from('marketing_goals').select('*');
      if (periodo) {
        query = query.eq('periodo', periodo);
      }
      const { data, error } = await query.order('periodo', { ascending: false }).execute();
      if (error) throw error;
      return data as MarketingGoal[];
    },
  });

  const saveGoal = useMutation({
    mutationFn: async (goal: Omit<MarketingGoal, 'id' | 'created_at' | 'updated_at'>) => {
      // Tenta atualizar primeiro
      const { data: existing } = await from('marketing_goals')
        .select('id')
        .eq('periodo', goal.periodo)
        .maybeSingle();
      
      if (existing?.id) {
        const { data, error } = await from('marketing_goals')
          .eq('id', existing.id)
          .update({ ...goal, updated_at: new Date().toISOString() })
          .select('*')
          .single()
          .execute();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await from('marketing_goals')
          .insert({ ...goal, created_by: user?.id })
          .select('*')
          .single()
          .execute();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-goals'] });
      toast({ title: 'Metas salvas!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao salvar metas', description: error.message, variant: 'destructive' });
    },
  });

  return {
    goals,
    currentGoal: periodo ? goals.find(g => g.periodo === periodo) : goals[0],
    isLoading,
    error,
    refetch,
    saveGoal: saveGoal.mutateAsync,
    isSaving: saveGoal.isPending,
  };
}

// =====================================================
// HOOK: useMarketingDashboard - Dados consolidados
// =====================================================

export function useMarketingDashboard(periodo: string) {
  const { campaigns, isLoading: campaignsLoading } = useAdsCampaigns();
  const { metrics, totals, calculatedMetrics, isLoading: metricsLoading } = useAdsMetrics({
    startDate: `${periodo}-01`,
    endDate: `${periodo}-31`,
  });
  const { leads, stats: leadStats, isLoading: leadsLoading } = useLeads({
    startDate: `${periodo}-01`,
    endDate: `${periodo}-31`,
  });
  const { currentGoal, isLoading: goalsLoading } = useMarketingGoals(periodo);

  const isLoading = campaignsLoading || metricsLoading || leadsLoading || goalsLoading;

  // Campanhas ativas
  const activeCampaigns = campaigns.filter(c => c.status === 'ativa');

  // Métricas por plataforma
  const metricsByPlatform = useMemo(() => {
    const platformMetrics: Record<string, typeof totals> = {};
    
    campaigns.forEach(campaign => {
      const campaignMetrics = metrics.filter(m => m.campaign_id === campaign.id);
      if (!platformMetrics[campaign.plataforma]) {
        platformMetrics[campaign.plataforma] = {
          valor_investido: 0,
          impressoes: 0,
          alcance: 0,
          cliques: 0,
          leads_gerados: 0,
          vendas_atribuidas: 0,
          valor_vendas_atribuidas: 0,
        };
      }
      campaignMetrics.forEach(m => {
        platformMetrics[campaign.plataforma].valor_investido += Number(m.valor_investido || 0);
        platformMetrics[campaign.plataforma].impressoes += Number(m.impressoes || 0);
        platformMetrics[campaign.plataforma].alcance += Number(m.alcance || 0);
        platformMetrics[campaign.plataforma].cliques += Number(m.cliques || 0);
        platformMetrics[campaign.plataforma].leads_gerados += Number(m.leads_gerados || 0);
        platformMetrics[campaign.plataforma].vendas_atribuidas += Number(m.vendas_atribuidas || 0);
        platformMetrics[campaign.plataforma].valor_vendas_atribuidas += Number(m.valor_vendas_atribuidas || 0);
      });
    });
    
    return platformMetrics;
  }, [campaigns, metrics]);

  // Comparação com metas
  const goalProgress = useMemo(() => {
    if (!currentGoal) return null;
    
    return {
      investimento: {
        atual: totals.valor_investido,
        meta: currentGoal.meta_investimento || 0,
        percentual: currentGoal.meta_investimento ? (totals.valor_investido / currentGoal.meta_investimento) * 100 : 0,
      },
      leads: {
        atual: totals.leads_gerados,
        meta: currentGoal.meta_leads || 0,
        percentual: currentGoal.meta_leads ? (totals.leads_gerados / currentGoal.meta_leads) * 100 : 0,
      },
      conversoes: {
        atual: leadStats.byStatus.convertido,
        meta: currentGoal.meta_conversoes || 0,
        percentual: currentGoal.meta_conversoes ? (leadStats.byStatus.convertido / currentGoal.meta_conversoes) * 100 : 0,
      },
      vendas: {
        atual: leadStats.totalConversao,
        meta: currentGoal.meta_valor_vendas || 0,
        percentual: currentGoal.meta_valor_vendas ? (leadStats.totalConversao / currentGoal.meta_valor_vendas) * 100 : 0,
      },
      cpl: {
        atual: calculatedMetrics.cpl,
        meta: currentGoal.meta_cpl || 0,
        status: currentGoal.meta_cpl ? (calculatedMetrics.cpl <= currentGoal.meta_cpl ? 'bom' : 'ruim') : 'neutro',
      },
      roas: {
        atual: calculatedMetrics.roas,
        meta: currentGoal.meta_roas || 0,
        status: currentGoal.meta_roas ? (calculatedMetrics.roas >= currentGoal.meta_roas ? 'bom' : 'ruim') : 'neutro',
      },
    };
  }, [currentGoal, totals, leadStats, calculatedMetrics]);

  return {
    isLoading,
    campaigns,
    activeCampaigns,
    metrics,
    totals,
    calculatedMetrics,
    leads,
    leadStats,
    currentGoal,
    goalProgress,
    metricsByPlatform,
  };
}

