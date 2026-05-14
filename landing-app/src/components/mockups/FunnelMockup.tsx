/**
 * Mockup do Funil unificado (Captação → Conversão → Receita) — espelha a página
 * /marketing/captacao + /conversao + /receita do app.
 */
export function FunnelMockup() {
  return (
    <div className="grid grid-cols-12 gap-3 p-4">
      <div className="col-span-12 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-900">Funil unificado · últimos 30 dias</p>
          <p className="text-xs text-slate-500">Meta + Google Ads + Hotmart cruzados</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Pill color="bg-blue-500" label="Meta" />
          <Pill color="bg-amber-500" label="Google" />
          <Pill color="bg-rose-500" label="Hotmart" />
        </div>
      </div>

      {/* Captação */}
      <Stage
        label="Captação"
        title="Impressões"
        value="2.412.300"
        delta="+18,4%"
        pct={100}
        color="from-brand-200 to-brand-400"
      />
      <Stage
        label="Conversão"
        title="Cliques → Leads"
        value="2.184 leads"
        delta="+22,7%"
        pct={64}
        color="from-brand-400 to-brand-600"
      />
      <Stage
        label="Receita"
        title="Vendas"
        value="R$ 612.840"
        delta="+31,2%"
        pct={28}
        color="from-brand-600 to-brand-800"
      />

      {/* Detalhe da etapa */}
      <div className="col-span-12 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-700">Detalhe da etapa Conversão</p>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            Taxa cliques→leads 4,46%
          </span>
        </div>
        <div className="mt-2 grid grid-cols-12 gap-1.5 text-[11px]">
          {[
            { label: "Meta — campanha BR-CPL-Lookalike", v: 932, w: 100 },
            { label: "Google — campanha Search Brand", v: 614, w: 66 },
            { label: "Meta — campanha Retarget 30d", v: 412, w: 44 },
            { label: "Google — campanha YT Awareness", v: 226, w: 24 },
          ].map((row) => (
            <div key={row.label} className="col-span-12 flex items-center gap-2">
              <span className="w-56 shrink-0 truncate text-slate-600">{row.label}</span>
              <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200/60">
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-500 to-brand-700"
                  style={{ width: `${row.w}%` }}
                />
              </span>
              <span className="w-12 shrink-0 text-right font-semibold text-slate-800">{row.v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stage({
  label,
  title,
  value,
  delta,
  pct,
  color,
}: {
  label: string;
  title: string;
  value: string;
  delta: string;
  pct: number;
  color: string;
}) {
  return (
    <div className="col-span-12 rounded-xl border border-slate-200 p-3 sm:col-span-4">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
          {label}
        </span>
        <span className="text-[10px] font-semibold text-emerald-600">{delta}</span>
      </div>
      <p className="mt-1.5 text-[10px] uppercase tracking-wide text-slate-500">{title}</p>
      <p className="text-base font-bold text-slate-900">{value}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full bg-gradient-to-r ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Pill({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600">
      <span className={`h-2 w-2 rounded-full ${color}`} aria-hidden /> {label}
    </span>
  );
}
