import { jsPDF } from 'jspdf';
import { DTE_NAMES, type Company, type InvoiceDocument } from '../src/types/index.js';

const usd = (amount: number) => `$${amount.toFixed(2)}`;
const clean = (value: string | undefined) => (value || '').replace(/[\x00-\x1f\x7f]/g, ' ').trim();

/** Generate the attachment from the same stored invoice that determines the recipient. */
export function invoiceEmailPdf(company: Company, invoice: InvoiceDocument): string {
  const pdf = new jsPDF({ unit: 'mm', format: 'letter', compress: true });
  const margin = 15;
  const width = pdf.internal.pageSize.getWidth() - margin * 2;
  const bottom = pdf.internal.pageSize.getHeight() - margin;
  let y = margin;
  pdf.setProperties({ title: invoice.controlNumber, subject: DTE_NAMES[invoice.dteType].name });

  const write = (value: string, size = 10, bold = false) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    const step = size * 0.45;
    for (const line of pdf.splitTextToSize(clean(value), width) as string[]) {
      if (y + step > bottom) {
        pdf.addPage();
        pdf.setFontSize(9);
        pdf.text(invoice.controlNumber, margin, margin);
        pdf.setFontSize(size);
        y = margin + 8;
      }
      pdf.text(line, margin, y);
      y += step;
    }
  };

  write(company.name, 16, true);
  write(`NIT ${company.nit}   NRC ${company.nrc}`);
  write(company.address);
  y += 4;
  write(DTE_NAMES[invoice.dteType].name, 14, true);
  write(`Control: ${invoice.controlNumber}`);
  write(`Código de generación: ${invoice.generationCode}`);
  write(`Sello de recepción: ${invoice.mhReceptionStamp}`);
  write(`Fecha de emisión: ${invoice.emissionDate} ${invoice.emissionTime}`);
  if (invoice.referencedDte) write(`Documento de referencia: ${invoice.referencedDte}`);
  y += 4;
  write(`Receptor: ${invoice.clientName}`, 11, true);
  write(`${invoice.clientDocType} ${invoice.clientDocNumber}${invoice.clientNrc ? `   NRC ${invoice.clientNrc}` : ''}`);
  if (invoice.clientAddress) write(invoice.clientAddress);
  y += 4;
  write('Detalle del documento', 12, true);
  for (const [index, item] of invoice.items.entries()) {
    write(`${index + 1}. ${item.description}`, 10, true);
    write(`Cantidad ${item.quantity}   Unitario ${usd(item.unitPrice)}   Descuento ${usd(item.discount)}   Importe ${usd(item.total)}`);
    write(({ GRAVADO: 'Gravado', EXENTO: 'Exento', NO_SUJETO: 'No sujeto' })[item.taxType], 9);
    y += 2;
  }
  write(`Gravado ${usd(invoice.subtotalGravado)}   Exento ${usd(invoice.subtotalExento)}   No sujeto ${usd(invoice.subtotalNoSujeto)}`);
  const ivaIncluded = invoice.dteType === '01';
  write(`IVA 13 %${ivaIncluded ? ' incluido' : ''}: ${usd(invoice.iva13)}`);
  if (invoice.retencion1) write(`Retención IVA 1 %: ${usd(invoice.retencion1)}`);
  if (invoice.percepcion1) write(`Percepción IVA 1 %: ${usd(invoice.percepcion1)}`);
  if (invoice.retencionRenta10) write(`Retención ISR: ${usd(invoice.retencionRenta10)}`);
  const adjustment = ['05', '06'].includes(invoice.dteType);
  write(`${adjustment ? 'Importe del ajuste' : 'Total a pagar'}: ${usd(invoice.totalPagar)} USD`, 12, true);
  if (!adjustment) write(`Condición de pago: ${invoice.condition}`);
  if (invoice.observations) write(`Observaciones: ${invoice.observations}`);
  return Buffer.from(pdf.output('arraybuffer')).toString('base64');
}
