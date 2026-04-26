import { motion } from 'framer-motion';
import {
  FileCheck,
  ShoppingCart,
  Receipt,
  RefreshCw,
  Users,
  Wallet,
  Package,
  Box,
  ClipboardList,
  Archive,
  BarChart3,
  Bell,
  UserCog,
  Clock,
  Plug,
  Percent,
  CreditCard,
  MessageCircle,
  Send,
  FlaskConical,
} from 'lucide-react';

interface LandingModulosProps {
  onOpenDemo?: () => void;
}

const MODULOS = [
  { nome: 'Ordens de Serviço', desc: 'Abertura, status, histórico e link para o cliente acompanhar.', Icon: FileCheck },
  { nome: 'PDV', desc: 'Ponto de venda integrado com estoque e cupom.', Icon: ShoppingCart },
  { nome: 'Vendas', desc: 'Controle de vendas PDV e por OS.', Icon: Receipt },
  { nome: 'Devoluções', desc: 'Devoluções, trocas e vouchers de crédito.', Icon: RefreshCw },
  { nome: 'Clientes', desc: 'Cadastro e histórico por cliente.', Icon: Users },
  { nome: 'Caixa', desc: 'Abertura, fechamento, sangria e suprimento.', Icon: Wallet },
  { nome: 'Estoque', desc: 'Entrada, saída e controle de peças.', Icon: Package },
  { nome: 'Produtos', desc: 'Cadastro de produtos, grades e preços.', Icon: Box },
  { nome: 'Pedidos', desc: 'Pedidos de compra e gestão de fornecedores.', Icon: ClipboardList },
  { nome: 'Inventário', desc: 'Contagem e conferência de estoque.', Icon: Archive },
  { nome: 'Financeiro', desc: 'Contas a pagar, receber, DRE e fluxo de caixa.', Icon: BarChart3 },
  { nome: 'Relatórios', desc: 'Vendas, tendências e produtividade.', Icon: BarChart3 },
  { nome: 'Painel de Alertas', desc: 'Alertas automáticos no WhatsApp.', Icon: Bell },
  { nome: 'Recursos Humanos', desc: 'Gestão de pessoas, cargos e estrutura.', Icon: UserCog },
  { nome: 'Ponto Eletrônico', desc: 'Registro de ponto e controle de jornada.', Icon: Clock },
  { nome: 'Integrações', desc: 'APIs, webhooks e conexões com outros sistemas.', Icon: Plug },
  { nome: 'Taxas de pagamento', desc: 'Config de taxas para saber o lucro nos centavos.', Icon: Percent },
  { nome: 'Carteiras por forma de pagamento', desc: 'Carteira separada por forma de pagamento.', Icon: CreditCard },
  { nome: 'Integração WhatsApp (Ativa CRM)', desc: 'Conexão com WhatsApp para atendimento e alertas.', Icon: MessageCircle },
  { nome: 'Integração Telegram', desc: 'Alertas e notificações via Telegram.', Icon: Send },
];

export function LandingModulos({ onOpenDemo }: LandingModulosProps) {
  return (
    <section id="como-funciona" className="relative py-24 md:py-32 px-4 bg-[#07110D] scroll-mt-20">
      <div className="absolute inset-0 landing-bg-grid opacity-30" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(0,247,165,0.05),transparent_50%)]" />
      <div className="relative z-10 max-w-6xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#F5F7F6] text-center mb-4 tracking-tight"
        >
          Como o sistema organiza sua assistência
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.08 }}
          className="text-center text-[#9AA4A0] text-lg md:text-xl mb-16 max-w-2xl mx-auto"
        >
          Uma estrutura completa para você não perder nada de vista.
        </motion.p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
          {MODULOS.map((mod, i) => (
            <motion.div
              key={mod.nome}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-30px' }}
              transition={{ delay: (i % 6) * 0.05, duration: 0.4 }}
              className="group rounded-2xl bg-[#0B0F0D] border border-[#00F7A5]/15 p-5 hover:border-[#00F7A5]/35 hover:shadow-[0_0_30px_rgba(0,247,165,0.1)] transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-[#00F7A5]/10 border border-[#00F7A5]/20 flex items-center justify-center mb-3 group-hover:bg-[#00F7A5]/15">
                <mod.Icon className="w-6 h-6 text-[#00F7A5]" />
              </div>
              <h3 className="font-bold text-[#F5F7F6] text-base mb-1.5">{mod.nome}</h3>
              <p className="text-sm text-[#9AA4A0] leading-snug">{mod.desc}</p>
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
