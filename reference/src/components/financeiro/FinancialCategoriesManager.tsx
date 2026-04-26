import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { from } from '@/integrations/db/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FinancialCategory } from '@/types/financial';
import { Edit, Trash2, Plus, AlertCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function FinancialCategoriesManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FinancialCategory | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    type: 'saida' as 'entrada' | 'saida',
    description: '',
    color: '#ef4444',
    icon: 'circle',
  });

  // Buscar categorias
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['financial-categories-all'],
    queryFn: async () => {
      const { data, error } = await from('financial_categories')
        .select('*')
        .order('name', { ascending: true })
        .execute();
      if (error) throw error;
      return (data || []) as FinancialCategory[];
    },
  });

  // Criar/editar categoria
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingCategory) {
        const { error } = await from('financial_categories')
          .update(formData)
          .eq('id', editingCategory.id)
          .execute();
        if (error) throw error;
      } else {
        const { error } = await from('financial_categories')
          .insert({ ...formData, is_active: true })
          .execute();
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-categories-all'] });
      queryClient.invalidateQueries({ queryKey: ['financial-categories'] });
      toast({
        title: 'Sucesso!',
        description: editingCategory ? 'Categoria atualizada.' : 'Categoria criada.',
      });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao salvar categoria.',
        variant: 'destructive',
      });
    },
  });

  // Deletar categoria
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await from('financial_categories')
        .delete()
        .eq('id', id)
        .execute();
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-categories-all'] });
      queryClient.invalidateQueries({ queryKey: ['financial-categories'] });
      toast({
        title: 'Sucesso!',
        description: 'Categoria removida.',
      });
      setShowDeleteDialog(false);
      setDeletingId(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao remover categoria. Pode estar em uso.',
        variant: 'destructive',
      });
    },
  });

  // Toggle ativo/inativo
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await from('financial_categories')
        .update({ is_active })
        .eq('id', id)
        .execute();
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-categories-all'] });
      queryClient.invalidateQueries({ queryKey: ['financial-categories'] });
    },
  });

  const handleOpenNew = () => {
    setEditingCategory(null);
    setFormData({ name: '', type: 'saida', description: '', color: '#ef4444', icon: 'circle' });
    setShowDialog(true);
  };

  const handleOpenEdit = (cat: FinancialCategory) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      type: cat.type,
      description: cat.description || '',
      color: cat.color,
      icon: cat.icon,
    });
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingCategory(null);
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (deletingId) {
      deleteMutation.mutate(deletingId);
    }
  };

  // Agrupar duplicatas
  const duplicates = categories.reduce((acc, cat) => {
    const key = cat.name.toLowerCase().trim();
    if (!acc[key]) acc[key] = [];
    acc[key].push(cat);
    return acc;
  }, {} as Record<string, FinancialCategory[]>);

  const hasDuplicates = Object.values(duplicates).some(arr => arr.length > 1);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Categorias Financeiras</CardTitle>
            <CardDescription>Gerencie categorias para contas a pagar e receber</CardDescription>
          </div>
          <Button onClick={handleOpenNew}>
            <Plus className="h-4 w-4 mr-2" />
            Nova categoria
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {hasDuplicates && (
          <div className="mb-4 p-3 border border-orange-200 bg-orange-50 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-orange-900">Categorias duplicadas encontradas</p>
              <p className="text-orange-700">
                Existem categorias com nomes iguais. Desative ou remova as duplicatas desnecessárias.
              </p>
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((cat) => {
                  const isDuplicate = duplicates[cat.name.toLowerCase().trim()]?.length > 1;
                  return (
                    <TableRow key={cat.id} className={isDuplicate ? 'bg-orange-50/50' : ''}>
                      <TableCell className="font-medium">
                        {cat.name}
                        {isDuplicate && (
                          <Badge variant="outline" className="ml-2 text-xs border-orange-300 text-orange-700">
                            Duplicada
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={cat.type === 'entrada' ? 'default' : 'secondary'}>
                          {cat.type === 'entrada' ? 'Entrada' : 'Saída'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {cat.description || '—'}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => toggleActiveMutation.mutate({ id: cat.id, is_active: !cat.is_active })}
                          disabled={toggleActiveMutation.isPending}
                        >
                          <Badge variant={cat.is_active ? 'default' : 'outline'}>
                            {cat.is_active ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(cat)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(cat.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
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

      {/* Dialog criar/editar */}
      <Dialog open={showDialog} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Editar categoria' : 'Nova categoria'}</DialogTitle>
            <DialogDescription>
              {editingCategory ? 'Atualize os dados da categoria.' : 'Crie uma nova categoria financeira.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Aluguel"
              />
            </div>
            <div>
              <Label>Tipo *</Label>
              <Select value={formData.type} onValueChange={(v: any) => setFormData({ ...formData, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Opcional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!formData.name.trim() || saveMutation.isPending}>
              {editingCategory ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog deletar */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover esta categoria? Esta ação não pode ser desfeita.
              {categories.find(c => c.id === deletingId)?.name && (
                <span className="block mt-2 font-medium">
                  Categoria: {categories.find(c => c.id === deletingId)?.name}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteMutation.isPending}>
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
