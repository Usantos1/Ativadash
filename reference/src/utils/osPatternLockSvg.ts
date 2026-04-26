/**
 * Geração do SVG do padrão de desbloqueio (senha deslizar) para OS.
 * Grid 0-8 igual ao PatternLock: 0=top-left, 1=top-center, 2=top-right,
 * 3=mid-left, 4=center, 5=mid-right, 6=bot-left, 7=bot-center, 8=bot-right.
 * Usado em cupom térmico, PDF e A4 para garantir o mesmo desenho.
 */
export function patternToSvg(
  pattern: string | number[] | undefined,
  options?: { size?: number; viewBox?: string }
): string {
  let raw = '';
  if (typeof pattern === 'string') {
    raw = pattern.trim();
  } else if (Array.isArray(pattern) && pattern.length >= 2) {
    raw = pattern.map(n => Number(n)).filter(n => !isNaN(n) && n >= 0 && n <= 8).join('-');
  }
  if (!raw) return '';
  let seq = raw.replace(/\s/g, '').split(/[-,.;]/).map(s => s.trim()).filter(Boolean);
  if (seq.length < 2) return '';
  // PatternLock envia índices 0-8; usar como está (não converter 1-9 para 0-8, senão o 1 vira topo-esquerda em vez de topo-centro)
  const numSeq: number[] = [];
  for (const d of seq) {
    const n = parseInt(d, 10);
    if (isNaN(n)) continue;
    if (n >= 0 && n <= 8) numSeq.push(n);
  }
  if (numSeq.length < 2) return '';
  const seqStr = numSeq.map(n => String(n));
  const points: Record<string, [number, number]> = {
    '0': [20, 20], '1': [50, 20], '2': [80, 20],
    '3': [20, 50], '4': [50, 50], '5': [80, 50],
    '6': [20, 80], '7': [50, 80], '8': [80, 80],
  };
  const lines: string[] = [];
  for (let i = 0; i < seqStr.length - 1; i++) {
    const a = points[seqStr[i]];
    const b = points[seqStr[i + 1]];
    if (a && b) lines.push(`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#000" stroke-width="3" stroke-linecap="round"/>`);
  }
  const circles = ['0','1','2','3','4','5','6','7','8'].map(k => {
    const [x, y] = points[k];
    const active = seqStr.includes(k);
    const order = active ? seqStr.indexOf(k) + 1 : 0;
    const numText = order ? `<text x="${Math.min(x + 10, 90)}" y="${y + 5}" font-family="Arial,sans-serif" font-size="11" font-weight="bold" fill="#000">${order}</text>` : '';
    return `<circle cx="${x}" cy="${y}" r="7" fill="${active ? '#000' : '#fff'}" stroke="#000" stroke-width="2.5"/>${numText}`;
  }).join('');
  const size = options?.size ?? 140;
  const viewBox = options?.viewBox ?? '0 0 100 100';
  return `<div style="margin: 4px 0; text-align: center;"><svg width="${size}" height="${size}" viewBox="${viewBox}" style="display:inline-block;vertical-align:middle;"><rect x="1" y="1" width="98" height="98" rx="6" fill="#fff" stroke="#000" stroke-width="2"/>${lines.join('')}${circles}</svg></div>`;
}

export const POSSUI_SENHA_LABELS: Record<string, string> = {
  sim: 'SIM',
  deslizar: 'SIM - DESLIZAR (DESENHO)',
  nao: 'NÃO',
  nao_sabe: 'NÃO SABE, VAI PASSAR DEPOIS',
  nao_autorizou: 'CLIENTE NÃO QUIS DEIXAR SENHA',
};
