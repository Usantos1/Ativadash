import { CheckCircle2, Lock, ServerCog, ShieldCheck } from "lucide-react";

const ITEMS = [
  {
    icon: ShieldCheck,
    title: "Você é dono dos seus dados",
    text: "Hospedagem dedicada e isolamento por organização. Sem black-box: você sabe onde a informação vive e pode auditar tudo.",
  },
  {
    icon: ServerCog,
    title: "Performance pensada para escala",
    text: "Cache inteligente, queries otimizadas e snapshots históricos — funciona com 1 ou 100 contas conectadas.",
  },
  {
    icon: Lock,
    title: "Acesso granular por papel",
    text: "Membros, agências e clientes finais com permissões finas. Auditoria de tudo: quem viu, quem mudou, quando.",
  },
  {
    icon: CheckCircle2,
    title: "Time brasileiro, suporte humano",
    text: "Atendimento por WhatsApp com gente que entende o que é uma meta de CPL e por que sua campanha parou de entregar.",
  },
];

export function Differentials() {
  return (
    <section className="relative py-20">
      <div className="container-page">
        <div className="overflow-hidden rounded-3xl border border-brand-200/70 bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 p-8 text-white shadow-glow sm:p-12">
          <header className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/90">
              Diferenciais
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Construído para quem leva performance a sério
            </h2>
            <p className="mt-3 text-base text-white/80">
              Não é mais uma planilha bonita. É um painel pensado para a operação real de quem investe em mídia.
            </p>
          </header>

          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {ITEMS.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="flex gap-3 rounded-2xl bg-white/10 p-5 backdrop-blur transition-colors hover:bg-white/15"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-semibold">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-white/80">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
