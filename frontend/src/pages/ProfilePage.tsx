import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth-store";
import { patchProfile } from "@/lib/workspace-api";

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const memberships = useAuthStore((s) => s.memberships);
  const managedOrganizations = useAuthStore((s) => s.managedOrganizations);
  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(user?.name ?? "");
  }, [user?.name]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n || n.length < 2) {
      setError("Nome deve ter pelo menos 2 caracteres.");
      return;
    }
    if (!user || !accessToken || !refreshToken) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await patchProfile(n);
      setAuth(
        {
          ...user,
          name: updated.name,
        },
        accessToken,
        refreshToken,
        { memberships, managedOrganizations }
      );
      setMessage("Perfil atualizado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
        <p className="text-sm text-muted-foreground">Dados da sua conta nesta empresa.</p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Informações</CardTitle>
          <CardDescription>O e-mail não pode ser alterado aqui.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" value={user?.email ?? ""} disabled readOnly className="bg-muted/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {message && <p className="text-sm text-green-600 dark:text-green-400">{message}</p>}
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando…" : "Salvar alterações"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
