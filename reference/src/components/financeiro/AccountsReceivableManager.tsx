import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Check, Search, Eye, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { currencyFormatters, dateFormatters } from '@/utils/formatters';
import { MASKED_VALUE } from '@/components/dashboard/FinancialCards';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { LoadingButton } from '@/components/LoadingButton';
import { from } from '@/integrations/db/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface AccountsReceivableManagerProps {
  month?: string;
  valuesVisible?: boolean;
}

interface AccountReceivable {
  id: string;
  cliente_id?: string;
  cliente_nome?: string;
  sale_id?: string;
  ordem_servico_id?: string;
  valor_total: number; // Campo correto da tabela
  valor_pago?: number;
  valor_restante?: number; // Campo calculado
  data_vencimento?: string;
  data_pagamento?: string;
  status: 'pendente' | 'parcial' | 'pago' | 'atrasado' | 'cancelado';
  recurring?: boolean;
  recurring_day?: number;
  parent_receivable_id?: string;
  observacoes?: string;
  created_at: string;
  updated_at?: string;
}

export function AccountsReceivableManager({ month, valuesVisible = true }: AccountsReceivableManagerProps) {
  const fmt = (n: number) => (valuesVisible ? currencyFormatters.brl(n) : MASKED_VALUE);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payingAccountId, setPayingAccountId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('pix');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [viewingAccount, setViewingAccount] = useState<AccountReceivable | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [formData, setFormData] = useState({
    cliente_nome: '',
    valor_total: 0,
    data_vencimento: new Date().toISOString().split('T')[0],
    recurring: false,
    recurring_day: undefined as number | undefined,
    observacoes: '',
  });

  const queryClient = useQueryClient();

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts-receivable', month, statusFilter],
    queryFn: async () => {
      let query = from('accounts_receivable')
        .select('*')
        .order('data_vencimento', { ascending: true });

      if (month) {
        const startDate = `${month}-01`;
        const endDate = `${month}-31`;
        query = query.gte('data_vencimento', startDate).lte('data_vencimento', endDate);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Erro ao buscar contas a receber:', error);
        return [];
      }
      return (data || []) as AccountReceivable[];
    },
  });

  const payAccount = useMutation({
    mutationFn: async ({ id, paymentMethod, paymentDate }: { id: string; paymentMethod: string; paymentDate?: string }) => {
      const account = accounts.find(a => a.id === id);
      if (!account) throw new Error('Conta não encontrada');

      const dateToUse = paymentDate || new Date().toISOString().split('T')[0];
      const { data: result, error } = await from('accounts_receivable')
        .update({
          status: 'pago',
          data_pagamento: dateToUse,
          valor_pago: account.valor_total,
          paid_at: new Date(dateToUse).toISOString(),
        })
        .eq('id', id)
        .select()
        .single()
        .execute();

      if (error) throw error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] });
      setPayDialogOpen(false);
      setPayingAccountId(null);
    },
  });

  const filteredAccounts = accounts.filter(account => {
    const matchesSearch = account.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filtro de período
    let matchesPeriod = true;
    if (periodFilter !== 'all' && account.data_vencimento) {
      const dueDate = new Date(account.data_vencimento);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (periodFilter === 'mes_atual') {
        matchesPeriod = dueDate.getMonth() === today.getMonth() && dueDate.getFullYear() === today.getFullYear();
      } else if (periodFilter === 'mes_proximo') {
        const nextMonth = new Date(today);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        matchesPeriod = dueDate.getMonth() === nextMonth.getMonth() && dueDate.getFullYear() === nextMonth.getFullYear();
      } else if (periodFilter === 'atrasadas') {
        matchesPeriod = dueDate < today && account.status !== 'pago';
      } else if (periodFilter === 'proximos_7_dias') {
        const em7dias = new Date(today);
        em7dias.setDate(em7dias.getDate() + 7);
        matchesPeriod = dueDate >= today && dueDate <= em7dias && account.status !== 'pago';
      }
    }
    
    return matchesSearch && matchesPeriod;
  });

  const ITEMS_PER_PAGE = 20;
  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / ITEMS_PER_PAGE));
  const page = Math.min(currentPage, totalPages);
  const paginatedAccounts = filteredAccounts.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  const getStatusColor = (status: string, dueDate?: string) => {
    if (status === 'pago') return 'bg-success/10 text-success border-success/30';
    if (status === 'cancelado') return 'bg-muted text-muted-foreground border-muted';
    if (status === 'parcial') return 'bg-blue-50 text-blue-600 border-blue-300';
    if (dueDate && new Date(dueDate) < new Date()) return 'bg-destructive/10 text-destructive border-destructive/30';
    return 'bg-warning/10 text-warning border-warning/30';
  };

  const totalPendente = filteredAccounts
    .filter(a => a.status === 'pendente' || a.status === 'parcial')
    .reduce((sum, a) => sum + (a.valor_restante || a.valor_total - (a.valor_pago || 0)), 0);

  const totalPago = filteredAccounts
    .filter(a => a.status === 'pago')
    .reduce((sum, a) => sum + (a.valor_pago || 0), 0);

  if (isLoading) {
    return <LoadingSkeleton type="table" count={5} />;
  }

  return (
      <Card className="overflow-hidden min-w-0">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-lg">Contas a Receber</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Gerencie os recebimentos pendentes</CardDescription>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2 min-h-[44px] sm:min-h-0 w-full sm:w-auto rounded-xl sm:rounded-md touch-manipulation shrink-0">
              <Plus className="h-4 w-4" />
              Nova Conta a Receber
            </Button>
          </div>
        </CardHeader>
      <CardContent className="space-y-4 min-w-0">
        {/* Resumo — mobile: 2 colunas */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4 min-w-0">
          <div className="p-4 rounded-lg bg-warning/10 border border-warning/30">
            <p className="text-sm text-muted-foreground">A Receber</p>
            <p className="text-xl font-bold text-warning">{fmt(totalPendente)}</p>
          </div>
          <div className="p-4 rounded-lg bg-success/10 border border-success/30">
            <p className="text-sm text-muted-foreground">Recebido</p>
            <p className="text-xl font-bold text-success">{fmt(totalPago)}</p>
          </div>
        </div>

        {/* Filtros — mobile: toque confortável */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-end gap-3 min-w-0">
          <div className="flex flex-col gap-1.5 flex-1 min-w-0 max-w-full sm:max-w-sm">
            <Label className="text-xs text-muted-foreground">Buscar</Label>
            <div className="relative min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Cliente ou ID..."
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
        </div>

        {/* Lista: mobile = cards; desktop = tabela */}
        {filteredAccounts.length === 0 ? (
          <EmptyState
            variant="no-data"
            title="Nenhuma conta a receber encontrada"
            description="As contas a receber são geradas automaticamente a partir de vendas e ordens de serviço."
          />
        ) : (
          <>
            <div className="md:hidden space-y-2 min-w-0">
              {paginatedAccounts.map((account) => (
                <div
                  key={account.id}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-card p-3 min-w-0"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{account.cliente_nome || '—'}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2">
                        <span className="font-semibold text-sm tabular-nums">{fmt(account.valor_total)}</span>
                        <span className="text-xs text-muted-foreground">{account.data_vencimento ? dateFormatters.short(account.data_vencimento) : '—'}</span>
                        <Badge className={getStatusColor(account.status, account.data_vencimento) + ' text-[10px]'}>
                          {account.status === 'parcial' ? 'Parcial' : account.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 touch-manipulation"
                        onClick={() => setViewingAccount(account)}
                        aria-label="Ver"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {(account.status === 'pendente' || account.status === 'parcial') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-success touch-manipulation"
                          onClick={() => {
                            setPayingAccountId(account.id);
                            setPayDialogOpen(true);
                          }}
                          aria-label="Receber"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block border rounded-lg overflow-x-auto min-w-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">{account.cliente_nome || '-'}</TableCell>
                      <TableCell className="font-semibold">{fmt(account.valor_total)}</TableCell>
                      <TableCell>{account.data_vencimento ? dateFormatters.short(account.data_vencimento) : '-'}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(account.status, account.data_vencimento)}>
                          {account.status === 'parcial' ? 'Parcial' : account.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setViewingAccount(account)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {(account.status === 'pendente' || account.status === 'parcial') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-success"
                              onClick={() => {
                                setPayingAccountId(account.id);
                                setPayDialogOpen(true);
                              }}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {filteredAccounts.length > ITEMS_PER_PAGE && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground order-2 sm:order-1">
                  {((page - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(page * ITEMS_PER_PAGE, filteredAccounts.length)} de {filteredAccounts.length}
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
                  <span className="text-sm font-medium px-2 tabular-nums">{page}/{totalPages}</span>
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
          </>
        )}
      </CardContent>

      {/* Dialog de pagamento */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar Recebimento</DialogTitle>
            <DialogDescription>
              Informe a data e forma de pagamento
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Data do Recebimento *</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                  <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>
              Cancelar
            </Button>
            <LoadingButton
              onClick={() => payingAccountId && payAccount.mutateAsync({ id: payingAccountId, paymentMethod, paymentDate })}
              loading={payAccount.isPending}
              className="bg-success hover:bg-success/90"
            >
              Confirmar Recebimento
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de visualização */}
      <Dialog open={!!viewingAccount} onOpenChange={() => setViewingAccount(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da Conta</DialogTitle>
          </DialogHeader>
          
          {viewingAccount && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Cliente</p>
                  <p className="font-medium">{viewingAccount.cliente_nome || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valor Total</p>
                  <p className="font-bold text-lg">{fmt(viewingAccount.valor_total)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Vencimento</p>
                  <p className="font-medium">{viewingAccount.data_vencimento ? dateFormatters.short(viewingAccount.data_vencimento) : '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={getStatusColor(viewingAccount.status, viewingAccount.data_vencimento)}>
                    {viewingAccount.status === 'parcial' ? 'Parcial' : viewingAccount.status}
                  </Badge>
                </div>
                {viewingAccount.data_pagamento && (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">Data de Pagamento</p>
                      <p className="font-medium">{dateFormatters.short(viewingAccount.data_pagamento)}</p>
                    </div>
                  </>
                )}
              </div>
              {viewingAccount.observacoes && (
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Observações:</p>
                  <p className="text-sm">{viewingAccount.observacoes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de criação */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Conta a Receber</DialogTitle>
            <DialogDescription>
              Cadastre uma nova conta a receber
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Input
                value={formData.cliente_nome}
                onChange={(e) => setFormData({ ...formData, cliente_nome: e.target.value })}
                placeholder="Nome do cliente"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor Total *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.valor_total}
                  onChange={(e) => setFormData({ ...formData, valor_total: parseFloat(e.target.value) || 0 })}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <Label>Vencimento *</Label>
                <Input
                  type="date"
                  value={formData.data_vencimento}
                  onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <input
                  type="checkbox"
                  id="recurring-receivable"
                  checked={formData.recurring}
                  onChange={(e) => setFormData({ ...formData, recurring: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                />
                <Label htmlFor="recurring-receivable" className="cursor-pointer font-medium">
                  Conta recorrente
                </Label>
              </div>
              {formData.recurring && (
                <div className="space-y-2 pl-2">
                  <Label>Dia do mês para recorrência *</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.recurring_day || ''}
                    onChange={(e) => setFormData({ ...formData, recurring_day: parseInt(e.target.value) || undefined })}
                    placeholder="Ex: 5 (dia 5 de cada mês)"
                  />
                  <p className="text-xs text-muted-foreground">
                    A conta será criada automaticamente todo mês neste dia
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Notas adicionais..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateDialogOpen(false);
              setFormData({
                cliente_nome: '',
                valor_total: 0,
                data_vencimento: new Date().toISOString().split('T')[0],
                recurring: false,
                recurring_day: undefined,
                observacoes: '',
              });
            }}>
              Cancelar
            </Button>
            <LoadingButton
              onClick={async () => {
                if (!formData.cliente_nome || !formData.valor_total || !formData.data_vencimento) {
                  return;
                }
                const { error } = await supabase
                  .from('accounts_receivable')
                  .insert({
                    cliente_nome: formData.cliente_nome,
                    valor_total: formData.valor_total,
                    data_vencimento: formData.data_vencimento,
                    recurring: formData.recurring,
                    recurring_day: formData.recurring ? formData.recurring_day : null,
                    observacoes: formData.observacoes || null,
                    status: 'pendente',
                  });
                if (error) {
                  console.error('Erro ao criar conta a receber:', error);
                  return;
                }
                queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] });
                setIsCreateDialogOpen(false);
                setFormData({
                  cliente_nome: '',
                  valor_total: 0,
                  data_vencimento: new Date().toISOString().split('T')[0],
                  recurring: false,
                  recurring_day: undefined,
                  observacoes: '',
                });
              }}
            >
              Cadastrar
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

