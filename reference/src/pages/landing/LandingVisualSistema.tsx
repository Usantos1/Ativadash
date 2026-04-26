import { motion } from 'framer-motion';
import { FlaskConical } from 'lucide-react';
import { useAnimatedNumber } from './useAnimatedNumber';

interface LandingVisualSistemaProps {
  onOpenDemo?: () => void;
}

export function LandingVisualSistema({ onOpenDemo }: LandingVisualSistemaProps) {
  const receita = useAnimatedNumber(317974, 2500, true, 0);
  const pdv = useAnimatedNumber(317974, 2600, true, 0);
  const os = useAnimatedNumber(0, 500, true, 0);
  const ticket = useAnimatedNumber(295, 2200, true, 0);

  return (
    <section className="relative py-24 md:py-32 px-4 landing-bg-base">
      <div className="absolute inset-0 landing-bg-grid opacity-40" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,rgba(0,247,165,0.06),transparent_60%)]" />
      <div className="relative z-10 max-w-5xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#F5F7F6] text-center mb-4 tracking-tight"
        >
          Interface real do sistema
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.08 }}
          className="text-center text-[#9AA4A0] text-lg md:text-xl mb-14 max-w-2xl mx-auto"
        >
          Indicadores financeiros, gráfico de vendas, ticket médio e controle de estoque — como você verá no sistema.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-2xl bg-[#0B0F0D] border-2 border-[#00F7A5]/25 overflow-hidden shadow-[0_0_60px_rgba(0,247,165,0.08)]"
        >
          <div className="p-4 border-b border-[#00F7A5]/15 bg-[#07110D]/80">
            <span className="text-sm font-semibold text-[#9AA4A0]">Indicadores Financeiros</span>
          </div>
          <div className="p-6 md:p-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
              <div className="rounded-xl bg-[#07110D] border border-[#00F7A5]/15 p-4">
                <p className="text-xs text-[#9AA4A0] font-medium mb-1">Receita Total</p>
                <p className="text-xl md:text-2xl font-bold text-[#00F7A5]">
                  R$ {receita.toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="rounded-xl bg-[#07110D] border border-[#00F7A5]/15 p-4">
                <p className="text-xs text-[#9AA4A0] font-medium mb-1">Vendas PDV</p>
                <p className="text-xl md:text-2xl font-bold text-[#F5F7F6]">
                  R$ {pdv.toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="rounded-xl bg-[#07110D] border border-[#00F7A5]/15 p-4">
                <p className="text-xs text-[#9AA4A0] font-medium mb-1">Vendas OS</p>
                <p className="text-xl md:text-2xl font-bold text-[#F5F7F6]">R$ {os.toLocaleString('pt-BR')}</p>
              </div>
              <div className="rounded-xl bg-[#07110D] border border-[#00F7A5]/15 p-4">
                <p className="text-xs text-[#9AA4A0] font-medium mb-1">Ticket Médio</p>
                <p className="text-xl md:text-2xl font-bold text-[#F5F7F6]">R$ {ticket}</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-xl bg-[#07110D] border border-[#00F7A5]/15 p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#9AA4A0] font-medium mb-1">Estoque Baixo</p>
                  <p className="text-lg font-bold text-[#F5F7F6]">0 produtos</p>
                  <p className="text-xs text-[#6D7873] mt-1">Produtos com menos de 5 unidades</p>
                </div>
              </div>
              <div className="rounded-xl bg-[#07110D] border border-[#00F7A5]/15 p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#9AA4A0] font-medium mb-1">Caixa Aberto</p>
                  <p className="text-lg font-bold text-[#F5F7F6]">Não</p>
                  <p className="text-xs text-[#6D7873] mt-1">Caixa está fechado</p>
                </div>
              </div>
            </div>
            <div className="mt-6 h-32 rounded-xl bg-[#07110D] border border-[#00F7A5]/10 flex items-center justify-center">
              <span className="text-sm text-[#6D7873]">Gráfico de vendas (tendência)</span>
            </div>
          </div>
        </motion.div>

        {onOpenDemo && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
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
