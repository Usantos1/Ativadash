import type { ChartDataPoint, MarketingKpi } from "@/types";

export const mockProjects = [
  { id: "1", name: "Projeto Principal", launchId: "L1", launchName: "Lançamento Q1 2025" },
  { id: "2", name: "Projeto Secundário", launchId: "L2", launchName: "Evergreen" },
];

export const mockPeriods = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "15d", label: "Últimos 15 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
];

export const mockKpis: MarketingKpi[] = [
  { id: "leads", label: "Leads reais", value: "2.847", trend: "up", trendValue: "+12%", source: "CRM / Webhook" },
  { id: "leads_qual", label: "Leads qualificados", value: "1.203", trend: "up", trendValue: "+8%", source: "Regras internas" },
  { id: "gasto", label: "Total gasto", value: "R$ 48.920", trend: "down", trendValue: "-3%", source: "Meta Ads API" },
  { id: "cpa_trafego", label: "CPA tráfego", value: "R$ 17,18", trend: "neutral", source: "Gasto / Leads" },
  { id: "vendas", label: "Vendas totais", value: "312", trend: "up", trendValue: "+15%", source: "Checkout" },
  { id: "faturamento", label: "Faturamento total", value: "R$ 187.240", trend: "up", trendValue: "+22%", source: "Plataforma pagamento" },
  { id: "ticket", label: "Ticket médio", value: "R$ 599,49", trend: "up", trendValue: "+5%", source: "Faturamento / Vendas" },
  { id: "roas", label: "ROAS", value: "3,83x", trend: "up", trendValue: "+0,4x", source: "Faturamento / Gasto" },
  { id: "conv_lead_venda", label: "Conversão lead → venda", value: "10,96%", trend: "up", trendValue: "+1,2 p.p.", source: "Vendas / Leads" },
  { id: "conv_pag_checkout", label: "Conversão página → checkout", value: "18,4%", trend: "neutral", source: "Checkout / Pageview" },
  { id: "conv_checkout_compra", label: "Conversão checkout → compra", value: "42,1%", trend: "up", trendValue: "+2 p.p.", source: "Compras / Checkouts" },
  { id: "tempo_resposta", label: "Tempo médio de resposta", value: "4m 32s", trend: "down", trendValue: "-18s", source: "WhatsApp" },
  { id: "custo_lead_qual", label: "Custo por lead qualificado", value: "R$ 40,66", trend: "down", trendValue: "-5%", source: "Gasto / Leads qualificados" },
  { id: "custo_venda", label: "Custo por venda", value: "R$ 156,79", trend: "down", trendValue: "-8%", source: "Gasto / Vendas" },
  { id: "meta", label: "Meta atingida", value: "78%", subValue: "Falta R$ 41.260 para meta", trend: "up", source: "Meta configurada" },
];

export const mockChartGastoLeadsCpa: ChartDataPoint[] = [
  { date: "01/03", gasto: 5200, leads: 280, cpa: 18.57 },
  { date: "02/03", gasto: 6100, leads: 310, cpa: 19.68 },
  { date: "03/03", gasto: 4800, leads: 265, cpa: 18.11 },
  { date: "04/03", gasto: 7200, leads: 385, cpa: 18.70 },
  { date: "05/03", gasto: 6500, leads: 342, cpa: 19.01 },
  { date: "06/03", gasto: 5800, leads: 298, cpa: 19.46 },
  { date: "07/03", gasto: 6900, leads: 355, cpa: 19.44 },
  { date: "08/03", gasto: 6200, leads: 318, cpa: 19.50 },
  { date: "09/03", gasto: 7100, leads: 368, cpa: 19.29 },
  { date: "10/03", gasto: 6600, leads: 340, cpa: 19.41 },
  { date: "11/03", gasto: 5900, leads: 302, cpa: 19.54 },
  { date: "12/03", gasto: 7300, leads: 378, cpa: 19.31 },
  { date: "13/03", gasto: 6800, leads: 352, cpa: 19.32 },
  { date: "14/03", gasto: 6400, leads: 328, cpa: 19.51 },
];

export const mockChartTemperatura = [
  { name: "Quentes", value: 1240, fill: "hsl(142, 71%, 45%)" },
  { name: "Frios", value: 1607, fill: "hsl(220, 9%, 46%)" },
];

export const mockChartPlataforma = [
  { name: "Meta Ads", gasto: 31200, receita: 118500, fill: "hsl(252, 56%, 42%)" },
  { name: "Google Ads", gasto: 17720, receita: 68740, fill: "hsl(220, 56%, 50%)" },
];

export const mockChartOrigem = [
  { name: "Facebook", leads: 892, vendas: 98 },
  { name: "Instagram", leads: 756, vendas: 87 },
  { name: "Google Search", leads: 445, vendas: 62 },
  { name: "Google Display", leads: 312, vendas: 35 },
  { name: "Outros", leads: 442, vendas: 30 },
];

export const mockVendasPorUtm = [
  { utm_source: "facebook", utm_campaign: "cold_q1", vendas: 45, faturamento: 26955 },
  { utm_source: "instagram", utm_campaign: "stories", vendas: 52, faturamento: 31188 },
  { utm_source: "google", utm_campaign: "brand", vendas: 38, faturamento: 22762 },
  { utm_source: "facebook", utm_campaign: "retargeting", vendas: 68, faturamento: 40764 },
  { utm_source: "instagram", utm_campaign: "reels", vendas: 41, faturamento: 24559 },
];

export const mockVendasPorScore = [
  { faixa: "Faixa A", leads: 34, vendas: 1, conversao: 2.94, faturamento: 2997 },
  { faixa: "Faixa B", leads: 791, vendas: 41, conversao: 5.18, faturamento: 122877 },
  { faixa: "Faixa C", leads: 1599, vendas: 35, conversao: 2.19, faturamento: 104895 },
  { faixa: "Faixa D", leads: 168, vendas: 1, conversao: 0.6, faturamento: 2997 },
];

export const mockVendasPorQualificacao = [
  { qualificacao: "Não qualificado", leads: 1068, vendas: 18, conversao: 1.69, faturamento: 53946 },
  { qualificacao: "Qualificado", leads: 1524, vendas: 60, conversao: 3.94, faturamento: 179820 },
];

export const mockVendasPorTemperatura = [
  { temperatura: "Quente", leads: 892, vendas: 52, conversao: 5.83, faturamento: 31188 },
  { temperatura: "Frio", leads: 1700, vendas: 26, conversao: 1.53, faturamento: 155778 },
];

export const mockVendasPorPesquisa = [
  { resposta: "Interesse alto", leads: 420, vendas: 38, conversao: 9.05, faturamento: 22770 },
  { resposta: "Interesse médio", leads: 680, vendas: 28, conversao: 4.12, faturamento: 16772 },
  { resposta: "Sem resposta", leads: 1492, vendas: 12, conversao: 0.8, faturamento: 7192 },
];

export const mockReceitaComposicao = [
  { tipo: "Produto principal", valor: 131068, percentual: 70 },
  { tipo: "Upsell", valor: 37448, percentual: 20 },
  { tipo: "Order bump", valor: 11234, percentual: 6 },
  { tipo: "Downsell", valor: 7490, percentual: 4 },
];

export const mockDetalhamentoFaturamento = [
  { label: "Ingressos", valor: 155065, percentual: 81.3 },
  { label: "Orderbumps ingresso", valor: 12400, percentual: 6.5 },
  { label: "Upsells ingresso", valor: 18620, percentual: 9.8 },
  { label: "Produto principal", valor: 131068, percentual: 68.7 },
  { label: "OrderBump", valor: 11234, percentual: 5.9 },
  { label: "Upsell", valor: 37448, percentual: 19.6 },
  { label: "Downsell", valor: 7490, percentual: 3.9 },
];

export const lastSyncLabel = "Última atualização: hoje às 14:32";
