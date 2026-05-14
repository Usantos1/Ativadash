import { APP_URL } from "@/lib/env";

const NAV_PRODUTO = [
  { href: "#recursos", label: "Recursos" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#para-quem", label: "Para quem é" },
  { href: "#faq", label: "FAQ" },
];

const NAV_LEGAL = [
  { href: `${APP_URL}/politica-privacidade`, label: "Política de privacidade" },
  { href: `${APP_URL}/termos-de-servico`, label: "Termos de serviço" },
  { href: `${APP_URL}/exclusao-dados`, label: "Exclusão de dados" },
];

export function Footer() {
  return (
    <footer className="border-t border-slate-200/70 bg-white/70 backdrop-blur">
      <div className="container-page py-10">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <a href="#topo" className="inline-flex">
              <img
                src="/logo-ativa-dash.png"
                alt="Ativa Dash"
                className="h-9 w-auto max-h-[40px] max-w-[min(220px,85vw)] object-contain object-left sm:h-10"
                width={220}
                height={44}
                decoding="async"
              />
            </a>
            <p className="mt-3 max-w-xs text-sm text-slate-600">
              Painel de marketing e performance para agências e clientes finais. Decida com dados, em tempo real.
            </p>
          </div>

          <nav>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Produto</h4>
            <ul className="mt-3 space-y-1.5 text-sm">
              {NAV_PRODUTO.map((item) => (
                <li key={item.href}>
                  <a className="text-slate-700 hover:text-brand-700" href={item.href}>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Acesso</h4>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li>
                <a className="text-slate-700 hover:text-brand-700" href={`${APP_URL}/login`}>
                  Entrar no painel
                </a>
              </li>
              <li>
                <a className="text-slate-700 hover:text-brand-700" href="#contato">
                  Solicitar acesso
                </a>
              </li>
            </ul>
          </nav>

          <nav>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Legal</h4>
            <ul className="mt-3 space-y-1.5 text-sm">
              {NAV_LEGAL.map((item) => (
                <li key={item.href}>
                  <a className="text-slate-700 hover:text-brand-700" href={item.href}>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-slate-200/70 pt-6 text-xs text-slate-500 sm:flex-row">
          <p>© {new Date().getFullYear()} Ativa Dash · Todos os direitos reservados</p>
          <p>Plataforma SaaS de analytics & performance.</p>
        </div>
      </div>
    </footer>
  );
}
