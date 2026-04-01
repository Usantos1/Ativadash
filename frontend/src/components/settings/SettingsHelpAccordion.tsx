import { Link } from "react-router-dom";
import { ChevronDown, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { canAccessMatrizResellerNav } from "@/lib/navigation-mode";

/**
 * Ajuda contextual compacta. Mantém id `como-funciona-conta` para âncoras de outras telas.
 */
export function SettingsHelpAccordion({ className }: { className?: string }) {
  const user = useAuthStore((s) => s.user);
  const memberships = useAuthStore((s) => s.memberships);
  const showRevendaLink = canAccessMatrizResellerNav(user, memberships);

  return (
    <details
      id="como-funciona-conta"
      className={cn(
        "group overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/[0.12] shadow-[var(--shadow-surface-sm)] ring-1 ring-black/[0.02] transition-shadow open:shadow-md dark:ring-white/[0.04]",
        className
      )}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left [&::-webkit-details-marker]:hidden sm:px-6 sm:py-4">
        <span className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/[0.07]">
            <HelpCircle className="h-4 w-4 text-primary" aria-hidden />
          </span>
          <span>
            <span className="block text-sm font-semibold text-foreground sm:text-base">
              Como empresa, equipe e clientes se relacionam
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground sm:text-sm">
              Glossário rápido para evitar confusão entre ambientes, logins e cadastros comerciais.
            </span>
          </span>
        </span>
        <ChevronDown
          className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="space-y-4 border-t border-border/50 bg-muted/[0.08] px-5 pb-5 pt-4 text-sm leading-relaxed text-muted-foreground sm:px-6">
        <p className="text-sm text-muted-foreground">
          Use esta referência ao convidar utilizadores ou ao explicar a estrutura a clientes.
        </p>
        <ul className="list-none space-y-3 text-sm">
          <li className="flex gap-2 pl-1">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" aria-hidden />
            <span>
              <span className="font-semibold text-foreground">Empresa</span> — ambiente de dados ativo (integrações,
              marketing, projetos). Troque pelo seletor <strong className="font-medium text-foreground">Trocar empresa</strong>.
            </span>
          </li>
          <li className="flex gap-2 pl-1">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" aria-hidden />
            <span>
              <span className="font-semibold text-foreground">Equipe</span> — quem tem login nesta empresa. Gestão em{" "}
              <Link to="/usuarios" className="font-medium text-primary underline-offset-4 hover:underline">
                Equipe
              </Link>
              .
            </span>
          </li>
          <li className="flex gap-2 pl-1">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" aria-hidden />
            <span>
              <span className="font-semibold text-foreground">Clientes (operação)</span> — registros comerciais
              (marcas, contatos) dentro da empresa; não criam novos workspaces no sistema.
            </span>
          </li>
          <li className="flex gap-2 pl-1">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" aria-hidden />
            <span>
              <span className="font-semibold text-foreground">Workspaces filhos (revenda)</span> — ambientes isolados por
              cliente; operação na{" "}
              {showRevendaLink ? (
                <Link to="/revenda" className="font-medium text-primary underline-offset-4 hover:underline">
                  Gestão de workspaces
                </Link>
              ) : (
                <span className="font-medium text-foreground">Gestão de workspaces</span>
              )}{" "}
              (conta raiz). Dados da matriz em{" "}
              <Link to="/configuracoes/empresa" className="font-medium text-primary underline-offset-4 hover:underline">
                Empresa
              </Link>
              .
            </span>
          </li>
        </ul>
      </div>
    </details>
  );
}
