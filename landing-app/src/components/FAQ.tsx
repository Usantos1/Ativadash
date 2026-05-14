import { ChevronDown } from "lucide-react";

const QUESTIONS: Array<{ q: string; a: string }> = [
  {
    q: "Quanto tempo leva pra colocar no ar?",
    a: "Em média 10 a 15 minutos para a primeira conta conectada. O OAuth com Meta e Google é direto, sem precisar configurar pixel ou pedir TI.",
  },
  {
    q: "Vocês atendem agências com vários clientes?",
    a: "Sim — esse é um dos focos principais. Cada cliente vira um workspace isolado, com painel próprio (white-label) e permissões granulares. A central matriz gerencia planos, acessos e auditoria.",
  },
  {
    q: "Quais integrações já estão prontas?",
    a: "Meta Ads, Google Ads (incluindo MCC), GA4, WhatsApp, Hotmart e webhooks customizados. Outras integrações entram conforme demanda — fala com a gente no formulário.",
  },
  {
    q: "Como funciona o pagamento?",
    a: "Plano mensal por organização, com limites de usuários, dashboards, integrações e contas filhas. Sem fidelidade, sem multa. O time comercial passa o melhor plano após entender o caso.",
  },
  {
    q: "Os dados ficam onde?",
    a: "Servidores dedicados no Brasil. Você é dono dos dados, com isolamento por organização e auditoria de quem acessou o quê. Suporta exclusão completa quando solicitada (LGPD).",
  },
  {
    q: "Tem trial grátis?",
    a: "Tem onboarding guiado para times qualificados. Pelo formulário, a gente valida o caso de uso e abre acesso para você testar com seus próprios dados.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="relative scroll-mt-24 py-20">
      <div className="container-page">
        <header className="mx-auto max-w-2xl text-center">
          <span className="badge">Perguntas frequentes</span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Dúvidas comuns
          </h2>
        </header>

        <div className="mx-auto mt-10 max-w-3xl divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white shadow-soft">
          {QUESTIONS.map((item, idx) => (
            <details key={item.q} className="group p-5" open={idx === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left">
                <span className="text-base font-semibold text-slate-900">{item.q}</span>
                <ChevronDown className="h-5 w-5 shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
