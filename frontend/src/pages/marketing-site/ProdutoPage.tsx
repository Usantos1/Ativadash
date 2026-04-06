import type { ComponentType } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Bell,
  DollarSign,
  FileDown,
  Gauge,
  Layers,
  LineChart,
  Link2,
  Lock,
  PieChart,
  Share2,
  Shield,
  Sparkles,
  Target,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function FeatureBlock({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-card/90 p-6 shadow-[var(--shadow-surface-sm)] transition-shadow hover:shadow-md",
        className
      )}
    >
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-lg font-bold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

export function ProdutoPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
      <nav className="mb-8 text-sm text-muted-foreground">
        <Link to="/" className="font-medium text-primary hover:underline">
          Início
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Produto</span>
      </nav>

      <header className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/[0.08] via-card to-card p-8 sm:p-12">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <p className="relative text-xs font-bold uppercase tracking-[0.2em] text-primary">Plataforma</p>
        <h1 className="relative mt-3 max-w-3xl text-balance text-3xl font-black tracking-tight text-foreground sm:text-4xl md:text-5xl">
          Tudo o que a sua operação de tráfego precisa num só lugar
        </h1>
        <p className="relative mt-5 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
          O Ativa Dash foi desenhado para gestores de tráfego, agências e times de growth que conectam{" "}
          <strong className="text-foreground">Meta Ads</strong>, <strong className="text-foreground">Google Ads</strong>{" "}
          e operações de CRM — com metas, alertas e relatórios prontos para decisão, não para planilhas soltas.
        </p>
        <div className="relative mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg" className="rounded-xl px-8 font-semibold">
            <Link to="/register">
              Criar conta
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-xl px-8 font-semibold">
            <Link to="/login">Entrar</Link>
          </Button>
        </div>
      </header>

      <section className="mt-16">
        <h2 className="text-center text-2xl font-black tracking-tight text-foreground sm:text-3xl">O que você ganha</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-muted-foreground sm:text-base">
          Módulos que conversam entre si: do investimento ao ROAS, do funil ao WhatsApp.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureBlock
            icon={LineChart}
            title="Painel ADS & cockpit"
            description="Visão consolidada de gasto, leads, CPL, CTR, canais Meta/Google e status da conta — com insights e fila de ações sugeridas."
          />
          <FeatureBlock
            icon={PieChart}
            title="Funil e jornadas"
            description="Impressões, cliques, LPV e conversões no período; identificação da etapa com maior perda para priorizar otimização."
          />
          <FeatureBlock
            icon={DollarSign}
            title="Receita & ROAS reais"
            description="Quando a venda acontece fora das plataformas, atribua receita manualmente por campanha e recalcule o ROAS automaticamente."
          />
          <FeatureBlock
            icon={Target}
            title="Automação e metas"
            description="Metas globais, regras por canal, alertas customizados e histórico de execuções — transparência para o time e para o cliente."
          />
          <FeatureBlock
            icon={Bell}
            title="Alertas e WhatsApp"
            description="Integração opcional com fluxos de notificação para não perder pico de CPA, queda de ROAS ou eventos críticos."
          />
          <FeatureBlock
            icon={Share2}
            title="Links compartilháveis"
            description="Gere links somente leitura do painel para clientes ou stakeholders — período fixo, sem login nas redes."
          />
        </div>
      </section>

      <section className="mt-20 rounded-3xl border border-border/60 bg-muted/30 p-8 sm:p-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">Central de controle</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Tabela operacional por campanha (e níveis quando disponível): ordenação, filtros, exportação CSV, ações em
              massa nas integrações permitidas pelo plano — tudo alinhado ao período que você escolher.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm font-medium text-foreground">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-2">
              <FileDown className="h-4 w-4 text-primary" />
              PDF &amp; CSV
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-2">
              <Gauge className="h-4 w-4 text-primary" />
              Score operacional
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-2">
              <Zap className="h-4 w-4 text-primary" />
              Ações rápidas
            </span>
          </div>
        </div>
      </section>

      <section className="mt-20">
        <h2 className="text-center text-2xl font-black tracking-tight text-foreground sm:text-3xl">Integrações</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-muted-foreground">
          Conecte as fontes de dados que já usa; o painel unifica a leitura.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <FeatureBlock
            icon={Link2}
            title="Google Ads & Meta Ads"
            description="OAuth e contas vinculadas ao workspace: métricas oficiais, campanhas e — conforme permissões — ajustes de status e orçamento."
          />
          <FeatureBlock
            icon={Layers}
            title="CRM, WhatsApp e webhooks"
            description="Alertas e automações podem integrar com o seu ecossistema; webhooks para eventos customizados quando o plano permitir."
          />
        </div>
      </section>

      <section className="mt-20">
        <h2 className="text-center text-2xl font-black tracking-tight text-foreground sm:text-3xl">Para quem é</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-border/50 bg-card p-6 text-center">
            <Users className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-3 font-bold text-foreground">Agências</p>
            <p className="mt-2 text-xs text-muted-foreground">Multi-workspace, revenda e visão matriz quando contratado.</p>
          </div>
          <div className="rounded-2xl border border-border/50 bg-card p-6 text-center">
            <BarChart3 className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-3 font-bold text-foreground">Times internos</p>
            <p className="mt-2 text-xs text-muted-foreground">Marketing e growth com um único painel de verdade.</p>
          </div>
          <div className="rounded-2xl border border-border/50 bg-card p-6 text-center">
            <Shield className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-3 font-bold text-foreground">Compliance</p>
            <p className="mt-2 text-xs text-muted-foreground">Política de privacidade, termos e exclusão de dados documentados.</p>
          </div>
        </div>
      </section>

      <section className="mt-20 rounded-3xl border border-primary/25 bg-primary/[0.06] p-8 text-center sm:p-12">
        <Sparkles className="mx-auto h-10 w-10 text-primary" />
        <h2 className="mt-4 text-2xl font-black text-foreground sm:text-3xl">Pronto para ver no seu dado real?</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
          Crie a conta, conecte as integrações e em minutos você já navega pelo painel com o período e os filtros que
          importam para o seu negócio.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="rounded-xl px-10 font-semibold">
            <Link to="/register">Começar gratuitamente</Link>
          </Button>
          <Button asChild variant="secondary" size="lg" className="rounded-xl px-10 font-semibold">
            <Link to="/login">Já sou cliente</Link>
          </Button>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          <Lock className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
          Acesso seguro · dados isolados por organização
        </p>
      </section>

      <p className="mt-12 text-center text-sm text-muted-foreground">
        <Link to="/politica-privacidade" className="font-medium text-primary hover:underline">
          Política de Privacidade
        </Link>
        {" · "}
        <Link to="/termos-de-servico" className="font-medium text-primary hover:underline">
          Termos de Serviço
        </Link>
        {" · "}
        <Link to="/" className="font-medium text-primary hover:underline">
          Voltar ao início
        </Link>
      </p>
    </div>
  );
}
