import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRefunds, Voucher } from '@/hooks/useRefunds';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, Ticket, Search, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

interface VoucherPaymentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleTotal: number;
  saleId?: string;
  onVoucherApplied: (voucherId: string, amount: number, voucherCode: string) => void;
}

export function VoucherPayment({ open, onOpenChange, saleTotal, saleId, onVoucherApplied }: VoucherPaymentProps) {
  const { loading, checkVoucher, useVoucher } = useRefunds();
  const [voucherCode, setVoucherCode] = useState('');
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [error, setError] = useState('');
  const [amountToUse, setAmountToUse] = useState(0);
  const [customerDocument, setCustomerDocument] = useState('');

  const handleCheckVoucher = async () => {
    if (!voucherCode.trim()) return;
    
    setError('');
    setVoucher(null);
    
    const result = await checkVoucher(voucherCode.trim().toUpperCase());
    
    if (!result) {
      setError('Erro ao verificar vale');
      return;
    }
    
    if (!result.success) {
      setError(result.error || 'Vale inválido');
      if (result.data) {
        setVoucher(result.data);
      }
      return;
    }
    
    setVoucher(result.data);
    // Sugerir usar o valor total da venda ou o saldo do vale, o que for menor
    const currentVal = Number(result.data.current_value ?? 0);
    const totalVal = Number(saleTotal) || 0;
    setAmountToUse(Math.min(currentVal, totalVal));
  };

  const handleApplyVoucher = async () => {
    if (!voucher || !saleId) return;
    const currentVal = Number(voucher.current_value ?? 0);
    const totalVal = Number(saleTotal) || 0;

    if (amountToUse > currentVal) {
      setError('Valor maior que o saldo disponível');
      return;
    }
    
    if (amountToUse > totalVal) {
      setError('Valor maior que o total da venda');
      return;
    }
    
    if (amountToUse <= 0) {
      setError('Informe um valor válido');
      return;
    }
    
    const result = await useVoucher(voucher.id, saleId, amountToUse, customerDocument || undefined);
    
    if (result) {
      onVoucherApplied(voucher.id, amountToUse, voucher.code);
      handleClose();
    }
  };

  const handleClose = () => {
    setVoucherCode('');
    setVoucher(null);
    setError('');
    setAmountToUse(0);
    setCustomerDocument('');
    onOpenChange(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Ativo</Badge>;
      case 'used':
        return <Badge variant="secondary">Utilizado</Badge>;
      case 'expired':
        return <Badge variant="destructive">Expirado</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-amber-500" />
            Pagamento com Vale Compra
          </DialogTitle>
          <DialogDescription>
            Digite o código do vale para verificar e utilizar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Busca do vale */}
          <div className="flex gap-2">
            <div className="flex-1 space-y-2">
              <Label>Código do Vale</Label>
              <Input
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                placeholder="Ex: VC2501123456"
                className="font-mono text-lg tracking-wider"
                onKeyPress={(e) => e.key === 'Enter' && handleCheckVoucher()}
              />
            </div>
            <Button
              className="mt-8"
              onClick={handleCheckVoucher}
              disabled={loading || !voucherCode.trim()}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {/* Erro */}
          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Dados do vale */}
          {voucher && (
            <Card className={voucher.status === 'active' ? 'border-green-200 bg-green-50/50 dark:bg-green-900/10' : 'border-red-200 bg-red-50/50 dark:bg-red-900/10'}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  {getStatusBadge(voucher.status)}
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Cliente</span>
                  <span className="font-medium">{voucher.customer_name}</span>
                </div>
                
                {voucher.customer_document && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">CPF/CNPJ</span>
                    <span className="font-mono">{voucher.customer_document}</span>
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Valor Original</span>
                  <span>R$ {Number(voucher.original_value ?? 0).toFixed(2).replace('.', ',')}</span>
                </div>
                
                <div className="flex items-center justify-between text-lg">
                  <span className="font-medium">Saldo Disponível</span>
                  <span className="font-bold text-green-600">
                    R$ {Number(voucher.current_value ?? 0).toFixed(2).replace('.', ',')}
                  </span>
                </div>
                
                {voucher.expires_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Validade</span>
                    <span>{format(new Date(voucher.expires_at), 'dd/MM/yyyy', { locale: ptBR })}</span>
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Emissão</span>
                  <span>{format(new Date(voucher.created_at), 'dd/MM/yyyy', { locale: ptBR })}</span>
                </div>

                {!voucher.is_transferable && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Vale intransferível - uso exclusivo do titular
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {/* Valor a utilizar */}
          {voucher && voucher.status === 'active' && (
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between text-sm">
                <span>Total da Venda:</span>
                <span className="font-bold">R$ {Number(saleTotal).toFixed(2).replace('.', ',')}</span>
              </div>
              
              <div className="space-y-2">
                <Label>Valor a Utilizar do Vale</Label>
                <Input
                  type="number"
                  min={0}
                  max={Math.min(Number(voucher.current_value ?? 0), Number(saleTotal) || 0)}
                  step={0.01}
                  value={amountToUse}
                  onChange={(e) => setAmountToUse(parseFloat(e.target.value) || 0)}
                  className="text-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Máximo: R$ {Math.min(Number(voucher.current_value ?? 0), Number(saleTotal) || 0).toFixed(2).replace('.', ',')}
                </p>
              </div>

              {!voucher.is_transferable && voucher.customer_document && (
                <div className="space-y-2">
                  <Label>CPF/CNPJ do Cliente (para validação)</Label>
                  <Input
                    value={customerDocument}
                    onChange={(e) => setCustomerDocument(e.target.value)}
                    placeholder="Digite o CPF ou CNPJ"
                  />
                </div>
              )}

              {amountToUse > 0 && amountToUse < (Number(saleTotal) || 0) && (
                <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                  Restante a pagar: <span className="font-bold">R$ {((Number(saleTotal) || 0) - amountToUse).toFixed(2).replace('.', ',')}</span>
                </div>
              )}

              {amountToUse > 0 && amountToUse < Number(voucher.current_value ?? 0) && (
                <div className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                  Saldo restante no vale: <span className="font-bold">R$ {(Number(voucher.current_value ?? 0) - amountToUse).toFixed(2).replace('.', ',')}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          {voucher && voucher.status === 'active' && (
            <Button
              onClick={handleApplyVoucher}
              disabled={loading || amountToUse <= 0}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Aplicar R$ {Number(amountToUse).toFixed(2).replace('.', ',')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

