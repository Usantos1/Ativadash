import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Megaphone, Plug, User, Users, Building2 } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountModelExplainer } from "@/components/help/AccountModelExplainer";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

const links = [
  {
    to: "/configuracoes/empresa",
    title: "Empresa e revenda",
    description: "Nome do ambiente ativo, isolamento de dados e (agências) empresas filhas por cliente.",
    icon: Building2,
  },
  {
    to: "/marketing/configuracoes",
    title: "Configurações de marketing",
    description: "Metas de CPA, ROAS e alertas de performance.",
    icon: Megaphone,
  },
  {
    to: "/marketing/integracoes",
    title: "Integrações",
    description: "Google Ads, Meta Ads e outras conexões.",
    icon: Plug,
  },
  {
    to: "/perfil",
    title: "Meu perfil",
    description: "Nome de exibição e dados da conta.",
    icon: User,
  },
  {
    to: "/usuarios",
    title: "Equipe (usuários)",
    description: "Quem tem login e acessa a empresa que está ativa no momento — não é lista de clientes comerciais.",
    icon: Users,
  },
];

export function SettingsHubPage() {
  const org = useAuthStore((s) => s.user?.organization);
  const location = useLocation();

  useEffect(() => {
    if (location.hash === "#como-funciona-conta") {
      document.getElementById("como-funciona-conta")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash, location.pathname]);

  return (
    <div className="mx-auto min-w-0 max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Central de ajustes da conta e do marketing. Em dúvida sobre empresa, usuários e clientes? Leia o quadro
          abaixo.
        </p>
      </div>

      <AccountModelExplainer />

      {org && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
            <Building2 className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-base">{org.name}</CardTitle>
              <CardDescription>Empresa ativa · slug: {org.slug}</CardDescription>
            </div>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {links.map(({ to, title, description, icon: Icon }) => (
          <Link key={to} to={to} className="block transition-opacity hover:opacity-90">
            <Card className={cn("h-full cursor-pointer hover:border-primary/30")}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">{title}</CardTitle>
                </div>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
