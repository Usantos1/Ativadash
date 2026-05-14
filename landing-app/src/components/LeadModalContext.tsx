import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Ctx = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

const LeadModalContext = createContext<Ctx | null>(null);

export function LeadModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  return (
    <LeadModalContext.Provider value={{ isOpen, open, close }}>{children}</LeadModalContext.Provider>
  );
}

export function useLeadModal(): Ctx {
  const c = useContext(LeadModalContext);
  if (!c) throw new Error("useLeadModal precisa estar dentro de <LeadModalProvider>");
  return c;
}
