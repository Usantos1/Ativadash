import React, { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Check, Eye, EyeOff, KeyRound, Loader2, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dashboardAuthClient, type AuthClient } from "@/lib/dashboard-auth-client";
import { useAuthStore } from "@/stores/auth-store";
import { useUIStore } from "@/stores/ui-store";

export type { AuthClient };

// ============================================================
// Personalize por marca (Ativa Dash)
// ============================================================
const BRAND_NAME = "Ativa Dash";
const LOGO_URL = "/logo-ativa-dash.png";
const WHATSAPP_ICON_URL = "/integrations/whatsapp.svg";
const LOGIN_BACKGROUND_URL =
  "https://img.freepik.com/fotos-gratis/nuvens-brancas-dramaticas-e-ceu-azul-da-vista-da-janela-do-aviao-fundo-colorido-do-por-do-sol-cloudscape_90220-1209.jpg";
const SUPPORT_WHATSAPP_NUMBER = "5519991979912";
const SUPPORT_WHATSAPP_TEXT = `Olá, preciso de ajuda para acessar o ${BRAND_NAME}.`;
/** Acentos da tela seguem `--primary` em `index.css` (tom do logo Ativa Dash). */
const RATE_LIMIT_BLOCK_SECONDS = 45;
// ============================================================

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const SUPPORT_WHATSAPP_URL = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(
  SUPPORT_WHATSAPP_TEXT
)}`;
const REMEMBER_KEY = "auth_remembered_email";

type ToastInput = {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
};

function useLoginToasts() {
  const [toastState, setToastState] = useState<ToastInput | null>(null);

  const toast = useCallback((t: ToastInput) => {
    setToastState(t);
    window.setTimeout(() => setToastState(null), 4500);
  }, []);

  const ToastViewport =
    toastState == null ? null : (
      <div
        className="pointer-events-none fixed left-1/2 top-4 z-[100] w-[min(100%-2rem,380px)] -translate-x-1/2 rounded-lg border bg-white px-4 py-3 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900"
        role="status"
      >
        <p className="font-semibold text-slate-900 dark:text-slate-50">{toastState.title}</p>
        {toastState.description ? (
          <p
            className={
              toastState.variant === "destructive"
                ? "mt-1 text-destructive"
                : "mt-1 text-slate-600 dark:text-slate-300"
            }
          >
            {toastState.description}
          </p>
        ) : null}
      </div>
    );

  return { toast, ToastViewport };
}

interface LoginPageProps {
  authClient: AuthClient;
  isAuthenticated?: boolean;
  authChecking?: boolean;
  redirectTo?: string;
  themeToggle?: React.ReactNode;
}

export function LoginPage({
  authClient,
  isAuthenticated = false,
  authChecking = false,
  redirectTo = "/",
  themeToggle,
}: LoginPageProps) {
  const navigate = useNavigate();
  const { toast, ToastViewport } = useLoginToasts();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState(() => localStorage.getItem(REMEMBER_KEY) || "");
  const [password, setPassword] = useState("");
  const [rememberLogin, setRememberLogin] = useState(() => Boolean(localStorage.getItem(REMEMBER_KEY)));
  const [authMode, setAuthMode] = useState<"signin" | "reset">("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [showSupportBubble, setShowSupportBubble] = useState(false);
  const [lockLoginUntil, setLockLoginUntil] = useState<number | null>(null);
  const [lockSecondsLeft, setLockSecondsLeft] = useState(0);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (rememberLogin && email.trim()) {
      localStorage.setItem(REMEMBER_KEY, email.trim());
      return;
    }
    if (!rememberLogin) {
      localStorage.removeItem(REMEMBER_KEY);
    }
  }, [email, rememberLogin]);

  useEffect(() => {
    if (!authChecking && isAuthenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, authChecking, navigate, redirectTo]);

  useEffect(() => {
    const showTimer = window.setTimeout(() => setShowSupportBubble(true), 2500);
    const hideTimer = window.setTimeout(() => setShowSupportBubble(false), 8500);
    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  useEffect(() => {
    if (lockLoginUntil == null) {
      setLockSecondsLeft(0);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((lockLoginUntil - Date.now()) / 1000));
      setLockSecondsLeft(left);
      if (left <= 0) setLockLoginUntil(null);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [lockLoginUntil]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockLoginUntil != null && Date.now() < lockLoginUntil) return;
    if (!email || !password) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      await authClient.login(email, password);
      toast({
        title: "Login realizado",
        description: "Bem-vindo de volta!",
      });
      if (rememberLogin) {
        localStorage.setItem(REMEMBER_KEY, email.trim());
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }
      navigate(redirectTo, { replace: true });
    } catch (error: unknown) {
      const msg = getErrorMessage(error, "Email ou senha incorretos.");
      const isTooManyRequests =
        typeof msg === "string" && (msg.includes("Muitas tentativas") || msg.includes("429"));
      if (isTooManyRequests) {
        setLockLoginUntil(Date.now() + RATE_LIMIT_BLOCK_SECONDS * 1000);
      }
      toast({
        title: "Erro no login",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, digite seu email",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      await authClient.requestPasswordReset(email);
      toast({
        title: "Email enviado",
        description: "Se o email existir, você receberá um link para redefinir sua senha.",
      });
      setEmail("");
    } catch (error: unknown) {
      toast({
        title: "Erro",
        description: getErrorMessage(error, "Erro ao enviar email de redefinição"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (authChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div
      className="relative flex min-h-screen flex-col overflow-hidden bg-slate-950 bg-cover bg-center bg-no-repeat text-slate-700 dark:text-slate-200"
      style={{ backgroundImage: `url(${LOGIN_BACKGROUND_URL})` }}
    >
      {ToastViewport}
      <div className="absolute inset-0 bg-slate-950/30 dark:bg-slate-950/60" aria-hidden="true" />
      {themeToggle ? (
        <div className="absolute right-4 top-4 z-20 rounded-full bg-white/90 shadow-lg backdrop-blur dark:bg-slate-900/90">
          {themeToggle}
        </div>
      ) : null}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <section className="w-full max-w-[372px] rounded-[18px] bg-white px-7 py-8 shadow-2xl dark:bg-slate-900 sm:px-8 sm:py-9">
          <div className="mb-7 flex justify-center">
            <img
              src={LOGO_URL}
              alt={BRAND_NAME}
              className="h-16 w-auto max-w-[225px] object-contain"
              loading="eager"
              decoding="async"
            />
          </div>
          {authMode === "signin" ? (
            <form onSubmit={handleSignIn} className="space-y-5">
              <div className="group relative pt-2">
                <Label
                  htmlFor="signin-email"
                  className="absolute left-4 top-0 z-10 bg-white px-1 text-[11px] font-medium text-slate-500 group-hover:text-primary group-focus-within:text-primary dark:bg-slate-900 dark:text-slate-300"
                >
                  Email *
                </Label>
                <Input
                  id="signin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                  autoComplete="email"
                  className="h-[40px] rounded-full border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-none hover:border-primary focus-visible:border-primary focus-visible:ring-0 focus-visible:ring-offset-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div className="group relative pt-2">
                <Label
                  htmlFor="signin-password"
                  className="absolute left-4 top-0 z-10 bg-white px-1 text-[11px] font-medium text-slate-500 group-hover:text-primary group-focus-within:text-primary dark:bg-slate-900 dark:text-slate-300"
                >
                  Senha *
                </Label>
                <div className="relative">
                  <Input
                    id="signin-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                    autoComplete="current-password"
                    className="h-[40px] rounded-full border-slate-200 bg-white px-4 pr-11 text-sm text-slate-900 shadow-none hover:border-primary focus-visible:border-primary focus-visible:ring-0 focus-visible:ring-offset-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-700 focus:outline-none dark:text-slate-300 dark:hover:text-white"
                    tabIndex={-1}
                    aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    id="remember-login"
                    type="button"
                    role="checkbox"
                    aria-checked={rememberLogin}
                    aria-label="Salvar login"
                    onClick={() => setRememberLogin((v) => !v)}
                    className={`flex h-4 w-4 min-h-0 min-w-0 shrink-0 items-center justify-center rounded-[3px] border transition-colors ${
                      rememberLogin
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-slate-400 bg-white text-transparent dark:border-slate-500 dark:bg-slate-900"
                    }`}
                  >
                    <Check className="h-3 w-3" />
                  </button>
                  <Label
                    onClick={() => setRememberLogin((v) => !v)}
                    className="cursor-pointer text-xs font-normal text-primary"
                  >
                    Salvar login
                  </Label>
                </div>
                <button
                  type="button"
                  onClick={() => setAuthMode("reset")}
                  className="inline-flex shrink-0 items-center text-xs font-semibold text-primary transition-colors hover:text-primary/90 hover:underline"
                >
                  <KeyRound className="mr-1 h-4 w-4 shrink-0 text-primary/80" />
                  Esqueci minha senha
                </button>
              </div>
              <Button
                type="submit"
                className="h-[34px] w-full rounded-full text-sm font-semibold shadow-none"
                disabled={loading || lockSecondsLeft > 0}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : lockSecondsLeft > 0 ? (
                  <>Aguarde {lockSecondsLeft} s para tentar de novo</>
                ) : (
                  "Entrar"
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="text-center">
                <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Recuperar senha</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                  Digite seu email para receber um link de redefinição.
                </p>
              </div>
              <div className="group relative pt-2">
                <Label
                  htmlFor="reset-email"
                  className="absolute left-4 top-0 z-10 bg-white px-1 text-[11px] font-medium text-slate-500 group-hover:text-primary group-focus-within:text-primary dark:bg-slate-900 dark:text-slate-300"
                >
                  Email *
                </Label>
                <Input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                  autoComplete="email"
                  className="h-[40px] rounded-full border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-none hover:border-primary focus-visible:border-primary focus-visible:ring-0 focus-visible:ring-offset-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <Button
                type="submit"
                className="h-[34px] w-full rounded-full text-sm font-semibold shadow-none"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar link de redefinição"
                )}
              </Button>
              <button
                type="button"
                onClick={() => setAuthMode("signin")}
                className="text-sm font-semibold text-primary transition-colors hover:text-primary/90 hover:underline"
              >
                Voltar para o login
              </button>
            </form>
          )}
        </section>
      </main>
      <footer className="relative z-10 pb-4 text-center text-[11px] text-white/65">
        <div className="mb-1 flex justify-center gap-4">
          <button
            type="button"
            onClick={() => navigate("/politica-privacidade")}
            className="underline-offset-2 hover:text-white hover:underline"
          >
            Política de Privacidade
          </button>
          <button
            type="button"
            onClick={() => navigate("/termos-de-servico")}
            className="underline-offset-2 hover:text-white hover:underline"
          >
            Termos de Uso
          </button>
        </div>
        <p>
          © {currentYear} {BRAND_NAME}. Todos os direitos reservados.
        </p>
      </footer>
      <a
        href={SUPPORT_WHATSAPP_URL}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-5 right-5 z-20 flex items-end gap-2"
        aria-label="Abrir suporte no WhatsApp"
      >
        <span
          className={`mb-1 hidden rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xl transition-all duration-300 sm:inline ${
            showSupportBubble
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-2 opacity-0"
          }`}
        >
          Como podemos ajudar?
        </span>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366] shadow-xl transition-transform hover:scale-105">
          <img
            src={WHATSAPP_ICON_URL}
            alt=""
            className="h-6 w-6 object-contain brightness-0 invert"
            loading="lazy"
          />
        </span>
      </a>
    </div>
  );
}

function LoginThemeToggle() {
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-9 w-9 shrink-0 rounded-full"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
    >
      <Sun className="h-4 w-4 dark:hidden" />
      <Moon className="hidden h-4 w-4 dark:inline" />
    </Button>
  );
}

/** Rota `/login`: injeta store do dashboard na página portátil. */
export function Login() {
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/dashboard";
  const accessToken = useAuthStore((s) => s.accessToken);
  const [authHydrated, setAuthHydrated] = useState(() => useAuthStore.persist.hasHydrated());

  useEffect(() => {
    useUIStore.getState().setTheme(useUIStore.getState().theme);
  }, []);

  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      setAuthHydrated(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) setAuthHydrated(true);
  }, []);

  return (
    <LoginPage
      authClient={dashboardAuthClient}
      isAuthenticated={Boolean(accessToken)}
      authChecking={!authHydrated}
      redirectTo={from}
      themeToggle={<LoginThemeToggle />}
    />
  );
}
