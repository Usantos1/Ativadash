import { Badge } from '@/components/ui/badge';
import { User, Smartphone, DollarSign, Wallet, Calendar, UserCircle } from 'lucide-react';
import { STATUS_OS_LABELS, STATUS_OS_COLORS } from '@/types/assistencia';
import { currencyFormatters, dateFormatters } from '@/utils/formatters';
import { cn } from '@/lib/utils';

interface OSSummaryHeaderProps {
  numeroOS?: number;
  clienteNome?: string;
  modeloNome?: string;
  status?: string;
  valorTotal?: number;
  valorPago?: number;
  previsaoEntrega?: string;
  tecnicoNome?: string;
}

export function OSSummaryHeader({
  numeroOS,
  clienteNome,
  modeloNome,
  status,
  valorTotal = 0,
  valorPago = 0,
  previsaoEntrega,
  tecnicoNome,
}: OSSummaryHeaderProps) {
  const statusLabel = status ? STATUS_OS_LABELS[status as keyof typeof STATUS_OS_LABELS] || status : 'N/A';
  const statusColor = status ? STATUS_OS_COLORS[status as keyof typeof STATUS_OS_COLORS] || 'bg-gray-500' : 'bg-gray-500';

  return (
    <div className="bg-white border-2 border-gray-300 rounded-xl shadow-sm px-6 py-3">
      <div className="flex items-center justify-center gap-8 flex-wrap">
        {/* OS # e Status */}
        <div className="flex items-center gap-3">
          {numeroOS && (
            <Badge variant="outline" className="text-sm font-bold px-3 py-1 bg-gray-50 border-gray-300 text-gray-700">
              OS #{numeroOS}
            </Badge>
          )}
          <Badge className={cn('text-xs font-semibold px-3 py-1 text-white', statusColor)}>
            {statusLabel}
          </Badge>
        </div>

        {/* Separador */}
        <div className="h-6 w-px bg-gray-200" />

        {/* Cliente */}
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-blue-500" />
          <span className="text-xs text-gray-500">Cliente:</span>
          <span className={cn(
            "text-sm font-semibold",
            clienteNome ? "text-gray-800" : "text-gray-400 italic"
          )}>
            {clienteNome || 'Não selecionado'}
          </span>
        </div>

        {/* Separador */}
        <div className="h-6 w-px bg-gray-200" />

        {/* Modelo */}
        <div className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-purple-500" />
          <span className="text-xs text-gray-500">Modelo:</span>
          <span className={cn(
            "text-sm font-semibold",
            modeloNome ? "text-gray-800" : "text-gray-400 italic"
          )}>
            {modeloNome || 'N/A'}
          </span>
        </div>

        {/* Separador */}
        <div className="h-6 w-px bg-gray-200" />

        {/* Total */}
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-green-500" />
          <span className="text-xs text-gray-500">Total:</span>
          <span className="text-sm font-bold text-green-600">
            {currencyFormatters.brl(valorTotal)}
          </span>
        </div>

        {/* Pago */}
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-blue-500" />
          <span className="text-xs text-gray-500">Pago:</span>
          <span className="text-sm font-bold text-blue-600">
            {currencyFormatters.brl(valorPago)}
          </span>
        </div>

        {/* Separador */}
        <div className="h-6 w-px bg-gray-200" />

        {/* Previsão */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-amber-500" />
          <span className="text-xs text-gray-500">Prev:</span>
          <span className={cn(
            "text-sm font-semibold",
            previsaoEntrega ? "text-gray-800" : "text-gray-400"
          )}>
            {previsaoEntrega ? dateFormatters.short(previsaoEntrega) : 'N/A'}
          </span>
        </div>

        {/* Técnico */}
        <div className="flex items-center gap-2">
          <UserCircle className="h-4 w-4 text-indigo-500" />
          <span className="text-xs text-gray-500">Téc:</span>
          <span className={cn(
            "text-sm font-semibold",
            tecnicoNome ? "text-gray-800" : "text-gray-400"
          )}>
            {tecnicoNome || 'N/A'}
          </span>
        </div>
      </div>
    </div>
  );
}
