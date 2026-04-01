import Papa from "papaparse";

export function downloadCsv(filename: string, rows: Record<string, unknown>[]): void {
  const csv = Papa.unparse(rows, { header: true });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function openMailtoWithReportNote(to: string, subject: string, fileHint: string): void {
  const body = `Olá,\n\nSegue o relatório: ${fileHint}\n\n(Anexe o ficheiro exportado localmente.)\n`;
  window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
