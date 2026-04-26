import { getApiUrl } from '@/utils/apiUrl';
import { authAPI } from '@/integrations/auth/api-client';

/** Dispara agendamento de follow-up pós-venda na API (não bloqueia o PDV em caso de erro). */
export async function scheduleOsPosVendaFollowup(
  ordemServicoId: string,
  faturadoAt?: string
): Promise<void> {
  if (!ordemServicoId) return;
  const token = authAPI.getToken();
  if (!token) return;
  try {
    // Pequena pausa para o status entregue_faturada propagar no banco antes da API validar a OS
    await new Promise((r) => setTimeout(r, 600));
    await fetch(`${getApiUrl()}/os-pos-venda-followup/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ordem_servico_id: ordemServicoId,
        faturado_at: faturadoAt ?? new Date().toISOString(),
      }),
    });
  } catch {
    /* silencioso: feature opcional */
  }
}
