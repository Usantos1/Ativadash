import { APP_URL } from './constants';

export function LandingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-12 md:py-16 px-4 md:px-8 border-t border-[#00F7A5]/10 bg-[#030504]">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col items-center text-center gap-8">
          <div className="flex flex-col items-center gap-3">
            <img
              src="/logo-ativafix.png"
              alt="Ativa FIX"
              className="h-9 md:h-10 w-auto opacity-95"
            />
            <p className="text-sm text-[#6D7873] max-w-md">
              Sistema completo para gestão da sua assistência técnica.
            </p>
          </div>

          <nav
            className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm"
            aria-label="Links do rodapé"
          >
            <a
              href={`${APP_URL}/termos-de-uso`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#9AA4A0] hover:text-[#00F7A5] transition-colors"
            >
              Termos de Uso
            </a>
            <span className="text-[#3D4540]" aria-hidden>
              •
            </span>
            <a
              href={`${APP_URL}/politica-de-privacidade`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#9AA4A0] hover:text-[#00F7A5] transition-colors"
            >
              Política de Privacidade
            </a>
            <span className="text-[#3D4540]" aria-hidden>
              •
            </span>
            <a
              href={APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#9AA4A0] hover:text-[#00F7A5] transition-colors"
            >
              Acessar o sistema
            </a>
          </nav>

          <p className="text-xs text-[#3D4540]">
            © {currentYear} Ativa FIX. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
