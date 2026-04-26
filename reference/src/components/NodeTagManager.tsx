import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { X, Tag } from 'lucide-react';

interface NodeTagManagerProps {
  nodeId: string;
  currentTags: string[];
  onTagsChange: (nodeId: string, tags: string[]) => void;
  trigger?: React.ReactNode;
}

export const NodeTagManager = ({ nodeId, currentTags, onTagsChange, trigger }: NodeTagManagerProps) => {
  const [open, setOpen] = useState(false);
  const [newTag, setNewTag] = useState('');

  const addTag = () => {
    if (newTag.trim() && !currentTags.includes(newTag.trim())) {
      onTagsChange(nodeId, [...currentTags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    onTagsChange(nodeId, currentTags.filter(tag => tag !== tagToRemove));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Tag className="h-4 w-4" />
            Etiquetas
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Gerenciar Etiquetas</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-tag">Nova Etiqueta</Label>
            <div className="flex gap-2">
              <Input
                id="new-tag"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Digite uma etiqueta..."
                onKeyPress={(e) => e.key === 'Enter' && addTag()}
              />
              <Button onClick={addTag} size="sm">
                Adicionar
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Etiquetas Atuais</Label>
            <div className="flex flex-wrap gap-2">
              {currentTags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => removeTag(tag)} 
                  />
                </Badge>
              ))}
              {currentTags.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma etiqueta adicionada</p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};