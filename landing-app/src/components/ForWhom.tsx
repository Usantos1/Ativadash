import { Building2, Megaphone, User } from "lucide-react";

const PERSONAS = [
  {
    icon: Megaphone,
    title: "Agências e gestores de tráfego",
    bullets: [
      "Painel separado para cada cliente, com seu branding",
      "Multi-conta Meta e Google (incluindo MCC) sem trabalho",
      "Revenda de planos com central matriz/filial",
      "Auditoria de acessos e impersonation seguro",
    ],
  },
  {
    icon: Building2,
    title: "Empresas e e-commerces",
    bullets: [
      "Visão unificada do funil — sem depender da agência",
      "Receita real (Hotmart/checkout) cruzada com investimento",
      "Metas e alertas por canal, campanha ou produto",
      "Histórico e snapshots para auditoria de performance",
    ],
  },
  {
    icon: User,
    title: "Profissionais autônomos",
    bullets: [
      "Suba planilha pra história — tenha um painel de verdade",
      "Compartilhe links públicos de relatório com o cliente",
      "Alertas no WhatsApp quando algo sair da meta",
      "Plano com tudo o que importa, sem inflar custo",
    ],
  },
];

export function ForWhom() {
  return (
    <section id="para-quem" className="relative scroll-mt-24 py-20">
      <div className="container-page">
        <header className="mx-auto max-w-2xl text-center">
          <span className="badge">Para quem é</span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Pensado para quem vive de performance
          </h2>
          <p className="mt-3 text-base text-slate-600">
            Da operação solo até a agência com dezenas de clientes — o mesmo painel, o mesmo rigor.
          </p>
        </header>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {PERSONAS.map(({ icon: Icon, title, bullets }) => (
            <article
              key={title}
              className="card flex h-full flex-col"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
              <ul className="mt-3 flex flex-1 flex-col gap-2 text-sm text-slate-600">
                {bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
