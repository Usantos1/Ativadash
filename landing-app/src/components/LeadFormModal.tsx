import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Loader2,
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  X,
} from "lucide-react";
import { LeadSubmitError, submitLead, type LeadAdsBudget, type LeadProfile } from "@/lib/api";
import { readTracking } from "@/lib/utm";
import { useLeadModal } from "./LeadModalContext";

const TOTAL_STEPS = 3;

type FormState = {
  fullName: string;
  email: string;
  whatsapp: string;
  profile: LeadProfile | "";
  monthlyAdsBudget: LeadAdsBudget | "";
  managedAccountsCount: string;
  monthlyRevenueBrl: string;
  goal: string;
  /** Honeypot anti-bot — não-tabulável, oculto. */
  company_website: string;
};

const initial: FormState = {
  fullName: "",
  email: "",
  whatsapp: "",
  profile: "",
  monthlyAdsBudget: "",
  managedAccountsCount: "",
  monthlyRevenueBrl: "",
  goal: "",
  company_website: "",
};

const PROFILE_OPTIONS: Array<{ value: LeadProfile; label: string; hint: string; icon: React.ComponentType<{ className?: string }> }> = [
  { value: "AGENCY", label: "Agência", hint: "Atendo clientes finais", icon: Users },
  { value: "CLIENT", label: "Cliente final", hint: "Tenho meu negócio", icon: Building2 },
  { value: "FREELANCER", label: "Profissional autônomo", hint: "Trabalho solo", icon: User },
];

const BUDGET_OPTIONS: Array<{ value: LeadAdsBudget; label: string; hint: string }> = [
  { value: "UNDER_5K", label: "Até R$ 5 mil", hint: "Começando ou enxuto" },
  { value: "FROM_5K_TO_25K", label: "R$ 5k–25k", hint: "Operação consolidada" },
  { value: "FROM_25K_TO_100K", label: "R$ 25k–100k", hint: "Estrutura média" },
  { value: "OVER_100K", label: "R$ 100k+", hint: "Grande operação" },
];

const REVENUE_OPTIONS = [
  { value: "30000", label: "Até R$ 30 mil" },
  { value: "100000", label: "R$ 30k–100k" },
  { value: "500000", label: "R$ 100k–500k" },
  { value: "2000000", label: "R$ 500k–2M" },
  { value: "10000000", label: "R$ 2M+" },
];

function maskWhatsapp(input: string): string {
  const d = input.replace(/\D+/g, "").slice(0, 13);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

export function LeadFormModal() {
  const { isOpen, close } = useLeadModal();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const tracking = useMemo(() => readTracking(), []);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  // Lock scroll + autofoco no primeiro campo
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => firstFieldRef.current?.focus(), 30);
    return () => {
      document.body.style.overflow = prev;
      clearTimeout(t);
    };
  }, [isOpen]);

  // Reset ao abrir
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSubmitError(null);
      // mantém o `done` se foi sucesso recente
      if (!done) {
        setState(initial);
        setErrors({});
      }
    }
  }, [isOpen, done]);

  const handleEsc = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape" && !submitting) close();
    },
    [close, submitting]
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((s) => ({ ...s, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  }

  function validateStep(target: number): boolean {
    const e: Record<string, string> = {};
    if (target >= 1) {
      if (state.fullName.trim().length < 2) e.fullName = "Informe seu nome";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email.trim())) e.email = "E-mail inválido";
      const wd = state.whatsapp.replace(/\D+/g, "");
      if (wd.length < 10) e.whatsapp = "WhatsApp inválido";
    }
    if (target >= 2) {
      if (!state.profile) e.profile = "Escolha uma opção";
      if (!state.monthlyAdsBudget) e.monthlyAdsBudget = "Escolha uma faixa";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function nextStep() {
    if (step === 1 && !validateStep(1)) return;
    if (step === 2 && !validateStep(2)) return;
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }

  function prevStep() {
    setStep((s) => Math.max(1, s - 1));
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (submitting) return;
    setSubmitError(null);
    if (!validateStep(2)) {
      setStep(state.fullName && state.email && state.whatsapp.replace(/\D+/g, "").length >= 10 ? 2 : 1);
      return;
    }
    setSubmitting(true);
    try {
      await submitLead({
        fullName: state.fullName.trim(),
        email: state.email.trim(),
        whatsapp: state.whatsapp.replace(/\D+/g, ""),
        profile: (state.profile || "UNKNOWN") as LeadProfile,
        monthlyAdsBudget: (state.monthlyAdsBudget || "UNKNOWN") as LeadAdsBudget,
        managedAccountsCount:
          state.profile === "AGENCY" && state.managedAccountsCount
            ? Number(state.managedAccountsCount)
            : null,
        monthlyRevenueBrl:
          state.profile !== "AGENCY" && state.monthlyRevenueBrl
            ? Number(state.monthlyRevenueBrl)
            : null,
        goal: state.goal.trim() || null,
        company_website: state.company_website,
        utmSource: tracking.utmSource,
        utmMedium: tracking.utmMedium,
        utmCampaign: tracking.utmCampaign,
        utmTerm: tracking.utmTerm,
        utmContent: tracking.utmContent,
        referrer: tracking.referrer,
        pageUrl: tracking.pageUrl,
      });
      setDone(true);
    } catch (err) {
      if (err instanceof LeadSubmitError) {
        setSubmitError(err.message);
        if (err.fieldErrors) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(err.fieldErrors)) {
            if (Array.isArray(v) && v.length) mapped[k] = String(v[0]);
          }
          setErrors(mapped);
        }
      } else {
        setSubmitError("Erro inesperado. Tente novamente em instantes.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function startOver() {
    setDone(false);
    setState(initial);
    setErrors({});
    setStep(1);
  }

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="leadFormTitle"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6"
      onKeyDown={handleEsc}
      ref={containerRef}
    >
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 cursor-default bg-slate-900/60 backdrop-blur-sm"
        onClick={() => !submitting && close()}
      />

      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-glow ring-1 ring-slate-200 animate-fade-up">
        <button
          type="button"
          aria-label="Fechar"
          onClick={() => !submitting && close()}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="h-5 w-5" />
        </button>

        {done ? (
          <SuccessPanel onClose={close} onAgain={startOver} />
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <header className="border-b border-slate-200 px-6 pb-4 pt-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-brand-700">
                <Sparkles className="h-4 w-4" />
                Solicitar acesso
              </div>
              <h2 id="leadFormTitle" className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                {step === 1 && "Como podemos te chamar?"}
                {step === 2 && "Conta um pouco do seu cenário"}
                {step === 3 && "O que você quer melhorar?"}
              </h2>
              <Stepper current={step} total={TOTAL_STEPS} />
            </header>

            <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
              {step === 1 ? (
                <StepContact state={state} errors={errors} update={update} firstFieldRef={firstFieldRef} />
              ) : null}
              {step === 2 ? <StepQualify state={state} errors={errors} update={update} /> : null}
              {step === 3 ? <StepGoal state={state} update={update} submitError={submitError} /> : null}

              {/* Honeypot */}
              <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
                <label htmlFor="company_website">Não preencha</label>
                <input
                  id="company_website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={state.company_website}
                  onChange={(e) => update("company_website", e.target.value)}
                />
              </div>
            </div>

            <footer className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/50 px-6 py-4">
              <div>
                {step > 1 ? (
                  <button type="button" className="btn-ghost" onClick={prevStep} disabled={submitting}>
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </button>
                ) : (
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <ShieldCheck className="h-3.5 w-3.5 text-brand-700" />
                    Seus dados ficam protegidos
                  </p>
                )}
              </div>

              {step < TOTAL_STEPS ? (
                <button type="button" className="btn-primary" onClick={nextStep}>
                  Próximo
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      Enviar
                      <Send className="h-4 w-4" />
                    </>
                  )}
                </button>
              )}
            </footer>
          </form>
        )}
      </div>
    </div>
  );
}

/* ----------------------- Stepper ----------------------- */

function Stepper({ current, total }: { current: number; total: number }) {
  return (
    <div className="mt-4 flex items-center gap-2" aria-label={`Etapa ${current} de ${total}`}>
      {Array.from({ length: total }).map((_, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "active" : "pending";
        return (
          <span
            key={n}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              state === "done"
                ? "bg-brand-700"
                : state === "active"
                  ? "bg-brand-500"
                  : "bg-slate-200"
            }`}
          />
        );
      })}
    </div>
  );
}

/* ----------------------- Step 1 ----------------------- */

function StepContact({
  state,
  errors,
  update,
  firstFieldRef,
}: {
  state: FormState;
  errors: Record<string, string>;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  firstFieldRef: React.RefObject<HTMLInputElement>;
}) {
  return (
    <div className="space-y-4">
      <Field
        id="fullName"
        label="Nome *"
        value={state.fullName}
        onChange={(v) => update("fullName", v)}
        error={errors.fullName}
        autoComplete="name"
        placeholder="Seu nome"
        inputRef={firstFieldRef}
      />
      <Field
        id="email"
        type="email"
        label="E-mail *"
        value={state.email}
        onChange={(v) => update("email", v)}
        error={errors.email}
        autoComplete="email"
        placeholder="seu@email.com"
      />
      <Field
        id="whatsapp"
        label="WhatsApp *"
        value={state.whatsapp}
        onChange={(v) => update("whatsapp", maskWhatsapp(v))}
        error={errors.whatsapp}
        autoComplete="tel"
        placeholder="(11) 90000-0000"
        inputMode="tel"
      />
      <p className="flex items-center gap-2 text-xs text-slate-500">
        <MessageCircle className="h-3.5 w-3.5" />
        Vamos falar com você primeiro pelo WhatsApp.
      </p>
    </div>
  );
}

/* ----------------------- Step 2 ----------------------- */

function StepQualify({
  state,
  errors,
  update,
}: {
  state: FormState;
  errors: Record<string, string>;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="field-label">Você é</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {PROFILE_OPTIONS.map(({ value, label, hint, icon: Icon }) => {
            const active = state.profile === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => update("profile", value)}
                aria-pressed={active}
                className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors ${
                  active
                    ? "border-brand-500 bg-brand-50/80 ring-1 ring-brand-300"
                    : "border-slate-300 bg-white hover:border-brand-400 hover:bg-brand-50/30"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-brand-700" : "text-slate-500"}`} />
                <span className="text-sm font-semibold text-slate-900">{label}</span>
                <span className="text-xs text-slate-500">{hint}</span>
              </button>
            );
          })}
        </div>
        {errors.profile ? <p className="mt-1 text-xs font-medium text-rose-600">{errors.profile}</p> : null}
      </fieldset>

      <fieldset>
        <legend className="field-label">Investimento mensal em ADS *</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {BUDGET_OPTIONS.map(({ value, label, hint }) => {
            const active = state.monthlyAdsBudget === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => update("monthlyAdsBudget", value)}
                aria-pressed={active}
                className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors ${
                  active
                    ? "border-brand-500 bg-brand-50/80 ring-1 ring-brand-300"
                    : "border-slate-300 bg-white hover:border-brand-400 hover:bg-brand-50/30"
                }`}
              >
                <span>
                  <span className="block text-sm font-semibold text-slate-900">{label}</span>
                  <span className="block text-xs text-slate-500">{hint}</span>
                </span>
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    active ? "border-brand-700 bg-brand-700 text-white" : "border-slate-300"
                  }`}
                >
                  {active ? <CheckCircle2 className="h-3 w-3" /> : null}
                </span>
              </button>
            );
          })}
        </div>
        {errors.monthlyAdsBudget ? (
          <p className="mt-1 text-xs font-medium text-rose-600">{errors.monthlyAdsBudget}</p>
        ) : null}
      </fieldset>

      {/* Campo condicional ao perfil — sem perguntar coisa sem sentido */}
      {state.profile === "AGENCY" ? (
        <Field
          id="managedAccountsCount"
          label="Quantas contas você gerencia hoje?"
          value={state.managedAccountsCount}
          onChange={(v) => update("managedAccountsCount", v.replace(/[^\d]/g, ""))}
          inputMode="numeric"
          placeholder="Ex.: 12"
        />
      ) : state.profile === "CLIENT" || state.profile === "FREELANCER" ? (
        <SelectField
          id="monthlyRevenueBrl"
          label="Faturamento mensal aproximado"
          value={state.monthlyRevenueBrl}
          onChange={(v) => update("monthlyRevenueBrl", v)}
          options={[{ value: "", label: "Selecione (opcional)..." }, ...REVENUE_OPTIONS]}
        />
      ) : null}
    </div>
  );
}

/* ----------------------- Step 3 ----------------------- */

function StepGoal({
  state,
  update,
  submitError,
}: {
  state: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  submitError: string | null;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="goal" className="field-label">
          O que você quer organizar/melhorar com o Ativa Dash?
        </label>
        <textarea
          id="goal"
          rows={4}
          value={state.goal}
          maxLength={1500}
          onChange={(e) => update("goal", e.target.value)}
          className="field"
          placeholder="Ex.: cruzar receita do Hotmart com investimento, ter painel por cliente, alertas de meta no WhatsApp..."
        />
        <p className="mt-1 text-xs text-slate-400">{state.goal.length}/1500 — opcional</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <p className="font-semibold text-slate-900">Resumo do contato</p>
        <ul className="mt-2 space-y-0.5 text-slate-600">
          <li>
            <strong className="text-slate-700">Nome:</strong> {state.fullName || "—"}
          </li>
          <li>
            <strong className="text-slate-700">E-mail:</strong> {state.email || "—"}
          </li>
          <li>
            <strong className="text-slate-700">WhatsApp:</strong> {state.whatsapp || "—"}
          </li>
          <li>
            <strong className="text-slate-700">Perfil:</strong>{" "}
            {state.profile === "AGENCY"
              ? "Agência"
              : state.profile === "CLIENT"
                ? "Cliente final"
                : state.profile === "FREELANCER"
                  ? "Profissional autônomo"
                  : "—"}
          </li>
        </ul>
      </div>

      {submitError ? (
        <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {submitError}
        </div>
      ) : null}
    </div>
  );
}

/* ----------------------- Field primitives ----------------------- */

type FieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  error?: string;
  inputMode?: "text" | "numeric" | "tel" | "email" | "url" | "search" | "decimal" | "none";
  inputRef?: React.RefObject<HTMLInputElement>;
};

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  error,
  inputMode,
  inputRef,
}: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        ref={inputRef}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        className={`field ${error ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200" : ""}`}
      />
      {error ? <p className="mt-1 text-xs font-medium text-rose-600">{error}</p> : null}
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ----------------------- Sucesso ----------------------- */

function SuccessPanel({ onClose, onAgain }: { onClose: () => void; onAgain: () => void }) {
  return (
    <div className="px-6 py-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <h3 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Solicitação recebida!</h3>
      <p className="mt-2 text-sm text-slate-600">
        Em até 1 dia útil nosso time fala com você pelo WhatsApp pra entender o caso e abrir o painel.
      </p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <button type="button" className="btn-primary" onClick={onClose}>
          Fechar
        </button>
        <button type="button" className="btn-outline" onClick={onAgain}>
          Enviar outra solicitação
        </button>
      </div>
    </div>
  );
}
