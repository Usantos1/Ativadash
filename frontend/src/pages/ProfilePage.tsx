import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth-store";
import { acceptInviteLoggedIn, patchProfile } from "@/lib/workspace-api";

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
  const [inviteToken, setInviteToken] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [inviteErr, setInviteErr] = useState<string | null>(null);

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

  async function handleAcceptInvite(e: React.FormEvent) {
    e.preventDefault();
    const t = inviteToken.trim();
    if (!t) return;
    setInviteBusy(true);
    setInviteErr(null);
    setInviteMsg(null);
    try {
      const out = await acceptInviteLoggedIn(t);
      useAuthStore.getState().setAuth(
        {
          id: out.id,
          email: out.email,
          name: out.name,
          firstName: out.firstName,
          organizationId: out.organizationId,
          organization: out.organization,
          platformAdmin: out.platformAdmin,
          rootResellerPartner: out.rootResellerPartner,
          matrizNavEligible: out.matrizNavEligible,
          organizationKind: out.organizationKind,
          parentOrganizationId: out.parentOrganizationId,
        },
        out.accessToken,
        out.refreshToken,
        { memberships: out.memberships, managedOrganizations: out.managedOrganizations }
      );
      setInviteMsg("Convite aceito. Contexto da empresa atualizado.");
      setInviteToken("");
    } catch (err) {
      setInviteErr(err instanceof Error ? err.message : "Erro ao aceitar convite");
    } finally {
      setInviteBusy(false);
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

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Aceitar convite (conta existente)</CardTitle>
          <CardDescription>
            Cole o token do link de convite (parte após <code className="text-xs">invite=</code>) se você já tem login e
            quer entrar em outra empresa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAcceptInvite} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="invite-token">Token do convite</Label>
              <Input
                id="invite-token"
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
                placeholder="Cole o token completo"
                autoComplete="off"
              />
            </div>
            {inviteErr && <p className="text-sm text-destructive">{inviteErr}</p>}
            {inviteMsg && <p className="text-sm text-green-600 dark:text-green-400">{inviteMsg}</p>}
            <Button type="submit" disabled={inviteBusy}>
              {inviteBusy ? "Processando…" : "Aceitar e mudar contexto"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
