import { useState, useEffect, useCallback } from 'react';
import { from } from '@/integrations/db/client';
import { useAuth } from '@/contexts/AuthContext';

/** Categorias para filtrar logs na tela /admin/logs */
export type LogCategory =
  | 'todos'
  | 'vendas'
  | 'produtos'
  | 'os'
  | 'cancelamentos'
  | 'exclusoes'
  | 'caixa'
  | 'ponto'
  | 'tarefas_processos'
  | 'usuarios'
  | 'outros';

export interface UnifiedLogEntry {
  id: string;
  created_at: string;
  user_id: string | null;
  user_name: string;
  category: LogCategory;
  action_label: string;
  description: string;
  entity_type: string | null;
  entity_id: string | null;
  source: 'audit' | 'activity';
  ip_address?: string | null;
  /** Só preenchido para source === 'audit' */
  acao?: string;
  entidade?: string;
  dados_anteriores?: unknown;
  dados_novos?: unknown;
}

function categoryFromAudit(entidade: string, acao: string): LogCategory {
  const e = (entidade || '').toLowerCase();
  const a = (acao || '').toLowerCase();
  if (a === 'delete') return 'exclusoes';
  if (e === 'sale' || e === 'payment') return 'vendas';
  if (e === 'cancel_request') return 'cancelamentos';
  if (e === 'ordem_servico') return 'os';
  if (e === 'cash_session' || e === 'cash_movement') return 'caixa';
  if (e === 'produto' || e === 'product') return 'produtos';
  return 'outros';
}

function categoryFromActivity(activityType: string): LogCategory {
  const t = (activityType || '').toLowerCase();
  if (t === 'time_clock') return 'ponto';
  if (t.includes('task')) return 'tarefas_processos';
  if (t.includes('process')) return 'tarefas_processos';
  if (t === 'update_user' || t === 'login' || t === 'logout') return 'usuarios';
  return 'outros';
}

function actionLabelAudit(acao: string, entidade: string): string {
  const a = (acao || '').toLowerCase();
  const e = (entidade || '').toLowerCase();
  const labels: Record<string, string> = {
    create: 'Criação',
    update: 'Atualização',
    delete: 'Exclusão',
    cancel: 'Cancelamento',
    approve: 'Aprovação',
    reject: 'Rejeição',
    refund: 'Estorno',
  };
  const acaoLabel = labels[a] || acao;
  const entLabels: Record<string, string> = {
    sale: 'Venda',
    payment: 'Pagamento',
    cash_session: 'Caixa',
    cash_movement: 'Mov. Caixa',
    cancel_request: 'Pedido cancelamento',
    ordem_servico: 'OS',
    produto: 'Produto',
    product: 'Produto',
  };
  const entLabel = entLabels[e] || e;
  return `${acaoLabel} · ${entLabel}`;
}

function actionLabelActivity(activityType: string): string {
  const labels: Record<string, string> = {
    time_clock: 'Ponto',
    create_process: 'Processo criado',
    update_process: 'Processo atualizado',
    delete_process: 'Processo excluído',
    create_task: 'Tarefa criada',
    update_task: 'Tarefa atualizada',
    update_task_status: 'Status da tarefa',
    delete_task: 'Tarefa excluída',
    update_user: 'Usuário atualizado',
    login: 'Login',
    logout: 'Logout',
  };
  return labels[activityType] || activityType?.replace(/_/g, ' ') || 'Atividade';
}

export function useAdminLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<UnifiedLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!user?.company_id) {
      setLogs([]);
      setLoading(false);
      setError('Usuário sem empresa vinculada. Não é possível carregar os logs.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [activityRes, auditRes] = await Promise.all([
        from('user_activity_logs')
          .select('*')
          .eq('company_id', user.company_id)
          .order('created_at', { ascending: false })
          .limit(500)
          .execute(),
        from('audit_logs')
          .select('*')
          .eq('company_id', user.company_id)
          .order('created_at', { ascending: false })
          .limit(500)
          .execute(),
      ]);

      const activityData = (activityRes.error ? [] : activityRes.data) || [];
      const auditData = (auditRes.error ? [] : auditRes.data) || [];

      const activityEntries: UnifiedLogEntry[] = activityData.map((row: any) => ({
        id: `activity-${row.id}`,
        created_at: row.created_at,
        user_id: row.user_id,
        user_name: 'Usuário', // preenchido depois com nome do profile
        category: categoryFromActivity(row.activity_type),
        action_label: actionLabelActivity(row.activity_type),
        description: row.description || '',
        entity_type: row.entity_type || null,
        entity_id: row.entity_id || null,
        source: 'activity',
        ip_address: row.ip_address,
      }));

      const auditEntries: UnifiedLogEntry[] = auditData.map((row: any) => ({
        id: `audit-${row.id}`,
        created_at: row.created_at,
        user_id: row.user_id,
        user_name: row.user_nome || row.user_email || 'Usuário',
        category: categoryFromAudit(row.entidade || '', row.acao || ''),
        action_label: actionLabelAudit(row.acao || '', row.entidade || ''),
        description: row.descricao || '',
        entity_type: row.entidade || null,
        entity_id: row.entidade_id || null,
        source: 'audit',
        ip_address: row.ip_address,
        acao: row.acao,
        entidade: row.entidade,
        dados_anteriores: row.dados_anteriores,
        dados_novos: row.dados_novos,
      }));

      const merged = [...activityEntries, ...auditEntries].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setLogs(merged);
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar logs');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [user?.company_id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { logs, loading, error, refetch: fetchAll };
}

export const LOG_CATEGORY_LABELS: Record<LogCategory, string> = {
  todos: 'Todos',
  vendas: 'Vendas',
  produtos: 'Produtos',
  os: 'Ordens de Serviço',
  cancelamentos: 'Cancelamentos',
  exclusoes: 'Exclusões',
  caixa: 'Caixa',
  ponto: 'Ponto',
  tarefas_processos: 'Tarefas e Processos',
  usuarios: 'Usuários',
  outros: 'Outros',
};
