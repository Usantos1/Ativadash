import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

/** PDF simples com linhas de texto (sem captura DOM). */
export function downloadTextPdf(title: string, lines: string[], filename: string): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  let y = margin;
  doc.setFontSize(16);
  doc.text(title, margin, y);
  y += 28;
  doc.setFontSize(10);
  for (const line of lines) {
    const parts = doc.splitTextToSize(line, 515);
    for (const p of parts) {
      if (y > 780) {
        doc.addPage();
        y = margin;
      }
      doc.text(p, margin, y);
      y += 14;
    }
  }
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

export type PainelAdsKpiRow = { label: string; value: string };

/** Etapas do funil (volumes numéricos para largura das barras; rótulos já formatados). */
export type PainelAdsFunnelStep = {
  title: string;
  volume: number;
  volumeLabel: string;
  rateLabel: string | null;
};

export type PainelAdsTrendPoint = { label: string; gasto: number; leads: number };

export type PainelAdsCampaignPdfRow = {
  channel: string;
  name: string;
  gasto: string;
  leads: string;
  impressoes: string;
  cliques: string;
  ctr: string;
  cpc: string;
};

export type PainelAdsReportPdfInput = {
  filename: string;
  workspaceName: string;
  periodLabel: string;
  startDate: string;
  endDate: string;
  objectiveLabel: string;
  consolidated: PainelAdsKpiRow[];
  metaSection?: { title: string; rows: PainelAdsKpiRow[] };
  googleSection?: { title: string; rows: PainelAdsKpiRow[] };
  footnote?: string;
  funnelSteps?: PainelAdsFunnelStep[];
  /** Série diária (gasto + leads) — até ~45 pontos recomendado. */
  trend?: PainelAdsTrendPoint[];
  /** Top campanhas por gasto, já formatadas para células. */
  topCampaigns?: PainelAdsCampaignPdfRow[];
};

const BRAND_TOP = { r: 49, g: 46, b: 129 };
const TEXT_MUTED: [number, number, number] = [100, 116, 139];
const TEXT_BODY: [number, number, number] = [31, 41, 55];
const LINE: [number, number, number] = [226, 232, 240];
const HEADER_FILL: [number, number, number] = [241, 245, 249];

type PdfContext = {
  doc: jsPDF;
  pageW: number;
  pageH: number;
  m: number;
  bottomSafe: number;
  ensureSpace: (y: number, need: number) => number;
};

function drawFooterEveryPage(doc: jsPDF, pageW: number, pageH: number, m: number, totalPages: number): void {
  const generated = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(0.4);
    doc.line(m, pageH - 38, pageW - m, pageH - 38);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
    doc.text(`Gerado em ${generated} · Valores conforme período e filtros no painel.`, m, pageH - 22);
    doc.text(`${i} / ${totalPages}`, pageW - m, pageH - 22, { align: "right" });
  }
}

/** Tabela 2 colunas com bordas: cabeçalho + linhas. */
function drawKpiTable(ctx: PdfContext, startY: number, title: string, rows: PainelAdsKpiRow[]): number {
  const { doc, pageW, m } = ctx;
  let y = startY;
  y = ctx.ensureSpace(y, 40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(TEXT_BODY[0], TEXT_BODY[1], TEXT_BODY[2]);
  doc.text(title, m, y);
  y += 10;
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(0.5);
  doc.line(m, y, pageW - m, y);
  y += 14;

  const colL = m;
  const colR = pageW - m;
  const mid = m + (pageW - 2 * m) * 0.52;
  const rowH = 16;

  y = ctx.ensureSpace(y, rowH + 4);
  doc.setFillColor(HEADER_FILL[0], HEADER_FILL[1], HEADER_FILL[2]);
  doc.rect(colL, y - 10, colR - colL, rowH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
  doc.text("INDICADOR", colL + 4, y);
  doc.text("VALOR", colR - 4, y, { align: "right" });
  doc.rect(colL, y - 10, colR - colL, rowH, "S");
  y += rowH;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    y = ctx.ensureSpace(y, rowH + 2);
    if (i % 2 === 1) {
      doc.setFillColor(252, 252, 253);
      doc.rect(colL, y - 10, colR - colL, rowH, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(TEXT_BODY[0], TEXT_BODY[1], TEXT_BODY[2]);
    const lab = doc.splitTextToSize(row.label, mid - colL - 8);
    doc.text(lab, colL + 4, y);
    doc.setFont("helvetica", "bold");
    doc.text(row.value, colR - 4, y, { align: "right" });
    doc.rect(colL, y - 10, colR - colL, rowH, "S");
    doc.line(mid, y - 10, mid, y - 10 + rowH);
    y += rowH;
  }
  return y + 8;
}

/** Funil em barras horizontais (largura proporcional ao volume). */
function drawFunnelSection(ctx: PdfContext, startY: number, steps: PainelAdsFunnelStep[]): number {
  if (!steps.length) return startY;
  const { doc, pageW, m } = ctx;
  const blockH = 28 + steps.length * 44;
  let y = ctx.ensureSpace(startY, blockH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(TEXT_BODY[0], TEXT_BODY[1], TEXT_BODY[2]);
  doc.text("Funil de captação (resumo)", m, y);
  y += 10;
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.line(m, y, pageW - m, y);
  y += 16;

  const maxV = Math.max(...steps.map((s) => s.volume), 1);
  const maxBarW = pageW - 2 * m - 8;
  const cx = pageW / 2;

  for (const s of steps) {
    y = ctx.ensureSpace(y, 42);
    const frac = Math.max(0.14, s.volume / maxV);
    const bw = maxBarW * frac;
    doc.setFillColor(238, 242, 255);
    doc.setDrawColor(BRAND_TOP.r, BRAND_TOP.g, BRAND_TOP.b);
    doc.setLineWidth(0.55);
    doc.roundedRect(cx - bw / 2, y, bw, 18, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(TEXT_BODY[0], TEXT_BODY[1], TEXT_BODY[2]);
    doc.text(s.title, cx, y + 12, { align: "center" });
    y += 22;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
    const rate = s.rateLabel ? ` · ${s.rateLabel}` : "";
    doc.text(`${s.volumeLabel}${rate}`, cx, y, { align: "center" });
    y += 14;
  }
  return y + 6;
}

/** Gráfico de linhas: gasto (índigo) e leads (verde). */
function drawTrendChart(ctx: PdfContext, startY: number, points: PainelAdsTrendPoint[]): number {
  if (points.length < 2) return startY;
  const { doc, pageW, m } = ctx;
  const chartH = 100;
  const chartTopPad = 36;
  const need = chartH + chartTopPad + 24;
  let y = ctx.ensureSpace(startY, need);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(TEXT_BODY[0], TEXT_BODY[1], TEXT_BODY[2]);
  doc.text("Tendência diária (gasto e leads)", m, y);
  y += 10;
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.line(m, y, pageW - m, y);
  y += 14;

  const x0 = m;
  const x1 = pageW - m;
  const y0 = y + chartH;
  const yTop = y;
  const w = x1 - x0;
  const maxG = Math.max(...points.map((p) => p.gasto), 1e-6);
  const maxL = Math.max(...points.map((p) => p.leads), 1e-6);
  const n = points.length;

  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(0.4);
  doc.rect(x0, yTop, w, chartH, "S");

  const gx = (i: number) => x0 + (n <= 1 ? w / 2 : (i / (n - 1)) * w);
  const gyG = (g: number) => y0 - (g / maxG) * (chartH - 8);
  const gyL = (l: number) => y0 - (l / maxL) * (chartH - 8);

  doc.setDrawColor(BRAND_TOP.r, BRAND_TOP.g, BRAND_TOP.b);
  doc.setLineWidth(1);
  for (let i = 0; i < n - 1; i++) {
    doc.line(gx(i), gyG(points[i].gasto), gx(i + 1), gyG(points[i + 1].gasto));
  }
  doc.setDrawColor(22, 163, 74);
  doc.setLineWidth(0.9);
  for (let i = 0; i < n - 1; i++) {
    doc.line(gx(i), gyL(points[i].leads), gx(i + 1), gyL(points[i + 1].leads));
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
  const step = n > 12 ? Math.ceil(n / 10) : 1;
  for (let i = 0; i < n; i += step) {
    doc.text(points[i].label, gx(i), y0 + 10, { align: "center", maxWidth: 28 });
  }
  if ((n - 1) % step !== 0) {
    doc.text(points[n - 1].label, gx(n - 1), y0 + 10, { align: "center", maxWidth: 28 });
  }

  y = y0 + 22;
  doc.setFontSize(7);
  doc.setTextColor(BRAND_TOP.r, BRAND_TOP.g, BRAND_TOP.b);
  doc.text("— Gasto (R$)", m, y);
  doc.setTextColor(22, 163, 74);
  doc.text("— Leads", m + 72, y);
  return y + 12;
}

/** Tabela campanhas: várias colunas com borda. */
function drawCampaignsTable(ctx: PdfContext, startY: number, rows: PainelAdsCampaignPdfRow[]): number {
  if (!rows.length) return startY;
  const { doc, pageW, m } = ctx;
  const headers = ["Canal", "Campanha", "Gasto", "Impr.", "Cliq.", "CTR", "CPC", "Leads"];
  const colWeights = [0.08, 0.34, 0.11, 0.09, 0.09, 0.07, 0.1, 0.12];
  const innerW = pageW - 2 * m;
  const cols = colWeights.map((w) => innerW * w);
  const rowH = 14;
  const headerH = 16;

  let y = ctx.ensureSpace(startY, headerH + 8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(TEXT_BODY[0], TEXT_BODY[1], TEXT_BODY[2]);
  doc.text("Top campanhas por gasto (filtro do painel)", m, y);
  y += 10;
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.line(m, y, pageW - m, y);
  y += 12;

  const drawRow = (cells: string[], bold: boolean, fill: boolean, yy: number): number => {
    let x = m;
    if (fill) {
      doc.setFillColor(HEADER_FILL[0], HEADER_FILL[1], HEADER_FILL[2]);
      doc.rect(m, yy - 9, innerW, rowH, "F");
    }
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(0.35);
    for (let c = 0; c < cells.length; c++) {
      const cw = cols[c] ?? 40;
      doc.rect(x, yy - 9, cw, rowH, "S");
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(c === 1 ? 7 : 7);
      doc.setTextColor(TEXT_BODY[0], TEXT_BODY[1], TEXT_BODY[2]);
      const txt = cells[c] ?? "";
      const lines = doc.splitTextToSize(txt, cw - 4);
      const clip = lines.slice(0, 2);
      doc.text(clip, x + 2, yy, { maxWidth: cw - 4 });
      x += cw;
    }
    return yy + rowH;
  };

  y = ctx.ensureSpace(y, headerH);
  y = drawRow(headers, true, true, y);

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    y = ctx.ensureSpace(y, rowH + 2);
    y = drawRow(
      [r.channel, r.name, r.gasto, r.impressoes, r.cliques, r.ctr, r.cpc, r.leads],
      false,
      i % 2 === 1,
      y
    );
  }
  return y + 10;
}

/** Relatório Painel ADS: cabeçalho, funil, gráfico, tabelas, rodapé. */
export function downloadPainelAdsReportPdf(input: PainelAdsReportPdfInput): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const m = 48;
  const bottomSafe = 56;

  const ensureSpace = (currentY: number, need: number): number => {
    if (currentY + need > pageH - bottomSafe) {
      doc.addPage();
      return m + 24;
    }
    return currentY;
  };

  const ctx: PdfContext = { doc, pageW, pageH, m, bottomSafe, ensureSpace };

  doc.setFillColor(BRAND_TOP.r, BRAND_TOP.g, BRAND_TOP.b);
  doc.rect(0, 0, pageW, 78, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Painel ADS", m, 44);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const wsLines = doc.splitTextToSize(input.workspaceName, pageW - 2 * m - 160);
  doc.text(wsLines, m, 62);
  doc.setFontSize(9);
  doc.setTextColor(226, 232, 240);
  doc.text(input.periodLabel, pageW - m, 36, { align: "right" });
  doc.text(`${input.startDate}  \u2192  ${input.endDate}`, pageW - m, 50, { align: "right" });
  doc.setFontSize(8);
  doc.text("Ativa Dash", pageW - m, 66, { align: "right" });

  let y = 98;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
  doc.text(`Objetivo da conta: ${input.objectiveLabel}`, m, y);
  y += 22;

  if (input.funnelSteps?.length) {
    y = drawFunnelSection(ctx, y, input.funnelSteps);
  }
  if (input.trend?.length && input.trend.length >= 2) {
    y = drawTrendChart(ctx, y, input.trend);
  }

  y = drawKpiTable(ctx, y, "Resumo consolidado (filtro atual)", input.consolidated);

  if (input.metaSection?.rows.length) {
    y = drawKpiTable(ctx, y, input.metaSection.title, input.metaSection.rows);
  }
  if (input.googleSection?.rows.length) {
    y = drawKpiTable(ctx, y, input.googleSection.title, input.googleSection.rows);
  }
  if (input.topCampaigns?.length) {
    y = drawCampaignsTable(ctx, y, input.topCampaigns);
  }

  if (input.footnote?.trim()) {
    y = ensureSpace(y, 40);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
    const fn = doc.splitTextToSize(input.footnote.trim(), pageW - 2 * m);
    doc.text(fn, m, y);
  }

  const totalPages = doc.getNumberOfPages();
  drawFooterEveryPage(doc, pageW, pageH, m, totalPages);

  const name = input.filename.endsWith(".pdf") ? input.filename : `${input.filename}.pdf`;
  doc.save(name);
}

/** Captura um elemento DOM como imagem no PDF (logo visual). */
export async function downloadElementPdf(
  element: HTMLElement,
  title: string,
  filename: string
): Promise<void> {
  const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false });
  const img = canvas.toDataURL("image/png");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  doc.setFontSize(14);
  doc.text(title, margin, margin);
  const maxW = pageW - margin * 2;
  const ratio = canvas.height / canvas.width;
  const w = maxW;
  const h = w * ratio;
  const y0 = margin + 20;
  doc.addImage(img, "PNG", margin, y0, w, Math.min(h, pageH - y0 - margin));
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
