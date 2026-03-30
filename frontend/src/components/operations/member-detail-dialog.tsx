import { useEffect, useState } from "react";
import { KeyRound, Shield, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/premium";
import type { MemberRow, PatchMemberPayload } from "@/lib/workspace-api";
import { patchMember, resetMemberPassword } from "@/lib/workspace-api";
import { Link } from "react-router-dom";

const roleLabel: Record<string, string> = {
  owner: "Proprietário",
  member: "Membro",
  admin: "Administrador",
  media_manager: "Gestor de mídia",
  analyst: "Analista",
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  member: MemberRow | null;
  /** Contagem exibida na lista (ex.: clientes comerciais na org atual); preparação para permissões por cliente. */
  linkedClientsCount: number | null;
  formatDate: (iso: string) => string;
  /** Usuário logado — usado para ocultar ações destrutivas em si mesmo. */
  currentUserId?: string;
  /** Query `organizationId` nas rotas workspace (workspace filho). */
  organizationId?: string;
  onMemberUpdated?: () => void | Promise<void>;
};

export function MemberDetailDialog({
  open,
  onOpenChange,
  member,
  linkedClientsCount,
  formatDate,
  currentUserId,
  organizationId,
  onMemberUpdated,
}: Props) {
  const [draftName, setDraftName] = useState("");
  const [draftEmail, setDraftEmail] = useState("");
  const [draftSuspended, setDraftSuspended] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forceChangeOnLogin, setForceChangeOnLogin] = useState(true);
  const [busy, setBusy] = useState<"profile" | "password" | null>(null);
  const [localMsg, setLocalMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!member || !open) return;
    setDraftName(member.name);
    setDraftEmail(member.email);
    setDraftSuspended(!!member.suspended);
    setNewPassword("");
    setConfirmPassword("");
    setForceChangeOnLogin(true);
    setLocalMsg(null);
    setBusy(null);
  }, [member, open]);

  const isDirect = member?.source !== "agency";
  const isSelf = !!(member && currentUserId && member.userId === currentUserId);
  const showAdminBlock = !!(member && isDirect && !isSelf);

  async function handleSaveProfile() {
    if (!member || !showAdminBlock) return;
    setLocalMsg(null);
    setBusy("profile");
    try {
      const payload: PatchMemberPayload = {};
      if (draftName.trim() !== member.name) payload.name = draftName.trim();
      if (draftEmail.trim().toLowerCase() !== member.email.toLowerCase()) payload.email = draftEmail.trim();
      if (draftSuspended !== !!member.suspended) payload.suspended = draftSuspended;
      if (Object.keys(payload).length === 0) return;

      await patchMember(member.userId, payload, organizationId);
      await onMemberUpdated?.();
      onOpenChange(false);
    } catch (e) {
      setLocalMsg(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setBusy(null);
    }
  }

  async function handleResetPassword() {
    if (!member || !showAdminBlock) return;
    setLocalMsg(null);
    if (newPassword.length < 8) {
      setLocalMsg("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalMsg("Confirmação da senha não confere.");
      return;
    }
    setBusy("password");
    try {
      await resetMemberPassword(
        member.userId,
        { newPassword, forcePasswordChange: forceChangeOnLogin },
        organizationId
      );
      setNewPassword("");
      setConfirmPassword("");
      await onMemberUpdated?.();
      setLocalMsg("Senha atualizada. Sessões anteriores foram encerradas.");
    } catch (e) {
      setLocalMsg(e instanceof Error ? e.message : "Erro ao redefinir senha");
    } finally {
      setBusy(null);
    }
  }

  const profileDirty =
    !!member &&
    (draftName.trim() !== member.name ||
      draftEmail.trim().toLowerCase() !== member.email.toLowerCase() ||
      draftSuspended !== !!member.suspended);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Membro da equipe" showClose className="max-w-md">
        {member ? (
          <>
            <div className="space-y-4 py-1">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-foreground">{member.name}</h2>
                <p className="text-sm text-muted-foreground">{member.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone="healthy" dot>
                  {member.source === "agency" ? "Acesso via agência" : "Membro direto"}
                </StatusBadge>
                {member.suspended ? (
                  <StatusBadge tone="alert" dot>
                    Bloqueado
                  </StatusBadge>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  Papel global: <strong className="text-foreground">{roleLabel[member.role] ?? member.role}</strong>
                </span>
              </div>
              <div className="grid gap-2 rounded-xl border border-border/45 bg-muted/10 p-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4 shrink-0 opacity-70" />
                  <span>
                    Clientes comerciais nesta org:{" "}
                    <strong className="text-foreground">{linkedClientsCount ?? "—"}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Shield className="h-4 w-4 shrink-0 opacity-70" />
                  <span>Desde {formatDate(member.joinedAt)}</span>
                </div>
              </div>

              {showAdminBlock ? (
                <div className="space-y-3 rounded-xl border border-border/50 bg-card/30 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-foreground">Gerenciar pelo painel</p>
                  {localMsg ? (
                    <p className="rounded-lg border border-border/50 bg-muted/20 px-2 py-1.5 text-xs text-foreground">
                      {localMsg}
                    </p>
                  ) : null}
                  <div className="space-y-1.5">
                    <Label htmlFor="md-name" className="text-xs font-semibold">
                      Nome
                    </Label>
                    <Input
                      id="md-name"
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      className="h-9 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="md-email" className="text-xs font-semibold">
                      E-mail (login)
                    </Label>
                    <Input
                      id="md-email"
                      type="email"
                      value={draftEmail}
                      onChange={(e) => setDraftEmail(e.target.value)}
                      className="h-9 rounded-lg"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border/40 px-2 py-2">
                    <div>
                      <p className="text-xs font-semibold text-foreground">Bloquear acesso</p>
                      <p className="text-[11px] text-muted-foreground">Impede login até reativar.</p>
                    </div>
                    <Switch checked={draftSuspended} onCheckedChange={setDraftSuspended} id="md-suspended" />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="w-full rounded-lg"
                    disabled={!profileDirty || busy !== null}
                    onClick={() => void handleSaveProfile()}
                  >
                    {busy === "profile" ? "Salvando…" : "Salvar nome, e-mail e status"}
                  </Button>

                  <div className="border-t border-border/40 pt-3">
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
                      <KeyRound className="h-3.5 w-3.5" aria-hidden />
                      Nova senha
                    </div>
                    <div className="space-y-2">
                      <Input
                        type="password"
                        autoComplete="new-password"
                        placeholder="Nova senha (mín. 8)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="h-9 rounded-lg"
                      />
                      <Input
                        type="password"
                        autoComplete="new-password"
                        placeholder="Confirmar senha"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="h-9 rounded-lg"
                      />
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/40 px-2 py-2">
                        <span className="text-xs text-muted-foreground">Exigir troca no próximo login</span>
                        <Switch checked={forceChangeOnLogin} onCheckedChange={setForceChangeOnLogin} />
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="w-full rounded-lg"
                        disabled={busy !== null}
                        onClick={() => void handleResetPassword()}
                      >
                        {busy === "password" ? "Aplicando…" : "Redefinir senha"}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : isSelf ? (
                <p className="text-xs text-muted-foreground">
                  Para alterar seu próprio perfil ou senha, use{" "}
                  <Link to="/configuracoes" className="font-medium text-primary underline-offset-2 hover:underline">
                    Configurações
                  </Link>
                  .
                </p>
              ) : null}

              <div className="rounded-xl border border-dashed border-border/60 bg-card/20 p-3 text-xs leading-relaxed text-muted-foreground">
                <p className="font-semibold text-foreground">Permissões por cliente (roadmap)</p>
                <p className="mt-1">
                  Em breve: visualizar, editar, campanhas, metas, integrações e gestão de equipe por workspace filho.
                  Hoje o papel global acima vale para toda a organização ativa.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                A estrutura <Link to="/clientes" className="font-medium text-primary underline-offset-2 hover:underline">Contas</Link>{" "}
                define os workspaces dos clientes; a equipe acessa cada um após{" "}
                <strong className="text-foreground">Entrar no cliente</strong>.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" className="rounded-xl" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
