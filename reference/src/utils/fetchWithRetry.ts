/**
 * Fetch que repete a requisição em caso de 429 (Too Many Requests),
 * com backoff exponencial para não agravar o rate limit.
 */

const MAX_RETRIES = 5;
const INITIAL_DELAY_MS = 3000;
const MAX_DELAY_MS = 45000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Lê o header Retry-After (segundos) ou usa backoff exponencial.
 */
function getRetryDelayMs(response: Response, attempt: number): number {
  const retryAfter = response.headers.get('Retry-After');
  if (retryAfter) {
    const sec = parseInt(retryAfter, 10);
    if (!isNaN(sec)) return Math.min(sec * 1000, MAX_DELAY_MS);
  }
  const exponential = INITIAL_DELAY_MS * Math.pow(2, attempt);
  return Math.min(exponential, MAX_DELAY_MS);
}

export type FetchWithRetryOptions = RequestInit & {
  /** Máximo de tentativas em caso de 429 (padrão 3). */
  maxRetries?: number;
};

/**
 * fetch() que, em caso de 429, aguarda e tenta novamente (com backoff).
 * Evita que a aplicação quebre e que novas requisições piorem o bloqueio.
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: FetchWithRetryOptions
): Promise<Response> {
  const maxRetries = init?.maxRetries ?? MAX_RETRIES;
  const { maxRetries: _mr, ...fetchInit } = init || {};

  let lastResponse: Response | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(input, fetchInit);
    lastResponse = response;

    if (response.status !== 429 || attempt === maxRetries) {
      return response;
    }

    const delayMs = getRetryDelayMs(response, attempt);
    if (typeof console !== 'undefined' && import.meta.env?.DEV) {
      console.warn(
        `[fetchWithRetry] 429 recebido, tentativa ${attempt + 1}/${maxRetries + 1}. Aguardando ${delayMs}ms antes de repetir.`
      );
    }
    await delay(delayMs);
  }

  return lastResponse!;
}
