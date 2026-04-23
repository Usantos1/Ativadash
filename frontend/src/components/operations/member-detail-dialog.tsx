import { useEffect, useState } from "react";
import { Users, Clock, Bell, User, Lock, Briefcase } from "lucide-react";
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
import type { MemberRow, PatchMemberPayload } from "@/lib/workspace-api";
import { patchMember, resetMemberPassword } from "@/lib/workspace-api";
import { membershipRoleLabelPt } from "@/lib/membership-role-labels";
import {
  TEAM_ACCESS_LEVEL_OPTIONS,
  TEAM_JOB_TITLE_OPTIONS,
  accessLevelFromSystemRole,
  accessLevelLabelPt,
  jobTitleLabelPt,
  teamModalSelectTriggerClass,
  type TeamJobTitleValue,
} from "@/lib/team-access-ui";
import { cn } from "@/lib/utils";

type AccessLevelUi = "ADMIN" | "OPERADOR" | "VIEWER";
type Tab = "perfil" | "acesso" | "seguranca" | "alertas";

function canEditMemberJobAndAccess(role: string): boolean {
  return role !== "owner" && role !== "workspace_owner" && role !== "agency_owner";
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  member: MemberRow | null;
  linkedClientsCount: number | null;
  formatDate: (iso: string) => string;
  currentUserId?: string;
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
  const [tab, setTab] = useState<Tab>("perfil");
  const [draftName, setDraftName] = useState("");
  const [draftEmail, setDraftEmail] = useState("");
  const [draftSuspended, setDraftSuspended] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forceChangeOnLogin, setForceChangeOnLogin] = useState(true);
  const [busy, setBusy] = useState<"profile" | "password" | "jobAccess" | "alertPrefs" | null>(null);
  const [localMsg, setLocalMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [draftJobTitle, setDraftJobTitle] = useState<TeamJobTitleValue>("traffic_manager");
  const [draftAccessLevel, setDraftAccessLevel] = useState<AccessLevelUi>("OPERADOR");
  const [draftReceiveWhatsappAlerts, setDraftReceiveWhatsappAlerts] = useState(true);
  const [draftAlertStart, setDraftAlertStart] = useState("");
  const [draftAlertEnd, setDraftAlertEnd] = useState("");

  useEffect(() => {
    if (!member || !open) return;
    setTab("perfil");
    setDraftName(member.name);
    setDraftEmail(member.email);
    setDraftSuspended(!!member.suspended);
    setDraftJobTitle((member.jobTitle as TeamJobTitleValue) || "traffic_manager");
    setDraftAccessLevel(accessLevelFromSystemRole(member.role));
    setDraftReceiveWhatsappAlerts(member.receiveWhatsappAlerts !== false);
    setDraftAlertStart(member.alertStartHour?.trim() ?? "");
    setDraftAlertEnd(member.alertEndHour?.trim() ?? "");
    setNewPassword("");
    setConfirmPassword("");
    setForceChangeOnLogin(true);
    setLocalMsg(null);
    setBusy(null);
  }, [member, open]);

  const isDirect = member?.source !== "agency";
  const isSelf = !!(member && currentUserId && member.userId === currentUserId);
  const canEdit = !!(member && isDirect);
  const canEditJobAccess = !!(member && canEdit && canEditMemberJobAndAccess(member.role));
  const canEditProfile = canEdit;
  const canManageOther = !!(member && isDirect && !isSelf);
  const canChangePassword = !!(member && canEdit);

  function msg(text: string, type: "success" | "error" = "error") {
    setLocalMsg({ text, type });
  }

  async function handleSaveProfile() {
    if (!member || !canEditProfile) return;
    setLocalMsg(null);
    setBusy("profile");
    try {
      const payload: PatchMemberPayload = {};
      if (draftName.trim() !== member.name) payload.name = draftName.trim();
      if (draftEmail.trim().toLowerCase() !== member.email.toLowerCase()) payload.email = draftEmail.trim();
      if (!isSelf && draftSuspended !== !!member.suspended) payload.suspended = draftSuspended;
      if (Object.keys(payload).length === 0) {
        setBusy(null);
        return;
      }
      await patchMember(member.userId, payload, organizationId);
      await onMemberUpdated?.();
      msg("Perfil atualizado.", "success");
    } catch (e) {
      msg(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveAlertPrefs() {
    if (!member || !canManageOther) return;
    setLocalMsg(null);
    setBusy("alertPrefs");
    try {
      const payload: PatchMemberPayload = {};
      if (draftReceiveWhatsappAlerts !== (member.receiveWhatsappAlerts !== false)) {
        payload.receiveWhatsappAlerts = draftReceiveWhatsappAlerts;
      }
      const startWas = member.alertStartHour?.trim() ?? "";
      const endWas = member.alertEndHour?.trim() ?? "";
      if (draftAlertStart.trim() !== startWas) {
        payload.alertStartHour = draftAlertStart.trim() === "" ? "" : draftAlertStart.trim();
      }
      if (draftAlertEnd.trim() !== endWas) {
        payload.alertEndHour = draftAlertEnd.trim() === "" ? "" : draftAlertEnd.trim();
      }
      if (Object.keys(payload).length === 0) {
        setBusy(null);
        return;
      }
      await patchMember(member.userId, payload, organizationId);
      await onMemberUpdated?.();
      msg("Alertas atualizados.", "success");
    } catch (e) {
      msg(e instanceof Error ? e.message : "Erro ao salvar alertas");
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveJobAccess() {
    if (!member || !canEditJobAccess) return;
    setLocalMsg(null);
    setBusy("jobAccess");
    try {
      const currentTitle = (member.jobTitle as TeamJobTitleValue) || "traffic_manager";
      const currentLevel = accessLevelFromSystemRole(member.role);
      const payload: PatchMemberPayload = {};
      if (draftJobTitle !== currentTitle) payload.jobTitle = draftJobTitle;
      if (draftAccessLevel !== currentLevel) payload.accessLevel = draftAccessLevel;
      if (Object.keys(payload).length === 0) {
        setBusy(null);
        return;
      }
      await patchMember(member.userId, payload, organizationId);
      await onMemberUpdated?.();
      msg("Cargo e nível atualizados.", "success");
    } catch (e) {
      msg(e instanceof Error ? e.message : "Erro ao salvar cargo ou nível");
    } finally {
      setBusy(null);
    }
  }

  async function handleResetPassword() {
    if (!member || !canChangePassword) return;
    setLocalMsg(null);
    if (newPassword.length < 8) { msg("Mínimo 8 caracteres."); return; }
    if (newPassword !== confirmPassword) { msg("As senhas não conferem."); return; }
    setBusy("password");
    try {
      await resetMemberPassword(
        member.userId,
        { newPassword, forcePasswordChange: isSelf ? false : forceChangeOnLogin },
        organizationId
      );
      setNewPassword("");
      setConfirmPassword("");
      await onMemberUpdated?.();
      msg(isSelf ? "Sua senha foi alterada." : "Senha redefinida com sucesso.", "success");
    } catch (e) {
      msg(e instanceof Error ? e.message : "Erro ao redefinir senha");
    } finally {
      setBusy(null);
    }
  }

  const profileDirty =
    !!member &&
    (draftName.trim() !== member.name ||
      draftEmail.trim().toLowerCase() !== member.email.toLowerCase() ||
      (!isSelf && draftSuspended !== !!member.suspended));

  const jobAccessDirty =
    !!member &&
    canEditJobAccess &&
    (draftJobTitle !== ((member.jobTitle as TeamJobTitleValue) || "traffic_manager") ||
      draftAccessLevel !== accessLevelFromSystemRole(member.role));

  const alertPrefsDirty =
    !!member &&
    canManageOther &&
    (draftReceiveWhatsappAlerts !== (member.receiveWhatsappAlerts !== false) ||
      draftAlertStart.trim() !== (member.alertStartHour?.trim() ?? "") ||
      draftAlertEnd.trim() !== (member.alertEndHour?.trim() ?? ""));

  const tabs: { id: Tab; label: string; icon: React.ReactNode; show: boolean }[] = [
    { id: "perfil", label: "Perfil", icon: <User className="h-3.5 w-3.5" />, show: true },
    { id: "acesso", label: "Acesso", icon: <Briefcase className="h-3.5 w-3.5" />, show: canEditJobAccess },
    { id: "seguranca", label: "Senha", icon: <Lock className="h-3.5 w-3.5" />, show: canChangePassword },
    { id: "alertas", label: "Alertas", icon: <Bell className="h-3.5 w-3.5" />, show: canManageOther },
  ];
  const visibleTabs = tabs.filter((t) => t.show);

  if (!member) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent title="Membro da equipe" showClose className="max-w-md" />
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="" showClose className="max-w-lg gap-0 p-0 overflow-hidden">
        {/* ── Header ── */}
        <div className="bg-gradient-to-br from-primary/5 via-background to-background px-6 pt-6 pb-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg uppercase">
              {member.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-semibold tracking-tight">{member.name}</h2>
              <p className="truncate text-sm text-muted-foreground">{member.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {isSelf ? (
                  <StatusBadge tone="connected" dot>Você</StatusBadge>
                ) : null}
                <StatusBadge
                  tone={member.source === "agency_excluded" ? "alert" : member.source === "agency" ? "neutral" : "healthy"}
                  dot
                >
                  {member.source === "agency_excluded"
                    ? "Bloqueado (herdado)"
                    : member.source === "agency"
                      ? "Via agência"
                      : "Membro direto"}
                </StatusBadge>
                {member.suspended ? <StatusBadge tone="alert" dot>Bloqueado</StatusBadge> : null}
              </div>
            </div>
          </div>

          {/* ── Resumo compacto ── */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border/40 bg-card/50 px-3 py-2 text-center">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Cargo</p>
              <p className="mt-0.5 text-xs font-semibold text-foreground truncate">{jobTitleLabelPt(member.jobTitle)}</p>
            </div>
            <div className="rounded-lg border border-border/40 bg-card/50 px-3 py-2 text-center">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Nível</p>
              <p className="mt-0.5 text-xs font-semibold text-foreground">{accessLevelLabelPt(accessLevelFromSystemRole(member.role))}</p>
            </div>
            <div className="rounded-lg border border-border/40 bg-card/50 px-3 py-2 text-center">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Função</p>
              <p className="mt-0.5 text-xs font-semibold text-foreground truncate">{membershipRoleLabelPt(member.role)}</p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {linkedClientsCount ?? 0} clientes
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Desde {formatDate(member.joinedAt)}
            </span>
          </div>
        </div>

        {/* ── Tabs ── */}
        {visibleTabs.length > 1 ? (
          <div className="flex border-b border-border/50 bg-muted/20 px-6">
            {visibleTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { setTab(t.id); setLocalMsg(null); }}
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
        ) : null}

        {/* ── Conteúdo da tab ── */}
        <div className="px-6 py-5 space-y-4 max-h-[50vh] overflow-y-auto">
          {localMsg ? (
            <div
              className={cn(
                "rounded-lg border px-3 py-2 text-xs font-medium",
                localMsg.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300"
                  : "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300"
              )}
            >
              {localMsg.text}
            </div>
          ) : null}

          {/* ── PERFIL ── */}
          {tab === "perfil" ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="md-name" className="text-xs font-semibold">Nome</Label>
                <Input
                  id="md-name"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  disabled={!canEditProfile || busy !== null}
                  className="h-9 rounded-lg"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="md-email" className="text-xs font-semibold">E-mail</Label>
                <Input
                  id="md-email"
                  type="email"
                  value={draftEmail}
                  onChange={(e) => setDraftEmail(e.target.value)}
                  disabled={!canEditProfile || busy !== null}
                  className="h-9 rounded-lg"
                />
              </div>
              {canManageOther ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border/40 px-3 py-2.5">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Bloquear acesso</p>
                    <p className="text-[11px] text-muted-foreground">Impede o login até reativar.</p>
                  </div>
                  <Switch checked={draftSuspended} onCheckedChange={setDraftSuspended} disabled={busy !== null} />
                </div>
              ) : null}
              {canEditProfile ? (
                <Button
                  type="button"
                  size="sm"
                  className="w-full rounded-lg"
                  disabled={!profileDirty || busy !== null}
                  onClick={() => void handleSaveProfile()}
                >
                  {busy === "profile" ? "Salvando…" : "Salvar alterações"}
                </Button>
              ) : null}
            </div>
          ) : null}

          {/* ── ACESSO ── */}
          {tab === "acesso" && canEditJobAccess ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Cargo</Label>
                  <Select value={draftJobTitle} onValueChange={(v) => setDraftJobTitle(v as TeamJobTitleValue)}>
                    <SelectTrigger className={teamModalSelectTriggerClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEAM_JOB_TITLE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Nível de acesso</Label>
                  <Select value={draftAccessLevel} onValueChange={(v) => setDraftAccessLevel(v as AccessLevelUi)}>
                    <SelectTrigger className={teamModalSelectTriggerClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEAM_ACCESS_LEVEL_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                className="w-full rounded-lg"
                disabled={!jobAccessDirty || busy !== null}
                onClick={() => void handleSaveJobAccess()}
              >
                {busy === "jobAccess" ? "Salvando…" : "Salvar cargo e nível"}
              </Button>
            </div>
          ) : null}

          {/* ── SEGURANÇA ── */}
          {tab === "seguranca" && canChangePassword ? (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                {isSelf
                  ? "Defina uma nova senha. Use 8 caracteres ou mais, combinando letras e números."
                  : "Defina uma nova senha para este membro. A sessão ativa dele será encerrada."}
              </p>
              <div className="space-y-3">
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
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Confirmar senha</Label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={busy !== null}
                    className="h-9 rounded-lg"
                  />
                </div>
                {!isSelf ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border/40 px-3 py-2.5">
                    <span className="text-xs text-muted-foreground">Exigir troca no próximo login</span>
                    <Switch checked={forceChangeOnLogin} onCheckedChange={setForceChangeOnLogin} disabled={busy !== null} />
                  </div>
                ) : null}
              </div>
              <Button
                type="button"
                size="sm"
                className="w-full rounded-lg"
                disabled={busy !== null || newPassword.length < 8 || newPassword !== confirmPassword}
                onClick={() => void handleResetPassword()}
              >
                {busy === "password" ? (isSelf ? "Alterando…" : "Redefinindo…") : isSelf ? "Alterar senha" : "Redefinir senha"}
              </Button>
            </div>
          ) : null}

          {/* ── ALERTAS ── */}
          {tab === "alertas" && canManageOther ? (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Defina o horário em que este membro recebe alertas via WhatsApp (fuso América/São Paulo). Deixe vazio para 24h.
              </p>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border/40 px-3 py-2.5">
                <span className="text-xs font-medium">Receber alertas WhatsApp</span>
                <Switch
                  checked={draftReceiveWhatsappAlerts}
                  onCheckedChange={setDraftReceiveWhatsappAlerts}
                  disabled={busy !== null}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Início do expediente</Label>
                  <Input
                    type="time"
                    value={draftAlertStart}
                    onChange={(e) => setDraftAlertStart(e.target.value)}
                    disabled={busy !== null || !draftReceiveWhatsappAlerts}
                    className="h-9 rounded-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Fim do expediente</Label>
                  <Input
                    type="time"
                    value={draftAlertEnd}
                    onChange={(e) => setDraftAlertEnd(e.target.value)}
                    disabled={busy !== null || !draftReceiveWhatsappAlerts}
                    className="h-9 rounded-lg"
                  />
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                className="w-full rounded-lg"
                disabled={!alertPrefsDirty || busy !== null}
                onClick={() => void handleSaveAlertPrefs()}
              >
                {busy === "alertPrefs" ? "Salvando…" : "Salvar alertas"}
              </Button>
            </div>
          ) : null}
        </div>

        {/* ── Footer ── */}
        <div className="border-t border-border/40 bg-muted/10 px-6 py-3 flex justify-end">
          <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
