/** Formatação compartilhada para métricas de ads (Google micros, Meta em reais). */

export function formatCost(micros: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(micros / 1_000_000);
}

export function formatSpend(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(n);
}

export function formatPercent(value: number | null | undefined, fractionDigits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(fractionDigits).replace(".", ",")}%`;
}
