/**
 * Retorna o segmento da empresa do usuário logado (ex.: 'comercio', 'oficina-mecanica', 'assistencia-tecnica').
 * Usado para esconder ou adaptar funcionalidades por segmento (ex.: Comércio não vê Ajustes OS, Alertas Operacional, etc.).
 */
import { useQuery } from '@tanstack/react-query';
import { getApiUrl } from '@/utils/apiUrl';

export function useCompanySegment() {
  const apiUrl = getApiUrl();
  const { data, isLoading } = useQuery({
    queryKey: ['segment-menu'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${apiUrl}/me/segment-menu`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return { segmento_slug: null as string | null, segmento_id: null as string | null };
      const json = await res.json();
      return { segmento_slug: json.segmento_slug ?? null, segmento_id: json.segmento_id ?? null };
    },
    staleTime: 1000 * 60 * 5, // 5 min
  });
  return {
    segmentoSlug: data?.segmento_slug ?? null,
    segmentoId: data?.segmento_id ?? null,
    isLoading: !!isLoading,
  };
}
