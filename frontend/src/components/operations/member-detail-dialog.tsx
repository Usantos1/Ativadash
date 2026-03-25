import { Shield, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/premium";
import type { MemberRow } from "@/lib/workspace-api";
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
};

export function MemberDetailDialog({ open, onOpenChange, member, linkedClientsCount, formatDate }: Props) {
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
