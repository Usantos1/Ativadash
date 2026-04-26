import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ModernLayout } from '@/components/ModernLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer, Download, Share2 } from 'lucide-react';
import { generateCupomTermica, generateCupomPDF, printTermica } from '@/utils/pdfGenerator';
import { APP_PUBLIC_URL } from '@/utils/appUrl';
import { from } from '@/integrations/db/client';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';

export default function CupomView() {
  const { id } = useParams<{ id: string }>();
  const [sale, setSale] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [cupomConfig, setCupomConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadSale();
    }
  }, [id]);

  useEffect(() => {
    if (sale && items && payments && cupomConfig !== undefined) {
      renderCupomPreview();
    }
  }, [sale, items, payments, cupomConfig]);

  const renderCupomPreview = async () => {
    if (!sale || !items || !payments) return;

    const cupomData = {
      numero: sale.numero,
      data: new Date(sale.created_at).toLocaleDateString('pt-BR'),
      hora: new Date(sale.created_at).toLocaleTimeString('pt-BR'),
      empresa: {
        nome: 'PRIME CAMP',
        cnpj: '31.833.574/0001-74',
        endereco: undefined,
        telefone: undefined,
      },
      cliente: sale.cliente_nome ? {
        nome: sale.cliente_nome,
        cpf_cnpj: sale.cliente_cpf_cnpj || undefined,
        telefone: sale.cliente_telefone || undefined,
      } : undefined,
      itens: items.map((item: any) => ({
        codigo: item.produto_codigo || item.produto_codigo_barras || undefined,
        nome: item.produto_nome,
        quantidade: Number(item.quantidade),
        valor_unitario: Number(item.valor_unitario),
        desconto: Number(item.desconto || 0),
        valor_total: Number(item.valor_total),
      })),
      subtotal: Number(sale.subtotal),
      total: Number(sale.total),
      desconto_total: (() => {
        const sub = Number(sale.subtotal || 0);
        const tot = Number(sale.total || 0);
        const fromSale = Math.max(0, sub - tot);
        if (fromSale > 0) return fromSale;
        const fromItens = items.reduce((s: number, i: any) => s + (Number(i.valor_unitario || 0) * Number(i.quantidade || 0) - Number(i.valor_total || 0)), 0);
        const extra = Number(sale.desconto_total || 0);
        return Math.max(0, fromItens + extra);
      })(),
      pagamentos: payments
        .filter((p: any) => p.status === 'confirmed')
        .map((p: any) => ({
          forma: p.forma_pagamento,
          valor: Number(p.valor),
          troco: p.troco ? Number(p.troco) : undefined,
        })),
      vendedor: sale.vendedor_nome || undefined,
      observacoes: sale.observacoes || undefined,
      mostrar_termos_garantia_os: !!sale?.ordem_servico_id,
    };

    const qrCodeData = `${APP_PUBLIC_URL}/cupom/${sale.id}`;
    const html = await generateCupomTermica(cupomData, qrCodeData, cupomConfig || undefined);
    
    const previewElement = document.getElementById('cupom-preview');
    if (previewElement) {
      previewElement.innerHTML = html;
    }
  };

  const loadSale = async () => {
    if (!id) return;
    try {
      setLoading(true);

      // API pública: funciona sem login (QR code no cupom / celular do cliente)
      const apiBase = import.meta.env.VITE_API_URL || 'https://api.ativafix.com/api';
      const res = await fetch(`${apiBase}/public/cupom/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          setSale(null);
          setItems([]);
          setPayments([]);
        } else {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Erro ${res.status}`);
        }
        return;
      }
      const data = await res.json();
      setSale(data.sale);
      setItems(data.items || []);
      setPayments(data.payments || []);

      // Config do cupom por empresa (chave cupom_config_<company_id> para isolamento)
      try {
        const companyId = data.sale?.company_id;
        const cupomKey = companyId ? `cupom_config_${companyId}` : 'cupom_config';
        const { data: configData } = await from('kv_store_2c4defad')
          .select('value')
          .eq('key', cupomKey)
          .single()
          .execute();
        if (configData) setCupomConfig(configData.value);
      } catch {
        setCupomConfig(null);
      }
    } catch (error) {
      console.error('Erro ao carregar cupom:', error);
      setSale(null);
      setItems([]);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    if (!sale || !items || !payments) return;

    const cupomData = {
      numero: sale.numero,
      data: new Date(sale.created_at).toLocaleDateString('pt-BR'),
      hora: new Date(sale.created_at).toLocaleTimeString('pt-BR'),
      empresa: {
        nome: 'PRIME CAMP',
        cnpj: '31.833.574/0001-74',
        endereco: undefined,
        telefone: undefined,
      },
      cliente: sale.cliente_nome ? {
        nome: sale.cliente_nome,
        cpf_cnpj: sale.cliente_cpf_cnpj || undefined,
        telefone: sale.cliente_telefone || undefined,
      } : undefined,
      itens: items.map((item: any) => ({
        codigo: item.produto_codigo || item.produto_codigo_barras || undefined,
        nome: item.produto_nome,
        quantidade: Number(item.quantidade),
        valor_unitario: Number(item.valor_unitario),
        desconto: Number(item.desconto || 0),
        valor_total: Number(item.valor_total),
      })),
      subtotal: Number(sale.subtotal),
      total: Number(sale.total),
      desconto_total: (() => {
        const sub = Number(sale.subtotal || 0);
        const tot = Number(sale.total || 0);
        const fromSale = Math.max(0, sub - tot);
        if (fromSale > 0) return fromSale;
        const fromItens = items.reduce((s: number, i: any) => s + (Number(i.valor_unitario || 0) * Number(i.quantidade || 0) - Number(i.valor_total || 0)), 0);
        const extra = Number(sale.desconto_total || 0);
        return Math.max(0, fromItens + extra);
      })(),
      pagamentos: payments
        .filter((p: any) => p.status === 'confirmed')
        .map((p: any) => ({
          forma: p.forma_pagamento,
          valor: Number(p.valor),
          troco: p.troco ? Number(p.troco) : undefined,
        })),
      vendedor: sale.vendedor_nome || undefined,
      observacoes: sale.observacoes || undefined,
      mostrar_termos_garantia_os: !!sale?.ordem_servico_id,
    };

    const qrCodeData = `${APP_PUBLIC_URL}/cupom/${sale.id}`;
    const html = await generateCupomTermica(cupomData, qrCodeData, cupomConfig || undefined);
    printTermica(html);
  };

  const handleDownloadPDF = async () => {
    if (!sale || !items || !payments) return;

    const cupomData = {
      numero: sale.numero,
      data: new Date(sale.created_at).toLocaleDateString('pt-BR'),
      hora: new Date(sale.created_at).toLocaleTimeString('pt-BR'),
      empresa: {
        nome: 'PRIME CAMP',
        cnpj: '31.833.574/0001-74',
      },
      cliente: sale.cliente_nome ? {
        nome: sale.cliente_nome,
      } : undefined,
      itens: items.map((item: any) => ({
        codigo: item.produto_codigo || item.produto_codigo_barras || undefined,
        nome: item.produto_nome,
        quantidade: Number(item.quantidade),
        valor_unitario: Number(item.valor_unitario),
        desconto: Number(item.desconto || 0),
        valor_total: Number(item.valor_total),
      })),
      subtotal: Number(sale.subtotal),
      total: Number(sale.total),
      desconto_total: (() => {
        const sub = Number(sale.subtotal || 0);
        const tot = Number(sale.total || 0);
        const fromSale = Math.max(0, sub - tot);
        if (fromSale > 0) return fromSale;
        const fromItens = items.reduce((s: number, i: any) => s + (Number(i.valor_unitario || 0) * Number(i.quantidade || 0) - Number(i.valor_total || 0)), 0);
        const extra = Number(sale.desconto_total || 0);
        return Math.max(0, fromItens + extra);
      })(),
      pagamentos: payments
        .filter((p: any) => p.status === 'confirmed')
        .map((p: any) => ({
          forma: p.forma_pagamento,
          valor: Number(p.valor),
          troco: p.troco ? Number(p.troco) : undefined,
        })),
      vendedor: sale.vendedor_nome || undefined,
      mostrar_termos_garantia_os: !!sale?.ordem_servico_id,
    };

    const qrCodeData = `${APP_PUBLIC_URL}/cupom/${sale.id}`;
    const pdf = await generateCupomPDF(cupomData, qrCodeData);
    pdf.save(`cupom-${sale.numero}.pdf`);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `Cupom #${sale?.numero}`,
        text: `Visualize o cupom da venda #${sale?.numero}`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copiado para a área de transferência!');
    }
  };

  if (loading) {
    return <LoadingSkeleton type="cards" count={3} />;
  }

  if (!sale) {
    return (
      <ModernLayout title="Cupom não encontrado">
        <div className="space-y-4 md:space-y-6 px-1 md:px-0">
          <Card className="border-2 border-gray-300 shadow-sm">
            <CardContent className="p-6 md:p-8">
              <div className="text-center">
                <p className="text-sm md:text-base text-muted-foreground">
                  Cupom não encontrado. Verifique o link ou o número do pedido.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </ModernLayout>
    );
  }

  return (
    <ModernLayout title={`Cupom #${sale.numero}`} subtitle="Visualização do cupom fiscal">
      <div className="space-y-4 md:space-y-6 px-1 md:px-0">
        <Card className="border-2 border-gray-300 shadow-sm">
          <CardHeader className="pb-3 pt-3 md:pt-6 px-3 md:px-6 border-b-2 border-gray-200">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h1 className="text-lg md:text-xl font-bold">Cupom #{sale.numero}</h1>
                <p className="text-xs md:text-sm text-muted-foreground mt-1">
                  {new Date(sale.created_at).toLocaleDateString('pt-BR', { 
                    day: '2-digit', 
                    month: 'long', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={handleDownloadPDF} 
                  size="sm" 
                  variant="outline"
                  className="h-9 border-2 border-gray-300"
                >
                  <Download className="h-4 w-4 mr-2" />
                  <span className="hidden md:inline">Baixar PDF</span>
                </Button>
                <Button 
                  onClick={handlePrint} 
                  size="sm" 
                  className="h-9 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white border-0 shadow-md"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Reimprimir
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-6">
            <div 
              id="cupom-preview" 
              className="bg-white border-2 border-gray-300 rounded-lg overflow-auto mx-auto"
              style={{ maxWidth: '80mm', minHeight: '200px' }}
            >
              {loading ? (
                <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
                  Carregando preview do cupom...
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </ModernLayout>
  );
}

