import { useMemo } from 'react';
import QRCode from 'qrcode';

/** Generated locally: no invoice identifier is sent to an external image/QR service. */
export function HaciendaQr({ url }: { url: string }) {
  const qr = useMemo(() => QRCode.create(url, { errorCorrectionLevel: 'M' }).modules, [url]);
  const cells: string[] = [];
  for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++) {
    if (qr.get(y, x)) cells.push(`M${x + 4},${y + 4}h1v1h-1z`);
  }
  return <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Consultar este documento en Hacienda">
    <svg role="img" aria-label="QR de consulta pública de Hacienda" viewBox={`0 0 ${qr.size + 8} ${qr.size + 8}`} width="144" height="144" shapeRendering="crispEdges">
      <rect width="100%" height="100%" fill="white" /><path d={cells.join('')} fill="black" />
    </svg>
    <span className="text-[10px] text-blue-800 underline">Consulta pública · ambiente 00</span>
  </a>;
}
