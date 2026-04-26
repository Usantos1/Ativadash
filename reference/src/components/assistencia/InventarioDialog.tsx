import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { from } from '@/integrations/db/client';
import { useAuth } from '@/contexts/AuthContext';
import { ClipboardList, CheckCircle2, XCircle } from 'lucide-react';
import { ProductFormOptimized } from '@/components/assistencia/ProductFormOptimized';
import { Produto } from '@/types/assistencia';
import { mapSupabaseToAssistencia, useProdutosSupabase } from '@/hooks/useProdutosSupabase';
import { useMarcasModelosSupabase } from '@/hooks/useMarcasModelosSupabase';

type InventarioStatus = 'pending' | 'approved' | 'rejected';

type ProdutoInventarioRow = {
  id: string;
  nome?: string | null;
  codigo?: number | null;
  referencia?: string | null;
  codigo_barras?: string | null;
  quantidade?: number | null;
};

interface InventarioRow {
  id: string;
  status: InventarioStatus;
  total_itens: number;
  filtros?: any;
  created_at: string;
  created_by_nome?: string | null;
  approved_at?: string | null;
  approved_by_nome?: string | null;
  rejected_at?: string | null;
  rejected_by_nome?: string | null;
  rejected_reason?: string | null;
}

interface InventarioItemRow {
  id: string;
  inventario_id: string;
  produto_id: string;
  produto_nome?: string | null;
  codigo?: number | null;
  referencia?: string | null;
  codigo_barras?: string | null;
  qtd_sistema: number;
  qtd_contada?: number | null;
}

interface InventarioDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  filtrosAtuais: { searchTerm: string; grupo: string; localizacao: string };
  /** Quando true, renderiza o conteúdo como página (sem Dialog) */
  standalone?: boolean;
}

export function InventarioDialog({ open = false, onOpenChange, filtrosAtuais, standalone = false }: InventarioDialogProps) {
  const isOpen = open || standalone;
  const { toast } = useToast();
  const { user, profile, isAdmin } = useAuth();
  const { updateProduto } = useProdutosSupabase();
  const { marcas, modelos } = useMarcasModelosSupabase();

  const [activeTab, setActiveTab] = useState<'novo' | 'aprovacoes'>('novo');
  const [contagem, setContagem] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null);
  const [loadingEditProduto, setLoadingEditProduto] = useState(false);

  const [page, setPage] = useState(1);
  const pageSize = 100;
  const [produtos, setProdutos] = useState<ProdutoInventarioRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / pageSize));
  const [loadingProdutos, setLoadingProdutos] = useState(false);

  // Busca dentro do inventário (código ou código de barras)
  const [inventarioBusca, setInventarioBusca] = useState('');
  const [debouncedInventarioBusca, setDebouncedInventarioBusca] = useState('');

  // Salvamento automático (rascunho)
  const [draftInventarioId, setDraftInventarioId] = useState<string>('');
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string>('');
  const saveTimersRef = useRef<Record<string, any>>({});

  const [pendentes, setPendentes] = useState<InventarioRow[]>([]);
  const [selectedInventarioId, setSelectedInventarioId] = useState<string>('');
  const [selectedItens, setSelectedItens] = useState<InventarioItemRow[]>([]);
  const [rejectReason, setRejectReason] = useState('');

  const userNome = profile?.display_name || user?.email || 'Usuário';

  // debounce da busca interna (300ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedInventarioBusca(inventarioBusca.trim()), 300);
    return () => clearTimeout(t);
  }, [inventarioBusca]);

  const ensureDraftInventario = async (): Promise<string | null> => {
    if (draftInventarioId) return draftInventarioId;
    if (!user?.id) return null;

    try {
      const { data: inv, error } = await from('inventarios')
        .insert({
          status: 'draft',
          filtros: filtrosAtuais,
          total_itens: 0,
          created_by: user.id,
          created_by_nome: userNome,
        })
        .select('*')
        .single();

      if (error || !inv?.id) throw error || new Error('Falha ao criar rascunho do inventário');
      setDraftInventarioId(inv.id);
      return inv.id;
    } catch (e) {
      console.error(e);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar rascunho para salvamento automático do inventário.',
        variant: 'destructive',
      });
      return null;
    }
  };

  const ensurePageItemsExist = async (inventarioId: string, pageItems: any[]) => {
    if (!inventarioId) return;
    const ids = pageItems.map((p: any) => p.id).filter(Boolean);
    if (ids.length === 0) return;

    // checar quais já existem
    const { data: existing } = await from('inventario_itens')
      .select('produto_id')
      .eq('inventario_id', inventarioId)
      .in('produto_id', ids)
      .execute();

    const existingSet = new Set((existing || []).map((r: any) => r.produto_id));
    const missing = pageItems.filter((p: any) => p?.id && !existingSet.has(p.id));
    if (missing.length === 0) return;

    const itemsToInsert = missing.map((p: any) => ({
      inventario_id: inventarioId,
      produto_id: p.id,
      produto_nome: p.nome || '',
      qtd_sistema: Number(p.quantidade || 0),
      qtd_contada: Number(contagem[p.id] ?? Number(p.quantidade || 0)),
    }));

    const { error } = await from('inventario_itens').insert(itemsToInsert).execute();
    if (error) throw error;
  };

  const saveCountDebounced = async (produtoId: string, qtdContada: number, qtdSistema: number, produtoNome?: string | null) => {
    const invId = await ensureDraftInventario();
    if (!invId) return;

    // Debounce por produto
    if (saveTimersRef.current[produtoId]) {
      clearTimeout(saveTimersRef.current[produtoId]);
    }

    saveTimersRef.current[produtoId] = setTimeout(async () => {
      setIsAutoSaving(true);
      try {
        // garantir que existe item
        const { data: existing } = await from('inventario_itens')
          .select('id')
          .eq('inventario_id', invId)
          .eq('produto_id', produtoId)
          .maybeSingle();

        if ((existing as any)?.id) {
          const { error } = await from('inventario_itens')
            .update({ qtd_contada: qtdContada, qtd_sistema: qtdSistema, produto_nome: produtoNome || null })
            .eq('id', (existing as any).id)
            .execute();
          if (error) throw error;
        } else {
          const { error } = await from('inventario_itens')
            .insert({
              inventario_id: invId,
              produto_id: produtoId,
              produto_nome: produtoNome || null,
              qtd_sistema: qtdSistema,
              qtd_contada: qtdContada,
            })
            .execute();
          if (error) throw error;
        }

        setLastSavedAt(new Date().toLocaleTimeString('pt-BR'));
      } catch (e) {
        console.error(e);
      } finally {
        setIsAutoSaving(false);
      }
    }, 450);
  };

  const loadProdutos = async () => {
    try {
      setLoadingProdutos(true);

      let query = from('produtos')
        .select('id,nome,codigo,referencia,codigo_barras,quantidade')
        .order('nome', { ascending: true });

      if (filtrosAtuais.grupo && filtrosAtuais.grupo.trim()) {
        query = query.eq('grupo', filtrosAtuais.grupo.trim());
      }
      if (filtrosAtuais.localizacao && filtrosAtuais.localizacao.trim()) {
        query = query.eq('localizacao', filtrosAtuais.localizacao.trim());
      }

      // Busca: Código, Referência, Cód. Barras ou Nome do produto
      const invSearch = (debouncedInventarioBusca || '').trim();
      const pageSearch = (filtrosAtuais.searchTerm || '').trim();
      const search = invSearch || pageSearch;
      if (search) {
        const codigoNum = parseInt(search);
        const likeVal = `%${search}%`;
        if (!isNaN(codigoNum)) {
          query = query.or(`codigo.eq.${codigoNum},codigo_barras.ilike.${likeVal},referencia.ilike.${likeVal},nome.ilike.${likeVal}`);
        } else {
          query = query.or(`codigo_barras.ilike.${likeVal},referencia.ilike.${likeVal},nome.ilike.${likeVal}`);
        }
      }

      const fromIdx = (page - 1) * pageSize;
      const toIdx = fromIdx + pageSize - 1;
      query = query.range(fromIdx, toIdx);

      const { data, error, count } = await query.execute();
      if (error) throw error;

      setProdutos((data || []) as any);
      setTotalCount(count || 0);

      // Inicializar contagem (sem sobrescrever valores já digitados)
      setContagem(prev => {
        const next = { ...prev };
        (data || []).forEach((p: any) => {
          if (!p?.id) return;
          if (next[p.id] === undefined) {
            next[p.id] = Number(p.quantidade || 0);
          }
        });
        return next;
      });

      // Salvamento automático: garantir itens desta página no rascunho
      if (isOpen) {
        const invId = await ensureDraftInventario();
        if (invId) {
          try {
            await ensurePageItemsExist(invId, data || []);
          } catch (e) {
            console.error(e);
          }
        }
      }
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Erro', description: e?.message || 'Erro ao carregar produtos para inventário', variant: 'destructive' });
    } finally {
      setLoadingProdutos(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setPage(1);
  }, [isOpen, filtrosAtuais.grupo, filtrosAtuais.localizacao, filtrosAtuais.searchTerm, debouncedInventarioBusca]);

  useEffect(() => {
    if (!isOpen) return;
    loadProdutos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, page]);

  const itensNovoInventario = useMemo(() => {
    return produtos
      .filter(p => Boolean(p.id))
      .map(p => ({
        produto_id: p.id,
        produto_nome: p.nome || '',
        codigo: p.codigo || null,
        referencia: p.referencia || null,
        codigo_barras: p.codigo_barras || null,
        qtd_sistema: Number(p.quantidade || 0),
        qtd_contada: Number(contagem[p.id] ?? (p.quantidade || 0)),
      }));
  }, [produtos, contagem]);

  const loadPendentes = async () => {
    const { data, error } = await from('inventarios')
      .select('id,status,total_itens,filtros,created_at,created_by_nome,approved_at,approved_by_nome,rejected_at,rejected_by_nome,rejected_reason')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50)
      .execute();
    if (error) {
      toast({ title: 'Erro', description: 'Erro ao carregar inventários pendentes', variant: 'destructive' });
      return;
    }
    setPendentes((data || []) as any);
  };

  const loadInventarioItens = async (inventarioId: string) => {
    const { data, error } = await from('inventario_itens')
      .select('id,inventario_id,produto_id,produto_nome,qtd_sistema,qtd_contada')
      .eq('inventario_id', inventarioId)
      .execute();
    if (error) {
      toast({ title: 'Erro', description: 'Erro ao carregar itens do inventário', variant: 'destructive' });
      return;
    }
    const itens = (data || []) as any[];
    const ids = Array.from(new Set(itens.map(i => i.produto_id).filter(Boolean)));
    let metaById = new Map<string, any>();
    if (ids.length > 0) {
      const { data: metas } = await from('produtos')
        .select('id,codigo,referencia,codigo_barras')
        .in('id', ids)
        .execute();
      metaById = new Map((metas || []).map((m: any) => [m.id, m]));
    }

    setSelectedItens(
      itens.map((it: any) => {
        const meta = metaById.get(it.produto_id) || {};
        return {
          ...it,
          codigo: meta.codigo ?? null,
          referencia: meta.referencia ?? null,
          codigo_barras: meta.codigo_barras ?? null,
        };
      }) as any
    );
  };

  useEffect(() => {
    if (!isOpen) return;
    if (isAdmin) {
      loadPendentes();
    }
  }, [isOpen, isAdmin]);

  const handleCriarInventario = async () => {
    if (!user?.id) {
      toast({ title: 'Erro', description: 'Usuário não autenticado', variant: 'destructive' });
      return;
    }
    if (itensNovoInventario.length === 0) {
      toast({ title: 'Nada para inventariar', description: 'Nenhum produto nesta página do inventário.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      // Se já existe rascunho, apenas envia para aprovação (status pending)
      const invId = await ensureDraftInventario();
      if (!invId) throw new Error('Inventário (rascunho) não disponível');

      // garantir itens desta página antes de enviar
      await ensurePageItemsExist(invId, produtos);

      // total_itens (count do banco)
      const { count } = await from('inventario_itens')
        .select('id')
        .eq('inventario_id', invId)
        .execute();

      const totalItens = Number(count || 0);

      const { error: updErr } = await from('inventarios')
        .update({
          status: 'pending',
          filtros: filtrosAtuais,
          total_itens: totalItens,
        })
        .eq('id', invId)
        .execute();

      if (updErr) throw updErr;

      toast({
        title: 'Inventário enviado',
        description: `Inventário enviado para aprovação (itens salvos automaticamente).`,
      });

      if (isAdmin) {
        await loadPendentes();
        setActiveTab('aprovacoes');
      } else {
        onOpenChange(false);
      }
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Erro', description: e?.message || 'Erro ao criar inventário', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAprovar = async () => {
    if (!user?.id) return;
    if (!selectedInventarioId) return;

    setIsSubmitting(true);
    try {
      // Recarregar itens do inventário
      const { data: items, error: itemsErr } = await from('inventario_itens')
        .select('produto_id,produto_nome,qtd_sistema,qtd_contada')
        .eq('inventario_id', selectedInventarioId)
        .execute();
      if (itemsErr) throw itemsErr;

      const itens = (items || []) as any[];
      const updates = itens
        .map(i => ({
          produto_id: i.produto_id,
          produto_nome: i.produto_nome,
          qtd_sistema: Number(i.qtd_sistema || 0),
          qtd_contada: Number(i.qtd_contada ?? i.qtd_sistema ?? 0),
        }))
        .filter(i => i.produto_id);

      // Aplicar ajustes de estoque + registrar movimentações
      for (const it of updates) {
        if (it.qtd_contada === it.qtd_sistema) continue;
        await from('produtos')
          .update({ quantidade: it.qtd_contada })
          .eq('id', it.produto_id)
          .execute();
      }

      const movs = updates
        .filter(it => it.qtd_contada !== it.qtd_sistema)
        .map(it => ({
          produto_id: it.produto_id,
          tipo: 'inventario_aprovado',
          inventario_id: selectedInventarioId,
          motivo: 'Inventário aprovado',
          quantidade_antes: it.qtd_sistema,
          quantidade_depois: it.qtd_contada,
          quantidade_delta: it.qtd_contada - it.qtd_sistema,
          user_id: user.id,
          user_nome: userNome,
        }));

      if (movs.length > 0) {
        await from('produto_movimentacoes').insert(movs).execute();
      }

      // Atualizar inventário
      await from('inventarios')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user.id,
          approved_by_nome: userNome,
        })
        .eq('id', selectedInventarioId)
        .execute();

      toast({ title: 'Inventário aprovado', description: `Ajustes aplicados em ${movs.length} produto(s).` });
      setSelectedInventarioId('');
      setSelectedItens([]);
      await loadPendentes();
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Erro', description: e?.message || 'Erro ao aprovar inventário', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejeitar = async () => {
    if (!user?.id) return;
    if (!selectedInventarioId) return;

    setIsSubmitting(true);
    try {
      await from('inventarios')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejected_by: user.id,
          rejected_by_nome: userNome,
          rejected_reason: rejectReason || null,
        })
        .eq('id', selectedInventarioId)
        .execute();

      toast({ title: 'Inventário rejeitado' });
      setRejectReason('');
      setSelectedInventarioId('');
      setSelectedItens([]);
      await loadPendentes();
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Erro', description: e?.message || 'Erro ao rejeitar inventário', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const content = (
    <>
      {!standalone && (
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Inventário (contagem com aprovação)
          </DialogTitle>
        </DialogHeader>
      )}
      {standalone && (
        <div className="flex items-center gap-2 mb-4">
          <ClipboardList className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Inventário (contagem com aprovação)</h2>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <TabsTrigger value="novo">Novo (100 por página)</TabsTrigger>
            {isAdmin && <TabsTrigger value="aprovacoes">Aprovações</TabsTrigger>}
          </TabsList>

          <TabsContent value="novo" className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Itens: <span className="font-semibold text-foreground">{itensNovoInventario.length}</span> (página {page}/{totalPages})
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Status: {draftInventarioId ? 'Rascunho (auto)' : 'Pendente'}</Badge>
                {isAutoSaving ? (
                  <Badge variant="secondary">Salvando...</Badge>
                ) : lastSavedAt ? (
                  <Badge variant="secondary">Salvo: {lastSavedAt}</Badge>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-center">
              <Input
                placeholder="Buscar por Código, Referência, Cód. Barras ou Produto..."
                value={inventarioBusca}
                onChange={(e) => setInventarioBusca(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="border rounded-lg overflow-x-auto overflow-y-auto max-h-[50vh] sm:max-h-[60vh] scrollbar-thin">
              <Table className="min-w-[640px] w-full table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20 shrink-0">Código</TableHead>
                    <TableHead className="w-24 shrink-0">Referência</TableHead>
                    <TableHead className="w-28 shrink-0">Cód. Barras</TableHead>
                    <TableHead className="min-w-[180px] w-[40%]">Produto</TableHead>
                    <TableHead className="w-20 text-right shrink-0">Sistema</TableHead>
                    <TableHead className="w-28 text-right shrink-0">Contado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingProdutos ? (
                    <TableRow><TableCell colSpan={6} className="text-sm text-muted-foreground p-4">Carregando...</TableCell></TableRow>
                  ) : itensNovoInventario.map((i) => (
                    <TableRow
                      key={i.produto_id}
                      className="cursor-pointer hover:bg-muted/50"
                      onDoubleClick={async (e) => {
                        if ((e.target as HTMLElement).closest('input')) return;
                        setLoadingEditProduto(true);
                        try {
                          const { data: row, error } = await from('produtos')
                            .select('*')
                            .eq('id', i.produto_id)
                            .single();
                          if (error || !row) {
                            toast({ title: 'Erro', description: 'Produto não encontrado.', variant: 'destructive' });
                            return;
                          }
                          setEditingProduto(mapSupabaseToAssistencia(row));
                        } finally {
                          setLoadingEditProduto(false);
                        }
                      }}
                    >
                      <TableCell className="font-mono whitespace-nowrap">{i.codigo ?? '-'}</TableCell>
                      <TableCell className="font-mono whitespace-nowrap">{i.referencia ?? '-'}</TableCell>
                      <TableCell className="font-mono text-xs whitespace-nowrap">{i.codigo_barras ?? '-'}</TableCell>
                      <TableCell className="font-medium break-words min-w-0" title={i.produto_nome ?? ''}>{i.produto_nome}</TableCell>
                      <TableCell className="text-right font-mono">{i.qtd_sistema}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Input
                          type="number"
                          value={contagem[i.produto_id] ?? i.qtd_sistema}
                          onChange={(e) => {
                            const v = Number(e.target.value || 0);
                            setContagem(prev => ({ ...prev, [i.produto_id]: v }));
                            void saveCountDebounced(i.produto_id, v, i.qtd_sistema, i.produto_nome);
                          }}
                          className="w-28 ml-auto text-right"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {standalone ? (
              <div className="flex flex-wrap gap-2 items-center justify-between pt-4">
                <div className="mr-auto flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1 || isSubmitting}>Anterior</Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages || isSubmitting}>Próxima</Button>
                  <span className="text-xs text-muted-foreground">{totalCount > 0 ? `Total: ${totalCount}` : ''}</span>
                </div>
                <Button onClick={handleCriarInventario} disabled={isSubmitting || loadingProdutos}>
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Enviar para aprovação
                </Button>
              </div>
            ) : (
              <DialogFooter className="gap-2">
                <div className="mr-auto flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1 || isSubmitting}>Anterior</Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages || isSubmitting}>Próxima</Button>
                  <span className="text-xs text-muted-foreground">{totalCount > 0 ? `Total: ${totalCount}` : ''}</span>
                </div>
                <Button variant="outline" onClick={() => onOpenChange?.(false)}>Fechar</Button>
                <Button onClick={handleCriarInventario} disabled={isSubmitting || loadingProdutos}>
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Enviar para aprovação
                </Button>
              </DialogFooter>
            )}
          </TabsContent>

          {isAdmin && (
            <TabsContent value="aprovacoes" className="mt-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-1 border rounded-lg overflow-auto max-h-[60vh] scrollbar-thin">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pendentes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendentes.map((p) => (
                        <TableRow
                          key={p.id}
                          className={`cursor-pointer ${selectedInventarioId === p.id ? 'bg-muted/50' : ''}`}
                          onClick={async () => {
                            setSelectedInventarioId(p.id);
                            await loadInventarioItens(p.id);
                          }}
                        >
                          <TableCell>
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-medium">#{p.id.slice(0, 8)}</div>
                              <Badge variant="outline">{p.total_itens} itens</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Por: {p.created_by_nome || '-'} • {new Date(p.created_at).toLocaleString('pt-BR')}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {pendentes.length === 0 && (
                        <TableRow><TableCell className="text-sm text-muted-foreground">Nenhum pendente.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="md:col-span-2 border rounded-lg overflow-auto max-h-[60vh] scrollbar-thin">
                  {!selectedInventarioId ? (
                    <div className="p-4 text-sm text-muted-foreground">Selecione um inventário pendente.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Referência</TableHead>
                          <TableHead>Cód. Barras</TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead className="text-right">Sistema</TableHead>
                          <TableHead className="text-right">Contado</TableHead>
                          <TableHead className="text-right">Delta</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedItens.map((it) => {
                          const sistema = Number(it.qtd_sistema || 0);
                          const contado = Number(it.qtd_contada ?? sistema);
                          const delta = contado - sistema;
                          return (
                            <TableRow key={it.id}>
                              <TableCell className="font-mono">{it.codigo ?? '-'}</TableCell>
                              <TableCell className="font-mono">{it.referencia ?? '-'}</TableCell>
                              <TableCell className="font-mono text-xs">{it.codigo_barras ?? '-'}</TableCell>
                              <TableCell className="font-medium">{it.produto_nome || it.produto_id}</TableCell>
                              <TableCell className="text-right font-mono">{sistema}</TableCell>
                              <TableCell className="text-right font-mono">{contado}</TableCell>
                              <TableCell className={`text-right font-mono ${delta === 0 ? 'text-muted-foreground' : delta > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {delta >= 0 ? `+${delta}` : `${delta}`}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-center justify-between">
                <div className="flex-1">
                  <Input
                    placeholder="Motivo da rejeição (opcional)"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={handleRejeitar} disabled={!selectedInventarioId || isSubmitting}>
                    <XCircle className="h-4 w-4 mr-2" />
                    Rejeitar
                  </Button>
                  <Button onClick={handleAprovar} disabled={!selectedInventarioId || isSubmitting}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Aprovar e aplicar
                  </Button>
                </div>
              </div>
            </TabsContent>
          )}
      </Tabs>

      <ProductFormOptimized
        open={!!editingProduto}
        onOpenChange={(open) => !open && setEditingProduto(null)}
        produto={editingProduto ?? undefined}
        marcas={marcas}
        modelos={modelos}
        onSave={async (payload) => {
          if (!editingProduto?.id) return;
          await updateProduto(editingProduto.id, payload);
          setEditingProduto(null);
          toast({ title: 'Produto atualizado', description: 'Alterações salvas com sucesso.' });
          loadProdutos();
        }}
      />
    </>
  );

  if (standalone) {
    return <div className="space-y-4 w-full min-w-0">{content}</div>;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange ?? (() => {})}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        {content}
      </DialogContent>
    </Dialog>
  );
}


