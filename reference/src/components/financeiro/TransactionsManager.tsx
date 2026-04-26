import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, TrendingUp, TrendingDown, Search, ChevronLeft, ChevronRight, ShoppingCart, Trash2, Edit } from 'lucide-react';
// TODO: Implementar hooks do sistema financeiro antigo ou migrar para novo sistema
// import { useFinancialTransactions, useFinancialCategories } from '@/hooks/useFinanceiro';
import { TRANSACTION_TYPE_LABELS, PAYMENT_METHOD_LABELS, PaymentMethod, TransactionType, type FinancialCategory } from '@/types/financial';
import { currencyFormatters, dateFormatters } from '@/utils/formatters';
import { MASKED_VALUE } from '@/components/dashboard/FinancialCards';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { LoadingButton } from '@/components/LoadingButton';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { cn } from '@/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { from } from '@/integrations/db/client';
import { useToast } from '@/hooks/use-toast';

interface TransactionsManagerProps {
  month?: string;
  startDate?: string;
  endDate?: string;
  valuesVisible?: boolean;
}

const ITEMS_PER_PAGE = 20;

export function TransactionsManager({ month, startDate, endDate, valuesVisible = true }: TransactionsManagerProps) {
  const fmt = (n: number) => (valuesVisible ? currencyFormatters.brl(n) : MASKED_VALUE);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<{ id: string; source: string; description: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editDateDialogOpen, setEditDateDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{ id: string; source: string; description: string; date: string } | null>(null);
  const [newDate, setNewDate] = useState<string>('');
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Categorias financeiras (entrada e saída) para Nova Transação
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['financial-categories-transactions'],
    queryFn: async () => {
      try {
        const { data, error } = await from('financial_categories')
          .select('*')
          .eq('is_active', true)
          .order('name', { ascending: true })
          .execute();
        if (error) throw error;
        return (data || []) as FinancialCategory[];
      } catch (err) {
        console.warn('Erro ao buscar categorias financeiras:', err);
        return [];
      }
    },
  });

  const transactions: any[] = [];
  const isLoading = false;
  const createTransaction = { mutateAsync: async () => {}, isPending: false };

  // Buscar vendas pagas do período
  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['sales-transactions', startDate, endDate],
    queryFn: async () => {
      try {
        let q = from('sales')
          .select('id, numero, cliente_nome, total, created_at, status, observacoes')
          .eq('status', 'paid')
          .order('created_at', { ascending: false });
        
        // Só aplicar filtro de data se ambos estiverem definidos e não vazios
        if (startDate && endDate && startDate !== '' && endDate !== '') {
          q = q.gte('created_at', startDate).lte('created_at', endDate + 'T23:59:59');
        }
        
        const { data, error } = await q.execute();
        if (error) {
          console.warn('Erro ao buscar vendas:', error);
          return [];
        }
        console.log('[TransactionsManager] Vendas encontradas:', data?.length || 0);
        return data || [];
      } catch (err) {
        console.warn('Erro ao buscar vendas:', err);
        return [];
      }
    },
  });

  // Buscar contas a pagar que foram pagas (despesas)
  const { data: paidBills = [], isLoading: billsLoading } = useQuery({
    queryKey: ['paid-bills-transactions', startDate, endDate],
    queryFn: async () => {
      try {
        let q = from('bills_to_pay')
          .select('id, description, amount, payment_date, payment_method, supplier, expense_type')
          .eq('status', 'pago')
          .order('payment_date', { ascending: false });
        
        // Só aplicar filtro de data se ambos estiverem definidos e não vazios
        if (startDate && endDate && startDate !== '' && endDate !== '') {
          q = q.gte('payment_date', startDate).lte('payment_date', endDate);
        }
        
        const { data, error } = await q.execute();
        if (error) {
          console.warn('Erro ao buscar contas pagas:', error);
          return [];
        }
        console.log('[TransactionsManager] Contas pagas encontradas:', data?.length || 0);
        return data || [];
      } catch (err) {
        console.warn('Erro ao buscar contas pagas:', err);
        return [];
      }
    },
  });

  const [formData, setFormData] = useState({
    type: 'entrada' as TransactionType,
    category_id: '',
    description: '',
    amount: 0,
    payment_method: 'pix' as PaymentMethod,
    transaction_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Função para extrair custo e lucro da observação (campo observacoes)
  const extractCustoLucro = (observacoes: string | null) => {
    if (!observacoes) return { custo: 0, lucro: 0 };
    const custoMatch = observacoes.match(/Custo:\s*R\$\s*([\d.,]+)/i);
    const lucroMatch = observacoes.match(/Lucro:\s*R\$\s*([\d.,]+)/i);
    const parseValor = (str: string) => {
      if (!str) return 0;
      return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
    };
    return {
      custo: custoMatch ? parseValor(custoMatch[1]) : 0,
      lucro: lucroMatch ? parseValor(lucroMatch[1]) : 0,
    };
  };

  // Combinar transações manuais + vendas + contas pagas
  const allTransactions = useMemo(() => {
    const items: Array<{
      id: string;
      date: string;
      type: 'entrada' | 'saida';
      description: string;
      category: string;
      method: string;
      amount: number;
      source: 'manual' | 'sale' | 'bill';
      custo?: number;
      lucro?: number;
    }> = [];
    
    // Transações manuais - EXCLUIR as que referenciam vendas (já buscamos vendas diretamente)
    transactions.forEach(t => {
      // Ignorar transações que são referências a vendas
      const isFromSale = t.reference_type === 'sale' || 
                         t.description?.toLowerCase().includes('quitação') ||
                         t.description?.toLowerCase().includes('venda #');
      
      if (!isFromSale) {
        items.push({
          id: t.id,
          date: t.transaction_date,
          type: t.type,
          description: t.description,
          category: t.category?.name || '-',
          method: t.payment_method ? PAYMENT_METHOD_LABELS[t.payment_method] : '-',
          amount: t.amount,
          source: 'manual',
        });
      }
    });
    
    // Vendas como entradas (apenas pagas)
    sales.forEach((sale: any) => {
      if (typeFilter === 'all' || typeFilter === 'entrada') {
        const { custo, lucro } = extractCustoLucro(sale.observacoes);
        items.push({
          id: `sale-${sale.id}`,
          date: sale.created_at?.split('T')[0] || '',
          type: 'entrada',
          description: `Venda #${sale.numero}${sale.cliente_nome ? ` - ${sale.cliente_nome}` : ''} - VENDA CONSOLIDADA`,
          category: 'Vendas',
          method: 'PDV',
          amount: Number(sale.total || 0),
          source: 'sale',
          custo,
          lucro,
        });
      }
    });

    // Contas pagas como saídas (despesas)
    paidBills.forEach((bill: any) => {
      if (typeFilter === 'all' || typeFilter === 'saida') {
        items.push({
          id: `bill-${bill.id}`,
          date: bill.payment_date || '',
          type: 'saida',
          description: `${bill.description}${bill.supplier ? ` - ${bill.supplier}` : ''}`,
          category: bill.expense_type === 'fixa' ? 'Despesa Fixa' : 'Despesa Variável',
          method: bill.payment_method ? PAYMENT_METHOD_LABELS[bill.payment_method as PaymentMethod] || bill.payment_method : '-',
          amount: Number(bill.amount || 0),
          source: 'bill',
        });
      }
    });
    
    // Ordenar por data (mais recentes primeiro)
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return items;
  }, [transactions, sales, paidBills, typeFilter]);

  const filteredTransactions = allTransactions.filter(t =>
    t.description.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Paginação
  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleOpenDialog = () => {
    setFormData({
      type: 'entrada',
      category_id: '',
      description: '',
      amount: 0,
      payment_method: 'pix',
      transaction_date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    await createTransaction.mutateAsync({
      ...formData,
      reference_type: 'manual',
    } as any);
    setIsDialogOpen(false);
  };

  const handleDeleteClick = (item: { id: string; source: string; description: string }) => {
    setDeletingItem(item);
    setDeleteDialogOpen(true);
  };

  const handleEditDateClick = (item: { id: string; source: string; description: string; date: string }) => {
    setEditingItem(item);
    setNewDate(item.date);
    setEditDateDialogOpen(true);
  };

  const handleConfirmEditDate = async () => {
    if (!editingItem || !newDate) return;
    
    try {
      const realId = editingItem.id.replace('bill-', '').replace('sale-', '');
      
      if (editingItem.source === 'bill') {
        // Atualizar payment_date na tabela bills_to_pay
        const { error } = await from('bills_to_pay')
          .update({ payment_date: newDate })
          .eq('id', realId)
          .execute();
        
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['paid-bills-transactions'] });
        queryClient.invalidateQueries({ queryKey: ['bills-to-pay'] });
      } else if (editingItem.source === 'manual') {
        // Atualizar transaction_date na tabela financial_transactions
        const { error } = await from('financial_transactions')
          .update({ transaction_date: newDate })
          .eq('id', realId)
          .execute();
        
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      } else if (editingItem.source === 'sale') {
        toast({
          title: "Não permitido",
          description: "A data de vendas não pode ser alterada daqui.",
          variant: "destructive"
        });
        return;
      }
      
      toast({
        title: "Sucesso",
        description: "Data atualizada com sucesso!",
      });
    } catch (error: any) {
      console.error('Erro ao atualizar data:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar data",
        variant: "destructive"
      });
    } finally {
      setEditDateDialogOpen(false);
      setEditingItem(null);
      setNewDate('');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingItem) return;
    
    setIsDeleting(true);
    try {
      // Extrair o ID real (remover prefixo bill- ou sale-)
      const realId = deletingItem.id.replace('bill-', '').replace('sale-', '');
      
      if (deletingItem.source === 'bill') {
        // Deletar da tabela bills_to_pay
        const { error } = await from('bills_to_pay').delete().eq('id', realId);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['paid-bills-transactions'] });
        queryClient.invalidateQueries({ queryKey: ['bills-to-pay'] });
      } else if (deletingItem.source === 'manual') {
        // Deletar da tabela financial_transactions
        const { error } = await from('financial_transactions').delete().eq('id', realId);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      } else if (deletingItem.source === 'sale') {
        toast({
          title: "Não permitido",
          description: "Vendas não podem ser excluídas daqui. Use a tela de vendas.",
          variant: "destructive"
        });
        return;
      }
      
      toast({
        title: "Sucesso",
        description: "Transação excluída com sucesso!",
      });
    } catch (error: any) {
      console.error('Erro ao excluir:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir transação",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setDeletingItem(null);
    }
  };

  const availableCategories = categories.filter(c => c.type === formData.type);

  // Calcular totais usando dados filtrados (sem paginação)
  const totais = useMemo(() => {
    const vendasItems = filteredTransactions.filter(t => t.source === 'sale');
    const despesasItems = filteredTransactions.filter(t => t.source === 'bill');
    const totalCusto = vendasItems.reduce((sum, t) => sum + (t.custo || 0), 0);
    const totalVenda = vendasItems.reduce((sum, t) => sum + t.amount, 0);
    const totalLucro = vendasItems.reduce((sum, t) => sum + (t.lucro || 0), 0);
    const totalDespesas = despesasItems.reduce((sum, t) => sum + t.amount, 0);
    const totalEntradas = filteredTransactions
      .filter(t => t.type === 'entrada')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalSaidas = filteredTransactions
      .filter(t => t.type === 'saida')
      .reduce((sum, t) => sum + t.amount, 0);
    
    return { totalCusto, totalVenda, totalLucro, totalDespesas, totalEntradas, totalSaidas };
  }, [filteredTransactions]);

  const { totalCusto, totalVenda, totalLucro, totalDespesas, totalEntradas, totalSaidas } = totais;

  if (isLoading || salesLoading || billsLoading) {
    return <LoadingSkeleton type="table" count={5} />;
  }

  return (
    <Card className="overflow-hidden min-w-0">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base sm:text-lg">Transações</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Histórico de entradas e saídas</CardDescription>
          </div>
          <Button onClick={handleOpenDialog} className="gap-2 min-h-[44px] sm:min-h-0 w-full sm:w-auto rounded-xl sm:rounded-md touch-manipulation shrink-0">
            <Plus className="h-4 w-4" />
            Nova Transação
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 min-w-0">
        {/* Resumo — mobile: 2 colunas */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3 min-w-0">
          <div className="p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-xs text-muted-foreground">Total Custo</p>
            <p className="text-lg font-bold text-red-600">{fmt(totalCusto)}</p>
          </div>
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
            <p className="text-xs text-muted-foreground">Total Vendas</p>
            <p className="text-lg font-bold text-blue-600">{fmt(totalVenda)}</p>
          </div>
          <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
            <p className="text-xs text-muted-foreground">Total Despesas</p>
            <p className="text-lg font-bold text-orange-600">{fmt(totalDespesas)}</p>
          </div>
          <div className="p-3 rounded-lg bg-green-50 border border-green-200">
            <p className="text-xs text-muted-foreground">Total Lucro</p>
            <p className="text-lg font-bold text-green-600">{fmt(totalLucro)}</p>
          </div>
          <div className={cn(
            "p-3 rounded-lg border",
            totalEntradas - totalSaidas >= 0 
              ? "bg-primary/10 border-primary/30" 
              : "bg-destructive/10 border-destructive/30"
          )}>
            <p className="text-xs text-muted-foreground">Saldo (Entradas - Saídas)</p>
            <p className={cn(
              "text-lg font-bold",
              totalEntradas - totalSaidas >= 0 ? "text-primary" : "text-destructive"
            )}>
              {fmt(totalEntradas - totalSaidas)}
            </p>
          </div>
        </div>

        {/* Filtros — mobile: toque confortável */}
        <div className="flex flex-col sm:flex-row gap-3 min-w-0">
          <div className="relative flex-1 min-w-0 max-w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar transações..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 min-h-[44px] sm:min-h-0 rounded-xl sm:rounded-md touch-manipulation"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[150px] min-h-[44px] sm:min-h-0 rounded-xl sm:rounded-md touch-manipulation">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="entrada">Entradas</SelectItem>
              <SelectItem value="saida">Saídas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Lista: mobile = cards; desktop = tabela */}
        {filteredTransactions.length === 0 ? (
          <EmptyState
            variant="no-data"
            title="Nenhuma transação encontrada"
            description="Registre suas entradas e saídas manualmente."
            action={{ label: 'Nova Transação', onClick: handleOpenDialog }}
          />
        ) : (
          <>
            {/* Mobile: cards compactos */}
            <div className="md:hidden space-y-2 min-w-0">
              {paginatedTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-card p-3 min-w-0"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{transaction.description}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                        <span className="text-xs text-muted-foreground">{dateFormatters.short(transaction.date)}</span>
                        <Badge className={cn(
                          'text-[10px]',
                          transaction.source === 'bill'
                            ? 'bg-orange-100 text-orange-700 border-orange-300'
                            : transaction.type === 'entrada'
                              ? 'bg-success/10 text-success border-success/30'
                              : 'bg-destructive/10 text-destructive border-destructive/30'
                        )}>
                          {transaction.source === 'sale' ? 'Venda' : transaction.source === 'bill' ? 'Despesa' : TRANSACTION_TYPE_LABELS[transaction.type]}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-2 text-xs tabular-nums">
                        {transaction.custo != null && transaction.custo > 0 && <span className="text-red-600">Custo {fmt(transaction.custo)}</span>}
                        {transaction.source === 'sale' && <span className="text-blue-600 font-medium">Venda {fmt(transaction.amount)}</span>}
                        {transaction.source === 'bill' && <span className="text-orange-600 font-medium">Desp. {fmt(transaction.amount)}</span>}
                        {transaction.lucro != null && transaction.lucro > 0 && <span className="text-green-600 font-medium">Lucro {fmt(transaction.lucro)}</span>}
                      </div>
                    </div>
                    {transaction.source !== 'sale' && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-blue-600 touch-manipulation"
                          onClick={() => handleEditDateClick({
                            id: transaction.id,
                            source: transaction.source,
                            description: transaction.description,
                            date: transaction.date
                          })}
                          aria-label="Editar data"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-destructive touch-manipulation"
                          onClick={() => handleDeleteClick({
                            id: transaction.id,
                            source: transaction.source,
                            description: transaction.description
                          })}
                          aria-label="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop: tabela com scroll horizontal */}
            <div className="hidden md:block border rounded-lg overflow-x-auto min-w-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right text-red-600">Custo</TableHead>
                    <TableHead className="text-right text-blue-600">Venda</TableHead>
                    <TableHead className="text-right text-orange-600">Despesa</TableHead>
                    <TableHead className="text-right text-green-600">Lucro</TableHead>
                    <TableHead className="w-20">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>{dateFormatters.short(transaction.date)}</TableCell>
                      <TableCell>
                        <Badge className={cn(
                          transaction.source === 'bill'
                            ? 'bg-orange-100 text-orange-700 border-orange-300'
                            : transaction.type === 'entrada'
                              ? 'bg-success/10 text-success border-success/30'
                              : 'bg-destructive/10 text-destructive border-destructive/30'
                        )}>
                          {transaction.source === 'sale' ? (
                            <ShoppingCart className="h-3 w-3 mr-1" />
                          ) : transaction.source === 'bill' ? (
                            <TrendingDown className="h-3 w-3 mr-1" />
                          ) : transaction.type === 'entrada' ? (
                            <TrendingUp className="h-3 w-3 mr-1" />
                          ) : (
                            <TrendingDown className="h-3 w-3 mr-1" />
                          )}
                          {transaction.source === 'sale' ? 'Venda' : transaction.source === 'bill' ? 'Despesa' : TRANSACTION_TYPE_LABELS[transaction.type]}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{transaction.description}</TableCell>
                      <TableCell className="text-right text-red-600">
                        {transaction.custo && transaction.custo > 0 ? fmt(transaction.custo) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-blue-600">
                        {transaction.source === 'sale' ? fmt(transaction.amount) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-orange-600">
                        {transaction.source === 'bill' ? fmt(transaction.amount) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        {transaction.lucro && transaction.lucro > 0 ? fmt(transaction.lucro) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {transaction.source !== 'sale' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => handleEditDateClick({
                                  id: transaction.id,
                                  source: transaction.source,
                                  description: transaction.description,
                                  date: transaction.date
                                })}
                                title="Editar data"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteClick({
                                  id: transaction.id,
                                  source: transaction.source,
                                  description: transaction.description
                                })}
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {/* Paginação — mobile: toque confortável */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground order-2 sm:order-1">
                  {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredTransactions.length)} de {filteredTransactions.length}
                </p>
                <div className="flex items-center justify-center gap-2 order-1 sm:order-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-[44px] sm:min-h-0 rounded-xl sm:rounded-md touch-manipulation"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm tabular-nums">
                    {currentPage}/{totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-[44px] sm:min-h-0 rounded-xl sm:rounded-md touch-manipulation"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Dialog de criação */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Transação</DialogTitle>
            <DialogDescription>
              Registre uma entrada ou saída manualmente
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select
                value={formData.type}
                onValueChange={(value: TransactionType) => setFormData({ 
                  ...formData, 
                  type: value,
                  category_id: '' 
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">
                    <span className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-success" />
                      Entrada
                    </span>
                  </SelectItem>
                  <SelectItem value="saida">
                    <span className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-destructive" />
                      Saída
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ex: Pagamento de fornecedor"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={formData.transaction_date}
                  onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Categoria</Label>
                  <Link to="/financeiro/categorias" className="text-xs text-muted-foreground hover:underline">
                    Gerenciar categorias
                  </Link>
                </div>
                <Select
                  value={formData.category_id || undefined}
                  onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                  disabled={availableCategories.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        categoriesLoading
                          ? 'Carregando...'
                          : availableCategories.length === 0
                            ? 'Cadastre categorias'
                            : 'Selecione a categoria'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Método de Pagamento</Label>
                <Select
                  value={formData.payment_method}
                  onValueChange={(value: PaymentMethod) => setFormData({ ...formData, payment_method: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notas adicionais..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <LoadingButton
              onClick={handleSubmit}
              loading={createTransaction.isPending}
              className={formData.type === 'entrada' ? 'bg-success hover:bg-success/90' : ''}
            >
              Registrar
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Excluir Transação"
        description={`Tem certeza que deseja excluir "${deletingItem?.description || 'esta transação'}"? Esta ação não pode ser desfeita.`}
        onConfirm={handleConfirmDelete}
        variant="danger"
        loading={isDeleting}
      />

      {/* Dialog de edição de data */}
      <Dialog open={editDateDialogOpen} onOpenChange={setEditDateDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Alterar Data da Transação</DialogTitle>
            <DialogDescription>
              {editingItem?.description}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nova Data *</Label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmEditDate}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}


