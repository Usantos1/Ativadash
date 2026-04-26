import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface DefectPoint {
  id: string;
  x: number; // Posição X em % do SVG
  y: number; // Posição Y em % do SVG
  side: 'front' | 'back';
}

interface PhoneDrawingProps {
  areas: string[];
  onAreasChange: (areas: string[]) => void;
  readOnly?: boolean;
}

export function PhoneDrawing({ areas, onAreasChange, readOnly = false }: PhoneDrawingProps) {
  const [defects, setDefects] = useState<DefectPoint[]>([]);
  const [currentSide, setCurrentSide] = useState<'front' | 'back'>('front');
  const containerRef = useRef<HTMLDivElement>(null);

  // Carregar defeitos das áreas
  useEffect(() => {
    if (areas.length > 0) {
      const loadedDefects: DefectPoint[] = areas
        .map(area => {
          const parts = area.split('-');
          if (parts.length >= 3) {
            return {
              id: area,
              x: parseFloat(parts[1]) || 0,
              y: parseFloat(parts[2]) || 0,
              side: (parts[0] as 'front' | 'back') || 'front',
            };
          }
          return null;
        })
        .filter((d): d is DefectPoint => d !== null);
      setDefects(loadedDefects);
    } else {
      setDefects([]);
    }
  }, [areas]);

  const handlePhoneClick = useCallback((event: React.MouseEvent<HTMLDivElement>, side: 'front' | 'back') => {
    if (readOnly || currentSide !== side) return;
    
    const container = event.currentTarget;
    const rect = container.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    // Verificar se já existe um defeito próximo (dentro de 5%)
    const existingDefect = defects.find(
      d => d.side === side && Math.abs(d.x - x) < 5 && Math.abs(d.y - y) < 5
    );

    if (existingDefect) {
      // Remover defeito existente
      const newDefects = defects.filter(d => d.id !== existingDefect.id);
      setDefects(newDefects);
      onAreasChange(newDefects.map(d => `${d.side}-${d.x.toFixed(1)}-${d.y.toFixed(1)}`));
    } else {
      // Adicionar novo defeito
      const newDefect: DefectPoint = {
        id: `defect-${Date.now()}-${Math.random()}`,
        x,
        y,
        side,
      };
      const newDefects = [...defects, newDefect];
      setDefects(newDefects);
      onAreasChange(newDefects.map(d => `${d.side}-${d.x.toFixed(1)}-${d.y.toFixed(1)}`));
    }
  }, [defects, onAreasChange, readOnly, currentSide]);

  const renderPhone = (side: 'front' | 'back') => {
    const sideDefects = defects.filter(d => d.side === side);
    const isActive = currentSide === side;
    
    // Proporção real iPhone: ~9:19.5
    const aspectRatio = 9 / 19.5;
    
    return (
      <div className="flex flex-col items-center w-full h-full min-w-0 max-w-full box-border">
        <button
          type="button"
          onClick={() => setCurrentSide(side)}
          className={cn(
            "text-xs font-medium mb-2 px-2 sm:px-3 py-1.5 rounded transition-colors whitespace-nowrap flex-shrink-0",
            isActive 
              ? "bg-primary text-primary-foreground shadow-sm" 
              : "text-muted-foreground hover:bg-muted"
          )}
        >
          {side === 'front' ? 'Frente' : 'Traseira'}
        </button>
        
        {isActive && (
          <div 
            ref={containerRef}
            className="relative cursor-crosshair w-full max-w-full min-w-0 box-border"
            style={{ 
              aspectRatio: `${aspectRatio}`, 
              maxWidth: '100%',
              width: '100%',
              maxHeight: '100%',
              height: 'auto'
            }}
            onClick={(e) => handlePhoneClick(e, side)}
          >
            {/* iPhone Mockup Realista */}
            <svg 
              className="absolute inset-0 w-full h-full max-w-full"
              viewBox="0 0 100 200"
              preserveAspectRatio="xMidYMid meet"
              style={{ 
                filter: 'drop-shadow(0 6px 12px rgba(0, 0, 0, 0.25))',
                maxWidth: '100%',
                height: 'auto'
              }}
            >
              {side === 'front' ? (
                <>
                  {/* Corpo externo - borda metálica */}
                  <rect x="2" y="0.5" width="96" height="199" rx="6" ry="6" fill="#2d2d2d" />
                  <rect x="3" y="1.5" width="94" height="197" rx="5.5" ry="5.5" fill="#1a1a1a" />
                  
                  {/* Tela */}
                  <rect x="4.5" y="3" width="91" height="194" rx="4" ry="4" fill="#000000" />
                  
                  {/* Brilho da tela */}
                  <defs>
                    <linearGradient id="screenShine" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.08" />
                      <stop offset="50%" stopColor="#ffffff" stopOpacity="0.02" />
                      <stop offset="100%" stopColor="#000000" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <rect x="4.5" y="3" width="91" height="194" rx="4" ry="4" fill="url(#screenShine)" />
                  
                  {/* Dynamic Island / Notch */}
                  <rect x="38" y="4" width="24" height="7" rx="3.5" ry="3.5" fill="#1a1a1a" />
                  <rect x="39" y="5" width="22" height="5" rx="2.5" ry="2.5" fill="#0a0a0a" />
                  
                  {/* Câmera frontal */}
                  <circle cx="46" cy="7.5" r="1.2" fill="#2d2d2d" />
                  
                  {/* Sensor */}
                  <ellipse cx="52" cy="7.5" rx="3" ry="1.5" fill="#2d2d2d" />
                  
                  {/* Botões laterais */}
                  <rect x="0.5" y="18" width="2" height="12" rx="0.5" fill="#1a1a1a" />
                  <rect x="0.5" y="33" width="2" height="12" rx="0.5" fill="#1a1a1a" />
                  <rect x="97.5" y="26" width="2" height="14" rx="0.5" fill="#1a1a1a" />
                  
                  {/* Indicador de tela (reflexo) */}
                  <ellipse cx="50" cy="20" rx="25" ry="8" fill="#ffffff" opacity="0.03" />
                </>
              ) : (
                <>
                  {/* Corpo externo - borda metálica */}
                  <rect x="2" y="0.5" width="96" height="199" rx="6" ry="6" fill="#2d2d2d" />
                  <rect x="3" y="1.5" width="94" height="197" rx="5.5" ry="5.5" fill="#0f0f0f" />
                  
                  {/* Tampa traseira */}
                  <rect x="4.5" y="3" width="91" height="194" rx="4" ry="4" fill="#0a0a0a" />
                  
                  {/* Textura da tampa */}
                  <defs>
                    <pattern id="backTexture" patternUnits="userSpaceOnUse" width="4" height="4">
                      <rect width="4" height="4" fill="#0a0a0a" />
                      <circle cx="2" cy="2" r="0.3" fill="#1a1a1a" opacity="0.3" />
                    </pattern>
                  </defs>
                  <rect x="4.5" y="3" width="91" height="194" rx="4" ry="4" fill="url(#backTexture)" />
                  
                  {/* Módulo de câmera */}
                  <rect x="34" y="4" width="32" height="14" rx="2.5" ry="2.5" fill="#000000" />
                  <rect x="35" y="5" width="30" height="12" rx="2" ry="2" fill="#0a0a0a" />
                  
                  {/* Lentes da câmera */}
                  <circle cx="40" cy="11" r="2.8" fill="#1a1a1a" stroke="#2d2d2d" strokeWidth="0.3" />
                  <circle cx="50" cy="11" r="2.5" fill="#1a1a1a" stroke="#2d2d2d" strokeWidth="0.3" />
                  <circle cx="60" cy="11" r="2" fill="#1a1a1a" stroke="#2d2d2d" strokeWidth="0.3" />
                  
                  {/* Flash */}
                  <rect x="45" y="17" width="8" height="3.5" rx="1" fill="#2d2d2d" />
                  
                  {/* Logo Apple */}
                  <path 
                    d="M 50 88 Q 50 85, 48 85 Q 46 85, 46 88 Q 46 91, 48 91 Q 50 91, 50 88 M 48 88 L 48 91" 
                    fill="#2d2d2d" 
                    opacity="0.5"
                    stroke="#2d2d2d"
                    strokeWidth="0.5"
                  />
                  
                  {/* Botões laterais */}
                  <rect x="0.5" y="18" width="2" height="12" rx="0.5" fill="#1a1a1a" />
                  <rect x="0.5" y="33" width="2" height="12" rx="0.5" fill="#1a1a1a" />
                  <rect x="97.5" y="26" width="2" height="14" rx="0.5" fill="#1a1a1a" />
                </>
              )}
              
              {/* Marcações X nos defeitos */}
              {sideDefects.map(defect => {
                const xPos = (defect.x / 100) * 100;
                const yPos = (defect.y / 100) * 200;
                const size = 5;
                
                return (
                  <g key={defect.id}>
                    {/* Sombra do X */}
                    <line
                      x1={xPos - size}
                      y1={yPos - size + 0.8}
                      x2={xPos + size}
                      y2={yPos + size + 0.8}
                      stroke="#000000"
                      strokeWidth="5"
                      strokeLinecap="round"
                      opacity="0.5"
                    />
                    <line
                      x1={xPos + size}
                      y1={yPos - size + 0.8}
                      x2={xPos - size}
                      y2={yPos + size + 0.8}
                      stroke="#000000"
                      strokeWidth="5"
                      strokeLinecap="round"
                      opacity="0.5"
                    />
                    {/* X vermelho brilhante */}
                    <line
                      x1={xPos - size}
                      y1={yPos - size}
                      x2={xPos + size}
                      y2={yPos + size}
                      stroke="#ef4444"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                    <line
                      x1={xPos + size}
                      y1={yPos - size}
                      x2={xPos - size}
                      y2={yPos + size}
                      stroke="#ef4444"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                    {/* Brilho interno do X */}
                    <line
                      x1={xPos - size * 0.6}
                      y1={yPos - size * 0.6}
                      x2={xPos + size * 0.6}
                      y2={yPos + size * 0.6}
                      stroke="#ffffff"
                      strokeWidth="1"
                      strokeLinecap="round"
                      opacity="0.6"
                    />
                    <line
                      x1={xPos + size * 0.6}
                      y1={yPos - size * 0.6}
                      x2={xPos - size * 0.6}
                      y2={yPos + size * 0.6}
                      stroke="#ffffff"
                      strokeWidth="1"
                      strokeLinecap="round"
                      opacity="0.6"
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col items-center justify-center w-full max-w-full min-w-0 box-border">
      {/* Frente e Traseira lado a lado - responsivo */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 md:gap-6 flex-1 w-full max-w-full min-w-0 box-border px-2">
        <div className="w-full sm:w-auto flex-shrink-0 min-w-0 max-w-full">
          {renderPhone('front')}
        </div>
        <div className="w-full sm:w-auto flex-shrink-0 min-w-0 max-w-full">
          {renderPhone('back')}
        </div>
      </div>
      
      {!readOnly && (
        <p className="text-xs sm:text-sm text-center text-muted-foreground mt-2 px-2 break-words">
          Clique no celular para marcar defeitos
        </p>
      )}
    </div>
  );
}

export function PhoneDrawingLegend() {
  return null;
}

export default PhoneDrawing;
