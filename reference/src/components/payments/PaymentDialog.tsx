import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePayments, Payment, PixPayment } from '@/hooks/usePayments';
import { 
  Copy, 
  Check, 
  Clock, 
  AlertTriangle, 
  CheckCircle2,
  QrCode,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  subscriptionId?: string;
  amount: number;
  planName?: string;
  onPaymentConfirmed?: () => void;
}

export function PaymentDialog({ 
  open, 
  onClose, 
  companyId, 
  subscriptionId, 
  amount, 
  planName,
  onPaymentConfirmed 
}: PaymentDialogProps) {
  const { loading, error, createPixPayment, checkPaymentStatus, simulatePaymentConfirmation } = usePayments();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [pixData, setPixData] = useState<PixPayment | null>(null);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (open && !payment) {
      generatePayment();
    }
  }, [open]);

  // Verificar status periodicamente
  useEffect(() => {
    if (payment && payment.status === 'pending') {
      const interval = setInterval(async () => {
        const updated = await checkPaymentStatus(payment.id);
        if (updated && updated.status === 'paid') {
          setPayment(updated);
          toast.success('Pagamento confirmado!');
          onPaymentConfirmed?.();
          clearInterval(interval);
        }
      }, 5000); // Verificar a cada 5 segundos

      return () => clearInterval(interval);
    }
  }, [payment]);

  const generatePayment = async () => {
    const result = await createPixPayment(
      companyId,
      amount,
      subscriptionId,
      `Assinatura ${planName || 'Prime Camp'}`
    );

    if (result) {
      setPayment(result.payment);
      setPixData(result.pix);
    }
  };

  const handleCopyPixCode = () => {
    if (pixData?.code) {
      navigator.clipboard.writeText(pixData.code);
      setCopied(true);
      toast.success('Código PIX copiado!');
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleCheckStatus = async () => {
    if (!payment) return;
    setChecking(true);
    const updated = await checkPaymentStatus(payment.id);
    if (updated) {
      setPayment(updated);
      if (updated.status === 'paid') {
        toast.success('Pagamento confirmado!');
        onPaymentConfirmed?.();
      } else {
        toast.info('Aguardando pagamento...');
      }
    }
    setChecking(false);
  };

  // Simular pagamento (apenas para testes)
  const handleSimulatePayment = async () => {
    if (!payment) return;
    const result = await simulatePaymentConfirmation(payment.id);
    if (result) {
      setPayment(result);
      toast.success('Pagamento simulado com sucesso!');
      onPaymentConfirmed?.();
    }
  };

  const handleClose = () => {
    setPayment(null);
    setPixData(null);
    onClose();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-500"><Clock className="w-3 h-3 mr-1" /> Aguardando</Badge>;
      case 'paid':
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" /> Pago</Badge>;
      case 'expired':
        return <Badge className="bg-gray-500"><AlertTriangle className="w-3 h-3 mr-1" /> Expirado</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-500"><AlertTriangle className="w-3 h-3 mr-1" /> Cancelado</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            Pagamento via PIX
          </DialogTitle>
          <DialogDescription>
            {planName ? `Assinatura do plano ${planName}` : 'Realize o pagamento via PIX'}
          </DialogDescription>
        </DialogHeader>

        {loading && !payment ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <Card className="border-red-500/50 bg-red-500/10">
            <CardContent className="pt-4">
              <p className="text-red-400">{error}</p>
              <Button onClick={generatePayment} className="mt-4">
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        ) : payment?.status === 'paid' ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Pagamento Confirmado!</h3>
            <p className="text-gray-400">
              Sua assinatura foi ativada com sucesso.
            </p>
            <Button onClick={handleClose} className="mt-6">
              Fechar
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Valor */}
            <div className="text-center">
              <p className="text-gray-400">Valor a pagar</p>
              <p className="text-4xl font-bold text-green-400">
                R$ {amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>

            {/* Status */}
            <div className="flex justify-center">
              {payment && getStatusBadge(payment.status)}
            </div>

            {/* QR Code placeholder */}
            <div className="bg-white p-4 rounded-lg mx-auto w-48 h-48 flex items-center justify-center">
              <QrCode className="w-32 h-32 text-black" />
            </div>

            {/* Código PIX */}
            <div className="space-y-2">
              <Label>Código PIX Copia e Cola</Label>
              <div className="flex gap-2">
                <Input 
                  value={pixData?.code || ''} 
                  readOnly 
                  className="font-mono text-xs"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={handleCopyPixCode}
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Expiração */}
            {pixData?.expiresAt && (
              <p className="text-center text-sm text-gray-400">
                Válido até {format(new Date(pixData.expiresAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            )}

            {/* Ações */}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={handleCheckStatus}
                disabled={checking}
              >
                {checking ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Verificar Status
              </Button>
              
              {/* Botão de simulação (apenas para testes) */}
              {process.env.NODE_ENV !== 'production' && (
                <Button 
                  variant="secondary"
                  onClick={handleSimulatePayment}
                  disabled={loading}
                >
                  Simular Pagamento
                </Button>
              )}
            </div>

            <p className="text-xs text-center text-gray-500">
              O pagamento será confirmado automaticamente em alguns segundos após a transferência.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>
            {payment?.status === 'paid' ? 'Fechar' : 'Cancelar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

