import { useState, useCallback } from 'react';
import { authAPI } from '@/integrations/auth/api-client';

// Usar mesma base da API que o restante do app (revenda); se VITE_API_URL estiver definido, usa ele (ex.: localhost)
const API_URL = import.meta.env.VITE_API_URL
  ? String(import.meta.env.VITE_API_URL).replace(/\/$/, '')
  : 'https://api.ativafix.com/api';
const API_BASE = `${API_URL}/admin/revenda`;

export interface Segmento {
  id: string;
  nome: string;
  slug: string;
  descricao?: string;
  icone?: string;
  cor?: string;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
  modulos_count?: number;
  recursos_count?: number;
}

export interface Modulo {
  id: string;
  nome: string;
  slug: string;
  descricao?: string;
  categoria?: string;
  icone?: string;
  path?: string;
  label_menu?: string;
  ativo: boolean;
  link_ativo?: boolean;
  ordem_menu?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Recurso {
  id: string;
  modulo_id: string;
  nome: string;
  slug: string;
  descricao?: string;
  tipo?: string;
  permission_key?: string;
  ativo: boolean;
  link_ativo?: boolean;
  modulo_nome?: string;
  modulo_slug?: string;
  created_at?: string;
  updated_at?: string;
}

function getHeaders(): HeadersInit {
  const token = authAPI.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  const data = await res.json();
  return (data as { data?: T; success?: boolean }).data ?? data;
}

export function useSegments() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listSegmentos = useCallback(async (): Promise<Segmento[]> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/segmentos`, { headers: getHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao listar segmentos');
      return Array.isArray(data.data) ? data.data : data.data?.data ?? [];
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const getSegmento = useCallback(async (id: string): Promise<Segmento | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/segmentos/${id}`, { headers: getHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Segmento não encontrado');
      return data.data ?? null;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const createSegmento = useCallback(async (payload: Partial<Segmento>): Promise<Segmento> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/segmentos`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar segmento');
      return data.data;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSegmento = useCallback(async (id: string, payload: Partial<Segmento>): Promise<Segmento> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/segmentos/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar segmento');
      return data.data;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const getSegmentoModulos = useCallback(async (segmentoId: string): Promise<Modulo[]> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/segmentos/${segmentoId}/modulos`, { headers: getHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar módulos');
      return Array.isArray(data.data) ? data.data : [];
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSegmentoModulos = useCallback(
    async (segmentoId: string, modulos: { modulo_id: string; ativo: boolean; ordem_menu?: number }[]): Promise<Modulo[]> => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/segmentos/${segmentoId}/modulos`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify({ modulos }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao atualizar módulos');
        return Array.isArray(data.data) ? data.data : [];
      } catch (e: any) {
        setError(e.message);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getSegmentoRecursos = useCallback(
    async (segmentoId: string): Promise<{ modulos: Modulo[]; recursos: Recurso[] }> => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/segmentos/${segmentoId}/recursos`, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao carregar recursos');
        return {
          modulos: Array.isArray(data.data?.modulos) ? data.data.modulos : [],
          recursos: Array.isArray(data.data?.recursos) ? data.data.recursos : [],
        };
      } catch (e: any) {
        setError(e.message);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const updateSegmentoRecursos = useCallback(
    async (segmentoId: string, recurso_ids: string[]): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/segmentos/${segmentoId}/recursos`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify({ recurso_ids }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao atualizar recursos');
      } catch (e: any) {
        setError(e.message);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getSegmentoMenuPreview = useCallback(async (segmentoId: string): Promise<Modulo[]> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/segmentos/${segmentoId}/menu-preview`, { headers: getHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar prévia');
      return Array.isArray(data.data) ? data.data : [];
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const listModulos = useCallback(async (): Promise<Modulo[]> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/modulos`, { headers: getHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao listar módulos');
      return Array.isArray(data.data) ? data.data : [];
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const getModulo = useCallback(async (id: string): Promise<Modulo | null> => {
    const res = await fetch(`${API_BASE}/modulos/${id}`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Módulo não encontrado');
    return data.data ?? null;
  }, []);

  const createModulo = useCallback(async (payload: Partial<Modulo>): Promise<Modulo> => {
    const res = await fetch(`${API_BASE}/modulos`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao criar módulo');
    return data.data;
  }, []);

  const updateModulo = useCallback(async (id: string, payload: Partial<Modulo>): Promise<Modulo> => {
    const res = await fetch(`${API_BASE}/modulos/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao atualizar módulo');
    return data.data;
  }, []);

  const listRecursos = useCallback(async (moduloId?: string): Promise<Recurso[]> => {
    const url = moduloId ? `${API_BASE}/recursos?modulo_id=${moduloId}` : `${API_BASE}/recursos`;
    const res = await fetch(url, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao listar recursos');
    return Array.isArray(data.data) ? data.data : [];
  }, []);

  const getRecurso = useCallback(async (id: string): Promise<Recurso | null> => {
    const res = await fetch(`${API_BASE}/recursos/${id}`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Recurso não encontrado');
    return data.data ?? null;
  }, []);

  const createRecurso = useCallback(async (payload: Partial<Recurso>): Promise<Recurso> => {
    const res = await fetch(`${API_BASE}/recursos`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao criar recurso');
    return data.data;
  }, []);

  const updateRecurso = useCallback(async (id: string, payload: Partial<Recurso>): Promise<Recurso> => {
    const res = await fetch(`${API_BASE}/recursos/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao atualizar recurso');
    return data.data;
  }, []);

  return {
    loading,
    error,
    listSegmentos,
    getSegmento,
    createSegmento,
    updateSegmento,
    getSegmentoModulos,
    updateSegmentoModulos,
    getSegmentoRecursos,
    updateSegmentoRecursos,
    getSegmentoMenuPreview,
    listModulos,
    getModulo,
    createModulo,
    updateModulo,
    listRecursos,
    getRecurso,
    createRecurso,
    updateRecurso,
  };
}
