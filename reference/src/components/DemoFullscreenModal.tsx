import { useState, useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DEMO_TIMER_SECONDS = 60;

interface DemoFullscreenModalProps {
  onClose: () => void;
  onAssinar: () => void;
}

export function DemoFullscreenModal({ onClose, onAssinar }: DemoFullscreenModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(DEMO_TIMER_SECONDS);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (secondsLeft <= 0) {
      setExpired(true);
      return;
    }
    const t = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  const handleTestarMaisUmMinuto = () => {
    setSecondsLeft(DEMO_TIMER_SECONDS);
    setExpired(false);
  };

  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  const timerText = `${m}:${s.toString().padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl border-2 border-[#00F7A5]/40 bg-card shadow-2xl p-6 md:p-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted transition-colors"
          aria-label="Fechar e voltar à página inicial"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center gap-6">
          <div className="flex items-center gap-2 text-[#00C27F]">
            <Sparkles className="w-8 h-8" />
            <span className="text-lg font-semibold">Demonstração</span>
          </div>

          {!expired ? (
            <>
              <p className="text-base text-muted-foreground leading-relaxed">
                Você está na <strong className="text-foreground">demonstração</strong>. Os dados são de exemplo.
                Para usar com seus dados, faça cadastro ou login.
              </p>

              <div className="flex flex-col items-center gap-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Tempo restante</span>
                <div
                  className="text-3xl font-mono font-bold tabular-nums text-foreground bg-muted rounded-xl px-6 py-3 min-w-[120px]"
                  aria-live="polite"
                >
                  {timerText}
                </div>
                <p className="text-xs text-muted-foreground">
                  Após 1 minuto você será redirecionado à página inicial.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <Button
                  onClick={onAssinar}
                  className="flex-1 h-12 rounded-full text-base font-semibold bg-[#00C27F] hover:opacity-90 text-white transition-opacity"
                >
                  Assinar Agora
                </Button>
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1 h-12 rounded-full text-base font-semibold border-2"
                >
                  Fechar e voltar à LP
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-base text-muted-foreground leading-relaxed">
                O tempo da demonstração acabou. Assine agora ou teste por mais 1 minuto.
              </p>
              <div className="flex flex-col gap-3 w-full">
                <Button
                  onClick={onAssinar}
                  className="w-full h-12 rounded-full font-semibold bg-[#00C27F] hover:opacity-90 text-white transition-opacity"
                >
                  Assinar Agora
                </Button>
                <Button
                  variant="outline"
                  onClick={handleTestarMaisUmMinuto}
                  className="w-full h-12 rounded-full font-semibold border-2 border-[#00F7A5]/50 bg-[#0B0F0D] text-[#F5F7F6] hover:bg-[#00F7A5]/15 hover:border-[#00F7A5]/70 hover:text-white dark:bg-[#0B0F0D] dark:text-[#F5F7F6] dark:hover:text-white"
                >
                  Testar por mais 1 minuto
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
