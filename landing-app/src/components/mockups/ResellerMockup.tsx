import { Building2, Eye, Layers, Search } from "lucide-react";

/**
 * Mockup do painel /revenda/contas — central matriz para agências gerenciarem
 * múltiplos clientes (workspaces) com status, plano e acessos.
 */
export function ResellerMockup() {
  const tenants = [
    { name: "Ecommerce X — Moda Fitness", kind: "Cliente", plan: "Growth", status: "ACTIVE", users: 4, integrations: 3 },
    { name: "Agência ParceiraY", kind: "Agência", plan: "Scale", status: "ACTIVE", users: 12, integrations: 9 },
    { name: "Estúdio Z — Cursos", kind: "Cliente", plan: "Starter", status: "PAUSED", users: 2, integrations: 1 },
    { name: "Loja W — Cosméticos", kind: "Cliente", plan: "Growth", status: "ACTIVE", users: 3, integrations: 2 },
  ];

  return (
    <div className="grid grid-cols-12 gap-3 p-4">
      <div className="col-span-12 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-900">Revenda · Contas filhas</p>
          <p className="text-xs text-slate-500">Visão da matriz da agência — multi-tenant isolado</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="relative">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="text"
              placeholder="Buscar cliente..."
              className="h-7 w-44 rounded-md border border-slate-200 bg-white pl-6 pr-2 text-[11px] focus:outline-none"
              readOnly
            />
          </span>
        </div>
      </div>

      {/* KPIs revenda */}
      <KpiPill label="Contas filhas" value="14" />
      <KpiPill label="Ativas" value="11" tone="emerald" />
      <KpiPill label="Pausadas" value="2" tone="amber" />
      <KpiPill label="Usuários" value="46" />

      {/* Tabela */}
      <div className="col-span-12 overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-[11px]">
          <thead className="bg-slate-50/80 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Conta</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Plano</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Usuários</th>
              <th className="px-3 py-2">Integrações</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.name} className="border-t border-slate-200">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-100 text-brand-700">
                      {t.kind === "Agência" ? <Layers className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                    </span>
                    <span className="font-medium text-slate-800">{t.name}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-slate-600">{t.kind}</td>
                <td className="px-3 py-2 text-slate-600">{t.plan}</td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      t.status === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${t.status === "ACTIVE" ? "bg-emerald-500" : "bg-amber-500"}`}
                    />
                    {t.status === "ACTIVE" ? "Ativa" : "Pausada"}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-600">{t.users}</td>
                <td className="px-3 py-2 text-slate-600">{t.integrations}</td>
                <td className="px-3 py-2 text-right">
                  <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                    <Eye className="h-3 w-3" /> Acessar
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiPill({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "emerald" | "amber";
}) {
  const tones: Record<typeof tone, string> = {
    default: "text-slate-900",
    emerald: "text-emerald-700",
    amber: "text-amber-700",
  };
  return (
    <div className="col-span-6 rounded-xl border border-slate-200 p-3 sm:col-span-3">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-xl font-bold ${tones[tone]}`}>{value}</p>
    </div>
  );
}
