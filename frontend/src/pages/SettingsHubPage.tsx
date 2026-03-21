import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Megaphone, Plug, User, Users, Building2 } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeaderPremium } from "@/components/premium";
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
      <PageHeaderPremium
        eyebrow="Conta"
        title="Configurações"
        subtitle="Central de ajustes da conta e do marketing. Em dúvida sobre empresa, usuários e clientes? Leia o quadro abaixo."
      />

      <AccountModelExplainer />

      {org && (
        <Card className="rounded-2xl border-primary/25 bg-gradient-to-br from-primary/[0.07] to-card shadow-[var(--shadow-surface-sm)]">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
            <Building2 className="h-8 w-8 shrink-0 text-primary" />
            <div>
              <CardTitle className="text-base font-bold">{org.name}</CardTitle>
              <CardDescription>Empresa ativa · slug: {org.slug}</CardDescription>
            </div>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {links.map(({ to, title, description, icon: Icon }) => (
          <Link key={to} to={to} className="block transition-opacity hover:opacity-90">
            <Card
              className={cn(
                "h-full cursor-pointer rounded-2xl border-border/55 shadow-[var(--shadow-surface-sm)] transition-shadow hover:border-primary/35 hover:shadow-[var(--shadow-surface)]"
              )}
            >
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
