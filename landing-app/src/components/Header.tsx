import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { APP_URL } from "@/lib/env";

const NAV = [
  { href: "#recursos", label: "Recursos" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#para-quem", label: "Para quem é" },
  { href: "#faq", label: "FAQ" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-shadow ${
        scrolled ? "bg-white/85 shadow-soft backdrop-blur-md" : "bg-white/60 backdrop-blur"
      } border-b border-slate-200/60`}
    >
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <a href="#topo" className="flex items-center gap-2">
          <img
            src="/logo-ativa-dash.png"
            alt="Ativa Dash — Analytics & performance"
            className="h-9 w-auto max-h-[40px] max-w-[min(220px,70vw)] object-contain object-left sm:h-10 sm:max-h-[44px]"
            width={220}
            height={44}
            decoding="async"
          />
        </a>

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <a href={`${APP_URL}/login`} className="btn-ghost">
            Entrar
          </a>
          <a href="#contato" className="btn-primary">
            Solicitar acesso
          </a>
        </div>

        <button
          type="button"
          aria-label="Abrir menu"
          aria-expanded={open}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 lg:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-slate-200/60 bg-white lg:hidden">
          <nav className="container-page flex flex-col py-3">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                {item.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2">
              <a href={`${APP_URL}/login`} onClick={() => setOpen(false)} className="btn-outline justify-center">
                Entrar
              </a>
              <a href="#contato" onClick={() => setOpen(false)} className="btn-primary justify-center">
                Solicitar acesso
              </a>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
