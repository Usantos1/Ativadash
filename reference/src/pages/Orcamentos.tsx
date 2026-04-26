import { useState, useEffect, useMemo } from 'react';
import { ModernLayout } from '@/components/ModernLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { FileText, Plus, List, Pencil, Trash2, FileDown, Printer, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useCompanySegment } from '@/hooks/useCompanySegment';
import { useThemeConfig } from '@/contexts/ThemeConfigContext';
import { useAuth } from '@/contexts/AuthContext';
import { from } from '@/integrations/db/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dateFormatters, currencyFormatters } from '@/utils/formatters';
import { generateOrcamentoPDF, type QuotePDF, type QuoteItemPDF } from '@/utils/orcamentoPDFGenerator';
import { Badge } from '@/components/ui/badge';

const TIPOS_ITEM = [
  { value: 'peca', label: 'Peça' },
  { value: 'mao_de_obra', label: 'Mão de obra' },
] as const;

const DEFAULT_CONDICOES =
  'Orçamento válido até a data indicada. Pagamento à vista ou parcelado conforme combinado. Peça sob encomenda sujeita a confirmação de disponibilidade.';

const DEFAULT_GARANTIAS =
  'Garantia de 90 dias em peças aplicadas. Mão de obra garantida por 30 dias para o mesmo defeito. Garantia não cobre desgaste natural ou mau uso.';

interface QuoteRow {
  id: string;
  numero: number;
  status: string;
  cliente_nome: string | null;
  consumidor_apenas: boolean | null;
  veiculo_modelo: string | null;
  veiculo_ano: string | null;
  total: number;
  data_validade: string | null;
  created_at: string | null;
}

interface QuoteItemRow {
  id: string;
  quote_id: string;
  produto_nome: string;
  produto_tipo: string | null;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  observacao: string | null;
}

interface FormItem {
  id: string;
  tipo: 'peca' | 'mao_de_obra';
  descricao: string;
  quantidade: number;
  valor_unitario: number;
}

interface ProdutoOrcamento {
  id: string;
  nome: string;
  codigo?: number | string;
  codigo_barras?: string;
  referencia?: string;
  valor_venda?: number;
  preco_venda?: number;
}

const emptyFormItem = (): FormItem => ({
  id: crypto.randomUUID(),
  tipo: 'peca',
  descricao: '',
  quantidade: 1,
  valor_unitario: 0,
});

export default function Orcamentos() {
  const navigate = useNavigate();
  const { segmentoSlug } = useCompanySegment();
  const isOficina = segmentoSlug === 'oficina_mecanica';
  const { toast } = useToast();
  const { config: themeConfig } = useThemeConfig();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [consumidorApenas, setConsumidorApenas] = useState(false);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [veiculoModelo, setVeiculoModelo] = useState('');
  const [veiculoAno, setVeiculoAno] = useState('');
  const [veiculoVersao, setVeiculoVersao] = useState('');
  const [dataValidade, setDataValidade] = useState('');
  const [condicoesTexto, setCondicoesTexto] = useState('');
  const [garantiasTexto, setGarantiasTexto] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [formItems, setFormItems] = useState<FormItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [produtoSearchOpen, setProdutoSearchOpen] = useState(false);
  const [produtoSearchTerm, setProdutoSearchTerm] = useState('');

  // Lista de orçamentos (oficina)
  const { data: quotesList = [], isLoading: loadingQuotes } = useQuery({
    queryKey: ['quotes'],
    queryFn: async () => {
      const { data, error } = await from('quotes')
        .select('*')
        .order('numero', { ascending: false })
        .limit(200)
        .execute();
      if (error) throw error;
      return (data || []) as QuoteRow[];
    },
    enabled: isOficina,
  });

  // Clientes para o select
  const { data: clientesList = [] } = useQuery({
    queryKey: ['clientes-list-orcamentos'],
    queryFn: async () => {
      const { data, error } = await from('clientes')
        .select('id, nome, telefone, cpf_cnpj')
        .order('nome', { ascending: true })
        .limit(500)
        .execute();
      if (error) throw error;
      return (data || []) as { id: string; nome: string; telefone?: string; cpf_cnpj?: string }[];
    },
    enabled: isOficina && dialogOpen,
  });

  // Produtos para busca (nome, referência, código)
  const { data: produtosList = [] } = useQuery({
    queryKey: ['produtos-orcamentos'],
    queryFn: async () => {
      const { data, error } = await from('produtos')
        .select('id, nome, codigo, codigo_barras, referencia, valor_venda, preco_venda')
        .order('nome', { ascending: true })
        .limit(500)
        .execute();
      if (error) throw error;
      return (data || []) as ProdutoOrcamento[];
    },
    enabled: isOficina && dialogOpen,
  });

  const addProdutoAsItem = (p: ProdutoOrcamento) => {
    const nome = p.nome || '';
    const valor = Number(p.valor_venda ?? p.preco_venda) || 0;
    setFormItems((prev) => [...prev, { id: crypto.randomUUID(), tipo: 'peca', descricao: nome, quantidade: 1, valor_unitario: valor }]);
    setProdutoSearchOpen(false);
    setProdutoSearchTerm('');
  };

  const produtosFiltrados = useMemo(() => {
    if (!produtoSearchTerm.trim()) return produtosList.slice(0, 30);
    const t = produtoSearchTerm.toLowerCase().trim();
    return produtosList.filter(
      (p) =>
        (p.nome || '').toLowerCase().includes(t) ||
        String(p.codigo || '').toLowerCase().includes(t) ||
        (p.referencia || '').toLowerCase().includes(t) ||
        (p.codigo_barras || '').toLowerCase().includes(t)
    ).slice(0, 30);
  }, [produtosList, produtoSearchTerm]);

  const resetForm = () => {
    setEditingId(null);
    setConsumidorApenas(false);
    setClienteId(null);
    setVeiculoModelo('');
    setVeiculoAno('');
    setVeiculoVersao('');
    setDataValidade('');
    setCondicoesTexto(DEFAULT_CONDICOES);
    setGarantiasTexto(DEFAULT_GARANTIAS);
    setObservacoes('');
    setFormItems([emptyFormItem()]);
  };

  const openNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = async (q: QuoteRow) => {
    setEditingId(q.id);
    setConsumidorApenas(!!q.consumidor_apenas);
    setClienteId((q as any).cliente_id || null);
    setVeiculoModelo(q.veiculo_modelo || '');
    setVeiculoAno(q.veiculo_ano || '');
    setVeiculoVersao((q as any).veiculo_versao || '');
    setDataValidade(q.data_validade ? q.data_validade.slice(0, 10) : '');
    setCondicoesTexto((q as any).condicoes_texto || '');
    setGarantiasTexto((q as any).garantias_texto || '');
    setObservacoes((q as any).observacoes || '');
    const { data: items } = await from('quote_items')
      .select('*')
      .eq('quote_id', q.id)
      .execute();
    const rows = (items || []) as QuoteItemRow[];
    setFormItems(
      rows.length
        ? rows.map((r) => ({
            id: r.id,
            tipo: (r.produto_tipo === 'mao_de_obra' ? 'mao_de_obra' : 'peca') as 'peca' | 'mao_de_obra',
            descricao: r.produto_nome,
            quantidade: Number(r.quantidade),
            valor_unitario: Number(r.valor_unitario),
          }))
        : [emptyFormItem()]
    );
    setDialogOpen(true);
  };

  const addItem = () => setFormItems((prev) => [...prev, emptyFormItem()]);
  const removeItem = (id: string) =>
    setFormItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));
  const updateItem = (id: string, patch: Partial<FormItem>) =>
    setFormItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const itemsComTotal = useMemo(() => {
    return formItems.map((i) => ({
      ...i,
      total: i.quantidade * i.valor_unitario,
    }));
  }, [formItems]);

  const subtotal = useMemo(() => itemsComTotal.reduce((s, i) => s + i.total, 0), [itemsComTotal]);
  const descontoTotal = 0;
  const total = subtotal - descontoTotal;

  const getNextNumero = async (): Promise<number> => {
    const list = await queryClient.fetchQuery({ queryKey: ['quotes'] });
    const rows = (list || []) as QuoteRow[];
    const max = rows.length ? Math.max(...rows.map((r) => Number(r.numero))) : 0;
    return max + 1;
  };

  const saveOrcamento = async () => {
    const validItems = formItems.filter((i) => i.descricao.trim());
    if (!validItems.length) {
      toast({ title: 'Adicione ao menos um item (peça ou mão de obra).', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const vendedorNome = (profile as any)?.display_name || (user as any)?.email || 'Usuário';
      const cliente = consumidorApenas ? null : clientesList.find((c) => c.id === clienteId);
      const nextNumero = editingId ? undefined : await getNextNumero();
      const payload: Record<string, unknown> = {
        ...(nextNumero != null && { numero: nextNumero }),
        status: 'pendente',
        cliente_id: consumidorApenas ? null : clienteId,
        cliente_nome: consumidorApenas ? null : (cliente?.nome ?? null),
        cliente_cpf_cnpj: consumidorApenas ? null : (cliente?.cpf_cnpj ?? null),
        cliente_telefone: consumidorApenas ? null : (cliente?.telefone ?? null),
        consumidor_apenas: consumidorApenas,
        veiculo_modelo: veiculoModelo.trim() || null,
        veiculo_ano: veiculoAno.trim() || null,
        veiculo_versao: veiculoVersao.trim() || null,
        data_validade: dataValidade ? new Date(dataValidade).toISOString() : null,
        condicoes_texto: condicoesTexto.trim() || null,
        garantias_texto: garantiasTexto.trim() || null,
        observacoes: observacoes.trim() || null,
        subtotal,
        desconto_total: descontoTotal,
        total,
        vendedor_nome: vendedorNome,
      };
      if (editingId) {
        const { numero: _n, ...updatePayload } = payload as { numero?: number; [k: string]: unknown };
        await from('quotes').update(updatePayload).eq('id', editingId).execute();
        await from('quote_items').delete().eq('quote_id', editingId).execute();
        for (const it of validItems) {
          const valorTotal = it.quantidade * it.valor_unitario;
          await from('quote_items').insert({
            quote_id: editingId,
            produto_nome: it.descricao.trim(),
            produto_tipo: it.tipo,
            quantidade: it.quantidade,
            valor_unitario: it.valor_unitario,
            desconto: 0,
            valor_total: valorTotal,
          }).execute();
        }
        toast({ title: 'Orçamento atualizado.' });
      } else {
        const { data: created, error } = await from('quotes')
          .insert({ ...payload })
          .select('id, numero')
          .single();
        if (error || !created) {
          toast({ title: 'Erro ao criar orçamento.', variant: 'destructive' });
          return;
        }
        const quoteId = (created as any).id;
        for (const it of validItems) {
          const valorTotal = it.quantidade * it.valor_unitario;
          await from('quote_items').insert({
            quote_id: quoteId,
            produto_nome: it.descricao.trim(),
            produto_tipo: it.tipo,
            quantidade: it.quantidade,
            valor_unitario: it.valor_unitario,
            desconto: 0,
            valor_total: valorTotal,
          }).execute();
        }
        toast({ title: `Orçamento #${(created as any).numero} criado.` });
      }
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      setDialogOpen(false);
    } catch (e: any) {
      toast({ title: e?.message || 'Erro ao salvar.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const printPDF = async (quote: QuoteRow, formato: 'a4' | 'termica80') => {
    try {
      const { data: items } = await from('quote_items').select('*').eq('quote_id', quote.id).execute();
      const rows = (items || []) as QuoteItemRow[];
      const quotePdf: QuotePDF = {
        numero: quote.numero,
        status: quote.status,
        cliente_nome: quote.cliente_nome,
        cliente_cpf_cnpj: (quote as any).cliente_cpf_cnpj,
        cliente_telefone: (quote as any).cliente_telefone,
        consumidor_apenas: quote.consumidor_apenas ?? false,
        veiculo_modelo: quote.veiculo_modelo,
        veiculo_ano: quote.veiculo_ano,
        veiculo_versao: (quote as any).veiculo_versao,
        data_validade: quote.data_validade,
        condicoes_texto: (quote as any).condicoes_texto,
        garantias_texto: (quote as any).garantias_texto,
        subtotal: Number(quote.subtotal ?? 0),
        desconto_total: Number((quote as any).desconto_total ?? 0),
        total: Number(quote.total ?? 0),
        created_at: quote.created_at,
        observacoes: (quote as any).observacoes,
      };
      const itemsPdf: QuoteItemPDF[] = rows.map((r) => ({
        produto_nome: r.produto_nome,
        produto_tipo: r.produto_tipo,
        quantidade: Number(r.quantidade),
        valor_unitario: Number(r.valor_unitario),
        valor_total: Number(r.valor_total),
        observacao: r.observacao,
      }));
      const html = generateOrcamentoPDF(quotePdf, itemsPdf, {
        companyName: themeConfig.companyName || 'Oficina',
        logoUrl: themeConfig.logo || null,
        formato,
      });
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(html);
        w.document.close();
        w.onload = () => {
          w.focus();
          w.print();
        };
      } else {
        toast({ title: 'Permita pop-ups para abrir o PDF.', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: e?.message || 'Erro ao gerar PDF.', variant: 'destructive' });
    }
  };

  const deleteQuote = async (id: string) => {
    if (!confirm('Excluir este orçamento?')) return;
    try {
      await from('quote_items').delete().eq('quote_id', id).execute();
      await from('quotes').delete().eq('id', id).execute();
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast({ title: 'Orçamento excluído.' });
    } catch (e: any) {
      toast({ title: e?.message || 'Erro ao excluir.', variant: 'destructive' });
    }
  };

  if (!isOficina) {
    return (
      <ModernLayout
        title="Orçamentos"
        subtitle="Crie e gerencie orçamentos."
      >
        <div className="space-y-4 md:space-y-6 px-1 md:px-0">
          <Card className="border-2 border-gray-300 shadow-sm">
            <CardHeader className="pb-3 pt-3 md:pt-6 px-3 md:px-6 border-b-2 border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-blue-100 to-white border-2 border-gray-200">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-lg md:text-xl">Orçamentos</CardTitle>
                  <CardDescription className="mt-1">
                    Use as Ordens de Serviço para criar orçamentos e converter em OS.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 md:p-6 flex flex-col sm:flex-row gap-3">
              <Button onClick={() => navigate('/os/nova')} className="gap-2">
                <Plus className="h-4 w-4" />
                Nova ordem (orçamento)
              </Button>
              <Button variant="outline" onClick={() => navigate('/os')} className="gap-2">
                <List className="h-4 w-4" />
                Ver ordens de serviço
              </Button>
            </CardContent>
          </Card>
        </div>
      </ModernLayout>
    );
  }

  return (
    <ModernLayout
      title="Orçamentos"
      subtitle="Crie e gerencie orçamentos de serviços para veículos. Gere PDF em A4 ou térmica 80mm."
    >
      <div className="space-y-4 md:space-y-6 px-1 md:px-0">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>Orçamentos</CardTitle>
              <CardDescription>Lista de orçamentos com dados do cliente ou consumidor, veículo e itens.</CardDescription>
            </div>
            <Button onClick={openNew} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo orçamento
            </Button>
          </CardHeader>
          <CardContent>
            {loadingQuotes ? (
              <p className="text-muted-foreground">Carregando...</p>
            ) : quotesList.length === 0 ? (
              <p className="text-muted-foreground">Nenhum orçamento. Clique em &quot;Novo orçamento&quot; para criar.</p>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-2 text-left font-medium">Nº</th>
                      <th className="p-2 text-left font-medium">Cliente</th>
                      <th className="p-2 text-left font-medium">Veículo</th>
                      <th className="p-2 text-right font-medium">Total</th>
                      <th className="p-2 text-left font-medium">Validade</th>
                      <th className="p-2 text-left font-medium">Status</th>
                      <th className="p-2 text-right font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotesList.map((q) => (
                      <tr key={q.id} className="border-b">
                        <td className="p-2 font-medium">#{q.numero}</td>
                        <td className="p-2">{q.consumidor_apenas ? 'Consumidor' : (q.cliente_nome || '—')}</td>
                        <td className="p-2">
                          {[q.veiculo_modelo, q.veiculo_ano].filter(Boolean).join(' • ') || '—'}
                        </td>
                        <td className="p-2 text-right">{currencyFormatters.brl(q.total)}</td>
                        <td className="p-2">{q.data_validade ? dateFormatters.short(q.data_validade) : '—'}</td>
                        <td className="p-2">
                          <Badge variant={q.status === 'aprovado' ? 'default' : 'secondary'}>{q.status}</Badge>
                        </td>
                        <td className="p-2 text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(q)} aria-label="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => printPDF(q, 'a4')} aria-label="PDF A4">
                              <FileDown className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => printPDF(q, 'termica80')} aria-label="Térmica 80mm">
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteQuote(q.id)} aria-label="Excluir">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[92vh] overflow-y-auto p-6 sm:p-8">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-lg">{editingId ? 'Editar orçamento' : 'Novo orçamento'}</DialogTitle>
            <DialogDescription>
              Cliente (ou consumidor), veículo, itens (busque por nome, ref. ou código ou digite), validade, condições e garantias.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="consumidor"
                checked={consumidorApenas}
                onChange={(e) => setConsumidorApenas(e.target.checked)}
                className="rounded border-input"
              />
              <Label htmlFor="consumidor">Apenas consumidor (sem cadastro de cliente)</Label>
            </div>

            {!consumidorApenas && (
              <div className="grid gap-2">
                <Label>Cliente</Label>
                <Select value={clienteId || ''} onValueChange={(v) => setClienteId(v || null)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent className="z-[110]">
                    {clientesList.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>Modelo do veículo</Label>
                <Input
                  placeholder="Ex: Gol, Uno, Onix"
                  value={veiculoModelo}
                  onChange={(e) => setVeiculoModelo(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Ano</Label>
                <Input placeholder="Ex: 2020" value={veiculoAno} onChange={(e) => setVeiculoAno(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Versão</Label>
                <Input placeholder="Ex: 1.0" value={veiculoVersao} onChange={(e) => setVeiculoVersao(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Data de validade do orçamento</Label>
              <Input type="date" value={dataValidade} onChange={(e) => setDataValidade(e.target.value)} />
            </div>

            <div className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-sm font-medium">Itens (peças e mão de obra)</Label>
                <div className="flex items-center gap-2">
                  <Popover open={produtoSearchOpen} onOpenChange={setProdutoSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" size="sm" className="gap-2">
                        <Search className="h-4 w-4" />
                        Buscar produto (nome, ref., código)
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="z-[110] w-[min(90vw,400px)] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Digite nome, referência ou código..."
                          value={produtoSearchTerm}
                          onValueChange={setProdutoSearchTerm}
                        />
                        <CommandList>
                          <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                          <CommandGroup>
                            {produtosFiltrados.map((p) => (
                              <CommandItem
                                key={p.id}
                                value={`${p.nome} ${p.referencia || ''} ${p.codigo || ''}`}
                                onSelect={() => addProdutoAsItem(p)}
                                className="cursor-pointer"
                              >
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-medium">{p.nome}</span>
                                  {(p.referencia || p.codigo) && (
                                    <span className="text-xs text-muted-foreground">
                                      {p.referencia && `Ref: ${p.referencia}`}
                                      {p.referencia && p.codigo && ' · '}
                                      {p.codigo != null && `Cód: ${p.codigo}`}
                                      {(p.valor_venda != null || p.preco_venda != null) && ` · ${currencyFormatters.brl(Number(p.valor_venda ?? p.preco_venda))}`}
                                    </span>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    + Item manual
                  </Button>
                </div>
              </div>
              <div className="rounded-md border divide-y max-h-64 overflow-y-auto bg-muted/20">
                {formItems.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-3 p-3 items-end">
                    <div className="col-span-12 sm:col-span-4">
                      <Input
                        placeholder="Descrição do item"
                        value={item.descricao}
                        onChange={(e) => updateItem(item.id, { descricao: e.target.value })}
                        className="min-h-10"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <Select
                        value={item.tipo}
                        onValueChange={(v) => updateItem(item.id, { tipo: v as 'peca' | 'mao_de_obra' })}
                      >
<SelectTrigger>
                        <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[110]">
                          {TIPOS_ITEM.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3 sm:col-span-1">
                      <Input
                        type="number"
                        min={0.001}
                        step={0.01}
                        placeholder="Qtd"
                        value={item.quantidade || ''}
                        onChange={(e) => updateItem(item.id, { quantidade: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="R$ unit."
                        value={item.valor_unitario || ''}
                        onChange={(e) => updateItem(item.id, { valor_unitario: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-2 text-right text-sm font-medium">
                      {currencyFormatters.brl(item.quantidade * item.valor_unitario)}
                    </div>
                    <div className="col-span-1">
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(item.id)} aria-label="Remover">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Subtotal: {currencyFormatters.brl(subtotal)} — Total: {currencyFormatters.brl(total)}</p>
            </div>

            <div className="grid gap-2">
              <Label className="text-sm font-medium">Condições (aparecem no PDF)</Label>
              <Textarea
                placeholder="Ajuste o texto das condições se necessário."
                value={condicoesTexto}
                onChange={(e) => setCondicoesTexto(e.target.value)}
                rows={4}
                className="resize-y min-h-[80px]"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-sm font-medium">Garantias (aparecem no PDF)</Label>
              <Textarea
                placeholder="Ajuste o texto das garantias se necessário."
                value={garantiasTexto}
                onChange={(e) => setGarantiasTexto(e.target.value)}
                rows={4}
                className="resize-y min-h-[80px]"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-sm font-medium">Observações</Label>
              <Textarea placeholder="Observações internas" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveOrcamento} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModernLayout>
  );
}
