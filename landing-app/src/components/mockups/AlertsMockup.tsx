import { AlertTriangle, BellRing, CheckCircle2, MessageCircle, Pause, Zap } from "lucide-react";

/**
 * Mockup da página /ads/metas-alertas — regras de alerta + automação + envio
 * via WhatsApp (Ativa CRM).
 */
export function AlertsMockup() {
  return (
    <div className="grid grid-cols-12 gap-3 p-4">
      <div className="col-span-12 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-900">Metas e alertas</p>
          <p className="text-xs text-slate-500">Regras ativas + ocorrências do dia</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
          <span className="h-1.5 w-1.5 animate-soft-pulse rounded-full bg-emerald-500" />
          Motor de automação ativo
        </span>
      </div>

      {/* Cards de regras */}
      <RuleCard
        icon={AlertTriangle}
        tone="amber"
        title="CPA Meta acima de R$ 80"
        scope="Conta: BR-Cliente-A · Janela 1h"
        action="Notificar no WhatsApp do gestor"
      />
      <RuleCard
        icon={Pause}
        tone="rose"
        title="Pausar campanhas sem entrega"
        scope="Google Ads · Sem impressões em 2h"
        action="Auto-pausar e avisar time"
      />
      <RuleCard
        icon={Zap}
        tone="emerald"
        title="ROAS abaixo de 2,0x"
        scope="Todas as contas · Diário"
        action="Notificar e sugerir redirect de verba"
      />

      {/* Timeline de ocorrências */}
      <div className="col-span-12 rounded-xl border border-slate-200 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-700">Ocorrências de hoje</p>
          <span className="text-[10px] text-slate-500">3 ações tomadas</span>
        </div>
        <ul className="mt-2 space-y-1.5">
          <Occurrence
            tone="rose"
            time="14:32"
            text="Campanha 'Search BR Brand' pausada — 0 impressões em 2h"
            icon={Pause}
          />
          <Occurrence
            tone="amber"
            time="13:08"
            text="Alerta enviado: CPA R$ 92,40 (limite R$ 80) — campanha Lookalike"
            icon={MessageCircle}
          />
          <Occurrence
            tone="emerald"
            time="11:21"
            text="Meta de leads diários atingida — campanha Retarget 30d"
            icon={CheckCircle2}
          />
        </ul>
      </div>

      {/* Preview WhatsApp */}
      <div className="col-span-12 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
        <div className="flex items-center gap-2">
          <BellRing className="h-4 w-4 text-emerald-700" />
          <p className="text-xs font-semibold text-emerald-900">Notificação enviada via WhatsApp</p>
        </div>
        <div className="mt-2 max-w-md rounded-2xl rounded-tl-none border border-emerald-200 bg-white p-3 text-xs text-slate-700 shadow-sm">
          <p className="font-semibold text-slate-900">[Ativa Dash] Alerta · Cliente A</p>
          <p className="mt-0.5">
            CPA passou de R$ 80 (atual: R$ 92,40) na <strong>Lookalike BR</strong>. Considere ajustar verba ou
            pausar.
          </p>
          <p className="mt-1 text-[10px] text-slate-400">Hoje 13:08</p>
        </div>
      </div>
    </div>
  );
}

function RuleCard({
  icon: Icon,
  tone,
  title,
  scope,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: "amber" | "rose" | "emerald";
  title: string;
  scope: string;
  action: string;
}) {
  const tones: Record<typeof tone, string> = {
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
    emerald: "bg-emerald-100 text-emerald-700",
  };
  return (
    <div className="col-span-12 flex items-start gap-3 rounded-xl border border-slate-200 p-3 sm:col-span-4">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-bold text-slate-900">{title}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">{scope}</p>
        <p className="mt-1 text-[11px] text-slate-700">{action}</p>
      </div>
    </div>
  );
}

function Occurrence({
  tone,
  time,
  text,
  icon: Icon,
}: {
  tone: "rose" | "amber" | "emerald";
  time: string;
  text: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const tones: Record<typeof tone, string> = {
    rose: "bg-rose-100 text-rose-700",
    amber: "bg-amber-100 text-amber-700",
    emerald: "bg-emerald-100 text-emerald-700",
  };
  return (
    <li className="flex items-center gap-2 text-[11px]">
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${tones[tone]}`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="w-12 shrink-0 font-mono text-slate-500">{time}</span>
      <span className="text-slate-700">{text}</span>
    </li>
  );
}
