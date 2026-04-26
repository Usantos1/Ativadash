// ============================================
// HOOK PARA RELATÓRIOS DE VENDAS
// ============================================

import { useQuery } from '@tanstack/react-query';
import { from } from '@/integrations/db/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  technicianId?: string;
  saleOrigin?: 'PDV' | 'OS' | 'all';
  paymentMethod?: string; // 'dinheiro', 'pix', 'credito', etc. ou 'all'
}

export interface SalesSummary {
  totalPDV: number;
  totalOS: number;
  totalGeral: number;
  percentPDV: number;
  percentOS: number;
  countPDV: number;
  countOS: number;
  countGeral: number;
}

export interface TechnicianProductivity {
  technician_id: string;
  technician_nome: string;
  osCompleted: number;
  totalRevenue: number;
  serviceRevenue: number;
  productRevenue: number;
  averageTicket: number;
}

/**
 * Hook para resumo geral de vendas (PDV vs OS)
 * @param options.enabled - se false, a query não roda (útil para dashboard quando período não é "Dia")
 */
export function useSalesSummary(filters: ReportFilters = {}, options?: { enabled?: boolean }) {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  return useQuery({
    queryKey: ['sales-summary', filters],
    queryFn: async (): Promise<SalesSummary> => {
      const { startDate, endDate, saleOrigin, paymentMethod } = filters;

      // Construir query base
      let queryPDV: any = from('sales')
        .select('total, sale_origin, status', { count: 'exact' });

      let queryOS: any = from('sales')
        .select('total, sale_origin, status', { count: 'exact' });

      // Filtros de data
      if (startDate) {
        queryPDV = queryPDV.gte('created_at', startDate);
        queryOS = queryOS.gte('created_at', startDate);
      }
      if (endDate) {
        // Adicionar 23:59:59 para incluir o dia inteiro
        const endDateFull = `${endDate}T23:59:59.999Z`;
        queryPDV = queryPDV.lte('created_at', endDateFull);
        queryOS = queryOS.lte('created_at', endDateFull);
      }

      // Filtrar apenas vendas finalizadas (paid ou partial)
      queryPDV = queryPDV.in('status', ['paid', 'partial']);
      queryOS = queryOS.in('status', ['paid', 'partial']);

      // Filtro por origem (se aplicável)
      if (saleOrigin === 'PDV') {
        queryPDV = queryPDV.eq('sale_origin', 'PDV');
        queryOS = queryOS.eq('sale_origin', 'PDV'); // Não vai retornar nada
      } else if (saleOrigin === 'OS') {
        queryPDV = queryPDV.eq('sale_origin', 'OS'); // Não vai retornar nada
        queryOS = queryOS.eq('sale_origin', 'OS');
      } else {
        queryPDV = queryPDV.eq('sale_origin', 'PDV');
        queryOS = queryOS.eq('sale_origin', 'OS');
      }

      // Filtro por forma de pagamento (se aplicável)
      if (paymentMethod && paymentMethod !== 'all') {
        // Buscar vendas com pagamentos do método específico
        const { data: salesWithPayment } = await from('payments')
          .select('sale_id')
          .eq('forma_pagamento', paymentMethod)
          .eq('status', 'confirmed')
          .execute();

        const saleIds = salesWithPayment?.map(p => p.sale_id) || [];
        if (saleIds.length > 0) {
          queryPDV = queryPDV.in('id', saleIds);
          queryOS = queryOS.in('id', saleIds);
        } else {
          // Se não há vendas com essa forma de pagamento, retornar zeros
          return {
            totalPDV: 0,
            totalOS: 0,
            totalGeral: 0,
            percentPDV: 0,
            percentOS: 0,
            countPDV: 0,
            countOS: 0,
            countGeral: 0,
          };
        }
      }

      // Executar queries
      const [resultPDV, resultOS] = await Promise.all([
        queryPDV.execute(),
        queryOS.execute(),
      ]);

      const salesPDV = resultPDV.data || [];
      const salesOS = resultOS.data || [];

      const totalPDV = salesPDV.reduce((sum, s) => sum + Number(s.total || 0), 0);
      const totalOS = salesOS.reduce((sum, s) => sum + Number(s.total || 0), 0);
      const totalGeral = totalPDV + totalOS;

      const countPDV = resultPDV.count || salesPDV.length;
      const countOS = resultOS.count || salesOS.length;
      const countGeral = countPDV + countOS;

      const percentPDV = totalGeral > 0 ? (totalPDV / totalGeral) * 100 : 0;
      const percentOS = totalGeral > 0 ? (totalOS / totalGeral) * 100 : 0;

      return {
        totalPDV,
        totalOS,
        totalGeral,
        percentPDV,
        percentOS,
        countPDV,
        countOS,
        countGeral,
      };
    },
    enabled: (options?.enabled !== false) && (isAdmin || Boolean(user?.id)),
  });
}

/**
 * Hook para produtividade por técnico
 */
export function useTechnicianProductivity(filters: ReportFilters = {}) {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  return useQuery({
    queryKey: ['technician-productivity', filters],
    queryFn: async (): Promise<TechnicianProductivity[]> => {
      const { startDate, endDate, technicianId, saleOrigin, paymentMethod } = filters;

      // Buscar todas as vendas de OS finalizadas
      let querySales: any = from('sales')
        .select('id, total, technician_id, sale_origin, status, created_at')
        .eq('sale_origin', 'OS')
        .in('status', ['paid', 'partial']);

      // Filtros de data
      if (startDate) {
        querySales = querySales.gte('created_at', startDate);
      }
      if (endDate) {
        const endDateFull = `${endDate}T23:59:59.999Z`;
        querySales = querySales.lte('created_at', endDateFull);
      }

      // Filtro por técnico
      if (technicianId) {
        querySales = querySales.eq('technician_id', technicianId);
      }

      // Filtro por forma de pagamento
      if (paymentMethod && paymentMethod !== 'all') {
        const { data: salesWithPayment } = await from('payments')
          .select('sale_id')
          .eq('forma_pagamento', paymentMethod)
          .eq('status', 'confirmed')
          .execute();

        const saleIds = salesWithPayment?.map(p => p.sale_id) || [];
        if (saleIds.length > 0) {
          querySales = querySales.in('id', saleIds);
        } else {
          return [];
        }
      }

      const { data: sales } = await querySales.execute();
      const osSales = (sales || []).filter(s => s.sale_origin === 'OS');

      // Buscar nomes dos técnicos
      // technician_id é FK para auth.users(id), então precisamos buscar em profiles usando user_id
      const technicianUserIds = [...new Set(osSales.map(s => s.technician_id).filter(Boolean))];
      
      if (technicianUserIds.length === 0) {
        return [];
      }

      // Buscar profiles usando user_id (que corresponde ao technician_id)
      const { data: technicians } = await from('profiles')
        .select('user_id, display_name')
        .in('user_id', technicianUserIds)
        .execute();

      const techniciansMap = new Map(
        (technicians || []).map(t => [t.user_id, t.display_name || 'Técnico'])
      );

      // Buscar itens das vendas para calcular receita de serviços vs produtos
      const saleIds = osSales.map(s => s.id);
      const { data: saleItems } = await from('sale_items')
        .select('sale_id, valor_total, produto_tipo')
        .in('sale_id', saleIds)
        .execute();

      // Agrupar por técnico
      const productivityMap = new Map<string, TechnicianProductivity>();

      for (const sale of osSales) {
        if (!sale.technician_id) continue;

        const techId = sale.technician_id;
        const techNome = techniciansMap.get(techId) || 'Técnico Desconhecido';

        if (!productivityMap.has(techId)) {
          productivityMap.set(techId, {
            technician_id: techId,
            technician_nome: techNome,
            osCompleted: 0,
            totalRevenue: 0,
            serviceRevenue: 0,
            productRevenue: 0,
            averageTicket: 0,
          });
        }

        const productivity = productivityMap.get(techId)!;
        productivity.osCompleted += 1;
        productivity.totalRevenue += Number(sale.total || 0);

        // Calcular receita de serviços vs produtos
        const items = (saleItems || []).filter(item => item.sale_id === sale.id);
        for (const item of items) {
          const itemTotal = Number(item.valor_total || 0);
          if (item.produto_tipo === 'servico' || item.produto_tipo === 'serviço') {
            productivity.serviceRevenue += itemTotal;
          } else if (item.produto_tipo === 'produto') {
            productivity.productRevenue += itemTotal;
          }
        }
      }

      // Calcular ticket médio
      const results = Array.from(productivityMap.values()).map(prod => ({
        ...prod,
        averageTicket: prod.osCompleted > 0 ? prod.totalRevenue / prod.osCompleted : 0,
      }));

      // Ordenar por receita total (decrescente)
      return results.sort((a, b) => b.totalRevenue - a.totalRevenue);
    },
    enabled: isAdmin || Boolean(user?.id),
  });
}
