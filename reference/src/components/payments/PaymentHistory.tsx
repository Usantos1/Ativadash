import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePayments, Payment } from '@/hooks/usePayments';
import { useAuth } from '@/contexts/AuthContext';
import { 
  CreditCard, 
  Download,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PaymentHistoryProps {
  companyId?: string;
}

export function PaymentHistory({ companyId }: PaymentHistoryProps) {
  const { user } = useAuth();
  const { loading, error, listCompanyPayments } = usePayments();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const targetCompanyId = companyId || user?.company_id;

  useEffect(() => {
    if (targetCompanyId) {
      loadPayments();
    }
  }, [targetCompanyId, pagination.page, statusFilter]);

  const loadPayments = async () => {
    if (!targetCompanyId) return;

    const result = await listCompanyPayments(targetCompanyId, {
      page: pagination.page,
      limit: pagination.limit,
      status: statusFilter === 'all' ? undefined : statusFilter
    });

    if (result) {
      setPayments(result.payments);
      setPagination(prev => ({ ...prev, total: result.pagination.total }));
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'cancelled': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'expired': return <AlertTriangle className="w-4 h-4 text-gray-500" />;
      default: return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      paid: 'bg-green-500',
      pending: 'bg-yellow-500',
      cancelled: 'bg-red-500',
      expired: 'bg-gray-500',
      failed: 'bg-red-500'
    };

    const labels: Record<string, string> = {
      paid: 'Pago',
      pending: 'Pendente',
      cancelled: 'Cancelado',
      expired: 'Expirado',
      failed: 'Falhou'
    };

    return (
      <Badge className={colors[status] || 'bg-gray-500'}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getPaymentMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      pix: 'PIX',
      credit_card: 'Cartão de Crédito',
      boleto: 'Boleto'
    };
    return methods[method] || method;
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-white flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Histórico de Pagamentos
        </CardTitle>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filtrar status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="paid">Pagos</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="cancelled">Cancelados</SelectItem>
            <SelectItem value="expired">Expirados</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <p className="text-red-400 text-center py-4">{error}</p>
        ) : payments.length === 0 ? (
          <div className="text-center py-8">
            <CreditCard className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">Nenhum pagamento encontrado</p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <div>
                        <p className="text-white">
                          {format(new Date(payment.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </p>
                        <p className="text-xs text-gray-400">
                          {format(new Date(payment.created_at), 'HH:mm', { locale: ptBR })}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-white">{payment.description || 'Assinatura'}</p>
                        {payment.plan_name && (
                          <p className="text-xs text-gray-400">Plano {payment.plan_name}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getPaymentMethodLabel(payment.payment_method)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`font-semibold ${payment.status === 'paid' ? 'text-green-400' : 'text-gray-400'}`}>
                        R$ {parseFloat(String(payment.amount)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(payment.status)}
                        {getStatusBadge(payment.status)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {payment.status === 'paid' && (
                        <Button variant="ghost" size="sm">
                          <Download className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-400">
                  {pagination.total} pagamentos no total
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page === 1}
                    onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                  >
                    Anterior
                  </Button>
                  <span className="flex items-center px-3 text-sm text-gray-400">
                    {pagination.page} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page >= totalPages}
                    onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

