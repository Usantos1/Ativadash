import { useEffect, useState } from "react";
import {
  Briefcase,
  Building2,
  Clock,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
  Trash2,
  User,
  UserMinus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/premium";
import {
  patchResellerEcosystemUser,
  postResellerUserPassword,
  postResellerMembershipRole,
  postResellerRemoveMember,
  type EcosystemUserRow,
} from "@/lib/revenda-api";
import { cn } from "@/lib/utils";

type Tab = "perfil" | "papel" | "senha" | "remover";

const ROLES = ["owner", "admin", "member", "media_manager", "analyst"] as const;
const ROLE_LABEL_PT: Record<(typeof ROLES)[number], string> = {
  owner: "Proprietário",
  admin: "Administrador",
  member: "Membro",
  media_manager: "Gestor de mídia",
  analyst: "Analista",
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  row: EcosystemUserRow | null;
  onChanged?: () => void | Promise<void>;
};

export function EcosystemMemberDialog({ open, onOpenChange, row, onChanged }: Props) {
  const [tab, setTab] = useState<Tab>("perfil");

  const [draftEmail, setDraftEmail] = useState("");
  const [draftName, setDraftName] = useState("");
  const [draftSuspended, setDraftSuspended] = useState(false);

  const [roleValue, setRoleValue] = useState<string>("member");

  const [newPassword, setNewPassword] = useState("");
  const [forceChange, setForceChange] = useState(true);

  const [busy, setBusy] = useState<"profile" | "role" | "password" | "remove" | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (!row || !open) return;
    setTab("perfil");
    setDraftEmail(row.user.email);
    setDraftName(row.user.name);
    setDraftSuspended(row.user.suspended);
    setRoleValue(row.role);
    setNewPassword("");
    setForceChange(true);
    setBusy(null);
    setMsg(null);
  }, [row, open]);

  function toast(text: string, type: "success" | "error" = "error") {
    setMsg({ text, type });
  }

  async function handleSaveProfile() {
    if (!row) return;
    setMsg(null);
    setBusy("profile");
    try {
      await patchResellerEcosystemUser(row.user.id, {
        email: draftEmail.trim(),
        name: draftName.trim(),
        suspended: draftSuspended,
      });
      await onChanged?.();
      toast("Perfil salvo.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao salvar perfil.");
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveRole() {
    if (!row) return;
    setMsg(null);
    setBusy("role");
    try {
      await postResellerMembershipRole({
        organizationId: row.organization.id,
        targetUserId: row.user.id,
        role: roleValue,
      });
      await onChanged?.();
      toast("Papel atualizado.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao alterar papel.");
    } finally {
      setBusy(null);
    }
  }

  async function handleSavePassword() {
    if (!row || newPassword.length < 8) return;
    setMsg(null);
    setBusy("password");
    try {
      await postResellerUserPassword(row.user.id, newPassword, { forcePasswordChange: forceChange });
      setNewPassword("");
      toast("Senha redefinida. A sessão ativa será encerrada.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao redefinir senha.");
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove() {
    if (!row) return;
    setMsg(null);
    setBusy("remove");
    try {
      await postResellerRemoveMember({
        organizationId: row.organization.id,
        targetUserId: row.user.id,
      });
      await onChanged?.();
      onOpenChange(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao remover vínculo.");
    } finally {
      setBusy(null);
    }
  }

  if (!row) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent title="Usuário" showClose className="max-w-md" />
      </Dialog>
    );
  }

  const profileDirty =
    draftEmail.trim().toLowerCase() !== row.user.email.toLowerCase() ||
    draftName.trim() !== row.user.name ||
    draftSuspended !== row.user.suspended;
  const roleDirty = roleValue !== row.role;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "perfil", label: "Perfil", icon: <User className="h-3.5 w-3.5" /> },
    { id: "papel", label: "Papel", icon: <Briefcase className="h-3.5 w-3.5" /> },
    { id: "senha", label: "Senha", icon: <Lock className="h-3.5 w-3.5" /> },
    { id: "remover", label: "Remover", icon: <UserMinus className="h-3.5 w-3.5" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="" showClose className="max-w-lg gap-0 overflow-hidden p-0">
        <div className="bg-gradient-to-br from-primary/5 via-background to-background px-6 pb-4 pt-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold uppercase text-primary">
              {row.user.name.charAt(0) || "?"}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-semibold tracking-tight">{row.user.name}</h2>
              <p className="truncate text-sm text-muted-foreground">{row.user.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {row.organization.isMatrix ? (
                  <StatusBadge tone="connected" dot>
                    Matriz
                  </StatusBadge>
                ) : null}
                <StatusBadge tone={row.user.suspended ? "alert" : "healthy"} dot>
                  {row.user.suspended ? "Suspenso" : "Ativo"}
                </StatusBadge>
                <StatusBadge tone="neutral" dot>
                  {ROLE_LABEL_PT[row.role as (typeof ROLES)[number]] ?? row.role}
                </StatusBadge>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground">{row.organization.name}</span>
            </span>
            {row.createdAt ? (
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Desde {new Date(row.createdAt).toLocaleDateString("pt-BR")}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex border-b border-border/50 bg-muted/20 px-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setMsg(null);
              }}
              className={cn(
                "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors",
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        <div className="max-h-[52vh] space-y-4 overflow-y-auto px-6 py-5">
          {msg ? (
            <div
              className={cn(
                "rounded-lg border px-3 py-2 text-xs font-medium",
                msg.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300"
                  : "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300"
              )}
            >
              {msg.text}
            </div>
          ) : null}

          {tab === "perfil" ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">E-mail</Label>
                <Input
                  type="email"
                  value={draftEmail}
                  onChange={(e) => setDraftEmail(e.target.value)}
                  disabled={busy !== null}
                  className="h-9 rounded-lg"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Nome</Label>
                <Input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  disabled={busy !== null}
                  className="h-9 rounded-lg"
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border/40 px-3 py-2.5">
                <div>
                  <p className="text-xs font-semibold text-foreground">Suspender acesso</p>
                  <p className="text-[11px] text-muted-foreground">Impede login em todas as contas até reativar.</p>
                </div>
                <Switch
                  checked={draftSuspended}
                  onCheckedChange={setDraftSuspended}
                  disabled={busy !== null}
                />
              </div>
              <Button
                type="button"
                size="sm"
                className="w-full rounded-lg"
                disabled={!profileDirty || busy !== null}
                onClick={() => void handleSaveProfile()}
              >
                {busy === "profile" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {busy === "profile" ? "Salvando…" : "Salvar perfil"}
              </Button>
            </div>
          ) : null}

          {tab === "papel" ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  Organização
                </p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">{row.organization.name}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Papel nesta empresa</Label>
                <Select value={roleValue} onValueChange={setRoleValue}>
                  <SelectTrigger className="h-9 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABEL_PT[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Proprietário e administrador gerenciam toda a conta; Membro/Gestor/Analista têm escopo reduzido.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                className="w-full rounded-lg"
                disabled={!roleDirty || busy !== null}
                onClick={() => void handleSaveRole()}
              >
                {busy === "role" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                {busy === "role" ? "Aplicando…" : "Aplicar papel"}
              </Button>
            </div>
          ) : null}

          {tab === "senha" ? (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Defina uma nova senha para este usuário. Funciona em todas as contas, já que a senha é do login.
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Nova senha</Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={busy !== null}
                  className="h-9 rounded-lg"
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border/40 px-3 py-2.5">
                <span className="text-xs text-muted-foreground">Exigir troca no próximo login</span>
                <Switch
                  checked={forceChange}
                  onCheckedChange={setForceChange}
                  disabled={busy !== null}
                />
              </div>
              <Button
                type="button"
                size="sm"
                className="w-full rounded-lg"
                disabled={busy !== null || newPassword.length < 8}
                onClick={() => void handleSavePassword()}
              >
                {busy === "password" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                {busy === "password" ? "Redefinindo…" : "Redefinir senha"}
              </Button>
            </div>
          ) : null}

          {tab === "remover" ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-destructive/30 bg-destructive/[0.06] p-4 text-sm">
                <p className="font-semibold text-destructive">Remover vínculo desta empresa</p>
                <p className="mt-1 text-destructive/90">
                  Remove <strong>{row.user.email}</strong> de <strong>{row.organization.name}</strong>. O usuário continua
                  existindo se tiver outros vínculos; caso contrário, fica sem acesso.
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="w-full rounded-lg"
                disabled={busy !== null}
                onClick={() => void handleRemove()}
              >
                {busy === "remove" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                {busy === "remove" ? "Removendo…" : "Remover vínculo"}
              </Button>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end border-t border-border/40 bg-muted/10 px-6 py-3">
          <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
