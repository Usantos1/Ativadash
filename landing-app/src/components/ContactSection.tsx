import { ArrowRight, Calendar, Clock, MessageCircle, ShieldCheck } from "lucide-react";
import { useLeadModal } from "./LeadModalContext";

export function ContactSection() {
  const { open } = useLeadModal();

  return (
    <section id="contato" className="relative scroll-mt-24 py-20">
      <div className="container-page">
        <div className="overflow-hidden rounded-3xl border border-brand-200/60 bg-white p-8 shadow-glow ring-1 ring-brand-100/60 sm:p-12">
          <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-7">
              <span className="badge">Solicitar acesso</span>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Vamos entender seu cenário e abrir o painel
              </h2>
              <p className="mt-3 text-base text-slate-600">
                Sem cadastro automático: a gente fala com você primeiro pra garantir que o plano e a estrutura
                fazem sentido. Em até 1 dia útil, retorno pelo WhatsApp.
              </p>

              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                <Bullet icon={MessageCircle} title="Atendimento humano">
                  Sem chatbot. Fala com gente que entende tráfego.
                </Bullet>
                <Bullet icon={Calendar} title="Onboarding guiado">
                  Acompanhamos sua primeira conexão e configuração.
                </Bullet>
                <Bullet icon={Clock} title="Sem fidelidade">
                  Pause quando quiser. Seus dados continuam seus.
                </Bullet>
                <Bullet icon={ShieldCheck} title="Dados isolados">
                  Cada workspace separado, com auditoria de acesso.
                </Bullet>
              </ul>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button type="button" onClick={open} className="btn-primary text-base">
                  Quero falar com o time
                  <ArrowRight className="h-4 w-4" />
                </button>
                <p className="text-xs text-slate-500">3 etapas rápidas · leva ~1 minuto</p>
              </div>
            </div>

            <aside className="lg:col-span-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">O que vai te perguntar</p>
                <ol className="mt-3 space-y-3 text-sm">
                  <Step n={1} title="Quem é você">
                    Nome, e-mail e WhatsApp pro contato.
                  </Step>
                  <Step n={2} title="Sobre o negócio">
                    Perfil (agência/cliente/autônomo), investimento mensal em ADS e tamanho da operação.
                  </Step>
                  <Step n={3} title="Objetivo">
                    O que você quer organizar/melhorar (opcional).
                  </Step>
                </ol>
                <p className="mt-4 text-xs text-slate-500">
                  Nada de "cadastro" gigante. O que faltar a gente puxa pelo WhatsApp.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}

function Bullet({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-sm text-slate-600">{children}</p>
      </div>
    </li>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">
        {n}
      </span>
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-xs text-slate-600">{children}</p>
      </div>
    </li>
  );
}
