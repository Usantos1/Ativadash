import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { stopImpersonation } from "@/lib/impersonation-api";

export function ImpersonationBanner() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [busy, setBusy] = useState(false);

  if (!user?.isImpersonating) return null;

  const orgName = user.organization?.name ?? "empresa";

  async function handleStop() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await stopImpersonation();
      setAuth(
        { ...res.user, organization: res.user.organization },
        res.accessToken,
        res.refreshToken,
        { memberships: res.memberships, managedOrganizations: res.managedOrganizations }
      );
      navigate("/revenda/empresas", { replace: true });
    } catch {
      /* 401 redireciona via api.ts */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b-2 border-amber-500/60 bg-amber-500/15 px-4 py-2 backdrop-blur-sm sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <Shield className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
        <p className="min-w-0 text-sm font-semibold text-amber-900 dark:text-amber-100">
          Você está acessando{" "}
          <span className="font-black">{orgName}</span>
          {" "}como administrador
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="shrink-0 rounded-lg border-amber-600/40 bg-amber-500/20 text-amber-900 hover:bg-amber-500/30 dark:text-amber-100"
        disabled={busy}
        onClick={() => void handleStop()}
      >
        <LogOut className="mr-1.5 h-3.5 w-3.5" aria-hidden />
        {busy ? "Saindo…" : "Sair do acesso"}
      </Button>
    </div>
  );
}
