/**
 * URL base da API.
 * - VITE_API_URL definido no .env → usa esse valor (ex.: API local em dev).
 * - Caso contrário → https://api.ativafix.com/api
 * Para testar Painel de Alertas no localhost, suba a API local e defina VITE_API_URL=http://localhost:3000/api
 */
export function getApiUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && String(envUrl).trim()) {
    const url = String(envUrl).trim().replace(/\/$/, '');
    return url.endsWith('/api') ? url : url + '/api';
  }
  return 'https://api.ativafix.com/api';
}
