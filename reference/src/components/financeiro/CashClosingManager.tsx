import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Eye, CheckCircle, AlertTriangle, Wallet, CreditCard, Smartphone, Banknote } from 'lucide-react';
// TODO: Implementar hooks do sistema financeiro antigo ou migrar para novo sistema
// import { useCashClosings } from '@/hooks/useFinanceiro';
import { CashClosingFormData } from '@/types/financial';
import { currencyFormatters, dateFormatters } from '@/utils/formatters';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { LoadingButton } from '@/components/LoadingButton';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface CashClosingManagerProps {
  month?: string;
}

const OPENING_AMOUNT = 150.00; // Valor fixo de abertura

export function CashClosingManager({ month }: CashClosingManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewingClosing, setViewingClosing] = useState<any>(null);
  const { user, profile, isAdmin } = useAuth();

  // TODO: Implementar hooks do sistema financeiro antigo
  const cashClosings: any[] = [];
  const isLoading = false;
  const createCashClosing = { mutateAsync: async () => {}, isPending: false };
  const verifyCashClosing = { mutateAsync: async () => {} };

  const [formData, setFormData] = useState<CashClosingFormData>({
    closing_date: new Date().toISOString().split('T')[0],
    cash_sales: 0,
    pix_sales: 0,
    credit_card_sales: 0,
    debit_card_sales: 0,
    other_sales: 0,
    withdrawals: 0,
    supplies: 0,
    actual_cash: 0,
    notes: '',
  });

  // Calcular valores em tempo real
  const totalSales = formData.cash_sales + formData.pix_sales + formData.credit_card_sales + formData.debit_card_sales + formData.other_sales;
  const expectedCash = OPENING_AMOUNT + formData.cash_sales - formData.withdrawals + formData.supplies;
  const difference = formData.actual_cash - expectedCash;

  const handleOpenDialog = () => {
    setFormData({
      closing_date: new Date().toISOString().split('T')[0],
      cash_sales: 0,
      pix_sales: 0,
      credit_card_sales: 0,
      debit_card_sales: 0,
      other_sales: 0,
      withdrawals: 0,
      supplies: 0,
      actual_cash: OPENING_AMOUNT,
      notes: '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    await createCashClosing.mutateAsync(formData);
    setIsDialogOpen(false);
  };

  const handleVerify = async (id: string) => {
    await verifyCashClosing.mutateAsync(id);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'conferido':
        return <Badge className="bg-success/10 text-success border-success/30">Conferido</Badge>;
      case 'fechado':
        return <Badge className="bg-warning/10 text-warning border-warning/30">Aguardando Conferência</Badge>;
      default:
        return <Badge variant="outline">Aberto</Badge>;
    }
  };

  const getDifferenceColor = (diff: number | undefined) => {
    if (diff === undefined || diff === null) return '';
    if (diff === 0) return 'text-success';
    if (diff > 0) return 'text-primary';
    return 'text-destructive';
  };

  if (isLoading) {
    return <LoadingSkeleton type="table" count={5} />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Fechamento de Caixa</CardTitle>
            <CardDescription>
              Registre o fechamento diário do caixa (abertura: {currencyFormatters.brl(OPENING_AMOUNT)})
            </CardDescription>
          </div>
          <Button onClick={handleOpenDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            Fechar Caixa
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {cashClosings.length === 0 ? (
          <EmptyState
            variant="no-data"
            title="Nenhum fechamento registrado"
            description="Registre o fechamento de caixa ao final do expediente."
            action={{ label: 'Fechar Caixa', onClick: handleOpenDialog }}
          />
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Vendedor(a)</TableHead>
                  <TableHead>Total Vendas</TableHead>
                  <TableHead>Dinheiro Esperado</TableHead>
                  <TableHead>Dinheiro Real</TableHead>
                  <TableHead>Diferença</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cashClosings.map((closing) => (
                  <TableRow key={closing.id}>
                    <TableCell className="font-medium">
                      {dateFormatters.short(closing.closing_date)}
                    </TableCell>
                    <TableCell>{closing.seller_name}</TableCell>
                    <TableCell className="font-semibold text-primary">
                      {currencyFormatters.brl(closing.total_sales)}
                    </TableCell>
                    <TableCell>{currencyFormatters.brl(closing.expected_cash)}</TableCell>
                    <TableCell>{currencyFormatters.brl(closing.actual_cash || 0)}</TableCell>
                    <TableCell className={getDifferenceColor(closing.difference)}>
                      {closing.difference !== undefined && closing.difference !== null
                        ? currencyFormatters.brl(closing.difference)
                        : '-'}
                    </TableCell>
                    <TableCell>{getStatusBadge(closing.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setViewingClosing(closing)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {isAdmin && closing.status === 'fechado' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-success"
                            onClick={() => handleVerify(closing.id)}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Dialog de fechamento */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Fechamento de Caixa</DialogTitle>
            <DialogDescription>
              Preencha os valores do fechamento do dia. Abertura: {currencyFormatters.brl(OPENING_AMOUNT)}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Data */}
            <div className="space-y-2">
              <Label>Data do Fechamento</Label>
              <Input
                type="date"
                value={formData.closing_date}
                onChange={(e) => setFormData({ ...formData, closing_date: e.target.value })}
              />
            </div>

            {/* Vendas por método */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Vendas por Método de Pagamento
              </h4>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-success" />
                    Dinheiro
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.cash_sales}
                    onChange={(e) => setFormData({ ...formData, cash_sales: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-primary" />
                    PIX
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.pix_sales}
                    onChange={(e) => setFormData({ ...formData, pix_sales: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-warning" />
                    Cartão Crédito
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.credit_card_sales}
                    onChange={(e) => setFormData({ ...formData, credit_card_sales: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-accent" />
                    Cartão Débito
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.debit_card_sales}
                    onChange={(e) => setFormData({ ...formData, debit_card_sales: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Outros</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.other_sales}
                    onChange={(e) => setFormData({ ...formData, other_sales: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>

            {/* Sangrias e Suprimentos */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-destructive">Sangrias (Retiradas)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.withdrawals}
                  onChange={(e) => setFormData({ ...formData, withdrawals: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-success">Suprimentos (Entradas)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.supplies}
                  onChange={(e) => setFormData({ ...formData, supplies: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            {/* Conferência de Caixa */}
            <div className="space-y-2">
              <Label className="font-medium">Valor Real em Caixa (Dinheiro Contado)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.actual_cash}
                onChange={(e) => setFormData({ ...formData, actual_cash: parseFloat(e.target.value) || 0 })}
                className="text-lg font-bold"
              />
            </div>

            {/* Resumo */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <h4 className="font-medium mb-3">Resumo</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Total de Vendas:</span>
                <span className="font-semibold text-primary text-right">{currencyFormatters.brl(totalSales)}</span>
                
                <span className="text-muted-foreground">Abertura:</span>
                <span className="text-right">{currencyFormatters.brl(OPENING_AMOUNT)}</span>
                
                <span className="text-muted-foreground">+ Vendas em Dinheiro:</span>
                <span className="text-right">{currencyFormatters.brl(formData.cash_sales)}</span>
                
                <span className="text-muted-foreground">- Sangrias:</span>
                <span className="text-right text-destructive">{currencyFormatters.brl(formData.withdrawals)}</span>
                
                <span className="text-muted-foreground">+ Suprimentos:</span>
                <span className="text-right text-success">{currencyFormatters.brl(formData.supplies)}</span>
                
                <span className="font-medium border-t pt-2">Dinheiro Esperado:</span>
                <span className="font-bold text-right border-t pt-2">{currencyFormatters.brl(expectedCash)}</span>
                
                <span className="font-medium">Dinheiro Real:</span>
                <span className="font-bold text-right">{currencyFormatters.brl(formData.actual_cash)}</span>
                
                <span className="font-medium">Diferença:</span>
                <span className={cn("font-bold text-right", getDifferenceColor(difference))}>
                  {currencyFormatters.brl(difference)}
                  {difference !== 0 && (
                    <span className="ml-1">
                      {difference > 0 ? '(sobra)' : '(falta)'}
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Anotações sobre o fechamento..."
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
              loading={createCashClosing.isPending}
              className="bg-success hover:bg-success/90"
            >
              Fechar Caixa
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de visualização */}
      <Dialog open={!!viewingClosing} onOpenChange={() => setViewingClosing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do Fechamento</DialogTitle>
            <DialogDescription>
              {viewingClosing && dateFormatters.long(viewingClosing.closing_date)} - {viewingClosing?.seller_name}
            </DialogDescription>
          </DialogHeader>
          
          {viewingClosing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Vendas</p>
                  <p className="text-xl font-bold text-primary">{currencyFormatters.brl(viewingClosing.total_sales)}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Diferença</p>
                  <p className={cn("text-xl font-bold", getDifferenceColor(viewingClosing.difference))}>
                    {currencyFormatters.brl(viewingClosing.difference || 0)}
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dinheiro:</span>
                  <span>{currencyFormatters.brl(viewingClosing.cash_sales)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PIX:</span>
                  <span>{currencyFormatters.brl(viewingClosing.pix_sales)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cartão Crédito:</span>
                  <span>{currencyFormatters.brl(viewingClosing.credit_card_sales)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cartão Débito:</span>
                  <span>{currencyFormatters.brl(viewingClosing.debit_card_sales)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Outros:</span>
                  <span>{currencyFormatters.brl(viewingClosing.other_sales)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-muted-foreground">Sangrias:</span>
                  <span className="text-destructive">{currencyFormatters.brl(viewingClosing.withdrawals)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Suprimentos:</span>
                  <span className="text-success">{currencyFormatters.brl(viewingClosing.supplies)}</span>
                </div>
              </div>

              {viewingClosing.notes && (
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Observações:</p>
                  <p className="text-sm">{viewingClosing.notes}</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <span className="text-sm text-muted-foreground">Status:</span>
                {getStatusBadge(viewingClosing.status)}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}


