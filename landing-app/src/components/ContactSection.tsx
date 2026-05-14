import { Calendar, MessageCircle, ShieldCheck } from "lucide-react";
import { LeadForm } from "./LeadForm";

export function ContactSection() {
  return (
    <section id="contato" className="relative scroll-mt-24 py-20">
      <div className="container-page">
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
          <aside className="lg:col-span-5">
            <span className="badge">Solicitar acesso</span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Vamos entender seu caso e abrir o painel
            </h2>
            <p className="mt-3 text-base text-slate-600">
              Preencha o formulário com seu contexto. Em até 1 dia útil, nosso time fala com você
              pelo WhatsApp para confirmar o melhor plano e iniciar o setup.
            </p>

            <ul className="mt-6 space-y-3 text-sm text-slate-700">
              <li className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <span>
                  <strong className="font-semibold text-slate-900">Atendimento humano via WhatsApp.</strong>
                  <span className="block text-slate-600">Nada de chatbot — fala direto com quem entende de tráfego.</span>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                  <Calendar className="h-4 w-4" />
                </span>
                <span>
                  <strong className="font-semibold text-slate-900">Onboarding guiado.</strong>
                  <span className="block text-slate-600">A gente acompanha sua primeira conexão, configuração de metas e personalização do painel do cliente.</span>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <span>
                  <strong className="font-semibold text-slate-900">Sem fidelidade, sem multa.</strong>
                  <span className="block text-slate-600">Se não fizer sentido, você pausa quando quiser. Seus dados continuam seus.</span>
                </span>
              </li>
            </ul>
          </aside>

          <div className="lg:col-span-7">
            <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-glow backdrop-blur sm:p-8">
              <LeadForm />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
