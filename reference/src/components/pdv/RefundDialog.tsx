import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useRefunds, RefundItem } from '@/hooks/useRefunds';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, AlertTriangle, Ticket, Banknote, RotateCcw, Package, Printer } from 'lucide-react';

interface SaleItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Sale {
  id: string;
  numero?: string;
  name?: string;
  customer_id?: string;
  total: number;
  created_at: string;
  items: SaleItem[];
  payments?: any[];
}

interface RefundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: Sale | null;
  onRefundComplete?: (refund: any, voucher: any) => void;
}

const REFUND_REASONS = [
  { value: 'defeito', label: 'Produto com defeito' },
  { value: 'arrependimento', label: 'Arrependimento da compra' },
  { value: 'produto_errado', label: 'Produto errado enviado' },
  { value: 'insatisfacao', label: 'Insatisfação com o produto' },
  { value: 'duplicidade', label: 'Compra duplicada' },
  { value: 'outro', label: 'Outro motivo' },
];

export function RefundDialog({ open, onOpenChange, sale, onRefundComplete }: RefundDialogProps) {
  const { loading, createRefund } = useRefunds();
  const [step, setStep] = useState<'select' | 'confirm' | 'complete'>('select');
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
  const [reason, setReason] = useState('');
  const [reasonDetails, setReasonDetails] = useState('');
  const [refundMethod, setRefundMethod] = useState<'voucher' | 'cash' | 'original'>('voucher');
  const [selectedItems, setSelectedItems] = useState<Map<string, { quantity: number; selected: boolean }>>(new Map());
  const [notes, setNotes] = useState('');
  const [createdRefund, setCreatedRefund] = useState<any>(null);
  const [createdVoucher, setCreatedVoucher] = useState<any>(null);

  useEffect(() => {
    if (sale?.items) {
      const initialItems = new Map<string, { quantity: number; selected: boolean }>();
      sale.items.forEach(item => {
        initialItems.set(item.id, { quantity: item.quantity, selected: true });
      });
      setSelectedItems(initialItems);
    }
  }, [sale]);

  useEffect(() => {
    if (!open) {
      setStep('select');
      setRefundType('full');
      setReason('');
      setReasonDetails('');
      setRefundMethod('voucher');
      setNotes('');
      setCreatedRefund(null);
      setCreatedVoucher(null);
    }
  }, [open]);

  const handleToggleItem = (itemId: string, selected: boolean) => {
    setSelectedItems(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(itemId);
      if (current) {
        newMap.set(itemId, { ...current, selected });
      }
      return newMap;
    });
    if (!selected) {
      setRefundType('partial');
    }
  };

  const handleQuantityChange = (itemId: string, quantity: number) => {
    const item = sale?.items.find(i => i.id === itemId);
    if (!item) return;
    
    const validQuantity = Math.max(0, Math.min(quantity, item.quantity));
    setSelectedItems(prev => {
      const newMap = new Map(prev);
      newMap.set(itemId, { quantity: validQuantity, selected: validQuantity > 0 });
      return newMap;
    });
    
    if (validQuantity < item.quantity) {
      setRefundType('partial');
    }
  };

  const calculateRefundTotal = () => {
    if (!sale?.items) return 0;
    
    let total = 0;
    sale.items.forEach(item => {
      const selection = selectedItems.get(item.id);
      if (selection?.selected) {
        total += selection.quantity * item.unit_price;
      }
    });
    return total;
  };

  const getSelectedItemsForRefund = (): RefundItem[] => {
    if (!sale?.items) return [];
    
    return sale.items
      .filter(item => selectedItems.get(item.id)?.selected)
      .map(item => ({
        sale_item_id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: selectedItems.get(item.id)?.quantity || item.quantity,
        unit_price: item.unit_price,
        reason: reason,
        condition: 'novo' as const,
        return_to_stock: true
      }));
  };

  const handleSubmit = async () => {
    if (!sale) return;
    
    const items = getSelectedItemsForRefund();
    if (items.length === 0) return;
    
    const result = await createRefund({
      sale_id: sale.id,
      refund_type: refundType,
      reason,
      reason_details: reasonDetails,
      refund_method: refundMethod,
      items,
      customer_id: sale.customer_id,
      customer_name: sale.name || 'Cliente',
      notes
    });
    
    if (result) {
      setCreatedRefund(result.refund);
      setCreatedVoucher(result.voucher);
      setStep('complete');
      onRefundComplete?.(result.refund, result.voucher);
    }
  };

  const handlePrintVoucher = () => {
    if (!createdVoucher) return;

    const valorVoucher = Number(createdVoucher.current_value ?? createdVoucher.original_value ?? 0);
    const valorFormatado = valorVoucher.toFixed(2).replace('.', ',');
    const dataHoraImpressao = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });

    const printWindow = window.open('', '_blank', 'width=300,height=500');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Vale Compra</title>
        <style>
          @page { margin: 0; size: 80mm auto; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11px;
            margin: 0;
            padding: 8px;
            width: 80mm;
            max-width: 80mm;
            color: #000;
            line-height: 1.35;
          }
          .divider { border-top: 2px solid #000; margin: 6px 0; }
          .divider-dashed { border-top: 1px dashed #000; margin: 6px 0; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .empresa { font-size: 12px; font-weight: bold; text-align: center; margin-bottom: 2px; }
          .cnpj { font-size: 9px; text-align: center; margin-bottom: 4px; }
          .titulo-vale { font-size: 11px; font-weight: bold; text-align: center; margin: 8px 0 4px; }
          .code { font-size: 18px; font-weight: bold; text-align: center; margin: 8px 0; letter-spacing: 2px; }
          .value { font-size: 16px; font-weight: bold; text-align: center; margin: 8px 0; }
          .info { margin: 3px 0; }
          .label { font-weight: bold; }
          .warning { font-size: 9px; text-align: center; margin-top: 8px; line-height: 1.4; }
          .rodape { font-size: 9px; text-align: center; margin-top: 10px; line-height: 1.4; }
          .barcode { text-align: center; margin: 8px 0; font-size: 10px; letter-spacing: 1px; }
        </style>
      </head>
      <body>
        <div class="empresa">PRIME CAMP</div>
        <div class="cnpj">Assistência Técnica</div>
        <div class="cnpj">CNPJ: 31.833.574/0001-74</div>
        <div class="divider"></div>

        <div class="titulo-vale">VALE COMPRA</div>
        <div class="code">${(createdVoucher.code || '').toString()}</div>
        <div class="value">R$ ${valorFormatado}</div>
        <div class="divider-dashed"></div>

        <div class="info"><span class="label">Cliente:</span> ${(createdVoucher.customer_name || '—').toString()}</div>
        ${createdVoucher.customer_document ? `<div class="info"><span class="label">CPF/CNPJ:</span> ${createdVoucher.customer_document}</div>` : ''}
        <div class="info"><span class="label">Emissão:</span> ${format(new Date(createdVoucher.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</div>
        ${createdVoucher.expires_at ? `<div class="info"><span class="label">Validade:</span> ${format(new Date(createdVoucher.expires_at), "dd/MM/yyyy", { locale: ptBR })}</div>` : '<div class="info"><span class="label">Validade:</span> Indeterminada</div>'}

        <div class="divider-dashed"></div>
        <div class="warning">
          VALE INTRANSFERÍVEL<br>
          Uso exclusivo do titular. Apresente este comprovante para utilizar o crédito.
        </div>
        <div class="barcode">${(createdVoucher.code || '').toString()}</div>

        <div class="divider"></div>
        <div class="rodape">
          Agradecemos a preferência!<br>
          Impresso em ${dataHoraImpressao}
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const refundTotal = calculateRefundTotal();
  const allSelected = sale?.items.every(item => selectedItems.get(item.id)?.selected && selectedItems.get(item.id)?.quantity === item.quantity);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Devolução / Estorno
          </DialogTitle>
          <DialogDescription>
            {sale && (
              <span>
                Venda #{sale.numero || sale.id.slice(0, 8)} - {sale.name || 'Cliente'} - 
                {format(new Date(sale.created_at), " dd/MM/yyyy HH:mm", { locale: ptBR })}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {step === 'select' && sale && (
          <div className="space-y-4">
            {/* Seleção de itens */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base font-semibold">Itens para Devolução</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const newSelected = !allSelected;
                    sale.items.forEach(item => {
                      handleToggleItem(item.id, newSelected);
                      if (newSelected) {
                        handleQuantityChange(item.id, item.quantity);
                      }
                    });
                    setRefundType(newSelected ? 'full' : 'partial');
                  }}
                >
                  {allSelected ? 'Desmarcar Todos' : 'Selecionar Todos'}
                </Button>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-center w-28">Qtd. Original</TableHead>
                    <TableHead className="text-center w-28">Qtd. Devolver</TableHead>
                    <TableHead className="text-right">Valor Unit.</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sale.items.map((item) => {
                    const selection = selectedItems.get(item.id);
                    const isSelected = selection?.selected || false;
                    const qty = selection?.quantity || 0;
                    
                    return (
                      <TableRow key={item.id} className={!isSelected ? 'opacity-50' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleToggleItem(item.id, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            min={0}
                            max={item.quantity}
                            className="w-20 text-center mx-auto"
                            value={qty}
                            onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 0)}
                            disabled={!isSelected}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          R$ {item.unit_price.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          R$ {(qty * item.unit_price).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <Separator />

            {/* Motivo */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Motivo da Devolução *</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {REFUND_REASONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Forma de Reembolso *</Label>
                <Select value={refundMethod} onValueChange={(v) => setRefundMethod(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="voucher">
                      <div className="flex items-center gap-2">
                        <Ticket className="h-4 w-4 text-amber-500" />
                        Vale Compra
                      </div>
                    </SelectItem>
                    <SelectItem value="cash">
                      <div className="flex items-center gap-2">
                        <Banknote className="h-4 w-4 text-green-500" />
                        Dinheiro
                      </div>
                    </SelectItem>
                    <SelectItem value="original">
                      <div className="flex items-center gap-2">
                        <RotateCcw className="h-4 w-4 text-blue-500" />
                        Estorno Original
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {reason === 'outro' && (
              <div className="space-y-2">
                <Label>Detalhes do Motivo</Label>
                <Textarea
                  value={reasonDetails}
                  onChange={(e) => setReasonDetails(e.target.value)}
                  placeholder="Descreva o motivo detalhadamente"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações adicionais (opcional)"
              />
            </div>

            {/* Resumo */}
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-sm text-muted-foreground">Tipo de Devolução:</span>
                    <Badge variant={refundType === 'full' ? 'default' : 'secondary'} className="ml-2">
                      {refundType === 'full' ? 'Total' : 'Parcial'}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <span className="text-sm text-muted-foreground">Valor da Devolução:</span>
                    <div className="text-2xl font-bold">R$ {refundTotal.toFixed(2)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'complete' && createdRefund && (
          <div className="space-y-4 text-center py-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <Package className="h-8 w-8 text-green-600" />
            </div>
            
            <div>
              <h3 className="text-lg font-semibold">Devolução Registrada com Sucesso!</h3>
              <p className="text-muted-foreground">
                Número: {createdRefund.refund_number}
              </p>
            </div>

            {createdVoucher && (
              <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-center gap-2 text-amber-700">
                    <Ticket className="h-5 w-5" />
                    Vale Compra Gerado
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="text-3xl font-bold font-mono tracking-widest mb-2">
                    {createdVoucher.code}
                  </div>
                  <div className="text-2xl font-bold text-amber-700">
                    R$ {Number(createdVoucher.current_value ?? createdVoucher.original_value ?? 0).toFixed(2).replace('.', ',')}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Cliente: {createdVoucher.customer_name}
                  </p>
                  
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={handlePrintVoucher}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir Vale
                  </Button>
                </CardContent>
              </Card>
            )}

            {refundMethod === 'cash' && (
              <Card className="bg-green-50 dark:bg-green-900/20 border-green-200">
                <CardContent className="pt-4 text-center">
                  <Banknote className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Devolva <span className="font-bold text-green-600">R$ {refundTotal.toFixed(2)}</span> em dinheiro ao cliente
                  </p>
                </CardContent>
              </Card>
            )}

            {refundMethod === 'original' && (
              <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
                <CardContent className="pt-4 text-center">
                  <RotateCcw className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Processar estorno na forma de pagamento original
                  </p>
                </CardContent>
              </Card>
            )}

            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <AlertTriangle className="h-4 w-4" />
              Os produtos serão retornados ao estoque automaticamente
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'select' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading || !reason || refundTotal === 0}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirmar Devolução
              </Button>
            </>
          )}
          
          {step === 'complete' && (
            <Button onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

