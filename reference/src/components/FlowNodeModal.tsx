import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Play, Square, CircleDot, Diamond } from 'lucide-react';

interface FlowNodeModalProps {
  onAddNode: (type: string, label: string, extra?: any) => void;
  trigger?: React.ReactNode;
}

export const FlowNodeModal = ({ onAddNode, trigger }: FlowNodeModalProps) => {
  const [open, setOpen] = useState(false);
  const [nodeLabel, setNodeLabel] = useState('');

  const nodeTypes = [
    {
      type: 'input',
      title: 'Início',
      description: 'Ponto de partida do processo',
      icon: Play,
      color: 'bg-green-500'
    },
    {
      type: 'default',
      title: 'Etapa',
      description: 'Atividade do processo',
      icon: CircleDot,
      color: 'bg-blue-500'
    },
    {
      type: 'decision',
      title: 'Decisão',
      description: 'Ponto de decisão com múltiplas saídas',
      icon: Diamond,
      color: 'bg-yellow-500'
    },
    {
      type: 'output',
      title: 'Fim',
      description: 'Conclusão do processo',
      icon: Square,
      color: 'bg-red-500'
    }
  ];

  const handleAddNode = (nodeType: string) => {
    if (!nodeLabel.trim()) return;
    
    onAddNode(nodeType, nodeLabel);
    setNodeLabel('');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4" />
            Adicionar Bloco
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Adicionar Bloco ao Fluxo</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="node-label">Nome do Bloco</Label>
            <Input
              id="node-label"
              value={nodeLabel}
              onChange={(e) => setNodeLabel(e.target.value)}
              placeholder="Digite o nome do bloco..."
              onKeyPress={(e) => e.key === 'Enter' && nodeTypes.length > 0 && handleAddNode('default')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {nodeTypes.map((nodeType) => {
              const IconComponent = nodeType.icon;
              return (
                <Card 
                  key={nodeType.type} 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleAddNode(nodeType.type)}
                >
                  <CardHeader className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${nodeType.color}`}>
                        <IconComponent className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-sm">{nodeType.title}</CardTitle>
                        <CardDescription className="text-xs">
                          {nodeType.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};