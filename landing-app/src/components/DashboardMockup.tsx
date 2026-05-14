import { TrendingUp, MousePointerClick, DollarSign, Target } from "lucide-react";

/**
 * Mockup CSS/SVG do dashboard real (executivo de marketing). Sem imagem externa
 * para garantir LCP rápido e zero peso de assets. Usado dentro de <MockupFrame />.
 */
export function DashboardMockup() {
  return (
    <div className="grid grid-cols-12 gap-3 p-3">
        {/* KPI cards */}
        <KPICard icon={DollarSign} label="Investimento" value="R$ 187.4k" delta="+12,4%" tone="brand" />
        <KPICard icon={MousePointerClick} label="Cliques" value="48.962" delta="+8,1%" tone="sky" />
        <KPICard icon={Target} label="Leads" value="2.184" delta="+22,7%" tone="amber" />
        <KPICard icon={TrendingUp} label="Receita" value="R$ 612k" delta="+31,2%" tone="emerald" />

        {/* Chart card */}
        <div className="col-span-12 rounded-xl border border-slate-200 bg-white p-3 sm:col-span-8">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-700">Investimento × Receita · últimos 30 dias</p>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">ROAS 3,27x</span>
          </div>
          <ChartLines />
        </div>

        {/* Funnel card */}
        <div className="col-span-12 flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white p-3 sm:col-span-4">
          <p className="text-xs font-semibold text-slate-700">Funil unificado</p>
          <FunnelBar label="Impressões" pct={100} value="2.4M" />
          <FunnelBar label="Cliques" pct={64} value="49k" />
          <FunnelBar label="Leads" pct={28} value="2.1k" />
          <FunnelBar label="Vendas" pct={11} value="287" />
        </div>

        {/* Channels */}
        <div className="col-span-12 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-3">
          <ChannelRow color="bg-blue-500" name="Meta Ads" spend="R$ 96.2k" share="51%" />
          <ChannelRow color="bg-amber-500" name="Google Ads" spend="R$ 91.2k" share="49%" />
        </div>
    </div>
  );
}

function KPICard({
  icon: Icon,
  label,
  value,
  delta,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  delta: string;
  tone: "brand" | "sky" | "amber" | "emerald";
}) {
  const tones: Record<typeof tone, string> = {
    brand: "bg-brand-100 text-brand-700",
    sky: "bg-sky-100 text-sky-700",
    amber: "bg-amber-100 text-amber-700",
    emerald: "bg-emerald-100 text-emerald-700",
  };
  return (
    <div className="col-span-6 rounded-xl border border-slate-200 bg-white p-3 sm:col-span-3">
      <div className="flex items-center justify-between">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-[10px] font-semibold text-emerald-600">{delta}</span>
      </div>
      <p className="mt-2 text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-lg font-bold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

function FunnelBar({ label, pct, value }: { label: string; pct: number; value: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-16 shrink-0 text-slate-600">{label}</span>
      <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-500 to-brand-700"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="w-12 shrink-0 text-right font-semibold text-slate-700">{value}</span>
    </div>
  );
}

function ChannelRow({ color, name, spend, share }: { color: string; name: string; spend: string; share: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/60 px-2 py-1.5 text-[11px]">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${color}`} aria-hidden />
        <span className="font-medium text-slate-700">{name}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-slate-500">{share}</span>
        <span className="font-semibold text-slate-800">{spend}</span>
      </div>
    </div>
  );
}

function ChartLines() {
  return (
    <svg viewBox="0 0 320 90" className="mt-2 h-24 w-full" role="img" aria-label="Gráfico de investimento e receita">
      <defs>
        <linearGradient id="lpRev" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lpInv" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.30" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0,72 L20,68 L40,70 L60,60 L80,55 L100,58 L120,46 L140,50 L160,40 L180,42 L200,32 L220,36 L240,28 L260,30 L280,22 L300,24 L320,16 L320,90 L0,90 Z"
        fill="url(#lpRev)"
      />
      <path
        d="M0,72 L20,68 L40,70 L60,60 L80,55 L100,58 L120,46 L140,50 L160,40 L180,42 L200,32 L220,36 L240,28 L260,30 L280,22 L300,24 L320,16"
        fill="none"
        stroke="#10b981"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M0,80 L20,78 L40,76 L60,72 L80,68 L100,70 L120,64 L140,66 L160,60 L180,62 L200,56 L220,58 L240,52 L260,54 L280,48 L300,50 L320,44 L320,90 L0,90 Z"
        fill="url(#lpInv)"
      />
      <path
        d="M0,80 L20,78 L40,76 L60,72 L80,68 L100,70 L120,64 L140,66 L160,60 L180,62 L200,56 L220,58 L240,52 L260,54 L280,48 L300,50 L320,44"
        fill="none"
        stroke="#7c3aed"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
