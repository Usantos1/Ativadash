import { useState, useEffect } from 'react';
import { ModernLayout } from '@/components/ModernLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PaymentHistory } from '@/components/payments/PaymentHistory';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyDashboard } from '@/hooks/useCompanyDashboard';
import { 
  CreditCard, 
  Check, 
  AlertTriangle,
  Calendar
} from 'lucide-react';
import { format, differenceInDays, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Plan {
  id: string;
  name: string;
  code: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  max_users: number;
  max_products: number;
  max_orders: number;
}

export default function SubscriptionPage() {
  const { user } = useAuth();
  const { getCompanyMetrics } = useCompanyDashboard();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const companyId = user?.company_id;

  useEffect(() => {
    loadData();
  }, [companyId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Carregar planos
      const token = localStorage.getItem('auth_token');
      const response = await fetch('https://api.ativafix.com/api/query/plans', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          select: '*',
          where: { active: true },
          orderBy: { field: 'price_monthly', ascending: true }
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setPlans(data.data || []);
      }

      // Carregar métricas
      if (companyId) {
        const metricsData = await getCompanyMetrics(companyId);
        if (metricsData) setMetrics(metricsData);
      }
    } catch (error) {
      console.error('Erro ao carregar:', error);
    } finally {
      setLoading(false);
    }
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

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (!isValid(date)) return '-';
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  };

  const getDaysUntilExpiration = () => {
    if (!metrics?.subscription?.expires_at) return null;
    const expiresAt = new Date(metrics.subscription.expires_at);
    if (!isValid(expiresAt)) return null;
    return differenceInDays(expiresAt, new Date());
  };

  const daysUntilExpiration = getDaysUntilExpiration();

  if (loading) {
    return (
      <ModernLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </ModernLayout>
    );
  }

  return (
    <ModernLayout>
      <div className="p-6 space-y-6 max-w-5xl mx-auto overflow-auto">
        <div>
          <h1 className="text-2xl font-semibold">Assinatura</h1>
          <p className="text-muted-foreground text-sm">Gerencie seu plano e pagamentos</p>
        </div>

        {/* Status atual */}
        {metrics && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Sua Assinatura
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-muted-foreground text-sm">Plano</p>
                  <p className="font-semibold">{metrics.subscription.plan || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Status</p>
                  <div className="mt-1">{getStatusBadge(metrics.subscription.status)}</div>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Validade</p>
                  <p className="font-semibold">{formatDate(metrics.subscription.expires_at)}</p>
                  {daysUntilExpiration !== null && daysUntilExpiration > 0 && (
                    <p className="text-xs text-muted-foreground">
                      ({daysUntilExpiration} dias restantes)
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Valor</p>
                  <p className="font-semibold text-green-600">
                    {metrics.subscription.price_monthly 
                      ? `R$ ${metrics.subscription.price_monthly.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês`
                      : '-'
                    }
                  </p>
                </div>
              </div>

              {/* Alerta de vencimento */}
              {daysUntilExpiration !== null && daysUntilExpiration <= 7 && (
                <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  <p className="text-sm flex-1">
                    {daysUntilExpiration > 0 
                      ? `Sua assinatura expira em ${daysUntilExpiration} dias.`
                      : 'Sua assinatura está vencida.'
                    }
                  </p>
                  <Button size="sm">Renovar</Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Seletor de ciclo */}
        <div className="flex justify-center gap-2">
          <Button
            variant={billingCycle === 'monthly' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setBillingCycle('monthly')}
          >
            Mensal
          </Button>
          <Button
            variant={billingCycle === 'yearly' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setBillingCycle('yearly')}
            className="relative"
          >
            Anual
            <Badge className="absolute -top-2 -right-2 bg-green-600 text-xs px-1">
              -20%
            </Badge>
          </Button>
        </div>

        {/* Planos */}
        {plans.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const price = billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
              const isCurrentPlan = metrics?.subscription?.plan === plan.name;

              return (
                <Card key={plan.id} className={isCurrentPlan ? 'border-primary' : ''}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      {isCurrentPlan && <Badge>Atual</Badge>}
                    </div>
                    <div className="mt-2">
                      <span className="text-2xl font-bold">
                        R$ {price?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        /{billingCycle === 'yearly' ? 'ano' : 'mês'}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        Até {plan.max_users} usuários
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        Até {plan.max_products?.toLocaleString()} produtos
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        Até {plan.max_orders?.toLocaleString()} OS/mês
                      </li>
                    </ul>
                    <Button 
                      className="w-full mt-4" 
                      variant={isCurrentPlan ? 'outline' : 'default'}
                      disabled={isCurrentPlan}
                    >
                      {isCurrentPlan ? 'Plano Atual' : 'Assinar'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Histórico */}
        <PaymentHistory companyId={companyId} />
      </div>
    </ModernLayout>
  );
}
