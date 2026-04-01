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

/** Etapas do funil (cartões como no painel; `key` alinha com `funnelWorstKey` para “Maior perda”). */
export type PainelAdsFunnelStep = {
  /** Opcional: mesmo `key` do `FunnelStripStep` no app (ex.: impr, clk, lpv, lead). */
  key?: string;
  title: string;
  volume: number;
  volumeLabel: string;
  rateLabel: string | null;
};

export type PainelAdsTrendPoint = {
  label: string;
  gasto: number;
  leads: number;
  /** yyyy-MM-dd — rótulos do eixo em dd/mm (evita colagem tipo 31/mar + 1/abr). */
  isoDate?: string;
};

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
  /** Destaque “Maior perda” no mesmo cartão que o funil do dashboard. */
  funnelWorstKey?: string | null;
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

function trendAxisLabel(isoDate: string | undefined, fallback: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return fallback;
  const [, mo, d] = isoDate.split("-");
  return `${d}/${mo}`;
}

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
  const minRowH = 22;
  const headerRowH = 22;

  y = ctx.ensureSpace(y, headerRowH + 4);
  const headerTop = y;
  doc.setFillColor(HEADER_FILL[0], HEADER_FILL[1], HEADER_FILL[2]);
  doc.rect(colL, headerTop, colR - colL, headerRowH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
  doc.text("INDICADOR", colL + 6, headerTop + 15);
  doc.text("VALOR", colR - 6, headerTop + 15, { align: "right" });
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(0.5);
  doc.rect(colL, headerTop, colR - colL, headerRowH, "S");
  y = headerTop + headerRowH;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    const lab = doc.splitTextToSize(row.label, mid - colL - 12);
    doc.setFont("helvetica", "bold");
    const valLines = doc.splitTextToSize(row.value, colR - mid - 12);
    const lineCount = Math.max(lab.length, valLines.length, 1);
    const cellH = Math.max(minRowH, 10 + lineCount * 11);
    y = ctx.ensureSpace(y, cellH + 2);
    const rowTop = y;
    if (i % 2 === 1) {
      doc.setFillColor(252, 252, 253);
      doc.rect(colL, rowTop, colR - colL, cellH, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(TEXT_BODY[0], TEXT_BODY[1], TEXT_BODY[2]);
    doc.text(lab, colL + 6, rowTop + 14);
    doc.setFont("helvetica", "bold");
    doc.text(valLines, colR - 6, rowTop + 14, { align: "right" });
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.rect(colL, rowTop, colR - colL, cellH, "S");
    doc.line(mid, rowTop, mid, rowTop + cellH);
    y = rowTop + cellH;
  }
  return y + 8;
}

/** Funil em faixa de cartões — espelha `MarketingFunnelStrip` do painel. */
function drawFunnelSection(
  ctx: PdfContext,
  startY: number,
  steps: PainelAdsFunnelStep[],
  worstKey: string | null | undefined
): number {
  if (!steps.length) return startY;
  const { doc, pageW, m } = ctx;
  const gap = 6;
  const innerW = pageW - 2 * m;
  const n = steps.length;
  const cardW = (innerW - (n - 1) * gap) / n;
  const anyWorst = Boolean(worstKey && steps.some((s) => s.key === worstKey));
  const cardH = anyWorst ? 78 : 64;
  const blockH = 28 + cardH + 8;
  let y = ctx.ensureSpace(startY, blockH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(TEXT_BODY[0], TEXT_BODY[1], TEXT_BODY[2]);
  doc.text("Funil de captação (resumo)", m, y);
  y += 10;
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.line(m, y, pageW - m, y);
  y += 14;

  const rowTop = y;
  for (let i = 0; i < n; i++) {
    const s = steps[i];
    const worst = Boolean(worstKey && s.key && s.key === worstKey);
    const x = m + i * (cardW + gap);

    if (worst) {
      doc.setFillColor(255, 241, 242);
      doc.setDrawColor(244, 63, 94);
      doc.setLineWidth(1.1);
    } else {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.75);
    }
    doc.roundedRect(x, rowTop, cardW, cardH, 4, 4, "FD");

    const pad = 6;
    const cx = x + pad;
    const maxTxt = cardW - 2 * pad;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
    const titleU = s.title.toUpperCase();
    const titleLines = doc.splitTextToSize(titleU, maxTxt).slice(0, 2);
    const titleH = 8 + (titleLines.length - 1) * 9;
    doc.text(titleLines, cx, rowTop + 10);

    const volY = rowTop + 10 + titleH + 12;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(TEXT_BODY[0], TEXT_BODY[1], TEXT_BODY[2]);
    doc.text(s.volumeLabel, cx, volY);

    const rateY = volY + 14;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(55, 65, 81);
    const rateTxt = s.rateLabel ?? "—";
    doc.text(rateTxt, cx, rateY);

    if (worst) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(190, 18, 60);
      doc.text("MAIOR PERDA", cx, rateY + 12);
    }
  }

  return rowTop + cardH + 14;
}

/** Gráfico de linhas: gasto (índigo) e leads (verde). */
function drawTrendChart(ctx: PdfContext, startY: number, points: PainelAdsTrendPoint[]): number {
  if (points.length < 2) return startY;
  const { doc, pageW, m } = ctx;
  const chartH = 150;
  const axisPadBottom = 34;
  const chartTopPad = 36;
  const need = chartH + chartTopPad + axisPadBottom + 20;
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
  const yTop = y + 4;
  const innerH = chartH - 4;
  const w = x1 - x0;
  const maxG = Math.max(...points.map((p) => p.gasto), 1e-6);
  const maxL = Math.max(...points.map((p) => p.leads), 1e-6);
  const n = points.length;

  doc.setDrawColor(241, 245, 249);
  doc.setLineWidth(0.35);
  for (let g = 1; g <= 3; g++) {
    const yy = y0 - (g / 4) * (innerH - 10);
    doc.line(x0, yy, x1, yy);
  }

  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(0.5);
  doc.rect(x0, yTop, w, innerH, "S");

  const gx = (i: number) => x0 + (n <= 1 ? w / 2 : (i / (n - 1)) * w);
  const gyG = (g: number) => y0 - (g / maxG) * (innerH - 12);
  const gyL = (l: number) => y0 - (l / maxL) * (innerH - 12);

  doc.setDrawColor(BRAND_TOP.r, BRAND_TOP.g, BRAND_TOP.b);
  doc.setLineWidth(1.15);
  for (let i = 0; i < n - 1; i++) {
    doc.line(gx(i), gyG(points[i].gasto), gx(i + 1), gyG(points[i + 1].gasto));
  }
  doc.setDrawColor(22, 163, 74);
  doc.setLineWidth(1);
  for (let i = 0; i < n - 1; i++) {
    doc.line(gx(i), gyL(points[i].leads), gx(i + 1), gyL(points[i + 1].leads));
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
  const maxTicks = n > 18 ? 8 : n > 12 ? 10 : n;
  const step = Math.max(1, Math.ceil(n / maxTicks));
  const labelY = y0 + 12;
  const tickW = 22;
  for (let i = 0; i < n; i += step) {
    const lb = trendAxisLabel(points[i].isoDate, points[i].label);
    doc.text(lb, gx(i), labelY, { align: "center", maxWidth: tickW });
  }
  if ((n - 1) % step !== 0) {
    const lb = trendAxisLabel(points[n - 1].isoDate, points[n - 1].label);
    doc.text(lb, gx(n - 1), labelY, { align: "center", maxWidth: tickW });
  }

  doc.setFontSize(7);
  doc.text(`Máx. gasto: ${maxG.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`, x1, yTop - 2, { align: "right" });
  doc.text(`Máx. leads: ${maxL.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`, x1, yTop + 8, { align: "right" });

  y = y0 + axisPadBottom;
  doc.setFontSize(8);
  doc.setTextColor(BRAND_TOP.r, BRAND_TOP.g, BRAND_TOP.b);
  doc.text("— Gasto (R$)", m, y);
  doc.setTextColor(22, 163, 74);
  doc.text("— Leads", m + 88, y);
  return y + 14;
}

/** Tabela campanhas: várias colunas com borda. */
function drawCampaignsTable(ctx: PdfContext, startY: number, rows: PainelAdsCampaignPdfRow[]): number {
  if (!rows.length) return startY;
  const { doc, pageW, m } = ctx;
  const headers = ["Canal", "Campanha", "Gasto", "Impr.", "Cliq.", "CTR", "CPC", "Leads"];
  const colWeights = [0.08, 0.34, 0.11, 0.09, 0.09, 0.07, 0.1, 0.12];
  const innerW = pageW - 2 * m;
  const cols = colWeights.map((w) => innerW * w);
  const rowH = 17;
  const headerH = 18;

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
      doc.setFontSize(c === 1 ? 7.5 : 8);
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

  const titleY = 40;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const wsLines = doc.splitTextToSize(input.workspaceName.trim() || "Workspace", pageW - 2 * m - 4);
  const wsStartY = titleY + 22;
  const wsLinePitch = 13;
  const headerBarH = Math.max(82, wsStartY + wsLines.length * wsLinePitch + 14);

  doc.setFillColor(BRAND_TOP.r, BRAND_TOP.g, BRAND_TOP.b);
  doc.rect(0, 0, pageW, headerBarH, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Painel ADS", m, titleY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(226, 232, 240);
  doc.text("Ativa Dash", pageW - m, 28, { align: "right" });
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(wsLines, m, wsStartY);

  let y = headerBarH + 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
  const periodBlock = `${input.periodLabel} — ${input.startDate} a ${input.endDate}`;
  const periodLines = doc.splitTextToSize(periodBlock, pageW - 2 * m);
  doc.text(periodLines, m, y);
  y += periodLines.length * 12 + 10;

  doc.setFontSize(9);
  doc.text(`Objetivo da conta: ${input.objectiveLabel}`, m, y);
  y += 20;

  if (input.funnelSteps?.length) {
    y = drawFunnelSection(ctx, y, input.funnelSteps, input.funnelWorstKey ?? null);
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

/** High-fidelity: captura o DOM node como imagem multi-página A4.
 *  Esconde botões de ação durante a captura via CSS class. */
export async function downloadScreenshotPdf(
  element: HTMLElement,
  filename: string
): Promise<void> {
  const hideClass = "__pdf-hide-actions";
  element.classList.add(hideClass);

  const style = document.createElement("style");
  style.textContent = `
    .${hideClass} button,
    .${hideClass} [data-pdf-hide],
    .${hideClass} .h-9.rounded-lg {
      visibility: hidden !important;
      height: 0 !important;
      overflow: hidden !important;
      margin: 0 !important;
      padding: 0 !important;
    }
  `;
  document.head.appendChild(style);

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      windowWidth: element.scrollWidth,
      backgroundColor: "#ffffff",
    });

    const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 24;
    const usableW = pageW - margin * 2;
    const ratio = canvas.height / canvas.width;
    const imgH = usableW * ratio;
    const usableH = pageH - margin * 2;

    let yOffset = 0;
    let page = 0;
    while (yOffset < imgH) {
      if (page > 0) pdf.addPage();
      const srcY = (yOffset / imgH) * canvas.height;
      const sliceH = Math.min(usableH, imgH - yOffset);
      const srcSliceH = (sliceH / imgH) * canvas.height;

      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = Math.ceil(srcSliceH);
      const ctx = sliceCanvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcSliceH, 0, 0, canvas.width, srcSliceH);
      }
      const sliceImg = sliceCanvas.toDataURL("image/png");
      pdf.addImage(sliceImg, "PNG", margin, margin, usableW, sliceH);
      yOffset += usableH;
      page++;
    }

    const totalPages = pdf.getNumberOfPages();
    const now = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(7);
      pdf.setTextColor(160, 160, 160);
      pdf.text(`Ativa Dash · Gerado em ${now}`, margin, pageH - 12);
      pdf.text(`${i} / ${totalPages}`, pageW - margin, pageH - 12, { align: "right" });
    }

    pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
  } finally {
    element.classList.remove(hideClass);
    style.remove();
  }
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
