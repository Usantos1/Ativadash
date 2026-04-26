import { motion } from 'framer-motion';
import { FlaskConical } from 'lucide-react';

interface LandingCTAProps {
  onOpenDemo?: () => void;
}

export function LandingCTA({ onOpenDemo }: LandingCTAProps) {
  return (
    <section className="relative py-24 md:py-32 px-4 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#07110D] via-[#030504] to-[#07110D]" />
      <div className="absolute inset-0 landing-bg-grid opacity-20" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-[#00F7A5] opacity-[0.08] blur-[100px]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(0,247,165,0.06),transparent_60%)]" />

      <div className="relative z-10 max-w-3xl mx-auto text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-[#F5F7F6] mb-6 tracking-tight leading-tight"
        >
          Pare de administrar sua assistência no improviso.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-[#9AA4A0] text-lg md:text-xl mb-10"
        >
          Teste o sistema agora e veja como sua assistência pode funcionar de forma organizada.
        </motion.p>

        {onOpenDemo && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="relative inline-block"
          >
            <div className="absolute -inset-4 rounded-3xl bg-[#00F7A5]/20 blur-2xl" />
            <motion.button
              type="button"
              onClick={onOpenDemo}
              whileHover={{ scale: 1.03, boxShadow: '0 0 50px rgba(0,247,165,0.4)' }}
              whileTap={{ scale: 0.98 }}
              className="landing-btn landing-btn-primary relative inline-flex items-center justify-center gap-3 px-10 py-5 font-bold text-lg md:text-xl border border-[#00F7A5]/40 rounded-full"
            >
              <FlaskConical className="w-6 h-6 shrink-0" />
              Conhecer o Sistema
            </motion.button>
          </motion.div>
        )}
      </div>
    </section>
  );
}
