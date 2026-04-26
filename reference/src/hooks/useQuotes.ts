import { useState, useEffect, useCallback } from 'react';
import { from } from '@/integrations/db/client';
import { useAuth } from '@/contexts/AuthContext';
import { Quote, QuoteFormData, QuoteItem, QuoteStatus, CartItem } from '@/types/pdv';

// ==================== HOOK: ORÇAMENTOS ====================

export function useQuotes() {
  const auth = useAuth();
  const user = auth?.user || null;
  const profile = auth?.profile || null;
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Carregar orçamentos
  const loadQuotes = useCallback(async () => {
    try {
      setIsLoading(true);
      const isAdmin = profile?.role === 'admin';
      let query: any = from('quotes')
        .select('*')
        .order('created_at', { ascending: false });

      // Non-admin: only own quotes
      if (!isAdmin && user?.id) {
        query = query.eq('vendedor_id', user.id);
      }

      query = query.limit(isAdmin ? 1000 : 200);

      const { data, error } = await query;

      if (error) {
        // Se a tabela não existir, apenas logar
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          console.warn('Tabela quotes não existe ainda.');
          setQuotes([]);
          return;
        }
        throw error;
      }
      setQuotes(data || []);
    } catch (error) {
      console.error('Erro ao carregar orçamentos:', error);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.role, user?.id]);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  // Criar orçamento
  const createQuote = useCallback(async (data: QuoteFormData, items: CartItem[]): Promise<Quote> => {
    try {
      // Gerar número do orçamento
      const numero = Date.now();

      // Calcular totais
      const subtotal = items.reduce((sum, item) => 
        sum + (item.valor_unitario * item.quantidade), 0
      );
      const descontoItens = items.reduce((sum, item) => sum + (item.desconto || 0), 0);
      const total = subtotal - descontoItens;

      // Validar UUID do cliente
      const isValidUUID = (str: string | undefined | null): boolean => {
        if (!str) return false;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(str);
      };

      // Calcular data de validade (padrão 7 dias)
      const validadeDias = data.validade_dias || 7;
      const dataValidade = new Date();
      dataValidade.setDate(dataValidade.getDate() + validadeDias);

      const quoteData = {
        numero,
        status: 'pendente' as QuoteStatus,
        cliente_id: data.cliente_id && isValidUUID(data.cliente_id) ? data.cliente_id : null,
        cliente_nome: data.cliente_nome || 'Cliente não identificado',
        cliente_cpf_cnpj: data.cliente_cpf_cnpj || null,
        cliente_telefone: data.cliente_telefone || null,
        vendedor_id: user?.id || null,
        vendedor_nome: profile?.display_name || user?.user_metadata?.name || user?.email || null,
        observacoes: data.observacoes || null,
        subtotal,
        desconto_total: descontoItens,
        total,
        validade_dias: validadeDias,
        data_validade: dataValidade.toISOString(),
      };

      const { data: newQuote, error } = await from('quotes').insert(quoteData).select().single();

      if (error) throw error;
      if (!newQuote || !newQuote.id) throw new Error('Falha ao criar orçamento - ID não retornado');

      // Adicionar itens do orçamento
      for (const item of items) {
        const itemData = {
          quote_id: newQuote.id,
          produto_id: item.produto_id && isValidUUID(item.produto_id) ? item.produto_id : null,
          produto_nome: item.produto_nome,
          produto_codigo: item.produto_codigo || null,
          produto_codigo_barras: item.produto_codigo_barras || null,
          produto_tipo: item.produto_tipo || null,
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario,
          desconto: item.desconto || 0,
          valor_total: (item.valor_unitario * item.quantidade) - (item.desconto || 0),
          observacao: item.observacao || null,
        };

        await from('quote_items').insert(itemData);
      }

      setQuotes(prev => [newQuote, ...prev]);
      return newQuote;
    } catch (error) {
      console.error('Erro ao criar orçamento:', error);
      throw error;
    }
  }, [user, profile]);

  // Atualizar status do orçamento
  const updateQuoteStatus = useCallback(async (id: string, status: QuoteStatus): Promise<Quote> => {
    try {
      const { data: updatedQuote, error } = await from('quotes')
        .eq('id', id)
        .update({ status, updated_at: new Date().toISOString() });

      if (error) throw error;

      const updatedData = { ...quotes.find(q => q.id === id), status, updated_at: new Date().toISOString() } as Quote;
      setQuotes(prev => prev.map(q => q.id === id ? updatedData : q));
      return updatedData;
    } catch (error) {
      console.error('Erro ao atualizar status do orçamento:', error);
      throw error;
    }
  }, [quotes]);

  // Marcar como enviado por WhatsApp
  const markAsSentWhatsApp = useCallback(async (id: string): Promise<Quote> => {
    try {
      const updateData = { 
        status: 'enviado' as QuoteStatus,
        enviado_whatsapp: true, 
        whatsapp_enviado_em: new Date().toISOString(),
        updated_at: new Date().toISOString() 
      };
      
      const { error } = await from('quotes')
        .eq('id', id)
        .update(updateData);

      if (error) throw error;

      const existingQuote = quotes.find(q => q.id === id);
      const updatedQuote = { ...existingQuote, ...updateData } as Quote;
      setQuotes(prev => prev.map(q => q.id === id ? updatedQuote : q));
      return updatedQuote;
    } catch (error) {
      console.error('Erro ao marcar orçamento como enviado:', error);
      throw error;
    }
  }, [quotes]);

  // Converter orçamento em venda
  const convertToSale = useCallback(async (quoteId: string): Promise<string> => {
    try {
      // Buscar orçamento com itens
      const { data: quote, error: quoteError } = await from('quotes')
        .select('*')
        .eq('id', quoteId)
        .single();

      if (quoteError || !quote) throw new Error('Orçamento não encontrado');

      const { data: items, error: itemsError } = await from('quote_items')
        .select('*')
        .eq('quote_id', quoteId)
        .execute();

      if (itemsError) throw itemsError;

      // Criar venda
      const saleData = {
        numero: Date.now(),
        status: 'draft',
        cliente_id: quote.cliente_id,
        cliente_nome: quote.cliente_nome,
        cliente_cpf_cnpj: quote.cliente_cpf_cnpj,
        cliente_telefone: quote.cliente_telefone,
        vendedor_id: quote.vendedor_id,
        vendedor_nome: quote.vendedor_nome,
        observacoes: `Convertido do Orçamento #${quote.numero}. ${quote.observacoes || ''}`,
        is_draft: true,
        subtotal: quote.subtotal,
        desconto_total: quote.desconto_total,
        total: quote.total,
        total_pago: 0,
      };

      const { data: newSale, error: saleError } = await from('sales').insert(saleData);

      if (saleError) throw saleError;
      if (!newSale || !newSale.id) throw new Error('Falha ao criar venda - ID não retornado');

      // Copiar itens para a venda
      for (const item of (items || [])) {
        const saleItemData = {
          sale_id: newSale.id,
          produto_id: item.produto_id,
          produto_nome: item.produto_nome,
          produto_codigo: item.produto_codigo,
          produto_codigo_barras: item.produto_codigo_barras,
          produto_tipo: item.produto_tipo,
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario,
          desconto: item.desconto,
          valor_total: item.valor_total,
          observacao: item.observacao,
        };

        await from('sale_items').insert(saleItemData);
      }

      // Atualizar orçamento como convertido
      await from('quotes')
        .eq('id', quoteId)
        .update({ 
          status: 'convertido' as QuoteStatus,
          sale_id: newSale.id,
          converted_at: new Date().toISOString(),
          updated_at: new Date().toISOString() 
        });

      // Atualizar estado local
      setQuotes(prev => prev.map(q => 
        q.id === quoteId 
          ? { ...q, status: 'convertido' as QuoteStatus, sale_id: newSale.id } 
          : q
      ));

      return newSale.id;
    } catch (error) {
      console.error('Erro ao converter orçamento em venda:', error);
      throw error;
    }
  }, []);

  // Buscar orçamento por ID
  const getQuoteById = useCallback(async (id: string): Promise<Quote | null> => {
    try {
      const { data: quote, error: quoteError } = await from('quotes')
        .select('*')
        .eq('id', id)
        .single();

      if (quoteError) throw quoteError;

      const { data: items, error: itemsError } = await from('quote_items')
        .select('*')
        .eq('quote_id', id)
        .execute();

      if (itemsError) throw itemsError;

      return { ...quote, items: items || [] };
    } catch (error) {
      console.error('Erro ao buscar orçamento:', error);
      return null;
    }
  }, []);

  // Deletar orçamento
  const deleteQuote = useCallback(async (id: string): Promise<void> => {
    try {
      // Deletar itens primeiro
      await from('quote_items')
        .delete()
        .eq('quote_id', id)
        .execute();

      // Deletar orçamento
      const { error } = await from('quotes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setQuotes(prev => prev.filter(q => q.id !== id));
    } catch (error) {
      console.error('Erro ao deletar orçamento:', error);
      throw error;
    }
  }, []);

  return {
    quotes,
    isLoading,
    createQuote,
    updateQuoteStatus,
    markAsSentWhatsApp,
    convertToSale,
    getQuoteById,
    deleteQuote,
    refreshQuotes: loadQuotes,
  };
}

// ==================== HOOK: ITENS DO ORÇAMENTO ====================

export function useQuoteItems(quoteId: string) {
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadItems = useCallback(async () => {
    if (!quoteId) return;
    
    try {
      setIsLoading(true);
      const { data, error } = await from('quote_items')
        .select('*')
        .eq('quote_id', quoteId)
        .order('created_at', { ascending: true })
        .execute();

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Erro ao carregar itens do orçamento:', error);
    } finally {
      setIsLoading(false);
    }
  }, [quoteId]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  return {
    items,
    isLoading,
    refreshItems: loadItems,
  };
}

