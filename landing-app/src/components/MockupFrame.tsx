import type { ReactNode } from "react";

/**
 * Frame de "navegador" com chrome (3 dots + barra de URL) usado pra envelopar
 * mockups SVG/CSS de telas reais do app — dá contexto visual sem usar imagem externa.
 */
export function MockupFrame({
  url,
  children,
  className = "",
}: {
  url: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" aria-hidden />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" aria-hidden />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden />
        </div>
        <span className="truncate rounded-md bg-white px-3 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200">
          {url}
        </span>
        <span className="h-2.5 w-2.5" aria-hidden />
      </div>
      <div className="bg-white">{children}</div>
    </div>
  );
}
