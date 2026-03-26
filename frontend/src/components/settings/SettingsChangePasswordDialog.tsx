import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeAuthenticatedPassword } from "@/lib/workspace-api";
import { ApiClientError } from "@/lib/api";

export function SettingsChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function resetFields() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setOk(null);
  }

  function handleOpenChange(v: boolean) {
    if (!v) resetFields();
    onOpenChange(v);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    if (newPassword.length < 6) {
      setError("Nova senha: mínimo 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Confirmação diferente da nova senha.");
      return;
    }
    setBusy(true);
    try {
      await changeAuthenticatedPassword({ currentPassword, newPassword, confirmPassword });
      setOk("Senha atualizada.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      window.setTimeout(() => handleOpenChange(false), 1200);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Não foi possível alterar a senha.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent title="Alterar senha" showClose className="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-3 py-1">
          <p className="text-xs text-muted-foreground">Use a senha atual da sua conta. Não enviamos e-mail.</p>
          <div className="space-y-1.5">
            <Label htmlFor="pw-current" className="text-xs">
              Senha atual
            </Label>
            <Input
              id="pw-current"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="h-9 rounded-md text-sm"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-new" className="text-xs">
              Nova senha
            </Label>
            <Input
              id="pw-new"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-9 rounded-md text-sm"
              required
              minLength={6}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-confirm" className="text-xs">
              Confirmar nova senha
            </Label>
            <Input
              id="pw-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-9 rounded-md text-sm"
              required
            />
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          {ok ? <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{ok}</p> : null}
          <DialogFooter className="gap-2 pt-2 sm:justify-end">
            <Button type="button" variant="outline" size="sm" className="h-9 rounded-md" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" className="h-9 rounded-md" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
