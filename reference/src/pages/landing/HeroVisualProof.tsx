import { motion } from 'framer-motion';
import { useAnimatedNumber } from './useAnimatedNumber';
import { useState, useEffect } from 'react';

const CARD_BASE =
  'rounded-2xl bg-[#0B0F0D] border border-[#00F7A5]/20 shadow-xl backdrop-blur-sm text-[#F5F7F6] transition-all duration-300 hover:border-[#00F7A5]/40 hover:shadow-[0_0_30px_rgba(0,247,165,0.15)]';

function CardDashboard() {
  const vendas = useAnimatedNumber(2340, 2000, true, 0);
  const ticket = useAnimatedNumber(180, 2200, true, 0);
  const osAbertas = useAnimatedNumber(34, 1600, true, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className={`p-5 w-[240px] sm:w-[260px] shrink-0 ${CARD_BASE}`}
    >
      <div className="text-xs font-semibold text-[#9AA4A0] uppercase tracking-wider mb-4">Dashboard</div>
      <div className="space-y-3">
        <div className="flex justify-between items-baseline gap-2">
          <span className="text-sm text-[#6D7873]">Vendas do dia</span>
          <span className="font-bold text-[#00F7A5] text-lg">R$ {vendas.toLocaleString('pt-BR')}</span>
        </div>
        <div className="flex justify-between items-baseline gap-2">
          <span className="text-sm text-[#6D7873]">Ticket médio</span>
          <span className="font-semibold">R$ {ticket}</span>
        </div>
        <div className="flex justify-between items-baseline gap-2">
          <span className="text-sm text-[#6D7873]">OS abertas</span>
          <span className="font-semibold">{osAbertas}</span>
        </div>
      </div>
    </motion.div>
  );
}

function CardListaOS() {
  const items = [
    { num: 721, aparelho: 'iPhone 17 Pro', cliente: 'João', status: 'Em andamento' },
    { num: 720, aparelho: 'Moto G86', cliente: 'Maria', status: 'Aguardando' },
    { num: 719, aparelho: 'Samsung A56', cliente: 'Lucas', status: 'Finalizada' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.35 }}
      className={`p-5 w-[300px] sm:w-[320px] shrink-0 ${CARD_BASE}`}
    >
      <div className="text-xs font-semibold text-[#9AA4A0] uppercase tracking-wider mb-4">Ordens de serviço</div>
      <ul className="space-y-3">
        {items.map((row) => (
          <li key={row.num} className="flex justify-between items-center gap-2 text-sm py-1.5 border-b border-[#00F7A5]/10 last:border-0">
            <span className="text-[#6D7873] shrink-0 font-mono">#{row.num}</span>
            <span className="font-medium truncate flex-1 min-w-0" title={row.aparelho}>{row.aparelho}</span>
            <span className="text-[#9AA4A0] truncate max-w-[80px]" title={row.cliente}>{row.cliente}</span>
            <span className="text-xs text-[#00F7A5]/90 shrink-0">{row.status}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

function CardAlerta() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.45 }}
      className={`p-5 w-[280px] sm:w-[300px] shrink-0 ${CARD_BASE} border-[#00F7A5]/30`}
    >
      <div className="text-xs font-semibold text-[#00F7A5] uppercase tracking-wider mb-2">Alerta</div>
      <div className="text-base font-semibold mb-1">OS #719 finalizada</div>
      <div className="text-sm text-[#9AA4A0]">Cliente: Lucas</div>
      <div className="text-sm text-[#00F7A5] mt-1">Status: pronta para retirada</div>
    </motion.div>
  );
}

function CardFinanceiro() {
  const entradas = useAnimatedNumber(3800, 2400, true, 0);
  const saidas = useAnimatedNumber(1200, 2200, true, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.55 }}
      className={`p-5 w-[260px] sm:w-[280px] shrink-0 ${CARD_BASE}`}
    >
      <div className="text-xs font-semibold text-[#9AA4A0] uppercase tracking-wider mb-4">Caixa do dia</div>
      <div className="space-y-3">
        <div className="flex justify-between items-baseline gap-2">
          <span className="text-sm text-[#6D7873]">Entradas</span>
          <span className="font-bold text-[#00F7A5] text-lg">R$ {entradas.toLocaleString('pt-BR')}</span>
        </div>
        <div className="flex justify-between items-baseline gap-2">
          <span className="text-sm text-[#6D7873]">Saídas</span>
          <span className="font-semibold">R$ {saidas.toLocaleString('pt-BR')}</span>
        </div>
      </div>
    </motion.div>
  );
}

function LiveNotification({ text, sub, delay }: { text: string; sub: string; delay: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={visible ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.35 }}
      className="rounded-xl bg-[#0B0F0D] border border-[#00F7A5]/25 px-4 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.4)] text-sm text-[#F5F7F6]"
    >
      <div className="font-semibold">{text}</div>
      <div className="text-[#9AA4A0] text-xs">{sub}</div>
    </motion.div>
  );
}

export function HeroVisualProof() {
  return (
    <div className="relative w-full flex justify-center items-center">
      <div className="relative w-full max-w-[600px] min-h-[400px] sm:min-h-[460px] flex flex-col md:block items-center justify-center gap-5 md:gap-0 py-6">
        <div className="absolute top-0 left-0 z-30 flex flex-col gap-2 max-w-[220px]">
          <LiveNotification text="OS #722 criada" sub="Cliente: Ana • Entrada" delay={2500} />
          <LiveNotification text="OS #719 finalizada" sub="Pronta para retirada" delay={5500} />
        </div>

        <div className="hidden md:block absolute top-0 right-0 z-20">
          <CardAlerta />
        </div>
        <div className="flex flex-col md:flex-row items-center justify-center gap-5 md:gap-0 md:absolute md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-10">
          <div className="order-2 md:order-1 md:-mr-8">
            <CardListaOS />
          </div>
          <div className="order-1 md:order-2">
            <CardDashboard />
          </div>
        </div>
        <div className="hidden md:block absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
          <CardFinanceiro />
        </div>

        <div className="flex md:hidden flex-col gap-5 w-full max-w-[320px]">
          <CardAlerta />
          <CardFinanceiro />
        </div>
      </div>
    </div>
  );
}
