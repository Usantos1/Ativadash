import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollRegion } from "@/components/ui/scroll-region";
import { fetchMembers, type MemberRow } from "@/lib/workspace-api";
import { fetchOrganizationContext, formatPlanCap, type OrganizationContext } from "@/lib/organization-api";
import { useAuthStore } from "@/stores/auth-store";

const roleLabel: Record<string, string> = {
  owner: "Proprietário",
  member: "Membro",
  admin: "Administrador",
};

export function TeamPage() {
  const orgName = useAuthStore((s) => s.user?.organization?.name);
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [orgCtx, setOrgCtx] = useState<OrganizationContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [list, ctx] = await Promise.all([fetchMembers(), fetchOrganizationContext()]);
      setRows(list);
      setOrgCtx(ctx);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const directCount = rows.filter((r) => r.source === "direct").length;

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Equipe</h1>
        <p className="text-sm text-muted-foreground">
          Pessoas com <strong className="font-medium text-foreground">login</strong> que acessam{" "}
          <strong className="font-medium text-foreground">{orgName ?? "esta empresa"}</strong> (a que está ativa no
          topo). A contagem abaixo <strong className="text-foreground">não</strong> é quantidade de clientes do menu
          Clientes.{" "}
          <Link
            to="/configuracoes#como-funciona-conta"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Ver diferenças
          </Link>
          .
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card className="min-w-0 max-w-full overflow-hidden">
        <CardHeader>
          <CardTitle>Membros com acesso</CardTitle>
          <CardDescription>
            {loading
              ? "Carregando…"
              : orgCtx
                ? `${directCount} / ${formatPlanCap(orgCtx.limits.maxUsers)} usuário(s) com login nesta empresa (contagem direta; convites em breve). Lista abaixo: ${rows.length} linha(s) incluindo acesso pela agência.`
                : `${rows.length} pessoa(s) com acesso a esta organização`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum membro listado.</p>
          ) : (
            <ScrollRegion className="scrollbar-thin">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Nome</th>
                    <th className="pb-2 pr-4 font-medium">E-mail</th>
                    <th className="pb-2 font-medium">Papel / acesso</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.membershipId} className="border-b border-border/60">
                      <td className="py-3 pr-4 font-medium">{row.name}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{row.email}</td>
                      <td className="py-3">
                        <span className="block">{roleLabel[row.role] ?? row.role}</span>
                        {row.source === "agency" && (
                          <span className="text-xs text-muted-foreground">Acesso pela agência (revenda)</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollRegion>
          )}
          <p className="mt-4 break-words text-xs text-muted-foreground">
            Em contas criadas por agência, administradores da agência podem aparecer como &quot;Acesso pela agência&quot;.
            Convites por e-mail para novos membros: em breve.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
