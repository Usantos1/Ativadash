import { Link, Outlet } from "react-router-dom";
import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MARKETING_SITE_ORIGIN } from "@/lib/marketing-site";

export function PublicSiteLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-background via-muted/20 to-background">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <a
            href={MARKETING_SITE_ORIGIN}
            className="flex items-center gap-2 font-bold tracking-tight text-foreground"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <BarChart3 className="h-5 w-5" />
            </span>
            <span>Ativa Dash</span>
          </a>
          <nav className="flex flex-wrap items-center justify-end gap-1 text-sm font-medium sm:gap-2">
            <Link
              to="/politica-privacidade"
              className="rounded-lg px-2 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Privacidade
            </Link>
            <Link
              to="/termos-de-servico"
              className="rounded-lg px-2 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Termos
            </Link>
            <Button asChild variant="outline" size="sm" className="h-9 rounded-lg">
              <Link to="/login">Entrar</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border/60 bg-card/50 py-6 text-sm text-muted-foreground">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <p className="text-center sm:text-left">© {new Date().getFullYear()} Ativa Dash · Analytics & performance</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a href={MARKETING_SITE_ORIGIN} className="underline-offset-4 hover:text-foreground hover:underline">
              Site
            </a>
            <Link to="/politica-privacidade" className="underline-offset-4 hover:text-foreground hover:underline">
              Política de Privacidade
            </Link>
            <Link to="/termos-de-servico" className="underline-offset-4 hover:text-foreground hover:underline">
              Termos de Serviço
            </Link>
            <Link to="/exclusao-dados" className="underline-offset-4 hover:text-foreground hover:underline">
              Exclusão de dados
            </Link>
            <Link to="/login" className="underline-offset-4 hover:text-foreground hover:underline">
              Acesso ao painel
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
