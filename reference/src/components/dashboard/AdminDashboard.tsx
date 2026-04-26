import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Building2, 
  Users, 
  DollarSign, 
  TrendingUp, 
  AlertTriangle,
  Calendar,
  CreditCard,
  BarChart3,
  RefreshCw
} from 'lucide-react';
import { useCompanyDashboard } from '@/hooks/useCompanyDashboard';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function AdminDashboard() {
  const { loading, error, getAdminOverview, getExpiringSubscriptions, getRecentPayments } = useCompanyDashboard();
  const [overview, setOverview] = useState<any>(null);
  const [expiringSubscriptions, setExpiringSubscriptions] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [overviewData, expiring, payments] = await Promise.all([
      getAdminOverview(),
      getExpiringSubscriptions(14),
      getRecentPayments(10)
    ]);

    if (overviewData) setOverview(overviewData);
    if (expiring) setExpiringSubscriptions(expiring);
    if (payments) setRecentPayments(payments);
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-500';
      case 'pending': return 'bg-yellow-500';
      case 'cancelled': return 'bg-red-500';
      case 'expired': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getPaymentStatusText = (status: string) => {
    switch (status) {
      case 'paid': return 'Pago';
      case 'pending': return 'Pendente';
      case 'cancelled': return 'Cancelado';
      case 'expired': return 'Expirado';
      default: return status;
    }
  };

  if (loading && !overview) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-500/50 bg-red-500/10">
        <CardContent className="pt-6">
          <p className="text-red-400">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!overview) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard de Revenda</h1>
          <p className="text-gray-400">Visão geral de todas as empresas</p>
        </div>
        <Button variant="outline" onClick={loadData} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </Button>
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">Total de Empresas</CardTitle>
            <Building2 className="h-5 w-5 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{overview.companies.total}</div>
            <div className="flex gap-2 mt-2 flex-wrap">
              {Object.entries(overview.companies.byStatus).map(([status, count]) => (
                <Badge key={status} variant="outline" className="text-xs">
                  {status}: {count as number}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">Receita Mensal</CardTitle>
            <DollarSign className="h-5 w-5 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              R$ {overview.revenue.monthly.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Total: R$ {overview.revenue.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-purple-500/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">Total de Usuários</CardTitle>
            <Users className="h-5 w-5 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{overview.users.total}</div>
            <p className="text-xs text-gray-400 mt-1">
              em todas as empresas
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border-yellow-500/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">Pagamentos Pendentes</CardTitle>
            <CreditCard className="h-5 w-5 text-yellow-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{overview.payments.pending.count}</div>
            <p className="text-xs text-gray-400 mt-1">
              R$ {overview.payments.pending.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
      {(overview.subscriptions.expiringSoon > 0 || overview.payments.pending.count > 0) && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
              <div>
                <h3 className="font-semibold text-yellow-500">Atenção Necessária</h3>
                <ul className="text-gray-300 text-sm mt-1 space-y-1">
                  {overview.subscriptions.expiringSoon > 0 && (
                    <li>• {overview.subscriptions.expiringSoon} assinaturas expirando nos próximos 7 dias</li>
                  )}
                  {overview.payments.pending.count > 0 && (
                    <li>• {overview.payments.pending.count} pagamentos pendentes</li>
                  )}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grid com tabelas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assinaturas expirando */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Assinaturas Expirando
            </CardTitle>
            <CardDescription>Próximos 14 dias</CardDescription>
          </CardHeader>
          <CardContent>
            {expiringSubscriptions.length === 0 ? (
              <p className="text-gray-400 text-center py-4">Nenhuma assinatura expirando</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Expira em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expiringSubscriptions.map((sub) => {
                    const daysUntil = differenceInDays(new Date(sub.expires_at), new Date());
                    return (
                      <TableRow key={sub.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-white">{sub.name}</p>
                            <p className="text-xs text-gray-400">{sub.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{sub.plan_name}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={daysUntil <= 3 ? 'bg-red-500' : daysUntil <= 7 ? 'bg-yellow-500' : 'bg-blue-500'}>
                            {daysUntil <= 0 ? 'Vencida' : `${daysUntil} dias`}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pagamentos recentes */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Pagamentos Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentPayments.length === 0 ? (
              <p className="text-gray-400 text-center py-4">Nenhum pagamento registrado</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <p className="font-medium text-white">{payment.company_name}</p>
                      </TableCell>
                      <TableCell className="text-green-400">
                        R$ {parseFloat(payment.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge className={getPaymentStatusColor(payment.status)}>
                          {getPaymentStatusText(payment.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-400">
                        {format(new Date(payment.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top planos */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Planos Mais Populares
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {overview.topPlans.map((plan: any, index: number) => (
              <div 
                key={plan.code}
                className="bg-background/50 p-4 rounded-lg text-center"
              >
                <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center text-lg font-bold ${
                  index === 0 ? 'bg-yellow-500 text-black' :
                  index === 1 ? 'bg-gray-400 text-black' :
                  index === 2 ? 'bg-orange-600 text-white' : 'bg-gray-600'
                }`}>
                  {index + 1}º
                </div>
                <h3 className="font-semibold text-white mt-2">{plan.name}</h3>
                <p className="text-gray-400 text-sm">{plan.code}</p>
                <p className="text-primary font-bold mt-1">{plan.subscriptions_count} assinaturas</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Assinaturas por status */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="text-white">Assinaturas por Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {Object.entries(overview.subscriptions.byStatus).map(([status, count]) => (
              <div 
                key={status} 
                className="flex items-center gap-2 bg-background/50 px-4 py-2 rounded-lg"
              >
                <span className={`w-3 h-3 rounded-full ${
                  status === 'active' ? 'bg-green-500' :
                  status === 'trial' ? 'bg-blue-500' :
                  status === 'past_due' ? 'bg-yellow-500' :
                  status === 'expired' ? 'bg-red-500' :
                  status === 'cancelled' ? 'bg-gray-500' : 'bg-gray-500'
                }`}></span>
                <span className="text-gray-400 capitalize">{status?.replace('_', ' ')}</span>
                <span className="font-bold text-white">{count as number}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

