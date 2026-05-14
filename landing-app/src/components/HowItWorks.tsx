import { CheckCircle2, MonitorPlay, PlugZap } from "lucide-react";

const STEPS = [
  {
    icon: PlugZap,
    title: "1. Conecte seus canais",
    text: "OAuth com Meta e Google em 2 cliques. Configure WhatsApp, Hotmart e webhooks pra fechar a captura de leads e receita.",
  },
  {
    icon: CheckCircle2,
    title: "2. Defina metas e alertas",
    text: "Configure CPA, CPL, ROAS por canal/campanha. Crie regras: 'avise quando o CPA passar de R$ X' ou 'pause campanha sem entrega'.",
  },
  {
    icon: MonitorPlay,
    title: "3. Acompanhe em tempo real",
    text: "Painel executivo, funil de captação, conversão e receita. Cada cliente da sua agência acessa só os dados dele, com seu branding.",
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="relative scroll-mt-24 bg-white/60 py-20 backdrop-blur">
      <div className="container-page">
        <header className="mx-auto max-w-2xl text-center">
          <span className="badge">Como funciona</span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Do zero ao primeiro insight em menos de 15 minutos
          </h2>
          <p className="mt-3 text-base text-slate-600">
            Sem instalação. Sem desenvolvedor. Sem retrabalho de planilha.
          </p>
        </header>

        <ol className="mt-12 grid gap-4 lg:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }, idx) => (
            <li
              key={title}
              className="card relative flex flex-col gap-3"
            >
              <span className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white shadow-soft">
                {idx + 1}
              </span>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
              <p className="text-sm leading-relaxed text-slate-600">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
