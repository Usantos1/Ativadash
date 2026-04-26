import { motion } from 'framer-motion';
import { FlaskConical } from 'lucide-react';
import { HeroVisualProof } from './HeroVisualProof';

const VALUE_LINE = 'PDV • OS • Estoque • Gestão • Financeiro • Relógio de ponto • Relatórios • Alertas';

interface LandingHeroProps {
  onOpenDemo?: () => void;
}

export function LandingHero({ onOpenDemo }: LandingHeroProps) {
  return (
    <section className="relative min-h-screen flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-16 px-4 pt-28 pb-20 overflow-hidden">
      <div className="absolute inset-0 landing-bg-base landing-bg-grid landing-hero-noise" />
      <div className="absolute inset-0 landing-glow-hero" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(0,247,165,0.08),transparent_50%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#07110D]" />

      <div className="relative z-10 w-full max-w-2xl flex flex-col items-center lg:items-start text-center lg:text-left">
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-2xl sm:text-3xl md:text-4xl lg:text-4xl xl:text-5xl font-extrabold leading-[1.15] tracking-tight text-[#F5F7F6] mb-4"
        >
          O improviso faz sua assistência perder dinheiro todos os dias.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="text-lg sm:text-xl text-[#9AA4A0] mb-2 max-w-lg leading-snug"
        >
          Ordem de Serviço no papel, cliente cobrando status, peça sumindo, risco de entregar aparelho errado e lucro desaparecendo no meio de taxa, despesa e desorganização.
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-base sm:text-lg text-[#00F7A5] font-medium mb-3 max-w-lg"
        >
          O Ativa FIX coloca ordem na sua assistência com controle de OS, estoque, vendas, caixa e financeiro em um só lugar.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.5 }}
          className="text-sm font-medium text-[#6D7873] mb-8"
        >
          {VALUE_LINE}
        </motion.p>

        {onOpenDemo && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="flex flex-col sm:flex-row items-stretch sm:items-center w-full sm:w-auto"
          >
            <motion.button
              type="button"
              onClick={onOpenDemo}
              whileHover={{ scale: 1.02, boxShadow: '0 0 40px rgba(0,247,165,0.35)' }}
              whileTap={{ scale: 0.98 }}
              className="landing-btn landing-btn-primary inline-flex items-center justify-center gap-3 px-8 py-4 font-bold text-base border border-[#00F7A5]/40 rounded-full w-full sm:w-auto"
            >
              <FlaskConical className="w-5 h-5 shrink-0" />
              Testar grátis
            </motion.button>
          </motion.div>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="relative z-10 w-full max-w-[620px] flex justify-center lg:justify-end"
      >
        <HeroVisualProof />
      </motion.div>
    </section>
  );
}
