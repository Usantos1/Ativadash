import { motion } from 'framer-motion';
import { X, Check, FileText, LayoutGrid, Package, BookOpen, MessageSquare } from 'lucide-react';

const IMPROVISO = [
  { text: 'OS em papel', Icon: FileText },
  { text: 'Planilha bagunçada', Icon: LayoutGrid },
  { text: 'Estoque confuso', Icon: Package },
  { text: 'Financeiro no caderno', Icon: BookOpen },
  { text: 'Cliente cobrando status', Icon: MessageSquare },
];

const SISTEMA = [
  { text: 'OS organizada', Icon: FileText },
  { text: 'Estoque rastreado', Icon: Package },
  { text: 'Financeiro claro', Icon: BookOpen },
  { text: 'Relatórios automáticos', Icon: LayoutGrid },
  { text: 'Alertas no WhatsApp', Icon: MessageSquare },
];

export function LandingComparison() {
  return (
    <section className="relative py-24 md:py-32 px-4 landing-bg-base">
      <div className="absolute inset-0 landing-bg-grid opacity-30" />
      <div className="relative z-10 max-w-5xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#F5F7F6] text-center mb-16 tracking-tight"
        >
          Improviso <span className="text-[#6D7873]">vs</span> Sistema
        </motion.h2>

        <div className="grid md:grid-cols-2 gap-6 md:gap-10">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="landing-card-premium p-6 md:p-8 border-[#6D7873]/25"
          >
            <h3 className="text-xl font-bold text-[#6D7873] mb-6 flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-[#6D7873]/20 flex items-center justify-center">
                <X className="w-5 h-5" />
              </span>
              Improviso
            </h3>
            <ul className="space-y-4">
              {IMPROVISO.map((item, i) => (
                <li key={item.text} className="flex items-center gap-3 text-[#9AA4A0]">
                  <item.Icon className="w-5 h-5 text-[#6D7873] shrink-0" />
                  {item.text}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="landing-card-premium p-6 md:p-8 border-[#00F7A5]/25"
          >
            <h3 className="text-xl font-bold text-[#00F7A5] mb-6 flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-[#00F7A5]/15 flex items-center justify-center">
                <Check className="w-5 h-5" />
              </span>
              Sistema
            </h3>
            <ul className="space-y-4">
              {SISTEMA.map((item, i) => (
                <li key={item.text} className="flex items-center gap-3 text-[#F5F7F6]">
                  <item.Icon className="w-5 h-5 text-[#00F7A5] shrink-0" />
                  {item.text}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
