/**
 * Trilha discreta para o centro da topbar (não duplica breadcrumbs longos das páginas).
 */
import { hubItemByRouteSlug } from "@/lib/integration-hub-registry";

export type TopbarCrumb = { label: string; href?: string };

export function resolveTopbarCrumbs(pathname: string): TopbarCrumb[] {
  const p = pathname.replace(/\/$/, "") || "/";
  if (p === "/" || p === "/dashboard") return [];

  if (p === "/marketing") return [{ label: "Painel ADS" }];
  if (p === "/marketing/captacao") {
    return [
      { label: "Painel ADS", href: "/marketing" },
      { label: "Captação" },
    ];
  }
  if (p === "/marketing/conversao") {
    return [
      { label: "Painel ADS", href: "/marketing" },
      { label: "Conversão" },
    ];
  }
  if (p === "/marketing/receita") {
    return [
      { label: "Painel ADS", href: "/marketing" },
      { label: "Receita" },
    ];
  }
  if (p === "/marketing/integracoes") {
    return [
      { label: "Painel ADS", href: "/marketing" },
      { label: "Integrações" },
    ];
  }
  if (p.startsWith("/marketing/integracoes/")) {
    const slug = p.slice("/marketing/integracoes/".length);
    const item = hubItemByRouteSlug(slug);
    return [
      { label: "Painel ADS", href: "/marketing" },
      { label: "Integrações", href: "/marketing/integracoes" },
      { label: item?.name ?? slug },
    ];
  }
  if (p === "/ads/metas-alertas" || p === "/ads/metas-operacao") {
    const leaf =
      p === "/ads/metas-operacao"
        ? "Operação por canal"
        : "Automação e Metas";
    return [{ label: "Painel ADS", href: "/marketing" }, { label: leaf }];
  }

  if (p === "/clientes") return [{ label: "Clientes" }];
  if (p === "/usuarios") return [{ label: "Equipe" }];
  if (p === "/atividades") return [{ label: "Log de Atividades" }];

  if (p === "/configuracoes") return [{ label: "Configurações" }];
  if (p === "/configuracoes/empresa") {
    return [
      { label: "Configurações", href: "/configuracoes" },
      { label: "Empresa" },
    ];
  }
  if (p === "/configuracoes/admin") {
    return [
      { label: "Configurações", href: "/configuracoes" },
      { label: "Administração" },
    ];
  }
  if (p === "/perfil") return [{ label: "Perfil" }];
  if (p === "/revenda" || p === "/assinatura") return [{ label: "Revenda" }];

  const revendaSection: Record<string, string> = {
    "/revenda/contas": "Contas",
    "/revenda/clientes": "Clientes",
    "/revenda/empresas": "Clientes",
    "/revenda/agencias": "Agências",
    "/revenda/pessoas": "Pessoas",
    "/revenda/usuarios": "Pessoas",
    "/revenda/planos": "Planos",
    "/revenda/modulos": "Módulos",
    "/revenda/saude": "Saúde",
    "/revenda/auditoria": "Auditoria",
  };
  if (revendaSection[p]) {
    return [{ label: "Revenda", href: "/revenda" }, { label: revendaSection[p] }];
  }

  if (p === "/revenda/plataforma" || p === "/plataforma") {
    return [{ label: "Admin Ativa Dash" }];
  }
  if (p === "/admin") {
    return [
      { label: "Configurações", href: "/configuracoes" },
      { label: "Administração" },
    ];
  }

  return [];
}
