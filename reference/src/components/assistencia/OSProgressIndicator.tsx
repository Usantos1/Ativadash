import { CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OSProgressIndicatorProps {
  etapas: {
    id: string;
    label: string;
    concluida: boolean;
  }[];
}

export function OSProgressIndicator({ etapas }: OSProgressIndicatorProps) {
  // Filtrar etapas: ocultar Financeiro no mobile
  const etapasVisiveis = etapas.filter(e => {
    // No mobile, ocultar financeiro usando CSS
    return true; // Mostrar todas, mas ocultar com CSS
  });

  // Calcular totais considerando apenas etapas visíveis no mobile
  const totalEtapasMobile = etapasVisiveis.filter(e => e.id !== 'financeiro').length;
  const totalEtapasDesktop = etapas.length;
  const etapasConcluidas = etapas.filter(e => e.concluida).length;
  
  // Percentual baseado no total de todas as etapas (incluindo financeiro)
  const percentual = totalEtapasDesktop > 0 ? (etapasConcluidas / totalEtapasDesktop) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs md:text-sm">
        <span className="text-muted-foreground">Progresso da OS</span>
        <span className="font-medium text-xs md:text-sm">
          <span className="md:hidden">{etapasConcluidas} de {totalEtapasMobile} etapas concluídas</span>
          <span className="hidden md:inline">{etapasConcluidas} de {totalEtapasDesktop} etapas concluídas</span>
        </span>
      </div>
      <div className="flex items-center gap-1 md:gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {etapasVisiveis.map((etapa, index) => (
          <div 
            key={etapa.id} 
            className={cn(
              "flex items-center gap-0.5 md:gap-1 flex-shrink-0 min-w-fit",
              etapa.id === 'financeiro' && "hidden md:flex"
            )}
          >
            <div className="flex items-center gap-1 md:gap-1.5">
              {etapa.concluida ? (
                <CheckCircle2 className="h-3.5 w-3.5 md:h-4 md:w-4 text-green-600 flex-shrink-0" />
              ) : (
                <Circle className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
              )}
              <span className={cn(
                "text-[10px] md:text-xs truncate whitespace-nowrap",
                etapa.concluida ? "text-green-600 font-medium" : "text-muted-foreground"
              )}>
                {etapa.label}
              </span>
            </div>
            {index < etapasVisiveis.length - 1 && (
              <div className={cn(
                "h-0.5 w-2 md:w-4 md:flex-1",
                etapa.concluida ? "bg-green-600" : "bg-muted"
              )} />
            )}
          </div>
        ))}
      </div>
      <div className="h-1.5 md:h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full bg-green-600 transition-all duration-300"
          style={{ width: `${percentual}%` }}
        />
      </div>
    </div>
  );
}

