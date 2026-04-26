import jsPDF from 'jspdf';
// @ts-ignore
import JsBarcode from 'jsbarcode';

export interface EtiquetaData {
  descricao: string;
  descricao_abreviada?: string;
  preco_venda: number;
  codigo_barras?: string;
  codigo?: number;
  referencia?: string;
  empresa?: {
    nome?: string;
    logo?: string;
  };
}

function onlyDigits(s: string) {
  return (s || '').replace(/\D/g, '');
}

function mmToPx(mm: number, dpi: number) {
  return Math.max(1, Math.round((mm * dpi) / 25.4));
}

// calcula dígito verificador EAN13 a partir de 12 dígitos
function ean13CheckDigit(d12: string) {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const n = parseInt(d12[i], 10);
    sum += (i % 2 === 0) ? n : n * 3;
  }
  const mod = sum % 10;
  return (mod === 0) ? 0 : (10 - mod);
}

// se não vier codigo_barras, monta EAN13: prefixo + código (padrão tipo o seu 78900000xxxxx?)
function buildEan13FromCodigo(codigo: number | string) {
  const cod = String(codigo ?? '').replace(/\D/g, '').padStart(5, '0'); // 2515 -> 02515
  const prefix12 = `78900000${cod}`; // 8 + 5 = 13? aqui é 12 antes do DV
  // garante 12 dígitos antes do DV
  const d12 = prefix12.slice(0, 12);
  const dv = ean13CheckDigit(d12);
  return `${d12}${dv}`;
}

function makeBarcodeDataUrl(value: string, targetWmm: number, targetHmm: number, dpi = 300) {
  const canvas = document.createElement('canvas');
  const digits = onlyDigits(value);

  const useEAN13 = digits.length === 13;
  const barcodeValue = useEAN13 ? digits : (value || '123456789012');

  // cria um canvas grande (alta resolução)
  const pxW = mmToPx(targetWmm, dpi);
  const pxH = mmToPx(targetHmm, dpi);
  canvas.width = pxW;
  canvas.height = pxH;

  // "altura" só das barras (sem texto)
  const barsPxH = Math.round(pxH * 0.78);

  // largura do módulo (px) proporcional ao tamanho final
  // 95 módulos do EAN13 + "respiro" (quiet zone)
  const modulePx = Math.max(2, Math.floor(pxW / 115));

  try {
    // @ts-ignore
    JsBarcode(canvas, barcodeValue, {
      format: useEAN13 ? 'EAN13' : 'CODE128',
      width: modulePx,
      height: barsPxH,
      margin: 0,
      displayValue: false,
    });
  } catch {
    // @ts-ignore
    JsBarcode(canvas, barcodeValue, {
      format: 'CODE128',
      width: modulePx,
      height: barsPxH,
      margin: 0,
      displayValue: false,
    });
  }

  return { dataUrl: canvas.toDataURL('image/png'), barcodeValue };
}

function drawEtiqueta(doc: jsPDF, x: number, y: number, w: number, h: number, data: EtiquetaData) {
  const pad = 1;
  const marginTop = 7.5; // Margem superior maior para evitar corte do preço

  // Fundo
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, w, h, 'F');

  // ====== DEFINIÇÕES DE ÁREAS ======
  const logoSize = 12;
  const logoX = x + pad;
  const codeColW = 5;
  const codeX = logoX + logoSize + 2;
  const barcodeX = codeX + codeColW + 2.5;
  const barcodeW = x + w - pad - barcodeX;

  // Área inferior (onde ficam logo, código e barcode)
  const logoY = y + h - pad - logoSize;

  // ====== PREÇO centralizado acima do logo PRIME CAMP (quase colado) ======
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5); // Fonte maior para o preço
  const price = `R$ ${data.preco_venda.toFixed(2).replace('.', ',')}`;
  // Calcula largura do texto para garantir margens adequadas
  const priceWidth = doc.getTextWidth(price);
  const marginLeft = pad + 2; // Margem maior à esquerda para não cortar o "R"
  const maxRightX = x + w - pad; // Borda direita da etiqueta
  // Posição inicial: centralizado no logo, mas deslocado para a direita
  const logoCenterX = logoX + logoSize / 2;
  // Desloca o preço para a direita para garantir margem à esquerda
  const priceCenterX = logoCenterX + 3; // Desloca 3mm para a direita
  // Verifica se não ultrapassa a borda direita
  const priceRightX = priceCenterX + priceWidth / 2;
  const priceLeftX = priceCenterX - priceWidth / 2;
  // Ajusta se necessário
  let finalPriceX = priceCenterX;
  if (priceLeftX < x + marginLeft) {
    // Se ultrapassar à esquerda, ajusta para ter margem
    finalPriceX = x + marginLeft + priceWidth / 2;
  } else if (priceRightX > maxRightX) {
    // Se ultrapassar à direita, ajusta
    finalPriceX = maxRightX - priceWidth / 2;
  }
  // Logo está em logoY = y + 25 - 1 - 12 = y + 12
  // Preço deve estar acima do logo, quase colado, mas com espaço suficiente
  const priceY = logoY - 1.2; // Quase colado no logo, com espaço suficiente
  doc.text(price, finalPriceX, priceY, { align: 'center' } as any);

  // ====== LOGO (quadrado vermelho) - parte esquerda inferior ======
  // Fundo vermelho do logo
  doc.setFillColor(220, 38, 38);
  doc.rect(logoX, logoY, logoSize, logoSize, 'F');

  // Tenta desenhar logo (se existir). Se falhar, escreve PRIME/CAMP
  let logoOk = false;

  if (data.empresa?.logo) {
    try {
      doc.addImage(
        data.empresa.logo,
        'PNG',
        logoX + 0.6,
        logoY + 0.6,
        logoSize - 1.2,
        logoSize - 1.2
      );
      logoOk = true;
    } catch {
      logoOk = false;
    }
  }

  if (!logoOk) {
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);

    const cx = logoX + logoSize / 2;
    const cy = logoY + logoSize / 2;

    doc.text('PRIME', cx, cy - 1.2, { align: 'center' } as any);
    doc.text('CAMP',  cx, cy + 2.4, { align: 'center' } as any);
  }

  // ====== CÓDIGO DO PRODUTO (vertical) entre logo e barcode ======
  if (data.codigo !== undefined && data.codigo !== null) {
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5); // Fonte bem maior para o código
    doc.text(String(data.codigo), codeX + (codeColW / 2), y + h - 2.0, { angle: 90 } as any);
  }

  // ====== BARCODE (parte direita inferior) ======
  let barcodeValueToUse = data.codigo_barras ? onlyDigits(data.codigo_barras) : '';
  if (!barcodeValueToUse && data.codigo !== undefined && data.codigo !== null) {
    barcodeValueToUse = buildEan13FromCodigo(data.codigo);
  }
  if (!barcodeValueToUse) barcodeValueToUse = '7890000000000';

  const barcodeTextH = 3.2;
  const barcodeBarsH = 11.5;
  const barcodeDpi = 300;

  const { dataUrl: barcodePng, barcodeValue } = makeBarcodeDataUrl(
    barcodeValueToUse,
    barcodeW,
    barcodeBarsH,
    barcodeDpi
  );

  const barcodeBottom = y + h - pad;
  const barcodeTextY = barcodeBottom - 0.6;
  const barcodeBarsY = barcodeBottom - barcodeTextH - barcodeBarsH;

  doc.addImage(barcodePng, 'PNG', barcodeX, barcodeBarsY, barcodeW, barcodeBarsH);

  // número do barcode
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(barcodeValue, barcodeX + barcodeW / 2, barcodeTextY, { align: 'center' } as any);

  // ====== NOME DO PRODUTO centralizado na etiqueta, quase colado no código de barras ======
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  const title = (data.descricao_abreviada || data.descricao || '').toUpperCase();
  
  // Área disponível para o título (da margem superior até acima do barcode)
  const titleTopY = y + marginTop; // Começa da margem superior
  const titleBottomY = barcodeBarsY - 2.0; // Para 2mm antes do barcode
  const titleMaxWidth = w - (pad * 2); // Largura total da etiqueta menos margens laterais
  
  // Quebra o texto em linhas
  const titleLines = doc.splitTextToSize(title, titleMaxWidth);
  
  // Centraliza na etiqueta: X é o centro da etiqueta
  const titleCenterX = x + w / 2;
  
  // Desenha de cima para baixo, começando da margem superior
  let currentY = titleTopY;
  const lineHeight = 3.5;
  
  // Limita o número de linhas para não sobrepor o barcode
  const maxLines = Math.floor((titleBottomY - titleTopY) / lineHeight);
  const linesToDraw = titleLines.slice(0, Math.max(1, maxLines));
  
  for (const line of linesToDraw) {
    doc.text(line, titleCenterX, currentY, { align: 'center' } as any);
    currentY += lineHeight;
  }
}

/**
 * Etiqueta única (igual a foto): 54mm x 25mm - HORIZONTAL
 */
export async function generateEtiquetaPDF(data: EtiquetaData): Promise<jsPDF> {
  // Validação dos dados
  if (!data.descricao) {
    throw new Error('Descrição do produto é obrigatória');
  }
  if (typeof data.preco_venda !== 'number' || data.preco_venda < 0) {
    throw new Error('Preço de venda inválido');
  }

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [54, 25], // Largura x Altura (54mm x 25mm) - HORIZONTAL
    compress: true,
  });

  drawEtiqueta(doc, 0, 0, 54, 25, data);
  return doc;
}

/**
 * A4 com várias etiquetas: desenha direto, sem "PDF dentro de PNG"
 */
export async function generateEtiquetasA4(
  produtos: EtiquetaData[],
  colunas: number = 3,
  linhas: number = 10
): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageW = 210;
  const pageH = 297;

  const w = 54; // Largura da etiqueta (horizontal)
  const h = 25; // Altura da etiqueta (horizontal)

  const gapX = 2;
  const gapY = 2;

  const gridW = colunas * w + (colunas - 1) * gapX;
  const gridH = linhas * h + (linhas - 1) * gapY;

  const startX = (pageW - gridW) / 2;
  const startY = (pageH - gridH) / 2;

  let i = 0;
  for (let r = 0; r < linhas; r++) {
    for (let c = 0; c < colunas; c++) {
      if (i >= produtos.length) return doc;

      const x = startX + c * (w + gapX);
      const y = startY + r * (h + gapY);

      drawEtiqueta(doc, x, y, w, h, produtos[i]);
      i++;
    }
  }

  return doc;
}

/**
 * Imprime etiqueta diretamente
 */
export function printEtiqueta(data: EtiquetaData) {
  generateEtiquetaPDF(data).then((doc) => {
    doc.autoPrint();
    doc.output('dataurlnewwindow');
  });
}
