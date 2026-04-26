import { useEffect, useMemo, useState } from 'react';
import { ModernLayout } from '@/components/ModernLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar, Download, TrendingUp, DollarSign, ShoppingCart, 
  User, BarChart3, Wrench, Package
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useSalesSummary, useTechnicianProductivity, ReportFilters } from '@/hooks/useReports';
import { useCargos } from '@/hooks/useCargos';
import { currencyFormatters, dateFormatters } from '@/utils/formatters';
import { PAYMENT_METHOD_LABELS } from '@/types/pdv';

export default function Relatorios() {
  // Filtros
  const [startDate, setStartDate] = useState<Date | undefined>(
    new Date(new Date().setDate(new Date().getDate() - 30))
  );
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [technicianId, setTechnicianId] = useState<string>('all');
  const [saleOrigin, setSaleOrigin] = useState<'PDV' | 'OS' | 'all'>('all');
  const [paymentMethod, setPaymentMethod] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'summary' | 'productivity'>('summary');

  // Preparar filtros para os hooks
  const filters: ReportFilters = useMemo(() => ({
    startDate: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
    endDate: endDate ? format(endDate, 'yyyy-MM-dd') : undefined,
    technicianId: technicianId !== 'all' ? technicianId : undefined,
    saleOrigin: saleOrigin !== 'all' ? saleOrigin : undefined,
    paymentMethod: paymentMethod !== 'all' ? paymentMethod : undefined,
  }), [startDate, endDate, technicianId, saleOrigin, paymentMethod]);

  // Buscar dados
  const { data: summary, isLoading: isLoadingSummary } = useSalesSummary(filters);
  const { data: productivity, isLoading: isLoadingProductivity } = useTechnicianProductivity(filters);
  const { tecnicos, isLoading: isLoadingTecnicos } = useCargos();

  // Opções de formas de pagamento
  const paymentMethods = [
    { value: 'all', label: 'Todas' },
    { value: 'dinheiro', label: PAYMENT_METHOD_LABELS.dinheiro },
    { value: 'pix', label: PAYMENT_METHOD_LABELS.pix },
    { value: 'debito', label: PAYMENT_METHOD_LABELS.debito },
    { value: 'credito', label: PAYMENT_METHOD_LABELS.credito },
    { value: 'link_pagamento', label: PAYMENT_METHOD_LABELS.link_pagamento },
    { value: 'carteira_digital', label: PAYMENT_METHOD_LABELS.carteira_digital },
    { value: 'fiado', label: PAYMENT_METHOD_LABELS.fiado },
  ];

  const isLoading = isLoadingSummary || isLoadingProductivity;

  return (
    <ModernLayout title="Relatórios" subtitle="Relatórios de vendas e produtividade">
      <div className="flex flex-col h-full overflow-hidden gap-2 md:gap-3">
        {/* Filtros */}
        <Card className="border-2 border-gray-300 rounded-xl shadow-sm">
          <CardContent className="p-3 md:p-4">
            <div className="space-y-3">
              {/* Mobile: Filtros compactos em grid 2x2 */}
              <div className="md:hidden grid grid-cols-2 gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 text-xs justify-start border-2 border-gray-300">
                      <Calendar className="h-3 w-3 mr-1" />
                      {startDate ? format(startDate, "dd/MM", { locale: ptBR }) : "Início"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent mode="single" selected={startDate} onSelect={setStartDate} initialFocus locale={ptBR} />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 text-xs justify-start border-2 border-gray-300">
                      <Calendar className="h-3 w-3 mr-1" />
                      {endDate ? format(endDate, "dd/MM", { locale: ptBR }) : "Fim"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent mode="single" selected={endDate} onSelect={setEndDate} initialFocus locale={ptBR} />
                  </PopoverContent>
                </Popover>
                <Select value={saleOrigin} onValueChange={(v: 'PDV' | 'OS' | 'all') => setSaleOrigin(v)}>
                  <SelectTrigger className="h-9 text-xs border-2 border-gray-300">
                    <SelectValue placeholder="Origem" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="PDV">PDV</SelectItem>
                    <SelectItem value="OS">OS</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="h-9 text-xs border-2 border-gray-300">
                    <SelectValue placeholder="Pagamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map(method => (
                      <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Desktop: Filtros em linha */}
              <div className="hidden md:grid grid-cols-5 gap-3 items-end">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Data Início</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-10 border-2 border-gray-300", !startDate && "text-muted-foreground")}>
                        <Calendar className="mr-2 h-4 w-4" />
                        <span className="truncate">{startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : "Data"}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent mode="single" selected={startDate} onSelect={setStartDate} initialFocus locale={ptBR} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Data Fim</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-10 border-2 border-gray-300", !endDate && "text-muted-foreground")}>
                        <Calendar className="mr-2 h-4 w-4" />
                        <span className="truncate">{endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : "Data"}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent mode="single" selected={endDate} onSelect={setEndDate} initialFocus locale={ptBR} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Origem</Label>
                  <Select value={saleOrigin} onValueChange={(v: 'PDV' | 'OS' | 'all') => setSaleOrigin(v)}>
                    <SelectTrigger className="h-10 border-2 border-gray-300">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="PDV">PDV</SelectItem>
                      <SelectItem value="OS">OS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Técnico</Label>
                  <Select value={technicianId} onValueChange={setTechnicianId} disabled={isLoadingTecnicos}>
                    <SelectTrigger className="h-10 border-2 border-gray-300">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {tecnicos.map(tec => (
                        <SelectItem key={tec.id} value={tec.id}>{tec.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Forma de Pagamento</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="h-10 border-2 border-gray-300">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map(method => (
                        <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Conteúdo com Tabs */}
        <div className="flex-1 overflow-auto scrollbar-thin">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'summary' | 'productivity')} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 border-2 border-gray-300 rounded-xl">
              <TabsTrigger value="summary" className="font-semibold">
                <BarChart3 className="h-4 w-4 mr-2" />
                Resumo Geral
              </TabsTrigger>
              <TabsTrigger value="productivity" className="font-semibold">
                <User className="h-4 w-4 mr-2" />
                Produtividade por Técnico
              </TabsTrigger>
            </TabsList>

            {/* Tab: Resumo Geral */}
            <TabsContent value="summary" className="space-y-4 mt-4">
              {isLoadingSummary ? (
                <div className="flex items-center justify-center h-64">
                  <p className="text-muted-foreground">Carregando...</p>
                </div>
              ) : summary ? (
                <>
                  {/* Cards de Resumo */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card className="border-2 border-gray-300 rounded-xl shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground font-semibold">Total PDV</p>
                            <p className="text-lg font-bold text-blue-700 dark:text-blue-400 mt-1">
                              {currencyFormatters.brl(summary.totalPDV)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {summary.countPDV} {summary.countPDV === 1 ? 'venda' : 'vendas'}
                            </p>
                          </div>
                          <ShoppingCart className="h-8 w-8 text-blue-500 opacity-50" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-2 border-gray-300 rounded-xl shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground font-semibold">Total OS</p>
                            <p className="text-lg font-bold text-green-700 dark:text-green-400 mt-1">
                              {currencyFormatters.brl(summary.totalOS)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {summary.countOS} {summary.countOS === 1 ? 'OS' : 'OS'}
                            </p>
                          </div>
                          <Wrench className="h-8 w-8 text-green-500 opacity-50" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-2 border-gray-300 rounded-xl shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground font-semibold">Total Geral</p>
                            <p className="text-lg font-bold text-purple-700 dark:text-purple-400 mt-1">
                              {currencyFormatters.brl(summary.totalGeral)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {summary.countGeral} {summary.countGeral === 1 ? 'venda' : 'vendas'}
                            </p>
                          </div>
                          <DollarSign className="h-8 w-8 text-purple-500 opacity-50" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-2 border-gray-300 rounded-xl shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground font-semibold">% PDV</p>
                            <p className="text-lg font-bold text-orange-700 dark:text-orange-400 mt-1">
                              {summary.percentPDV.toFixed(1)}%
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              % OS: {summary.percentOS.toFixed(1)}%
                            </p>
                          </div>
                          <TrendingUp className="h-8 w-8 text-orange-500 opacity-50" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : (
                <Card className="border-2 border-gray-300 rounded-xl shadow-sm">
                  <CardContent className="p-8 text-center">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                    <p className="text-muted-foreground">Nenhum dado disponível no período selecionado</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Tab: Produtividade por Técnico */}
            <TabsContent value="productivity" className="space-y-4 mt-4">
              {isLoadingProductivity ? (
                <div className="flex items-center justify-center h-64">
                  <p className="text-muted-foreground">Carregando...</p>
                </div>
              ) : productivity && productivity.length > 0 ? (
                <Card className="border-2 border-gray-300 rounded-xl shadow-sm">
                  <CardHeader className="pb-3 pt-4">
                    <CardTitle className="text-lg font-bold">Produtividade por Técnico</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {/* Desktop: Tabela */}
                    <div className="hidden md:block border-2 border-gray-300 rounded-xl overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b-2 border-gray-300">
                            <TableHead className="font-semibold bg-muted/60 border-r border-gray-200">Técnico</TableHead>
                            <TableHead className="font-semibold bg-muted/60 border-r border-gray-200 text-right">OS Completadas</TableHead>
                            <TableHead className="font-semibold bg-muted/60 border-r border-gray-200 text-right">Receita Total</TableHead>
                            <TableHead className="font-semibold bg-muted/60 border-r border-gray-200 text-right">Receita Serviços</TableHead>
                            <TableHead className="font-semibold bg-muted/60 border-r border-gray-200 text-right">Receita Produtos</TableHead>
                            <TableHead className="font-semibold bg-muted/60 text-right">Ticket Médio</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {productivity.map((tech, index) => (
                            <TableRow 
                              key={tech.technician_id}
                              className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}`}
                            >
                              <TableCell className="font-medium border-r border-gray-200">{tech.technician_nome}</TableCell>
                              <TableCell className="text-right border-r border-gray-200">{tech.osCompleted}</TableCell>
                              <TableCell className="text-right font-semibold border-r border-gray-200">
                                {currencyFormatters.brl(tech.totalRevenue)}
                              </TableCell>
                              <TableCell className="text-right border-r border-gray-200">
                                {currencyFormatters.brl(tech.serviceRevenue)}
                              </TableCell>
                              <TableCell className="text-right border-r border-gray-200">
                                {currencyFormatters.brl(tech.productRevenue)}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {currencyFormatters.brl(tech.averageTicket)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile: Cards */}
                    <div className="md:hidden space-y-3 p-3">
                      {productivity.map((tech) => (
                        <Card key={tech.technician_id} className="border-2 border-gray-300 rounded-xl shadow-sm">
                          <CardContent className="p-4 space-y-3">
                            <div className="border-b-2 border-gray-200 pb-2">
                              <h3 className="font-bold text-base">{tech.technician_nome}</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <p className="text-xs text-muted-foreground font-semibold">OS Completadas</p>
                                <p className="text-sm font-bold mt-1">{tech.osCompleted}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground font-semibold">Ticket Médio</p>
                                <p className="text-sm font-bold mt-1">{currencyFormatters.brl(tech.averageTicket)}</p>
                              </div>
                              <div className="col-span-2">
                                <p className="text-xs text-muted-foreground font-semibold">Receita Total</p>
                                <p className="text-base font-bold text-primary mt-1">{currencyFormatters.brl(tech.totalRevenue)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground font-semibold">Serviços</p>
                                <p className="text-sm font-medium mt-1">{currencyFormatters.brl(tech.serviceRevenue)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground font-semibold">Produtos</p>
                                <p className="text-sm font-medium mt-1">{currencyFormatters.brl(tech.productRevenue)}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-2 border-gray-300 rounded-xl shadow-sm">
                  <CardContent className="p-8 text-center">
                    <User className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                    <p className="text-muted-foreground">Nenhuma produtividade encontrada no período selecionado</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ModernLayout>
  );
}
