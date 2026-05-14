import { CheckCircle2, Plug2 } from "lucide-react";

/**
 * Mockup do hub /marketing/integracoes — cards das integrações com status
 * conectado/disponível e métricas de saúde de cada canal.
 */
export function IntegrationsMockup() {
  return (
    <div className="grid grid-cols-12 gap-3 p-4">
      <div className="col-span-12 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-900">Hub de integrações</p>
          <p className="text-xs text-slate-500">Conecte seus canais em 2 cliques (OAuth) — sem TI</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
          <Plug2 className="h-3 w-3" /> 4 conectadas
        </span>
      </div>

      <Card name="Meta Ads" desc="Campanhas, ad sets, criativos, métricas e regras." accent="text-[#1877f2]" connected />
      <Card name="Google Ads" desc="Inclui MCC. Filhos auto-detectados, métricas e GAQL." accent="text-[#fbbc04]" connected />
      <Card name="WhatsApp" desc="Notificações, alertas e CRM próprio (Ativa CRM)." accent="text-[#25d366]" connected />
      <Card name="Hotmart" desc="Receita real cruzada com investimento por campanha." accent="text-[#ef4a23]" connected />
      <Card name="Webhooks" desc="Eventos custom de checkout, CRM, BI." accent="text-slate-600" />
      <Card name="GA4" desc="Eventos do site para enriquecer captação." accent="text-amber-700" />
    </div>
  );
}

function Card({
  name,
  desc,
  accent,
  connected = false,
}: {
  name: string;
  desc: string;
  accent: string;
  connected?: boolean;
}) {
  return (
    <div className="col-span-12 rounded-xl border border-slate-200 p-3 sm:col-span-6 lg:col-span-4">
      <div className="flex items-center justify-between">
        <span className={`text-sm font-bold ${accent}`}>{name}</span>
        {connected ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            <CheckCircle2 className="h-3 w-3" /> Conectado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600">
            Disponível
          </span>
        )}
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600">{desc}</p>
    </div>
  );
}
