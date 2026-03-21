import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Explicação única do modelo: organização vs usuários vs clientes comerciais vs revenda.
 * Ancoragem: id para links de outras páginas (#como-funciona-conta).
 */
export function AccountModelExplainer() {
  return (
    <Card className="border-border/80 bg-muted/25" id="como-funciona-conta">
      <CardHeader className="space-y-1 pb-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" aria-hidden />
          <CardTitle className="text-base">Como a conta é organizada</CardTitle>
        </div>
        <CardDescription className="text-xs sm:text-sm">
          Três ideias separadas — assim fica fácil saber onde cadastrar o quê.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <div className="space-y-1.5 border-b border-border/60 pb-3">
          <p className="font-medium text-foreground">1. Empresa (organização)</p>
          <p>
            É o <strong className="font-medium text-foreground">ambiente de trabalho</strong> ativo. Cada empresa
            tem seus próprios dados: integrações, marketing, projetos e a lista do menu{" "}
            <strong className="text-foreground">Clientes</strong>. No topo, use{" "}
            <strong className="text-foreground">Trocar empresa</strong> para mudar de ambiente (se tiver mais de
            uma).
          </p>
        </div>
        <div className="space-y-1.5 border-b border-border/60 pb-3">
          <p className="font-medium text-foreground">2. Usuários (Equipe)</p>
          <p>
            São as <strong className="font-medium text-foreground">pessoas com login</strong> que podem acessar{" "}
            <em>a empresa que está selecionada agora</em>. A lista em{" "}
            <Link to="/usuarios" className="font-medium text-primary underline-offset-4 hover:underline">
              Equipe
            </Link>{" "}
            é sempre da empresa ativa — não é “quantidade de clientes”.
          </p>
        </div>
        <div className="space-y-1.5 border-b border-border/60 pb-3">
          <p className="font-medium text-foreground">3. Clientes (menu Clientes)</p>
          <p>
            São <strong className="font-medium text-foreground">registros comerciais</strong> (contas, marcas, contatos)
            que você organiza <em>dentro</em> da empresa ativa — para ligar a projetos e lançamentos.{" "}
            <strong className="text-foreground">Não</strong> criam novas empresas no sistema e{" "}
            <strong className="text-foreground">não</strong> são a mesma coisa que “empresa cliente” de revenda.
          </p>
        </div>
        <div className="space-y-1.5">
          <p className="font-medium text-foreground">4. Empresas cliente (só agências / revenda)</p>
          <p>
            Em{" "}
            <Link
              to="/configuracoes/empresa"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Empresa e revenda
            </Link>
            , você pode criar <strong className="font-medium text-foreground">organizações filhas</strong>: cada uma é
            um ambiente isolado para um cliente final (como se fosse outra “empresa” no topo). Isso é diferente da
            lista <strong className="text-foreground">Clientes</strong> do menu lateral.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
