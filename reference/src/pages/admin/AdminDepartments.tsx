import { useState } from 'react';
import { ModernLayout } from '@/components/ModernLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDepartments, type Department } from '@/hooks/useDepartments';
import { from } from '@/integrations/db/client';
import { Building2, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminDepartments() {
  const { departments, loading, refetch } = useDepartments();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const openCreate = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setDialogOpen(true);
  };

  const openEdit = (dept: Department) => {
    setEditing(dept);
    setName(dept.name);
    setDescription(dept.description ?? '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Nome é obrigatório');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await from('departments')
          .update({ name: trimmedName, description: description.trim() || null })
          .eq('id', editing.id)
          .execute();
        if (error) throw error;
        toast.success('Departamento atualizado');
      } else {
        const { error } = await from('departments')
          .insert({ name: trimmedName, description: description.trim() || null })
          .execute();
        if (error) throw error;
        toast.success('Departamento criado');
      }
      setDialogOpen(false);
      refetch();
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Erro ao salvar';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este departamento? Usuários vinculados podem precisar ser reatribuídos.')) return;
    setDeletingId(id);
    try {
      const { error } = await from('departments').eq('id', id).delete().execute();
      if (error) throw error;
      toast.success('Departamento excluído');
      refetch();
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Erro ao excluir';
      toast.error(msg);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <ModernLayout
      title="Departamentos"
      subtitle="Organize a estrutura departamental da empresa"
    >
      <div className="space-y-4 md:space-y-6 px-1 md:px-0">
        <Card className="border-2 border-gray-300 shadow-sm">
          <CardHeader className="pb-3 pt-3 md:pt-6 px-3 md:px-6 border-b-2 border-gray-200 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg md:text-xl">Lista de departamentos</CardTitle>
              <CardDescription className="mt-1">
                Crie e edite departamentos para organizar usuários e permissões.
              </CardDescription>
            </div>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo departamento
            </Button>
          </CardHeader>
          <CardContent className="p-3 md:p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Carregando...
              </div>
            ) : departments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum departamento cadastrado. Clique em &quot;Novo departamento&quot; para criar.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="hidden md:table-cell">Descrição</TableHead>
                    <TableHead className="w-[100px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.map((dept) => (
                    <TableRow key={dept.id}>
                      <TableCell className="font-medium">{dept.name}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground max-w-[300px] truncate">
                        {dept.description ?? '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(dept)}
                            aria-label="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(dept.id)}
                            disabled={deletingId === dept.id}
                            aria-label="Excluir"
                          >
                            {deletingId === dept.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-destructive" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {editing ? 'Editar departamento' : 'Novo departamento'}
            </DialogTitle>
            <DialogDescription>
              {editing ? 'Altere nome e descrição do departamento.' : 'Preencha os dados do novo departamento.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="dept-name">Nome</Label>
              <Input
                id="dept-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Vendas, TI, RH"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dept-desc">Descrição (opcional)</Label>
              <Input
                id="dept-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Breve descrição do departamento"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editing ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModernLayout>
  );
}
