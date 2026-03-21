import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PlanRow = {
  name: string;
  slug: string;
  price: string;
  description: string;
  highlight?: boolean;
  users: string;
  clients: string;
  childOrgs: string;
  integrations: string;
  dashboards: string;
  features: string[];
};

const plans: PlanRow[] = [
  {
    name: "Essencial",
    slug: "starter",
    price: "Sob consulta",
    description: "Freelancer ou time pequeno centralizando métricas de poucos clientes.",
    users: "Até 3 usuários com login",
    clients: "Até 15 clientes comerciais (menu Clientes)",
    childOrgs: "Sem empresas vinculadas (revenda multi-ambiente)",
    integrations: "Até 3 integrações conectadas (ex.: Google + Meta + 1)",
    dashboards: "Até 10 dashboards",
    features: [
      "Dashboard e Marketing",
      "Alertas de CPA / ROAS e WhatsApp (Ativa CRM)",
      "Um ambiente isolado por organização",
    ],
  },
  {
    name: "Profissional",
    slug: "professional",
    price: "Sob consulta",
    description: "Agência de marketing com vários clientes e equipe.",
    highlight: true,
    users: "Até 10 usuários com login",
    clients: "Até 60 clientes comerciais",
    childOrgs: "Até 15 empresas vinculadas (cliente final com ambiente próprio)",
    integrations: "Até 10 integrações conectadas",
    dashboards: "Até 40 dashboards",
    features: [
      "Tudo do Essencial",
      "Multi-usuário e revenda (empresas filhas)",
      "Limites maiores para escalar operação",
      "Suporte prioritário",
    ],
  },
  {
    name: "Agência Plus",
    slug: "agency",
    price: "Sob consulta",
    description: "Operação grande: muitos clientes e várias empresas filhas.",
    users: "Até 30 usuários com login",
    clients: "Clientes comerciais ilimitados",
    childOrgs: "Empresas vinculadas ilimitadas",
    integrations: "Até 20 integrações conectadas",
    dashboards: "Até 100 dashboards",
    features: [
      "Limites ampliados para agências de alto volume",
      "Negociação de SLA e onboarding dedicado",
      "Roadmap: API e webhooks sob demanda",
    ],
  },
];

export function PlansPage() {
  return (
    <div className="w-full space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Planos</h1>
        <p className="mt-2 max-w-2xl mx-auto text-sm text-muted-foreground">
          Os limites abaixo são aplicados por <strong className="text-foreground">empresa ativa</strong> no painel.
          <strong className="text-foreground"> Clientes comerciais</strong> são as marcas no menu Clientes;{" "}
          <strong className="text-foreground">usuários</strong> são contas com login naquela empresa;{" "}
          <strong className="text-foreground">empresas vinculadas</strong> são ambientes separados (revenda), em
          Configurações → Empresa.
        </p>
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <Card
            key={plan.slug}
            className={cn(
              "relative flex flex-col",
              plan.highlight && "border-primary shadow-md ring-1 ring-primary/20 md:-mt-1 md:mb-1"
            )}
          >
            {plan.highlight && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                Recomendado
              </span>
            )}
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
              <p className="pt-2 text-2xl font-semibold">{plan.price}</p>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              <div className="rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-xs text-muted-foreground space-y-1">
                <p>
                  <span className="font-medium text-foreground">Usuários:</span> {plan.users}
                </p>
                <p>
                  <span className="font-medium text-foreground">Clientes (menu Clientes):</span> {plan.clients}
                </p>
                <p>
                  <span className="font-medium text-foreground">Empresas vinculadas:</span> {plan.childOrgs}
                </p>
                <p>
                  <span className="font-medium text-foreground">Integrações:</span> {plan.integrations}
                </p>
                <p>
                  <span className="font-medium text-foreground">Dashboards:</span> {plan.dashboards}
                </p>
              </div>
              <ul className="space-y-2 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button className="w-full" variant={plan.highlight ? "default" : "outline"} asChild>
                <a
                  href={`mailto:contato@ativadash.com?subject=${encodeURIComponent(`Plano Ativa Dash — ${plan.name}`)}`}
                >
                  Falar com vendas
                </a>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground max-w-xl mx-auto">
        Valores e trial combinados por e-mail. Alteração de plano (upgrade) pode ser feita pelo time comercial; o
        sistema já bloqueia criação acima do limite (clientes, empresas filhas, integrações) com mensagem clara na
        interface.
      </p>

      <p className="text-center text-xs text-muted-foreground">
        Já é cliente?{" "}
        <Link to="/configuracoes" className="font-medium text-primary hover:underline">
          Voltar às configurações
        </Link>
      </p>
    </div>
  );
}
