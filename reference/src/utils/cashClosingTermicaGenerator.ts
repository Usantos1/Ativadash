import { from } from '@/integrations/db/client';
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/types/pdv';

export interface CashClosingTermicaSale {
  numero: number | string;
  cliente_nome: string;
  data_hora: string;
  total: number;
  pagamentos: Array<{ forma: string; valor_exibido: number; troco?: number }>;
}

export interface CashClosingTermicaMovement {
  tipo: 'sangria' | 'suprimento';
  valor: number;
  motivo?: string;
}

export interface CashClosingTermicaFormaTotal {
  forma: string;
  valor_conferencia: number;
  detalhe_linha?: string;
}

export interface BuildCashClosingTermicaParams {
  operador_nome?: string;
  valor_abertura: number;
  abertura_em: string;
  totais_por_forma: CashClosingTermicaFormaTotal[];
  total_entradas_vendas: number;
  valor_esperado_caixa: number;
  vendas: CashClosingTermicaSale[];
  movimentos: CashClosingTermicaMovement[];
  /** Data/hora da impressão (extrato pré-fechamento) */
  gerado_em?: string;
}

function formatBrl(n: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

function escapeHtml(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function labelFormaPagamento(forma: string): string {
  const k = (forma || '').toLowerCase() as PaymentMethod;
  return PAYMENT_METHOD_LABELS[k] || forma || 'Outro';
}

function resumoPagamentos(pags: CashClosingTermicaSale['pagamentos']): string {
  if (!pags.length) return '—';
  return pags
    .map((p) => {
      const base = `${labelFormaPagamento(p.forma)} ${formatBrl(p.valor_exibido)}`;
      const t = Number(p.troco || 0);
      if ((p.forma || '').toLowerCase() === 'dinheiro' && t > 0) return `${base} (troco ${formatBrl(t)})`;
      return base;
    })
    .join(' · ');
}

/**
 * HTML80 mm para extrato de fechamento de caixa (não fiscal).
 */
export async function buildCashClosingTermicaHtml(params: BuildCashClosingTermicaParams): Promise<string> {
  let empresaNome = 'Extrato de caixa';
  try {
    const { data } = await from('cupom_config').select('empresa_nome').limit(1).maybeSingle();
    if (data && (data as { empresa_nome?: string }).empresa_nome) {
      empresaNome = String((data as { empresa_nome: string }).empresa_nome);
    }
  } catch {
    /* ignora */
  }

  const gerado =
    params.gerado_em ||
    new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  const dinheiro = params.totais_por_forma.find((t) => (t.forma || '').toLowerCase() === 'dinheiro');
  const eletronicos = params.totais_por_forma.filter((t) => (t.forma || '').toLowerCase() !== 'dinheiro');

  const vendasOrdenadas = [...params.vendas].sort((a, b) => String(b.data_hora).localeCompare(String(a.data_hora)));

  const movRows = params.movimentos
    .map((m) => {
      const tipo = m.tipo === 'sangria' ? 'Sangria' : 'Suprimento';
      const mot = m.motivo ? escapeHtml(m.motivo) : '';
      return `<div class="row"><span>${tipo}${mot ? ` — ${mot}` : ''}</span><span>${formatBrl(m.valor)}</span></div>`;
    })
    .join('');

  const vendasRows = vendasOrdenadas
    .map((v) => {
      const cli = escapeHtml(v.cliente_nome || '—');
      const res = escapeHtml(resumoPagamentos(v.pagamentos));
      return `
 <div class="venda-bloco">
          <div class="row"><strong>#${escapeHtml(String(v.numero))}</strong><strong>${formatBrl(v.total)}</strong></div>
          <div class="small">${escapeHtml(v.data_hora)} · ${cli}</div>
          <div class="small wrap">${res}</div>
        </div>`;
    })
    .join('');

  const blocoDinheiro = dinheiro
    ? `
 <div class="section-title">Caixa físico (dinheiro)</div>
    <div class="row"><span>Total para conferência</span><span>${formatBrl(dinheiro.valor_conferencia)}</span></div>
    ${dinheiro.detalhe_linha ? `<div class="small">${escapeHtml(dinheiro.detalhe_linha)}</div>` : ''}`
 : '';

  const blocoEletronicos =
    eletronicos.length > 0
      ? `
    <div class="section-title">Maquininhas / PIX / outros</div>
    ${eletronicos
      .map(
        (t) => `
      <div class="row"><span>${escapeHtml(labelFormaPagamento(t.forma))}</span><span>${formatBrl(t.valor_conferencia)}</span></div>
      ${t.detalhe_linha ? `<div class="small">${escapeHtml(t.detalhe_linha)}</div>` : ''}`
 )
      .join('')}`
      : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Extrato fechamento caixa</title>
  <style>
    @page { size: 80mm auto; margin: 2mm; }
    body { font-family: ui-monospace, 'Cascadia Code', 'Segoe UI', monospace, sans-serif; font-size: 11px; width: 72mm; max-width: 72mm; margin: 0 auto; padding: 2mm; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    h1 { font-size: 13px; text-align: center; margin: 4px 0 2px; font-weight: 700; }
    .sub { text-align: center; font-size: 10px; margin-bottom: 6px; }
    .center { text-align: center; }
    .divider { border-top: 1px dashed #000; margin: 8px 0; }
    .row { display: flex; justify-content: space-between; gap: 6px; align-items: baseline; }
    .small { font-size: 9px; color: #222; margin-top: 2px; }
    .wrap { white-space: normal; word-break: break-word; }
    .section-title { font-weight: 700; margin-top: 10px; margin-bottom: 4px; border-bottom: 1px solid #000; padding-bottom: 2px; }
    .venda-bloco { margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px dotted #999; }
    .venda-bloco:last-child { border-bottom: none; }
    .nota { font-size: 9px; margin-top: 8px; font-style: italic; text-align: center; }
  </style>
</head>
<body>
  <h1>${escapeHtml(empresaNome)}</h1>
  <div class="sub">EXTRATO — FECHAMENTO DE CAIXA</div>
  <div class="small center">Emitido em ${escapeHtml(gerado)}</div>
  <div class="divider"></div>
  <div class="row"><span>Operador</span><span class="wrap" style="text-align:right;max-width:65%">${escapeHtml(params.operador_nome || '—')}</span></div>
  <div class="row"><span>Abertura</span><span>${escapeHtml(params.abertura_em)}</span></div>
  <div class="row"><span>Valor abertura</span><span>${formatBrl(params.valor_abertura)}</span></div>
  <div class="divider"></div>
  ${blocoDinheiro}
  ${blocoEletronicos}
  <div class="divider"></div>
  <div class="row"><span>Total vendas (entradas)</span><span>${formatBrl(params.total_entradas_vendas)}</span></div>
  <div class="row" style="font-weight:700"><span>Saldo esperado no caixa</span><span>${formatBrl(params.valor_esperado_caixa)}</span></div>
  <div class="divider"></div>
  <div class="section-title">Vendas (${params.vendas.length})</div>
  ${params.vendas.length ? vendasRows : '<div class="small">Nenhuma venda nesta sessão.</div>'}
  <div class="divider"></div>
  <div class="section-title">Sangrias e suprimentos</div>
  ${params.movimentos.length ? movRows : '<div class="small">Nenhum movimento.</div>'}
  <div class="nota">Conferir dinheiro no caixa físico e repasses de cartão/PIX nas maquininhas. Documento para conferência interna.</div>
</body>
</html>`;
}
