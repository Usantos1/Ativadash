import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Produto, TipoProduto, TIPO_PRODUTO_LABELS } from '@/types/assistencia';
import { parseBRLInput, maskBRL, formatBRL } from '@/utils/currency';
import { from } from '@/integrations/db/client';
import { Barcode, Package, DollarSign, Warehouse, History, Plus, X, Check, ChevronsUpDown, Palette, LayoutGrid } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMarcasSupabase, useModelosSupabase } from '@/hooks/useMarcasModelosSupabase';
import { cn } from '@/lib/utils';

interface ProductFormOptimizedProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produto?: Produto | null;
  onSave: (payload: Partial<Produto>) => Promise<void>;
  grupos?: any[];
  marcas?: any[];
  modelos?: any[];
}

interface FormData {
  nome: string;
  codigo?: number;
  codigo_barras?: string;
  referencia?: string;
  marca?: string;
  modelo?: string;
  grupo?: string;
  qualidade?: string;
  preco_custo?: number | string;
  valor_venda?: number | string;
  valor_parcelado_6x?: number | string;
  margem_percentual?: number;
  quantidade?: number;
  estoque_minimo?: number;
  localizacao?: string;
  unidade?: string;
  garantia_dias?: number | '';
  tipo?: TipoProduto;
  /** Grade: por cor (tampas) ou com/sem aro (telas). Quando preenchido, quantidade = soma dos itens */
  estoque_grade?: { tipo: 'cor' | 'aro'; itens: Record<string, number> };
}

/** Sincroniza quantidade do formulário com a soma dos itens da grade */
function syncQuantidadeFromGrade(
  setValue: (name: 'quantidade' | 'estoque_grade', value: any) => void,
  grade: { tipo: 'cor' | 'aro'; itens: Record<string, number> } | undefined
) {
  if (!grade?.itens) return;
  const total = Object.values(grade.itens).reduce((a, b) => a + (Number(b) || 0), 0);
  setValue('quantidade', total);
}

function GradeAroFields({
  watch,
  setValue,
}: {
  watch: (name: 'estoque_grade') => { tipo: string; itens: Record<string, number> } | undefined;
  setValue: (name: string, value: any) => void;
}) {
  const grade = watch('estoque_grade');
  const itens = grade?.itens || {};
  const update = (key: 'Com Aro' | 'Sem Aro', value: number) => {
    const next = { ...itens, [key]: value };
    setValue('estoque_grade', { tipo: 'aro', itens: next });
    syncQuantidadeFromGrade(setValue as any, { tipo: 'aro', itens: next });
  };
  return (
    <div className="md:col-span-2 space-y-3">
      <Label>Quantidade por tipo</Label>
      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div>
          <Label htmlFor="grade_com_aro" className="text-xs text-muted-foreground">Com Aro</Label>
          <Input
            id="grade_com_aro"
            type="number"
            min={0}
            value={itens['Com Aro'] ?? ''}
            onChange={(e) => update('Com Aro', parseInt(e.target.value, 10) || 0)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="grade_sem_aro" className="text-xs text-muted-foreground">Sem Aro</Label>
          <Input
            id="grade_sem_aro"
            type="number"
            min={0}
            value={itens['Sem Aro'] ?? ''}
            onChange={(e) => update('Sem Aro', parseInt(e.target.value, 10) || 0)}
            className="mt-1"
          />
        </div>
      </div>
    </div>
  );
}

function GradeCorFields({
  watch,
  setValue,
}: {
  watch: (name: 'estoque_grade') => { tipo: string; itens: Record<string, number> } | undefined;
  setValue: (name: string, value: any) => void;
}) {
  const grade = watch('estoque_grade');
  const itens = grade?.itens || {};
  const cores = Object.entries(itens);
  const update = (cor: string, value: number) => {
    const next = { ...itens, [cor]: value };
    if (value === 0) delete next[cor];
    setValue('estoque_grade', { tipo: 'cor', itens: next });
    syncQuantidadeFromGrade(setValue as any, { tipo: 'cor', itens: next });
  };
  const remove = (cor: string) => {
    const next = { ...itens };
    delete next[cor];
    setValue('estoque_grade', { tipo: 'cor', itens: next });
    syncQuantidadeFromGrade(setValue as any, { tipo: 'cor', itens: next });
  };
  const [novaCor, setNovaCor] = useState('');
  const addCor = () => {
    const cor = novaCor.trim();
    if (!cor) return;
    setValue('estoque_grade', { tipo: 'cor', itens: { ...itens, [cor]: 0 } });
    setNovaCor('');
  };
  // Cores dos iPhones (iPhone 8 em diante, todas as séries) – sugestões para grade por cor
  const coresSugeridas = [
    'Preta', 'Branca', 'Vermelha', 'Azul', 'Verde', 'Amarela', 'Rosa', 'Dourada', 'Prata', 'Roxa', 'Coral',
    'Cinza Espacial', 'Space Gray', 'Midnight', 'Starlight', 'Graphite', 'Pacific Blue', 'Alpine Green',
    'Sierra Blue', 'Deep Purple', 'Space Black', 'Natural Titanium', 'Blue Titanium', 'White Titanium',
    'Black Titanium', 'Desert Titanium',
  ];
  return (
    <div className="md:col-span-2 space-y-3">
      <Label>Quantidade por cor</Label>
      <div className="space-y-2 max-w-lg">
        {cores.length === 0 ? (
          <p className="text-sm text-muted-foreground">Adicione cores e informe a quantidade de cada uma.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cor</TableHead>
                <TableHead className="w-[120px]">Quantidade</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cores.map(([cor, qtd]) => (
                <TableRow key={cor}>
                  <TableCell className="font-medium">{cor}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      value={qtd}
                      onChange={(e) => update(cor, parseInt(e.target.value, 10) || 0)}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove(cor)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <div className="flex gap-2 flex-wrap items-center pt-2">
          <Input
            placeholder="Nome da cor"
            value={novaCor}
            onChange={(e) => setNovaCor(e.target.value)}
            className="w-40"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCor())}
          />
          <Button type="button" variant="outline" size="sm" onClick={addCor} disabled={!novaCor.trim()}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar cor
          </Button>
          {coresSugeridas.filter(c => !itens[c]).length > 0 && (
            <span className="text-xs text-muted-foreground">
              Sugestões: {coresSugeridas.filter(c => !itens[c]).slice(0, 12).map(c => (
                <button key={c} type="button" className="ml-1 underline hover:no-underline" onClick={() => { setValue('estoque_grade', { tipo: 'cor', itens: { ...itens, [c]: 0 } }); syncQuantidadeFromGrade(setValue as any, { tipo: 'cor', itens: { ...itens, [c]: 0 } }); }}>{c}</button>
              ))}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

interface EstoqueMovimentacao {
  id: string;
  data: string;
  ref_tipo: 'OS' | 'Venda' | 'Cancelamento' | 'Devolução' | 'Ajuste' | 'Inventário' | 'Troca' | 'Perda' | 'Devolução OS';
  ref_id?: string;
  ref_numero: number;
  quantidade_delta: number; // negativo = saída, positivo = entrada
  descricao: string;
  vendedor_nome?: string | null;
  hora?: string; // Hora completa formatada
}

/**
 * Gera código de barras EAN-13 válido
 */
function gerarEAN13(input?: string | number): string {
  let base: string;
  
  if (typeof input === 'number') {
    base = input.toString().padStart(12, '0').slice(-12);
  } else if (typeof input === 'string' && input.length >= 12) {
    base = input.replace(/\D/g, '').slice(0, 12).padStart(12, '0');
  } else if (typeof input === 'string' && input.length > 0) {
    base = input.replace(/\D/g, '').padStart(12, '0').slice(-12);
  } else {
    const random = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
    base = '789' + random;
  }
  
  let soma = 0;
  for (let i = 0; i < 12; i++) {
    const digito = parseInt(base[i]!, 10);
    soma += (i % 2 === 0) ? digito : digito * 3;
  }
  const dv = (10 - (soma % 10)) % 10;
  
  return base + dv.toString();
}

/**
 * Busca o próximo código disponível (MAX + 1)
 */
async function buscarProximoCodigo(): Promise<number> {
  try {
    const { data, error } = await from('produtos')
      .select('codigo')
      .not('codigo', 'is', null)
      .order('codigo', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Erro ao buscar próximo código:', error);
      return 1;
    }

    const maxCodigo = data?.codigo || 0;
    return maxCodigo + 1;
  } catch (error) {
    console.error('Erro ao buscar próximo código:', error);
    return 1;
  }
}

function extrairNumeroOS(texto?: string | null): number {
  if (!texto) return 0;
  const match = texto.match(/\bOS\s*#?\s*(\d+)/i);
  return match ? Number(match[1]) || 0 : 0;
}

function formatarDescricaoEstoque(
  quantidadeAntes: unknown,
  quantidadeDepois: unknown,
  quantidadeDelta: number
): string | null {
  if (quantidadeAntes === null || quantidadeAntes === undefined || quantidadeDepois === null || quantidadeDepois === undefined) {
    return null;
  }

  const antes = Number(quantidadeAntes);
  const depois = Number(quantidadeDepois);
  if (!Number.isFinite(antes) || !Number.isFinite(depois)) {
    return null;
  }

  const prefixo = quantidadeDelta < 0 ? 'Saída' : quantidadeDelta > 0 ? 'Entrada' : 'Ajuste';
  const deltaFormatado = `${quantidadeDelta >= 0 ? '+' : ''}${quantidadeDelta}`;
  return `${prefixo}: Estoque: ${antes} (${deltaFormatado}) = ${depois}`;
}

function diferencaEmMinutos(dataA: string, dataB: string): number {
  const timestampA = new Date(dataA).getTime();
  const timestampB = new Date(dataB).getTime();
  if (!Number.isFinite(timestampA) || !Number.isFinite(timestampB)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.abs(timestampA - timestampB) / 60000;
}

function ehAjusteEspelhadoDeOS(mov: EstoqueMovimentacao): boolean {
  if (mov.ref_tipo !== 'Ajuste') return false;
  if (mov.ref_numero > 0) return true;
  return /^((Saída|Entrada):\s*)?Estoque:\s*\d+\s*\([+-]?\d+\)\s*=\s*\d+$/i.test((mov.descricao || '').trim());
}

/**
 * Busca movimentações de estoque relacionadas ao produto (OS e Vendas)
 */
async function buscarMovimentacoesEstoque(produtoId: string): Promise<EstoqueMovimentacao[]> {
  try {
    const movimentacoes: EstoqueMovimentacao[] = [];
    const osItensMovimentacoes: EstoqueMovimentacao[] = [];
    const movimentacoesInternasOS: Array<{ ref_tipo: 'OS' | 'Devolução OS'; ref_numero: number; quantidade: number; data: string }> = [];

    // 1. Buscar os_items relacionados ao produto (Ordens de Serviço)
    const { data: osItens } = await from('os_items')
      .select('id, quantidade, tipo, descricao, created_at, ordem_servico_id, colaborador_nome')
      .eq('produto_id', produtoId)
      .eq('tipo', 'peca')
      .order('created_at', { ascending: false })
      .execute();

    if (osItens && osItens.length > 0) {
      // Buscar números das OSs relacionadas
      const osIds = [...new Set(osItens.map((item: any) => item.ordem_servico_id).filter(Boolean))];
      
      let osMap = new Map();
      if (osIds.length > 0) {
        const { data: ordens } = await from('ordens_servico')
          .select('id, numero')
          .in('id', osIds)
          .execute();
        osMap = new Map((ordens || []).map((os: any) => [os.id, os.numero]));
      }

      osItens.forEach((item: any) => {
        osItensMovimentacoes.push({
          id: item.id,
          data: item.created_at,
          ref_tipo: 'OS',
          ref_id: item.ordem_servico_id,
          ref_numero: osMap.get(item.ordem_servico_id) || 0,
          quantidade_delta: -Math.abs(Number(item.quantidade || 0)),
          descricao: item.descricao || 'Baixa via OS',
          vendedor_nome: item.colaborador_nome || null,
        });
      });
    }

    // 2. Buscar sale_items relacionados ao produto (Vendas)
    const { data: saleItens } = await from('sale_items')
      .select('id, quantidade, produto_nome, created_at, sale_id')
      .eq('produto_id', produtoId)
      .order('created_at', { ascending: false })
      .execute();

    if (saleItens && saleItens.length > 0) {
      // Agrupar por venda para evitar múltiplas linhas que parecem múltiplos cancelamentos
      // (ex: mesmo produto lançado mais de uma vez na mesma venda)
      const groupedBySale = new Map<string, { quantidade: number; created_at: string }>();
      for (const item of saleItens as any[]) {
        const saleId = item.sale_id;
        if (!saleId) continue;
        const prev = groupedBySale.get(saleId);
        const qtd = Math.abs(Number(item.quantidade || 0));
        if (!prev) {
          groupedBySale.set(saleId, { quantidade: qtd, created_at: item.created_at });
        } else {
          groupedBySale.set(saleId, {
            quantidade: prev.quantidade + qtd,
            // manter o created_at mais recente (já vem ordenado desc, então prev é o mais recente)
            created_at: prev.created_at,
          });
        }
      }

      // Buscar números das vendas relacionadas
      const saleIds = [...groupedBySale.keys()];
      
      let salesMap = new Map();
      let salesMeta = new Map<string, any>();
      if (saleIds.length > 0) {
        const { data: sales } = await from('sales')
          .select('id, numero, status, is_draft, vendedor_nome, created_at, finalized_at, canceled_at, updated_at')
          .in('id', saleIds)
          .execute();
        salesMap = new Map((sales || []).map((s: any) => [s.id, s.numero]));
        salesMeta = new Map((sales || []).map((s: any) => [s.id, s]));
      }

      for (const [saleId, agg] of groupedBySale.entries()) {
        const sale = salesMeta.get(saleId);
        const saleNumero = salesMap.get(saleId) || 0;
        const qtd = Math.abs(Number(agg.quantidade || 0));

        // Venda (saída) - apenas quando não é rascunho
        const isDraft = Boolean(sale?.is_draft);
        const saleStatus = (sale?.status || 'draft') as string;
        const hasFinalizedAt = Boolean(sale?.finalized_at);
        const baixaEfetivada = !isDraft && (hasFinalizedAt || ['open', 'paid', 'partial', 'canceled', 'refunded'].includes(saleStatus));

        if (baixaEfetivada) {
          movimentacoes.push({
            id: `sale-${saleId}`,
            data: sale?.finalized_at || sale?.created_at || agg.created_at,
            ref_tipo: 'Venda',
            ref_id: saleId,
            ref_numero: saleNumero,
            quantidade_delta: -qtd,
            descricao: `Venda #${saleNumero || '?'}`,
            vendedor_nome: sale?.vendedor_nome || null,
          });
        }

        // Cancelamento (entrada) - quando cancelada e havia baixa efetivada
        if (saleStatus === 'canceled' && sale?.canceled_at && baixaEfetivada) {
          movimentacoes.push({
            id: `sale-cancel-${saleId}`,
            data: sale.canceled_at,
            ref_tipo: 'Cancelamento',
            ref_id: saleId,
            ref_numero: saleNumero,
            quantidade_delta: +qtd,
            descricao: `Cancelamento da venda #${saleNumero || '?'}`,
            vendedor_nome: sale?.vendedor_nome || null,
          });
        }

        // Devolução (entrada) - se status for refunded
        if (saleStatus === 'refunded' && baixaEfetivada) {
          movimentacoes.push({
            id: `sale-refund-${saleId}`,
            data: sale?.updated_at || agg.created_at,
            ref_tipo: 'Devolução',
            ref_id: saleId,
            ref_numero: saleNumero,
            quantidade_delta: +qtd,
            descricao: `Devolução da venda #${saleNumero || '?'}`,
            vendedor_nome: sale?.vendedor_nome || null,
          });
        }
      }
    }

    // 3. Movimentações internas (ajustes manuais / inventário / devoluções OS)
    const { data: internalMovs } = await from('produto_movimentacoes')
      .select('id, tipo, motivo, quantidade_antes, quantidade_depois, quantidade_delta, valor_venda_antes, valor_venda_depois, valor_custo_antes, valor_custo_depois, inventario_id, user_nome, created_at')
      .eq('produto_id', produtoId)
      .order('created_at', { ascending: false })
      .limit(200)
      .execute();

    if (internalMovs && internalMovs.length > 0) {
      (internalMovs as any[]).forEach((m) => {
        const tipoMov = String(m.tipo || '').toLowerCase();
        const isInventario = tipoMov.includes('inventario');
        const isDevolucaoOS = tipoMov.includes('devolucao_os') || tipoMov.includes('devolução_os');
        const qtdDeltaSalvo = Number(m.quantidade_delta || 0);
        const qtdDeltaCalculado =
          m.quantidade_antes !== null &&
          m.quantidade_antes !== undefined &&
          m.quantidade_depois !== null &&
          m.quantidade_depois !== undefined
            ? Number(m.quantidade_depois) - Number(m.quantidade_antes)
            : qtdDeltaSalvo;
        const qtdDelta = Number.isFinite(qtdDeltaCalculado) ? qtdDeltaCalculado : qtdDeltaSalvo;
        const numeroOS = extrairNumeroOS(m.motivo);

        const parts: string[] = [];
        const descricaoEstoque = formatarDescricaoEstoque(m.quantidade_antes, m.quantidade_depois, qtdDelta);
        if (descricaoEstoque) {
          parts.push(descricaoEstoque);
        }
        if (m.valor_venda_antes !== null && m.valor_venda_depois !== null) {
          parts.push(`Venda: ${formatBRL(Number(m.valor_venda_antes || 0))} → ${formatBRL(Number(m.valor_venda_depois || 0))}`);
        }
        if (m.valor_custo_antes !== null && m.valor_custo_depois !== null) {
          parts.push(`Custo: ${formatBRL(Number(m.valor_custo_antes || 0))} → ${formatBRL(Number(m.valor_custo_depois || 0))}`);
        }

        // Determinar tipo de referência
        let refTipo: EstoqueMovimentacao['ref_tipo'] = 'Ajuste';
        if (isInventario) {
          refTipo = 'Inventário';
        } else if (isDevolucaoOS) {
          refTipo = 'Devolução OS';
        } else if (tipoMov.includes('cancelamento_venda') || tipoMov.includes('cancelamento')) {
          refTipo = 'Cancelamento';
        } else if (tipoMov.includes('baixa_os') || tipoMov.includes('baixa os')) {
          refTipo = 'OS';
        } else if (tipoMov.includes('venda') && !tipoMov.includes('cancelamento')) {
          refTipo = 'Venda';
        } else if (tipoMov.includes('ajuste_estoque')) {
          refTipo = numeroOS > 0
            ? (qtdDelta < 0 ? 'OS' : qtdDelta > 0 ? 'Devolução OS' : 'Ajuste')
            : 'Ajuste';
        } else if (tipoMov.includes('ajuste_preco_venda') || tipoMov.includes('ajuste_preco_custo')) {
          refTipo = 'Ajuste';
        }

        if ((refTipo === 'OS' || refTipo === 'Devolução OS') && numeroOS > 0 && qtdDelta !== 0) {
          movimentacoesInternasOS.push({
            ref_tipo: refTipo,
            ref_numero: numeroOS,
            quantidade: Math.abs(qtdDelta),
            data: m.created_at,
          });
        }

        movimentacoes.push({
          id: `internal-${m.id}`,
          data: m.created_at,
          ref_tipo: refTipo,
          ref_id: m.inventario_id || undefined,
          ref_numero: refTipo === 'OS' || refTipo === 'Devolução OS' ? numeroOS : 0,
          quantidade_delta: Number.isFinite(qtdDelta) ? qtdDelta : 0,
          descricao: parts.length > 0 ? parts.join(' • ') : (m.motivo || 'Ajuste manual'),
          vendedor_nome: m.user_nome || null,
        });
      });
    }

    const osItensSemDuplicidade = osItensMovimentacoes.filter((mov) => {
      if (mov.ref_numero <= 0 || mov.quantidade_delta === 0) {
        return true;
      }

      return !movimentacoesInternasOS.some((internalMov) =>
        internalMov.ref_tipo === 'OS' &&
        internalMov.ref_numero === mov.ref_numero &&
        internalMov.quantidade === Math.abs(mov.quantidade_delta) &&
        diferencaEmMinutos(internalMov.data, mov.data) <= 5
      );
    });

    movimentacoes.push(...osItensSemDuplicidade);

    // 4. Buscar devoluções da tabela refund_items
    try {
      const { data: refundItens } = await from('refund_items')
        .select('id, refund_id, quantity, unit_price, destination, created_at')
        .eq('product_id', produtoId)
        .order('created_at', { ascending: false })
        .execute();

      if (refundItens && refundItens.length > 0) {
        // Buscar dados dos refunds relacionados
        const refundIds = [...new Set(refundItens.map((item: any) => item.refund_id).filter(Boolean))];
        
        let refundMap = new Map();
        if (refundIds.length > 0) {
          const { data: refunds } = await from('refunds')
            .select('id, refund_number, sale_id, reason, refund_method, status, created_at')
            .in('id', refundIds)
            .execute();
          refundMap = new Map((refunds || []).map((r: any) => [r.id, r]));
        }

        refundItens.forEach((item: any) => {
          const refund = refundMap.get(item.refund_id);
          const qtd = Math.abs(Number(item.quantity || 0));
          const destinoLabel = item.destination === 'stock' ? 'Estoque' : 
                               item.destination === 'exchange' ? 'Troca' : 
                               item.destination === 'loss' ? 'Perda' : item.destination;
          
          // Só adiciona entrada no estoque se destino for 'stock'
          if (item.destination === 'stock') {
            movimentacoes.push({
              id: `refund-${item.id}`,
              data: item.created_at,
              ref_tipo: 'Devolução',
              ref_id: item.refund_id,
              ref_numero: refund?.refund_number || 0,
              quantidade_delta: +qtd, // Entrada no estoque
              descricao: `Devolução #${refund?.refund_number || '?'} → ${destinoLabel}`,
              vendedor_nome: null,
            });
          } else if (item.destination === 'loss') {
            // Perda não volta ao estoque
            movimentacoes.push({
              id: `refund-loss-${item.id}`,
              data: item.created_at,
              ref_tipo: 'Perda',
              ref_id: item.refund_id,
              ref_numero: refund?.refund_number || 0,
              quantidade_delta: 0, // Não altera estoque
              descricao: `Devolução #${refund?.refund_number || '?'} → Perda (produto descartado)`,
              vendedor_nome: null,
            });
          } else if (item.destination === 'exchange') {
            // Troca - separado para troca
            movimentacoes.push({
              id: `refund-exchange-${item.id}`,
              data: item.created_at,
              ref_tipo: 'Troca',
              ref_id: item.refund_id,
              ref_numero: refund?.refund_number || 0,
              quantidade_delta: 0, // Separado para troca
              descricao: `Devolução #${refund?.refund_number || '?'} → Separado para troca`,
              vendedor_nome: null,
            });
          }
        });
      }
    } catch (e) {
      // Tabela refund_items pode não existir ainda
      console.warn('Tabela refund_items não encontrada ou erro:', e);
    }

    const movimentacoesFiltradas = movimentacoes.filter((mov) => {
      if (!ehAjusteEspelhadoDeOS(mov)) {
        return true;
      }

      return !movimentacoes.some((outraMov) =>
        (outraMov.ref_tipo === 'OS' || outraMov.ref_tipo === 'Devolução OS') &&
        outraMov.quantidade_delta === mov.quantidade_delta &&
        diferencaEmMinutos(outraMov.data, mov.data) <= 5
      );
    });

    // Ordenar por data decrescente
    movimentacoesFiltradas.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    return movimentacoesFiltradas;
  } catch (error) {
    console.error('Erro ao buscar movimentações:', error);
    return [];
  }
}

export function ProductFormOptimized({
  open,
  onOpenChange,
  produto,
  onSave,
  marcas = [],
  modelos = [],
}: ProductFormOptimizedProps) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingCodigo, setIsLoadingCodigo] = useState(false);
  const [activeTab, setActiveTab] = useState('dados');
  // Estados para marcas
  const [marcaOpen, setMarcaOpen] = useState(false);
  const [showNewMarcaDialog, setShowNewMarcaDialog] = useState(false);
  const [newMarcaNome, setNewMarcaNome] = useState('');
  const { marcas: marcasFromHook, createMarca } = useMarcasSupabase();
  
  // Estados para modelos
  const [modeloOpen, setModeloOpen] = useState(false);
  const [showNewModeloDialog, setShowNewModeloDialog] = useState(false);
  const [newModeloNome, setNewModeloNome] = useState('');
  const { modelos: modelosFromHook, createModelo } = useModelosSupabase();
  
  // Usar marcas e modelos do hook se disponíveis, senão usar props
  const marcasList = marcasFromHook.length > 0 ? marcasFromHook : (marcas || []);
  const modelosList = modelosFromHook.length > 0 ? modelosFromHook : (modelos || []);
  
  const isEditing = Boolean(produto?.id);
  const isCloning = Boolean(produto && !produto.id); // Produto sem ID = clonagem

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      nome: '',
      codigo: undefined,
      codigo_barras: '',
      referencia: '',
      marca: '',
      modelo: '',
      grupo: '',
      qualidade: '',
      preco_custo: undefined,
      valor_venda: 0,
      valor_parcelado_6x: undefined,
      margem_percentual: undefined,
      quantidade: 0,
      estoque_minimo: 0,
      localizacao: '',
      unidade: 'UN',
      garantia_dias: undefined as number | undefined,
      tipo: 'PECA' as TipoProduto,
      estoque_grade: undefined,
    },
  });

  const codigoBarras = watch('codigo_barras');
  const codigo = watch('codigo');
  const precoCusto = watch('preco_custo');
  const valorVenda = watch('valor_venda');
  const valorParcelado = watch('valor_parcelado_6x');
  
  // Estados para controlar valores brutos durante digitação (sem formatação)
  const [precoCustoRaw, setPrecoCustoRaw] = useState<string>('');
  const [valorVendaRaw, setValorVendaRaw] = useState<string>('');
  const [valorParceladoRaw, setValorParceladoRaw] = useState<string>('');

  // Buscar movimentações de estoque (apenas quando editar e produto tiver ID)
  const { data: movimentacoes = [], isLoading: isLoadingMovimentacoes } = useQuery({
    queryKey: ['produto_movimentacoes', produto?.id],
    queryFn: () => buscarMovimentacoesEstoque(produto!.id),
    enabled: !!produto?.id && open,
  });

  // Carrega dados do produto quando editar ou abrir modal
  useEffect(() => {
    if (open) {
      if (produto && produto.id) {
        // Modo edição (produto com ID)
        const precoCusto = Number(produto.preco_custo || produto.valor_compra || 0);
        const valorVenda = Number(produto.valor_venda || produto.preco_venda || 0);
        const valorParcelado = produto.valor_parcelado_6x ? Number(produto.valor_parcelado_6x) : undefined;
        
        reset({
          nome: produto.nome || produto.descricao || '',
          codigo: produto.codigo,
          codigo_barras: produto.codigo_barras || '',
          referencia: produto.referencia || '',
          marca: produto.marca || '',
          modelo: produto.modelo || produto.modelo_compativel || '',
          grupo: produto.grupo || produto.categoria || '',
          qualidade: (produto as any).qualidade || '',
          preco_custo: precoCusto,
          valor_venda: valorVenda,
          valor_parcelado_6x: valorParcelado,
          margem_percentual: produto.margem_percentual || produto.margem_lucro,
          quantidade: produto.quantidade || produto.estoque_atual || 0,
          estoque_minimo: produto.estoque_minimo || 0,
          localizacao: produto.localizacao || '',
          unidade: produto.unidade || 'UN',
          garantia_dias: produto.garantia_dias ?? undefined,
          tipo: (produto.tipo || 'PECA') as TipoProduto,
          estoque_grade: produto.estoque_grade,
        });
        
        // Inicializar valores brutos formatados para exibição
        setPrecoCustoRaw(precoCusto > 0 ? precoCusto.toFixed(2).replace('.', ',') : '');
        setValorVendaRaw(valorVenda > 0 ? valorVenda.toFixed(2).replace('.', ',') : '');
        setValorParceladoRaw(valorParcelado && valorParcelado > 0 ? valorParcelado.toFixed(2).replace('.', ',') : '');
        
        setActiveTab('dados');
      } else if (isCloning) {
        // Modo clonagem - buscar próximo código mas preencher dados do produto
        setIsLoadingCodigo(true);
        buscarProximoCodigo().then((proximoCodigo) => {
          const precoCusto = Number(produto.preco_custo || produto.valor_compra || 0);
          const valorVenda = Number(produto.valor_venda || produto.preco_venda || 0);
          const valorParcelado = produto.valor_parcelado_6x ? Number(produto.valor_parcelado_6x) : undefined;
          
          reset({
            nome: produto.nome || produto.descricao || '',
            codigo: proximoCodigo, // Gerar novo código
            codigo_barras: '', // Deixar vazio para gerar depois
            referencia: produto.referencia || '',
            marca: produto.marca || '',
            modelo: produto.modelo || produto.modelo_compativel || '',
            grupo: produto.grupo || produto.categoria || '',
            qualidade: (produto as any).qualidade || '',
            preco_custo: precoCusto,
            valor_venda: valorVenda,
            valor_parcelado_6x: valorParcelado,
            margem_percentual: produto.margem_percentual || produto.margem_lucro,
            quantidade: 0, // Zerar estoque na clonagem
            estoque_minimo: produto.estoque_minimo || 0,
            localizacao: produto.localizacao || '',
            unidade: produto.unidade || 'UN',
            garantia_dias: produto.garantia_dias ?? undefined,
            tipo: (produto.tipo || 'PECA') as TipoProduto,
            estoque_grade: produto.estoque_grade ? { ...produto.estoque_grade, itens: { ...produto.estoque_grade.itens } } : undefined,
          });
          // Inicializar valores brutos formatados para exibição
          setPrecoCustoRaw(precoCusto > 0 ? precoCusto.toFixed(2).replace('.', ',') : '');
          setValorVendaRaw(valorVenda > 0 ? valorVenda.toFixed(2).replace('.', ',') : '');
          setValorParceladoRaw(valorParcelado && valorParcelado > 0 ? valorParcelado.toFixed(2).replace('.', ',') : '');
          setIsLoadingCodigo(false);
          setActiveTab('dados');
        });
      } else {
        // Modo criação - buscar próximo código
        setIsLoadingCodigo(true);
        buscarProximoCodigo().then((proximoCodigo) => {
          reset({
            nome: '',
            codigo: proximoCodigo,
            codigo_barras: '',
            referencia: '',
            marca: '',
            modelo: '',
            grupo: '',
            qualidade: '',
            valor_venda: 0,
            valor_parcelado_6x: undefined,
            margem_percentual: undefined,
            quantidade: 0,
            estoque_minimo: 0,
            localizacao: '',
            unidade: 'UN',
            garantia_dias: undefined,
            tipo: 'PECA' as TipoProduto,
          });
          // Limpar valores brutos
          setPrecoCustoRaw('');
          setValorVendaRaw('');
          setValorParceladoRaw('');
          setIsLoadingCodigo(false);
          setActiveTab('dados');
        });
      }
    }
  }, [produto, open, reset, isCloning]);

  // Gerar código de barras EAN-13
  const handleGerarCodigoBarras = () => {
    const codigoAtual = codigo || codigoBarras;
    const ean13 = gerarEAN13(codigoAtual);
    setValue('codigo_barras', ean13);
  };

  // Criar nova marca
  const handleCreateNewMarca = async () => {
    if (!newMarcaNome.trim()) return;
    
    try {
      const novaMarca = await createMarca(newMarcaNome.trim());
      setValue('marca', novaMarca.nome);
      setShowNewMarcaDialog(false);
      setNewMarcaNome('');
    } catch (error) {
      console.error('[handleCreateNewMarca] Erro:', error);
    }
  };

  // Criar novo modelo
  const handleCreateNewModelo = async () => {
    if (!newModeloNome.trim() || !watch('marca')) return;
    
    try {
      const marcaSelecionada = marcasList.find(m => m.nome === watch('marca'));
      if (!marcaSelecionada) {
        throw new Error('Marca não encontrada');
      }
      
      const novoModelo = await createModelo(marcaSelecionada.id, newModeloNome.trim());
      setValue('modelo', novoModelo.nome);
      setShowNewModeloDialog(false);
      setNewModeloNome('');
    } catch (error) {
      console.error('[handleCreateNewModelo] Erro:', error);
    }
  };

  // Converter valor bruto (string com vírgula) para número
  const parseRawValue = (rawValue: string): number => {
    if (!rawValue || rawValue.trim() === '') return 0;
    // Remove espaços e converte vírgula para ponto
    const cleaned = rawValue.trim().replace(/[^\d,\.]/g, '').replace(',', '.');
    if (!cleaned || cleaned === '.') return 0;
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };
  
  // Handler genérico para campos de preço
  const handlePrecoChange = (
    value: string,
    setRaw: (val: string) => void,
    setFormValue: (val: number) => void
  ) => {
    // Permite backspace e delete funcionarem normalmente
    if (value === '') {
      setRaw('');
      setFormValue(0);
      return;
    }
    
    const masked = maskBRL(value);
    setRaw(masked);
    const numValue = parseRawValue(masked);
    setFormValue(numValue);
  };

  // Calcular margem automaticamente
  useEffect(() => {
    const venda = typeof valorVenda === 'string' ? parseBRLInput(valorVenda) : Number(valorVenda || 0);
    const custo = typeof precoCusto === 'string' ? parseBRLInput(precoCusto) : Number(precoCusto || 0);
    if (!custo || custo <= 0) {
      setValue('margem_percentual', 0);
      return;
    }
    const margem = ((venda - custo) / custo) * 100;
    setValue('margem_percentual', Number.isFinite(margem) ? Number(margem.toFixed(2)) : 0);
  }, [valorVenda, precoCusto, setValue]);

  const onSubmit = async (data: FormData) => {
    try {
      setIsSaving(true);

      const payload: Partial<Produto> = {};

      // Identificação
      if (data.nome) {
        payload.nome = data.nome;
      }
      if (data.codigo !== undefined && data.codigo !== null) {
        payload.codigo = data.codigo;
      }
      if (data.codigo_barras && data.codigo_barras.trim()) {
        payload.codigo_barras = data.codigo_barras.trim();
      }
      if (data.referencia && data.referencia.trim()) {
        payload.referencia = data.referencia.trim();
      }
      if (data.marca && data.marca.trim()) {
        payload.marca = data.marca.trim();
      }
      if (data.modelo && data.modelo.trim()) {
        payload.modelo = data.modelo.trim();
      }
      if (data.grupo && data.grupo.trim()) {
        payload.grupo = data.grupo.trim();
      }
      if (data.qualidade && data.qualidade.trim()) {
        (payload as any).qualidade = data.qualidade.trim();
      }

      // Preços (BRL)
      const precoCustoNum = typeof data.preco_custo === 'string' ? parseBRLInput(data.preco_custo) : (data.preco_custo || 0);
      if (precoCustoNum >= 0 || isEditing) {
        (payload as any).preco_custo = precoCustoNum;
      }

      const valorVendaNum = typeof data.valor_venda === 'string' ? parseBRLInput(data.valor_venda) : (data.valor_venda || 0);
      if (valorVendaNum > 0 || isEditing) {
        payload.valor_venda = valorVendaNum;
      }

      if (data.valor_parcelado_6x !== undefined && data.valor_parcelado_6x !== null) {
        const valorParceladoNum = typeof data.valor_parcelado_6x === 'string' ? parseBRLInput(data.valor_parcelado_6x) : data.valor_parcelado_6x;
        if (valorParceladoNum > 0 || isEditing) {
          payload.valor_parcelado_6x = valorParceladoNum;
        }
      }

      if (data.margem_percentual !== undefined && data.margem_percentual !== null) {
        payload.margem_percentual = data.margem_percentual;
      }

      // Estoque
      if (data.estoque_grade?.itens && Object.keys(data.estoque_grade.itens).length > 0) {
        payload.estoque_grade = data.estoque_grade;
        const totalGrade = Object.values(data.estoque_grade.itens).reduce((a, b) => a + (Number(b) || 0), 0);
        payload.quantidade = totalGrade;
      } else if (data.quantidade !== undefined && data.quantidade !== null) {
        payload.quantidade = data.quantidade;
        if (isEditing) payload.estoque_grade = null as any; // limpar grade se voltar a estoque simples
      }
      // Estoque mínimo: sempre enviar, mesmo se for 0 (para permitir zerar)
      if (data.estoque_minimo !== undefined && data.estoque_minimo !== null) {
        payload.estoque_minimo = data.estoque_minimo;
      } else if (isEditing) {
        // Se estiver editando e não foi informado, enviar 0
        payload.estoque_minimo = 0;
      }
      // Localização: enviar mesmo se vazio (para permitir limpar)
      if (data.localizacao !== undefined) {
        payload.localizacao = data.localizacao.trim() || null;
      }
      if (data.unidade !== undefined && data.unidade.trim()) {
        payload.unidade = data.unidade.trim();
      }
      // Garantia (opcional): 0 = nenhum, 7/30/90/180/365 conforme tabela garantias
      if (data.garantia_dias !== undefined && data.garantia_dias !== '' && data.garantia_dias !== null) {
        const dias = typeof data.garantia_dias === 'number' ? data.garantia_dias : Number(data.garantia_dias);
        if (!Number.isNaN(dias) && dias >= 0) payload.garantia_dias = dias;
      }
      if (data.tipo !== undefined) {
        payload.tipo = data.tipo;
      }

      await onSave(payload);
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar produto:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="z-[100] max-w-4xl w-[95vw] sm:w-full max-h-[90dvh] sm:max-h-[90vh] overflow-hidden flex flex-col rounded-xl border-2 border-gray-300 dark:border-gray-600 p-4 sm:p-6 gap-3 sm:gap-4"
        aria-describedby="product-form-description"
      >
        <DialogHeader className="space-y-0 pb-1">
          <DialogTitle className="text-base sm:text-lg">{isEditing ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
          <p id="product-form-description" className="sr-only">
            Formulário com abas: Dados do Produto, Preços, Estoque e Movimentações.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0 min-w-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 min-w-0">
            <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full h-auto gap-1 p-1 rounded-xl">
              <TabsTrigger value="dados" className="gap-1.5 sm:gap-2 min-h-[44px] sm:min-h-0 text-xs sm:text-sm rounded-lg touch-manipulation py-2">
                <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="truncate">Dados</span>
              </TabsTrigger>
              <TabsTrigger value="precos" className="gap-1.5 sm:gap-2 min-h-[44px] sm:min-h-0 text-xs sm:text-sm rounded-lg touch-manipulation py-2">
                <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="truncate">Preços</span>
              </TabsTrigger>
              <TabsTrigger value="estoque" className="gap-1.5 sm:gap-2 min-h-[44px] sm:min-h-0 text-xs sm:text-sm rounded-lg touch-manipulation py-2">
                <Warehouse className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="truncate">Estoque</span>
              </TabsTrigger>
              <TabsTrigger value="movimentacoes" className="gap-1.5 sm:gap-2 min-h-[44px] sm:min-h-0 text-xs sm:text-sm rounded-lg touch-manipulation py-2" disabled={!isEditing}>
                <History className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="truncate">Movim.</span>
              </TabsTrigger>
            </TabsList>

            {/* ABA: Dados do Produto */}
            <TabsContent value="dados" className="flex-1 overflow-y-auto space-y-4 mt-3 sm:mt-4 min-w-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 min-w-0">
                <div className="md:col-span-2 min-w-0">
                  <Label htmlFor="nome" className="text-sm">
                    Nome/Descrição <span className="text-destructive">*</span>
                    {errors.nome && <span className="text-destructive ml-2">({errors.nome.message})</span>}
                  </Label>
                  <Input
                    id="nome"
                    {...register('nome', { required: 'Nome é obrigatório' })}
                    placeholder="Ex: Adaptador iPhone Jack P2"
                    className="text-base md:text-sm mt-1 min-h-[44px] sm:min-h-0 rounded-lg touch-manipulation"
                  />
                </div>

                <div className="min-w-0">
                  <Label htmlFor="codigo" className="text-sm">Código</Label>
                  <div className="flex flex-col sm:flex-row gap-2 mt-1">
                    <Input
                      id="codigo"
                      type="number"
                      {...register('codigo', { valueAsNumber: true })}
                      placeholder="Código do produto"
                      disabled={isLoadingCodigo || (isEditing && produto?.codigo !== null && produto?.codigo !== undefined)}
                      className="flex-1 min-h-[44px] sm:min-h-0 text-base md:text-sm rounded-lg touch-manipulation"
                    />
                    {(isEditing && (produto?.codigo === null || produto?.codigo === undefined)) && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={async () => {
                          setIsLoadingCodigo(true);
                          const proximoCodigo = await buscarProximoCodigo();
                          setValue('codigo', proximoCodigo);
                          setIsLoadingCodigo(false);
                        }}
                        disabled={isLoadingCodigo}
                        className="gap-2 min-h-[44px] sm:min-h-0 rounded-lg touch-manipulation shrink-0"
                      >
                        <Plus className="h-4 w-4" />
                        Gerar
                      </Button>
                    )}
                  </div>
                  {isLoadingCodigo && (
                    <p className="text-xs text-muted-foreground mt-1">Carregando próximo código...</p>
                  )}
                  {isEditing && (produto?.codigo === null || produto?.codigo === undefined) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Este produto não tem código. Clique em "Gerar" para criar um automaticamente.
                    </p>
                  )}
                </div>

                <div className="min-w-0">
                  <Label htmlFor="codigo_barras" className="text-sm">Código de Barras (EAN-13)</Label>
                  <div className="flex flex-col sm:flex-row gap-2 mt-1">
                    <Input
                      id="codigo_barras"
                      {...register('codigo_barras')}
                      placeholder="7890000000000"
                      className="flex-1 min-h-[44px] sm:min-h-0 text-base md:text-sm rounded-lg touch-manipulation"
                      maxLength={13}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGerarCodigoBarras}
                      disabled={!codigo && !codigoBarras}
                      className="gap-2 min-h-[44px] sm:min-h-0 rounded-lg touch-manipulation shrink-0"
                    >
                      <Barcode className="h-4 w-4" />
                      Gerar
                    </Button>
                  </div>
                </div>

                <div className="min-w-0">
                  <Label htmlFor="referencia" className="text-sm">Referência</Label>
                  <Input
                    id="referencia"
                    {...register('referencia')}
                    placeholder="Ex: AIJ-669"
                    className="mt-1 min-h-[44px] sm:min-h-0 text-base md:text-sm rounded-lg touch-manipulation"
                  />
                </div>

                <div className="min-w-0">
                  <Label htmlFor="marca" className="text-sm">Marca</Label>
                  <Popover open={marcaOpen} onOpenChange={setMarcaOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={marcaOpen}
                        className="w-full justify-between mt-1 min-h-[44px] sm:min-h-0 text-base md:text-sm rounded-lg touch-manipulation"
                      >
                        {watch('marca') || 'Selecione a marca'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="z-[110] w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar marca..." />
                        <CommandList>
                          <CommandEmpty>Nenhuma marca encontrada.</CommandEmpty>
                          <CommandGroup>
                            {marcasList.map((marca) => (
                              <CommandItem
                                key={marca.id || marca}
                                value={marca.nome || marca}
                                onSelect={() => {
                                  setValue('marca', marca.nome || marca);
                                  setMarcaOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    watch('marca') === (marca.nome || marca) ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {marca.nome || marca}
                              </CommandItem>
                            ))}
                            <CommandItem
                              value="__new__"
                              onSelect={() => {
                                setMarcaOpen(false);
                                setShowNewMarcaDialog(true);
                              }}
                              className="text-primary font-semibold"
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Criar nova marca
                            </CommandItem>
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  
                  {/* Dialog para criar nova marca */}
                  <Dialog open={showNewMarcaDialog} onOpenChange={setShowNewMarcaDialog}>
                    <DialogContent className="z-[110] max-w-[95vw] sm:max-w-md rounded-xl p-4 sm:p-6">
                      <DialogHeader>
                        <DialogTitle>Nova Marca</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="new-marca-nome">Nome da Marca <span className="text-destructive">*</span></Label>
                          <Input
                            id="new-marca-nome"
                            value={newMarcaNome}
                            onChange={(e) => setNewMarcaNome(e.target.value)}
                            placeholder="Ex: Samsung"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleCreateNewMarca();
                              }
                            }}
                          />
                        </div>
                        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setShowNewMarcaDialog(false);
                              setNewMarcaNome('');
                            }}
                            className="w-full sm:w-auto min-h-[44px] rounded-lg touch-manipulation"
                          >
                            Cancelar
                          </Button>
                          <Button
                            type="button"
                            onClick={handleCreateNewMarca}
                            disabled={!newMarcaNome.trim()}
                            className="w-full sm:w-auto min-h-[44px] rounded-lg touch-manipulation"
                          >
                            Criar e Selecionar
                          </Button>
                        </DialogFooter>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="min-w-0">
                  <Label htmlFor="modelo" className="text-sm">Modelo</Label>
                  <Popover open={modeloOpen} onOpenChange={setModeloOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={modeloOpen}
                        className="w-full justify-between mt-1 min-h-[44px] sm:min-h-0 text-base md:text-sm rounded-lg touch-manipulation"
                      >
                        {watch('modelo') || 'Selecione o modelo'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="z-[110] w-full p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                      <Command className="overflow-visible">
                        <CommandInput placeholder="Buscar modelo..." />
                        <CommandList
                          className="max-h-[280px] overflow-y-auto overflow-x-hidden overscroll-contain"
                          onWheel={(e) => e.stopPropagation()}
                        >
                          <CommandEmpty>Nenhum modelo encontrado.</CommandEmpty>
                          <CommandGroup>
                            {modelosList
                              .filter((modelo) => {
                                const marcaSelecionada = watch('marca');
                                if (!marcaSelecionada) return true;
                                // Filtrar modelos pela marca selecionada
                                const marca = marcasList.find(m => m.nome === marcaSelecionada);
                                if (!marca) return true;
                                return modelo.marca_id === marca.id;
                              })
                              .map((modelo) => (
                                <CommandItem
                                  key={modelo.id || modelo}
                                  value={modelo.nome || modelo}
                                  onSelect={() => {
                                    setValue('modelo', modelo.nome || modelo);
                                    setModeloOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      watch('modelo') === (modelo.nome || modelo) ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {modelo.nome || modelo}
                                </CommandItem>
                              ))}
                            <CommandItem
                              value="__new__"
                              onSelect={() => {
                                setModeloOpen(false);
                                setShowNewModeloDialog(true);
                              }}
                              className="text-primary font-semibold"
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Criar novo modelo
                            </CommandItem>
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  
                  {/* Dialog para criar novo modelo */}
                  <Dialog open={showNewModeloDialog} onOpenChange={setShowNewModeloDialog}>
                    <DialogContent className="z-[110] max-w-[95vw] sm:max-w-md rounded-xl p-4 sm:p-6">
                      <DialogHeader>
                        <DialogTitle>Novo Modelo</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="new-modelo-nome">Nome do Modelo <span className="text-destructive">*</span></Label>
                          <Input
                            id="new-modelo-nome"
                            value={newModeloNome}
                            onChange={(e) => setNewModeloNome(e.target.value)}
                            placeholder="Ex: Galaxy S21"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleCreateNewModelo();
                              }
                            }}
                          />
                        </div>
                        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setShowNewModeloDialog(false);
                              setNewModeloNome('');
                            }}
                            className="w-full sm:w-auto min-h-[44px] rounded-lg touch-manipulation"
                          >
                            Cancelar
                          </Button>
                          <Button
                            type="button"
                            onClick={handleCreateNewModelo}
                            disabled={!newModeloNome.trim() || !watch('marca')}
                            className="w-full sm:w-auto min-h-[44px] rounded-lg touch-manipulation"
                          >
                            Criar e Selecionar
                          </Button>
                        </DialogFooter>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="min-w-0">
                  <Label htmlFor="qualidade" className="text-sm">Qualidade</Label>
                  <Input
                    id="qualidade"
                    {...register('qualidade')}
                    placeholder="Ex: Original"
                    className="mt-1 min-h-[44px] sm:min-h-0 text-base md:text-sm rounded-lg touch-manipulation"
                  />
                </div>

                <div className="min-w-0">
                  <Label htmlFor="garantia_dias" className="text-sm">Período de garantia (opcional)</Label>
                  <Select
                    value={watch('garantia_dias') === undefined || watch('garantia_dias') === null || watch('garantia_dias') === '' ? '0' : String(watch('garantia_dias'))}
                    onValueChange={(v) => setValue('garantia_dias', v === '0' ? 0 : Number(v))}
                  >
                    <SelectTrigger id="garantia_dias" className="mt-1 min-h-[44px] sm:min-h-0 text-base md:text-sm rounded-lg touch-manipulation">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="z-[110]">
                      <SelectItem value="0">Nenhum</SelectItem>
                      <SelectItem value="7">7 dias</SelectItem>
                      <SelectItem value="30">30 dias</SelectItem>
                      <SelectItem value="90">90 dias</SelectItem>
                      <SelectItem value="180">180 dias</SelectItem>
                      <SelectItem value="365">1 ano</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="min-w-0">
                  <Label htmlFor="tipo" className="text-sm">Tipo do produto</Label>
                  <Select
                    value={watch('tipo') || 'PECA'}
                    onValueChange={(v) => setValue('tipo', v as TipoProduto)}
                  >
                    <SelectTrigger id="tipo" className="mt-1 min-h-[44px] sm:min-h-0 text-base md:text-sm rounded-lg touch-manipulation">
                      <SelectValue placeholder="Produto ou Serviço" />
                    </SelectTrigger>
                    <SelectContent className="z-[110]">
                      {Object.entries(TIPO_PRODUTO_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* ABA: Preços */}
            <TabsContent value="precos" className="flex-1 overflow-y-auto space-y-4 mt-3 sm:mt-4 min-w-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 min-w-0">
                <div className="min-w-0">
                  <Label htmlFor="preco_custo" className="text-sm">Valor de Compra / Custo</Label>
                  <Input
                    id="preco_custo"
                    type="text"
                    inputMode="decimal"
                    value={precoCustoRaw}
                    onChange={(e) => {
                      handlePrecoChange(
                        e.target.value,
                        setPrecoCustoRaw,
                        (val) => setValue('preco_custo', val)
                      );
                    }}
                    onBlur={() => {
                      const numValue = parseRawValue(precoCustoRaw);
                      if (numValue > 0) {
                        setPrecoCustoRaw(numValue.toFixed(2).replace('.', ','));
                      } else if (precoCustoRaw === '' || precoCustoRaw === '0') {
                        setPrecoCustoRaw('');
                      }
                    }}
                    onKeyDown={(e) => {
                      // Permite backspace, delete, tab, enter, arrow keys funcionarem normalmente
                      if (['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                        return;
                      }
                    }}
                    placeholder="0,00"
                    className="text-right text-base md:text-sm min-h-[44px] sm:min-h-0 rounded-lg touch-manipulation mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Usado para calcular a margem automaticamente
                  </p>
                </div>

                <div className="min-w-0">
                  <Label htmlFor="valor_venda" className="text-sm">
                    Valor de Venda (Dinheiro/PIX) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="valor_venda"
                    type="text"
                    inputMode="decimal"
                    value={valorVendaRaw}
                    onChange={(e) => {
                      handlePrecoChange(
                        e.target.value,
                        setValorVendaRaw,
                        (val) => setValue('valor_venda', val)
                      );
                    }}
                    onBlur={() => {
                      const numValue = parseRawValue(valorVendaRaw);
                      if (numValue > 0) {
                        setValorVendaRaw(numValue.toFixed(2).replace('.', ','));
                      } else if (valorVendaRaw === '' || valorVendaRaw === '0') {
                        setValorVendaRaw('');
                      }
                    }}
                    onKeyDown={(e) => {
                      // Permite backspace, delete, tab, enter, arrow keys funcionarem normalmente
                      if (['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                        return;
                      }
                    }}
                    placeholder="0,00"
                    className="text-right font-semibold text-base md:text-sm min-h-[44px] sm:min-h-0 rounded-lg touch-manipulation"
                  />
                </div>

                <div>
                  <Label htmlFor="valor_parcelado_6x" className="text-sm">Valor Parcelado 6x</Label>
                  <Input
                    id="valor_parcelado_6x"
                    type="text"
                    inputMode="decimal"
                    value={valorParceladoRaw}
                    onChange={(e) => {
                      handlePrecoChange(
                        e.target.value,
                        setValorParceladoRaw,
                        (val) => setValue('valor_parcelado_6x', val)
                      );
                    }}
                    onBlur={() => {
                      const numValue = parseRawValue(valorParceladoRaw);
                      if (numValue > 0) {
                        setValorParceladoRaw(numValue.toFixed(2).replace('.', ','));
                      } else if (valorParceladoRaw === '' || valorParceladoRaw === '0') {
                        setValorParceladoRaw('');
                      }
                    }}
                    onKeyDown={(e) => {
                      // Permite backspace, delete, tab, enter, arrow keys funcionarem normalmente
                      if (['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                        return;
                      }
                    }}
                    placeholder="0,00"
                    className="text-right text-base md:text-sm min-h-[44px] sm:min-h-0 rounded-lg touch-manipulation"
                  />
                </div>

                <div>
                  <Label htmlFor="margem_percentual" className="text-sm">Margem (%)</Label>
                  <Input
                    id="margem_percentual"
                    type="number"
                    step="0.01"
                    {...register('margem_percentual', { valueAsNumber: true })}
                    placeholder="0.00"
                    readOnly
                    className="bg-muted text-base md:text-sm min-h-[44px] sm:min-h-0 rounded-lg"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Calculada automaticamente: ((Venda - Compra) / Compra) × 100
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* ABA: Estoque */}
            <TabsContent value="estoque" className="flex-1 overflow-y-auto space-y-4 mt-3 sm:mt-4 min-w-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 min-w-0">
                {/* Opção: estoque simples ou grade (por cor / com-sem aro) */}
                <div className="md:col-span-2 flex items-center gap-3 rounded-lg border p-4 bg-muted/30">
                  <Switch
                    id="usa_grade"
                    checked={!!watch('estoque_grade')}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setValue('estoque_grade', { tipo: 'cor', itens: {} });
                        setValue('quantidade', 0);
                      } else {
                        setValue('estoque_grade', undefined as any);
                      }
                    }}
                  />
                  <Label htmlFor="usa_grade" className="cursor-pointer flex-1">
                    Usar grade de estoque (por cor em tampas ou com/sem aro em telas)
                  </Label>
                </div>

                {watch('estoque_grade') ? (
                  <>
                    <div className="md:col-span-2">
                      <Label>Tipo de grade</Label>
                      <Select
                        value={watch('estoque_grade')?.tipo || 'cor'}
                        onValueChange={(v: 'cor' | 'aro') => {
                          const current = watch('estoque_grade');
                          if (!current) return;
                          if (v === 'aro') {
                            const next = { tipo: 'aro' as const, itens: { 'Com Aro': current.itens['Com Aro'] ?? 0, 'Sem Aro': current.itens['Sem Aro'] ?? 0 } };
                            setValue('estoque_grade', next);
                            syncQuantidadeFromGrade(setValue as any, next);
                          } else {
                            const next = { tipo: 'cor' as const, itens: current.tipo === 'cor' ? current.itens : {} };
                            setValue('estoque_grade', next);
                            syncQuantidadeFromGrade(setValue as any, next);
                          }
                        }}
                      >
                        <SelectTrigger className="mt-1 max-w-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[110]">
                          <SelectItem value="cor" className="gap-2">
                            <Palette className="h-4 w-4" /> Por cor (tampas)
                          </SelectItem>
                          <SelectItem value="aro" className="gap-2">
                            <LayoutGrid className="h-4 w-4" /> Com aro / Sem aro (telas)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {watch('estoque_grade')?.tipo === 'aro' ? (
                      <GradeAroFields watch={watch} setValue={setValue} />
                    ) : (
                      <GradeCorFields watch={watch} setValue={setValue} />
                    )}
                    <div className="md:col-span-2 pt-2 border-t">
                      <p className="text-sm font-medium text-muted-foreground">
                        Total em estoque: <span className="text-foreground font-bold">{watch('quantidade') ?? 0}</span> unidades
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="min-w-0">
                      <Label htmlFor="quantidade" className="text-sm">Quantidade Atual</Label>
                      <Input
                        id="quantidade"
                        type="number"
                        {...register('quantidade', { valueAsNumber: true })}
                        placeholder="0"
                        className="mt-1 min-h-[44px] sm:min-h-0 text-base md:text-sm rounded-lg touch-manipulation"
                      />
                    </div>
                  </>
                )}

                <div className="min-w-0">
                  <Label htmlFor="estoque_minimo" className="text-sm">Estoque Mínimo</Label>
                  <Input
                    id="estoque_minimo"
                    type="number"
                    {...register('estoque_minimo', { valueAsNumber: true })}
                    placeholder="0"
                    className="mt-1 min-h-[44px] sm:min-h-0 text-base md:text-sm rounded-lg touch-manipulation"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Alerta quando estoque ficar abaixo deste valor
                  </p>
                </div>

                <div className="min-w-0">
                  <Label htmlFor="localizacao" className="text-sm">Localização</Label>
                  <Input
                    id="localizacao"
                    {...register('localizacao')}
                    placeholder="Ex: Prateleira A3, Gaveta 2"
                    className="mt-1 min-h-[44px] sm:min-h-0 text-base md:text-sm rounded-lg touch-manipulation"
                  />
                </div>

                <div className="min-w-0">
                  <Label htmlFor="unidade" className="text-sm">Unidade</Label>
                  <Select
                    value={watch('unidade') || 'UN'}
                    onValueChange={(v) => setValue('unidade', v)}
                  >
                    <SelectTrigger id="unidade" className="mt-1 min-h-[44px] sm:min-h-0 text-base md:text-sm rounded-lg touch-manipulation">
                      <SelectValue placeholder="Unidade" />
                    </SelectTrigger>
                    <SelectContent className="z-[110]">
                      <SelectItem value="UN">Unidade</SelectItem>
                      <SelectItem value="CX">Caixa</SelectItem>
                      <SelectItem value="KT">Kit</SelectItem>
                      <SelectItem value="PCS">Pcs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* ABA: Movimentações de Estoque */}
            <TabsContent value="movimentacoes" className="flex-1 overflow-y-auto overflow-x-auto space-y-4 mt-3 sm:mt-4 min-w-0">
              {isLoadingMovimentacoes ? (
                <div className="text-center py-8 text-muted-foreground">
                  Carregando histórico...
                </div>
              ) : movimentacoes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma movimentação de estoque registrada</p>
                  <p className="text-sm mt-2">As baixas de estoque vindas de vendas, OS, devoluções ou ajustes aparecerão aqui</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Histórico completo de movimentações ({movimentacoes.length} registros)
                    </div>
                    <div className="flex gap-2 text-xs">
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded">Saída</span>
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded">Entrada</span>
                    </div>
                  </div>
                  <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background">
                        <TableRow>
                          <TableHead className="w-[140px]">Data</TableHead>
                          <TableHead className="w-[100px]">Tipo</TableHead>
                          <TableHead className="w-[80px]">Ref.</TableHead>
                          <TableHead className="w-[80px] text-center">Qtd</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="w-[120px]">Responsável</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movimentacoes.map((mov) => {
                          // Cores por tipo de movimentação
                          const tipoBadgeColors: Record<string, string> = {
                            'Venda': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
                            'OS': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
                            'Cancelamento': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
                            'Devolução': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
                            'Devolução OS': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
                            'Troca': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
                            'Perda': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
                            'Ajuste': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
                            'Inventário': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
                          };
                          const badgeColor = tipoBadgeColors[mov.ref_tipo] || 'bg-muted';
                          
                          const dataFormatada = format(new Date(mov.data), "dd/MM/yyyy");
                          const horaFormatada = format(new Date(mov.data), "HH:mm:ss");
                          
                          return (
                            <TableRow key={mov.id} className="hover:bg-muted/50">
                              <TableCell className="text-sm">
                                <div className="flex flex-col">
                                  <span className="font-medium">{dataFormatada}</span>
                                  <span className="text-xs text-muted-foreground">{horaFormatada}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${badgeColor}`}>
                                  {mov.ref_tipo}
                                </span>
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {mov.ref_id && mov.ref_numero > 0 ? (
                                  <button
                                    type="button"
                                    className="underline underline-offset-2 hover:text-blue-600"
                                    onClick={() => {
                                      if (mov.ref_tipo === 'OS') navigate(`/os/${mov.ref_id}`);
                                      if (['Venda', 'Cancelamento'].includes(mov.ref_tipo)) navigate(`/pdv/venda/${mov.ref_id}`);
                                      if (['Devolução', 'Troca', 'Perda'].includes(mov.ref_tipo)) navigate(`/pdv/devolucoes`);
                                    }}
                                    title={`Abrir ${mov.ref_tipo}`}
                                  >
                                    #{mov.ref_numero}
                                  </button>
                                ) : mov.ref_numero > 0 ? (
                                  <span>#{mov.ref_numero}</span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {mov.quantidade_delta !== 0 ? (
                                  <span className={`font-semibold ${mov.quantidade_delta < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {mov.quantidade_delta < 0 ? '' : '+'}{mov.quantidade_delta}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-sm">{mov.descricao}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {mov.vendedor_nome || '-'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4 border-t pt-4 flex-col-reverse sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="w-full sm:w-auto min-h-[44px] sm:min-h-0 rounded-xl sm:rounded-md touch-manipulation"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSaving || isLoadingCodigo}
              className="w-full sm:w-auto min-h-[44px] sm:min-h-0 rounded-xl sm:rounded-md touch-manipulation"
            >
              {isSaving ? 'Salvando...' : isEditing ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
