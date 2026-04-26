/**
 * Utilitários para modo demonstração.
 * Quando o usuário está na conta demo, erros de criação/edição/exclusão
 * devem exibir mensagem amigável em vez do erro técnico.
 */

export const DEMO_SESSION_KEY = 'ativafix_demo_session';

export const DEMO_MESSAGE = 'Funcionalidade não disponível na conta demonstração. Cadastre-se para usar com seus dados.';

export function isDemoSession(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  try {
    return sessionStorage.getItem(DEMO_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Retorna a mensagem de erro a exibir: se estiver em demo, retorna a mensagem amigável;
 * caso contrário, retorna a mensagem do erro ou o fallback.
 */
export function getDemoAwareErrorMessage(error: unknown, fallback: string): string {
  if (isDemoSession()) return DEMO_MESSAGE;
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return fallback;
}
