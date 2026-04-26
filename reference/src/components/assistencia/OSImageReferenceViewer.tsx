import { useState, useRef, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DefectPoint {
  id: string;
  x: number; // Posição X em % da imagem
  y: number; // Posição Y em % da imagem
}

interface OSImageReferenceViewerProps {
  imageUrl: string | null;
  defects: string[]; // Array de strings no formato "x-y" ou similar
  onDefectsChange: (defects: string[]) => void;
  readOnly?: boolean;
  /** 'veiculo' = oficina (veículo/carro); 'aparelho' = celular/equipamento */
  variant?: 'aparelho' | 'veiculo';
}

export function OSImageReferenceViewer({ 
  imageUrl, 
  defects, 
  onDefectsChange,
  readOnly = false,
  variant = 'aparelho'
}: OSImageReferenceViewerProps) {
  const refLabel = variant === 'veiculo' ? 'veículo' : 'aparelho';
  const configHint = variant === 'veiculo' ? 'Config. Status OS (imagem do veículo)' : 'Config. Status OS';
  const [defectPoints, setDefectPoints] = useState<DefectPoint[]>([]);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0, left: 0, top: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Converter defects (strings) para DefectPoint[]
  useEffect(() => {
    // Garantir que defects é um array
    const defectsArray = Array.isArray(defects) ? defects : [];
    
    if (defectsArray.length > 0) {
      const points: DefectPoint[] = defectsArray
        .map((defect, index) => {
          if (typeof defect !== 'string') return null;
          const parts = defect.split('-');
          if (parts.length >= 2) {
            return {
              id: `defect-${index}`,
              x: parseFloat(parts[0]) || 0,
              y: parseFloat(parts[1]) || 0,
            };
          }
          return null;
        })
        .filter((d): d is DefectPoint => d !== null);
      setDefectPoints(points);
    } else {
      setDefectPoints([]);
    }
  }, [defects]);

  // Atualizar dimensões da imagem quando carregada ou redimensionada
  const updateImageDimensions = useCallback(() => {
    if (imageRef.current && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const imgRect = imageRef.current.getBoundingClientRect();
      
      setImageDimensions({
        width: imgRect.width,
        height: imgRect.height,
        left: imgRect.left - containerRect.left,
        top: imgRect.top - containerRect.top,
      });
    }
  }, []);

  useEffect(() => {
    if (imageLoaded) {
      updateImageDimensions();
      // Também atualizar em resize
      window.addEventListener('resize', updateImageDimensions);
      return () => window.removeEventListener('resize', updateImageDimensions);
    }
  }, [imageLoaded, updateImageDimensions]);

  // Converter DefectPoint[] para strings
  const saveDefects = useCallback((points: DefectPoint[]) => {
    const defectStrings = points.map(p => `${p.x.toFixed(1)}-${p.y.toFixed(1)}`);
    onDefectsChange(defectStrings);
  }, [onDefectsChange]);

  const handleImageClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || !imageRef.current || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const imgRect = imageRef.current.getBoundingClientRect();

    // Calcular posição do clique relativa ao container
    const clickX = event.clientX - containerRect.left;
    const clickY = event.clientY - containerRect.top;

    // Calcular offset da imagem dentro do container
    const imgOffsetX = imgRect.left - containerRect.left;
    const imgOffsetY = imgRect.top - containerRect.top;

    // Calcular posição relativa à imagem (em %)
    const x = ((clickX - imgOffsetX) / imgRect.width) * 100;
    const y = ((clickY - imgOffsetY) / imgRect.height) * 100;

    // Verificar se clicou dentro da imagem
    if (x < 0 || x > 100 || y < 0 || y > 100) return;

    // Verificar se já existe um defeito próximo (dentro de 5%)
    const existingDefect = defectPoints.find(
      d => Math.abs(d.x - x) < 5 && Math.abs(d.y - y) < 5
    );

    if (existingDefect) {
      // Remover defeito existente
      const newPoints = defectPoints.filter(d => d.id !== existingDefect.id);
      setDefectPoints(newPoints);
      saveDefects(newPoints);
    } else {
      // Adicionar novo defeito
      const newDefect: DefectPoint = {
        id: `defect-${Date.now()}-${Math.random()}`,
        x,
        y,
      };
      const newPoints = [...defectPoints, newDefect];
      setDefectPoints(newPoints);
      saveDefects(newPoints);
    }
  }, [defectPoints, readOnly, saveDefects]);

  if (!imageUrl) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-4 text-muted-foreground">
        <X className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-xs">Nenhuma imagem de referência do {refLabel} configurada</p>
        <p className="text-xs mt-1">Configure em: {configHint}</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative w-full h-full flex items-center justify-center",
        !readOnly && "cursor-crosshair"
      )}
      onClick={handleImageClick}
    >
      <img
        ref={imageRef}
        src={imageUrl}
        alt={`Referência visual do ${refLabel} (clique para marcar defeitos)`}
        className="max-w-full max-h-full w-auto h-auto object-contain select-none"
        style={{ maxWidth: '100%', maxHeight: '100%' }}
        draggable={false}
        onLoad={() => {
          setImageLoaded(true);
          updateImageDimensions();
        }}
      />
      
      {/* Marcações X nos defeitos - posicionadas relativas à imagem */}
      {imageLoaded && imageDimensions.width > 0 && defectPoints.map(defect => {
        // Calcular posição em pixels relativa ao container
        const xPixel = imageDimensions.left + (defect.x / 100) * imageDimensions.width;
        const yPixel = imageDimensions.top + (defect.y / 100) * imageDimensions.height;
        
        return (
          <div
            key={defect.id}
            className="absolute pointer-events-none"
            style={{
              left: `${xPixel}px`,
              top: `${yPixel}px`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {/* Sombra do X */}
            <div className="absolute inset-0 flex items-center justify-center">
              <X className="h-6 w-6 text-black opacity-50" strokeWidth={4} />
            </div>
            {/* X vermelho brilhante */}
            <X 
              className="h-5 w-5 text-red-600 relative z-10" 
              strokeWidth={3}
            />
          </div>
        );
      })}
      
      {/* Nenhum elemento sobre a imagem - área totalmente livre para marcação */}
    </div>
  );
}

