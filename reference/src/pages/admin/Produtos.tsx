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
import { Plus, Search, Edit, Trash2, Package, Wrench, Tag, BarChart3, FileSpreadsheet } from 'lucide-react';
import { ImportarProdutos } from '@/components/ImportarProdutos';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProdutos, useMarcasModelos } from '@/hooks/useAssistencia';
import { Produto, ProdutoFormData, TipoProduto, TIPO_PRODUTO_LABELS } from '@/types/assistencia';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { LoadingButton } from '@/components/LoadingButton';
import { currencyFormatters } from '@/utils/formatters';

export default function Produtos() {
  const { produtos, allProdutos, isLoading, createProduto, updateProduto, deleteProduto } = useProdutos();
  const { marcas, modelos, getModelosByMarca } = useMarcasModelos();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const [formData, setFormData] = useState<ProdutoFormData>({
    tipo: 'peca',
    descricao: '',
    descricao_resumida: '',
    codigo_barras: '',
    marca_id: '',
    modelo_id: '',
    grupo: '',
    custo: 0,
    margem_lucro: 0,
    preco_venda: 0,
    preco_minimo: 0,
    estoque_atual: 0,
    estoque_minimo: 0,
    localizacao: '',
    unidade: 'UN',
    garantia_dias: 90,
  });

  const filteredProdutos = useMemo(() => {
    let result = produtos;

    if (tipoFilter !== 'all') {
      result = result.filter(p => p.tipo === tipoFilter);
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(p =>
        p.descricao.toLowerCase().includes(search) ||
        p.codigo_barras?.includes(search) ||
        p.codigo?.toString().includes(search)
      );
    }

    return result;
  }, [produtos, searchTerm, tipoFilter]);

  const stats = {
    total: produtos.length,
    pecas: produtos.filter(p => p.tipo === 'peca').length,
    servicos: produtos.filter(p => p.tipo === 'servico').length,
    estoqueValor: produtos.reduce((sum, p) => sum + ((p.estoque_atual || 0) * (p.custo || 0)), 0),
    baixoEstoque: produtos.filter(p => p.tipo === 'peca' && (p.estoque_atual || 0) <= (p.estoque_minimo || 0)).length,
  };

  const handleOpenDialog = (produto?: Produto) => {
    if (produto) {
      setEditingProduto(produto);
      setFormData({
        tipo: produto.tipo,
        descricao: produto.descricao,
        descricao_resumida: produto.descricao_resumida || '',
        codigo_barras: produto.codigo_barras || '',
        marca_id: produto.marca_id || '',
        modelo_id: produto.modelo_id || '',
        grupo: produto.grupo || '',
        custo: produto.custo || 0,
        margem_lucro: produto.margem_lucro || 0,
        preco_venda: produto.preco_venda,
        preco_minimo: produto.preco_minimo || 0,
        estoque_atual: produto.estoque_atual || 0,
        estoque_minimo: produto.estoque_minimo || 0,
        localizacao: produto.localizacao || '',
        unidade: produto.unidade,
        garantia_dias: produto.garantia_dias || 90,
      });
    } else {
      setEditingProduto(null);
      setFormData({
        tipo: 'peca', descricao: '', descricao_resumida: '', codigo_barras: '',
        marca_id: '', modelo_id: '', grupo: '', custo: 0, margem_lucro: 0,
        preco_venda: 0, preco_minimo: 0, estoque_atual: 0, estoque_minimo: 0,
        localizacao: '', unidade: 'UN', garantia_dias: 90,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.descricao.trim()) return;
    setIsSaving(true);
    try {
      if (editingProduto) {
        updateProduto(editingProduto.id, formData);
      } else {
        createProduto(formData);
      }
      setIsDialogOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (deletingId) {
      deleteProduto(deletingId);
      setDeleteDialogOpen(false);
      setDeletingId(null);
    }
  };

  // Calcular preço de venda automaticamente
  const calcularPrecoVenda = (custo: number, margem: number) => {
    return custo * (1 + margem / 100);
  };

  const handleCustoChange = (custo: number) => {
    const precoVenda = calcularPrecoVenda(custo, formData.margem_lucro);
    setFormData(prev => ({ ...prev, custo, preco_venda: precoVenda }));
  };

  const handleMargemChange = (margem: number) => {
    const precoVenda = calcularPrecoVenda(formData.custo || 0, margem);
    setFormData(prev => ({ ...prev, margem_lucro: margem, preco_venda: precoVenda }));
  };

  return (
    <ModernLayout title="Produtos e Serviços" subtitle="Cadastro de peças, serviços e acessórios">
      <div className="flex flex-col h-full overflow-hidden gap-4">
        {/* Cards de estatísticas - fixo no topo */}
        <div className="flex-shrink-0 grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="border-l-4 border-l-primary cursor-pointer" onClick={() => setTipoFilter('all')}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><Package className="h-4 w-4" />Total</div>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500 cursor-pointer" onClick={() => setTipoFilter('peca')}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-blue-600 text-sm mb-1"><Tag className="h-4 w-4" />Peças</div>
              <p className="text-2xl font-bold">{stats.pecas}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 cursor-pointer" onClick={() => setTipoFilter('servico')}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-green-600 text-sm mb-1"><Wrench className="h-4 w-4" />Serviços</div>
              <p className="text-2xl font-bold">{stats.servicos}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-purple-600 text-sm mb-1"><BarChart3 className="h-4 w-4" />Valor Estoque</div>
              <p className="text-xl font-bold">{currencyFormatters.brl(stats.estoqueValor)}</p>
            </CardContent>
          </Card>
          {stats.baixoEstoque > 0 && (
            <Card className="border-l-4 border-l-red-500 bg-red-50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-red-600 text-sm mb-1">⚠️ Baixo Estoque</div>
                <p className="text-2xl font-bold text-red-600">{stats.baixoEstoque}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Lista - flex-1 para ocupar espaço restante */}
        <Card className="flex-1 flex flex-col overflow-hidden min-h-0">
          <CardHeader className="flex-shrink-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="text-lg">Lista de Produtos</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowImport(true)} className="gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Importar
                </Button>
                <Button onClick={() => handleOpenDialog()} className="gap-2"><Plus className="h-4 w-4" />Novo Produto</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col overflow-hidden min-h-0 space-y-4">
            {/* Filtros - fixo */}
            <div className="flex-shrink-0 flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por descrição, código ou código de barras..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
              </div>
              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(TIPO_PRODUTO_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Tabela com scroll interno */}
            {filteredProdutos.length === 0 ? (
              <EmptyState variant="no-data" title="Nenhum produto encontrado" description="Cadastre peças e serviços." action={{ label: 'Novo Produto', onClick: () => handleOpenDialog() }} />
            ) : (
              <div className="flex-1 overflow-auto border rounded-lg scrollbar-thin">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Marca/Modelo</TableHead>
                      <TableHead className="text-right">Custo</TableHead>
                      <TableHead className="text-right">Preço Venda</TableHead>
                      <TableHead className="text-center">Estoque</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProdutos.map((produto) => {
                      const marca = marcas.find(m => m.id === produto.marca_id);
                      const modelo = modelos.find(m => m.id === produto.modelo_id);
                      const baixoEstoque = produto.tipo === 'peca' && (produto.estoque_atual || 0) <= (produto.estoque_minimo || 0);
                      
                      return (
                        <TableRow key={produto.id} className={baixoEstoque ? 'bg-red-50' : ''}>
                          <TableCell className="font-mono">{produto.codigo}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{produto.descricao}</p>
                              {produto.codigo_barras && <p className="text-xs text-muted-foreground">{produto.codigo_barras}</p>}
                            </div>
                          </TableCell>
                          <TableCell><Badge variant="outline">{TIPO_PRODUTO_LABELS[produto.tipo]}</Badge></TableCell>
                          <TableCell>
                            {marca ? (
                              <div>
                                <p className="text-sm">{marca.nome}</p>
                                {modelo && <p className="text-xs text-muted-foreground">{modelo.nome}</p>}
                              </div>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-right">{currencyFormatters.brl(produto.custo || 0)}</TableCell>
                          <TableCell className="text-right font-semibold">{currencyFormatters.brl(produto.preco_venda)}</TableCell>
                          <TableCell className="text-center">
                            {produto.tipo === 'peca' ? (
                              <Badge variant={baixoEstoque ? 'destructive' : 'secondary'}>
                                {produto.estoque_atual || 0} {produto.unidade}
                              </Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(produto)}><Edit className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setDeletingId(produto.id); setDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4" /></Button>
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

      {/* Dialog de cadastro/edição */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduto ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select value={formData.tipo} onValueChange={(v: TipoProduto) => setFormData({ ...formData, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TIPO_PRODUTO_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Select value={formData.unidade} onValueChange={(v) => setFormData({ ...formData, unidade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UN">UN - Unidade</SelectItem>
                    <SelectItem value="PC">PC - Peça</SelectItem>
                    <SelectItem value="CX">CX - Caixa</SelectItem>
                    <SelectItem value="HR">HR - Hora</SelectItem>
                    <SelectItem value="SV">SV - Serviço</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Código de Barras</Label>
                <Input value={formData.codigo_barras} onChange={(e) => setFormData({ ...formData, codigo_barras: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Descrição *</Label>
                <Input value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Descrição Resumida</Label>
                <Input value={formData.descricao_resumida} onChange={(e) => setFormData({ ...formData, descricao_resumida: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Marca</Label>
                <Select value={formData.marca_id} onValueChange={(v) => setFormData({ ...formData, marca_id: v, modelo_id: '' })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{marcas.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Modelo</Label>
                <Select value={formData.modelo_id} onValueChange={(v) => setFormData({ ...formData, modelo_id: v })} disabled={!formData.marca_id}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{formData.marca_id && getModelosByMarca(formData.marca_id).map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Grupo</Label>
                <Input value={formData.grupo} onChange={(e) => setFormData({ ...formData, grupo: e.target.value })} placeholder="Ex: Telas, Baterias..." />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Custo (R$)</Label>
                <Input type="number" step="0.01" value={formData.custo} onChange={(e) => handleCustoChange(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-2">
                <Label>Margem (%)</Label>
                <Input type="number" step="0.01" value={formData.margem_lucro} onChange={(e) => handleMargemChange(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-2">
                <Label>Preço Venda (R$)</Label>
                <Input type="number" step="0.01" value={formData.preco_venda} onChange={(e) => setFormData({ ...formData, preco_venda: parseFloat(e.target.value) || 0 })} className="font-semibold" />
              </div>
              <div className="space-y-2">
                <Label>Preço Mínimo (R$)</Label>
                <Input type="number" step="0.01" value={formData.preco_minimo} onChange={(e) => setFormData({ ...formData, preco_minimo: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>

            {formData.tipo === 'peca' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Estoque Atual</Label>
                  <Input type="number" value={formData.estoque_atual} onChange={(e) => setFormData({ ...formData, estoque_atual: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Estoque Mínimo</Label>
                  <Input type="number" value={formData.estoque_minimo} onChange={(e) => setFormData({ ...formData, estoque_minimo: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Localização</Label>
                  <Input value={formData.localizacao} onChange={(e) => setFormData({ ...formData, localizacao: e.target.value })} placeholder="Ex: Prateleira A1" />
                </div>
                <div className="space-y-2">
                  <Label>Garantia (dias)</Label>
                  <Input type="number" value={formData.garantia_dias} onChange={(e) => setFormData({ ...formData, garantia_dias: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <LoadingButton onClick={handleSubmit} loading={isSaving}>{editingProduto ? 'Atualizar' : 'Cadastrar'}</LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} title="Excluir Produto" description="Tem certeza?" onConfirm={handleDelete} variant="danger" />
      
      {/* Dialog de Importação */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar Produtos em Massa</DialogTitle>
          </DialogHeader>
          <ImportarProdutos />
        </DialogContent>
      </Dialog>
    </ModernLayout>
  );
}

