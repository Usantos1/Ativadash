import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ModernLayout } from '@/components/ModernLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Plus, Search, Eye, Edit, Phone, MessageCircle, Filter,
  Clock, AlertTriangle, CheckCircle, Wrench, Package,
  Calendar, TrendingUp, Users, FileText
} from 'lucide-react';
import { useOrdensServicoSupabase as useOrdensServico } from '@/hooks/useOrdensServicoSupabase';
import { useClientesSupabase as useClientes } from '@/hooks/useClientesSupabase';
import { useMarcasModelos } from '@/hooks/useAssistencia';
import { StatusOS, STATUS_OS_LABELS, STATUS_OS_COLORS, FiltrosOS } from '@/types/assistencia';
import { currencyFormatters, dateFormatters } from '@/utils/formatters';
import { EmptyState } from '@/components/EmptyState';
import { cn } from '@/lib/utils';
import { OrdemServicoForm } from '@/components/assistencia/OrdemServicoForm';

export default function OrdensServico() {
  const navigate = useNavigate();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const { ordens, isLoading, getEstatisticas, createOS } = useOrdensServico();
  const { clientes, getClienteById } = useClientes();
  const { marcas, modelos } = useMarcasModelos();

  const stats = getEstatisticas();

  // Filtrar ordens
  const filteredOrdens = useMemo(() => {
    let result = [...ordens];

    if (statusFilter !== 'all') {
      result = result.filter(os => os.status === statusFilter);
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(os => {
        const cliente = getClienteById(os.cliente_id);
        return (
          os.numero.toString().includes(search) ||
          os.descricao_problema.toLowerCase().includes(search) ||
          cliente?.nome.toLowerCase().includes(search) ||
          cliente?.telefone?.includes(search)
        );
      });
    }

    if (dataInicio) {
      result = result.filter(os => {
        if (!os.data_entrada) return false;
        // Normalizar data_entrada para comparação (remover hora se houver)
        const osDate = os.data_entrada.split('T')[0];
        return osDate >= dataInicio;
      });
    }

    if (dataFim) {
      result = result.filter(os => {
        if (!os.data_entrada) return false;
        // Normalizar data_entrada para comparação (remover hora se houver)
        const osDate = os.data_entrada.split('T')[0];
        return osDate <= dataFim;
      });
    }

    return result.sort((a, b) => b.numero - a.numero);
  }, [ordens, statusFilter, searchTerm, dataInicio, dataFim, getClienteById]);

  // Filtros rápidos
  const hoje = new Date().toISOString().split('T')[0];
  const osHoje = ordens.filter(os => os.data_entrada === hoje);
  const osAtrasadas = ordens.filter(os => {
    if (!os.previsao_entrega) return false;
    const previsaoDate = os.previsao_entrega.split('T')[0];
    return previsaoDate < hoje && !['finalizada', 'entregue', 'cancelada'].includes(os.status);
  });
  const osEmAtraso = ordens.filter(os => {
    if (!os.previsao_entrega) return false;
    const previsaoDate = os.previsao_entrega.split('T')[0];
    return previsaoDate === hoje && !['finalizada', 'entregue', 'cancelada'].includes(os.status);
  });

  const handleWhatsApp = (telefone?: string) => {
    if (telefone) {
      const numero = telefone.replace(/\D/g, '');
      window.open(`https://wa.me/55${numero}`, '_blank');
    }
  };

  return (
    <ModernLayout title="Ordens de Serviço" subtitle="Gestão de assistência técnica">
      <div className="flex flex-col h-full overflow-hidden gap-4">
        {/* Cards de estatísticas - fixo no topo */}
        <div className="flex-shrink-0 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card className="border-l-4 border-l-blue-500 cursor-pointer hover:shadow-md" onClick={() => setStatusFilter('all')}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-blue-600 text-sm mb-1">
                <FileText className="h-4 w-4" />Total
              </div>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-yellow-500 cursor-pointer hover:shadow-md" onClick={() => setStatusFilter('aberta')}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-yellow-600 text-sm mb-1">
                <Clock className="h-4 w-4" />Abertas
              </div>
              <p className="text-2xl font-bold">{stats.abertas}</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-cyan-500 cursor-pointer hover:shadow-md" onClick={() => setStatusFilter('em_andamento')}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-cyan-600 text-sm mb-1">
                <Wrench className="h-4 w-4" />Em Andamento
              </div>
              <p className="text-2xl font-bold">{stats.emAndamento}</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500 cursor-pointer hover:shadow-md" onClick={() => setStatusFilter('aguardando_aprovacao')}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-orange-600 text-sm mb-1">
                <Package className="h-4 w-4" />Aguardando
              </div>
              <p className="text-2xl font-bold">{stats.aguardandoAprovacao}</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500 cursor-pointer hover:shadow-md" onClick={() => setStatusFilter('finalizada')}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-green-600 text-sm mb-1">
                <CheckCircle className="h-4 w-4" />Finalizadas
              </div>
              <p className="text-2xl font-bold">{stats.finalizadas}</p>
            </CardContent>
          </Card>

          {stats.atrasadas > 0 && (
            <Card className="border-l-4 border-l-red-500 bg-red-50 cursor-pointer hover:shadow-md">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-red-600 text-sm mb-1">
                  <AlertTriangle className="h-4 w-4" />Atrasadas
                </div>
                <p className="text-2xl font-bold text-red-600">{stats.atrasadas}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Filtros rápidos por prazo - fixo */}
        <div className="flex-shrink-0 flex flex-wrap gap-2">
          <Button 
            variant={statusFilter === 'all' && !dataInicio ? 'default' : 'outline'} 
            size="sm"
            onClick={() => { setStatusFilter('all'); setDataInicio(''); setDataFim(''); }}
          >
            Todas
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={() => { setDataInicio(hoje); setDataFim(hoje); }}
          >
            <Calendar className="h-4 w-4" />
            Hoje ({osHoje.length})
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2 text-yellow-600 border-yellow-300"
            onClick={() => { /* filtrar em atraso no dia */ }}
          >
            <Clock className="h-4 w-4" />
            Prazo Hoje ({osEmAtraso.length})
          </Button>
          {osAtrasadas.length > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2 text-red-600 border-red-300"
            >
              <AlertTriangle className="h-4 w-4" />
              Em Atraso ({osAtrasadas.length})
            </Button>
          )}
        </div>

        {/* Barra de ações e filtros - flex-1 para ocupar espaço restante */}
        <Card className="flex-1 flex flex-col overflow-hidden min-h-0">
          <CardHeader className="flex-shrink-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="text-lg">Lista de Ordens de Serviço</CardTitle>
              <Button onClick={() => setIsFormOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Nova OS
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col overflow-hidden min-h-0 space-y-4">
            {/* Filtros - fixo */}
            <div className="flex-shrink-0 flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nº OS, cliente, telefone ou problema..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  {Object.entries(STATUS_OS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => setShowFilters(!showFilters)}>
                <Filter className="h-4 w-4" />
              </Button>
            </div>

            {showFilters && (
              <div className="flex-shrink-0 flex flex-wrap gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="space-y-1">
                  <label className="text-sm">Data Início</label>
                  <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-auto" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm">Data Fim</label>
                  <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-auto" />
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setDataInicio(''); setDataFim(''); setStatusFilter('all'); setSearchTerm(''); }}>
                  Limpar Filtros
                </Button>
              </div>
            )}

            {/* Tabela de OS com scroll interno */}
            {filteredOrdens.length === 0 ? (
              <EmptyState
                variant="no-data"
                title="Nenhuma ordem de serviço"
                description="Cadastre uma nova OS para começar."
                action={{ label: 'Nova OS', onClick: () => setIsFormOpen(true) }}
              />
            ) : (
              <div className="flex-1 overflow-auto border rounded-lg scrollbar-thin">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">Nº OS</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Aparelho</TableHead>
                      <TableHead>Problema</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Entrada</TableHead>
                      <TableHead>Previsão</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrdens.map((os) => {
                      const cliente = getClienteById(os.cliente_id);
                      const marca = marcas.find(m => m.id === os.marca_id);
                      const modelo = modelos.find(m => m.id === os.modelo_id);
                      const isAtrasada = os.previsao_entrega && 
                        os.previsao_entrega.split('T')[0] < hoje && 
                        !['finalizada', 'entregue', 'cancelada'].includes(os.status);
                      
                      return (
                        <TableRow key={os.id} className={cn(isAtrasada && 'bg-red-50')}>
                          <TableCell className="font-bold text-primary">#{os.numero}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{cliente?.nome || 'Cliente não encontrado'}</p>
                              {cliente?.cpf_cnpj && <p className="text-xs text-muted-foreground">{cliente.cpf_cnpj}</p>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {(cliente?.telefone || os.telefone_contato) && (
                                <>
                                  <span className="text-sm">{os.telefone_contato || cliente?.telefone}</span>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6"
                                    onClick={() => handleWhatsApp(os.telefone_contato || cliente?.whatsapp || cliente?.telefone)}
                                  >
                                    <MessageCircle className="h-4 w-4 text-green-600" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{modelo?.nome || '-'}</p>
                              <p className="text-xs text-muted-foreground">{marca?.nome}</p>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            <p className="truncate">{os.descricao_problema}</p>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn('text-xs', STATUS_OS_COLORS[os.status])}>
                              {STATUS_OS_LABELS[os.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {dateFormatters.short(os.data_entrada)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {os.previsao_entrega ? (
                              <span className={cn(isAtrasada && 'text-red-600 font-medium')}>
                                {dateFormatters.short(os.previsao_entrega)}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {os.valor_total > 0 ? currencyFormatters.brl(os.valor_total) : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => navigate(`/admin/ordem-servico/${os.id}`)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => navigate(`/admin/ordem-servico/${os.id}/editar`)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de nova OS */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Ordem de Serviço</DialogTitle>
          </DialogHeader>
          <OrdemServicoForm 
            onSuccess={() => setIsFormOpen(false)}
            onCancel={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </ModernLayout>
  );
}

