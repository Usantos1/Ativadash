import { motion } from 'framer-motion';
import { RotateCcw, Gauge, LayoutGrid, Briefcase, LineChart, FlaskConical } from 'lucide-react';

interface LandingBenefitsProps {
  onOpenDemo?: () => void;
}

const BENEFITS = [
  { text: 'menos retrabalho', Icon: RotateCcw },
  { text: 'mais controle', Icon: Gauge },
  { text: 'mais organização', Icon: LayoutGrid },
  { text: 'mais profissionalismo', Icon: Briefcase },
  { text: 'mais visão do negócio', Icon: LineChart },
];

export function LandingBenefits({ onOpenDemo }: LandingBenefitsProps) {
  return (
    <section className="relative py-24 md:py-32 px-4 bg-[#07110D]">
      <div className="absolute inset-0 landing-bg-grid opacity-20" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(0,247,165,0.05),transparent_55%)]" />
      <div className="relative z-10 max-w-5xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#F5F7F6] text-center mb-14 md:mb-16 tracking-tight leading-tight"
        >
          Quando a assistência se organiza, tudo muda.
        </motion.h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-5">
          {BENEFITS.map((item, i) => (
            <motion.div
              key={item.text}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.45 }}
              className="group rounded-2xl landing-card-premium p-5 md:p-6 flex flex-col items-center text-center hover:border-[#00F7A5]/35 hover:shadow-[0_0_35px_rgba(0,247,165,0.12)] transition-all duration-300"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#00F7A5]/10 border border-[#00F7A5]/20 flex items-center justify-center mb-3 group-hover:bg-[#00F7A5]/15 group-hover:border-[#00F7A5]/30 transition-colors">
                <item.Icon className="w-7 h-7 text-[#00F7A5]" />
              </div>
              <span className="font-semibold text-[#F5F7F6] text-base md:text-lg">{item.text}</span>
            </motion.div>
          ))}
        </div>

        {onOpenDemo && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="flex flex-wrap justify-center gap-3 mt-14"
          >
            <motion.button
              type="button"
              onClick={onOpenDemo}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="landing-btn landing-btn-primary inline-flex items-center gap-2 px-6 py-3.5 font-semibold text-base border border-[#00F7A5]/40 rounded-full"
            >
              <FlaskConical className="w-4 h-4 shrink-0" />
              Acessar Demonstração
            </motion.button>
          </motion.div>
        )}
      </div>
    </section>
  );
}
