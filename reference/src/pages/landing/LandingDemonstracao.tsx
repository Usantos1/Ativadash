import { motion } from 'framer-motion';
import { FlaskConical, LayoutDashboard, FileCheck, ShoppingCart, Package, Wallet, BarChart3 } from 'lucide-react';

const EXPLORE_ITEMS = [
  { label: 'Dashboard', Icon: LayoutDashboard },
  { label: 'Ordens de serviço', Icon: FileCheck },
  { label: 'PDV', Icon: ShoppingCart },
  { label: 'Estoque', Icon: Package },
  { label: 'Financeiro', Icon: Wallet },
  { label: 'Relatórios', Icon: BarChart3 },
];

interface LandingDemonstracaoProps {
  onOpenDemo?: () => void;
}

export function LandingDemonstracao({ onOpenDemo }: LandingDemonstracaoProps) {
  return (
    <section className="relative py-24 md:py-32 px-4 landing-bg-base">
      <div className="absolute inset-0 landing-bg-grid opacity-30" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_100%,rgba(0,247,165,0.06),transparent_55%)]" />
      <div className="relative z-10 max-w-4xl mx-auto text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#F5F7F6] mb-4 tracking-tight"
        >
          Teste o sistema agora.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.08 }}
          className="text-[#9AA4A0] text-lg md:text-xl mb-8 max-w-2xl mx-auto leading-relaxed"
        >
          Explore o Ativa FIX em uma demonstração interativa. Você poderá navegar pelo sistema, ver o dashboard, abrir menus e entender como tudo funciona. Os dados são fictícios e reiniciam automaticamente.
        </motion.p>

        {onOpenDemo && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex justify-center mb-12"
          >
            <motion.button
              type="button"
              onClick={onOpenDemo}
              whileHover={{ scale: 1.03, boxShadow: '0 0 50px rgba(0,247,165,0.35)' }}
              whileTap={{ scale: 0.98 }}
              className="landing-btn landing-btn-primary inline-flex items-center gap-3 px-10 py-5 font-bold text-lg md:text-xl border border-[#00F7A5]/40 rounded-full"
            >
              <FlaskConical className="w-6 h-6 shrink-0" />
              Testar o Sistema
            </motion.button>
          </motion.div>
        )}

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 }}
          className="text-sm text-[#6D7873] mb-6"
        >
          Você poderá explorar:
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap justify-center gap-3 md:gap-4 mb-8"
        >
          {EXPLORE_ITEMS.map((item, i) => (
            <div
              key={item.label}
              className="flex items-center gap-2 rounded-xl bg-[#0B0F0D] border border-[#00F7A5]/15 px-4 py-2.5"
            >
              <item.Icon className="w-4 h-4 text-[#00F7A5]" />
              <span className="text-sm font-medium text-[#F5F7F6]">{item.label}</span>
            </div>
          ))}
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.25 }}
          className="text-xs text-[#6D7873] max-w-xl mx-auto"
        >
          Após alguns minutos aparecerá um aviso perguntando se deseja continuar testando ou assinar.
        </motion.p>
      </div>
    </section>
  );
}
