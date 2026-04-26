import { useState, useMemo } from 'react';
import { ModernLayout } from '@/components/ModernLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Car, Plus, Pencil, Trash2, Phone, MessageCircle, Users, FileText, List } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCompanySegment } from '@/hooks/useCompanySegment';
import { from } from '@/integrations/db/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dateFormatters } from '@/utils/formatters';
import { Badge } from '@/components/ui/badge';

const ALL_FILTER_VALUE = '__all__'; // Radix Select não aceita value vazio

const PERIODO_OPCOES = [
  { value: ALL_FILTER_VALUE, label: 'Todos' },
  { value: 'vencidos', label: 'Revisão vencida' },
  { value: 'este_mes', label: 'Revisão este mês' },
  { value: 'proximo_mes', label: 'Revisão próximo mês' },
] as const;

interface ClienteRef {
  id: string;
  nome: string;
  telefone?: string | null;
  whatsapp?: string | null;
}

interface VeiculoRow {
  id: string;
  company_id: string;
  cliente_id: string;
  placa: string | null;
  marca_id: string | null;
  modelo_id: string | null;
  marca_nome: string | null;
  modelo_nome: string | null;
  ano: string | null;
  versao: string | null;
  cor: string | null;
  km_atual: number | null;
  proxima_revisao_data: string | null;
  proxima_revisao_km: number | null;
  proxima_revisao_obs: string | null;
  proxima_manutencao_data: string | null;
  proxima_manutencao_tipo: string | null;
  proxima_manutencao_obs: string | null;
  ultima_revisao_data: string | null;
  ultima_manutencao_data: string | null;
  observacoes: string | null;
  created_at: string | null;
}

export default function Veiculos() {
  const navigate = useNavigate();
  const { segmentoSlug } = useCompanySegment();
  const isOficina = segmentoSlug === 'oficina_mecanica';
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [filtroMarcaId, setFiltroMarcaId] = useState<string | null>(null);
  const [filtroModeloId, setFiltroModeloId] = useState<string | null>(null);
  const [filtroPeriodo, setFiltroPeriodo] = useState<string>('');
  const [filtroManutencaoTipo, setFiltroManutencaoTipo] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [clienteId, setClienteId] = useState<string | null>(null);
  const [placa, setPlaca] = useState('');
  const [marcaId, setMarcaId] = useState<string | null>(null);
  const [modeloId, setModeloId] = useState<string | null>(null);
  const [marcaNome, setMarcaNome] = useState('');
  const [modeloNome, setModeloNome] = useState('');
  const [ano, setAno] = useState('');
  const [versao, setVersao] = useState('');
  const [cor, setCor] = useState('');
  const [kmAtual, setKmAtual] = useState<string>('');
  const [proximaRevisaoData, setProximaRevisaoData] = useState('');
  const [proximaRevisaoKm, setProximaRevisaoKm] = useState<string>('');
  const [proximaRevisaoObs, setProximaRevisaoObs] = useState('');
  const [proximaManutencaoData, setProximaManutencaoData] = useState('');
  const [proximaManutencaoTipo, setProximaManutencaoTipo] = useState('');
  const [proximaManutencaoObs, setProximaManutencaoObs] = useState('');
  const [ultimaRevisaoData, setUltimaRevisaoData] = useState('');
  const [ultimaManutencaoData, setUltimaManutencaoData] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const { data: veiculosRaw = [], isLoading: loadingVeiculos } = useQuery({
    queryKey: ['veiculos'],
    queryFn: async () => {
      const { data, error } = await from('veiculos').select('*').order('proxima_revisao_data', { ascending: true }).limit(500).execute();
      if (error) throw error;
      return (data || []) as VeiculoRow[];
    },
    enabled: isOficina,
  });

  const { data: clientesList = [] } = useQuery({
    queryKey: ['clientes-veiculos'],
    queryFn: async () => {
      const { data, error } = await from('clientes')
        .select('id, nome, telefone, whatsapp')
        .order('nome', { ascending: true })
        .limit(1000)
        .execute();
      if (error) throw error;
      return (data || []) as ClienteRef[];
    },
    enabled: isOficina,
  });

  const { data: marcasList = [] } = useQuery({
    queryKey: ['marcas-veiculos'],
    queryFn: async () => {
      const { data, error } = await from('marcas').select('id, nome').eq('situacao', 'ativo').order('nome', { ascending: true }).execute();
      if (error) throw error;
      return (data || []) as { id: string; nome: string }[];
    },
    enabled: isOficina,
  });

  const { data: modelosList = [] } = useQuery({
    queryKey: ['modelos-veiculos', marcaId],
    queryFn: async () => {
      if (!marcaId) return [];
      const { data, error } = await from('modelos').select('id, nome').eq('marca_id', marcaId).eq('situacao', 'ativo').order('nome', { ascending: true }).execute();
      if (error) throw error;
      return (data || []) as { id: string; nome: string }[];
    },
    enabled: isOficina && dialogOpen && !!marcaId,
  });

  const { data: modelosAll = [] } = useQuery({
    queryKey: ['modelos-all-veiculos'],
    queryFn: async () => {
      const { data, error } = await from('modelos').select('id, nome, marca_id').eq('situacao', 'ativo').order('nome', { ascending: true }).limit(500).execute();
      if (error) throw error;
      return (data || []) as { id: string; nome: string; marca_id: string }[];
    },
    enabled: isOficina,
  });

  const modelosParaFiltro = useMemo(() => {
    if (filtroMarcaId) return modelosAll.filter((m) => m.marca_id === filtroMarcaId);
    return modelosAll;
  }, [modelosAll, filtroMarcaId]);

  const clientesMap = useMemo(() => {
    const m: Record<string, ClienteRef> = {};
    clientesList.forEach((c) => (m[c.id] = c));
    return m;
  }, [clientesList]);

  const tiposManutencao = useMemo(() => {
    const set = new Set<string>();
    veiculosRaw.forEach((v) => {
      if (v.proxima_manutencao_tipo?.trim()) set.add(v.proxima_manutencao_tipo.trim());
    });
    return Array.from(set).sort();
  }, [veiculosRaw]);

  const filteredVeiculos = useMemo(() => {
    let list = veiculosRaw;
    const s = search.toLowerCase().trim();
    if (s) {
      list = list.filter((v) => {
        const cliente = clientesMap[v.cliente_id];
        const nomeCliente = cliente?.nome?.toLowerCase() || '';
        const placaV = (v.placa || '').toLowerCase();
        const marcaV = (v.marca_nome || '').toLowerCase();
        const modeloV = (v.modelo_nome || '').toLowerCase();
        const anoV = (v.ano || '').toLowerCase();
        return nomeCliente.includes(s) || placaV.includes(s) || marcaV.includes(s) || modeloV.includes(s) || anoV.includes(s);
      });
    }
    if (filtroMarcaId) list = list.filter((v) => v.marca_id === filtroMarcaId);
    if (filtroModeloId) list = list.filter((v) => v.modelo_id === filtroModeloId);
    if (filtroPeriodo) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const fimMes = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const fimProximoMes = new Date(today.getFullYear(), today.getMonth() + 2, 0);
      list = list.filter((v) => {
        const d = v.proxima_revisao_data;
        if (!d) return filtroPeriodo === 'vencidos';
        const dataRev = new Date(d);
        dataRev.setHours(0, 0, 0, 0);
        if (filtroPeriodo === 'vencidos') return dataRev < today;
        if (filtroPeriodo === 'este_mes') return dataRev >= today && dataRev <= fimMes;
        if (filtroPeriodo === 'proximo_mes') return dataRev > fimMes && dataRev <= fimProximoMes;
        return true;
      });
    }
    if (filtroManutencaoTipo.trim()) {
      list = list.filter((v) => (v.proxima_manutencao_tipo || '').toLowerCase().includes(filtroManutencaoTipo.toLowerCase()));
    }
    return list;
  }, [veiculosRaw, search, clientesMap, filtroMarcaId, filtroModeloId, filtroPeriodo, filtroManutencaoTipo]);

  const resetForm = () => {
    setEditingId(null);
    setClienteId(null);
    setPlaca('');
    setMarcaId(null);
    setModeloId(null);
    setMarcaNome('');
    setModeloNome('');
    setAno('');
    setVersao('');
    setCor('');
    setKmAtual('');
    setProximaRevisaoData('');
    setProximaRevisaoKm('');
    setProximaRevisaoObs('');
    setProximaManutencaoData('');
    setProximaManutencaoTipo('');
    setProximaManutencaoObs('');
    setUltimaRevisaoData('');
    setUltimaManutencaoData('');
    setObservacoes('');
  };

  const openNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (v: VeiculoRow) => {
    setEditingId(v.id);
    setClienteId(v.cliente_id);
    setPlaca(v.placa || '');
    setMarcaId(v.marca_id || null);
    setModeloId(v.modelo_id || null);
    setMarcaNome(v.marca_nome || '');
    setModeloNome(v.modelo_nome || '');
    setAno(v.ano || '');
    setVersao(v.versao || '');
    setCor(v.cor || '');
    setKmAtual(v.km_atual != null ? String(v.km_atual) : '');
    setProximaRevisaoData(v.proxima_revisao_data ? v.proxima_revisao_data.slice(0, 10) : '');
    setProximaRevisaoKm(v.proxima_revisao_km != null ? String(v.proxima_revisao_km) : '');
    setProximaRevisaoObs(v.proxima_revisao_obs || '');
    setProximaManutencaoData(v.proxima_manutencao_data ? v.proxima_manutencao_data.slice(0, 10) : '');
    setProximaManutencaoTipo(v.proxima_manutencao_tipo || '');
    setProximaManutencaoObs(v.proxima_manutencao_obs || '');
    setUltimaRevisaoData(v.ultima_revisao_data ? v.ultima_revisao_data.slice(0, 10) : '');
    setUltimaManutencaoData(v.ultima_manutencao_data ? v.ultima_manutencao_data.slice(0, 10) : '');
    setObservacoes(v.observacoes || '');
    setDialogOpen(true);
  };

  const saveVeiculo = async () => {
    if (!clienteId) {
      toast({ title: 'Selecione o cliente.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const marca = marcasList.find((m) => m.id === marcaId);
      const modelo = modelosList.find((m) => m.id === modeloId);
      const payload = {
        cliente_id: clienteId,
        placa: placa.trim() || null,
        marca_id: marcaId || null,
        modelo_id: modeloId || null,
        marca_nome: marca?.nome || marcaNome.trim() || null,
        modelo_nome: modelo?.nome || modeloNome.trim() || null,
        ano: ano.trim() || null,
        versao: versao.trim() || null,
        cor: cor.trim() || null,
        km_atual: kmAtual.trim() ? parseFloat(kmAtual.replace(/,/g, '.')) : null,
        proxima_revisao_data: proximaRevisaoData || null,
        proxima_revisao_km: proximaRevisaoKm.trim() ? parseFloat(proximaRevisaoKm.replace(/,/g, '.')) : null,
        proxima_revisao_obs: proximaRevisaoObs.trim() || null,
        proxima_manutencao_data: proximaManutencaoData || null,
        proxima_manutencao_tipo: proximaManutencaoTipo.trim() || null,
        proxima_manutencao_obs: proximaManutencaoObs.trim() || null,
        ultima_revisao_data: ultimaRevisaoData || null,
        ultima_manutencao_data: ultimaManutencaoData || null,
        observacoes: observacoes.trim() || null,
      };
      if (editingId) {
        await from('veiculos').update(payload).eq('id', editingId).execute();
        toast({ title: 'Veículo atualizado.' });
      } else {
        await from('veiculos').insert(payload).select('id').single();
        toast({ title: 'Veículo cadastrado.' });
      }
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      setDialogOpen(false);
    } catch (e: any) {
      toast({ title: e?.message || 'Erro ao salvar.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deleteVeiculo = async (id: string) => {
    if (!confirm('Excluir este veículo do cadastro?')) return;
    try {
      await from('veiculos').delete().eq('id', id).execute();
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      toast({ title: 'Veículo excluído.' });
    } catch (e: any) {
      toast({ title: e?.message || 'Erro ao excluir.', variant: 'destructive' });
    }
  };

  const contatarCliente = (v: VeiculoRow, canal: 'whatsapp' | 'tel') => {
    const cliente = clientesMap[v.cliente_id];
    const tel = (canal === 'whatsapp' ? cliente?.whatsapp : cliente?.telefone) || cliente?.telefone || cliente?.whatsapp;
    if (!tel) {
      toast({ title: 'Cliente sem telefone cadastrado.', variant: 'destructive' });
      return;
    }
    const num = tel.replace(/\D/g, '');
    if (canal === 'whatsapp') {
      window.open(`https://wa.me/55${num}`, '_blank');
    } else {
      window.location.href = `tel:${tel}`;
    }
  };

  const isRevisaoVencida = (data: string | null) => {
    if (!data) return false;
    return new Date(data) < new Date(new Date().toISOString().slice(0, 10));
  };

  if (!isOficina) {
    return (
      <ModernLayout title="Veículos" subtitle="Cadastro de veículos e histórico.">
        <div className="space-y-4 md:space-y-6 px-1 md:px-0">
          <Card className="border-2 border-gray-300 shadow-sm">
            <CardHeader className="pb-3 pt-3 md:pt-6 px-3 md:px-6 border-b-2 border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-amber-100 to-white border-2 border-gray-200">
                  <Car className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-lg md:text-xl">Veículos</CardTitle>
                  <CardDescription className="mt-1">
                    Veículos são vinculados aos clientes e às Ordens de Serviço. Use Clientes para cadastro e a lista de OS para histórico.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 md:p-6 flex flex-col sm:flex-row gap-3">
              <Button onClick={() => navigate('/clientes')} className="gap-2">
                <Users className="h-4 w-4" />
                Clientes
              </Button>
              <Button variant="outline" onClick={() => navigate('/os/nova')} className="gap-2">
                <FileText className="h-4 w-4" />
                Nova OS
              </Button>
              <Button variant="outline" onClick={() => navigate('/os')} className="gap-2">
                <List className="h-4 w-4" />
                Ordens de Serviço
              </Button>
            </CardContent>
          </Card>
        </div>
      </ModernLayout>
    );
  }

  return (
    <ModernLayout
      title="Veículos"
      subtitle="Cadastre veículos por cliente, prazos de revisão e manutenção. Use filtros e contate o cliente para lembrete ou CRM."
    >
      <div className="space-y-4 md:space-y-6 px-1 md:px-0">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>Veículos</CardTitle>
              <CardDescription>
                Um cliente pode ter vários veículos. Próxima revisão e manutenção para o gestor ligar ou enviar mensagem.
              </CardDescription>
            </div>
            <Button onClick={openNew} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo veículo
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
              <Input
                placeholder="Pesquisar por placa, cliente, marca, modelo, ano..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm"
              />
              <Select value={filtroMarcaId || ALL_FILTER_VALUE} onValueChange={(v) => { setFiltroMarcaId(v === ALL_FILTER_VALUE ? null : v); setFiltroModeloId(null); }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Marca" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER_VALUE}>Todas</SelectItem>
                  {marcasList.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filtroModeloId || ALL_FILTER_VALUE} onValueChange={(v) => setFiltroModeloId(v === ALL_FILTER_VALUE ? null : v)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Modelo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER_VALUE}>Todos</SelectItem>
                  {modelosParaFiltro.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filtroPeriodo || ALL_FILTER_VALUE} onValueChange={(v) => setFiltroPeriodo(v === ALL_FILTER_VALUE ? '' : v)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Período revisão" />
                </SelectTrigger>
                <SelectContent>
                  {PERIODO_OPCOES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filtroManutencaoTipo || ALL_FILTER_VALUE} onValueChange={(v) => setFiltroManutencaoTipo(v === ALL_FILTER_VALUE ? '' : v)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tipo manutenção" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER_VALUE}>Todos</SelectItem>
                  {tiposManutencao.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {loadingVeiculos ? (
              <p className="text-muted-foreground">Carregando...</p>
            ) : filteredVeiculos.length === 0 ? (
              <p className="text-muted-foreground">Nenhum veículo encontrado. Cadastre em &quot;Novo veículo&quot; ou ajuste os filtros.</p>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-2 text-left font-medium">Placa</th>
                      <th className="p-2 text-left font-medium">Cliente</th>
                      <th className="p-2 text-left font-medium">Veículo</th>
                      <th className="p-2 text-left font-medium">Próx. revisão</th>
                      <th className="p-2 text-left font-medium">Próx. manutenção</th>
                      <th className="p-2 text-right font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVeiculos.map((v) => {
                      const cliente = clientesMap[v.cliente_id];
                      const veiculoStr = [v.marca_nome, v.modelo_nome, v.ano].filter(Boolean).join(' ');
                      const revVencida = isRevisaoVencida(v.proxima_revisao_data);
                      return (
                        <tr key={v.id} className="border-b">
                          <td className="p-2 font-medium">{v.placa || '—'}</td>
                          <td className="p-2">{cliente?.nome || '—'}</td>
                          <td className="p-2">{veiculoStr || '—'}</td>
                          <td className="p-2">
                            {v.proxima_revisao_data ? (
                              <span className={revVencida ? 'text-destructive font-medium' : ''}>
                                {dateFormatters.short(v.proxima_revisao_data)}
                                {revVencida && <Badge variant="destructive" className="ml-1">Vencida</Badge>}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="p-2">
                            {v.proxima_manutencao_data ? (
                              <span>
                                {dateFormatters.short(v.proxima_manutencao_data)}
                                {v.proxima_manutencao_tipo && ` (${v.proxima_manutencao_tipo})`}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="p-2 text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(v)} aria-label="Editar">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => contatarCliente(v, 'whatsapp')} aria-label="WhatsApp">
                                <MessageCircle className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => contatarCliente(v, 'tel')} aria-label="Ligar">
                                <Phone className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => deleteVeiculo(v.id)} aria-label="Excluir">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar veículo' : 'Novo veículo'}</DialogTitle>
            <DialogDescription>
              Cliente pode ter vários veículos. Preencha próxima revisão e manutenção para o gestor saber quando contatar.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Cliente *</Label>
              <Select value={clienteId || ''} onValueChange={(v) => setClienteId(v || null)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientesList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Placa</Label>
                <Input placeholder="ABC-1D23" value={placa} onChange={(e) => setPlaca(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Ano</Label>
                <Input placeholder="Ex: 2020" value={ano} onChange={(e) => setAno(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Marca</Label>
                <Select value={marcaId || ''} onValueChange={(v) => { setMarcaId(v || null); setModeloId(null); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a marca" />
                  </SelectTrigger>
                  <SelectContent>
                    {marcasList.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Modelo</Label>
                <Select value={modeloId || ''} onValueChange={(v) => setModeloId(v || null)} disabled={!marcaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {modelosList.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Versão / Cor</Label>
                <Input placeholder="Ex: 1.0 / Prata" value={versao} onChange={(e) => setVersao(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Cor</Label>
                <Input placeholder="Ex: Prata" value={cor} onChange={(e) => setCor(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Km atual</Label>
              <Input type="number" placeholder="Ex: 45000" value={kmAtual} onChange={(e) => setKmAtual(e.target.value)} />
            </div>

            <div className="border-t pt-4 grid gap-2">
              <Label className="font-medium">Próxima revisão</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input type="date" value={proximaRevisaoData} onChange={(e) => setProximaRevisaoData(e.target.value)} placeholder="Data" />
                <Input type="number" placeholder="Km (opcional)" value={proximaRevisaoKm} onChange={(e) => setProximaRevisaoKm(e.target.value)} />
                <Input placeholder="Obs." value={proximaRevisaoObs} onChange={(e) => setProximaRevisaoObs(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="font-medium">Próxima manutenção</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input type="date" value={proximaManutencaoData} onChange={(e) => setProximaManutencaoData(e.target.value)} />
                <Input placeholder="Tipo (ex: troca de óleo, revisão 10k)" value={proximaManutencaoTipo} onChange={(e) => setProximaManutencaoTipo(e.target.value)} />
                <Input placeholder="Obs." value={proximaManutencaoObs} onChange={(e) => setProximaManutencaoObs(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Última revisão</Label>
                <Input type="date" value={ultimaRevisaoData} onChange={(e) => setUltimaRevisaoData(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Última manutenção</Label>
                <Input type="date" value={ultimaManutencaoData} onChange={(e) => setUltimaManutencaoData(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Observações</Label>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveVeiculo} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModernLayout>
  );
}
