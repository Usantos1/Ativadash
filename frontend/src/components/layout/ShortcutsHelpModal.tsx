import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export function ShortcutsHelpModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener("ativadash:open-shortcuts-modal", h);
    return () => window.removeEventListener("ativadash:open-shortcuts-modal", h);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md" title="Atalhos de teclado" showClose>
        <ul className="space-y-2 py-2 text-sm text-muted-foreground">
          <li>
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">G</kbd> depois{" "}
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">D</kbd> — Dashboard
          </li>
          <li>
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">G</kbd> depois{" "}
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">P</kbd> — Painel ADS
          </li>
          <li>
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">G</kbd> depois{" "}
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">C</kbd> — Clientes
          </li>
          <li>
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">?</kbd> — Esta ajuda
          </li>
          <li>
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">/</kbd> — Focar busca (quando existir)
          </li>
          <li>
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">Ctrl</kbd>+
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">S</kbd> — Pedir gravação do
            formulário ativo (Metas / Configurações)
          </li>
          <li>
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">Esc</kbd> — Fechar modais (Radix)
          </li>
        </ul>
        <p className="text-xs text-muted-foreground">Atalhos ignorados em campos de texto.</p>
      </DialogContent>
    </Dialog>
  );
}
