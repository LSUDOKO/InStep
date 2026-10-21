import QRCode from 'qrcode';

/** QR modules as rows of booleans (rendered with plain Views — no canvas needed on Vega). */
export function qrMatrix(text: string): boolean[][] {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const n = modules.size;
  return Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => !!modules.get(x, y)));
}
