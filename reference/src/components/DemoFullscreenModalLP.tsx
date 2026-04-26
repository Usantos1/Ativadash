import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { APP_URL, CTA_WHATSAPP, CTA_MSG } from '@/pages/landing/constants';

const DEMO_TIMER_SECONDS = 60;
const DEMO_IFRAME_URL = `${APP_URL}/demo?auto=1&embed=1`;

interface DemoFullscreenModalLPProps {
  open: boolean;
  onClose: () => void;
  onAssinar: () => void;
}

export function DemoFullscreenModalLP({ open, onClose, onAssinar }: DemoFullscreenModalLPProps) {
  const [secondsLeft, setSecondsLeft] = useState(DEMO_TIMER_SECONDS);
  const [showTimeUpModal, setShowTimeUpModal] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSecondsLeft(DEMO_TIMER_SECONDS);
    setShowTimeUpModal(false);
  }, [open]);

  useEffect(() => {
    if (!open || secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [open, secondsLeft]);

  useEffect(() => {
    if (open && secondsLeft <= 0) setShowTimeUpModal(true);
  }, [open, secondsLeft]);

  // Bloquear Escape no modal "tempo acabou" (só fecha pelos botões)
  useEffect(() => {
    if (!showTimeUpModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [showTimeUpModal]);

  const handleAssinar = () => {
    window.open(`${CTA_WHATSAPP}?text=${encodeURIComponent(CTA_MSG)}`, '_blank', 'noopener,noreferrer');
    onAssinar?.();
  };

  const handleTestarMaisUmMinuto = () => {
    setSecondsLeft(DEMO_TIMER_SECONDS);
    setShowTimeUpModal(false);
  };

  if (!open) return null;

  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  const timerText = `${m}:${s.toString().padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#030504]">
      {/* Banner no preto fora do sistema (igual ao do app) */}
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
          onClick={handleAssinar}
          className="h-8 rounded-full font-semibold bg-[#00C27F] hover:opacity-90 text-[#0B0F0D] shrink-0 transition-opacity"
        >
          Assinar Agora
        </Button>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-[#F5F7F6]"
          aria-label="Fechar demonstração"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <iframe
        src={DEMO_IFRAME_URL}
        title="Ativa FIX Demonstração"
        className="flex-1 w-full min-h-0 border-0"
        allow="fullscreen"
      />

      {/* Modal "tempo acabou": sem X, não fecha ao clicar fora nem com Escape — só pelos botões */}
      {showTimeUpModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lp-demo-modal-title"
          aria-describedby="lp-demo-modal-desc"
        >
          <div
            className="rounded-2xl border border-[#00F7A5]/30 bg-[#0B0F0D] p-6 shadow-lg w-full max-w-sm gap-4 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="lp-demo-modal-title" className="text-lg font-bold leading-none tracking-tight text-[#F5F7F6]">
              Tempo da demonstração
            </h2>
            <p id="lp-demo-modal-desc" className="text-sm text-[#9AA4A0]">
              O tempo da demonstração acabou. Assine agora ou teste por mais 1 minuto.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleAssinar}
                className="w-full h-12 rounded-full font-semibold bg-[#00C27F] hover:opacity-90 text-white transition-opacity"
              >
                Assinar Agora
              </Button>
              <Button
                variant="outline"
                onClick={handleTestarMaisUmMinuto}
                className="w-full h-12 rounded-full font-semibold border-2 border-[#00F7A5]/50 bg-[#07110D] text-[#F5F7F6] hover:bg-[#00F7A5]/15 hover:border-[#00F7A5]/70 hover:text-white"
              >
                Testar por mais 1 minuto
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
