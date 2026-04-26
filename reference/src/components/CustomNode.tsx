import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Palette, Plus } from 'lucide-react';

interface CustomNodeProps {
  data: {
    label: string;
    color?: string;
    isTask?: boolean;
    completed?: boolean;
    outputHandles?: number;
    editMode?: boolean; // Nova propriedade para controlar modo de edição
    onColorChange?: (nodeId: string, color: string) => void;
    onOutputHandlesChange?: (nodeId: string, count: number) => void;
    onAddConnectedNode?: (nodeId: string) => void;
  };
  id: string;
}

const CustomNode = memo(({ data, id }: CustomNodeProps) => {
  const handleTaskComplete = (completed: boolean) => {
    console.log('Task completed:', id, completed);
  };

  const colors = [
    '#6366f1', '#ef4444', '#22c55e', '#f59e0b', 
    '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'
  ];

  const handleColorChange = (color: string) => {
    data.onColorChange?.(id, color);
  };

  const handleOutputHandlesChange = (count: number) => {
    data.onOutputHandlesChange?.(id, count);
  };

  const outputHandleCount = data.outputHandles || 1;

  return (
    <div className="relative">
      <div 
        className="px-4 py-2 shadow-md rounded-md border-2 min-w-[120px] relative"
        style={{
          backgroundColor: data.color || '#6366f1',
          borderColor: data.color || '#6366f1',
          color: 'white'
        }}
      >
        {/* Removidos todos os controles de hover */}

        {/* Input handles - Top and Left - More discrete */}
        <Handle
          type="target"
          position={Position.Top}
          id="top"
          className="w-1 h-1 !bg-white !border !opacity-30 hover:!opacity-100 transition-all duration-200"
          style={{ 
            borderColor: data.color || '#6366f1',
            top: '-3px'
          }}
        />
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          className="w-1 h-1 !bg-white !border !opacity-30 hover:!opacity-100 transition-all duration-200"
          style={{ 
            borderColor: data.color || '#6366f1',
            left: '-3px'
          }}
        />

        <div className="flex items-center gap-2 relative">
          {data.isTask && (
            <Checkbox
              checked={data.completed || false}
              onCheckedChange={handleTaskComplete}
              className="border-white data-[state=checked]:bg-white data-[state=checked]:text-current"
            />
          )}
          <div className="text-sm font-medium text-center flex-1">
            {data.label}
          </div>
        </div>

        {/* Dynamic output handles based on outputHandleCount */}
        {Array.from({ length: outputHandleCount }, (_, index) => {
          const isCenter = outputHandleCount === 1;
          const position = isCenter ? 50 : (100 / (outputHandleCount + 1)) * (index + 1);
          
          return (
            <Handle
              key={`output-${index}`}
              type="source"
              position={Position.Bottom}
              id={`bottom-${index}`}
              className="w-1 h-1 !bg-white !border !opacity-30 hover:!opacity-100 transition-all duration-200"
              style={{ 
                borderColor: data.color || '#6366f1',
                left: `${position}%`,
                bottom: '-3px',
                transform: 'translateX(-50%)'
              }}
            />
          );
        })}
        
        {/* Right side output handle */}
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          className="w-1 h-1 !bg-white !border !opacity-30 hover:!opacity-100 transition-all duration-200"
          style={{ 
            borderColor: data.color || '#6366f1',
            right: '-3px'
          }}
        />
      </div>
    </div>
  );
});

CustomNode.displayName = 'CustomNode';

export default CustomNode;