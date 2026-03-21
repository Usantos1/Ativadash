import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollRegion } from "@/components/ui/scroll-region";
import { fetchMembers, type MemberRow } from "@/lib/workspace-api";

const roleLabel: Record<string, string> = {
  owner: "Proprietário",
  member: "Membro",
  admin: "Administrador",
};

export function TeamPage() {
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await fetchMembers();
      setRows(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
        <p className="text-sm text-muted-foreground">
          Pessoas com acesso à sua empresa neste sistema.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card className="min-w-0 max-w-full overflow-hidden">
        <CardHeader>
          <CardTitle>Equipe</CardTitle>
          <CardDescription>
            {loading ? "Carregando…" : `${rows.length} usuário(s)`}
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
                    <th className="pb-2 font-medium">Papel</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.membershipId} className="border-b border-border/60">
                      <td className="py-3 pr-4 font-medium">{row.name}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{row.email}</td>
                      <td className="py-3">{roleLabel[row.role] ?? row.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollRegion>
          )}
          <p className="mt-4 break-words text-xs text-muted-foreground">
            Para convidar novos usuários, entre em contato com o suporte — em breve convites por e-mail.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
