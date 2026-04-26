import { motion } from 'framer-motion';
import { MessageCircle, Package, Wallet, HelpCircle, FlaskConical } from 'lucide-react';

interface LandingProblemProps {
  onOpenDemo?: () => void;
}

const PROBLEMS = [
  { title: 'Cliente perguntando status', desc: 'Ligação e WhatsApp o tempo todo.', Icon: HelpCircle },
  { title: 'Peça sumindo do estoque', desc: 'Não sabe o que tem nem o que falta.', Icon: Package },
  { title: 'Financeiro bagunçado', desc: 'Contas e caixa na cabeça ou no caderno.', Icon: Wallet },
  { title: 'WhatsApp virando suporte manual', desc: 'Responde a mesma pergunta dezenas de vezes.', Icon: MessageCircle },
];

export function LandingProblem({ onOpenDemo }: LandingProblemProps) {
  return (
    <section className="relative py-24 md:py-32 px-4 landing-bg-base">
      <div className="absolute inset-0 landing-bg-grid opacity-50" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_100%,rgba(0,247,165,0.04),transparent_60%)]" />
      <div className="relative z-10 max-w-6xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#F5F7F6] text-center mb-4 tracking-tight"
        >
          O problema não é falta de cliente.
          <br />
          <span className="text-[#00F7A5]">É falta de organização.</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="text-center text-[#9AA4A0] text-lg md:text-xl mb-16 max-w-2xl mx-auto"
        >
          Quando a assistência começa a crescer, a bagunça cresce junto.
        </motion.p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
          {PROBLEMS.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: i * 0.08, duration: 0.45 }}
              className="group landing-card-premium p-6 md:p-7 flex flex-col rounded-2xl border border-[#00F7A5]/15 hover:border-[#00F7A5]/35 hover:shadow-[0_0_40px_rgba(0,247,165,0.12)] transition-all duration-300"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#00F7A5]/10 border border-[#00F7A5]/20 flex items-center justify-center mb-4 group-hover:bg-[#00F7A5]/15 group-hover:border-[#00F7A5]/30 transition-colors">
                <item.Icon className="w-7 h-7 text-[#00F7A5]" />
              </div>
              <h3 className="font-bold text-[#F5F7F6] text-lg md:text-xl mb-2">{item.title}</h3>
              <p className="text-sm md:text-base text-[#6D7873] leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="text-center text-[#6D7873] font-medium mt-14 text-lg"
        >
          Sem sistema, tudo vira improviso.
        </motion.p>

        {onOpenDemo && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap justify-center gap-3 mt-10"
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
