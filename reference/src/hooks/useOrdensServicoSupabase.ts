import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { from } from '@/integrations/db/client';
import { useAuth } from '@/contexts/AuthContext';
import { OrdemServico, StatusOS } from '@/types/assistencia';
import { useCallback } from 'react';

// Função auxiliar para registrar logs de auditoria
async function logAuditOS(
  acao: string,
  osId: string | null,
  dadosAnteriores: any,
  dadosNovos: any,
  descricao: string,
  user: any,
  profile?: any
) {
  try {
    if (!user) return;
    
    // Buscar nome do usuário do profile ou user_metadata
    const userNome = profile?.display_name || 
                     user.user_metadata?.name || 
                     user.user_metadata?.display_name ||
                     user.email || 
                     'Usuário';
    
    await from('audit_logs')
      .insert({
        user_id: user.id,
        user_nome: userNome,
        user_email: user.email,
        acao,
        entidade: 'ordem_servico',
        entidade_id: osId,
        dados_anteriores: dadosAnteriores,
        dados_novos: dadosNovos,
        descricao,
        user_agent: navigator.userAgent,
      })
      .execute();
  } catch (error) {
    console.error('Erro ao registrar log de auditoria da OS:', error);
  }
}

export function useOrdensServicoSupabase() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  // Buscar todas as OS (staleTime reduz refetch em massa e ajuda a evitar 429)
  const { data: ordens = [], isLoading } = useQuery({
    queryKey: ['ordens_servico'],
    queryFn: async () => {
      const { data, error } = await from('ordens_servico')
        .select('*')
        .order('created_at', { ascending: false })
        .execute();
      
      if (error) throw error;
      return (data || []) as OrdemServico[];
    },
    staleTime: 60 * 1000, // 1 minuto — evita refetch excessivo ao focar janela ou remontar
    refetchOnWindowFocus: false,
  });

  // Criar OS
  const createOS = useMutation({
    mutationFn: async (data: Partial<OrdemServico>): Promise<OrdemServico> => {
      const now = new Date();
      const dataEntrada = data.data_entrada || now.toISOString().split('T')[0];
      const horaEntrada = data.hora_entrada || now.toTimeString().slice(0, 5);
      const clienteId = data.cliente_id || null;

      // Impedir criar 2 OS iguais para o mesmo cliente no mesmo minuto/segundo
      if (clienteId) {
        const { data: existente } = await from('ordens_servico')
          .select('id, numero')
          .eq('cliente_id', clienteId)
          .eq('data_entrada', dataEntrada)
          .eq('hora_entrada', horaEntrada)
          .limit(1)
          .execute();
        const lista = (existente as any[]);
        if (lista?.length > 0) {
          const outra = lista[0];
          throw new Error(
            `Já existe uma OS (#${outra.numero}) para este cliente na mesma data e horário (${dataEntrada} ${horaEntrada}). Não é permitido criar duas OS iguais no mesmo minuto.`
          );
        }
      }

      // Usar número fornecido ou buscar próximo número
      let numero: number;
      if (data.numero) {
        // Usar o número fornecido diretamente
        numero = data.numero;
      } else {
        // Buscar configuração do número inicial
        let numeroInicial = 1;
        try {
          const { data: settingsData } = await from('kv_store_2c4defad')
            .select('value')
            .eq('key', 'system_settings')
            .single();
          
          if (settingsData?.value?.os_numero_inicial) {
            numeroInicial = settingsData.value.os_numero_inicial;
          }
        } catch (err) {
          // Se não encontrar configuração, usa 1
        }

        // Buscar último número de OS existente
        const { data: lastOS } = await from('ordens_servico')
          .select('numero')
          .order('numero', { ascending: false })
          .limit(1)
          .single();
        
        const ultimoNumero = lastOS?.numero || 0;
        
        // Usar o maior entre (último número + 1) e o número inicial configurado
        numero = Math.max(ultimoNumero + 1, numeroInicial);
      }

      const novaOS: any = {
        numero,
        situacao: ['entregue', 'cancelada', 'entregue_faturada', 'entregue_sem_reparo'].includes(data.status as string) ? (data.status === 'cancelada' ? 'cancelada' : 'fechada') : 'aberta',
        status: data.status || 'aberta',
        data_entrada: dataEntrada,
        hora_entrada: horaEntrada,
        cliente_id: data.cliente_id || null,
        cliente_nome: data.cliente_nome || null,
        cliente_empresa: data.cliente_empresa || null,
        telefone_contato: data.telefone_contato || '',
        tipo_aparelho: data.tipo_aparelho || 'Celular',
        marca_id: data.marca_id || null,
        marca_nome: data.marca_nome || null,
        modelo_id: data.modelo_id || null,
        modelo_nome: data.modelo_nome || null,
        imei: data.imei || null,
        numero_serie: data.numero_serie || null,
        cor: data.cor || null,
        senha_aparelho: data.senha_aparelho || null,
        senha_numerica: data.senha_numerica || null,
        padrao_desbloqueio: data.padrao_desbloqueio || null,
        possui_senha: data.possui_senha || false,
        deixou_aparelho: data.deixou_aparelho ?? true,
        apenas_agendamento: data.apenas_agendamento || false,
        descricao_problema: data.descricao_problema || '',
        problema_constatado: data.problema_constatado || null,
        descricao_servico: data.descricao_servico || null,
        checklist_entrada: data.checklist_entrada || [],
        checklist_saida: [],
        areas_defeito: data.areas_defeito || [],
        observacoes_checklist: data.observacoes_checklist || null,
        checklist_entrada_realizado_por_id: data.checklist_entrada_realizado_por_id || null,
        checklist_entrada_realizado_por_nome: data.checklist_entrada_realizado_por_nome || null,
        checklist_entrada_realizado_em: data.checklist_entrada_realizado_em || null,
        checklist_saida_realizado_por_id: data.checklist_saida_realizado_por_id || null,
        checklist_saida_realizado_por_nome: data.checklist_saida_realizado_por_nome || null,
        checklist_saida_realizado_em: data.checklist_saida_realizado_em || null,
        condicoes_equipamento: data.condicoes_equipamento || null,
        observacoes: data.observacoes || null,
        observacoes_internas: data.observacoes_internas || null,
        previsao_entrega: data.previsao_entrega || null,
        hora_previsao: data.hora_previsao || null,
        orcamento_parcelado: data.orcamento_parcelado || null,
        orcamento_desconto: data.orcamento_desconto || null,
        orcamento_autorizado: data.orcamento_autorizado || false,
        apenas_orcamento: (data as any).apenas_orcamento || false,
        tecnico_id: data.tecnico_id || null,
        tecnico_nome: data.tecnico_nome || null,
        servico_executado: data.servico_executado || null,
        vendedor_id: data.vendedor_id || null,
        vendedor_nome: data.vendedor_nome || null,
        subtotal: 0,
        desconto: 0,
        valor_total: 0,
        created_by: user?.id || null,
      };

      const { data: inserted, error } = await from('ordens_servico')
        .insert(novaOS)
        .select()
        .single();

      if (error) throw error;
      if (!inserted) {
        throw new Error('Erro ao criar OS: dados não retornados');
      }
      
      // Garantir que o ID está presente
      const osCriada = (inserted?.data || inserted) as OrdemServico;
      if (!osCriada?.id) {
        throw new Error('Erro ao criar OS: ID não retornado');
      }
      
      // Registrar log de auditoria
      await logAuditOS(
        'create',
        osCriada.id,
        null,
        osCriada,
        `Ordem de Serviço #${osCriada.numero} criada`,
        user,
        profile
      );
      
      return osCriada;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordens_servico'] });
    },
  });

  // Atualizar OS
  const updateOS = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<OrdemServico> }): Promise<OrdemServico> => {
      // Campos UUID: enviar null em vez de "" para evitar "invalid input syntax for type uuid"
      const UUID_FIELDS = [
        'cliente_id',
        'marca_id',
        'modelo_id',
        'tecnico_id',
        'company_id',
        'checklist_entrada_realizado_por_id',
        'checklist_saida_realizado_por_id',
        'vendedor_id',
        'atendente_id',
        'created_by',
      ];
      const sanitized = { ...data };
      for (const key of UUID_FIELDS) {
        if (key in sanitized && (sanitized as any)[key] === '') {
          (sanitized as any)[key] = null;
        }
      }

      // timestamptz: "" quebra o Postgres ("invalid input syntax for type timestamp with time zone")
      const TIMESTAMPTZ_FIELDS = [
        'checklist_entrada_realizado_em',
        'checklist_saida_realizado_em',
        'created_at',
        'updated_at',
      ];
      for (const key of TIMESTAMPTZ_FIELDS) {
        if (key in sanitized && (sanitized as any)[key] === '') {
          (sanitized as any)[key] = null;
        }
      }

      // DATE / TIME: "" também pode falhar em updates vindos do formulário
      // Não incluir data_entrada: NOT NULL no banco; "" não deve vir do form em update típico
      const DATE_FIELDS = ['previsao_entrega', 'data_conclusao', 'data_entrega', 'data_saida'];
      for (const key of DATE_FIELDS) {
        if (key in sanitized && (sanitized as any)[key] === '') {
          (sanitized as any)[key] = null;
        }
      }
      const TIME_FIELDS = ['hora_entrada', 'hora_previsao'];
      for (const key of TIME_FIELDS) {
        if (key in sanitized && (sanitized as any)[key] === '') {
          (sanitized as any)[key] = null;
        }
      }

      // Buscar OS antes de atualizar para log
      const { data: osAntiga } = await from('ordens_servico')
        .select('*')
        .eq('id', id)
        .single();
      
      // Primeiro definir o WHERE, depois chamar update
      const { data: updated, error } = await from('ordens_servico')
        .eq('id', id)
        .update(sanitized);

      if (error) throw error;
      
      // Buscar OS atualizada para retornar dados completos
      const { data: osData, error: fetchError } = await from('ordens_servico')
        .select('*')
        .eq('id', id)
        .single();
      
      if (fetchError) throw fetchError;
      
      const osAtualizada = (osData?.data || osData) as OrdemServico;
      
      // Registrar log de auditoria
      await logAuditOS(
        'update',
        id,
        osAntiga,
        osAtualizada,
        `Ordem de Serviço #${osAtualizada.numero || id} atualizada`,
        user,
        profile
      );
      
      return osAtualizada;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordens_servico'] });
    },
  });

  // Deletar OS
  const deleteOS = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await from('ordens_servico')
        .delete()
        .eq('id', id)
        .execute();

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordens_servico'] });
    },
  });

  // Buscar OS por ID
  const getOSById = useCallback((id: string): OrdemServico | undefined => {
    return ordens.find(os => os.id === id);
  }, [ordens]);

  // Atualizar status
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusOS | string }): Promise<void> => {
      // Buscar dados da OS antes de atualizar
      const { data: osData } = await from('ordens_servico')
        .select(['id', 'numero', 'status', 'cliente_id', 'cliente_nome', 'telefone_contato', 'valor_total'])
        .eq('id', id)
        .single();

      const updates: any = { status };

      // Ação definida na configuração de status (global por empresa, API)
      try {
        const { data: configRows } = await from('os_config_status')
          .select('acao')
          .eq('status', status)
          .limit(1)
          .execute();
        const config = configRows?.[0];
        if (config?.acao === 'fechar_os') {
          updates.situacao = 'fechada';
          updates.data_entrega = new Date().toISOString().split('T')[0];
        } else if (config?.acao === 'cancelar_os') {
          updates.situacao = 'cancelada';
        }
      } catch (_) { /* ignora */ }

      // Fallback quando a config não define ação (comportamento histórico)
      if (!updates.situacao && ['entregue', 'entregue_faturada', 'entregue_sem_reparo'].includes(status as string)) {
        updates.situacao = 'fechada';
        updates.data_entrega = new Date().toISOString().split('T')[0];
      }
      if (!updates.situacao && status === 'cancelada') {
        updates.situacao = 'cancelada';
      }
      if (status === 'finalizada') {
        updates.data_conclusao = new Date().toISOString().split('T')[0];
      }
      
      const { error } = await from('ordens_servico')
        .eq('id', id)
        .update(updates);

      if (error) throw error;

      // Enviar status para API externa (não bloquear se falhar)
      if (osData) {
        try {
          const { data: clienteData } = await from('clientes')
            .select(['nome', 'telefone', 'whatsapp'])
            .eq('id', osData.cliente_id)
            .single();

          // TODO: Migrar chamada de função Supabase para API própria
          // await supabase.functions.invoke('ativa-crm-api', {
          //   body: {
          //     action: 'update_os_status',
          //     data: {
          //       os_id: id,
          //       os_numero: osData.numero || 0,
          //       status: status,
          //       cliente_nome: osData.cliente_nome || clienteData?.nome || '',
          //       cliente_telefone: osData.telefone_contato || clienteData?.telefone || clienteData?.whatsapp || '',
          //       valor_total: osData.valor_total || 0
          //     }
          //   }
          // });
        } catch (apiError) {
          console.error('Erro ao enviar status de OS para API externa:', apiError);
          // Não lançar erro para não bloquear a atualização do status
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordens_servico'] });
    },
  });

  // Estatísticas
  const getEstatisticas = useCallback(() => {
    const hoje = new Date().toISOString().split('T')[0];
    const aguardandoStatuses = [
      'aguardando_orcamento',
      'aguardando_peca',
      'aguardando_aprovacao',
      'aguardando_cliente'
    ];
    
    return {
      total: ordens.length,
      abertas: ordens.filter(o => o.status === 'aberta').length,
      emAndamento: ordens.filter(o => ['em_andamento', 'aprovado'].includes(o.status)).length,
      aguardando: ordens.filter(o => aguardandoStatuses.includes(o.status)).length,
      aguardandoPeca: ordens.filter(o => o.status === 'aguardando_peca').length,
      finalizadas: ordens.filter(o => o.status === 'finalizada').length,
      aguardandoRetirada: ordens.filter(o => o.status === 'aguardando_retirada').length,
      entregues: ordens.filter(o => ['entregue', 'entregue_faturada'].includes(o.status)).length,
      canceladas: ordens.filter(o => o.status === 'cancelada').length,
      hoje: ordens.filter(o => o.data_entrada === hoje).length,
      prazoHoje: ordens.filter(o => (o.previsao_entrega && o.previsao_entrega.split('T')[0] === hoje) && !['entregue', 'entregue_faturada', 'cancelada'].includes(o.status)).length,
      emAtraso: ordens.filter(o => 
        o.previsao_entrega && 
        o.previsao_entrega.split('T')[0] < hoje && 
        !['entregue', 'entregue_faturada', 'cancelada'].includes(o.status)
      ).length,
    };
  }, [ordens]);

  return {
    ordens,
    isLoading,
    createOS: createOS.mutateAsync,
    updateOS: (id: string, data: Partial<OrdemServico>) => updateOS.mutateAsync({ id, data }),
    deleteOS,
    getOSById,
    updateStatus: (id: string, status: StatusOS | string) => updateStatus.mutateAsync({ id, status }),
    getEstatisticas,
  };
}

