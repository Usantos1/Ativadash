import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { User, Search, MessageCircle, Smartphone, Save, Settings, FileText, AlertTriangle, Plus } from 'lucide-react';
import { useClientes, useMarcasModelos, useOrdensServico } from '@/hooks/useAssistencia';
import { OrdemServicoFormData, TipoAparelho, TIPO_APARELHO_LABELS, CHECKLIST_ENTRADA_PADRAO, CondicaoAparelho, Cliente } from '@/types/assistencia';
import { LoadingButton } from '@/components/LoadingButton';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface OrdemServicoFormProps {
  initialData?: Partial<OrdemServicoFormData>;
  onSuccess: () => void;
  onCancel: () => void;
}

export function OrdemServicoForm({ initialData, onSuccess, onCancel }: OrdemServicoFormProps) {
  const { user, profile } = useAuth();
  const { searchClientes, createCliente } = useClientes();
  const { marcas, getModelosByMarca, createModelo } = useMarcasModelos();
  const { createOS } = useOrdensServico();

  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('manutencao');
  const [clienteSearch, setClienteSearch] = useState('');
  const [clienteResults, setClienteResults] = useState<Cliente[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [filteredModelos, setFilteredModelos] = useState<ReturnType<typeof getModelosByMarca>>([]);
  const [showNewModeloDialog, setShowNewModeloDialog] = useState(false);
  const [newModeloNome, setNewModeloNome] = useState('');

  const [formData, setFormData] = useState<OrdemServicoFormData>({
    cliente_id: '', telefone_contato: '', tipo_aparelho: 'celular',
    marca_id: '', modelo_id: '', imei: '', numero_serie: '',
    senha_aparelho: '', possui_senha: false, deixou_aparelho: true,
    descricao_problema: '', acessorios: '', backup_autorizado: false,
    formatacao_autorizada: false, risco_peca: false, chip_cartao: false,
    orcamento_previo: '', previsao_entrega: '', hora_previsao: '',
    observacoes_gerais: '', ...initialData,
  });

  const [condicaoAparelho, setCondicaoAparelho] = useState<CondicaoAparelho>({
    tela_ok: true, tela_trincada: false, tela_manchada: false,
    carcaca_ok: true, carcaca_riscada: false, carcaca_quebrada: false,
    botoes_ok: true, cameras_ok: true,
  });

  const [checklist, setChecklist] = useState<Record<string, boolean>>(
    CHECKLIST_ENTRADA_PADRAO.reduce((acc, item) => ({ ...acc, [item.id]: false }), {})
  );

  useEffect(() => {
    if (clienteSearch.length >= 2) {
      setClienteResults(searchClientes(clienteSearch));
    } else {
      setClienteResults([]);
    }
  }, [clienteSearch, searchClientes]);

  useEffect(() => {
    if (formData.marca_id) {
      setFilteredModelos(getModelosByMarca(formData.marca_id));
    } else {
      setFilteredModelos([]);
    }
  }, [formData.marca_id, getModelosByMarca]);

  const handleSelectCliente = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setFormData(prev => ({
      ...prev, cliente_id: cliente.id,
      telefone_contato: cliente.telefone || cliente.whatsapp || '',
    }));
    setClienteSearch('');
    setClienteResults([]);
  };

  const handleCreateModelo = () => {
    if (newModeloNome && formData.marca_id) {
      const novoModelo = createModelo(formData.marca_id, newModeloNome);
      setFormData(prev => ({ ...prev, modelo_id: novoModelo.id }));
      setShowNewModeloDialog(false);
      setNewModeloNome('');
    }
  };

  const handleSubmit = async () => {
    if (!formData.cliente_id) { alert('Selecione um cliente'); return; }
    if (!formData.descricao_problema) { alert('Informe a descrição do problema'); return; }
    setIsLoading(true);
    try {
      createOS({ ...formData, condicao_entrada: condicaoAparelho }, user?.id, profile?.display_name || user?.email);
      onSuccess();
    } finally { setIsLoading(false); }
  };

  const handleWhatsApp = () => {
    const numero = (selectedCliente?.whatsapp || formData.telefone_contato)?.replace(/\D/g, '');
    if (numero) window.open(`https://wa.me/55${numero}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="manutencao" className="gap-2"><Settings className="h-4 w-4" />Manutenção</TabsTrigger>
          <TabsTrigger value="tecnico" className="gap-2"><FileText className="h-4 w-4" />Info Técnicas</TabsTrigger>
          <TabsTrigger value="checklist" className="gap-2"><AlertTriangle className="h-4 w-4" />Checklist</TabsTrigger>
        </TabsList>

        <TabsContent value="manutencao" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" />Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por nome, CPF ou telefone..." value={clienteSearch} onChange={(e) => setClienteSearch(e.target.value)} className="pl-9" />
                {clienteResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {clienteResults.map(cliente => (
                      <div key={cliente.id} className="p-3 hover:bg-muted cursor-pointer border-b" onClick={() => handleSelectCliente(cliente)}>
                        <p className="font-medium">{cliente.nome}</p>
                        <p className="text-sm text-muted-foreground">{cliente.cpf_cnpj} • {cliente.telefone}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {selectedCliente && (
                <div className="p-4 bg-muted/50 rounded-lg flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{selectedCliente.nome}</p>
                    <p className="text-sm text-muted-foreground">{selectedCliente.cpf_cnpj}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{selectedCliente.telefone}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleWhatsApp}><MessageCircle className="h-4 w-4 text-green-600" /></Button>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>Telefone para Contato</Label>
                <Input value={formData.telefone_contato} onChange={(e) => setFormData({ ...formData, telefone_contato: e.target.value })} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Smartphone className="h-4 w-4" />Dados do Aparelho</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={formData.tipo_aparelho} onValueChange={(v: TipoAparelho) => setFormData({ ...formData, tipo_aparelho: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(TIPO_APARELHO_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Marca</Label>
                  <Select value={formData.marca_id} onValueChange={(v) => setFormData({ ...formData, marca_id: v, modelo_id: '' })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{marcas.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Modelo</Label>
                  <div className="flex gap-2">
                    <Select value={formData.modelo_id} onValueChange={(v) => setFormData({ ...formData, modelo_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{filteredModelos.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent>
                    </Select>
                    {formData.marca_id && <Button variant="outline" size="icon" onClick={() => setShowNewModeloDialog(true)}><Plus className="h-4 w-4" /></Button>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Possui Senha?</Label>
                  <Select value={formData.possui_senha ? 'sim' : 'nao'} onValueChange={(v) => setFormData({ ...formData, possui_senha: v === 'sim' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="nao">NÃO</SelectItem><SelectItem value="sim">SIM</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {formData.possui_senha && <div className="space-y-2"><Label>Senha</Label><Input value={formData.senha_aparelho} onChange={(e) => setFormData({ ...formData, senha_aparelho: e.target.value })} /></div>}
                <div className="space-y-2"><Label>IMEI</Label><Input value={formData.imei} onChange={(e) => setFormData({ ...formData, imei: e.target.value })} /></div>
                <div className="space-y-2"><Label>Nº Série</Label><Input value={formData.numero_serie} onChange={(e) => setFormData({ ...formData, numero_serie: e.target.value })} /></div>
              </div>
              <div className="space-y-2">
                <Label>Descrição do Problema *</Label>
                <Textarea value={formData.descricao_problema} onChange={(e) => setFormData({ ...formData, descricao_problema: e.target.value })} rows={3} />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Condição do Equipamento</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { id: 'tela_ok', label: 'Tela OK', color: 'bg-green-100 border-green-300' },
                    { id: 'tela_trincada', label: 'Trincada', color: 'bg-yellow-100 border-yellow-300' },
                    { id: 'tela_manchada', label: 'Manchada', color: 'bg-orange-100 border-orange-300' },
                    { id: 'carcaca_ok', label: 'Carcaça OK', color: 'bg-green-100 border-green-300' },
                    { id: 'carcaca_riscada', label: 'Riscada', color: 'bg-yellow-100 border-yellow-300' },
                    { id: 'carcaca_quebrada', label: 'Quebrada', color: 'bg-red-100 border-red-300' },
                    { id: 'botoes_ok', label: 'Botões OK', color: 'bg-green-100 border-green-300' },
                    { id: 'cameras_ok', label: 'Câmeras OK', color: 'bg-green-100 border-green-300' },
                  ].map(item => (
                    <div key={item.id} className={cn('p-2 border-2 rounded-lg text-center text-xs cursor-pointer', condicaoAparelho[item.id as keyof CondicaoAparelho] ? item.color : 'bg-gray-50 border-gray-200 opacity-50')} onClick={() => setCondicaoAparelho(prev => ({ ...prev, [item.id]: !prev[item.id as keyof CondicaoAparelho] }))}>
                      {item.label}
                    </div>
                  ))}
                </div>
                <Textarea value={condicaoAparelho.observacoes || ''} onChange={(e) => setCondicaoAparelho(prev => ({ ...prev, observacoes: e.target.value }))} placeholder="Observações..." rows={2} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Acessórios e Autorizações</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label>Acessórios</Label><Textarea value={formData.acessorios} onChange={(e) => setFormData({ ...formData, acessorios: e.target.value })} rows={2} /></div>
                <div className="space-y-2">
                  {[{ id: 'risco_peca', label: 'Risco de Peça' }, { id: 'backup_autorizado', label: 'Backup Autorizado' }, { id: 'chip_cartao', label: 'Chip/Cartão' }, { id: 'formatacao_autorizada', label: 'Formatação Autorizada' }].map(item => (
                    <div key={item.id} className="flex items-center gap-2">
                      <Checkbox id={item.id} checked={formData[item.id as keyof typeof formData] as boolean} onCheckedChange={(c) => setFormData({ ...formData, [item.id]: c as boolean })} />
                      <Label htmlFor={item.id} className="text-sm cursor-pointer">{item.label}</Label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Orçamento e Previsão</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2"><Label>Orçamento Pré-autorizado</Label><Textarea value={formData.orcamento_previo} onChange={(e) => setFormData({ ...formData, orcamento_previo: e.target.value })} rows={2} /></div>
                <div className="space-y-2"><Label>Previsão Entrega</Label><Input type="date" value={formData.previsao_entrega} onChange={(e) => setFormData({ ...formData, previsao_entrega: e.target.value })} /></div>
                <div className="space-y-2"><Label>Hora</Label><Input type="time" value={formData.hora_previsao} onChange={(e) => setFormData({ ...formData, hora_previsao: e.target.value })} /></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tecnico" className="space-y-6 mt-6">
          <Card><CardHeader><CardTitle className="text-base">Informações Técnicas</CardTitle></CardHeader><CardContent><Textarea placeholder="Informações técnicas..." rows={8} /></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Fotos</CardTitle></CardHeader><CardContent><div className="border-2 border-dashed rounded-lg p-8 text-center"><p className="text-muted-foreground">Arraste fotos ou clique para selecionar</p><Button variant="outline" className="mt-4">Selecionar</Button></div></CardContent></Card>
        </TabsContent>

        <TabsContent value="checklist" className="space-y-6 mt-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Checklist de Entrada</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {CHECKLIST_ENTRADA_PADRAO.map(item => (
                  <div key={item.id} className="flex items-center gap-2">
                    <Checkbox id={item.id} checked={checklist[item.id]} onCheckedChange={(c) => setChecklist(prev => ({ ...prev, [item.id]: c as boolean }))} />
                    <Label htmlFor={item.id} className="text-sm cursor-pointer">{item.label}</Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card><CardHeader><CardTitle className="text-base">Observações Gerais</CardTitle></CardHeader><CardContent><Textarea value={formData.observacoes_gerais} onChange={(e) => setFormData({ ...formData, observacoes_gerais: e.target.value })} rows={5} /></CardContent></Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <LoadingButton onClick={handleSubmit} loading={isLoading} className="gap-2"><Save className="h-4 w-4" />Salvar OS</LoadingButton>
      </div>

      <Dialog open={showNewModeloDialog} onOpenChange={setShowNewModeloDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Novo Modelo</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome</Label><Input value={newModeloNome} onChange={(e) => setNewModeloNome(e.target.value)} placeholder="Ex: iPhone 14 Pro" /></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowNewModeloDialog(false)}>Cancelar</Button><Button onClick={handleCreateModelo}>Cadastrar</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

