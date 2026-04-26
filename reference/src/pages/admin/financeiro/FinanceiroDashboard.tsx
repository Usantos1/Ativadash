import { useNavigate, useOutletContext } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, Plus, ArrowRight, Wallet, CreditCard, FileText, BarChart3 } from 'lucide-react';
import { currencyFormatters, dateFormatters } from '@/utils/formatters';
// TODO: Implementar hooks do sistema financeiro antigo ou migrar para novo sistema
// import { useFinancialSummary, useBillsDueSoon, useFinancialTransactions, useCashClosings } from '@/hooks/useFinanceiro';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';

export function FinanceiroDashboard() {
  const navigate = useNavigate();
  const context = useOutletContext<{ startDate: string; endDate?: string; month?: string }>();
  
  // TODO: Migrar para novos hooks do sistema IA-First ou implementar hooks antigos
  // Temporariamente usando valores vazios para não quebrar o build
  const summary = {
    total_entradas: 0,
    total_saidas: 0,
    saldo: 0,
    bills_pending: 0,
    bills_overdue: 0,
  };
  const billsDueSoon: any[] = [];
  const transactions: any[] = [];
  const cashClosings: any[] = [];
  const billsLoading = false;
  const transactionsLoading = false;
  const closingsLoading = false;

  // Calcular margem líquida corretamente
  const lucroLiquido = summary.total_entradas - summary.total_saidas;
  const margemLiquida = summary.total_entradas > 0 
    ? ((lucroLiquido / summary.total_entradas) * 100) 
    : 0;

  const metrics = {
    totalEntradas: summary.total_entradas,
    totalSaidas: summary.total_saidas,
    saldo: summary.saldo,
    margemLucro: margemLiquida,
    margemLiquida: margemLiquida,
    lucroLiquido: lucroLiquido,
    contasPendentes: summary.bills_pending,
    contasAtrasadas: summary.bills_overdue,
    mediaVendasDiaria: summary.total_entradas / (new Date().getDate() || 1),
    fechamentosCaixa: cashClosings.length,
  };

  if (transactionsLoading || closingsLoading || billsLoading) {
    return <LoadingSkeleton type="cards" count={4} />;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Cards de métricas principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <Card className="border-l-4 border-l-green-500 cursor-pointer hover:shadow-md" onClick={() => navigate('/admin/financeiro/transacoes')}>
          <CardContent className="p-3 md:pt-4">
            <div className="flex items-center gap-1.5 text-green-600 text-xs md:text-sm mb-1">
              <TrendingUp className="h-3.5 w-3.5 md:h-4 md:w-4" />Entradas
            </div>
            <p className="text-lg md:text-2xl font-bold text-green-600">{currencyFormatters.brl(metrics.totalEntradas)}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500 cursor-pointer hover:shadow-md" onClick={() => navigate('/admin/financeiro/contas')}>
          <CardContent className="p-3 md:pt-4">
            <div className="flex items-center gap-1.5 text-red-600 text-xs md:text-sm mb-1">
              <TrendingDown className="h-3.5 w-3.5 md:h-4 md:w-4" />Saídas
            </div>
            <p className="text-lg md:text-2xl font-bold text-red-600">{currencyFormatters.brl(metrics.totalSaidas)}</p>
          </CardContent>
        </Card>

        <Card className={`border-l-4 cursor-pointer hover:shadow-md ${metrics.saldo >= 0 ? 'border-l-blue-500' : 'border-l-red-500'}`}>
          <CardContent className="p-3 md:pt-4">
            <div className="flex items-center gap-1.5 text-blue-600 text-xs md:text-sm mb-1">
              <Wallet className="h-3.5 w-3.5 md:h-4 md:w-4" />Saldo
            </div>
            <p className={`text-lg md:text-2xl font-bold ${metrics.saldo >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {currencyFormatters.brl(metrics.saldo)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-3 md:pt-4">
            <div className="flex items-center gap-1.5 text-purple-600 text-xs md:text-sm mb-1">
              <BarChart3 className="h-3.5 w-3.5 md:h-4 md:w-4" />Margem
            </div>
            <p className="text-lg md:text-2xl font-bold text-purple-600">{metrics.margemLiquida.toFixed(1)}%</p>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">
              {currencyFormatters.brl(metrics.lucroLiquido)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas e ações rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
        {/* Contas vencendo */}
        <Card>
          <CardHeader className="p-3 md:pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm md:text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span className="hidden sm:inline">Contas </span>Vencendo
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate('/admin/financeiro/contas')}>
                Ver <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {billsDueSoon.length === 0 ? (
              <div className="text-center py-3 text-muted-foreground text-xs md:text-sm">
                Nenhuma conta vencendo em breve
              </div>
            ) : (
              <div className="space-y-2">
                {billsDueSoon.slice(0, 4).map(bill => (
                  <div key={bill.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{bill.description}</p>
                      <p className="text-xs text-muted-foreground">{dateFormatters.short(bill.due_date)}</p>
                    </div>
                    <Badge variant="outline" className="text-yellow-600 border-yellow-300 text-xs ml-2 shrink-0">
                      {currencyFormatters.brl(bill.amount)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ações rápidas */}
        <Card>
          <CardHeader className="p-3 md:pb-3">
            <CardTitle className="text-sm md:text-base">Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="grid grid-cols-4 md:grid-cols-2 gap-2">
              <Button variant="outline" className="h-auto py-2 md:py-3 flex flex-col gap-1" onClick={() => navigate('/admin/financeiro/caixa')}>
                <DollarSign className="h-4 w-4 md:h-5 md:w-5" />
                <span className="text-[10px] md:text-xs">Caixa</span>
              </Button>
              <Button variant="outline" className="h-auto py-2 md:py-3 flex flex-col gap-1" onClick={() => navigate('/admin/financeiro/contas')}>
                <FileText className="h-4 w-4 md:h-5 md:w-5" />
                <span className="text-[10px] md:text-xs">Contas</span>
              </Button>
              <Button variant="outline" className="h-auto py-2 md:py-3 flex flex-col gap-1" onClick={() => navigate('/admin/financeiro/transacoes')}>
                <CreditCard className="h-4 w-4 md:h-5 md:w-5" />
                <span className="text-[10px] md:text-xs">Transação</span>
              </Button>
              <Button variant="outline" className="h-auto py-2 md:py-3 flex flex-col gap-1" onClick={() => navigate('/admin/financeiro/relatorios')}>
                <BarChart3 className="h-4 w-4 md:h-5 md:w-5" />
                <span className="text-[10px] md:text-xs">Relatórios</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Indicadores de saúde financeira */}
      <Card>
        <CardHeader className="p-3 md:p-4">
          <CardTitle className="text-sm md:text-base">Indicadores</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 md:p-4 md:pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
            <div className="p-2 md:p-4 bg-muted/50 rounded-lg text-center">
              <p className="text-xl md:text-3xl font-bold text-primary">{metrics.fechamentosCaixa}</p>
              <p className="text-[10px] md:text-sm text-muted-foreground">Fechamentos</p>
            </div>
            <div className="p-2 md:p-4 bg-muted/50 rounded-lg text-center">
              <p className="text-sm md:text-xl font-bold text-primary">{currencyFormatters.brl(metrics.mediaVendasDiaria)}</p>
              <p className="text-[10px] md:text-sm text-muted-foreground">Média/Dia</p>
            </div>
            <div className="p-2 md:p-4 bg-muted/50 rounded-lg text-center">
              <p className="text-xl md:text-3xl font-bold text-yellow-600">{metrics.contasPendentes}</p>
              <p className="text-[10px] md:text-sm text-muted-foreground">Pendentes</p>
            </div>
            <div className="p-2 md:p-4 bg-muted/50 rounded-lg text-center">
              <p className={`text-xl md:text-3xl font-bold ${metrics.contasAtrasadas > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {metrics.contasAtrasadas}
              </p>
              <p className="text-[10px] md:text-sm text-muted-foreground">Atrasadas</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
