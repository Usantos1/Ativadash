import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Star } from 'lucide-react';

interface PrioritySliderProps {
  value: number;
  onValueChange: (value: number) => void;
}

const PRIORITY_LEVELS = [
  { value: 1, label: 'Baixa', color: 'hsl(var(--priority-low))' },
  { value: 2, label: 'Média', color: 'hsl(var(--priority-medium))' },
  { value: 3, label: 'Alta', color: 'hsl(var(--priority-high))' },
  { value: 4, label: 'Crítica', color: 'hsl(var(--priority-critical))' }
];

export const PrioritySlider = ({ value, onValueChange }: PrioritySliderProps) => {
  const currentLevel = PRIORITY_LEVELS.find(level => level.value === value) || PRIORITY_LEVELS[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4" />
          <span className="font-medium">Prioridade</span>
        </div>
        <Badge 
          variant="outline" 
          style={{ 
            backgroundColor: `${currentLevel.color}15`,
            borderColor: currentLevel.color,
            color: currentLevel.color
          }}
        >
          {currentLevel.label}
        </Badge>
      </div>
      
      <div className="px-4">
        <Slider
          value={[value]}
          onValueChange={(values) => onValueChange(values[0])}
          max={4}
          min={1}
          step={1}
          className="w-full"
        />
        
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          {PRIORITY_LEVELS.map((level) => (
            <span 
              key={level.value}
              className={`transition-colors ${value === level.value ? 'font-medium' : ''}`}
              style={{ color: value === level.value ? level.color : undefined }}
            >
              {level.label}
            </span>
          ))}
        </div>
      </div>
      
      <p className="text-xs text-muted-foreground">
        Define a prioridade do processo
      </p>
    </div>
  );
};