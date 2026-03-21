import { Link } from "react-router-dom";
import { Megaphone, Plug, User, Users, Building2 } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

const links = [
  {
    to: "/configuracoes/empresa",
    title: "Empresa e revenda",
    description: "Nome da empresa, isolamento de dados e empresas cliente (agência).",
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
    title: "Usuários da empresa",
    description: "Quem tem acesso à organização.",
    icon: Users,
  },
];

export function SettingsHubPage() {
  const org = useAuthStore((s) => s.user?.organization);

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Central de ajustes da conta e do marketing.
        </p>
      </div>

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
