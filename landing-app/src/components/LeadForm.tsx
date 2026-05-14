import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, Mail, MessageCircle, Send, ShieldCheck } from "lucide-react";
import { LeadSubmitError, submitLead, type LeadAdsBudget, type LeadProfile } from "@/lib/api";
import { readTracking } from "@/lib/utm";

type FormState = {
  fullName: string;
  email: string;
  whatsapp: string;
  companyName: string;
  websiteUrl: string;
  profile: LeadProfile | "";
  monthlyAdsBudget: LeadAdsBudget | "";
  monthlyRevenueBrl: string;
  managedAccountsCount: string;
  teamSize: string;
  primaryChannel: string;
  goal: string;
  /** Honeypot — fica oculto, bot tende a preencher. */
  company_website: string;
};

const PROFILE_OPTIONS: Array<{ value: LeadProfile; label: string; hint: string }> = [
  { value: "AGENCY", label: "Agência", hint: "Atendo clientes finais" },
  { value: "CLIENT", label: "Cliente final", hint: "Tenho meu próprio negócio" },
  { value: "FREELANCER", label: "Profissional autônomo", hint: "Trabalho solo" },
];

const BUDGET_OPTIONS: Array<{ value: LeadAdsBudget; label: string }> = [
  { value: "UNDER_5K", label: "Até R$ 5 mil/mês" },
  { value: "FROM_5K_TO_25K", label: "R$ 5 a 25 mil/mês" },
  { value: "FROM_25K_TO_100K", label: "R$ 25 a 100 mil/mês" },
  { value: "OVER_100K", label: "Acima de R$ 100 mil/mês" },
];

const CHANNEL_OPTIONS = [
  { value: "META", label: "Meta Ads (Facebook/Instagram)" },
  { value: "GOOGLE", label: "Google Ads" },
  { value: "BOTH", label: "Meta + Google" },
  { value: "OTHER", label: "Outro canal" },
  { value: "NONE", label: "Ainda não invisto em ADS" },
];

const initial: FormState = {
  fullName: "",
  email: "",
  whatsapp: "",
  companyName: "",
  websiteUrl: "",
  profile: "",
  monthlyAdsBudget: "",
  monthlyRevenueBrl: "",
  managedAccountsCount: "",
  teamSize: "",
  primaryChannel: "",
  goal: "",
  company_website: "",
};

function maskWhatsapp(input: string): string {
  const d = input.replace(/\D+/g, "").slice(0, 13);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

export function LeadForm() {
  const [state, setState] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const tracking = useMemo(() => readTracking(), []);

  useEffect(() => {
    if (done && typeof window !== "undefined") {
      // Sobe pro topo do form pra mostrar o sucesso
      const el = document.getElementById("contato");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [done]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((s) => ({ ...s, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (state.fullName.trim().length < 2) e.fullName = "Informe seu nome";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email.trim())) e.email = "E-mail inválido";
    const wd = state.whatsapp.replace(/\D+/g, "");
    if (wd.length < 10) e.whatsapp = "WhatsApp inválido";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (submitting) return;
    setSubmitError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      await submitLead({
        fullName: state.fullName.trim(),
        email: state.email.trim(),
        whatsapp: state.whatsapp.replace(/\D+/g, ""),
        companyName: state.companyName.trim() || null,
        websiteUrl: state.websiteUrl.trim() || null,
        profile: (state.profile || "UNKNOWN") as LeadProfile,
        monthlyAdsBudget: (state.monthlyAdsBudget || "UNKNOWN") as LeadAdsBudget,
        monthlyRevenueBrl: state.monthlyRevenueBrl ? Number(state.monthlyRevenueBrl) : null,
        managedAccountsCount: state.managedAccountsCount ? Number(state.managedAccountsCount) : null,
        teamSize: state.teamSize ? Number(state.teamSize) : null,
        primaryChannel: state.primaryChannel || null,
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
      setState(initial);
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

  if (done) {
    return (
      <SuccessPanel
        onAgain={() => {
          setDone(false);
          setSubmitError(null);
        }}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="fullName"
          label="Nome completo *"
          value={state.fullName}
          onChange={(v) => update("fullName", v)}
          error={errors.fullName}
          autoComplete="name"
          placeholder="Como devemos te chamar?"
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
        <Field
          id="companyName"
          label="Empresa / Agência"
          value={state.companyName}
          onChange={(v) => update("companyName", v)}
          autoComplete="organization"
          placeholder="Nome da empresa"
        />
        <Field
          id="websiteUrl"
          label="Site (opcional)"
          value={state.websiteUrl}
          onChange={(v) => update("websiteUrl", v)}
          placeholder="https://..."
        />
      </div>

      {/* Honeypot — visualmente escondido e não-tabulável */}
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

      <fieldset className="space-y-2">
        <legend className="field-label">Você é</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {PROFILE_OPTIONS.map((opt) => {
            const active = state.profile === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => update("profile", opt.value)}
                aria-pressed={active}
                className={`flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors ${
                  active
                    ? "border-brand-500 bg-brand-50/80 text-brand-900 ring-1 ring-brand-300"
                    : "border-slate-300 bg-white text-slate-700 hover:border-brand-400 hover:bg-brand-50/40"
                }`}
              >
                <span className="text-sm font-semibold">{opt.label}</span>
                <span className="text-xs text-slate-500">{opt.hint}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          id="monthlyAdsBudget"
          label="Investimento mensal em ADS"
          value={state.monthlyAdsBudget}
          onChange={(v) => update("monthlyAdsBudget", v as LeadAdsBudget | "")}
          options={[
            { value: "", label: "Selecione..." },
            ...BUDGET_OPTIONS.map((b) => ({ value: b.value, label: b.label })),
          ]}
        />
        <SelectField
          id="primaryChannel"
          label="Principal canal hoje"
          value={state.primaryChannel}
          onChange={(v) => update("primaryChannel", v)}
          options={[{ value: "", label: "Selecione..." }, ...CHANNEL_OPTIONS]}
        />
        <Field
          id="monthlyRevenueBrl"
          label="Faturamento mensal aprox. (R$)"
          value={state.monthlyRevenueBrl}
          onChange={(v) => update("monthlyRevenueBrl", v.replace(/[^\d]/g, ""))}
          placeholder="50000"
          inputMode="numeric"
        />
        {state.profile === "AGENCY" ? (
          <Field
            id="managedAccountsCount"
            label="Contas que você gerencia"
            value={state.managedAccountsCount}
            onChange={(v) => update("managedAccountsCount", v.replace(/[^\d]/g, ""))}
            placeholder="Ex.: 12"
            inputMode="numeric"
          />
        ) : (
          <Field
            id="teamSize"
            label="Tamanho do time de marketing"
            value={state.teamSize}
            onChange={(v) => update("teamSize", v.replace(/[^\d]/g, ""))}
            placeholder="Ex.: 3"
            inputMode="numeric"
          />
        )}
      </div>

      <div>
        <label htmlFor="goal" className="field-label">
          O que você quer organizar/melhorar com o Ativa Dash?
        </label>
        <textarea
          id="goal"
          rows={3}
          value={state.goal}
          onChange={(e) => update("goal", e.target.value)}
          maxLength={2000}
          className="field"
          placeholder="Ex.: cruzar receita do Hotmart com investimento em ADS, ter painel por cliente, alertas de meta..."
        />
      </div>

      {submitError ? (
        <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {submitError}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-brand-700" />
          Seus dados são tratados com base na nossa Política de Privacidade.
        </p>
        <button type="submit" disabled={submitting} className="btn-primary text-base">
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              Quero falar com o time
              <Send className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}

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
};

function Field({ id, label, value, onChange, type = "text", placeholder, autoComplete, error, inputMode }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        name={id}
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

function SuccessPanel({ onAgain }: { onAgain: () => void }) {
  return (
    <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="h-6 w-6" />
        </span>
        <div>
          <h3 className="text-lg font-bold">Solicitação recebida!</h3>
          <p className="text-sm text-emerald-800">
            Em breve nosso time entra em contato pelo WhatsApp ou e-mail informado.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:gap-4">
        <span className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          Vamos confirmar pelo WhatsApp
        </span>
        <span className="flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Você recebe os próximos passos por e-mail
        </span>
      </div>
      <button type="button" onClick={onAgain} className="btn-outline">
        Enviar outra solicitação
      </button>
    </div>
  );
}
