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

export type PainelAdsFunnelStep = {
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
  funnelWorstKey?: string | null;
  trend?: PainelAdsTrendPoint[];
  topCampaigns?: PainelAdsCampaignPdfRow[];
};

/* ── Design tokens ── */
const BRAND = { r: 49, g: 46, b: 129 };
const BRAND_LIGHT = { r: 99, g: 102, b: 241 };
const ACCENT_GREEN = { r: 16, g: 185, b: 129 };
const ACCENT_RED = { r: 239, g: 68, b: 68 };

const C_BODY: RGB = [31, 41, 55];
const C_MUTED: RGB = [100, 116, 139];
const C_WHITE: RGB = [255, 255, 255];
const C_LINE: RGB = [226, 232, 240];
const C_BG_SUBTLE: RGB = [248, 250, 252];

type RGB = [number, number, number];
type PdfCtx = {
  doc: jsPDF;
  pw: number;
  ph: number;
  m: number;
  safe: number;
  inner: number;
  ensure: (y: number, need: number) => number;
};

function trendAxisLabel(iso: string | undefined, fallback: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return fallback;
  const [, mo, d] = iso.split("-");
  return `${d}/${mo}`;
}

/* ── Footer ── */
function drawFooter(doc: jsPDF, pw: number, ph: number, m: number, total: number): void {
  const ts = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C_LINE);
    doc.setLineWidth(0.4);
    doc.line(m, ph - 36, pw - m, ph - 36);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...C_MUTED);
    doc.text(`Ativa Dash · Gerado em ${ts} · Valores conforme período e filtros do painel.`, m, ph - 22);
    doc.text(`${i} / ${total}`, pw - m, ph - 22, { align: "right" });
  }
}

/* ── KPI Cards (grid de cards ao invés de tabela) ── */
function drawKpiCards(ctx: PdfCtx, y: number, title: string, rows: PainelAdsKpiRow[], accent: RGB): number {
  const { doc, m, inner } = ctx;

  y = ctx.ensure(y, 30);
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.roundedRect(m, y, 3, 16, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...C_BODY);
  doc.text(title, m + 10, y + 12);
  y += 28;

  const cols = Math.min(rows.length, 3);
  const gap = 10;
  const cardW = (inner - (cols - 1) * gap) / cols;
  const cardH = 56;

  for (let i = 0; i < rows.length; i++) {
    const col = i % cols;
    const rowIdx = Math.floor(i / cols);
    if (col === 0 && rowIdx > 0) y += cardH + gap;
    if (col === 0) y = ctx.ensure(y, cardH + gap);
    const x = m + col * (cardW + gap);
    const cy = y;

    doc.setFillColor(...C_BG_SUBTLE);
    doc.setDrawColor(...C_LINE);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, cy, cardW, cardH, 4, 4, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C_MUTED);
    doc.text(rows[i].label.toUpperCase(), x + 10, cy + 16);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...C_BODY);
    const val = doc.splitTextToSize(rows[i].value, cardW - 20);
    doc.text(val[0] ?? "—", x + 10, cy + 38);
  }

  const totalRows = Math.ceil(rows.length / cols);
  return y + totalRows * (cardH + gap) - gap + 8;
}

/* ── Funil profissional ── */
function drawFunnel(ctx: PdfCtx, y: number, steps: PainelAdsFunnelStep[], worstKey: string | null | undefined): number {
  if (!steps.length) return y;
  const { doc, m, inner } = ctx;
  const n = steps.length;
  const gap = 8;
  const cardW = (inner - (n - 1) * gap) / n;
  const cardH = 74;
  const needH = 30 + cardH + 14;

  y = ctx.ensure(y, needH);

  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.roundedRect(m, y, 3, 16, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...C_BODY);
  doc.text("Funil de Captação", m + 10, y + 12);
  y += 28;

  for (let i = 0; i < n; i++) {
    const s = steps[i];
    const worst = Boolean(worstKey && s.key && s.key === worstKey);
    const x = m + i * (cardW + gap);

    if (worst) {
      doc.setFillColor(254, 242, 242);
      doc.setDrawColor(ACCENT_RED.r, ACCENT_RED.g, ACCENT_RED.b);
      doc.setLineWidth(1.2);
    } else {
      doc.setFillColor(238, 242, 255);
      doc.setDrawColor(BRAND_LIGHT.r, BRAND_LIGHT.g, BRAND_LIGHT.b);
      doc.setLineWidth(0.6);
    }
    doc.roundedRect(x, y, cardW, cardH, 5, 5, "FD");

    const pad = 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...C_MUTED);
    const titleLines = doc.splitTextToSize(s.title.toUpperCase(), cardW - pad * 2).slice(0, 2);
    doc.text(titleLines, x + pad, y + 14);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...C_BODY);
    doc.text(s.volumeLabel, x + pad, y + 38);

    if (s.rateLabel) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(BRAND_LIGHT.r, BRAND_LIGHT.g, BRAND_LIGHT.b);
      doc.text(s.rateLabel, x + pad, y + 52);
    }

    if (worst) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      doc.setTextColor(ACCENT_RED.r, ACCENT_RED.g, ACCENT_RED.b);
      doc.text("MAIOR PERDA", x + pad, y + 66);
    }

    if (i < n - 1) {
      const arrowX = x + cardW + gap / 2;
      doc.setDrawColor(...C_LINE);
      doc.setLineWidth(1.5);
      doc.line(arrowX - 3, y + cardH / 2 - 3, arrowX + 3, y + cardH / 2);
      doc.line(arrowX - 3, y + cardH / 2 + 3, arrowX + 3, y + cardH / 2);
    }
  }

  return y + cardH + 14;
}

/* ── Gráfico de tendência ── */
function drawTrend(ctx: PdfCtx, y: number, points: PainelAdsTrendPoint[]): number {
  if (points.length < 2) return y;
  const { doc, m, pw } = ctx;
  const chartH = 140;
  const axisBottom = 30;
  const legendH = 20;
  const need = 30 + chartH + axisBottom + legendH;

  y = ctx.ensure(y, need);

  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.roundedRect(m, y, 3, 16, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...C_BODY);
  doc.text("Tendência Diária", m + 10, y + 12);
  y += 28;

  const x0 = m + 4;
  const x1 = pw - m - 4;
  const w = x1 - x0;
  const yTop = y;
  const yBot = y + chartH;
  const n = points.length;

  doc.setFillColor(...C_BG_SUBTLE);
  doc.setDrawColor(...C_LINE);
  doc.setLineWidth(0.3);
  doc.roundedRect(x0, yTop, w, chartH, 3, 3, "FD");

  for (let g = 1; g <= 3; g++) {
    const gy = yBot - (g / 4) * (chartH - 8);
    doc.setDrawColor(235, 238, 245);
    doc.setLineWidth(0.25);
    doc.line(x0 + 4, gy, x1 - 4, gy);
  }

  const maxG = Math.max(...points.map((p) => p.gasto), 1e-6);
  const maxL = Math.max(...points.map((p) => p.leads), 1e-6);
  const gx = (i: number) => x0 + 8 + (n <= 1 ? (w - 16) / 2 : (i / (n - 1)) * (w - 16));
  const gyG = (g: number) => yBot - 8 - (g / maxG) * (chartH - 20);
  const gyL = (l: number) => yBot - 8 - (l / maxL) * (chartH - 20);

  doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b);
  doc.setLineWidth(1.6);
  for (let i = 0; i < n - 1; i++) {
    doc.line(gx(i), gyG(points[i].gasto), gx(i + 1), gyG(points[i + 1].gasto));
  }
  for (let i = 0; i < n; i++) {
    doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
    doc.circle(gx(i), gyG(points[i].gasto), 2, "F");
  }

  doc.setDrawColor(ACCENT_GREEN.r, ACCENT_GREEN.g, ACCENT_GREEN.b);
  doc.setLineWidth(1.4);
  for (let i = 0; i < n - 1; i++) {
    doc.line(gx(i), gyL(points[i].leads), gx(i + 1), gyL(points[i + 1].leads));
  }
  for (let i = 0; i < n; i++) {
    doc.setFillColor(ACCENT_GREEN.r, ACCENT_GREEN.g, ACCENT_GREEN.b);
    doc.circle(gx(i), gyL(points[i].leads), 2, "F");
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...C_MUTED);
  const maxTicks = n > 18 ? 8 : n > 12 ? 10 : n;
  const step = Math.max(1, Math.ceil(n / maxTicks));
  const labelY = yBot + 11;
  for (let i = 0; i < n; i += step) {
    doc.text(trendAxisLabel(points[i].isoDate, points[i].label), gx(i), labelY, { align: "center" });
  }
  if ((n - 1) % step !== 0) {
    doc.text(trendAxisLabel(points[n - 1].isoDate, points[n - 1].label), gx(n - 1), labelY, { align: "center" });
  }

  const legY = yBot + axisBottom;
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.circle(m + 8, legY - 2, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.text("Gasto (R$)", m + 16, legY);

  doc.setFillColor(ACCENT_GREEN.r, ACCENT_GREEN.g, ACCENT_GREEN.b);
  doc.circle(m + 86, legY - 2, 3, "F");
  doc.setTextColor(ACCENT_GREEN.r, ACCENT_GREEN.g, ACCENT_GREEN.b);
  doc.text("Leads", m + 94, legY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...C_MUTED);
  doc.text(`Máx. gasto: ${maxG.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`, x1, yTop + 10, { align: "right" });
  doc.text(`Máx. leads: ${maxL.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`, x1, yTop + 20, { align: "right" });

  return legY + legendH;
}

/* ── Tabela de campanhas ── */
function drawCampaigns(ctx: PdfCtx, y: number, rows: PainelAdsCampaignPdfRow[]): number {
  if (!rows.length) return y;
  const { doc, m, inner } = ctx;
  const headers = ["Canal", "Campanha", "Gasto", "Impr.", "Cliq.", "CTR", "CPC", "Leads"];
  const colW = [0.07, 0.33, 0.11, 0.09, 0.09, 0.08, 0.11, 0.12].map((w) => inner * w);
  const rowH = 20;
  const headerH = 22;

  y = ctx.ensure(y, 30 + headerH);

  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.roundedRect(m, y, 3, 16, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...C_BODY);
  doc.text("Top Campanhas por Investimento", m + 10, y + 12);
  y += 28;

  y = ctx.ensure(y, headerH + 4);
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.roundedRect(m, y, inner, headerH, 3, 3, "F");
  let hx = m;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...C_WHITE);
  for (let c = 0; c < headers.length; c++) {
    doc.text(headers[c], hx + 5, y + 14, { maxWidth: colW[c] - 10 });
    hx += colW[c];
  }
  y += headerH;

  for (let i = 0; i < rows.length; i++) {
    y = ctx.ensure(y, rowH + 2);
    const r = rows[i];
    const cells = [r.channel, r.name, r.gasto, r.impressoes, r.cliques, r.ctr, r.cpc, r.leads];

    if (i % 2 === 0) {
      doc.setFillColor(...C_BG_SUBTLE);
      doc.rect(m, y, inner, rowH, "F");
    }
    doc.setDrawColor(240, 243, 247);
    doc.setLineWidth(0.3);
    doc.line(m, y + rowH, m + inner, y + rowH);

    let cx = m;
    for (let c = 0; c < cells.length; c++) {
      doc.setFont("helvetica", c === 0 ? "bold" : "normal");
      doc.setFontSize(c === 1 ? 7 : 7.5);
      doc.setTextColor(...C_BODY);
      const txt = doc.splitTextToSize(cells[c] ?? "", colW[c] - 10).slice(0, 2);
      doc.text(txt, cx + 5, y + 13, { maxWidth: colW[c] - 10 });
      cx += colW[c];
    }
    y += rowH;
  }
  return y + 12;
}

/* ═══════════════════════════════════════════════════════════════
   Relatório principal: Painel ADS
   ═══════════════════════════════════════════════════════════════ */
export function downloadPainelAdsReportPdf(input: PainelAdsReportPdfInput): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 40;
  const safe = 52;
  const inner = pw - 2 * m;

  const ensure = (cy: number, need: number): number => {
    if (cy + need > ph - safe) { doc.addPage(); return m + 20; }
    return cy;
  };
  const ctx: PdfCtx = { doc, pw, ph, m, safe, inner, ensure };

  /* ── Header com gradiente simulado ── */
  const headerH = 100;
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(0, 0, pw, headerH, "F");
  doc.setFillColor(BRAND_LIGHT.r, BRAND_LIGHT.g, BRAND_LIGHT.b);
  doc.rect(0, headerH - 3, pw, 3, "F");

  doc.setTextColor(...C_WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("Relatório de Performance", m, 40);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(200, 210, 255);
  const wsText = input.workspaceName.trim() || "Workspace";
  doc.text(wsText, m, 60);

  doc.setFontSize(9);
  doc.setTextColor(180, 190, 230);
  doc.text(`${input.periodLabel} · ${input.startDate} a ${input.endDate}`, m, 78);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C_WHITE);
  doc.text("Ativa Dash", pw - m, 36, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(180, 190, 230);
  doc.text("ativadash.com", pw - m, 48, { align: "right" });

  let y = headerH + 18;

  /* ── Badge objetivo ── */
  const objText = `Objetivo: ${input.objectiveLabel}`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  const objW = doc.getTextWidth(objText) + 16;
  doc.setFillColor(238, 242, 255);
  doc.setDrawColor(BRAND_LIGHT.r, BRAND_LIGHT.g, BRAND_LIGHT.b);
  doc.setLineWidth(0.5);
  doc.roundedRect(m, y, objW, 18, 9, 9, "FD");
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.text(objText, m + 8, y + 12);
  y += 30;

  /* ── Funil ── */
  if (input.funnelSteps?.length) {
    y = drawFunnel(ctx, y, input.funnelSteps, input.funnelWorstKey ?? null);
  }

  /* ── Tendência ── */
  if (input.trend?.length && input.trend.length >= 2) {
    y = drawTrend(ctx, y, input.trend);
  }

  /* ── KPI Cards: Consolidado ── */
  y = drawKpiCards(ctx, y, "Resumo Consolidado", input.consolidated, [BRAND.r, BRAND.g, BRAND.b]);

  /* ── Meta Ads ── */
  if (input.metaSection?.rows.length) {
    y = drawKpiCards(ctx, y, input.metaSection.title, input.metaSection.rows, [59, 130, 246]);
  }

  /* ── Google Ads ── */
  if (input.googleSection?.rows.length) {
    y = drawKpiCards(ctx, y, input.googleSection.title, input.googleSection.rows, [234, 179, 8]);
  }

  /* ── Top Campanhas ── */
  if (input.topCampaigns?.length) {
    y = drawCampaigns(ctx, y, input.topCampaigns);
  }

  /* ── Nota de rodapé ── */
  if (input.footnote?.trim()) {
    y = ensure(y, 36);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(...C_MUTED);
    const fn = doc.splitTextToSize(input.footnote.trim(), inner);
    doc.text(fn, m, y);
  }

  drawFooter(doc, pw, ph, m, doc.getNumberOfPages());

  const name = input.filename.endsWith(".pdf") ? input.filename : `${input.filename}.pdf`;
  doc.save(name);
}

/* ── Screenshot PDF (captura DOM) ── */
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
      const sliceCtx = sliceCanvas.getContext("2d");
      if (sliceCtx) {
        sliceCtx.drawImage(canvas, 0, srcY, canvas.width, srcSliceH, 0, 0, canvas.width, srcSliceH);
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
