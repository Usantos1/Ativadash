import { useState } from "react";
import { BellRing, GitBranch, Layers, Plug2 } from "lucide-react";
import { MockupFrame } from "./MockupFrame";
import { FunnelMockup } from "./mockups/FunnelMockup";
import { AlertsMockup } from "./mockups/AlertsMockup";
import { ResellerMockup } from "./mockups/ResellerMockup";
import { IntegrationsMockup } from "./mockups/IntegrationsMockup";

type TabKey = "funnel" | "alerts" | "reseller" | "integrations";

const TABS: Array<{
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  url: string;
  title: string;
  desc: string;
}> = [
  {
    key: "funnel",
    label: "Funil unificado",
    icon: GitBranch,
    url: "app.ativadash.com/marketing/captacao",
    title: "Funil que cruza ADS com receita real",
    desc: "Uma única visão da captação à venda — Meta + Google + Hotmart no mesmo gráfico, com taxas entre etapas calculadas automaticamente.",
  },
  {
    key: "alerts",
    label: "Alertas + Automação",
    icon: BellRing,
    url: "app.ativadash.com/ads/metas-alertas",
    title: "Regras que avisam (e agem) por você",
    desc: "Defina metas e thresholds. Quando o CPA estourar, o WhatsApp toca. Pode até pausar campanha sozinho — você define até onde.",
  },
  {
    key: "reseller",
    label: "Multi-cliente / Revenda",
    icon: Layers,
    url: "app.ativadash.com/revenda/contas",
    title: "Cada cliente, seu painel — sua marca",
    desc: "Para agências: isole dados por workspace, controle planos e usuários da matriz, audite acessos. White-label nativo.",
  },
  {
    key: "integrations",
    label: "Integrações",
    icon: Plug2,
    url: "app.ativadash.com/marketing/integracoes",
    title: "Setup em minutos, não em semanas",
    desc: "OAuth com Meta e Google (incluindo MCC), WhatsApp/Ativa CRM, Hotmart, webhooks customizados. Sem precisar de dev.",
  },
];

export function ProductTour() {
  const [active, setActive] = useState<TabKey>("funnel");
  const current = TABS.find((t) => t.key === active) ?? TABS[0];

  return (
    <section id="recursos" className="relative scroll-mt-24 py-20">
      <div className="container-page">
        <header className="mx-auto max-w-3xl text-center">
          <span className="badge">Tour pelo sistema</span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Veja telas reais do que você vai usar todo dia
          </h2>
          <p className="mt-3 text-base text-slate-600">
            Cada aba abaixo é uma tela do app — sem stock photo, sem tela genérica. É o que sua equipe vai
            abrir.
          </p>
        </header>

        <div
          role="tablist"
          aria-label="Tour pelo sistema"
          className="mt-10 flex flex-wrap items-center justify-center gap-2"
        >
          {TABS.map(({ key, label, icon: Icon }) => {
            const isActive = active === key;
            return (
              <button
                key={key}
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${key}`}
                id={`tab-${key}`}
                onClick={() => setActive(key)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                  isActive
                    ? "border-brand-500 bg-brand-50 text-brand-800"
                    : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-slate-900"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>

        <div className="mt-8 grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
          <div className="order-2 lg:order-1 lg:col-span-4">
            <h3 className="text-2xl font-bold tracking-tight text-slate-900">{current.title}</h3>
            <p className="mt-3 text-base leading-relaxed text-slate-600">{current.desc}</p>
            <ul className="mt-5 space-y-2 text-sm text-slate-600">
              {bulletsFor(current.key).map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <div
            role="tabpanel"
            id={`tabpanel-${current.key}`}
            aria-labelledby={`tab-${current.key}`}
            className="order-1 lg:order-2 lg:col-span-8"
          >
            <div className="relative">
              <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-brand-300/30 via-brand-200/20 to-transparent blur-2xl" aria-hidden />
              <MockupFrame url={current.url}>
                {active === "funnel" ? <FunnelMockup /> : null}
                {active === "alerts" ? <AlertsMockup /> : null}
                {active === "reseller" ? <ResellerMockup /> : null}
                {active === "integrations" ? <IntegrationsMockup /> : null}
              </MockupFrame>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function bulletsFor(key: TabKey): string[] {
  switch (key) {
    case "funnel":
      return [
        "Investimento × leads × vendas no mesmo período",
        "Taxas etapa-a-etapa para encontrar gargalo",
        "Drill-down por canal, campanha e produto",
      ];
    case "alerts":
      return [
        "Alertas por CPA, CPL, ROAS, sem-entrega, anomalias",
        "Notificação no WhatsApp e e-mail",
        "Auto-pausar campanha (opcional, com confirmação)",
      ];
    case "reseller":
      return [
        "Workspaces isolados — cada cliente vê só os dados dele",
        "White-label com branding da sua agência",
        "Auditoria de acessos e impersonation seguro",
      ];
    case "integrations":
      return [
        "OAuth direto com Meta, Google (incl. MCC) e GA4",
        "WhatsApp via Ativa CRM (mensagens transacionais)",
        "Hotmart e webhooks pra cruzar receita real",
      ];
  }
}
