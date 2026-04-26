import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingUp, Wallet, ShoppingCart, Wrench, Eye, EyeOff } from 'lucide-react';
import { DashboardFinancialData } from '@/hooks/useDashboardData';
import { currencyFormatters } from '@/utils/formatters';
import type { DashboardExecutivo } from '@/hooks/useFinanceiro';

interface FinancialCardsProps {
  data: DashboardFinancialData;
  /** KPIs do /financeiro (Receita Total, PDV, OS, Ticket) - quando preenchido, usa dados reais do financeiro */
  financeiroKpis?: DashboardExecutivo['kpis'];
  /** Exibir valores em R$ (false = ocultar como em bancos) */
  valuesVisible?: boolean;
  /** Renderizar sem grid próprio (para o pai controlar a grid; ex.: 6 cards no dashboard) */
  inline?: boolean;
  /** Cards mais compactos (menos largos) */
  compact?: boolean;
}

export const MASKED_VALUE = 'R$ •••••••';
const STORAGE_KEY = 'primecamp_dashboard_values_visible';

export function getStoredValuesVisible(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v !== 'false';
  } catch {
    return true;
  }
}

export function setStoredValuesVisible(visible: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(visible));
  } catch {}
}

/** Botão olhinho para ocultar/exibir valores em R$ (uso em /financeiro, DRE, etc.) */
export function ValuesVisibilityToggle({
  valuesVisible,
  setValuesVisible,
  className,
}: {
  valuesVisible: boolean;
  setValuesVisible: (v: boolean) => void;
  className?: string;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={`h-8 w-8 sm:h-9 sm:w-9 p-0 shrink-0 border-gray-300 dark:border-gray-600 ${className ?? ''}`}
      onClick={() => {
        const next = !valuesVisible;
        setStoredValuesVisible(next);
        setValuesVisible(next);
      }}
      title={valuesVisible ? 'Ocultar valores' : 'Exibir valores'}
      aria-label={valuesVisible ? 'Ocultar valores em reais' : 'Exibir valores em reais'}
    >
      {valuesVisible ? (
        <Eye className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-muted-foreground" />
      ) : (
        <EyeOff className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-muted-foreground" />
      )}
    </Button>
  );
}

export function FinancialCards({ data, financeiroKpis, valuesVisible = true, inline = false, compact = false }: FinancialCardsProps) {
  const cards = financeiroKpis
    ? (() => {
        const totalVendas = financeiroKpis.quantidadePDV + financeiroKpis.quantidadeOS;
        const pctPDV = financeiroKpis.totalGeral > 0 ? ((financeiroKpis.totalPDV / financeiroKpis.totalGeral) * 100).toFixed(1) : '0';
        const pctOS = financeiroKpis.totalGeral > 0 ? ((financeiroKpis.totalOS / financeiroKpis.totalGeral) * 100).toFixed(1) : '0';
        const ticketMedioTotal = totalVendas > 0 ? financeiroKpis.totalGeral / totalVendas : 0;
        return [
          {
            title: 'Receita Total',
            value: currencyFormatters.brl(financeiroKpis.totalGeral),
            subtitle: `${totalVendas} vendas`,
            subtitleWhenMasked: undefined,
            icon: DollarSign,
            color: 'bg-green-500',
          },
          {
            title: 'Vendas PDV',
            value: currencyFormatters.brl(financeiroKpis.totalPDV),
            subtitle: `${financeiroKpis.quantidadePDV} vendas (${pctPDV}%)`,
            subtitleWhenMasked: undefined,
            icon: ShoppingCart,
            color: 'bg-blue-500',
          },
          {
            title: 'Vendas OS',
            value: currencyFormatters.brl(financeiroKpis.totalOS),
            subtitle: `${financeiroKpis.quantidadeOS} vendas (${pctOS}%)`,
            subtitleWhenMasked: undefined,
            icon: Wrench,
            color: 'bg-emerald-500',
          },
          {
            title: 'Ticket Médio OS',
            value: currencyFormatters.brl(financeiroKpis.ticketMedioOS),
            subtitle: `${financeiroKpis.quantidadeOS} vendas`,
            subtitleWhenMasked: undefined,
            icon: Wrench,
            color: 'bg-emerald-500',
          },
          {
            title: 'Ticket Médio PDV',
            value: currencyFormatters.brl(financeiroKpis.ticketMedioPDV),
            subtitle: `${financeiroKpis.quantidadePDV} vendas`,
            subtitleWhenMasked: undefined,
            icon: ShoppingCart,
            color: 'bg-blue-500',
          },
          {
            title: 'Ticket Médio Total',
            value: currencyFormatters.brl(ticketMedioTotal),
            subtitle: `${totalVendas} vendas`,
            subtitleWhenMasked: undefined,
            icon: TrendingUp,
            color: 'bg-purple-500',
          },
        ];
      })()
    : [
        {
          title: 'Faturamento do Dia',
          value: currencyFormatters.brl(data.faturamentoDia),
          subtitle: `${data.vendasHoje} vendas`,
          subtitleWhenMasked: undefined,
          icon: DollarSign,
          color: 'bg-green-500',
        },
        {
          title: 'Faturamento do Mês',
          value: currencyFormatters.brl(data.faturamentoMes),
          subtitle: `${data.vendasMes} vendas`,
          subtitleWhenMasked: undefined,
          icon: TrendingUp,
          color: 'bg-blue-500',
        },
        {
          title: 'Ticket Médio',
          value: currencyFormatters.brl(data.ticketMedio),
          subtitle: 'Média por venda',
          subtitleWhenMasked: undefined,
          icon: ShoppingCart,
          color: 'bg-purple-500',
        },
        {
          title: 'Total em Caixa',
          value: currencyFormatters.brl(data.totalCaixa),
          subtitle: 'Valor disponível',
          subtitleWhenMasked: undefined,
          icon: Wallet,
          color: 'bg-orange-500',
        },
      ];

  const content = cards.map((card) => {
    const Icon = card.icon;
    const displayValue = valuesVisible ? card.value : MASKED_VALUE;
    const displaySubtitle = !valuesVisible && 'subtitleWhenMasked' in card && card.subtitleWhenMasked != null
      ? card.subtitleWhenMasked
      : card.subtitle;
    return (
      <Card
        key={card.title}
        className={`border-2 border-gray-300 dark:border-gray-600 shadow-sm hover:shadow-md transition-all min-w-0 touch-manipulation ${compact ? 'py-1 px-2 rounded-xl min-h-[72px] sm:min-h-0 sm:rounded-lg' : 'rounded-lg'}`}
      >
        <CardHeader className={`flex flex-row items-center justify-between space-y-0 ${compact ? 'pb-1 pt-2 px-2 sm:pt-2' : 'pb-2 pt-3 px-3 sm:px-4'}`}>
          <CardTitle className={`font-semibold flex items-center gap-1 sm:gap-1.5 min-w-0 ${compact ? 'text-xs sm:text-xs' : 'text-xs sm:text-sm'}`}>
            <span className={`rounded-lg flex items-center justify-center text-white flex-shrink-0 ${card.color} ${compact ? 'h-6 w-6 sm:h-7 sm:w-7' : 'h-8 w-8 sm:h-9 sm:w-9'}`}>
              <Icon className={compact ? 'h-3 w-3 sm:h-3.5 sm:w-3.5' : 'h-3.5 w-3.5 sm:h-4 sm:w-4'} />
            </span>
            <span className="truncate">{card.title}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className={compact ? 'px-2 pb-2 pt-0' : 'px-3 sm:px-4 pb-3'}>
          <div className={`font-bold tabular-nums ${compact ? 'text-sm sm:text-base' : 'text-lg sm:text-xl md:text-2xl'}`}>{displayValue}</div>
          <p className={`text-muted-foreground mt-0.5 ${compact ? 'text-[10px] sm:text-[10px]' : 'text-xs'}`}>{displaySubtitle}</p>
        </CardContent>
      </Card>
    );
  });

  if (inline) {
    return <>{content}</>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
      {content}
    </div>
  );
}


