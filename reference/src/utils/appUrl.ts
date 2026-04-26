/**
 * URL pública do app (sistema). Usada em QR codes de cupom e OS.
 * Em produção: app.ativafix.com (LP/vendas ficam em ativafix.com).
 */
export const APP_PUBLIC_URL = import.meta.env.VITE_APP_URL || 'https://app.ativafix.com';
