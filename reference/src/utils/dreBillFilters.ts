/**
 * Compra de mercadoria para estoque não é despesa do resultado no DRE:
 * o custo entra no CMV na venda. Contas geradas em Pedidos usam esse prefixo.
 */
const ENTRADA_ESTOQUE_PREFIX = 'entrada de estoque';

export function isBillExcludedFromDRE(description: string | null | undefined): boolean {
  const d = String(description ?? '').trim().toLowerCase();
  return d.startsWith(ENTRADA_ESTOQUE_PREFIX);
}
