import { motion } from 'framer-motion';
import { FileCheck, Package, Wallet, ShoppingCart, BarChart3, Bell, FlaskConical } from 'lucide-react';

interface LandingFeaturesProps {
  onOpenDemo?: () => void;
}

const FEATURES = [
  {
    icon: FileCheck,
    title: 'Ordens de serviço',
    items: ['Abertura rápida', 'Histórico do aparelho', 'Status da manutenção', 'Link para cliente acompanhar'],
  },
  {
    icon: Package,
    title: 'Estoque de peças',
    items: ['Entrada e saída', 'Cadastro de peças', 'Controle de custo', 'Alertas de estoque baixo'],
  },
  {
    icon: Wallet,
    title: 'Financeiro completo',
    items: ['Caixa diário', 'Contas a pagar', 'Contas a receber', 'Fluxo de caixa', 'DRE'],
  },
  {
    icon: ShoppingCart,
    title: 'PDV integrado',
    items: ['Venda de acessórios', 'Cupom de venda', 'Integração com estoque'],
  },
  {
    icon: BarChart3,
    title: 'Relatórios',
    items: ['Vendas do dia', 'Ticket médio', 'Resultados da assistência'],
  },
  {
    icon: Bell,
    title: 'Painel de Alertas',
    items: [
      'Alertas automáticos: OS aberta, OS finalizada, caixa fechado, contas vencendo, vendas realizadas.',
      'Direto no WhatsApp.',
    ],
  },
];

export function LandingFeatures({ onOpenDemo }: LandingFeaturesProps) {
  return (
    <section className="relative py-24 md:py-32 px-4 bg-[#07110D]">
      <div className="absolute inset-0 landing-bg-grid opacity-30" />
      <div className="relative z-10 max-w-6xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#F5F7F6] text-center mb-4 tracking-tight"
        >
          O Ativa FIX organiza toda a operação da sua assistência.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.08 }}
          className="text-center text-[#9AA4A0] text-lg md:text-xl mb-3"
        >
          Ordens de serviço, estoque, financeiro e vendas funcionando juntos.
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.12 }}
          className="text-center text-[#00F7A5] font-semibold text-lg mb-16"
        >
          Sem papel. Sem planilha. Sem bagunça.
        </motion.p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ delay: (i % 3) * 0.08, duration: 0.5 }}
              className="landing-card-premium p-6 md:p-8 backdrop-blur-sm"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#00F7A5]/10 border border-[#00F7A5]/20 flex items-center justify-center mb-5">
                <feature.icon className="w-7 h-7 text-[#00F7A5]" />
              </div>
              <h3 className="text-xl font-bold text-[#F5F7F6] mb-4">{feature.title}</h3>
              <ul className="space-y-3">
                {feature.items.map((li) => (
                  <li key={li} className="text-[#9AA4A0] text-base flex items-start gap-2 leading-snug">
                    <span className="text-[#00F7A5] mt-1.5 shrink-0">•</span>
                    {li}
                  </li>
                ))}
              </ul>
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
              Conhecer o Sistema
            </motion.button>
          </motion.div>
        )}
      </div>
    </section>
  );
}
