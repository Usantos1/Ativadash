import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { usePositions } from '@/hooks/usePositions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Users, Plus, Edit, Trash2, Crown, Shield, Star } from 'lucide-react';

export const PositionManager = () => {
  const { positions, loading, createPosition, updatePosition, deletePosition } = usePositions();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    level: 1
  });

  const resetForm = () => {
    setFormData({ name: '', description: '', level: 1 });
    setEditingPosition(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingPosition) {
        await updatePosition(editingPosition.id, formData);
      } else {
        await createPosition(formData);
      }
      
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving position:', error);
    }
  };

  const handleEdit = (position: any) => {
    setEditingPosition(position);
    setFormData({
      name: position.name,
      description: position.description || '',
      level: position.level
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePosition(id);
    } catch (error) {
      console.error('Error deleting position:', error);
    }
  };

  const getLevelIcon = (level: number) => {
    if (level >= 5) return Crown;
    if (level >= 3) return Shield;
    return Star;
  };

  const getLevelColor = (level: number) => {
    if (level >= 5) return 'bg-red-500';
    if (level >= 3) return 'bg-blue-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Card className="border-2 border-gray-300 shadow-sm">
      <CardHeader className="pb-3 pt-3 md:pt-6 px-3 md:px-6 border-b-2 border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base md:text-xl">
            <div className="p-1.5 md:p-2 rounded-lg bg-gradient-to-br from-purple-100 to-white border-2 border-gray-200">
              <Users className="h-4 w-4 md:h-5 md:w-5 text-purple-600" />
            </div>
            Gerenciamento de Cargos
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={resetForm}
                className="w-full md:w-auto h-9 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white border-0 shadow-md"
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Cargo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] md:max-w-md p-3 md:p-6">
              <DialogHeader>
                <DialogTitle className="text-base md:text-lg">
                  {editingPosition ? 'Editar Cargo' : 'Novo Cargo'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
                <div>
                  <label className="text-xs md:text-sm font-medium">Nome do Cargo</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Gerente de Vendas"
                    required
                    className="h-9 md:h-10 text-base md:text-sm border-2 border-gray-300"
                  />
                </div>
                
                <div>
                  <label className="text-xs md:text-sm font-medium">Descrição</label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descrição das responsabilidades do cargo"
                    rows={3}
                    className="text-base md:text-sm border-2 border-gray-300"
                  />
                </div>
                
                <div>
                  <label className="text-xs md:text-sm font-medium">Nível Hierárquico</label>
                  <Select 
                    value={formData.level.toString()} 
                    onValueChange={(value) => setFormData({ ...formData, level: parseInt(value) })}
                  >
                    <SelectTrigger className="h-9 md:h-10 text-base md:text-sm border-2 border-gray-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Nível 1 - Operacional</SelectItem>
                      <SelectItem value="2">Nível 2 - Júnior</SelectItem>
                      <SelectItem value="3">Nível 3 - Pleno</SelectItem>
                      <SelectItem value="4">Nível 4 - Sênior</SelectItem>
                      <SelectItem value="5">Nível 5 - Gerencial</SelectItem>
                      <SelectItem value="6">Nível 6 - Diretoria</SelectItem>
                      <SelectItem value="7">Nível 7 - Executivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex flex-col md:flex-row justify-end gap-2 pt-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                    className="w-full md:w-auto h-9 border-2 border-gray-300"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit"
                    className="w-full md:w-auto h-9 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white border-0"
                  >
                    {editingPosition ? 'Atualizar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-3 md:p-6">
        <div className="space-y-3 md:space-y-4">
          {positions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm md:text-base">
              Nenhum cargo encontrado. Crie o primeiro cargo para começar.
            </div>
          ) : (
            positions.map((position) => {
              const LevelIcon = getLevelIcon(position.level);
              return (
                <Card
                  key={position.id}
                  className="border-2 border-gray-300 shadow-sm hover:shadow-md hover:border-gray-400 transition-all active:scale-[0.98]"
                >
                  <CardContent className="p-3 md:p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div className="flex items-start md:items-center gap-3">
                        <div className={`p-2 rounded-lg ${getLevelColor(position.level)}/10 border-2 border-gray-200`}>
                          <LevelIcon className={`h-4 w-4 md:h-5 md:w-5 ${getLevelColor(position.level).replace('bg-', 'text-')}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-semibold text-sm md:text-base">{position.name}</span>
                            <Badge className={`${getLevelColor(position.level)} text-white text-[10px] md:text-xs border-2 border-gray-200`}>
                              Nível {position.level}
                            </Badge>
                          </div>
                          {position.description && (
                            <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">
                              {position.description}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 justify-end md:justify-start">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(position)}
                          className="h-8 w-8 md:h-9 md:w-auto md:px-3 border-2 border-gray-300"
                        >
                          <Edit className="h-3 w-3 md:h-4 md:w-4" />
                          <span className="hidden md:inline ml-2">Editar</span>
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="h-8 w-8 md:h-9 md:w-auto md:px-3 border-2 border-red-300 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
                              <span className="hidden md:inline ml-2">Excluir</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="max-w-[95vw] md:max-w-md p-3 md:p-6">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-base md:text-lg">Confirmar Exclusão</AlertDialogTitle>
                              <AlertDialogDescription className="text-xs md:text-sm">
                                Tem certeza que deseja excluir o cargo "{position.name}"? 
                                Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-col md:flex-row gap-2">
                              <AlertDialogCancel className="w-full md:w-auto h-9 border-2 border-gray-300">Cancelar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDelete(position.id)}
                                className="w-full md:w-auto h-9 bg-red-600 hover:bg-red-700"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};