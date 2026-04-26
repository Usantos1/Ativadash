import { useState, useRef } from 'react';
import { ModernLayout } from '@/components/ModernLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConfiguracaoStatus } from '@/hooks/useAssistencia';
import { ConfiguracaoStatus, STATUS_OS_LABELS, StatusOS, AcaoStatusOS } from '@/types/assistencia';
import { Save, Edit, X, Plus, Trash2, Upload, Image as ImageIcon, AlertTriangle, CheckSquare, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useOSImageReference } from '@/hooks/useOSImageReference';
import { getDemoAwareErrorMessage, isDemoSession } from '@/utils/demoMode';
import { useAuth } from '@/contexts/AuthContext';
import { useChecklistConfig } from '@/hooks/useChecklistConfig';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCompanySegment } from '@/hooks/useCompanySegment';

export default function ConfiguracaoStatusPage() {
  const { segmentoSlug } = useCompanySegment();
  const isOficina = segmentoSlug === 'oficina_mecanica';
  const { configuracoes, isLoadingConfig, loadConfiguracoes, updateConfig, createConfig, deleteConfig } = useConfiguracaoStatus();
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const refLabel = isOficina ? 'Veículo' : 'Aparelho';
  const refDesc = isOficina ? 'vista do veículo (ex.: carro por ângulo)' : 'frente e verso do aparelho';
  const { imageUrl, uploading, uploadImage, deleteImage } = useOSImageReference();
  const { itemsEntradaAll, itemsSaidaAll, createItem, updateItem, deleteItem, isLoading: isLoadingChecklist } = useChecklistConfig();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<ConfiguracaoStatus | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleting, setDeleting] = useState<ConfiguracaoStatus | null>(null);
  const [editingChecklist, setEditingChecklist] = useState<{ id?: string; tipo: 'entrada' | 'saida'; item_id: string; nome: string; categoria: 'fisico' | 'funcional'; ordem: number; ativo: boolean } | null>(null);
  const [isCreatingChecklist, setIsCreatingChecklist] = useState(false);
  const [deletingChecklist, setDeletingChecklist] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    status: '' as string,
    label: '',
    cor: 'bg-blue-500',
    notificar_whatsapp: false,
    mensagem_whatsapp: '',
    ordem: 0,
    ativo: true,
    acao: 'nenhuma' as AcaoStatusOS,
  });
  const [checklistForm, setChecklistForm] = useState({
    tipo: 'entrada' as 'entrada' | 'saida',
    item_id: '',
    nome: '',
    categoria: 'fisico' as 'fisico' | 'funcional',
    ordem: 0,
    ativo: true,
  });

  const handleCreate = () => {
    setIsCreating(true);
    setEditing(null);
    setEditForm({
      status: '',
      label: '',
      cor: 'bg-blue-500',
      notificar_whatsapp: false,
      mensagem_whatsapp: '',
      ordem: configuracoes.length + 1,
      ativo: true,
      acao: 'nenhuma',
    });
  };

  const handleEdit = (config: ConfiguracaoStatus) => {
    setEditing(config);
    setIsCreating(false);
    setEditForm({
      status: config.status,
      label: config.label,
      cor: config.cor,
      notificar_whatsapp: config.notificar_whatsapp,
      mensagem_whatsapp: config.mensagem_whatsapp || '',
      ordem: config.ordem,
      ativo: config.ativo,
      acao: config.acao ?? 'nenhuma',
    });
  };

  const handleSave = async () => {
    if (!editForm.label.trim()) {
      toast({ 
        title: 'Label obrigatório', 
        description: 'Informe o nome do status.',
        variant: 'destructive' 
      });
      return;
    }

    try {
      if (isCreating) {
        if (!editForm.status.trim()) {
          toast({ 
            title: 'Código do status obrigatório', 
            description: 'Informe o código único do status (ex: novo_status).',
            variant: 'destructive' 
          });
          return;
        }
        if (configuracoes.some(c => c.status === editForm.status)) {
          toast({ 
            title: 'Status já existe', 
            description: 'Já existe um status com este código.',
            variant: 'destructive' 
          });
          return;
        }
        await createConfig({
          status: editForm.status as StatusOS,
          label: editForm.label,
          cor: editForm.cor,
          notificar_whatsapp: editForm.notificar_whatsapp,
          mensagem_whatsapp: editForm.mensagem_whatsapp || undefined,
          ordem: editForm.ordem,
          ativo: editForm.ativo,
          acao: editForm.acao,
        });
        toast({ title: 'Status criado com sucesso' });
        setIsCreating(false);
      } else if (editing) {
        await updateConfig(editing.id, {
          label: editForm.label,
          cor: editForm.cor,
          notificar_whatsapp: editForm.notificar_whatsapp,
          // Enviar null quando vazio para o backend limpar a mensagem (não usar undefined senão o campo não vai no payload)
          mensagem_whatsapp: editForm.mensagem_whatsapp?.trim() || null,
          ordem: editForm.ordem,
          ativo: editForm.ativo,
          acao: editForm.acao,
        });
        toast({ title: 'Configuração atualizada com sucesso' });
        setEditing(null);
      }
    } catch (e: any) {
      const msg = e?.message || (e?.error?.message ?? 'Tente novamente');
      toast({ title: 'Erro ao salvar', description: msg, variant: 'destructive', duration: 8000 });
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteConfig(deleting.id);
      toast({ title: 'Status removido com sucesso' });
      setDeleting(null);
    } catch (e: any) {
      const msg = e?.message || (e?.error?.message ?? 'Tente novamente');
      toast({ title: 'Erro ao remover', description: msg, variant: 'destructive', duration: 8000 });
    }
  };

  const getStatusLabel = (status: StatusOS | string) => {
    if (status in STATUS_OS_LABELS) {
      return STATUS_OS_LABELS[status as StatusOS];
    }
    return status;
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await uploadImage(file);
      toast({
        title: 'Imagem enviada com sucesso!',
        description: 'A imagem de referência foi atualizada.',
      });
    } catch (error: any) {
      let errorMessage = getDemoAwareErrorMessage(error, 'Não foi possível fazer upload da imagem.');
      if (!isDemoSession() && (error?.code === 'BUCKET_NOT_FOUND' || error?.message?.includes('bucket'))) {
        errorMessage = 'Bucket de armazenamento não encontrado. ' +
          'Acesse o Supabase Dashboard > Storage e crie o bucket "os-reference-images" como público.';
      }
      toast({
        title: 'Erro ao enviar imagem',
        description: errorMessage,
        variant: 'destructive',
        duration: 8000,
      });
    } finally {
      // Limpar input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteImage = async () => {
    try {
      await deleteImage();
      toast({
        title: 'Imagem removida',
        description: 'A imagem de referência foi removida.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao remover imagem',
        description: getDemoAwareErrorMessage(error, 'Não foi possível remover a imagem.'),
        variant: 'destructive',
      });
    }
  };

  const handleCreateChecklist = () => {
    setIsCreatingChecklist(true);
    setEditingChecklist(null);
    setChecklistForm({
      tipo: 'entrada',
      item_id: '',
      nome: '',
      categoria: 'fisico',
      ordem: itemsEntradaAll.length + 1,
      ativo: true,
    });
  };

  const handleEditChecklist = (item: any) => {
    setEditingChecklist(item);
    setIsCreatingChecklist(false);
    setChecklistForm({
      tipo: item.tipo,
      item_id: item.item_id,
      nome: item.nome,
      categoria: item.categoria,
      ordem: item.ordem,
      ativo: item.ativo,
    });
  };

  const handleSaveChecklist = async () => {
    if (!checklistForm.nome.trim() || (!checklistForm.item_id.trim() && isCreatingChecklist)) {
      toast({ 
        title: 'Campos obrigatórios', 
        description: 'Preencha o nome e o ID do item.',
        variant: 'destructive' 
      });
      return;
    }

    try {
      if (isCreatingChecklist) {
        await createItem.mutateAsync(checklistForm);
        toast({ title: 'Item de checklist criado com sucesso' });
        setIsCreatingChecklist(false);
        setChecklistForm({
          tipo: 'entrada',
          item_id: '',
          nome: '',
          categoria: 'fisico',
          ordem: 0,
          ativo: true,
        });
      } else if (editingChecklist) {
        await updateItem.mutateAsync({ id: editingChecklist.id!, ...checklistForm });
        toast({ title: 'Item de checklist atualizado com sucesso' });
        setEditingChecklist(null);
      }
    } catch (error: any) {
      toast({ 
        title: 'Erro ao salvar item', 
        description: error.message || 'Não foi possível salvar o item.',
        variant: 'destructive' 
      });
    }
  };

  const handleDeleteChecklist = async () => {
    if (!deletingChecklist) return;
    
    try {
      await deleteItem.mutateAsync(deletingChecklist);
      toast({ title: 'Item removido com sucesso' });
      setDeletingChecklist(null);
    } catch (error: any) {
      toast({ 
        title: 'Erro ao remover item', 
        description: error.message || 'Não foi possível remover o item.',
        variant: 'destructive' 
      });
    }
  };

  return (
    <ModernLayout 
      title="Configuração de Status de OS" 
      subtitle="Gerencie as configurações e mensagens para cada status de ordem de serviço"
    >
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-auto scrollbar-thin pr-1">
          <Tabs defaultValue="status" className="space-y-4 md:space-y-6 px-1 md:px-0">
            <TabsList className="grid grid-cols-2 md:flex w-full md:w-auto gap-2 md:gap-0">
              <TabsTrigger value="status" className="text-xs md:text-sm">Status de OS</TabsTrigger>
              <TabsTrigger value="checklist" className="text-xs md:text-sm">Checklist</TabsTrigger>
              <TabsTrigger value="imagem" className="text-xs md:text-sm col-span-2 md:col-span-1">Imagem de Referência</TabsTrigger>
            </TabsList>

            <TabsContent value="status" className="space-y-4 md:space-y-6">
              <Card className="border-2 border-gray-300">
        <CardHeader className="pb-2 md:pb-3 pt-3 md:pt-6">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <ImageIcon className="h-4 w-4 md:h-5 md:w-5" />
            Imagem de Referência do {refLabel}
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">
            {isOficina ? 'Configure uma imagem do veículo que será exibida como referência visual nas OS (ex.: carro por ângulo).' : 'Configure uma imagem única (frente e verso) que será exibida como referência visual em todas as OS'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 md:p-6 space-y-3 md:space-y-4">
          {imageUrl ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center bg-muted/20 rounded-lg border-2 border-dashed border-gray-300 p-3 md:p-4">
                <img
                  src={imageUrl}
                  alt={`Referência visual do ${refLabel.toLowerCase()} (${refDesc})`}
                  className="max-w-full max-h-48 md:max-h-64 w-auto h-auto object-contain"
                />
              </div>
              <div className="flex flex-col md:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || !isAdmin}
                  className="h-9 md:h-10 text-xs md:text-sm border-2 border-gray-300"
                >
                  <Upload className="h-3.5 w-3.5 md:h-4 md:w-4 mr-2" />
                  {uploading ? 'Enviando...' : 'Substituir Imagem'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDeleteImage}
                  disabled={uploading || !isAdmin}
                  className="text-destructive hover:text-destructive h-9 md:h-10 text-xs md:text-sm border-2 border-gray-300"
                >
                  <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4 mr-2" />
                  Remover
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col items-center justify-center bg-muted/20 rounded-lg border-2 border-dashed border-gray-300 p-6 md:p-8 text-center">
                <AlertTriangle className="h-10 w-10 md:h-12 md:w-12 mb-3 text-muted-foreground opacity-50" />
                <p className="text-xs md:text-sm text-muted-foreground mb-2">
                  Nenhuma imagem de referência configurada
                </p>
                <p className="text-[10px] md:text-xs text-muted-foreground">
                  Faça upload de uma imagem PNG ou JPG (máx. 2MB) contendo {refDesc}
                </p>
              </div>
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !isAdmin}
                className="w-full md:w-auto h-9 md:h-10 text-xs md:text-sm border-2 border-gray-300"
              >
                <Upload className="h-3.5 w-3.5 md:h-4 md:w-4 mr-2" />
                {uploading ? 'Enviando...' : 'Fazer Upload da Imagem'}
              </Button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            onChange={handleImageUpload}
            className="hidden"
          />
          {!isAdmin && (
            <p className="text-[10px] md:text-xs text-muted-foreground">
              Apenas administradores podem fazer upload de imagens
            </p>
          )}
          <div className="mt-3 md:mt-4 p-2.5 md:p-3 bg-blue-50 dark:bg-blue-950/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-[10px] md:text-xs font-semibold text-blue-900 dark:text-blue-100 mb-1">
              ⚠️ Configuração Necessária
            </p>
            <p className="text-[10px] md:text-xs text-blue-800 dark:text-blue-200 mb-2">
              Antes de fazer upload, certifique-se de que o bucket <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">os-reference-images</code> existe no Supabase Storage.
            </p>
            <p className="text-[10px] md:text-xs text-blue-700 dark:text-blue-300">
              <strong>Como criar:</strong> Acesse Supabase Dashboard → Storage → New Bucket → Nome: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">os-reference-images</code> → Público: Sim
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-gray-300">
        <CardHeader className="pb-2 md:pb-3 pt-3 md:pt-6">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 md:gap-0">
            <div>
              <CardTitle className="text-base md:text-lg">Status de Ordem de Serviço</CardTitle>
              <CardDescription className="text-xs md:text-sm">
                Configure as mensagens do WhatsApp e outras opções para cada status
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadConfiguracoes()}
                disabled={isLoadingConfig}
                className="h-9 md:h-10 text-xs md:text-sm border-2 border-gray-300"
              >
                <RefreshCw className={`h-3.5 w-3.5 md:h-4 md:w-4 mr-2 ${isLoadingConfig ? 'animate-spin' : ''}`} />
                Recarregar
              </Button>
              <Button 
                onClick={handleCreate}
                className="w-full md:w-auto h-9 md:h-10 text-xs md:text-sm bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-0 shadow-md"
              >
                <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 mr-2" />
                Novo Status
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 md:p-6">
          {isLoadingConfig && (
            <p className="text-sm text-muted-foreground mb-3">Carregando configuração...</p>
          )}
          {/* Desktop: Tabela */}
          <div className="hidden md:block border-2 border-gray-300 rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b-2 border-gray-300">
                  <TableHead className="font-semibold bg-muted/60 border-r border-gray-200 w-16">Ordem</TableHead>
                  <TableHead className="font-semibold bg-muted/60 border-r border-gray-200">Código</TableHead>
                  <TableHead className="font-semibold bg-muted/60 border-r border-gray-200">Label</TableHead>
                  <TableHead className="font-semibold bg-muted/60 border-r border-gray-200">Cor</TableHead>
                  <TableHead className="font-semibold bg-muted/60 border-r border-gray-200">Ação</TableHead>
                  <TableHead className="font-semibold bg-muted/60 border-r border-gray-200">Notificar WhatsApp</TableHead>
                  <TableHead className="font-semibold bg-muted/60 border-r border-gray-200">Mensagem</TableHead>
                  <TableHead className="font-semibold bg-muted/60 border-r border-gray-200">Ativo</TableHead>
                  <TableHead className="font-semibold bg-muted/60 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...configuracoes].sort((a, b) => a.ordem - b.ordem).map((config, index) => (
                  <TableRow 
                    key={config.id}
                    className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}`}
                  >
                    <TableCell className="text-center font-medium border-r border-gray-200">{config.ordem}</TableCell>
                    <TableCell className="border-r border-gray-200">
                      <code className="text-xs bg-muted px-2 py-1 rounded">{config.status}</code>
                    </TableCell>
                    <TableCell className="font-medium border-r border-gray-200">
                      <Badge className={config.cor}>{config.label}</Badge>
                    </TableCell>
                    <TableCell className="border-r border-gray-200">
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded ${config.cor}`} />
                        <span className="text-xs text-muted-foreground">{config.cor}</span>
                      </div>
                    </TableCell>
                    <TableCell className="border-r border-gray-200 text-xs">
                      {config.acao === 'fechar_os' ? 'Fechar a OS' : config.acao === 'cancelar_os' ? 'Cancelar a OS' : 'Nenhuma'}
                    </TableCell>
                    <TableCell className="border-r border-gray-200">
                      {config.notificar_whatsapp ? (
                        <Badge variant="outline" className="text-green-600">Sim</Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-500">Não</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate border-r border-gray-200">
                      {config.mensagem_whatsapp || '-'}
                    </TableCell>
                    <TableCell className="border-r border-gray-200">
                      {config.ativo ? (
                        <Badge variant="outline" className="text-green-600">Ativo</Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-500">Inativo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(config)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleting(config)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: Cards */}
          <div className="md:hidden space-y-3">
            {[...configuracoes].sort((a, b) => a.ordem - b.ordem).map((config) => (
              <Card key={config.id} className="border-2 border-gray-300">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between border-b-2 border-gray-200 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">#{config.ordem}</span>
                      <Badge className={config.cor}>{config.label}</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(config)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleting(config)}
                        className="text-destructive hover:text-destructive h-8 w-8 p-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Código</p>
                      <code className="text-xs bg-muted px-2 py-1 rounded">{config.status}</code>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Cor</p>
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded ${config.cor}`} />
                        <span className="text-xs">{config.cor}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Ação</p>
                      <span className="text-xs">{config.acao === 'fechar_os' ? 'Fechar a OS' : config.acao === 'cancelar_os' ? 'Cancelar a OS' : 'Nenhuma'}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-gray-200">
                      <span className="text-[10px] text-muted-foreground">WhatsApp</span>
                      {config.notificar_whatsapp ? (
                        <Badge variant="outline" className="text-green-600 text-[10px]">Sim</Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-500 text-[10px]">Não</Badge>
                      )}
                    </div>
                    {config.mensagem_whatsapp && (
                      <div>
                        <p className="text-[10px] text-muted-foreground">Mensagem</p>
                        <p className="text-xs line-clamp-2">{config.mensagem_whatsapp}</p>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1 border-t border-gray-200">
                      <span className="text-[10px] text-muted-foreground">Status</span>
                      {config.ativo ? (
                        <Badge variant="outline" className="text-green-600 text-[10px]">Ativo</Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-500 text-[10px]">Inativo</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
            </TabsContent>

            <TabsContent value="checklist" className="space-y-4 md:space-y-6">
          <Card className="border-2 border-gray-300">
            <CardHeader className="pb-2 md:pb-3 pt-3 md:pt-6">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 md:gap-0">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <CheckSquare className="h-4 w-4 md:h-5 md:w-5" />
                    Checklist Personalizado
                  </CardTitle>
                  <CardDescription className="text-xs md:text-sm">
                    Configure os itens do checklist que serão usados nas OS. O checklist de entrada é gerado automaticamente ao salvar a OS.
                  </CardDescription>
                </div>
                <Button 
                  onClick={handleCreateChecklist} 
                  disabled={!isAdmin}
                  className="w-full md:w-auto h-9 md:h-10 text-xs md:text-sm bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-0 shadow-md"
                >
                  <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 mr-2" />
                  Novo Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-3 md:p-6">
              <Tabs defaultValue="entrada" className="space-y-3 md:space-y-4">
                <TabsList className="grid grid-cols-2 w-full md:w-auto gap-2 md:gap-0">
                  <TabsTrigger value="entrada" className="text-xs md:text-sm">Entrada</TabsTrigger>
                  <TabsTrigger value="saida" className="text-xs md:text-sm">Saída</TabsTrigger>
                </TabsList>

                <TabsContent value="entrada" className="space-y-3 md:space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    <Card className="border-2 border-gray-300">
                      <CardHeader className="pb-2 pt-3">
                        <CardTitle className="text-xs md:text-sm text-destructive">Problemas Encontrados (Físico)</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3">
                        <ScrollArea className="h-[300px] md:h-[400px]">
                          <div className="space-y-2 pr-4">
                            {isLoadingChecklist ? (
                              <div className="text-sm text-muted-foreground">Carregando...</div>
                            ) : itemsEntradaAll.filter(i => i.categoria === 'fisico').length === 0 ? (
                              <div className="text-sm text-muted-foreground">Nenhum item configurado</div>
                            ) : (
                              itemsEntradaAll
                                .filter(i => i.categoria === 'fisico')
                                .sort((a, b) => a.ordem - b.ordem)
                                .map(item => (
                                  <div key={item.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                                    <div className="flex items-center gap-2 flex-1">
                                      <Checkbox checked={item.ativo} disabled />
                                      <span className="text-sm">{item.nome}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEditChecklist(item)}
                                        disabled={!isAdmin}
                                      >
                                        <Edit className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setDeletingChecklist(item.id)}
                                        disabled={!isAdmin}
                                        className="text-destructive hover:text-destructive"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ))
                            )}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>

                    <Card className="border-2 border-gray-300">
                      <CardHeader className="pb-2 pt-3">
                        <CardTitle className="text-xs md:text-sm text-green-600">Funcional OK</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3">
                        <ScrollArea className="h-[300px] md:h-[400px]">
                          <div className="space-y-2 pr-4">
                            {isLoadingChecklist ? (
                              <div className="text-xs md:text-sm text-muted-foreground">Carregando...</div>
                            ) : itemsEntradaAll.filter(i => i.categoria === 'funcional').length === 0 ? (
                              <div className="text-sm text-muted-foreground">Nenhum item configurado</div>
                            ) : (
                              itemsEntradaAll
                                .filter(i => i.categoria === 'funcional')
                                .sort((a, b) => a.ordem - b.ordem)
                                .map(item => (
                                  <div key={item.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                                    <div className="flex items-center gap-2 flex-1">
                                      <Checkbox checked={item.ativo} disabled />
                                      <span className="text-sm">{item.nome}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEditChecklist(item)}
                                        disabled={!isAdmin}
                                      >
                                        <Edit className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setDeletingChecklist(item.id)}
                                        disabled={!isAdmin}
                                        className="text-destructive hover:text-destructive"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ))
                            )}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="saida" className="space-y-3 md:space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    <Card className="border-2 border-gray-300">
                      <CardHeader className="pb-2 pt-3">
                        <CardTitle className="text-xs md:text-sm text-destructive">Problemas Encontrados (Físico)</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3">
                        <ScrollArea className="h-[300px] md:h-[400px]">
                          <div className="space-y-2 pr-4">
                            {isLoadingChecklist ? (
                              <div className="text-sm text-muted-foreground">Carregando...</div>
                            ) : itemsSaidaAll.filter(i => i.categoria === 'fisico').length === 0 ? (
                              <div className="text-sm text-muted-foreground">Nenhum item configurado</div>
                            ) : (
                              itemsSaidaAll
                                .filter(i => i.categoria === 'fisico')
                                .sort((a, b) => a.ordem - b.ordem)
                                .map(item => (
                                  <div key={item.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                                    <div className="flex items-center gap-2 flex-1">
                                      <Checkbox checked={item.ativo} disabled />
                                      <span className="text-sm">{item.nome}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEditChecklist(item)}
                                        disabled={!isAdmin}
                                      >
                                        <Edit className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setDeletingChecklist(item.id)}
                                        disabled={!isAdmin}
                                        className="text-destructive hover:text-destructive"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ))
                            )}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>

                    <Card className="border-2 border-gray-300">
                      <CardHeader className="pb-2 pt-3">
                        <CardTitle className="text-xs md:text-sm text-green-600">Funcional OK</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3">
                        <ScrollArea className="h-[300px] md:h-[400px]">
                          <div className="space-y-2 pr-4">
                            {isLoadingChecklist ? (
                              <div className="text-xs md:text-sm text-muted-foreground">Carregando...</div>
                            ) : itemsSaidaAll.filter(i => i.categoria === 'funcional').length === 0 ? (
                              <div className="text-sm text-muted-foreground">Nenhum item configurado</div>
                            ) : (
                              itemsSaidaAll
                                .filter(i => i.categoria === 'funcional')
                                .sort((a, b) => a.ordem - b.ordem)
                                .map(item => (
                                  <div key={item.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                                    <div className="flex items-center gap-2 flex-1">
                                      <Checkbox checked={item.ativo} disabled className="h-3.5 w-3.5 md:h-4 md:w-4" />
                                      <span className="text-xs md:text-sm">{item.nome}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEditChecklist(item)}
                                        disabled={!isAdmin}
                                        className="h-7 w-7 md:h-8 md:w-8 p-0"
                                      >
                                        <Edit className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setDeletingChecklist(item.id)}
                                        disabled={!isAdmin}
                                        className="text-destructive hover:text-destructive h-7 w-7 md:h-8 md:w-8 p-0"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ))
                            )}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
            </TabsContent>

            <TabsContent value="imagem" className="space-y-4 md:space-y-6">
          {/* Seção: Imagem de Referência do Aparelho/Veículo */}
          <Card className="border-2 border-gray-300">
            <CardHeader className="pb-2 md:pb-3 pt-3 md:pt-6">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <ImageIcon className="h-4 w-4 md:h-5 md:w-5" />
                Imagem de Referência do {refLabel}
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">
                Configure uma imagem única (frente e verso) que será exibida como referência visual em todas as OS
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 md:p-6 space-y-3 md:space-y-4">
              {imageUrl ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-center bg-muted/20 rounded-lg border-2 border-dashed border-gray-300 p-3 md:p-4">
                    <img
                      src={imageUrl}
                      alt={`Referência visual do ${refLabel.toLowerCase()} (${refDesc})`}
                      className="max-w-full max-h-48 md:max-h-64 w-auto h-auto object-contain"
                    />
                  </div>
                  <div className="flex flex-col md:flex-row gap-2">
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading || !isAdmin}
                      className="h-9 md:h-10 text-xs md:text-sm border-2 border-gray-300"
                    >
                      <Upload className="h-3.5 w-3.5 md:h-4 md:w-4 mr-2" />
                      {uploading ? 'Enviando...' : 'Substituir Imagem'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleDeleteImage}
                      disabled={uploading || !isAdmin}
                      className="text-destructive hover:text-destructive h-9 md:h-10 text-xs md:text-sm border-2 border-gray-300"
                    >
                      <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4 mr-2" />
                      Remover
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-col items-center justify-center bg-muted/20 rounded-lg border-2 border-dashed border-gray-300 p-6 md:p-8 text-center">
                    <AlertTriangle className="h-10 w-10 md:h-12 md:w-12 mb-3 text-muted-foreground opacity-50" />
                    <p className="text-xs md:text-sm text-muted-foreground mb-2">
                      Nenhuma imagem de referência configurada
                    </p>
                    <p className="text-[10px] md:text-xs text-muted-foreground">
                      Faça upload de uma imagem PNG ou JPG (máx. 2MB) contendo {refDesc}
                    </p>
                  </div>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || !isAdmin}
                    className="w-full md:w-auto h-9 md:h-10 text-xs md:text-sm border-2 border-gray-300"
                  >
                    <Upload className="h-3.5 w-3.5 md:h-4 md:w-4 mr-2" />
                    {uploading ? 'Enviando...' : 'Fazer Upload da Imagem'}
                  </Button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={handleImageUpload}
                className="hidden"
              />
              {!isAdmin && (
                <p className="text-[10px] md:text-xs text-muted-foreground">
                  Apenas administradores podem fazer upload de imagens
                </p>
              )}
              <div className="mt-3 md:mt-4 p-2.5 md:p-3 bg-blue-50 dark:bg-blue-950/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-[10px] md:text-xs font-semibold text-blue-900 dark:text-blue-100 mb-1">
                  ⚠️ Configuração Necessária
                </p>
                <p className="text-[10px] md:text-xs text-blue-800 dark:text-blue-200 mb-2">
                  Antes de fazer upload, certifique-se de que o bucket <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">os-reference-images</code> existe no Supabase Storage.
                </p>
                <p className="text-[10px] md:text-xs text-blue-700 dark:text-blue-300">
                  <strong>Como criar:</strong> Acesse Supabase Dashboard → Storage → New Bucket → Nome: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">os-reference-images</code> → Público: Sim
                </p>
              </div>
            </CardContent>
          </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={!!editing || isCreating} onOpenChange={(open) => {
        if (!open) {
          setEditing(null);
          setIsCreating(false);
        }
      }}>
        <DialogContent className="max-w-[95vw] md:max-w-2xl p-3 md:p-6">
          <DialogHeader>
            <DialogTitle className="text-base md:text-lg">{isCreating ? 'Criar Novo Status' : 'Editar Configuração'}</DialogTitle>
            <DialogDescription className="text-xs md:text-sm">
              {isCreating 
                ? 'Crie um novo status para ordem de serviço'
                : `Configure as opções para o status: ${editing && getStatusLabel(editing.status)}`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 md:space-y-4 py-2 md:py-4">
            {isCreating ? (
              <div className="space-y-1.5 md:space-y-2">
                <Label className="text-xs md:text-sm">Código do Status *</Label>
                <Input
                  value={editForm.status}
                  onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                  placeholder="novo_status (sem espaços, use _)"
                  className="h-9 md:h-10 text-sm border-2 border-gray-300"
                />
                <p className="text-[10px] md:text-xs text-muted-foreground">
                  Código único do status (ex: aguardando_peca, em_revisao). Use apenas letras, números e _.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 md:space-y-2">
                <Label className="text-xs md:text-sm">Código do Status</Label>
                <Input
                  value={editForm.status}
                  disabled
                  className="bg-muted h-9 md:h-10 text-sm border-2 border-gray-300"
                />
                <p className="text-[10px] md:text-xs text-muted-foreground">
                  O código do status não pode ser alterado após a criação.
                </p>
              </div>
            )}

            <div className="space-y-1.5 md:space-y-2">
              <Label className="text-xs md:text-sm">Label *</Label>
              <Input
                value={editForm.label}
                onChange={(e) => setEditForm(prev => ({ ...prev, label: e.target.value }))}
                placeholder="Nome do status"
                className="h-9 md:h-10 text-sm border-2 border-gray-300"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-1.5 md:space-y-2">
                <Label className="text-xs md:text-sm">Ordem</Label>
                <Input
                  type="number"
                  value={editForm.ordem}
                  onChange={(e) => setEditForm(prev => ({ ...prev, ordem: parseInt(e.target.value) || 0 }))}
                  placeholder="Ordem de exibição"
                  className="h-9 md:h-10 text-sm border-2 border-gray-300"
                />
              </div>
            </div>

            <div className="space-y-1.5 md:space-y-2">
              <Label className="text-xs md:text-sm">Cor (classe Tailwind)</Label>
              <Input
                value={editForm.cor}
                onChange={(e) => setEditForm(prev => ({ ...prev, cor: e.target.value }))}
                placeholder="bg-blue-500"
                className="h-9 md:h-10 text-sm border-2 border-gray-300"
              />
              <p className="text-[10px] md:text-xs text-muted-foreground">
                Ex: bg-blue-500, bg-green-500, bg-red-500, etc.
              </p>
            </div>

            <div className="space-y-1.5 md:space-y-2">
              <Label className="text-xs md:text-sm">Ação ao mudar para este status</Label>
              <Select
                value={editForm.acao}
                onValueChange={(v: AcaoStatusOS) => setEditForm(prev => ({ ...prev, acao: v }))}
              >
                <SelectTrigger className="h-9 md:h-10 text-sm border-2 border-gray-300">
                  <SelectValue placeholder="Selecione a ação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhuma">Nenhuma</SelectItem>
                  <SelectItem value="fechar_os">Fechar a OS</SelectItem>
                  <SelectItem value="cancelar_os">Cancelar a OS</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] md:text-xs text-muted-foreground">
                Ex.: &quot;Fechar a OS&quot; marca a ordem como concluída; &quot;Cancelar&quot; marca como cancelada.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs md:text-sm">Notificar via WhatsApp</Label>
                <p className="text-[10px] md:text-xs text-muted-foreground">
                  Enviar mensagem automaticamente quando o status mudar
                </p>
              </div>
              <Switch
                checked={editForm.notificar_whatsapp}
                onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, notificar_whatsapp: checked }))}
              />
            </div>

            {editForm.notificar_whatsapp && (
              <div className="space-y-1.5 md:space-y-2">
                <Label className="text-xs md:text-sm">Mensagem do WhatsApp</Label>
                <Textarea
                  value={editForm.mensagem_whatsapp}
                  onChange={(e) => setEditForm(prev => ({ ...prev, mensagem_whatsapp: e.target.value }))}
                  placeholder="Olá {cliente}! Sua OS #{numero} do {marca} {modelo} está {status}."
                  rows={3}
                  className="text-sm border-2 border-gray-300"
                />
                <p className="text-[10px] md:text-xs text-muted-foreground">
                  Use {'{cliente}'}, {'{numero}'}, {'{link_os}'}, {'{status}'}, {'{marca}'} e {'{modelo}'} como variáveis
                </p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs md:text-sm">Status Ativo</Label>
                <p className="text-[10px] md:text-xs text-muted-foreground">
                  Se inativo, o status não aparecerá nas opções
                </p>
              </div>
              <Switch
                checked={editForm.ativo}
                onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, ativo: checked }))}
              />
            </div>
          </div>

          <DialogFooter className="flex-col md:flex-row gap-2 md:gap-0">
            <Button 
              variant="outline" 
              onClick={() => {
                setEditing(null);
                setIsCreating(false);
              }}
              className="w-full md:w-auto h-9 md:h-10 text-xs md:text-sm border-2 border-gray-300"
            >
              <X className="h-3.5 w-3.5 md:h-4 md:w-4 mr-2" />
              Cancelar
            </Button>
            <Button 
              onClick={handleSave}
              className="w-full md:w-auto h-9 md:h-10 text-xs md:text-sm bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-0 shadow-md"
            >
              <Save className="h-3.5 w-3.5 md:h-4 md:w-4 mr-2" />
              {isCreating ? 'Criar' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o status "{deleting?.label}"? 
              Esta ação não pode ser desfeita e pode afetar ordens de serviço que usam este status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Checklist */}
      <Dialog open={!!editingChecklist || isCreatingChecklist} onOpenChange={(open) => {
        if (!open) {
          setEditingChecklist(null);
          setIsCreatingChecklist(false);
        }
      }}>
        <DialogContent className="max-w-[95vw] md:max-w-2xl p-3 md:p-6">
          <DialogHeader>
            <DialogTitle className="text-base md:text-lg">{isCreatingChecklist ? 'Criar Novo Item de Checklist' : 'Editar Item de Checklist'}</DialogTitle>
            <DialogDescription className="text-xs md:text-sm">
              {isCreatingChecklist 
                ? 'Crie um novo item para o checklist de entrada ou saída'
                : `Edite o item: ${editingChecklist?.nome}`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 md:space-y-4 py-2 md:py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-1.5 md:space-y-2">
                <Label className="text-xs md:text-sm">Tipo *</Label>
                <Select
                  value={checklistForm.tipo}
                  onValueChange={(v: 'entrada' | 'saida') => setChecklistForm(prev => ({ ...prev, tipo: v }))}
                  disabled={!!editingChecklist}
                >
                  <SelectTrigger className="h-9 md:h-10 text-sm border-2 border-gray-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="saida">Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:space-y-2">
                <Label className="text-xs md:text-sm">Categoria *</Label>
                <Select
                  value={checklistForm.categoria}
                  onValueChange={(v: 'fisico' | 'funcional') => setChecklistForm(prev => ({ ...prev, categoria: v }))}
                >
                  <SelectTrigger className="h-9 md:h-10 text-sm border-2 border-gray-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fisico">Físico (Problemas)</SelectItem>
                    <SelectItem value="funcional">Funcional (OK)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isCreatingChecklist && (
              <div className="space-y-1.5 md:space-y-2">
                <Label className="text-xs md:text-sm">ID do Item *</Label>
                <Input
                  value={checklistForm.item_id}
                  onChange={(e) => setChecklistForm(prev => ({ ...prev, item_id: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                  placeholder="tela_trincada (sem espaços, use _)"
                  className="h-9 md:h-10 text-sm border-2 border-gray-300"
                />
                <p className="text-[10px] md:text-xs text-muted-foreground">
                  ID único do item (ex: tela_trincada, touch_ok). Use apenas letras, números e _.
                </p>
              </div>
            )}

            <div className="space-y-1.5 md:space-y-2">
              <Label className="text-xs md:text-sm">Nome do Item *</Label>
              <Input
                value={checklistForm.nome}
                onChange={(e) => setChecklistForm(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Tela Trincada"
                className="h-9 md:h-10 text-sm border-2 border-gray-300"
              />
            </div>

            <div className="space-y-1.5 md:space-y-2">
              <Label className="text-xs md:text-sm">Ordem</Label>
              <Input
                type="number"
                value={checklistForm.ordem}
                onChange={(e) => setChecklistForm(prev => ({ ...prev, ordem: parseInt(e.target.value) || 0 }))}
                placeholder="Ordem de exibição"
                className="h-9 md:h-10 text-sm border-2 border-gray-300"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs md:text-sm">Item Ativo</Label>
                <p className="text-[10px] md:text-xs text-muted-foreground">
                  Se inativo, o item não aparecerá no checklist
                </p>
              </div>
              <Switch
                checked={checklistForm.ativo}
                onCheckedChange={(checked) => setChecklistForm(prev => ({ ...prev, ativo: checked }))}
              />
            </div>
          </div>

          <DialogFooter className="flex-col md:flex-row gap-2 md:gap-0">
            <Button 
              variant="outline" 
              onClick={() => {
                setEditingChecklist(null);
                setIsCreatingChecklist(false);
              }}
              className="w-full md:w-auto h-9 md:h-10 text-xs md:text-sm border-2 border-gray-300"
            >
              <X className="h-3.5 w-3.5 md:h-4 md:w-4 mr-2" />
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveChecklist} 
              disabled={createItem.isPending || updateItem.isPending}
              className="w-full md:w-auto h-9 md:h-10 text-xs md:text-sm bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-0 shadow-md"
            >
              <Save className="h-3.5 w-3.5 md:h-4 md:w-4 mr-2" />
              {isCreatingChecklist ? 'Criar' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingChecklist} onOpenChange={(open) => !open && setDeletingChecklist(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este item do checklist? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteChecklist} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ModernLayout>
  );
}

