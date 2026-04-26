import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { OrdemServico } from '@/types/assistencia';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Smartphone, User, Calendar, Clock, DollarSign, CheckCircle2, XCircle, AlertCircle, Wrench, Package } from 'lucide-react';
import { dateFormatters, currencyFormatters } from '@/utils/formatters';
import { STATUS_OS_LABELS, STATUS_OS_COLORS } from '@/types/assistencia';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.ativafix.com/api';

export default function AcompanharOS() {
  const { id } = useParams<{ id: string }>();
  const [os, setOS] = useState<OrdemServico | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('ID da OS não fornecido');
      setLoading(false);
      return;
    }

    loadOS();
  }, [id]);

  const loadOS = async () => {
    try {
      setLoading(true);
      setError(null);

      // API pública: qualquer pessoa com o link (ex.: QR code) pode ver o status sem login
      const res = await fetch(`${API_URL}/public/acompanhar-os/${id}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const rawError = json.error || 'Ordem de Serviço não encontrada';
        const message = (typeof rawError === 'string' && (rawError.includes('operadora') || rawError.includes('column')))
          ? 'Serviço temporariamente indisponível. Tente novamente mais tarde.'
          : rawError;
        setError(message);
        setLoading(false);
        return;
      }
      const osData = json.data;
      if (!osData) {
        setError('Ordem de Serviço não encontrada');
        setLoading(false);
        return;
      }
      setOS(osData as OrdemServico);
    } catch (err: any) {
      console.error('Erro ao carregar OS:', err);
      setError(err.message || 'Erro ao carregar a Ordem de Serviço');
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (status: string) => {
    const label = STATUS_OS_LABELS[status as keyof typeof STATUS_OS_LABELS] || status;
    const color = STATUS_OS_COLORS[status as keyof typeof STATUS_OS_COLORS] || 'bg-gray-500';
    return { label, color };
  };

  if (loading) {
    return (
      <div className="min-h-screen max-h-[100dvh] bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-4 overflow-y-auto">
        <Card className="max-w-md w-full">
          <CardContent className="p-12 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-green-600" />
            <p className="text-muted-foreground">Carregando informações da OS...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !os) {
    return (
      <div className="min-h-screen max-h-[100dvh] bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-4 overflow-y-auto">
        <Card className="max-w-md w-full border-2 border-red-300">
          <CardContent className="p-12 text-center">
            <XCircle className="h-12 w-12 mx-auto mb-4 text-red-600" />
            <h2 className="text-xl font-bold mb-2">OS não encontrada</h2>
            <p className="text-muted-foreground">{error || 'A Ordem de Serviço não foi encontrada.'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusInfo = getStatusInfo(os.status);

  return (
    <div className="min-h-screen h-screen max-h-[100dvh] flex flex-col overflow-hidden bg-gradient-to-br from-green-50 to-green-100">
      <div className="flex-1 min-h-0 max-h-full overflow-y-auto overflow-x-hidden py-8 px-4 [-webkit-overflow-scrolling:touch] overscroll-contain">
        <div className="max-w-4xl mx-auto space-y-6 pb-8">
        {/* Header */}
        <Card className="border-2 border-green-300 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-t-lg">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl md:text-3xl">Ordem de Serviço #{os.numero}</CardTitle>
                <p className="text-green-100 text-sm mt-1">Acompanhe o status do seu aparelho</p>
              </div>
              <Badge className={`${statusInfo.color} text-white text-lg px-4 py-2`}>
                {statusInfo.label}
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Informações do Aparelho */}
        <Card className="border-2 border-gray-300">
          <CardHeader className="bg-gray-50 border-b-2 border-gray-200">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Smartphone className="h-5 w-5 text-blue-600" />
              Informações do Aparelho
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Cliente</p>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <p className="font-semibold">{os.cliente_nome || 'Não informado'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Marca</p>
                  <p className="font-medium">{os.marca_nome || 'Não informado'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Modelo</p>
                  <p className="font-medium">{os.modelo_nome || 'Não informado'}</p>
                </div>
                {os.imei && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">IMEI</p>
                    <p className="font-mono text-sm">{os.imei}</p>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                {os.cor && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Cor</p>
                    <p className="font-medium">{os.cor}</p>
                  </div>
                )}
                {os.numero_serie && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Nº Série</p>
                    <p className="font-mono text-sm">{os.numero_serie}</p>
                  </div>
                )}
                {os.operadora && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Operadora</p>
                    <p className="font-medium">{os.operadora}</p>
                  </div>
                )}
                {os.descricao_problema && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Problema Relatado</p>
                    <p className="text-sm">{os.descricao_problema}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status e Progresso */}
        <Card className="border-2 border-gray-300">
          <CardHeader className="bg-gray-50 border-b-2 border-gray-200">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5 text-purple-600" />
              Status e Progresso
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${statusInfo.color} text-white`}>
                    <Wrench className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status Atual</p>
                    <p className="font-bold text-lg">{statusInfo.label}</p>
                  </div>
                </div>
                {os.status === 'finalizada' && (
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                )}
                {os.status === 'cancelada' && (
                  <XCircle className="h-8 w-8 text-red-600" />
                )}
                {os.status !== 'finalizada' && os.status !== 'cancelada' && (
                  <AlertCircle className="h-8 w-8 text-yellow-600" />
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">Data de Entrada</p>
                    <p className="font-semibold">{dateFormatters.short(os.data_entrada)}</p>
                  </div>
                </div>
                {os.previsao_entrega && (
                  <div className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg">
                    <Clock className="h-5 w-5 text-orange-600" />
                    <div>
                      <p className="text-xs text-muted-foreground">Previsão de Entrega</p>
                      <p className="font-semibold">{dateFormatters.short(os.previsao_entrega)}</p>
                    </div>
                  </div>
                )}
                {os.valor_total && (
                  <div className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg md:col-span-2">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-xs text-muted-foreground">Valor Total</p>
                      <p className="font-bold text-xl text-green-600">{currencyFormatters.brl(os.valor_total)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Observações */}
        {os.observacoes && (
          <Card className="border-2 border-gray-300">
            <CardHeader className="bg-gray-50 border-b-2 border-gray-200">
              <CardTitle className="text-lg">Observações</CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              <p className="text-sm whitespace-pre-wrap">{os.observacoes}</p>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <Card className="border-2 border-gray-300 bg-white/80">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">
              Para mais informações, entre em contato conosco através do WhatsApp ou telefone.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Prime Camp Assistência Técnica
            </p>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}

