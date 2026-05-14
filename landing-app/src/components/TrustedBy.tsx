/** Logos das integrações suportadas (texto-only, sem imagens externas). */
const INTEGRATIONS = [
  { name: "Meta Ads", color: "text-[#1877f2]" },
  { name: "Google Ads", color: "text-[#fbbc04]" },
  { name: "WhatsApp", color: "text-[#25d366]" },
  { name: "Hotmart", color: "text-[#ef4a23]" },
  { name: "Webhooks", color: "text-slate-600" },
  { name: "GA4", color: "text-amber-700" },
];

export function TrustedBy() {
  return (
    <section className="border-y border-slate-200/70 bg-white/60 backdrop-blur">
      <div className="container-page py-8">
        <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Conecta com o que você já usa
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
          {INTEGRATIONS.map((it) => (
            <span
              key={it.name}
              className={`text-base font-bold opacity-70 transition-opacity hover:opacity-100 ${it.color}`}
            >
              {it.name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
