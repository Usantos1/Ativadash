import { useState, useMemo } from 'react';
import { ModernLayout } from '@/components/ModernLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, Edit, Trash2, Phone, MessageCircle, User, Building, Users, Upload } from 'lucide-react';
import { useClientesSupabase as useClientes } from '@/hooks/useClientesSupabase';
import { ImportarClientes } from '@/components/ImportarClientes';
import { Cliente, ClienteFormData, TipoPessoa, TipoCliente } from '@/types/assistencia';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { LoadingButton } from '@/components/LoadingButton';
import { dateFormatters, currencyFormatters } from '@/utils/formatters';

export default function Clientes() {
  const { clientes, isLoading, createCliente, updateCliente, deleteCliente } = useClientes();
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const [formData, setFormData] = useState<ClienteFormData>({
    tipo_pessoa: 'fisica',
    tipo_cliente: 'cliente',
    nome: '',
    nome_fantasia: '',
    cpf_cnpj: '',
    rg_ie: '',
    data_nascimento: '',
    sexo: 'M',
    cep: '',
    endereco: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    telefone: '',
    telefone2: '',
    whatsapp: '',
    email: '',
    limite_credito: 0,
    observacoes: '',
  });

  const filteredClientes = useMemo(() => {
    let result = clientes.filter(c => c.status === 'ativo');

    if (tipoFilter !== 'all') {
      result = result.filter(c => c.tipo_cliente === tipoFilter);
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(c =>
        c.nome.toLowerCase().includes(search) ||
        c.cpf_cnpj?.includes(search) ||
        c.telefone?.includes(search) ||
        c.email?.toLowerCase().includes(search)
      );
    }

    return result;
  }, [clientes, searchTerm, tipoFilter]);

  const handleOpenDialog = (cliente?: Cliente) => {
    if (cliente) {
      setEditingCliente(cliente);
      setFormData({
        tipo_pessoa: cliente.tipo_pessoa,
        tipo_cliente: cliente.tipo_cliente,
        nome: cliente.nome,
        nome_fantasia: cliente.nome_fantasia || '',
        cpf_cnpj: cliente.cpf_cnpj || '',
        rg_ie: cliente.rg_ie || '',
        data_nascimento: cliente.data_nascimento || '',
        sexo: cliente.sexo || 'M',
        cep: cliente.cep || '',
        endereco: cliente.endereco || '',
        numero: cliente.numero || '',
        complemento: cliente.complemento || '',
        bairro: cliente.bairro || '',
        cidade: cliente.cidade || '',
        estado: cliente.estado || '',
        telefone: cliente.telefone || '',
        telefone2: cliente.telefone2 || '',
        whatsapp: cliente.whatsapp || '',
        email: cliente.email || '',
        limite_credito: cliente.limite_credito || 0,
        observacoes: cliente.observacoes || '',
      });
    } else {
      setEditingCliente(null);
      setFormData({
        tipo_pessoa: 'fisica', tipo_cliente: 'cliente', nome: '', nome_fantasia: '',
        cpf_cnpj: '', rg_ie: '', data_nascimento: '', sexo: 'M', cep: '', endereco: '',
        numero: '', complemento: '', bairro: '', cidade: '', estado: '', telefone: '',
        telefone2: '', whatsapp: '', email: '', limite_credito: 0, observacoes: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.nome.trim()) return;
    setIsSaving(true);
    try {
      if (editingCliente) {
        updateCliente(editingCliente.id, formData);
      } else {
        createCliente(formData);
      }
      setIsDialogOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (deletingId) {
      deleteCliente(deletingId);
      setDeleteDialogOpen(false);
      setDeletingId(null);
    }
  };

  const handleWhatsApp = (numero?: string) => {
    if (numero) {
      window.open(`https://wa.me/55${numero.replace(/\D/g, '')}`, '_blank');
    }
  };

  const buscarCEP = async (cep: string) => {
    if (cep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setFormData(prev => ({
            ...prev,
            endereco: data.logradouro || '',
            bairro: data.bairro || '',
            cidade: data.localidade || '',
            estado: data.uf || '',
          }));
        }
      } catch (e) {
        console.error('Erro ao buscar CEP:', e);
      }
    }
  };

  const stats = {
    total: clientes.filter(c => c.status === 'ativo').length,
    clientes: clientes.filter(c => c.tipo_cliente === 'cliente' && c.status === 'ativo').length,
    fornecedores: clientes.filter(c => c.tipo_cliente === 'fornecedor' && c.status === 'ativo').length,
  };

  return (
    <ModernLayout title="Clientes" subtitle="Cadastro de clientes e fornecedores">
      <div className="flex flex-col h-full overflow-hidden gap-4">
        {/* Cards de estatísticas - fixo no topo */}
        <div className="flex-shrink-0 grid grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-primary cursor-pointer" onClick={() => setTipoFilter('all')}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><Users className="h-4 w-4" />Total</div>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500 cursor-pointer" onClick={() => setTipoFilter('cliente')}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-blue-600 text-sm mb-1"><User className="h-4 w-4" />Clientes</div>
              <p className="text-2xl font-bold">{stats.clientes}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-orange-500 cursor-pointer" onClick={() => setTipoFilter('fornecedor')}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-orange-600 text-sm mb-1"><Building className="h-4 w-4" />Fornecedores</div>
              <p className="text-2xl font-bold">{stats.fornecedores}</p>
            </CardContent>
          </Card>
        </div>

        {/* Lista - flex-1 para ocupar espaço restante */}
        <Card className="flex-1 flex flex-col overflow-hidden min-h-0">
          <CardHeader className="flex-shrink-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="text-lg">Lista de Cadastros</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setImportDialogOpen(true)} className="gap-2">
                  <Upload className="h-4 w-4" />Importar
                </Button>
                <Button onClick={() => handleOpenDialog()} className="gap-2"><Plus className="h-4 w-4" />Novo Cadastro</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col overflow-hidden min-h-0 space-y-4">
            {/* Filtros - fixo */}
            <div className="flex-shrink-0 flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por nome, CPF/CNPJ, telefone ou email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
              </div>
              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="cliente">Clientes</SelectItem>
                  <SelectItem value="fornecedor">Fornecedores</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tabela com scroll interno */}
            {filteredClientes.length === 0 ? (
              <EmptyState variant="no-data" title="Nenhum cadastro encontrado" description="Cadastre clientes e fornecedores para começar." action={{ label: 'Novo Cadastro', onClick: () => handleOpenDialog() }} />
            ) : (
              <div className="flex-1 overflow-auto border rounded-lg scrollbar-thin">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF/CNPJ</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Cidade</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClientes.map((cliente) => (
                      <TableRow key={cliente.id}>
                        <TableCell className="font-mono">{cliente.codigo}</TableCell>
                        <TableCell className="font-medium">{cliente.nome}</TableCell>
                        <TableCell>{cliente.cpf_cnpj || '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span>{cliente.telefone || '-'}</span>
                            {cliente.whatsapp && (
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleWhatsApp(cliente.whatsapp)}>
                                <MessageCircle className="h-4 w-4 text-green-600" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{cliente.email || '-'}</TableCell>
                        <TableCell>{cliente.cidade ? `${cliente.cidade}/${cliente.estado}` : '-'}</TableCell>
                        <TableCell>
                          <Badge variant={cliente.tipo_cliente === 'cliente' ? 'default' : 'secondary'}>
                            {cliente.tipo_cliente === 'cliente' ? 'Cliente' : 'Fornecedor'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(cliente)}><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setDeletingId(cliente.id); setDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de cadastro/edição */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCliente ? 'Editar Cadastro' : 'Novo Cadastro'}</DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="dados" className="mt-4">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="dados">Dados Pessoais</TabsTrigger>
              <TabsTrigger value="endereco">Endereço</TabsTrigger>
              <TabsTrigger value="contato">Contato</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Pessoa</Label>
                  <Select value={formData.tipo_pessoa} onValueChange={(v: TipoPessoa) => setFormData({ ...formData, tipo_pessoa: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="fisica">Pessoa Física</SelectItem><SelectItem value="juridica">Pessoa Jurídica</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Cadastro</Label>
                  <Select value={formData.tipo_cliente} onValueChange={(v: TipoCliente) => setFormData({ ...formData, tipo_cliente: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="cliente">Cliente</SelectItem><SelectItem value="fornecedor">Fornecedor</SelectItem><SelectItem value="ambos">Ambos</SelectItem></SelectContent>
                  </Select>
                </div>
                {formData.tipo_pessoa === 'fisica' && (
                  <div className="space-y-2">
                    <Label>Sexo</Label>
                    <Select value={formData.sexo} onValueChange={(v: 'M' | 'F' | 'O') => setFormData({ ...formData, sexo: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="M">Masculino</SelectItem><SelectItem value="F">Feminino</SelectItem><SelectItem value="O">Outro</SelectItem></SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Data Nascimento</Label>
                  <Input type="date" value={formData.data_nascimento} onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} placeholder={formData.tipo_pessoa === 'fisica' ? 'Nome completo' : 'Razão social'} />
                </div>
                <div className="space-y-2">
                  <Label>{formData.tipo_pessoa === 'fisica' ? 'Nome Fantasia (Apelido)' : 'Nome Fantasia'}</Label>
                  <Input value={formData.nome_fantasia} onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{formData.tipo_pessoa === 'fisica' ? 'CPF' : 'CNPJ'}</Label>
                  <Input value={formData.cpf_cnpj} onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{formData.tipo_pessoa === 'fisica' ? 'RG' : 'Inscrição Estadual'}</Label>
                  <Input value={formData.rg_ie} onChange={(e) => setFormData({ ...formData, rg_ie: e.target.value })} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="endereco" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <Input value={formData.cep} onChange={(e) => { setFormData({ ...formData, cep: e.target.value }); buscarCEP(e.target.value.replace(/\D/g, '')); }} placeholder="00000-000" />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Endereço</Label>
                  <Input value={formData.endereco} onChange={(e) => setFormData({ ...formData, endereco: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Número</Label>
                  <Input value={formData.numero} onChange={(e) => setFormData({ ...formData, numero: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Complemento</Label>
                  <Input value={formData.complemento} onChange={(e) => setFormData({ ...formData, complemento: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Bairro</Label>
                  <Input value={formData.bairro} onChange={(e) => setFormData({ ...formData, bairro: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input value={formData.cidade} onChange={(e) => setFormData({ ...formData, cidade: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Input value={formData.estado} onChange={(e) => setFormData({ ...formData, estado: e.target.value })} maxLength={2} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="contato" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2"><Label>Telefone</Label><Input value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} placeholder="(00) 00000-0000" /></div>
                <div className="space-y-2"><Label>Telefone 2</Label><Input value={formData.telefone2} onChange={(e) => setFormData({ ...formData, telefone2: e.target.value })} /></div>
                <div className="space-y-2"><Label>WhatsApp</Label><Input value={formData.whatsapp} onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })} placeholder="(00) 00000-0000" /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
                <div className="space-y-2"><Label>Limite de Crédito</Label><Input type="number" step="0.01" value={formData.limite_credito} onChange={(e) => setFormData({ ...formData, limite_credito: parseFloat(e.target.value) || 0 })} /></div>
              </div>
              <div className="space-y-2"><Label>Observações</Label><Textarea value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} rows={3} /></div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <LoadingButton onClick={handleSubmit} loading={isSaving}>{editingCliente ? 'Atualizar' : 'Cadastrar'}</LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} title="Excluir Cadastro" description="Tem certeza que deseja excluir este cadastro?" onConfirm={handleDelete} variant="danger" />

      {/* Dialog de importação */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar Clientes em Massa</DialogTitle>
          </DialogHeader>
          <ImportarClientes 
            onClose={() => setImportDialogOpen(false)}
            onSuccess={() => {
              setImportDialogOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </ModernLayout>
  );
}

