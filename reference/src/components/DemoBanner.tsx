import { useState, useEffect, useLayoutEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CTA_WHATSAPP, CTA_MSG } from '@/pages/landing/constants';
import { DEMO_SESSION_KEY } from '@/utils/demoMode';

const DEMO_TIMER_SECONDS = 60;

function isInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function isEmbedded(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('embed') === '1';
  } catch {
    return false;
  }
}

export function DemoBanner() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(DEMO_TIMER_SECONDS);
  const [showPostTimerModal, setShowPostTimerModal] = useState(false);
  const inIframe = useState(() => isInIframe())[0];
  const embedded = useState(() => isEmbedded())[0];

  useEffect(() => {
    try {
      if (isInIframe()) {
        setVisible(false);
        return;
      }
      setVisible(sessionStorage.getItem(DEMO_SESSION_KEY) === '1');
    } catch {
      setVisible(false);
    }
  }, []);

  // Interval: decrementa o timer a cada segundo; ao chegar em 0, abre o modal no mesmo fluxo
  useEffect(() => {
    if (!visible || dismissed || showPostTimerModal) return;
    if (secondsLeft <= 0) return;
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setShowPostTimerModal(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [visible, dismissed, secondsLeft, showPostTimerModal]);

  // Fallback: se o timer já estiver em 0 ao montar/atualizar, abrir o modal
  useLayoutEffect(() => {
    if (visible && !dismissed && secondsLeft <= 0) {
      setShowPostTimerModal(true);
    }
  }, [visible, dismissed, secondsLeft]);

  // Bloquear Escape para não fechar o modal (só fecha pelos botões)
  useEffect(() => {
    if (!showPostTimerModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [showPostTimerModal]);

  const handleDismiss = () => {
    setDismissed(true);
  };

  const handleAssinarWhatsApp = () => {
    window.open(`${CTA_WHATSAPP}?text=${encodeURIComponent(CTA_MSG)}`, '_blank', 'noopener,noreferrer');
  };

  const handleTestarMaisUmMinuto = () => {
    setSecondsLeft(DEMO_TIMER_SECONDS);
    setShowPostTimerModal(false);
  };

  // Quando está no iframe da LP (embed=1 ou inIframe), o banner já está na barra do modal — não duplicar
  if (embedded || inIframe) return null;
  if (!visible || dismissed) return null;

  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  const timerText = `${m}:${s.toString().padStart(2, '0')}`;

  return (
    <>
      {/* Banner no preto fora do sistema (topo da página) */}
      <div className="bg-[#0B0F0D] border-b border-[#00F7A5]/20 text-[#F5F7F6] flex flex-wrap items-center justify-center gap-x-4 gap-y-2 py-2.5 px-4 text-sm font-medium shrink-0">
        <span className="text-center">
          Você está na <strong className="text-[#00F7A5]">demonstração</strong>. Os dados são de exemplo. Para usar com seus dados, faça cadastro ou login.
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-[#9AA4A0]">Tempo restante</span>
          <span className="font-mono font-bold tabular-nums text-sm bg-[#07110D] text-[#00F7A5] rounded-full px-3 py-1 border border-[#00F7A5]/30">
            {timerText}
          </span>
        </div>
        <Button
          size="sm"
          onClick={handleAssinarWhatsApp}
          className="h-8 rounded-full font-semibold bg-[#00C27F] hover:opacity-90 text-[#0B0F0D] shrink-0 transition-opacity"
        >
          Assinar Agora
        </Button>
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-[#F5F7F6]"
          aria-label="Fechar demonstração"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Modal fixo: sem X, não fecha ao clicar fora nem com Escape — só pelos botões */}
      {showPostTimerModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="demo-modal-title"
          aria-describedby="demo-modal-desc"
        >
          <div
            className="rounded-2xl border border-gray-400 dark:border-gray-700 bg-background p-6 shadow-lg w-full max-w-sm gap-4 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="demo-modal-title" className="text-lg font-bold leading-none tracking-tight">
              Tempo da demonstração
            </h2>
            <p id="demo-modal-desc" className="text-sm text-muted-foreground">
              O tempo da demonstração acabou. Assine agora ou teste por mais 1 minuto.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleAssinarWhatsApp}
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
          </div>
        </div>
      )}
    </>
  );
}
