import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { from } from '@/integrations/db/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, Check, Search, Filter, CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { BillToPayFormData, BILL_STATUS_LABELS, EXPENSE_TYPE_LABELS, PAYMENT_METHOD_LABELS, PaymentMethod, FinancialCategory, BillToPay } from '@/types/financial';
import { currencyFormatters, dateFormatters } from '@/utils/formatters';
import { MASKED_VALUE } from '@/components/dashboard/FinancialCards';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { LoadingButton } from '@/components/LoadingButton';
import { cn } from '@/lib/utils';

interface BillsManagerProps {
  month?: string;
  startDate?: string;
  endDate?: string;
  valuesVisible?: boolean;
}

export function BillsManager({ month, startDate, endDate, valuesVisible = true }: BillsManagerProps) {
  const fmt = (n: number) => (valuesVisible ? currencyFormatters.brl(n) : MASKED_VALUE);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('all'); // all | mes_atual | mes_proximo | atrasadas | proximos_7_dias
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payingBillId, setPayingBillId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingBillId, setDeletingBillId] = useState<string | null>(null);
  const [deletingRecurringBillId, setDeletingRecurringBillId] = useState<string | null>(null);
  const [addRecurringStart, setAddRecurringStart] = useState('');
  const [addRecurringEnd, setAddRecurringEnd] = useState('');
  const [isAddingMonths, setIsAddingMonths] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Buscar todas as contas do mesmo grupo recorrente (quando editando uma conta recorrente)
  const { data: recurringGroupBills = [] } = useQuery({
    queryKey: ['bills-recurring-group', editingBill?.description, editingBill?.supplier ?? '', editingBill?.amount],
    queryFn: async () => {
      if (!editingBill?.recurring || !editingBill?.description) return [];
      try {
        const q = from('bills_to_pay')
          .select('*')
          .eq('description', editingBill.description)
          .eq('recurring', true)
          .order('due_date', { ascending: true });
        const { data, error } = await q.execute();
        if (error) throw error;
        const all = (data || []) as BillToPay[];
        const supplier = editingBill.supplier ?? '';
        return all.filter((b: BillToPay) => (b.supplier ?? '') === supplier);
      } catch (err) {
        console.warn('Erro ao buscar grupo recorrente:', err);
        return [];
      }
    },
    enabled: !!editingBill?.recurring && isDialogOpen,
  });

  // Buscar categorias financeiras (apenas tipo 'saida')
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['financial-categories', 'saida'],
    queryFn: async () => {
      try {
        const { data, error } = await from('financial_categories')
          .select('*')
          .eq('type', 'saida')
          .eq('is_active', true)
          .order('name', { ascending: true })
          .execute();
        if (error) throw error;
        return (data || []) as FinancialCategory[];
      } catch (err) {
        console.error('Erro ao buscar categorias:', err);
        return [];
      }
    },
  });

  // Buscar contas a pagar
  const { data: bills = [], isLoading: billsLoading } = useQuery({
    queryKey: ['bills-to-pay', startDate, endDate],
    queryFn: async () => {
      try {
        let q = from('bills_to_pay')
          .select('*')
          .order('due_date', { ascending: false });

        if (startDate && endDate && startDate !== '' && endDate !== '') {
          q = q.gte('due_date', startDate).lte('due_date', endDate);
        }

        const { data, error } = await q.execute();
        if (error) throw error;
        return (data || []) as BillToPay[];
      } catch (err) {
        console.error('Erro ao buscar contas a pagar:', err);
        return [];
      }
    },
  });

  const isLoading = categoriesLoading || billsLoading;

  // Mutation: Criar conta
  const createBill = useMutation({
    mutationFn: async (data: BillToPayFormData & { recurring_start?: string; recurring_end?: string }) => {
      const { recurring_start, recurring_end, recurring, recurring_day, ...billData } = data;
      
      // Limpar campos vazios (trocar '' por undefined para não enviar ao banco)
      const cleanData = Object.fromEntries(
        Object.entries(billData).filter(([_, v]) => v !== '' && v !== null).map(([k, v]) => [k, v === '' ? undefined : v])
      );
      
      // Se for recorrente, criar múltiplas contas
      if (recurring && recurring_start && recurring_end && recurring_day) {
        const [startYear, startMonth] = recurring_start.split('-').map(Number);
        const [endYear, endMonth] = recurring_end.split('-').map(Number);
        const billsToCreate = [];
        
        let year = startYear;
        let month = startMonth;
        
        // Loop seguro: gera de startMonth/startYear até endMonth/endYear
        while (year < endYear || (year === endYear && month <= endMonth)) {
          // Calcular último dia do mês corretamente
          const lastDayOfMonth = new Date(year, month, 0).getDate();
          const day = Math.min(recurring_day, lastDayOfMonth);
          
          // Construir data como string diretamente (YYYY-MM-DD) sem conversões de timezone
          const dueDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          
          billsToCreate.push({
            ...cleanData,
            due_date: dueDate,
            recurring: true,
            recurring_day: recurring_day,
            created_by: user?.id || undefined,
          });
          
          // Avançar para o próximo mês
          month++;
          if (month > 12) {
            month = 1;
            year++;
          }
        }
        
        const { data, error } = await from('bills_to_pay').insert(billsToCreate).select().execute();
        if (error) throw error;
        return data;
      } else {
        // Criar conta única
        const { data, error } = await from('bills_to_pay')
          .insert({
            ...cleanData,
            created_by: user?.id || undefined,
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills-to-pay'] });
      toast({
        title: 'Sucesso!',
        description: 'Conta cadastrada com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao cadastrar conta.',
        variant: 'destructive',
      });
    },
  });

  // Mutation: Atualizar conta
  const updateBill = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<BillToPayFormData> }) => {
      const { error } = await from('bills_to_pay')
        .update(data)
        .eq('id', id)
        .execute();
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills-to-pay'] });
      queryClient.invalidateQueries({ queryKey: ['bills-recurring-group'] });
      toast({
        title: 'Sucesso!',
        description: 'Conta atualizada com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao atualizar conta.',
        variant: 'destructive',
      });
    },
  });

  // Mutation: Pagar conta
  const payBill = useMutation({
    mutationFn: async ({ id, payment_method, payment_date }: { id: string; payment_method: PaymentMethod; payment_date?: string }) => {
      const { error } = await from('bills_to_pay')
        .update({
          status: 'pago',
          payment_date: payment_date || new Date().toISOString().split('T')[0],
          payment_method: payment_method,
          paid_by: user?.id,
        })
        .eq('id', id)
        .execute();
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills-to-pay'] });
      queryClient.invalidateQueries({ queryKey: ['paid-bills-transactions'] });
      toast({
        title: 'Sucesso!',
        description: 'Pagamento registrado com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao registrar pagamento.',
        variant: 'destructive',
      });
    },
  });

  // Mutation: Deletar conta
  const deleteBill = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await from('bills_to_pay')
        .delete()
        .eq('id', id)
        .execute();
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['bills-to-pay'] });
      queryClient.invalidateQueries({ queryKey: ['bills-recurring-group'] });
      setDeletingRecurringBillId(null);
      toast({
        title: 'Sucesso!',
        description: 'Conta excluída com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao excluir conta.',
        variant: 'destructive',
      });
    },
  });

  const [formData, setFormData] = useState<BillToPayFormData & { recurring_start?: string; recurring_end?: string }>(() => {
    const today = new Date();
    const startMonth = today.toISOString().slice(0, 7); // Mês atual (YYYY-MM)
    
    // Mês final: 12 meses depois
    const endDate = new Date(today);
    endDate.setMonth(endDate.getMonth() + 12);
    const endMonth = endDate.toISOString().slice(0, 7);
    
    return {
      description: '',
      amount: 0,
      category_id: '',
      expense_type: 'variavel',
      due_date: today.toISOString().split('T')[0],
      supplier: '',
      notes: '',
      recurring: false,
      recurring_start: startMonth,
      recurring_end: endMonth,
    };
  });

  const filteredBills = bills.filter(bill => {
    const matchesSearch = bill.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bill.supplier?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || bill.status === statusFilter;
    const matchesType = typeFilter === 'all' || bill.expense_type === typeFilter;
    const matchesCategory = categoryFilter === 'all' || bill.category_id === categoryFilter;
    
    // Filtro de período
    let matchesPeriod = true;
    if (periodFilter !== 'all') {
      const dueDate = new Date(bill.due_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (periodFilter === 'mes_atual') {
        matchesPeriod = dueDate.getMonth() === today.getMonth() && dueDate.getFullYear() === today.getFullYear();
      } else if (periodFilter === 'mes_proximo') {
        const nextMonth = new Date(today);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        matchesPeriod = dueDate.getMonth() === nextMonth.getMonth() && dueDate.getFullYear() === nextMonth.getFullYear();
      } else if (periodFilter === 'atrasadas') {
        matchesPeriod = dueDate < today && bill.status !== 'pago';
      } else if (periodFilter === 'proximos_7_dias') {
        const em7dias = new Date(today);
        em7dias.setDate(em7dias.getDate() + 7);
        matchesPeriod = dueDate >= today && dueDate <= em7dias && bill.status !== 'pago';
      }
    }
    
    return matchesSearch && matchesStatus && matchesType && matchesCategory && matchesPeriod;
  });

  const ITEMS_PER_PAGE = 20;
  const totalPages = Math.max(1, Math.ceil(filteredBills.length / ITEMS_PER_PAGE));
  const page = Math.min(currentPage, totalPages);
  const paginatedBills = filteredBills.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  // Helper para formatar data para input type="date"
  const formatDateForInput = (date: string | null | undefined): string => {
    if (!date) return new Date().toISOString().split('T')[0];
    // Se já estiver no formato yyyy-MM-dd, retorna como está
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    // Se for ISO completo, extrai apenas a data
    return date.split('T')[0];
  };

  const handleOpenDialog = (bill?: any) => {
    const today = new Date();
    const startMonth = today.toISOString().slice(0, 7);
    const endDate = new Date(today);
    endDate.setMonth(endDate.getMonth() + 12);
    const endMonth = endDate.toISOString().slice(0, 7);
    
    if (bill) {
      setEditingBill(bill);
      setFormData({
        description: bill.description,
        amount: bill.amount,
        category_id: bill.category_id || '',
        expense_type: bill.expense_type,
        due_date: formatDateForInput(bill.due_date),
        supplier: bill.supplier || '',
        notes: bill.notes || '',
        recurring: bill.recurring,
        recurring_day: bill.recurring_day,
        recurring_start: startMonth,
        recurring_end: endMonth,
      });
    } else {
      setEditingBill(null);
      setFormData({
        description: '',
        amount: 0,
        category_id: '',
        expense_type: 'variavel',
        due_date: today.toISOString().split('T')[0],
        supplier: '',
        notes: '',
        recurring: false,
        recurring_start: startMonth,
        recurring_end: endMonth,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (editingBill) {
      // Ao editar, apenas atualizar a conta (não criar recorrências)
      const { recurring_start, recurring_end, ...updateData } = formData;
      await updateBill.mutateAsync({ id: editingBill.id, data: updateData });
    } else {
      // Ao criar nova conta, pode criar recorrências se configurado
      await createBill.mutateAsync(formData);
    }
    setIsDialogOpen(false);
  };

  // Carregar uma conta do grupo recorrente no formulário para editar
  const handleEditRecurringBill = (bill: BillToPay) => {
    setEditingBill(bill);
    setFormData({
      description: bill.description,
      amount: bill.amount,
      category_id: bill.category_id || '',
      expense_type: bill.expense_type,
      due_date: formatDateForInput(bill.due_date),
      supplier: bill.supplier || '',
      notes: bill.notes || '',
      recurring: true,
      recurring_day: bill.recurring_day,
      recurring_start: new Date().toISOString().slice(0, 7),
      recurring_end: new Date().toISOString().slice(0, 7),
    });
  };

  // Adicionar novos meses à recorrência (cria contas para o período; não duplica meses existentes)
  const addRecurringMonths = useMutation({
    mutationFn: async ({ startMonth, endMonth }: { startMonth: string; endMonth: string }) => {
      if (!editingBill?.recurring || !editingBill.recurring_day) throw new Error('Conta recorrente inválida');
      const [startYear, startM] = startMonth.split('-').map(Number);
      const [endYear, endM] = endMonth.split('-').map(Number);
      const existingDates = new Set(
        recurringGroupBills.map((b) => (b.due_date || '').substring(0, 7))
      );
      const billsToCreate: any[] = [];
      let year = startYear;
      let month = startM;
      const cleanData = {
        description: editingBill.description,
        amount: editingBill.amount,
        category_id: editingBill.category_id || undefined,
        expense_type: editingBill.expense_type,
        supplier: editingBill.supplier || undefined,
        notes: editingBill.notes || undefined,
        recurring: true,
        recurring_day: editingBill.recurring_day,
        created_by: user?.id,
      };
      while (year < endYear || (year === endYear && month <= endM)) {
        const key = `${year}-${String(month).padStart(2, '0')}`;
        if (!existingDates.has(key)) {
          const lastDay = new Date(year, month, 0).getDate();
          const day = Math.min(editingBill.recurring_day, lastDay);
          const dueDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          billsToCreate.push({ ...cleanData, due_date: dueDate });
        }
        month++;
        if (month > 12) {
          month = 1;
          year++;
        }
      }
      if (billsToCreate.length === 0) {
        return { added: 0 };
      }
      const { data, error } = await from('bills_to_pay').insert(billsToCreate).select().execute();
      if (error) throw error;
      return { added: Array.isArray(data) ? data.length : 0 };
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['bills-to-pay'] });
      queryClient.invalidateQueries({ queryKey: ['bills-recurring-group'] });
      setAddRecurringStart('');
      setAddRecurringEnd('');
      const count = result?.added ?? 0;
      if (count > 0) {
        toast({ title: 'Meses adicionados!', description: `${count} parcela(s) criada(s).` });
      } else {
        toast({ title: 'Nenhum mês novo', description: 'Todos os meses desse período já existem na recorrência.', variant: 'destructive' });
      }
    },
    onError: (e: any) => {
      toast({ title: 'Erro', description: e.message || 'Erro ao adicionar meses.', variant: 'destructive' });
    },
  });

  const handleAddRecurringMonths = () => {
    if (!addRecurringStart || !addRecurringEnd) {
      toast({ title: 'Preencha mês inicial e final', variant: 'destructive' });
      return;
    }
    if (addRecurringStart > addRecurringEnd) {
      toast({ title: 'Mês inicial deve ser anterior ao final', variant: 'destructive' });
      return;
    }
    setIsAddingMonths(true);
    addRecurringMonths.mutate(
      { startMonth: addRecurringStart, endMonth: addRecurringEnd },
      { onSettled: () => setIsAddingMonths(false) }
    );
  };

  const handleDeleteRecurringBill = (bill: BillToPay) => {
    setDeletingRecurringBillId(bill.id);
  };

  const handleConfirmDeleteRecurring = async () => {
    if (deletingRecurringBillId) {
      await deleteBill.mutateAsync(deletingRecurringBillId);
      setDeletingRecurringBillId(null);
    }
  };

  const handlePayBill = async () => {
    if (payingBillId) {
      await payBill.mutateAsync({ id: payingBillId, payment_method: paymentMethod, payment_date: paymentDate });
      setPayDialogOpen(false);
      setPayingBillId(null);
      setPaymentDate(new Date().toISOString().split('T')[0]); // Reset para data atual
    }
  };

  const handleDeleteBill = async () => {
    if (deletingBillId) {
      await deleteBill.mutateAsync(deletingBillId);
      setDeleteDialogOpen(false);
      setDeletingBillId(null);
    }
  };

  const getStatusColor = (status: string, dueDate: string) => {
    if (status === 'pago') return 'bg-success/10 text-success border-success/30';
    if (status === 'cancelado') return 'bg-muted text-muted-foreground border-muted';
    if (new Date(dueDate) < new Date()) return 'bg-destructive/10 text-destructive border-destructive/30';
    return 'bg-warning/10 text-warning border-warning/30';
  };

  if (isLoading) {
    return <LoadingSkeleton type="table" count={5} />;
  }

  return (
    <Card className="overflow-hidden min-w-0">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base sm:text-lg">Contas a Pagar</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Gerencie suas despesas fixas e variáveis</CardDescription>
          </div>
          <Button onClick={() => handleOpenDialog()} className="gap-2 min-h-[44px] sm:min-h-0 rounded-xl sm:rounded-md touch-manipulation w-full sm:w-auto shrink-0">
            <Plus className="h-4 w-4" />
            Nova Conta
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 min-w-0">
        {/* Filtros — mobile: full width e toque confortável */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-end gap-3">
          <div className="flex flex-col gap-1.5 flex-1 min-w-0 max-w-full sm:max-w-sm">
            <Label className="text-xs text-muted-foreground">Buscar</Label>
            <div className="relative min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Descrição ou fornecedor..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-9 min-h-[44px] sm:min-h-0 rounded-xl sm:rounded-md touch-manipulation"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5 min-w-0">
            <Label className="text-xs text-muted-foreground">Período</Label>
            <Select value={periodFilter} onValueChange={(v) => { setPeriodFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-[180px] min-h-[44px] sm:min-h-0 rounded-xl sm:rounded-md touch-manipulation">
                <Filter className="h-4 w-4 mr-2 shrink-0" />
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos períodos</SelectItem>
                <SelectItem value="mes_atual">Mês atual</SelectItem>
                <SelectItem value="mes_proximo">Próximo mês</SelectItem>
                <SelectItem value="proximos_7_dias">Próximos 7 dias</SelectItem>
                <SelectItem value="atrasadas">Atrasadas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 min-w-0">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-[150px] min-h-[44px] sm:min-h-0 rounded-xl sm:rounded-md touch-manipulation">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 min-w-0">
            <Label className="text-xs text-muted-foreground">Tipo</Label>
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-[150px] min-h-[44px] sm:min-h-0 rounded-xl sm:rounded-md touch-manipulation">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="fixa">Fixa</SelectItem>
                <SelectItem value="variavel">Variável</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 min-w-0">
            <Label className="text-xs text-muted-foreground">Categoria</Label>
            <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-[180px] min-h-[44px] sm:min-h-0 rounded-xl sm:rounded-md touch-manipulation">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Lista: mobile = cards; desktop = tabela */}
        {filteredBills.length === 0 ? (
          <EmptyState
            variant="no-data"
            title="Nenhuma conta encontrada"
            description="Cadastre suas contas a pagar para controlar seus vencimentos."
            action={{ label: 'Nova Conta', onClick: () => handleOpenDialog() }}
          />
        ) : (
          <>
            {/* Mobile: cards compactos */}
            <div className="md:hidden space-y-2 min-w-0">
              {paginatedBills.map((bill) => (
                <div
                  key={bill.id}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-card p-3 min-w-0"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{bill.description}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{bill.supplier || '—'}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2">
                        <span className="font-semibold text-sm tabular-nums">{fmt(bill.amount)}</span>
                        <span className="text-xs text-muted-foreground">{dateFormatters.short(bill.due_date)}</span>
                        <Badge variant="outline" className="text-[10px]">{EXPENSE_TYPE_LABELS[bill.expense_type]}</Badge>
                        <Badge className={getStatusColor(bill.status, bill.due_date) + ' text-[10px]'}>
                          {BILL_STATUS_LABELS[bill.status]}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {bill.status === 'pendente' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-success touch-manipulation"
                          onClick={() => {
                            setPayingBillId(bill.id);
                            setPayDialogOpen(true);
                          }}
                          aria-label="Pagar"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 touch-manipulation"
                        onClick={() => handleOpenDialog(bill)}
                        aria-label="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive touch-manipulation"
                        onClick={() => {
                          setDeletingBillId(bill.id);
                          setDeleteDialogOpen(true);
                        }}
                        aria-label="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop: tabela com scroll horizontal se necessário */}
            <div className="hidden md:block border rounded-lg overflow-x-auto min-w-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedBills.map((bill) => (
                    <TableRow key={bill.id}>
                      <TableCell className="font-medium">{bill.description}</TableCell>
                      <TableCell className="text-muted-foreground">{bill.supplier || '-'}</TableCell>
                      <TableCell className="font-semibold">{fmt(bill.amount)}</TableCell>
                      <TableCell>{dateFormatters.short(bill.due_date)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{EXPENSE_TYPE_LABELS[bill.expense_type]}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(bill.status, bill.due_date)}>
                          {BILL_STATUS_LABELS[bill.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {bill.status === 'pendente' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-success"
                              onClick={() => {
                                setPayingBillId(bill.id);
                                setPayDialogOpen(true);
                              }}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleOpenDialog(bill)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => {
                              setDeletingBillId(bill.id);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {/* Paginação — mobile: toque confortável */}
        {filteredBills.length > ITEMS_PER_PAGE && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t min-w-0">
            <p className="text-xs sm:text-sm text-muted-foreground order-2 sm:order-1">
              {((page - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(page * ITEMS_PER_PAGE, filteredBills.length)} de {filteredBills.length}
            </p>
            <div className="flex items-center justify-center gap-2 order-1 sm:order-2">
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px] sm:min-h-0 rounded-xl sm:rounded-md touch-manipulation"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
              <span className="text-sm font-medium px-2 tabular-nums">
                {page}/{totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px] sm:min-h-0 rounded-xl sm:rounded-md touch-manipulation"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Próxima
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Dialog de criação/edição */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{editingBill ? 'Editar Conta' : 'Nova Conta a Pagar'}</DialogTitle>
            <DialogDescription>
              {editingBill ? 'Atualize os dados da conta' : 'Cadastre uma nova despesa'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 overflow-y-auto flex-1 pr-2" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.2) transparent' }}>
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ex: Conta de luz"
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
                <Label>Vencimento *</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
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
                  value={formData.category_id || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, category_id: value === 'none' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={categories.length === 0 ? "Nenhuma categoria disponível" : "Selecione"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {categoriesLoading ? (
                      <SelectItem value="loading" disabled>Carregando categorias...</SelectItem>
                    ) : (
                      categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {categories.length === 0 && !categoriesLoading && (
                  <p className="text-xs text-muted-foreground">
                    Categorias serão carregadas automaticamente após aplicar as migrations do banco de dados.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Tipo de Despesa</Label>
                <Select
                  value={formData.expense_type}
                  onValueChange={(value: any) => setFormData({ ...formData, expense_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixa">Fixa</SelectItem>
                    <SelectItem value="variavel">Variável</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Fornecedor</Label>
              <Input
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                placeholder="Nome do fornecedor"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <input
                  type="checkbox"
                  id="recurring"
                  checked={formData.recurring}
                  onChange={(e) => setFormData({ ...formData, recurring: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                />
                <Label htmlFor="recurring" className="cursor-pointer font-medium">
                  Conta recorrente (criar múltiplas)
                </Label>
              </div>
              {formData.recurring && (
                <div className="space-y-3 pl-2 border-l-2 border-primary/20">
                  <div>
                    <Label>Dia do mês para recorrência *</Label>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={formData.recurring_day || ''}
                      onChange={(e) => setFormData({ ...formData, recurring_day: parseInt(e.target.value) || undefined })}
                      placeholder="Ex: 28 (dia 28 de cada mês)"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Mês Inicial *</Label>
                      <Input
                        type="month"
                        value={formData.recurring_start || ''}
                        onChange={(e) => setFormData({ ...formData, recurring_start: e.target.value })}
                        placeholder="2025-01"
                      />
                    </div>
                    <div>
                      <Label>Mês Final *</Label>
                      <Input
                        type="month"
                        value={formData.recurring_end || ''}
                        onChange={(e) => setFormData({ ...formData, recurring_end: e.target.value })}
                        placeholder="2025-12"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Serão criadas contas para cada mês entre o período selecionado
                  </p>
                </div>
              )}
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

            {/* Lista de contas do grupo recorrente (ao editar uma conta recorrente) */}
            {editingBill?.recurring && recurringGroupBills.length > 0 && (
              <div className="space-y-3 border-t pt-4 mt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Label className="text-base font-semibold">Contas desta recorrência ({recurringGroupBills.length})</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Edite a parcela desejada, exclua meses errados ou adicione novos meses abaixo.
                    </p>
                  </div>
                  {/* Adicionar meses */}
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="month"
                        value={addRecurringStart}
                        onChange={(e) => setAddRecurringStart(e.target.value)}
                        placeholder="Mês inicial"
                        className="w-[140px]"
                      />
                      <span className="text-muted-foreground">até</span>
                      <Input
                        type="month"
                        value={addRecurringEnd}
                        onChange={(e) => setAddRecurringEnd(e.target.value)}
                        placeholder="Mês final"
                        className="w-[140px]"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={handleAddRecurringMonths}
                      disabled={isAddingMonths || !addRecurringStart || !addRecurringEnd}
                    >
                      <CalendarPlus className="h-4 w-4" />
                      {addRecurringMonths.isPending ? 'Adicionando...' : 'Adicionar meses'}
                    </Button>
                  </div>
                </div>
                <div className="border rounded-lg overflow-hidden max-h-[280px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vencimento</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right w-32">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recurringGroupBills.map((bill) => (
                        <TableRow
                          key={bill.id}
                          className={cn(editingBill?.id === bill.id && 'bg-primary/5 border-l-2 border-l-primary')}
                        >
                          <TableCell>{dateFormatters.short(bill.due_date)}</TableCell>
                          <TableCell className="text-right font-medium">{fmt(bill.amount)}</TableCell>
                          <TableCell>
                            <Badge className={cn(
                              bill.status === 'pago' && 'bg-success/10 text-success border-success/30',
                              bill.status === 'pendente' && 'bg-warning/10 text-warning border-warning/30',
                              bill.status === 'atrasado' && 'bg-destructive/10 text-destructive border-destructive/30'
                            )}>
                              {BILL_STATUS_LABELS[bill.status as keyof typeof BILL_STATUS_LABELS] ?? bill.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1"
                                onClick={() => handleEditRecurringBill(bill)}
                              >
                                <Edit className="h-3.5 w-3.5" />
                                Editar
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteRecurringBill(bill)}
                                title="Excluir esta parcela"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {/* Confirmação de exclusão de parcela */}
                <ConfirmDialog
                  open={deletingRecurringBillId !== null}
                  onOpenChange={(open) => !open && setDeletingRecurringBillId(null)}
                  title="Excluir parcela"
                  description="Esta parcela será removida da recorrência. A ação não pode ser desfeita."
                  onConfirm={handleConfirmDeleteRecurring}
                  variant="danger"
                  loading={deleteBill.isPending}
                />
              </div>
            )}
          </div>

          <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <LoadingButton
              onClick={handleSubmit}
              loading={createBill.isPending || updateBill.isPending}
            >
              {editingBill ? 'Atualizar' : 'Cadastrar'}
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de pagamento */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar Pagamento</DialogTitle>
            <DialogDescription>
              Informe a data e forma de pagamento
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Data do Pagamento *</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select value={paymentMethod} onValueChange={(v: PaymentMethod) => setPaymentMethod(v)}>
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>
              Cancelar
            </Button>
            <LoadingButton
              onClick={handlePayBill}
              loading={payBill.isPending}
              className="bg-success hover:bg-success/90"
            >
              Confirmar Pagamento
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de exclusão */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Excluir Conta"
        description="Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita."
        onConfirm={handleDeleteBill}
        variant="danger"
      />
    </Card>
  );
}


