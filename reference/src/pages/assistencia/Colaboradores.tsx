import { useState } from 'react';
import { ModernLayout } from '@/components/ModernLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Users } from 'lucide-react';
import { useCargos } from '@/hooks/useCargos';
import { Cargo, CARGOS_LABELS } from '@/types/assistencia';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { LoadingButton } from '@/components/LoadingButton';

export default function Colaboradores() {
  const { toast } = useToast();
  const { colaboradores, createColaborador, updateColaborador, deleteColaborador, isLoading } = useCargos();
  
  const [showForm, setShowForm] = useState(false);
  const [editingColab, setEditingColab] = useState<any>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    cargo: 'tecnico' as Cargo,
    ativo: true,
    email: '',
    telefone: '',
  });

  const handleNew = () => {
    setEditingColab(null);
    setFormData({
      nome: '',
      cargo: 'tecnico',
      ativo: true,
      email: '',
      telefone: '',
    });
    setShowForm(true);
  };

  const handleEdit = (colab: any) => {
    setEditingColab(colab);
    setFormData({
      nome: colab.nome,
      cargo: colab.cargo,
      ativo: colab.ativo,
      email: colab.email || '',
      telefone: colab.telefone || '',
    });
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!formData.nome) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }

    if (editingColab) {
      updateColaborador(editingColab.id, formData);
      toast({ title: 'Colaborador atualizado!' });
    } else {
      createColaborador(formData);
      toast({ title: 'Colaborador cadastrado!' });
    }
    setShowForm(false);
    setEditingColab(null);
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    setShowDelete(true);
  };

  const confirmDelete = () => {
    if (deletingId) {
      deleteColaborador(deletingId);
      toast({ title: 'Colaborador excluído!' });
      setDeletingId(null);
    }
    setShowDelete(false);
  };

  return (
    <ModernLayout title="Colaboradores" subtitle="Gerenciar colaboradores e cargos">
      <div className="space-y-4 md:space-y-6 px-1 md:px-0">
        <Card className="border-2 border-gray-300 shadow-sm">
          <CardHeader className="pb-3 pt-3 md:pt-6 px-3 md:px-6 border-b-2 border-gray-200">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base md:text-xl">
                <div className="p-1.5 md:p-2 rounded-lg bg-gradient-to-br from-purple-100 to-white border-2 border-gray-200">
                  <Users className="h-4 w-4 md:h-5 md:w-5 text-purple-600" />
                </div>
                Colaboradores
              </CardTitle>
              <Button 
                onClick={handleNew} 
                className="w-full md:w-auto h-9 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0 shadow-md"
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Colaborador
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-6">
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8 text-sm md:text-base">Carregando...</p>
            ) : colaboradores.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm md:text-base">
                Nenhum colaborador cadastrado ainda.
              </p>
            ) : (
              <div className="border-2 border-gray-300 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-xs md:text-sm font-semibold">Nome</TableHead>
                      <TableHead className="text-xs md:text-sm font-semibold">Cargo</TableHead>
                      <TableHead className="text-xs md:text-sm font-semibold hidden md:table-cell">Email</TableHead>
                      <TableHead className="text-xs md:text-sm font-semibold hidden md:table-cell">Telefone</TableHead>
                      <TableHead className="text-xs md:text-sm font-semibold">Status</TableHead>
                      <TableHead className="text-right text-xs md:text-sm font-semibold">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {colaboradores.map((colab, idx) => (
                      <TableRow key={colab.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        <TableCell className="font-medium text-xs md:text-sm">{colab.nome}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] md:text-xs border-2 border-gray-300">
                            {CARGOS_LABELS[colab.cargo]}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs md:text-sm">{colab.email || '-'}</TableCell>
                        <TableCell className="hidden md:table-cell text-xs md:text-sm">{colab.telefone || '-'}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={colab.ativo ? 'default' : 'secondary'}
                            className={`text-[10px] md:text-xs border-2 ${colab.ativo ? 'bg-green-500 text-white border-green-600' : 'border-gray-300'}`}
                          >
                            {colab.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1 md:gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(colab)}
                              className="h-8 w-8 border-2 border-gray-300 hover:bg-blue-50"
                            >
                              <Edit className="h-3 w-3 md:h-4 md:w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(colab.id)}
                              className="h-8 w-8 border-2 border-red-300 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
                            </Button>
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

        {/* Dialog de Formulário */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-md max-w-[95vw] p-3 md:p-6">
            <DialogHeader>
              <DialogTitle className="text-base md:text-lg">
                {editingColab ? 'Editar Colaborador' : 'Novo Colaborador'}
              </DialogTitle>
              <DialogDescription className="text-xs md:text-sm">
                {editingColab ? 'Atualize os dados do colaborador' : 'Cadastre um novo colaborador'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 md:space-y-4">
              <div className="space-y-2">
                <Label className="text-xs md:text-sm">Nome *</Label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Nome do colaborador"
                  className="h-9 md:h-10 text-base md:text-sm border-2 border-gray-300"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs md:text-sm">Cargo *</Label>
                <Select
                  value={formData.cargo}
                  onValueChange={(v: Cargo) => setFormData(prev => ({ ...prev, cargo: v }))}
                >
                  <SelectTrigger className="h-9 md:h-10 text-base md:text-sm border-2 border-gray-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tecnico">Técnico</SelectItem>
                    <SelectItem value="vendedor">Vendedor</SelectItem>
                    <SelectItem value="atendente">Atendente</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs md:text-sm">Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                  className="h-9 md:h-10 text-base md:text-sm border-2 border-gray-300"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs md:text-sm">Telefone</Label>
                <Input
                  value={formData.telefone}
                  onChange={(e) => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
                  placeholder="(99) 99999-9999"
                  className="h-9 md:h-10 text-base md:text-sm border-2 border-gray-300"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={formData.ativo}
                  onChange={(e) => setFormData(prev => ({ ...prev, ativo: e.target.checked }))}
                  className="h-4 w-4 border-2 border-gray-300"
                />
                <Label htmlFor="ativo" className="cursor-pointer text-xs md:text-sm">Ativo</Label>
              </div>
            </div>

            <DialogFooter className="flex-col md:flex-row gap-2 mt-4">
              <Button 
                variant="outline" 
                onClick={() => setShowForm(false)}
                className="w-full md:w-auto h-9 border-2 border-gray-300"
              >
                Cancelar
              </Button>
              <LoadingButton 
                onClick={handleSubmit}
                className="w-full md:w-auto h-9 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0"
              >
                {editingColab ? 'Atualizar' : 'Cadastrar'}
              </LoadingButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Confirmação de Exclusão */}
        <ConfirmDialog
          open={showDelete}
          onOpenChange={setShowDelete}
          onConfirm={confirmDelete}
          title="Excluir Colaborador"
          description="Tem certeza que deseja excluir este colaborador? Esta ação não pode ser desfeita."
        />
      </div>
    </ModernLayout>
  );
}
