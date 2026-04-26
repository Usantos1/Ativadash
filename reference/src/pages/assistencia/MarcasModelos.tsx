import { useState, useMemo } from 'react';
import { ModernLayout } from '@/components/ModernLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Search, Edit, Trash2, Smartphone, Tag, ChevronRight, Car } from 'lucide-react';
import { useMarcasSupabase, useModelosSupabase } from '@/hooks/useMarcasModelosSupabase';
import { useCompanySegment } from '@/hooks/useCompanySegment';
import { Marca, Modelo } from '@/types/assistencia';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { LoadingButton } from '@/components/LoadingButton';

export default function MarcasModelos() {
  const { segmentoSlug } = useCompanySegment();
  const isOficina = segmentoSlug === 'oficina_mecanica';
  const { marcas, createMarca, updateMarca, deleteMarca, isLoading: isLoadingMarcas } = useMarcasSupabase();
  const { modelos, createModelo, updateModelo, deleteModelo, isLoading: isLoadingModelos } = useModelosSupabase();
  
  const [activeTab, setActiveTab] = useState<'marcas' | 'modelos'>('marcas');
  const segmentLabel = isOficina ? 'veículos' : 'celulares';
  const segmentTitle = isOficina ? 'Marcas e Modelos de Veículos' : 'Marcas e Modelos de Celulares';
  const segmentSubtitle = isOficina ? 'Gerencie marcas e modelos de veículos.' : 'Gerencie marcas e modelos de celulares.';
  const ModelIcon = isOficina ? Car : Smartphone;
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMarcaId, setSelectedMarcaId] = useState<string | null>(null);
  
  // Dialogs de Marca
  const [marcaDialog, setMarcaDialog] = useState(false);
  const [editingMarca, setEditingMarca] = useState<Marca | null>(null);
  const [marcaNome, setMarcaNome] = useState('');
  const [deleteMarcaDialog, setDeleteMarcaDialog] = useState(false);
  const [deletingMarcaId, setDeletingMarcaId] = useState<string | null>(null);
  
  // Dialogs de Modelo
  const [modeloDialog, setModeloDialog] = useState(false);
  const [editingModelo, setEditingModelo] = useState<Modelo | null>(null);
  const [modeloNome, setModeloNome] = useState('');
  const [modeloMarcaId, setModeloMarcaId] = useState('');
  const [deleteModeloDialog, setDeleteModeloDialog] = useState(false);
  const [deletingModeloId, setDeletingModeloId] = useState<string | null>(null);
  
  const [isSaving, setIsSaving] = useState(false);

  // Filtrar marcas
  const filteredMarcas = useMemo(() => {
    if (!searchTerm) return marcas;
    const search = searchTerm.toLowerCase();
    return marcas.filter(m => m.nome.toLowerCase().includes(search));
  }, [marcas, searchTerm]);

  // Filtrar modelos
  const filteredModelos = useMemo(() => {
    let filtered = modelos;
    
    if (selectedMarcaId) {
      filtered = filtered.filter(m => m.marca_id === selectedMarcaId);
    }
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(m => m.nome.toLowerCase().includes(search));
    }
    
    return filtered;
  }, [modelos, selectedMarcaId, searchTerm]);

  // Contar modelos por marca
  const modelosPorMarca = useMemo(() => {
    const counts: Record<string, number> = {};
    modelos.forEach(m => {
      counts[m.marca_id] = (counts[m.marca_id] || 0) + 1;
    });
    return counts;
  }, [modelos]);

  // Handlers de Marca
  const handleOpenMarcaDialog = (marca?: Marca) => {
    if (marca) {
      setEditingMarca(marca);
      setMarcaNome(marca.nome);
    } else {
      setEditingMarca(null);
      setMarcaNome('');
    }
    setMarcaDialog(true);
  };

  const handleSaveMarca = async () => {
    if (!marcaNome.trim()) return;
    
    setIsSaving(true);
    try {
      if (editingMarca) {
        await updateMarca(editingMarca.id, { nome: marcaNome });
      } else {
        await createMarca(marcaNome);
      }
      setMarcaDialog(false);
      setMarcaNome('');
      setEditingMarca(null);
    } catch (error) {
      console.error('[handleSaveMarca] Erro:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMarca = async () => {
    if (deletingMarcaId) {
      try {
        await deleteMarca(deletingMarcaId);
        setDeleteMarcaDialog(false);
        setDeletingMarcaId(null);
      } catch (error) {
        console.error('[handleDeleteMarca] Erro:', error);
      }
    }
  };

  // Handlers de Modelo
  const handleOpenModeloDialog = (modelo?: Modelo) => {
    if (modelo) {
      setEditingModelo(modelo);
      setModeloNome(modelo.nome);
      setModeloMarcaId(modelo.marca_id);
    } else {
      setEditingModelo(null);
      setModeloNome('');
      setModeloMarcaId(selectedMarcaId || '');
    }
    setModeloDialog(true);
  };

  const handleSaveModelo = async () => {
    if (!modeloNome.trim() || !modeloMarcaId) return;
    
    setIsSaving(true);
    try {
      if (editingModelo) {
        await updateModelo(editingModelo.id, { nome: modeloNome, marca_id: modeloMarcaId });
      } else {
        await createModelo(modeloMarcaId, modeloNome);
      }
      setModeloDialog(false);
      setModeloNome('');
      setModeloMarcaId('');
      setEditingModelo(null);
    } catch (error) {
      console.error('[handleSaveModelo] Erro:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteModelo = async () => {
    if (deletingModeloId) {
      try {
        await deleteModelo(deletingModeloId);
        setDeleteModeloDialog(false);
        setDeletingModeloId(null);
      } catch (error) {
        console.error('[handleDeleteModelo] Erro:', error);
      }
    }
  };

  const getMarcaNome = (marcaId: string) => {
    const marca = marcas.find(m => m.id === marcaId);
    return marca?.nome || '-';
  };

  const currentData = activeTab === 'marcas' ? filteredMarcas : filteredModelos;
  const isEmpty = currentData.length === 0;

  return (
    <ModernLayout title={segmentTitle} subtitle={segmentSubtitle}>
      {/* Container principal */}
      <div className="h-[calc(100vh-80px)] md:h-[calc(100vh-120px)] flex flex-col gap-2">
        {/* Mobile: resumo inline compacto */}
        <div className="md:hidden flex-shrink-0 flex items-center gap-2 px-2 py-1.5 bg-white/80 dark:bg-slate-900/50 border border-gray-200 rounded-lg">
          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded font-medium">{marcas.length} marcas</span>
          <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded font-medium">{modelos.length} modelos</span>
        </div>
        
        {/* Desktop: Cards de resumo */}
        <div className="hidden md:grid flex-shrink-0 grid-cols-2 gap-2">
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center gap-3">
            <div className="bg-blue-500 text-white rounded-full p-2"><Tag className="h-4 w-4" /></div>
            <div><p className="text-xs text-blue-600 dark:text-blue-400">Marcas</p><p className="text-xl font-bold text-blue-700 dark:text-blue-300">{marcas.length}</p></div>
          </div>
          <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-3 flex items-center gap-3">
            <div className="bg-purple-500 text-white rounded-full p-2"><ModelIcon className="h-4 w-4" /></div>
            <div><p className="text-xs text-purple-600 dark:text-purple-400">Modelos</p><p className="text-xl font-bold text-purple-700 dark:text-purple-300">{modelos.length}</p></div>
          </div>
        </div>

        {/* Card principal - ocupa o resto da altura */}
        <Card className="flex-1 flex flex-col overflow-hidden border border-gray-200">
          {/* Header com tabs e filtros - altura fixa */}
          <div className="flex-shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-2 p-2 border-b border-gray-200 bg-white dark:bg-gray-900">
            {/* Tabs customizadas */}
            <div className="inline-flex h-9 items-center justify-center rounded-md bg-muted p-1">
              <button
                onClick={() => setActiveTab('marcas')}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-xs font-medium transition-all ${
                  activeTab === 'marcas' 
                    ? 'bg-background text-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Tag className="h-3.5 w-3.5 mr-1.5" />
                Marcas
              </button>
              <button
                onClick={() => setActiveTab('modelos')}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-xs font-medium transition-all ${
                  activeTab === 'modelos' 
                    ? 'bg-background text-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ModelIcon className="h-3.5 w-3.5 mr-1.5" />
                Modelos
              </button>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {activeTab === 'modelos' && (
                <Select
                  value={selectedMarcaId || 'all'}
                  onValueChange={(v) => setSelectedMarcaId(v === 'all' ? null : v)}
                >
                  <SelectTrigger className="h-8 w-[180px] text-sm">
                    <SelectValue placeholder="Filtrar por marca" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Marcas</SelectItem>
                    {marcas.map(m => (<SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>))}
                  </SelectContent>
                </Select>
              )}
              <div className="relative flex-1 min-w-[150px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
              <Button 
                onClick={() => activeTab === 'marcas' ? handleOpenMarcaDialog() : handleOpenModeloDialog()}
                size="sm"
                className="h-8 px-3 text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                <span className="hidden md:inline">{activeTab === 'marcas' ? 'Nova Marca' : 'Novo Modelo'}</span>
                <span className="md:hidden">Novo</span>
              </Button>
            </div>
          </div>

          {/* Área da tabela - flex-1 para preencher todo o espaço restante */}
          <div className="flex-1 overflow-auto scrollbar-thin">
            {isEmpty ? (
              <div className="p-4 h-full flex items-center justify-center">
                <EmptyState
                  variant="no-data"
                  title={activeTab === 'marcas' ? "Nenhuma marca cadastrada" : "Nenhum modelo encontrado"}
                  description={activeTab === 'marcas' ? `Cadastre as marcas de ${segmentLabel}.` : (selectedMarcaId ? `Cadastre modelos para esta marca.` : "Selecione uma marca ou cadastre um novo modelo.")}
                  action={{ 
                    label: activeTab === 'marcas' ? 'Nova Marca' : 'Novo Modelo', 
                    onClick: () => activeTab === 'marcas' ? handleOpenMarcaDialog() : handleOpenModeloDialog() 
                  }}
                />
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800">
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left text-xs font-semibold text-gray-700 dark:text-gray-200 p-3">
                      {activeTab === 'marcas' ? 'Marca' : 'Modelo'}
                    </th>
                    {activeTab === 'marcas' ? (
                      <th className="text-center text-xs font-semibold text-gray-700 dark:text-gray-200 p-3">Modelos</th>
                    ) : (
                      <th className="text-left text-xs font-semibold text-gray-700 dark:text-gray-200 p-3">Marca</th>
                    )}
                    <th className="text-left text-xs font-semibold text-gray-700 dark:text-gray-200 p-3">Status</th>
                    <th className="text-right text-xs font-semibold text-gray-700 dark:text-gray-200 p-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTab === 'marcas' ? (
                    // Renderizar Marcas
                    filteredMarcas.map((marca, idx) => (
                      <tr 
                        key={marca.id} 
                        className={`cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-950/30 border-b border-gray-100 dark:border-gray-800 ${idx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-800/50'}`} 
                        onClick={() => { setSelectedMarcaId(marca.id); setActiveTab('modelos'); }}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 border border-gray-200 dark:border-gray-600 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-xs">
                              {marca.nome.charAt(0)}
                            </div>
                            <span className="font-medium text-gray-900 dark:text-gray-100">{marca.nome}</span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant="secondary" className="text-[10px] border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200">
                            {modelosPorMarca[marca.id] || 0} modelos
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Badge 
                            variant={marca.situacao === 'ativo' ? 'default' : 'outline'}
                            className={`text-[10px] ${marca.situacao === 'ativo' ? 'bg-green-500 text-white' : 'text-gray-400'}`}
                          >
                            {marca.situacao === 'ativo' ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 hover:bg-blue-50 dark:hover:bg-blue-950" 
                              onClick={(e) => { e.stopPropagation(); handleOpenMarcaDialog(marca); }}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950" 
                              onClick={(e) => { e.stopPropagation(); setDeletingMarcaId(marca.id); setDeleteMarcaDialog(true); }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    // Renderizar Modelos
                    filteredModelos.map((modelo, idx) => (
                      <tr key={modelo.id} className={`border-b border-gray-100 dark:border-gray-800 ${idx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-800/50'}`}>
                        <td className="p-3 font-medium text-gray-900 dark:text-gray-100">{modelo.nome}</td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-[10px] border border-gray-300 dark:border-gray-600 dark:text-gray-200">
                            {getMarcaNome(modelo.marca_id)}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Badge 
                            variant={modelo.situacao === 'ativo' ? 'default' : 'outline'}
                            className={`text-[10px] ${modelo.situacao === 'ativo' ? 'bg-green-500 text-white' : 'text-gray-400'}`}
                          >
                            {modelo.situacao === 'ativo' ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 hover:bg-purple-50 dark:hover:bg-purple-950" 
                              onClick={() => handleOpenModeloDialog(modelo)}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950" 
                              onClick={() => { setDeletingModeloId(modelo.id); setDeleteModeloDialog(true); }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>

      {/* Dialog de Marca */}
      <Dialog open={marcaDialog} onOpenChange={setMarcaDialog}>
        <DialogContent className="max-w-sm max-w-[95vw] p-3 md:p-6">
          <DialogHeader>
            <DialogTitle className="text-base md:text-lg">{editingMarca ? 'Editar Marca' : 'Nova Marca'}</DialogTitle>
            <DialogDescription className="text-xs md:text-sm">Cadastre uma marca de {segmentLabel}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 md:space-y-4">
            <div className="space-y-2">
              <Label className="text-xs md:text-sm">Nome da Marca *</Label>
              <Input 
                value={marcaNome} 
                onChange={(e) => setMarcaNome(e.target.value)} 
                placeholder={isOficina ? "Ex: Fiat, Volkswagen, Chevrolet..." : "Ex: Samsung, Apple, Motorola..."}
                className="h-9 md:h-10 text-base md:text-sm border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-800"
              />
            </div>
          </div>
          <DialogFooter className="flex-col md:flex-row gap-2 mt-4">
            <Button 
              variant="outline" 
              onClick={() => setMarcaDialog(false)}
              className="w-full md:w-auto h-9 border-2 border-gray-300 dark:border-gray-600"
            >
              Cancelar
            </Button>
            <LoadingButton 
              onClick={handleSaveMarca} 
              loading={isSaving}
              className="w-full md:w-auto h-9 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white border-0"
            >
              {editingMarca ? 'Atualizar' : 'Cadastrar'}
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Modelo */}
      <Dialog open={modeloDialog} onOpenChange={setModeloDialog}>
        <DialogContent className="max-w-sm max-w-[95vw] p-3 md:p-6">
          <DialogHeader>
            <DialogTitle className="text-base md:text-lg">{editingModelo ? 'Editar Modelo' : 'Novo Modelo'}</DialogTitle>
            <DialogDescription className="text-xs md:text-sm">Cadastre um modelo de {segmentLabel}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 md:space-y-4">
            <div className="space-y-2">
              <Label className="text-xs md:text-sm">Marca *</Label>
              <Select value={modeloMarcaId} onValueChange={setModeloMarcaId}>
                <SelectTrigger className="h-9 md:h-10 text-base md:text-sm border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-800">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {marcas.map(m => (<SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs md:text-sm">Nome do Modelo *</Label>
              <Input 
                value={modeloNome} 
                onChange={(e) => setModeloNome(e.target.value)} 
                placeholder={isOficina ? "Ex: Uno, Gol, Onix, Civic..." : "Ex: iPhone 15, Galaxy S24, Moto G84..."}
                className="h-9 md:h-10 text-base md:text-sm border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-800"
              />
            </div>
          </div>
          <DialogFooter className="flex-col md:flex-row gap-2 mt-4">
            <Button 
              variant="outline" 
              onClick={() => setModeloDialog(false)}
              className="w-full md:w-auto h-9 border-2 border-gray-300 dark:border-gray-600"
            >
              Cancelar
            </Button>
            <LoadingButton 
              onClick={handleSaveModelo} 
              loading={isSaving}
              className="w-full md:w-auto h-9 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0"
            >
              {editingModelo ? 'Atualizar' : 'Cadastrar'}
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogs de exclusão */}
      <ConfirmDialog
        open={deleteMarcaDialog}
        onOpenChange={setDeleteMarcaDialog}
        title="Excluir Marca"
        description="Tem certeza que deseja excluir esta marca? Isso também pode afetar os modelos vinculados."
        onConfirm={handleDeleteMarca}
        variant="danger"
      />
      <ConfirmDialog
        open={deleteModeloDialog}
        onOpenChange={setDeleteModeloDialog}
        title="Excluir Modelo"
        description="Tem certeza que deseja excluir este modelo?"
        onConfirm={handleDeleteModelo}
        variant="danger"
      />
    </ModernLayout>
  );
}
