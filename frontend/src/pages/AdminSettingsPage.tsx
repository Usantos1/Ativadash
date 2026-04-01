import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPageTitle, usePageTitle } from "@/hooks/usePageTitle";
import { AdminOrgPanel } from "@/components/settings/AdminOrgPanel";

export function AdminSettingsPage() {
  usePageTitle(formatPageTitle(["Administração", "Configurações"]));

  return (
    <div className="mx-auto w-full max-w-[min(100%,56rem)] space-y-6 pb-12">
      <div>
        <Button variant="ghost" size="sm" className="mb-2 -ml-2 gap-1 text-muted-foreground" asChild>
          <Link to="/configuracoes">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao hub
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Administração técnica</h1>
        <p className="text-sm text-muted-foreground">Identificadores da organização e atalhos de gestão.</p>
      </div>
      <AdminOrgPanel />
    </div>
  );
}
