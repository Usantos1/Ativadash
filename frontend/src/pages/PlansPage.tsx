import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Essencial",
    price: "Sob consulta",
    description: "Ideal para quem está começando a centralizar métricas.",
    features: ["Dashboard e Marketing", "Integrações Meta + Google", "Um ambiente (organização) isolado"],
  },
  {
    name: "Profissional",
    price: "Sob consulta",
    description: "Para agências e times que precisam de escala.",
    features: [
      "Tudo do Essencial",
      "Múltiplos usuários na empresa",
      "Alertas de CPA e ROAS",
      "Suporte prioritário",
    ],
    highlight: true,
  },
];

export function PlansPage() {
  return (
    <div className="w-full space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Planos</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Escolha o que faz sentido para o seu momento. Fale conosco para valores e trial.
        </p>
      </div>

      <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={cn(
              "relative flex flex-col",
              plan.highlight && "border-primary shadow-md ring-1 ring-primary/20"
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
            <CardContent className="flex-1">
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
                <a href="mailto:contato@ativadash.com?subject=Plano%20Ativa%20Dash">Falar com vendas</a>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Já é cliente?{" "}
        <Link to="/configuracoes" className="font-medium text-primary hover:underline">
          Voltar às configurações
        </Link>
      </p>
    </div>
  );
}
