/**
 * Trilha discreta para o centro da topbar (não duplica breadcrumbs longos das páginas).
 */
export type TopbarCrumb = { label: string; href?: string };

export function resolveTopbarCrumbs(pathname: string): TopbarCrumb[] {
  const p = pathname.replace(/\/$/, "") || "/";
  if (p === "/" || p === "/dashboard") return [];

  if (p === "/marketing") return [{ label: "Marketing" }];
  if (p === "/marketing/captacao") {
    return [
      { label: "Marketing", href: "/marketing" },
      { label: "Captação" },
    ];
  }
  if (p === "/marketing/conversao") {
    return [
      { label: "Marketing", href: "/marketing" },
      { label: "Conversão" },
    ];
  }
  if (p === "/marketing/receita") {
    return [
      { label: "Marketing", href: "/marketing" },
      { label: "Receita" },
    ];
  }
  if (p === "/marketing/integracoes") {
    return [
      { label: "Marketing", href: "/marketing" },
      { label: "Integrações" },
    ];
  }
  if (p === "/marketing/configuracoes") {
    return [
      { label: "Marketing", href: "/marketing" },
      { label: "Metas e alertas" },
    ];
  }

  if (p === "/clientes") return [{ label: "Clientes" }];
  if (p === "/projetos") return [{ label: "Projetos" }];
  if (p === "/lancamentos") return [{ label: "Lançamentos" }];
  if (p === "/usuarios") return [{ label: "Equipe" }];

  if (p === "/configuracoes") return [{ label: "Configurações" }];
  if (p === "/configuracoes/empresa") {
    return [
      { label: "Configurações", href: "/configuracoes" },
      { label: "Empresa" },
    ];
  }
  if (p === "/perfil") return [{ label: "Perfil" }];
  if (p === "/revenda" || p === "/assinatura") return [{ label: "Gestão de workspaces" }];
  if (p === "/plataforma") return [{ label: "Plataforma" }];
  if (p === "/admin") return [{ label: "Administração" }];

  return [];
}
