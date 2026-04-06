import { Link } from "react-router-dom";
import {
  BarChart3,
  Bell,
  DollarSign,
  Link2,
  LineChart,
  PieChart,
  Shield,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <section className="text-center">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-primary">Marketing & vendas</p>
        <h1 className="mx-auto max-w-3xl text-balance text-3xl font-black tracking-tight text-foreground sm:text-4xl md:text-5xl">
          Um painel para Meta Ads, Google Ads e o que o CRM não mostra sozinho
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
          O Ativa Dash centraliza métricas de campanhas, funil de captação, receita e automações. Ideal para agências e
          equipes que precisam de clareza operacional sem depender só de planilhas.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="rounded-xl px-8 font-semibold">
            <Link to="/register">Começar agora</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-xl px-8 font-semibold">
            <Link to="/login">Já tenho conta</Link>
          </Button>
        </div>
      </section>

      <section className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            icon: LineChart,
            title: "Painel ADS unificado",
            desc: "Meta e Google no mesmo lugar: gasto, leads, CPL, CTR e tendências no período.",
          },
          {
            icon: PieChart,
            title: "Funil e captura",
            desc: "Impressões, cliques, LPV e conversões com visão de onde está a maior perda.",
          },
          {
            icon: Target,
            title: "Metas e automação",
            desc: "Regras de alerta, WhatsApp e histórico de execuções para manter a operação sob controle.",
          },
          {
            icon: DollarSign,
            title: "Receita e ROAS",
            desc: "Atribuição manual de receita por campanha quando a venda acontece fora das plataformas.",
          },
          {
            icon: Link2,
            title: "Integrações",
            desc: "Conexões com APIs de anúncios, webhooks e CRM para dados e alertas em um único fluxo.",
          },
          {
            icon: Users,
            title: "Multiempresa",
            desc: "Matriz e workspaces filhos: ideal para revenda e operação com vários clientes.",
          },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-border/60 bg-card/80 p-5 shadow-[var(--shadow-surface-sm)] transition-shadow hover:shadow-md"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <item.icon className="h-5 w-5" />
            </div>
            <h2 className="font-bold text-foreground">{item.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
          </div>
        ))}
      </section>

      <section className="mt-20 rounded-2xl border border-primary/20 bg-primary/[0.06] p-8 sm:p-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Pronto para o painel completo?</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Crie sua conta ou faça login para conectar contas e ver dashboards em tempo real.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button asChild className="rounded-xl">
              <Link to="/register">Criar conta gratuita</Link>
            </Button>
            <Button asChild variant="secondary" className="rounded-xl">
              <Link to="/login">Entrar</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mt-16 grid gap-6 border-t border-border/60 pt-16 sm:grid-cols-3">
        <div className="flex gap-3">
          <Shield className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-semibold text-foreground">Dados sob controle</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Compartilhamento de painéis com links somente leitura; sem ações públicas nas visualizações compartilhadas.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Bell className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-semibold text-foreground">Alertas configuráveis</p>
            <p className="mt-1 text-xs text-muted-foreground">
              CPA, ROAS, gasto e regras personalizadas com integração opcional a WhatsApp.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <BarChart3 className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-semibold text-foreground">Exportação</p>
            <p className="mt-1 text-xs text-muted-foreground">
              PDF e CSV para relatórios e acompanhamento com stakeholders.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
