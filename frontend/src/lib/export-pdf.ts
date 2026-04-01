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
