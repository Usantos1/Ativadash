import { Link } from "react-router-dom";
import { Building2, Database, Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth-store";

export function AdminPage() {
  const user = useAuthStore((s) => s.user);
  const org = user?.organization;

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Administração</h1>
        <p className="text-sm text-muted-foreground">
          Visão técnica da organização e atalhos para gestão.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Organização</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Nome:</span>{" "}
              <span className="font-medium">{org?.name ?? "—"}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Slug:</span>{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{org?.slug ?? "—"}</code>
            </p>
            <p>
              <span className="text-muted-foreground">ID:</span>{" "}
              <code className="break-all rounded bg-muted px-1.5 py-0.5 text-xs">
                {user?.organizationId ?? "—"}
              </code>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Acesso</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p className="mb-3">
              Você está autenticado como <strong className="text-foreground">{user?.email}</strong>.
            </p>
            <Link to="/usuarios" className="font-medium text-primary hover:underline">
              Ver usuários da empresa →
            </Link>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <Database className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Dados e integrações</CardTitle>
            <CardDescription className="text-xs">
              Integrações e métricas ficam vinculadas ao ID da organização acima.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              to="/marketing/integracoes"
              className="text-sm font-medium text-primary hover:underline"
            >
              Gerenciar integrações →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
