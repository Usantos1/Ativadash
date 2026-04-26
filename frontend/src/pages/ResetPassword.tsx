import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Moon,
  ShieldAlert,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  confirmPasswordReset,
  validatePasswordResetToken,
  type ResetTokenValidation,
} from "@/lib/dashboard-auth-client";
import { useUIStore } from "@/stores/ui-store";

const BRAND_NAME = "Ativa Dash";
const LOGO_URL = "/logo-ativa-dash.png";
const LOGIN_BACKGROUND_URL =
  "https://img.freepik.com/fotos-gratis/nuvens-brancas-dramaticas-e-ceu-azul-da-vista-da-janela-do-aviao-fundo-colorido-do-por-do-sol-cloudscape_90220-1209.jpg";
const SUPPORT_WHATSAPP_NUMBER = "5519991979912";
const SUPPORT_WHATSAPP_TEXT = `Olá, preciso de ajuda para redefinir minha senha no ${BRAND_NAME}.`;

const SUPPORT_WHATSAPP_URL = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(
  SUPPORT_WHATSAPP_TEXT
)}`;

type ToastInput = {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
};

function useToasts() {
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

function PageThemeToggle() {
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

function PasswordStrength({ value }: { value: string }) {
  const score = useMemo(() => {
    if (!value) return 0;
    let s = 0;
    if (value.length >= 6) s++;
    if (value.length >= 10) s++;
    if (/[A-Z]/.test(value) && /[a-z]/.test(value)) s++;
    if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) s++;
    return Math.min(s, 4);
  }, [value]);
  const colors = ["bg-slate-200", "bg-rose-400", "bg-amber-400", "bg-lime-500", "bg-emerald-500"];
  const labels = ["", "Fraca", "Razoável", "Boa", "Forte"];
  return (
    <div className="mt-1 flex items-center gap-2">
      <div className="flex flex-1 gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < score ? colors[score] : "bg-slate-200 dark:bg-slate-700"
            }`}
          />
        ))}
      </div>
      <span className="w-16 text-right text-[11px] text-slate-500 dark:text-slate-400">
        {labels[score] || "—"}
      </span>
    </div>
  );
}

export function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const { toast, ToastViewport } = useToasts();

  const [validating, setValidating] = useState(true);
  const [validation, setValidation] = useState<ResetTokenValidation | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    useUIStore.getState().setTheme(useUIStore.getState().theme);
  }, []);

  useEffect(() => {
    let alive = true;
    if (!token) {
      setValidation({ valid: false, message: "Token ausente" });
      setValidating(false);
      return () => {
        alive = false;
      };
    }
    setValidating(true);
    validatePasswordResetToken(token)
      .then((res) => {
        if (alive) setValidation(res);
      })
      .catch(() => {
        if (alive) setValidation({ valid: false, message: "Não foi possível validar o token" });
      })
      .finally(() => {
        if (alive) setValidating(false);
      });
    return () => {
      alive = false;
    };
  }, [token]);

  const passwordsMatch = password.length > 0 && password === confirmPwd;
  const minLength = password.length >= 6;
  const canSubmit = minLength && passwordsMatch && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await confirmPasswordReset({
        token,
        newPassword: password,
        confirmPassword: confirmPwd,
      });
      setDone(true);
      toast({
        title: "Senha redefinida",
        description: "Você já pode entrar com sua nova senha.",
      });
      window.setTimeout(() => navigate("/login", { replace: true }), 2200);
    } catch (error: unknown) {
      const msg =
        error instanceof Error && error.message
          ? error.message
          : "Não foi possível redefinir sua senha";
      toast({
        title: "Erro ao redefinir",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="relative flex min-h-screen flex-col overflow-hidden bg-slate-950 bg-cover bg-center bg-no-repeat text-slate-700 dark:text-slate-200"
      style={{ backgroundImage: `url(${LOGIN_BACKGROUND_URL})` }}
    >
      {ToastViewport}
      <div className="absolute inset-0 bg-slate-950/30 dark:bg-slate-950/60" aria-hidden="true" />
      <div
        className="absolute right-4 z-20 rounded-full bg-white/90 shadow-lg backdrop-blur dark:bg-slate-900/90"
        style={{ top: "max(1rem, env(safe-area-inset-top))" }}
      >
        <PageThemeToggle />
      </div>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <section className="w-full max-w-[420px] rounded-[18px] bg-white px-7 py-8 shadow-2xl dark:bg-slate-900 sm:px-8 sm:py-9">
          <div className="mb-6 flex justify-center">
            <img
              src={LOGO_URL}
              alt={BRAND_NAME}
              className="h-14 w-auto max-w-[225px] object-contain"
              loading="eager"
              decoding="async"
            />
          </div>

          {validating ? (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-slate-500 dark:text-slate-300">Validando link…</p>
            </div>
          ) : done ? (
            <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
              <div className="rounded-full bg-emerald-100 p-3 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                Senha redefinida com sucesso
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-300">
                Estamos te redirecionando para o login…
              </p>
              <Link
                to="/login"
                className="mt-2 text-sm font-semibold text-primary hover:underline"
              >
                Ir para o login agora
              </Link>
            </div>
          ) : validation?.valid === false ? (
            <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
              <div className="rounded-full bg-rose-100 p-3 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">
                <ShieldAlert className="h-7 w-7" />
              </div>
              <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                Link inválido ou expirado
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-300">
                {validation.message ||
                  "Solicite um novo e-mail de redefinição na tela de login."}
              </p>
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => navigate("/login")}
                >
                  Voltar ao login
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="text-center">
                <h1 className="flex items-center justify-center gap-2 text-lg font-semibold text-slate-800 dark:text-slate-100">
                  <KeyRound className="h-5 w-5 text-primary" />
                  Definir nova senha
                </h1>
                {validation?.valid ? (
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                    {validation.firstName ? `Olá, ${validation.firstName}! ` : ""}
                    Conta: <span className="font-medium">{validation.email}</span>
                  </p>
                ) : null}
              </div>

              <div className="group relative pt-2">
                <Label
                  htmlFor="reset-password"
                  className="absolute left-4 top-0 z-10 bg-white px-1 text-[11px] font-medium text-slate-500 group-hover:text-primary group-focus-within:text-primary dark:bg-slate-900 dark:text-slate-300"
                >
                  Nova senha *
                </Label>
                <div className="relative">
                  <Input
                    id="reset-password"
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="h-12 rounded-full border-slate-200 bg-white px-4 pr-12 text-sm text-slate-900 shadow-none hover:border-primary focus-visible:border-primary focus-visible:ring-0 focus-visible:ring-offset-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:h-[40px] sm:pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-700 focus:outline-none dark:text-slate-300 dark:hover:text-white"
                    tabIndex={-1}
                    aria-label={showPwd ? "Ocultar senha" : "Exibir senha"}
                  >
                    {showPwd ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <PasswordStrength value={password} />
              </div>

              <div className="group relative pt-2">
                <Label
                  htmlFor="reset-confirm"
                  className="absolute left-4 top-0 z-10 bg-white px-1 text-[11px] font-medium text-slate-500 group-hover:text-primary group-focus-within:text-primary dark:bg-slate-900 dark:text-slate-300"
                >
                  Confirmar senha *
                </Label>
                <div className="relative">
                  <Input
                    id="reset-confirm"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    disabled={submitting}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="h-12 rounded-full border-slate-200 bg-white px-4 pr-12 text-sm text-slate-900 shadow-none hover:border-primary focus-visible:border-primary focus-visible:ring-0 focus-visible:ring-offset-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:h-[40px] sm:pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-700 focus:outline-none dark:text-slate-300 dark:hover:text-white"
                    tabIndex={-1}
                    aria-label={showConfirm ? "Ocultar senha" : "Exibir senha"}
                  >
                    {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {confirmPwd.length > 0 && !passwordsMatch ? (
                  <p className="mt-1 text-[11px] text-rose-500">As senhas não coincidem.</p>
                ) : null}
              </div>

              <Button
                type="submit"
                className="h-12 w-full rounded-full text-sm font-semibold shadow-none sm:h-[36px]"
                disabled={!canSubmit}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Redefinir senha"
                )}
              </Button>

              <button
                type="button"
                onClick={() => navigate("/login")}
                className="block w-full text-center text-sm font-semibold text-primary transition-colors hover:underline"
              >
                Voltar para o login
              </button>
            </form>
          )}
        </section>
      </main>

      <footer className="relative z-10 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-[11px] text-white/65">
        <p>
          © {currentYear} {BRAND_NAME}. Todos os direitos reservados.
        </p>
      </footer>

      <a
        href={SUPPORT_WHATSAPP_URL}
        target="_blank"
        rel="noreferrer"
        className="fixed right-4 z-20 flex items-end gap-2 sm:right-5"
        style={{ bottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        aria-label="Abrir suporte no WhatsApp"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] shadow-xl transition-transform hover:scale-105 sm:h-10 sm:w-10">
          <img
            src="/integrations/whatsapp.svg"
            alt=""
            className="h-7 w-7 object-contain brightness-0 invert sm:h-6 sm:w-6"
            loading="lazy"
          />
        </span>
      </a>
    </div>
  );
}
