import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface FlowNodeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    label: string;
    color: string;
    description?: string;
    tags?: string[];
  }) => void;
  initialData?: {
    label: string;
    color: string;
    description?: string;
    tags?: string[];
  };
}

const COLORS = [
  { value: '#6366f1', name: 'Azul' },
  { value: '#ef4444', name: 'Vermelho' },
  { value: '#22c55e', name: 'Verde' },
  { value: '#f59e0b', name: 'Amarelo' },
  { value: '#8b5cf6', name: 'Roxo' },
  { value: '#06b6d4', name: 'Ciano' },
  { value: '#ec4899', name: 'Rosa' },
  { value: '#f97316', name: 'Laranja' },
];

const COMMON_TAGS = [
  'processo', 'tarefa', 'decisão', 'início', 'fim', 
  'aprovação', 'validação', 'automação', 'manual'
];

export const FlowNodeEditModal = ({
  isOpen,
  onClose,
  onSave,
  initialData
}: FlowNodeEditModalProps) => {
  const [label, setLabel] = useState(initialData?.label || '');
  const [color, setColor] = useState(initialData?.color || '#6366f1');
  const [description, setDescription] = useState(initialData?.description || '');
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  const [newTag, setNewTag] = useState('');

  // Reset form when modal opens with new data
  useState(() => {
    if (isOpen && initialData) {
      setLabel(initialData.label || '');
      setColor(initialData.color || '#6366f1');
      setDescription(initialData.description || '');
      setTags(initialData.tags || []);
    }
  });

  const handleSave = () => {
    if (label.trim()) {
      onSave({
        label: label.trim(),
        color,
        description: description.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined
      });
      // Modal will be closed by parent component after save
    }
  };

  const addTag = (tag: string) => {
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setNewTag('');
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (newTag.trim()) {
        addTag(newTag.trim());
      } else {
        handleSave();
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Bloco do Fluxo</DialogTitle>
          <DialogDescription>
            Configure as propriedades do bloco no construtor de fluxo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Nome do Bloco */}
          <div className="space-y-2">
            <Label htmlFor="label">Nome do Bloco *</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex: Receber cliente"
              onKeyPress={handleKeyPress}
            />
          </div>

          {/* Cor do Bloco */}
          <div className="space-y-2">
            <Label>Cor do Bloco</Label>
            <div className="grid grid-cols-4 gap-2">
              {COLORS.map((colorOption) => (
                <button
                  key={colorOption.value}
                  className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-all hover:scale-105 ${
                    color === colorOption.value 
                      ? 'border-primary shadow-md' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setColor(colorOption.value)}
                >
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: colorOption.value }}
                  />
                  <span className="text-xs font-medium">{colorOption.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição (Opcional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o que acontece neste bloco do processo..."
              rows={3}
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags (Opcional)</Label>
            
            {/* Tags existentes */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <X 
                      className="h-3 w-3 cursor-pointer hover:text-destructive" 
                      onClick={() => removeTag(tag)} 
                    />
                  </Badge>
                ))}
              </div>
            )}

            {/* Adicionar nova tag */}
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Digite uma tag..."
                onKeyPress={handleKeyPress}
                className="flex-1"
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => addTag(newTag)}
                disabled={!newTag.trim() || tags.includes(newTag.trim())}
              >
                Adicionar
              </Button>
            </div>

            {/* Tags sugeridas */}
            <div className="flex flex-wrap gap-1">
              {COMMON_TAGS
                .filter(tag => !tags.includes(tag))
                .slice(0, 6)
                .map((tag) => (
                  <Button
                    key={tag}
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => addTag(tag)}
                  >
                    + {tag}
                  </Button>
                ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!label.trim()}
            style={{ backgroundColor: color }}
            className="text-white hover:opacity-90"
          >
            Salvar Bloco
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};