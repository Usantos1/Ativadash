import {
  BarChart3,
  Bell,
  GitBranch,
  Globe,
  PlugZap,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

const FEATURES = [
  {
    icon: BarChart3,
    title: "Painel executivo unificado",
    text: "Investimento, cliques, leads, vendas e ROAS de Meta + Google em uma só tela. Sem planilha, sem alternar abas.",
  },
  {
    icon: GitBranch,
    title: "Funil completo (captação → receita)",
    text: "Cada etapa rastreada com taxas reais entre fases. Identifique gargalos antes de queimar verba.",
  },
  {
    icon: Target,
    title: "Metas e alertas inteligentes",
    text: "Defina objetivos por canal, campanha ou conta. Receba alertas no WhatsApp/e-mail quando algo sair da meta.",
  },
  {
    icon: PlugZap,
    title: "Integrações nativas",
    text: "Meta Ads, Google Ads, GA4, WhatsApp, Hotmart, webhooks e CRM próprio (Ativa CRM). Conexão em minutos.",
  },
  {
    icon: Users,
    title: "Painel para cada cliente",
    text: "Para agências: cada cliente acessa só os dados dele, com branding da sua agência. White-label nativo.",
  },
  {
    icon: Bell,
    title: "Automação de regras",
    text: "Pause campanha quando CPA estourar. Avise o time quando lead parar. Crie regras visuais sem código.",
  },
  {
    icon: Globe,
    title: "Multi-tenant e revenda",
    text: "Operação multi-empresa, planos por cliente, gestão centralizada. Pensado para agências escalarem.",
  },
  {
    icon: Sparkles,
    title: "Setup em minutos",
    text: "OAuth direto com Meta e Google. Sem configuração de pixel ou trabalho de TI. Hoje você conecta, hoje você vê dado.",
  },
];

export function Features() {
  return (
    <section id="recursos" className="relative scroll-mt-24 py-20">
      <div className="container-page">
        <header className="mx-auto max-w-3xl text-center">
          <span className="badge">Recursos</span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Tudo que você precisa para tomar decisões em performance
          </h2>
          <p className="mt-3 text-base text-slate-600">
            Planejado por gestores de tráfego para gestores de tráfego: foco em decisão, não em
            relatório.
          </p>
        </header>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <article
              key={title}
              className="card transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-glow"
            >
              <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="text-base font-semibold text-slate-900">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
