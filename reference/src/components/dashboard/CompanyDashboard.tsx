import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Package, 
  ShoppingCart, 
  TrendingUp, 
  AlertTriangle,
  Calendar,
  Clock,
  CreditCard
} from 'lucide-react';
import { useCompanyDashboard } from '@/hooks/useCompanyDashboard';
import { useAuth } from '@/contexts/AuthContext';
import { format, differenceInDays, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

export function CompanyDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { loading, error, getCompanyMetrics } = useCompanyDashboard();
  const [metrics, setMetrics] = useState<any>(null);
  const [period] = useState(30);

  const companyId = user?.company_id;

  useEffect(() => {
    if (companyId) {
      loadData();
    }
  }, [companyId]);

  const loadData = async () => {
    if (!companyId) return;
    const metricsData = await getCompanyMetrics(companyId, period);
    if (metricsData) setMetrics(metricsData);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-600">Ativa</Badge>;
      case 'trial': return <Badge className="bg-blue-600">Trial</Badge>;
      case 'past_due': return <Badge className="bg-yellow-600">Vencida</Badge>;
      case 'expired': return <Badge className="bg-red-600">Expirada</Badge>;
      default: return <Badge variant="secondary">-</Badge>;
    }
  };

  const getDaysUntilExpiration = () => {
    if (!metrics?.subscription?.expires_at) return null;
    const expiresAt = new Date(metrics.subscription.expires_at);
    if (!isValid(expiresAt)) return null;
    return differenceInDays(expiresAt, new Date());
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (!isValid(date)) return '-';
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  };

  const daysUntilExpiration = getDaysUntilExpiration();

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-red-500">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) return null;

  return (
    <div className="space-y-6 overflow-auto">
      {/* Header simples */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{metrics.company.name}</h1>
          <p className="text-muted-foreground text-sm">Dashboard da empresa</p>
        </div>
        <div className="flex gap-2">
          {getStatusBadge(metrics.subscription.status)}
          {metrics.subscription.plan && (
            <Badge variant="outline">{metrics.subscription.plan}</Badge>
          )}
        </div>
      </div>

      {/* Alerta de vencimento */}
      {daysUntilExpiration !== null && daysUntilExpiration <= 7 && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              <div className="flex-1">
                <p className="text-sm">
                  {daysUntilExpiration > 0 
                    ? `Assinatura expira em ${daysUntilExpiration} dias`
                    : 'Assinatura vencida'
                  }
                </p>
              </div>
              <Button size="sm" onClick={() => navigate('/assinatura')}>
                Renovar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cards de métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Usuários
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.metrics.users.total}</div>
            <p className="text-xs text-muted-foreground">{metrics.metrics.users.active} ativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              Produtos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.metrics.products}</div>
            <p className="text-xs text-muted-foreground">cadastrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              Vendas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.metrics.sales.period_count}</div>
            <p className="text-xs text-muted-foreground">últimos {period} dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Ordens
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.metrics.orders.period}</div>
            <p className="text-xs text-muted-foreground">no período</p>
          </CardContent>
        </Card>
      </div>

      {/* Uso do plano */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Limites do Plano
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Usuários</span>
              <span>{metrics.limits.users.current} / {metrics.limits.users.max === 999999 ? '∞' : metrics.limits.users.max}</span>
            </div>
            <Progress value={metrics.limits.users.percentage} className="h-2" />
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Produtos</span>
              <span>{metrics.limits.products.current} / {metrics.limits.products.max === 999999 ? '∞' : metrics.limits.products.max}</span>
            </div>
            <Progress value={metrics.limits.products.percentage} className="h-2" />
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Ordens/mês</span>
              <span>{metrics.limits.orders.current} / {metrics.limits.orders.max === 999999 ? '∞' : metrics.limits.orders.max}</span>
            </div>
            <Progress value={metrics.limits.orders.percentage} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Detalhes da assinatura */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Assinatura
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Plano</p>
              <p className="font-medium">{metrics.subscription.plan || '-'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              {getStatusBadge(metrics.subscription.status)}
            </div>
            <div>
              <p className="text-muted-foreground">Validade</p>
              <p className="font-medium">{formatDate(metrics.subscription.expires_at)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Valor</p>
              <p className="font-medium">
                {metrics.subscription.price_monthly 
                  ? `R$ ${metrics.subscription.price_monthly.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês`
                  : '-'
                }
              </p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t flex justify-end">
            <Button variant="outline" size="sm" onClick={() => navigate('/assinatura')}>
              <CreditCard className="w-4 h-4 mr-2" />
              Gerenciar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
