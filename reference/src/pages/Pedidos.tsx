import { useState, useEffect, useCallback } from 'react';
import { ModernLayout } from '@/components/ModernLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { from } from '@/integrations/db/client';
import { currencyFormatters } from '@/utils/formatters';
import {
  ClipboardList,
  Plus,
  Package,
  CheckCircle2,
  Trash2,
  Search,
  Loader2,
  Pencil,
  User,
} from 'lucide-react';

type PedidoItem = {
  produto_id: string;
  produto_nome: string;
  codigo?: number;
  referencia?: string;
  quantidade: number;
  valor_compra?: number;
  valor_venda?: number;
};

type Pedido = {
  id: string;
  nome: string;
  itens: PedidoItem[];
  createdAt: string;
  createdBy: string;
  recebido?: boolean;
  receivedBy?: string;
  receivedAt?: string;
};

const PEDIDOS_STORAGE_KEY = 'primecamp_pedidos';

function loadPedidosFromStorage(): Pedido[] {
  try {
    const raw = localStorage.getItem(PEDIDOS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : [];
    return list.map((p: any) => ({
      ...p,
      createdBy: p.createdBy ?? '—',
      receivedBy: p.receivedBy,
      receivedAt: p.receivedAt,
      itens: (p.itens || []).map((i: any) => ({
        ...i,
        valor_compra: i.valor_compra ?? undefined,
        valor_venda: i.valor_venda ?? undefined,
      })),
    }));
  } catch {
    return [];
  }
}

function savePedidosToStorage(pedidos: Pedido[]) {
  try {
    localStorage.setItem(PEDIDOS_STORAGE_KEY, JSON.stringify(pedidos));
  } catch {
    // ignore
  }
}

function mapDbToPedido(row: any, itens: any[]): Pedido {
  const itensMap = (itens || []).map((i: any) => ({
    produto_id: i.produto_id,
    produto_nome: i.produto_nome ?? '',
    codigo: i.codigo,
    referencia: i.referencia,
    quantidade: Number(i.quantidade ?? 1),
    valor_compra: i.valor_compra != null ? Number(i.valor_compra) : undefined,
    valor_venda: i.valor_venda != null ? Number(i.valor_venda) : undefined,
  }));
  return {
    id: row.id,
    nome: row.nome ?? '',
    itens: itensMap,
    createdAt: row.created_at ?? new Date().toISOString(),
    createdBy: row.created_by_nome ?? '—',
    recebido: row.recebido ?? false,
    receivedBy: row.received_by_nome,
    receivedAt: row.received_at,
  };
}

export default function Pedidos() {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const userNome = profile?.display_name || user?.email || 'Usuário';
  const companyId = user?.company_id;

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loadingPedidos, setLoadingPedidos] = useState(true);
  const [showNovo, setShowNovo] = useState(false);
  const [editingPedido, setEditingPedido] = useState<Pedido | null>(null);

  const [nomePedido, setNomePedido] = useState('');
  const [itensNovo, setItensNovo] = useState<PedidoItem[]>([]);
  const [buscaProduto, setBuscaProduto] = useState('');
  const [produtosBusca, setProdutosBusca] = useState<{ id: string; nome: string; codigo?: number; referencia?: string }[]>([]);
  const [loadingBusca, setLoadingBusca] = useState(false);
  const [darEntradaId, setDarEntradaId] = useState<string | null>(null);
  const [pedidosFromStorage, setPedidosFromStorage] = useState(false);

  const loadFromDb = useCallback(async () => {
    setLoadingPedidos(true);
    try {
      const fields = 'id,nome,created_at,created_by,created_by_nome,recebido,received_at,received_by,received_by_nome';
      const byId = new Map<string, any>();

      // Sempre filtrar por company_id: cada empresa vê apenas seus pedidos (isolamento multi-tenant)
      if (!companyId) {
        setPedidos([]);
        setLoadingPedidos(false);
        return;
      }
      const resCompany = await from('pedidos')
        .select(fields)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .execute();
      if (resCompany.error) throw resCompany.error;
      for (const r of (resCompany.data || []) as any[]) byId.set(r.id, r);

      const list = Array.from(byId.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      if (list.length === 0) {
        // API não retornou nada: fallback para localStorage (ex.: tabela pedidos ainda não na API)
        const fromStorage = loadPedidosFromStorage();
        setPedidos(fromStorage);
        setPedidosFromStorage(fromStorage.length > 0);
        setLoadingPedidos(false);
        return;
      }
      setPedidosFromStorage(false);
      const ids = list.map((r: any) => r.id);
      const { data: itensRows, error: errItens } = await from('pedido_itens')
        .select('pedido_id,produto_id,produto_nome,codigo,referencia,quantidade,valor_compra,valor_venda')
        .in('pedido_id', ids)
        .execute();
      if (errItens) throw errItens;
      const itensByPedido = (itensRows || []).reduce((acc: Record<string, any[]>, i: any) => {
        const pid = i.pedido_id;
        if (!acc[pid]) acc[pid] = [];
        acc[pid].push(i);
        return acc;
      }, {});
      const mapped = list.map((r: any) => mapDbToPedido(r, itensByPedido[r.id] ?? []));
      setPedidos(mapped);
    } catch (e: any) {
      // Erro na API: tenta mostrar pedidos do localStorage
      const fromStorage = loadPedidosFromStorage();
      if (fromStorage.length > 0) {
        setPedidos(fromStorage);
        setPedidosFromStorage(true);
      } else {
        setPedidosFromStorage(false);
        toast({
          title: 'Erro ao carregar pedidos',
          description: e?.message || 'Não foi possível carregar os pedidos.',
          variant: 'destructive',
        });
        setPedidos([]);
      }
    } finally {
      setLoadingPedidos(false);
    }
  }, [companyId, toast]);

  useEffect(() => {
    loadFromDb();
  }, [loadFromDb]);

  const setPedidosState = useCallback((next: Pedido[]) => {
    setPedidos(next);
  }, []);

  const buscarProdutos = useCallback(async () => {
    const term = (buscaProduto || '').trim();
    if (!term || term.length < 2) {
      setProdutosBusca([]);
      return;
    }
    setLoadingBusca(true);
    try {
      let query = from('produtos')
        .select('id,nome,codigo,referencia')
        .order('nome', { ascending: true })
        .limit(50);
      const codigoNum = parseInt(term);
      if (!isNaN(codigoNum)) {
        query = query.eq('codigo', codigoNum);
      } else {
        query = query.ilike('nome', `%${term}%`);
      }
      const { data, error } = await query.execute();
      if (error) throw error;
      setProdutosBusca((data || []).map((r: any) => ({
        id: r.id,
        nome: r.nome || '',
        codigo: r.codigo,
        referencia: r.referencia,
      })));
    } catch (e: any) {
      toast({
        title: 'Erro na busca',
        description: e?.message || 'Não foi possível buscar produtos.',
        variant: 'destructive',
      });
      setProdutosBusca([]);
    } finally {
      setLoadingBusca(false);
    }
  }, [buscaProduto, toast]);

  const adicionarItem = (p: { id: string; nome: string; codigo?: number; referencia?: string }) => {
    const ja = itensNovo.find((i) => i.produto_id === p.id);
    if (ja) {
      setItensNovo((prev) =>
        prev.map((i) =>
          i.produto_id === p.id ? { ...i, quantidade: i.quantidade + 1 } : i
        )
      );
    } else {
      setItensNovo((prev) => [
        ...prev,
        {
          produto_id: p.id,
          produto_nome: p.nome,
          codigo: p.codigo,
          referencia: p.referencia,
          quantidade: 1,
        },
      ]);
    }
    setBuscaProduto('');
    setProdutosBusca([]);
  };

  const removerItem = (produto_id: string) => {
    setItensNovo((prev) => prev.filter((i) => i.produto_id !== produto_id));
  };

  const alterarItem = (produto_id: string, upd: Partial<PedidoItem>) => {
    setItensNovo((prev) =>
      prev.map((i) => (i.produto_id === produto_id ? { ...i, ...upd } : i))
    );
  };

  const abrirNovo = () => {
    setNomePedido('');
    setItensNovo([]);
    setEditingPedido(null);
    setShowNovo(true);
  };

  const abrirEdicao = (p: Pedido) => {
    if (p.recebido) return;
    setNomePedido(p.nome);
    setItensNovo(p.itens.map((i) => ({ ...i })));
    setEditingPedido(p);
    setShowNovo(true);
  };

  const salvarPedido = async () => {
    const nome = nomePedido.trim();
    if (!nome) {
      toast({ title: 'Nome obrigatório', description: 'Informe o nome do pedido.', variant: 'destructive' });
      return;
    }
    if (itensNovo.length === 0) {
      toast({ title: 'Itens obrigatórios', description: 'Adicione pelo menos um item.', variant: 'destructive' });
      return;
    }
    const itensPayload = itensNovo.map((i) => ({
      produto_id: i.produto_id,
      produto_nome: i.produto_nome,
      codigo: i.codigo,
      referencia: i.referencia,
      quantidade: i.quantidade,
      valor_compra: i.valor_compra,
      valor_venda: i.valor_venda,
    }));
    try {
      if (editingPedido) {
        const { error: errUpd } = await from('pedidos')
          .update({ nome })
          .eq('id', editingPedido.id)
          .execute();
        if (errUpd) throw errUpd;
        await from('pedido_itens').eq('pedido_id', editingPedido.id).delete().execute();
        for (const item of itensPayload) {
          const { error: errItem } = await from('pedido_itens')
            .insert({
              pedido_id: editingPedido.id,
              produto_id: item.produto_id,
              produto_nome: item.produto_nome,
              codigo: item.codigo,
              referencia: item.referencia,
              quantidade: item.quantidade,
              valor_compra: item.valor_compra,
              valor_venda: item.valor_venda,
            })
            .execute();
          if (errItem) throw errItem;
        }
        toast({ title: 'Pedido atualizado', description: `"${nome}" foi alterado.` });
      } else {
        if (!companyId) {
          toast({ title: 'Erro', description: 'Empresa não identificada. Faça login novamente.', variant: 'destructive' });
          return;
        }
        const { data: inserted, error: errIns } = await from('pedidos')
          .insert({
            nome,
            company_id: companyId,
            created_by: user?.id ?? null,
            created_by_nome: userNome,
            recebido: false,
          })
          .select('id,created_at,created_by_nome')
          .execute();
        if (errIns || !inserted) throw errIns || new Error('Inserção falhou');
        const row = Array.isArray(inserted) ? inserted[0] : inserted;
        const pedidoId = row?.id;
        if (!pedidoId) throw new Error('ID do pedido não retornado');
        for (const item of itensPayload) {
          const { error: errItem } = await from('pedido_itens')
            .insert({
              pedido_id: pedidoId,
              produto_id: item.produto_id,
              produto_nome: item.produto_nome,
              codigo: item.codigo,
              referencia: item.referencia,
              quantidade: item.quantidade,
              valor_compra: item.valor_compra,
              valor_venda: item.valor_venda,
            })
            .execute();
          if (errItem) throw errItem;
        }
        toast({ title: 'Pedido criado', description: `"${nome}" foi adicionado à lista.` });
      }
      setShowNovo(false);
      setEditingPedido(null);
      await loadFromDb();
    } catch (e: any) {
      // Fallback: salva só no localStorage quando a API falha (ex.: tabela pedidos não existe na API)
      try {
        if (editingPedido) {
          const next = pedidos.map((p) =>
            p.id === editingPedido.id
              ? {
                  ...p,
                  nome,
                  itens: itensPayload.map((i) => ({
                    produto_id: i.produto_id,
                    produto_nome: i.produto_nome,
                    codigo: i.codigo,
                    referencia: i.referencia,
                    quantidade: i.quantidade,
                    valor_compra: i.valor_compra,
                    valor_venda: i.valor_venda,
                  })),
                }
              : p
          );
          savePedidosToStorage(next);
          setPedidos(next);
          toast({ title: 'Pedido atualizado', description: `"${nome}" foi alterado (salvo localmente).` });
        } else {
          const novo: Pedido = {
            id: crypto.randomUUID(),
            nome,
            itens: itensPayload,
            createdAt: new Date().toISOString(),
            createdBy: userNome,
            recebido: false,
          };
          const next = [...pedidos, novo];
          savePedidosToStorage(next);
          setPedidos(next);
          toast({ title: 'Pedido criado', description: `"${nome}" foi adicionado (salvo localmente).` });
        }
        setShowNovo(false);
        setEditingPedido(null);
      } catch {
        toast({
          title: editingPedido ? 'Erro ao atualizar' : 'Erro ao criar pedido',
          description: e?.message || 'Tente novamente.',
          variant: 'destructive',
        });
      }
    }
  };

  const darEntrada = async (pedido: Pedido) => {
    setDarEntradaId(pedido.id);
    try {
      let totalDespesa = 0;
      for (const item of pedido.itens) {
        const { data: prod, error: errFetch } = await from('produtos')
          .select('id,quantidade,valor_compra,valor_venda,vi_custo,valor_dinheiro_pix')
          .eq('id', item.produto_id)
          .single();
        if (errFetch || !prod) {
          toast({
            title: 'Produto não encontrado',
            description: item.produto_nome,
            variant: 'destructive',
          });
          continue;
        }
        const row = prod as any;
        const atualQtd = Number(row.quantidade ?? 0);
        const novaQtd = atualQtd + item.quantidade;
        const valorCompra = item.valor_compra ?? Number(row.valor_compra ?? row.vi_custo ?? 0);
        const valorVenda = item.valor_venda ?? Number(row.valor_venda ?? row.valor_dinheiro_pix ?? 0);
        totalDespesa += valorCompra * item.quantidade;

        const { error: errUpdate } = await from('produtos')
          .update({
            quantidade: novaQtd,
            ...(item.valor_compra != null && { valor_compra: item.valor_compra, vi_custo: item.valor_compra }),
            ...(item.valor_venda != null && { valor_venda: item.valor_venda, valor_dinheiro_pix: item.valor_venda }),
          })
          .eq('id', item.produto_id)
          .execute();
        if (errUpdate) {
          toast({
            title: 'Erro ao atualizar estoque',
            description: (errUpdate as any)?.message || item.produto_nome,
            variant: 'destructive',
          });
          continue;
        }
      }

      if (totalDespesa > 0) {
        const dueDate = new Date().toISOString().split('T')[0];
        const { error: errBill } = await from('bills_to_pay')
          .insert({
            description: `Entrada de estoque - Pedido: ${pedido.nome}`,
            amount: totalDespesa,
            due_date: dueDate,
            expense_type: 'variavel',
            recurring: false,
            reminder_sent: false,
            status: 'pendente',
            created_by: user?.id,
          })
          .select()
          .execute();
        if (errBill) {
          toast({
            title: 'Estoque atualizado',
            description: 'Despesa em Contas a Pagar não foi criada: ' + (errBill as any)?.message,
            variant: 'destructive',
          });
        }
      }

      const { error: errUpd } = await from('pedidos')
        .update({
          recebido: true,
          received_at: new Date().toISOString(),
          received_by: user?.id ?? null,
          received_by_nome: userNome,
        })
        .eq('id', pedido.id)
        .execute();
      if (errUpd) throw errUpd;
      await loadFromDb();
      toast({
        title: 'Entrada concluída',
        description: `Estoque atualizado. ${totalDespesa > 0 ? 'Despesa gerada em Contas a Pagar.' : ''}`,
      });
    } catch (e: any) {
      toast({
        title: 'Erro',
        description: e?.message || 'Não foi possível concluir a entrada.',
        variant: 'destructive',
      });
    } finally {
      setDarEntradaId(null);
    }
  };

  const excluirPedido = async (id: string) => {
    try {
      const { error } = await from('pedidos').eq('id', id).delete().execute();
      if (error) throw error;
      await loadFromDb();
      toast({ title: 'Pedido removido', description: 'O pedido foi excluído da lista.' });
    } catch (e: any) {
      // Fallback: remove só do localStorage quando a API falha
      const next = pedidos.filter((p) => p.id !== id);
      if (next.length !== pedidos.length) {
        savePedidosToStorage(next);
        setPedidos(next);
        toast({ title: 'Pedido removido', description: 'O pedido foi excluído (apenas local).' });
      } else {
        toast({
          title: 'Erro ao excluir',
          description: e?.message || 'Não foi possível excluir o pedido.',
          variant: 'destructive',
        });
      }
    }
  };

  const totalPedido = (itens: PedidoItem[]) =>
    itens.reduce((s, i) => s + (i.valor_compra ?? 0) * i.quantidade, 0);

  return (
    <ModernLayout title="Pedidos" subtitle="Crie pedidos e dê entrada no estoque">
      <div className="space-y-4 md:space-y-6 pb-8 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Crie pedidos de compra e, quando receber a mercadoria, use &quot;Dar entrada&quot; para atualizar o estoque e gerar a despesa em Contas a Pagar.
          </p>
          <Button
            onClick={abrirNovo}
            className="w-full sm:w-auto min-h-[44px] sm:min-h-0 rounded-xl sm:rounded-md touch-manipulation"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo pedido
          </Button>
        </div>

        {loadingPedidos ? (
          <Card className="border-2 border-dashed rounded-xl overflow-hidden">
            <CardContent className="flex flex-col items-center justify-center py-10 sm:py-12 text-center px-4">
              <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4 animate-spin" />
              <CardTitle className="text-base sm:text-lg">Carregando pedidos...</CardTitle>
            </CardContent>
          </Card>
        ) : pedidos.length === 0 ? (
          <Card className="border-2 border-dashed rounded-xl overflow-hidden">
            <CardContent className="flex flex-col items-center justify-center py-10 sm:py-12 text-center px-4">
              <ClipboardList className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
              <CardTitle className="text-base sm:text-lg">Nenhum pedido</CardTitle>
              <CardDescription className="mt-2 text-sm">
                {!companyId
                  ? 'Faça login para ver os pedidos da sua empresa.'
                  : 'Crie um pedido para listar itens e depois dar entrada no estoque.'}
              </CardDescription>
              {companyId && (
                <Button className="mt-4 min-h-[44px] rounded-xl touch-manipulation w-full sm:w-auto" onClick={abrirNovo}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo pedido
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {pedidosFromStorage && (
              <Alert variant="default" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-500/30 rounded-xl">
                <AlertTitle className="text-sm sm:text-base">Lista apenas deste navegador</AlertTitle>
                <AlertDescription className="text-xs sm:text-sm">
                  Você está vendo só os pedidos salvos neste computador. Para que todos da empresa vejam a mesma lista, é preciso que a API exponha as tabelas <strong>pedidos</strong> e <strong>pedido_itens</strong> no backend e que a migração <code className="text-[10px] sm:text-xs">ADD_PEDIDOS_COMPANY_ID</code> esteja aplicada no banco.
                </AlertDescription>
              </Alert>
            )}
            <div className="grid gap-3 md:gap-4">
            {pedidos.map((p) => (
              <Card key={p.id} className={`rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden min-w-0 ${p.recebido ? 'opacity-90' : ''}`}>
                <CardHeader className="pb-2 pt-3 px-3 sm:pt-4 sm:px-6">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-base sm:text-base flex items-center gap-2 flex-wrap">
                          <span className="truncate">{p.nome}</span>
                          {p.recebido && (
                            <Badge variant="secondary" className="font-normal shrink-0">
                              Recebido
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="mt-1 flex flex-col gap-0.5 text-xs sm:text-sm">
                          <span>{new Date(p.createdAt).toLocaleString('pt-BR')} · {p.itens.length} item(ns)</span>
                          <span className="flex items-center gap-1.5">
                            <User className="h-3 w-3 shrink-0" />
                            Criado por: {p.createdBy}
                          </span>
                          {p.recebido && p.receivedBy && (
                            <span className="flex items-center gap-1.5">
                              <Package className="h-3 w-3 shrink-0" />
                              Recebido por: {p.receivedBy}
                              {p.receivedAt && ` em ${new Date(p.receivedAt).toLocaleString('pt-BR')}`}
                            </span>
                          )}
                        </CardDescription>
                      </div>
                      {!p.recebido && (
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => abrirEdicao(p)}
                            className="min-h-[44px] sm:min-h-0 rounded-xl sm:rounded-md touch-manipulation flex-1 sm:flex-initial"
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => darEntrada(p)}
                            disabled={!!darEntradaId}
                            className="min-h-[44px] sm:min-h-0 rounded-xl sm:rounded-md touch-manipulation flex-1 sm:flex-initial"
                          >
                            {darEntradaId === p.id ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Package className="h-4 w-4 mr-2" />
                            )}
                            Dar entrada
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => excluirPedido(p.id)}
                            disabled={!!darEntradaId}
                            className="min-h-[44px] sm:min-h-0 min-w-[44px] rounded-xl sm:rounded-md touch-manipulation"
                            aria-label="Excluir pedido"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6 pt-0">
                  {/* Mobile: lista de itens legível, sem tabela truncada */}
                  <div className="md:hidden space-y-2 min-w-0">
                    {p.itens.map((i) => (
                      <div
                        key={i.produto_id}
                        className="rounded-lg border border-gray-200 dark:border-gray-700 bg-muted/30 dark:bg-muted/20 px-3 py-2.5"
                      >
                        <p className="font-medium text-sm text-foreground truncate">{i.produto_nome}</p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                          <span>Cód: {i.codigo ?? i.referencia ?? '—'}</span>
                          <span>·</span>
                          <span>Qtd: {i.quantidade}</span>
                          <span>·</span>
                          <span>Custo un: {i.valor_compra != null ? currencyFormatters.brl(i.valor_compra) : '—'}</span>
                          <span>·</span>
                          <span>Venda un: {i.valor_venda != null ? currencyFormatters.brl(i.valor_venda) : '—'}</span>
                        </div>
                        <p className="text-xs font-semibold text-foreground mt-1.5 tabular-nums">
                          Total: {currencyFormatters.brl((i.valor_compra ?? 0) * i.quantidade)}
                        </p>
                      </div>
                    ))}
                    {totalPedido(p.itens) > 0 && (
                      <p className="text-sm font-semibold text-muted-foreground pt-1 border-t border-border">
                        Total do pedido (custo): {currencyFormatters.brl(totalPedido(p.itens))}
                      </p>
                    )}
                  </div>
                  {/* Desktop: tabela */}
                  <div className="hidden md:block overflow-x-auto -mx-2 min-w-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">Código</TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead className="text-right w-20">Qtd</TableHead>
                          <TableHead className="text-right w-24">Custo un.</TableHead>
                          <TableHead className="text-right w-24">Venda un.</TableHead>
                          <TableHead className="text-right w-24">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {p.itens.map((i) => (
                          <TableRow key={i.produto_id}>
                            <TableCell className="font-mono text-muted-foreground">
                              {i.codigo ?? i.referencia ?? '-'}
                            </TableCell>
                            <TableCell>{i.produto_nome}</TableCell>
                            <TableCell className="text-right font-mono">{i.quantidade}</TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">
                              {i.valor_compra != null ? currencyFormatters.brl(i.valor_compra) : '—'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">
                              {i.valor_venda != null ? currencyFormatters.brl(i.valor_venda) : '—'}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {currencyFormatters.brl((i.valor_compra ?? 0) * i.quantidade)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {totalPedido(p.itens) > 0 && (
                      <p className="text-sm font-medium text-muted-foreground mt-2 text-right">
                        Total do pedido (custo): {currencyFormatters.brl(totalPedido(p.itens))}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            </div>
          </>
        )}
      </div>

      <Dialog open={showNovo} onOpenChange={(open) => !open && (setShowNovo(false), setEditingPedido(null))}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col rounded-xl sm:rounded-lg">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-base sm:text-lg">{editingPedido ? 'Editar pedido' : 'Novo pedido'}</DialogTitle>
            <CardDescription className="text-xs sm:text-sm">
              {editingPedido ? 'Altere nome e itens (custos e vendas serão usados ao dar entrada).' : 'Nome do pedido e itens. Informe custo e venda para atualizar ao dar entrada e gerar despesa.'}
            </CardDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto flex-1 min-h-0">
            <div>
              <Label className="text-sm">Nome do pedido</Label>
              <Input
                placeholder="Ex: Pedido Fornecedor X - Jan/2025"
                value={nomePedido}
                onChange={(e) => setNomePedido(e.target.value)}
                className="mt-1 min-h-[44px] rounded-lg touch-manipulation"
              />
            </div>
            <div>
              <Label className="text-sm">Buscar produto para adicionar</Label>
              <div className="flex flex-col sm:flex-row gap-2 mt-1">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-9 min-h-[44px] rounded-lg touch-manipulation"
                    placeholder="Nome ou código do produto..."
                    value={buscaProduto}
                    onChange={(e) => setBuscaProduto(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), buscarProdutos())}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={buscarProdutos}
                  disabled={loadingBusca}
                  className="min-h-[44px] rounded-lg touch-manipulation shrink-0"
                >
                  {loadingBusca ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
                </Button>
              </div>
              {produtosBusca.length > 0 && (
                <ul className="mt-2 border rounded-lg divide-y max-h-40 overflow-auto">
                  {produtosBusca.map((prod) => (
                    <li key={prod.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-3 sm:py-2 text-left text-sm hover:bg-muted flex justify-between items-center min-h-[44px] sm:min-h-0 touch-manipulation"
                        onClick={() => adicionarItem(prod)}
                      >
                        <span className="truncate">{prod.nome}</span>
                        <span className="text-muted-foreground font-mono text-xs shrink-0 ml-2">
                          {prod.codigo ?? prod.referencia ?? ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {itensNovo.length > 0 && (
              <div>
                <Label>Itens do pedido</Label>
                <div className="border rounded-lg overflow-x-auto mt-1">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código / Ref.</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="w-20 text-right">Qtd</TableHead>
                        <TableHead className="w-28 text-right">Custo un. (R$)</TableHead>
                        <TableHead className="w-28 text-right">Venda un. (R$)</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itensNovo.map((i) => (
                        <TableRow key={i.produto_id}>
                          <TableCell className="font-mono text-muted-foreground">
                            {i.codigo ?? i.referencia ?? '-'}
                          </TableCell>
                          <TableCell>{i.produto_nome}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min={1}
                              value={i.quantidade}
                              onChange={(e) => alterarItem(i.produto_id, { quantidade: Number(e.target.value) || 0 })}
                              className="w-16 text-right h-8"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              placeholder="0"
                              value={i.valor_compra ?? ''}
                              onChange={(e) => alterarItem(i.produto_id, { valor_compra: parseFloat(e.target.value) || undefined })}
                              className="w-24 text-right h-8"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              placeholder="0"
                              value={i.valor_venda ?? ''}
                              onChange={(e) => alterarItem(i.produto_id, { valor_venda: parseFloat(e.target.value) || undefined })}
                              className="w-24 text-right h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => removerItem(i.produto_id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total (custo): {currencyFormatters.brl(totalPedido(itensNovo))} — será gerado em Contas a Pagar ao dar entrada.
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowNovo(false)}
              className="w-full sm:w-auto min-h-[44px] sm:min-h-0 rounded-xl sm:rounded-md touch-manipulation"
            >
              Cancelar
            </Button>
            <Button
              onClick={salvarPedido}
              disabled={itensNovo.length === 0 || !nomePedido.trim()}
              className="w-full sm:w-auto min-h-[44px] sm:min-h-0 rounded-xl sm:rounded-md touch-manipulation"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {editingPedido ? 'Salvar alterações' : 'Salvar pedido'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModernLayout>
  );
}
