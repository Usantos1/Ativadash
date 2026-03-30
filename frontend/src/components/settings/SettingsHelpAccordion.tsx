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
        "group rounded-2xl border border-border/60 bg-muted/20 shadow-[var(--shadow-surface-sm)] transition-colors open:bg-muted/30",
        className
      )}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-left [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
          <HelpCircle className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          Como empresa, equipe e clientes se relacionam
        </span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="space-y-3 border-t border-border/50 px-4 pb-4 pt-3 text-xs leading-relaxed text-muted-foreground sm:text-sm">
        <p className="text-[13px] text-muted-foreground">
          Três ideias diferentes — útil quando for cadastrar pessoas ou contas.
        </p>
        <ul className="list-inside list-disc space-y-2.5 marker:text-primary/70">
          <li>
            <span className="font-medium text-foreground">Empresa</span> — o ambiente de dados ativo (integrações,
            marketing, projetos). Troque pelo menu <strong className="text-foreground">Trocar empresa</strong>.
          </li>
          <li>
            <span className="font-medium text-foreground">Equipe</span> — quem tem login nesta empresa. Veja em{" "}
            <Link to="/usuarios" className="font-medium text-primary underline-offset-4 hover:underline">
              Usuários
            </Link>
            .
          </li>
          <li>
            <span className="font-medium text-foreground">Clientes (menu lateral)</span> — registros comerciais
            (marcas, contatos) dentro da empresa; não criam novas empresas no sistema.
          </li>
          <li>
            <span className="font-medium text-foreground">Workspaces filhos (revenda)</span> — ambientes isolados para
            cada cliente; operação em{" "}
            {showRevendaLink ? (
              <Link to="/revenda" className="font-medium text-primary underline-offset-4 hover:underline">
                Gestão de workspaces
              </Link>
            ) : (
              <span className="font-medium text-foreground">Gestão de workspaces</span>
            )}{" "}
            (na empresa raiz). Nome da matriz em{" "}
            <Link to="/configuracoes/empresa" className="font-medium text-primary underline-offset-4 hover:underline">
              Empresa
            </Link>
            .
          </li>
        </ul>
      </div>
    </details>
  );
}
