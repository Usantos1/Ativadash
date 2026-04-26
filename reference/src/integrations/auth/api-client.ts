/**
 * Cliente de Autenticação - API REST.
 * Usa getApiUrl() para suportar ativafix.com com o mesmo build.
 */

import { getApiUrl } from '@/utils/apiUrl';

// Limpar qualquer token antigo de outros sistemas
const cleanOldTokens = () => {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes('sb-') || key.includes('supabase'))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });
};

// Executar limpeza ao carregar
cleanOldTokens();

interface User {
  id: string;
  email: string;
  role?: string;
  profile?: any;
  company_id?: string;
}

interface AuthResponse {
  data?: {
    user?: User;
    token?: string;
    session?: any;
  };
  error?: {
    message: string;
    code?: string;
  };
}

class AuthAPIClient {
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const token = localStorage.getItem('auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${getApiUrl()}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const rawText = await response.text();

      // 429 = Too Many Requests (rate limit) — servidor pode retornar texto em vez de JSON
      if (response.status === 429) {
        return {
          error: {
            message: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.',
          },
        };
      }

      let data: any = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        return {
          error: {
            message: response.ok ? 'Resposta inválida do servidor.' : (rawText || 'Erro ao fazer login'),
          },
        };
      }

      if (!response.ok) {
        return { error: { message: data.error || data.message || rawText || 'Erro ao fazer login' } };
      }

      // Salvar token e garantir que modo demo não fique ativo (banner só para quem entrou via /demo)
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
        try {
          sessionStorage.removeItem('ativafix_demo_session');
        } catch (_) {}
      }

      return { data: { user: data.user, token: data.token } };
    } catch (error: any) {
      console.error('[Auth] Erro no login:', error);
      return { error: { message: error.message || 'Erro de conexão' } };
    }
  }

  /** Login em modo demonstração (usa usuário configurado no servidor; sem enviar senha no client). */
  async loginDemo(): Promise<AuthResponse> {
    try {
      const response = await fetch(`${getApiUrl()}/auth/demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const rawText = await response.text();
      if (response.status === 429) {
        return {
          error: {
            message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
          },
        };
      }

      let data: any = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        return {
          error: {
            message: response.ok ? 'Resposta inválida do servidor.' : (rawText || 'Erro ao entrar na demonstração'),
          },
        };
      }

      if (!response.ok) {
        return {
          error: {
            message: data.error || 'Demonstração não disponível no momento.',
            code: data.code,
          },
        };
      }

      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }

      return { data: { user: data.user, token: data.token, profile: data.profile } };
    } catch (error: any) {
      console.error('[Auth] Erro no login demo:', error);
      return { error: { message: error.message || 'Erro de conexão' } };
    }
  }

  async signup(email: string, password: string, userData?: any): Promise<AuthResponse> {
    try {
      const response = await fetch(`${getApiUrl()}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, ...userData }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: { message: data.error || data.message || 'Erro ao criar conta' } };
      }

      return { data: { user: data.user } };
    } catch (error: any) {
      console.error('[Auth] Erro no signup:', error);
      return { error: { message: error.message || 'Erro de conexão' } };
    }
  }

  async logout(): Promise<void> {
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        await fetch(`${getApiUrl()}/auth/logout`, {
          method: 'POST',
          headers: this.getHeaders(),
        }).catch(() => {});
      }
    } finally {
      localStorage.removeItem('auth_token');
      cleanOldTokens();
    }
  }

  async getCurrentUser(): Promise<AuthResponse> {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        return { data: { user: undefined } };
      }

      const response = await fetch(`${getApiUrl()}/auth/me`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        // Só deslogar em 401 (token inválido/expirado). 429/5xx = erro temporário — não desconectar.
        if (response.status === 401) {
          localStorage.removeItem('auth_token');
          return { data: { user: undefined } };
        }
        if (response.status === 429) {
          return { error: { message: 'Muitas tentativas. Tente em instantes.', code: 'RATE_LIMIT' } };
        }
        if (response.status >= 500) {
          return { error: { message: 'Servidor temporariamente indisponível.', code: 'SERVER_ERROR' } };
        }
        return { data: { user: undefined } };
      }

      const data = await response.json();
      return { data: { user: data.user, profile: data.profile } };
    } catch (error: any) {
      console.error('[Auth] Erro ao obter usuário:', error);
      // Erro de rede: não limpar sessão (evita "desconectar" por falha temporária)
      return { error: { message: error.message || 'Erro de conexão', code: 'NETWORK_ERROR' } };
    }
  }

  async resetPassword(email: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${getApiUrl()}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: { message: data.error || data.message || 'Erro ao resetar senha' } };
      }

      return { data: {} };
    } catch (error: any) {
      console.error('[Auth] Erro no reset de senha:', error);
      return { error: { message: error.message || 'Erro de conexão' } };
    }
  }

  async updatePassword(newPassword: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${getApiUrl()}/auth/update-password`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ password: newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: { message: data.error || data.message || 'Erro ao atualizar senha' } };
      }

      return { data: {} };
    } catch (error: any) {
      console.error('[Auth] Erro ao atualizar senha:', error);
      return { error: { message: error.message || 'Erro de conexão' } };
    }
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('auth_token');
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  // Método de compatibilidade para código legado que usa getSession()
  async getSession(): Promise<{ data: { session: { access_token: string } | null }; error: any }> {
    const token = localStorage.getItem('auth_token');
    if (token) {
      return { 
        data: { 
          session: { 
            access_token: token 
          } 
        }, 
        error: null 
      };
    }
    return { data: { session: null }, error: null };
  }
}

export const authAPI = new AuthAPIClient();
export default authAPI;
